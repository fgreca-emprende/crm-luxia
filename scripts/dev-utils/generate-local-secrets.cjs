const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generador de JWT estándar para Supabase local
function base64UrlEncode(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createSupabaseJwt(role, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    role: role,
    iss: 'supabase-local',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 años
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const jwtSecret = crypto.randomBytes(32).toString('hex');
const postgresPassword = crypto.randomBytes(16).toString('hex');
const anonKey = createSupabaseJwt('anon', jwtSecret);
const serviceRoleKey = createSupabaseJwt('service_role', jwtSecret);

console.log('=== CREDENCIALES LOCALES GENERADAS DESDE CERO ===');
console.log('JWT_SECRET:', jwtSecret);
console.log('POSTGRES_PASSWORD:', postgresPassword);
console.log('ANON_KEY (VITE_SUPABASE_ANON_KEY):', anonKey);
console.log('SERVICE_ROLE_KEY:', serviceRoleKey);

const envContent = `# ==============================================================================
# CRM-LUXIA ENTERPRISE - CONFIGURACIÓN SUPABASE LOCAL (AUTOGENERADO)
# ==============================================================================

# Entorno
NODE_ENV=development
PORT=4000

# Base de datos PostgreSQL
POSTGRES_PASSWORD=${postgresPassword}
POSTGRES_DB=postgres
POSTGRES_PORT=5432
DB_HOST=localhost

# Claves Criptográficas de Supabase
JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceRoleKey}

# URLs de Conexión de Frontend y Backend
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_URL=http://localhost:8000
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}

# API Gateway Kong & Studio
KONG_HTTP_PORT=8000
STUDIO_PORT=3000

# Claves de Servicios de IA e Integraciones Externas (Configurables)
GEMINI_API_KEY=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
`;

const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const localEnvPath = path.join(__dirname, '..', '..', '.env.local');

fs.writeFileSync(rootEnvPath, envContent, 'utf-8');
fs.writeFileSync(localEnvPath, envContent, 'utf-8');

console.log('Archivos .env y .env.local creados exitosamente en la raíz del proyecto.');
