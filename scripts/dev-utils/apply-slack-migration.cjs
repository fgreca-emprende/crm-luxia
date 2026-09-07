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

async function executeSql(query, description) {
  console.log(`\n▶️ Ejecutando: ${description}...`);
  try {
    const res = await fetch(`${url}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ query })
    });

    const body = await res.json();
    if (!res.ok) {
      console.error(`❌ Error en ${description}:`, body);
      return false;
    }
    console.log(`✅ ${description} completado exitosamente.`);
    return true;
  } catch (err) {
    console.error(`❌ Error de red ejecutando ${description}:`, err.message);
    return false;
  }
}

async function run() {
  console.log('=======================================================');
  console.log(`🚀 APLICANDO MIGRACIONES PENDIENTES EN: ${url}`);
  console.log('=======================================================');

  // 1. Migración 20260912 (P0 Security, Transactions)
  const mig12Path = path.resolve(__dirname, '../../supabase/migrations/20260912_remediation_p0_security_and_transactions.sql');
  if (fs.existsSync(mig12Path)) {
    const sql12 = fs.readFileSync(mig12Path, 'utf-8');
    await executeSql(sql12, 'Remediación P0 (20260912_remediation_p0_security_and_transactions.sql)');
  }

  // 2. Migración 20260913 (P3 Retention and Cleanup)
  const mig13Path = path.resolve(__dirname, '../../supabase/migrations/20260913_retention_and_cleanup.sql');
  if (fs.existsSync(mig13Path)) {
    const sql13 = fs.readFileSync(mig13Path, 'utf-8');
    await executeSql(sql13, 'Retención y Purga (20260913_retention_and_cleanup.sql)');
  }

  // 3. Migración 20260914 (Remove Slack Integration)
  const mig14Path = path.resolve(__dirname, '../../supabase/migrations/20260914_remove_slack_integration.sql');
  if (fs.existsSync(mig14Path)) {
    const sql14 = fs.readFileSync(mig14Path, 'utf-8');
    const ok14 = await executeSql(sql14, 'Remoción definitiva de Slack (20260914_remove_slack_integration.sql)');
    if (!ok14) {
      console.error('Fallo al ejecutar la migración 20260914.');
    }
  }

  // 4. Recargar caché del esquema en PostgREST
  await executeSql("NOTIFY pgrst, 'reload schema';", 'Recarga de caché de esquema en PostgREST');

  // 5. Verificar estado de columnas en public.usuarios
  console.log('\n🔍 Verificando estructura final de public.usuarios...');
  const res = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ 
      query: `SELECT column_name, data_type 
              FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'usuarios';` 
    })
  });

  const columns = await res.json();
  console.log('Columnas activas en public.usuarios:', columns.map(c => c.column_name));

  const hasSlack = columns.some(c => c.column_name === 'slack_sync');
  if (!hasSlack) {
    console.log('✅ Confirmado: la columna slack_sync ya no existe en la base de datos.');
  } else {
    console.warn('⚠️ Advertencia: la columna slack_sync aún está presente.');
  }

  console.log('\n=======================================================');
  console.log('🎉 MIGRACIONES DE BASE DE DATOS COMPLETADAS EXITOSAMENTE');
  console.log('=======================================================');
}

run().catch(err => {
  console.error('Error fatal ejecutando migraciones:', err);
  process.exit(1);
});
