const fs = require('fs');
const path = require('path');

// 1. Cargar variables de entorno
const envFile = path.resolve(__dirname, '../../.env.local');
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
  console.log(`🚀 APLICANDO MIGRACIONES DDL EN SUPABASE (192.168.0.70)`);
  console.log('=======================================================');

  // 1. Initial Schema (Tablas, Extensiones, Índices)
  const schemaPath = path.resolve(__dirname, '../../supabase/migrations/20260901_initial_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  const ok1 = await executeSql(schemaSql, 'Esquema DDL Inicial (20260901_initial_schema.sql)');
  if (!ok1) process.exit(1);

  // 2. RLS & Triggers
  const rlsPath = path.resolve(__dirname, '../../supabase/migrations/20260902_rls_and_triggers.sql');
  const rlsSql = fs.readFileSync(rlsPath, 'utf-8');
  const ok2 = await executeSql(rlsSql, 'Políticas RLS y Triggers (20260902_rls_and_triggers.sql)');
  if (!ok2) process.exit(1);

  // 3. Seed Data
  const seedPath = path.resolve(__dirname, '../../supabase/seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf-8');
  const ok3 = await executeSql(seedSql, 'Datos Iniciales de Configuración (seed.sql)');
  if (!ok3) process.exit(1);

  // 4. Notificar a PostgREST para recargar la caché del esquema
  await executeSql("NOTIFY pgrst, 'reload schema';", 'Recarga de caché de PostgREST');

  console.log('\n=======================================================');
  console.log('🎉 BASE DE DATOS POSTGRESQL LISTA Y CONFIGURADA AL 100%');
  console.log('=======================================================');
}

run().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
