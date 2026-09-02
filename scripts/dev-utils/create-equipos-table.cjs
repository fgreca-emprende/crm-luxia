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
  const defaultEquipos = [
    { id: 'Global', nombre: 'Global / Dirección', lider: 'admin@luxia.com', descripcion: 'Equipo transversal y directivo.' },
    { id: 'Adquisicion', nombre: 'Ventas - Adquisición (Hunting)', lider: '', descripcion: 'Equipo comercial orientado a prospección y nuevos clientes.' },
    { id: 'Retencion', nombre: 'Ventas - Retención & Expansión (Farming)', lider: '', descripcion: 'Equipo comercial orientado a cross-sell, up-sell y renovaciones.' },
    { id: 'Operaciones', nombre: 'Operaciones & Asistencia Agronómica', lider: '', descripcion: 'Control operativo de entregas, depósitos y coordinación agronómica.' }
  ];

  const sql = `
    -- 1. Tabla de Equipos
    CREATE TABLE IF NOT EXISTS public.equipos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      lider TEXT,
      descripcion TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- RLS Policies para equipos
    ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "equipos_read" ON public.equipos;
    CREATE POLICY "equipos_read" ON public.equipos FOR SELECT USING (true);
    DROP POLICY IF EXISTS "equipos_write" ON public.equipos;
    CREATE POLICY "equipos_write" ON public.equipos FOR ALL USING (auth.uid() IS NOT NULL);

    -- 2. Sembrar Equipos por defecto
    ${defaultEquipos.map(eq => `
      INSERT INTO public.equipos (id, nombre, lider, descripcion)
      VALUES ('${eq.id}', '${eq.nombre}', '${eq.lider}', '${eq.descripcion}')
      ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        updated_at = NOW();
    `).join('')}

    -- 3. RLS para logs_ia_consumo y logs_whatsapp_consumo
    ALTER TABLE public.logs_ia_consumo ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "logs_ia_read" ON public.logs_ia_consumo;
    CREATE POLICY "logs_ia_read" ON public.logs_ia_consumo FOR SELECT USING (true);

    ALTER TABLE public.logs_whatsapp_consumo ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "logs_wa_read" ON public.logs_whatsapp_consumo;
    CREATE POLICY "logs_wa_read" ON public.logs_whatsapp_consumo FOR SELECT USING (true);

    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Creando tabla equipos y configurando permisos en Supabase (192.168.0.70)...');
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
    console.log('✅ Tabla equipos creada y configurada con éxito.');
  } else {
    const err = await res.text();
    console.error('❌ Error creando tabla equipos:', err);
  }
}

run();
