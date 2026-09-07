const fs = require('fs');
const path = require('path');

const envFile = fs.existsSync(path.resolve(__dirname, '../../.env.local'))
  ? path.resolve(__dirname, '../../.env.local')
  : path.resolve(__dirname, '../../.env');

const envConfig = fs.readFileSync(envFile, 'utf-8');
envConfig.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...rest] = trimmed.split('=');
    const val = rest.join('=').replace(/^['"](.*)['"]$/, '$1');
    if (key) process.env[key] = val;
  }
});

const url = process.env.SUPABASE_URL || 'http://192.168.0.70:8000';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('▶️ Aplicando migración P1 (20260915_p1_rls_and_indexes.sql)...');
  const migPath = path.resolve(__dirname, '../../supabase/migrations/20260915_p1_rls_and_indexes.sql');
  const sql = fs.readFileSync(migPath, 'utf-8');

  const res = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ query: sql })
  });

  const body = await res.json();
  if (!res.ok) {
    console.error('❌ Error aplicando migración P1:', body);
    process.exit(1);
  }

  console.log('✅ Migración P1 aplicada exitosamente.');

  // Recargar esquema en PostgREST
  await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" })
  });
  console.log('✅ Esquema PostgREST recargado.');
}

run().catch(e => {
  console.error('Error fatal:', e);
  process.exit(1);
});
