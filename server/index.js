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
const { initCronJobs } = require('./services/cronJobs');
const callablesRouter = require('./routes/callables');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Rutas de Salud del Servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'crm-luxia-backend-worker',
    timestamp: new Date().toISOString(),
    supabaseConnected: !!supabase
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
