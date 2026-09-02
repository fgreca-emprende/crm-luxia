const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno locales
const envFile = fs.existsSync(path.resolve(__dirname, '../.env.local'))
  ? path.resolve(__dirname, '../.env.local')
  : path.resolve(__dirname, '../.env');

if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').replace(/^['"](.*)['"]$/, '$1');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initCronJobs } = require('./services/cronJobs');
const callablesRouter = require('./routes/callables');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 4000;

// [P1-3 FIX] HTTP Security Headers con Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL || 'http://localhost:8000', 'http://192.168.0.70:8000'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// [P1-1 FIX] Configuración estricta de CORS
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://192.168.0.70:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Origen bloqueado: ${origin}`);
    return callback(new Error(`Origen no permitido por política CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'apikey'],
}));

// [P1-2 FIX] Rate Limiters
// General: 300 req / 15 min por IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Por favor, intenta en unos minutos.' }
});

// IA: 25 req / min por IP/usuario
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Límite de consultas a IA alcanzado. Espera 1 minuto.' }
});

// Formulario web-to-lead público: 6 req / min
const publicFormLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: { error: 'Demasiados envíos de formulario. Espera unos minutos.' }
});

// [OBS-01 FIX] Middleware de Request Correlation ID
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || (require('crypto').randomUUID ? require('crypto').randomUUID() : String(Date.now()));
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

app.use(generalLimiter);
app.use('/api/copilot', aiLimiter);
app.use('/api/soporte-agent', aiLimiter);
app.use('/api/evaluar-examen', aiLimiter);
app.use('/api/public/web-to-lead', publicFormLimiter);

// [PERF-01 FIX] Límite de payload controlado a 1mb para prevenir DoS por heap exhaustion
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Inicialización del cliente Supabase Admin (Service Role)
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.warn('[CRM Backend] Advertencia: SUPABASE_SERVICE_ROLE_KEY no está configurada.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Guardar instancia de Supabase en la app de Express para inyección en rutas
app.set('supabase', supabase);

// [P2-8 FIX] Rutas de Salud del Servidor con verificación de conectividad real
app.get('/health', async (req, res) => {
  const start = Date.now();
  let dbStatus = 'unknown';
  let dbLatencyMs = null;

  try {
    const { error } = await supabase.from('config_general').select('id').limit(1);
    dbLatencyMs = Date.now() - start;
    dbStatus = error ? 'error' : 'ok';
  } catch (err) {
    dbLatencyMs = Date.now() - start;
    dbStatus = 'unreachable';
  }

  const isHealthy = dbStatus === 'ok';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'crm-luxia-backend-worker',
    timestamp: new Date().toISOString(),
    checks: {
      supabase: { status: dbStatus, latencyMs: dbLatencyMs }
    }
  });
});

// Montar Routers
app.use('/api', callablesRouter);
app.use('/api', apiRouter);

// Iniciar servidor HTTP
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 CRM-Luxia Backend Worker corriendo en puerto ${PORT}`);
  console.log(`📡 Conectado a Supabase en: ${supabaseUrl}`);
  console.log(`=======================================================`);

  // Inicializar Crons en segundo plano
  initCronJobs(supabase);
});
