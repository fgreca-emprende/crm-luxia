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
  const res = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ 
      query: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'contratos' AND table_schema = 'public';
      `
    })
  });

  const columns = await res.json();
  console.log('Columnas en tabla contratos:', columns.map(c => c.column_name));

  // También consultar tabla usuario_uso_diario
  const res2 = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ 
      query: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'usuario_uso_diario' AND table_schema = 'public';
      `
    })
  });
  const colsUso = await res2.json();
  console.log('Columnas en usuario_uso_diario:', colsUso.map(c => c.column_name));

  // Y chequear RLS policies en usuario_uso_diario
  const res3 = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ 
      query: `
        SELECT polname, polcmd, polroles
        FROM pg_policy
        WHERE polrelid = 'public.usuario_uso_diario'::regclass;
      `
    })
  });
  const rlsUso = await res3.json();
  console.log('Políticas RLS en usuario_uso_diario:', rlsUso);
}

run().catch(console.error);
