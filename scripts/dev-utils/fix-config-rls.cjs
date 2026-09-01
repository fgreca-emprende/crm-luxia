const fs = require('fs');
const path = require('path');

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

async function run() {
  const sql = `
    -- Eliminar políticas restrictivas previas
    DROP POLICY IF EXISTS "config_all_select" ON public.config_general;
    DROP POLICY IF EXISTS "config_admin_modify" ON public.config_general;
    DROP POLICY IF EXISTS "config_permisos_read" ON public.config_permisos;
    DROP POLICY IF EXISTS "config_permisos_write" ON public.config_permisos;

    -- Permitir lectura pública de configuraciones generales y matriz de permisos
    CREATE POLICY "config_general_read" ON public.config_general FOR SELECT USING (true);
    CREATE POLICY "config_general_write" ON public.config_general FOR ALL USING (auth.uid() IS NOT NULL);

    CREATE POLICY "config_permisos_read" ON public.config_permisos FOR SELECT USING (true);
    CREATE POLICY "config_permisos_write" ON public.config_permisos FOR ALL USING (auth.uid() IS NOT NULL);

    -- Tablas de catálogo
    ALTER TABLE public.config_servicios ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "config_servicios_read" ON public.config_servicios;
    CREATE POLICY "config_servicios_read" ON public.config_servicios FOR SELECT USING (true);

    ALTER TABLE public.config_campos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "config_campos_read" ON public.config_campos;
    CREATE POLICY "config_campos_read" ON public.config_campos FOR SELECT USING (true);

    ALTER TABLE public.config_ia_modelos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "config_ia_modelos_read" ON public.config_ia_modelos;
    CREATE POLICY "config_ia_modelos_read" ON public.config_ia_modelos FOR SELECT USING (true);

    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Actualizando políticas RLS para configuraciones...');
  const res = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (res.ok) {
    console.log('✅ Políticas RLS de configuraciones actualizadas con éxito.');
  } else {
    const err = await res.text();
    console.error('❌ Error actualizando RLS:', err);
  }
}

run();
