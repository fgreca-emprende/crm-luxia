const fs = require('fs');
const path = require('path');

// 1. Cargar variables de entorno
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
  console.log(`🚀 APLICANDO MIGRACIONES DE REMEDIACIÓN P0-P4 EN: ${url}`);
  console.log('=======================================================');

  // 1. Migración P0: Seguridad, Transacciones ACID y RLS
  const p0MigrationPath = path.resolve(__dirname, '../../supabase/migrations/20260912_remediation_p0_security_and_transactions.sql');
  const p0Sql = fs.readFileSync(p0MigrationPath, 'utf-8');
  const okP0 = await executeSql(p0Sql, 'Migración P0 (20260912_remediation_p0_security_and_transactions.sql)');
  if (!okP0) {
    console.error('❌ Error aplicando migración P0.');
    process.exit(1);
  }

  // 2. Migración P3: Procedimiento de Retención y Purga de Logs
  const p3MigrationPath = path.resolve(__dirname, '../../supabase/migrations/20260913_retention_and_cleanup.sql');
  const p3Sql = fs.readFileSync(p3MigrationPath, 'utf-8');
  const okP3 = await executeSql(p3Sql, 'Migración P3 (20260913_retention_and_cleanup.sql)');
  if (!okP3) {
    console.error('❌ Error aplicando migración P3.');
    process.exit(1);
  }

  console.log('\n=======================================================');
  console.log('🎉 TODAS LAS MIGRACIONES FUERON APLICADAS CON ÉXITO');
  console.log('=======================================================');
}

run();
