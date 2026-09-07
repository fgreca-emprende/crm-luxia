const fs = require('fs');
const path = require('path');

const envFile = fs.existsSync(path.resolve(__dirname, '../../.env.local'))
  ? path.resolve(__dirname, '../../.env.local')
  : path.resolve(__dirname, '../../.env');

const envConfig = fs.readFileSync(envFile, 'utf-8');
const env = {};
envConfig.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...rest] = trimmed.split('=');
    const val = rest.join('=').replace(/^['"](.*)['"]$/, '$1');
    if (key) env[key] = val;
  }
});

const url = env.SUPABASE_URL || 'http://192.168.0.70:8000';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function verify() {
  try {
    const res = await fetch(`${url}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        query: "SELECT proname, prorettype::regtype FROM pg_proc WHERE proname IN ('convertir_lead_a_cliente', 'purgar_logs_historicos', 'handle_new_user');"
      })
    });
    const data = await res.json();
    console.log('✅ Funciones verificadas en PostgreSQL:');
    console.table(data);

    // Probar ejecución directa del procedimiento purgar_logs_historicos
    const rpcRes = await fetch(`${url}/rest/v1/rpc/purgar_logs_historicos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ p_dias_retencion: 90 })
    });
    const rpcData = await rpcRes.json();
    console.log('\n✅ Prueba de ejecución RPC purgar_logs_historicos:');
    console.log(rpcData);

  } catch (err) {
    console.error('❌ Error verificando:', err);
  }
}

verify();
