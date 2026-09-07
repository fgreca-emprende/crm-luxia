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
  console.log(`🚀 APLICANDO MIGRACIÓN 20260911_remove_cx_team.sql EN: ${url}`);
  console.log('=======================================================');

  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260911_remove_cx_team.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  
  const ok = await executeSql(migrationSql, 'Remoción del equipo CX (20260911_remove_cx_team.sql)');
  if (!ok) {
    console.error('La migración falló.');
    process.exit(1);
  }

  await executeSql("NOTIFY pgrst, 'reload schema';", 'Recarga de caché de PostgREST');

  // Verificar equipos resultantes
  const res = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ query: 'SELECT id, nombre FROM public.equipos;' })
  });
  console.log('\nEquipos actuales en BD:', await res.json());

  console.log('\n=======================================================');
  console.log('🎉 MIGRACIÓN COMPLETADA Y EQUIPO CX ELIMINADO DE BD');
  console.log('=======================================================');
}

run().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
