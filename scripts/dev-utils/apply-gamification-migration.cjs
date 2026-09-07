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

const url = process.env.SUPABASE_URL || 'http://localhost:8000';
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
  console.log(`🚀 APLICANDO MIGRACIÓN 20260910_remove_gamification.sql EN: ${url}`);
  console.log('=======================================================');

  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260910_remove_gamification.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  
  const ok = await executeSql(migrationSql, 'Remoción de gamificación (20260910_remove_gamification.sql)');
  if (!ok) {
    console.error('La migración falló.');
    process.exit(1);
  }

  // Notificar a PostgREST para recargar esquema
  await executeSql("NOTIFY pgrst, 'reload schema';", 'Recarga de caché de PostgREST');

  console.log('\n=======================================================');
  console.log('🎉 MIGRACIÓN COMPLETADA Y ESQUEMA ACTUALIZADO');
  console.log('=======================================================');
}

run().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
