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
  const defaultQueues = [
    { id: 'soporte_l1', nombre: 'Soporte Nivel 1 (General)', activa: true, descripcion: 'Atención general de consultas e incidencias básicas.' },
    { id: 'operaciones', nombre: 'Operaciones & Despachos', activa: true, descripcion: 'Seguimiento de rutas, cross-docking y entregas en curso.' },
    { id: 'facturacion', nombre: 'Facturación & Cobranzas', activa: true, descripcion: 'Consultas sobre liquidaciones, facturas y pagos.' },
    { id: 'cuentas_clave', nombre: 'Cuentas Corporativas (Key Accounts)', activa: true, descripcion: 'Atención prioritaria a grandes cuentas.' }
  ];

  const defaultTipificaciones = [
    { id: 'demora_entrega', nombre: 'Demora en Entrega / Tránsito', categoria: 'Operaciones', sla_horas: 4, activa: true },
    { id: 'reclamo_mercaderia', nombre: 'Mercadería Dañada / Faltante', categoria: 'Calidad', sla_horas: 12, activa: true },
    { id: 'consulta_facturacion', nombre: 'Consulta de Facturación / Tarifa', categoria: 'Finanzas', sla_horas: 24, activa: true },
    { id: 'cambio_direccion', nombre: 'Cambio de Domicilio de Entrega', categoria: 'Operaciones', sla_horas: 2, activa: true },
    { id: 'soporte_plataforma', nombre: 'Soporte Plataforma TMS / Web', categoria: 'Tecnología', sla_horas: 8, activa: true }
  ];

  const defaultMotivosResolucion = [
    'Entrega completada exitosamente',
    'Mercadería reexpedida',
    'Aclaración de tarifa brindada',
    'Nota de crédito emitida',
    'Dirección corregida y entregada',
    'Incidencia técnica resuelta',
    'Desestimado por cliente'
  ];

  const sql = `
    -- 1. Tablas de CX
    CREATE TABLE IF NOT EXISTS public.config_tipificaciones (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria TEXT DEFAULT 'General',
      sla_horas INTEGER DEFAULT 24,
      activa BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.config_respuestas_rapidas (
      id TEXT PRIMARY KEY,
      atajo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      activa BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- RLS Policies
    ALTER TABLE public.config_tipificaciones ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tipificaciones_read" ON public.config_tipificaciones;
    CREATE POLICY "tipificaciones_read" ON public.config_tipificaciones FOR SELECT USING (true);
    DROP POLICY IF EXISTS "tipificaciones_write" ON public.config_tipificaciones;
    CREATE POLICY "tipificaciones_write" ON public.config_tipificaciones FOR ALL USING (auth.uid() IS NOT NULL);

    ALTER TABLE public.config_respuestas_rapidas ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "macros_read" ON public.config_respuestas_rapidas;
    CREATE POLICY "macros_read" ON public.config_respuestas_rapidas FOR SELECT USING (true);
    DROP POLICY IF EXISTS "macros_write" ON public.config_respuestas_rapidas;
    CREATE POLICY "macros_write" ON public.config_respuestas_rapidas FOR ALL USING (auth.uid() IS NOT NULL);

    -- 2. Sembrar Tipificaciones
    ${defaultTipificaciones.map(t => `
      INSERT INTO public.config_tipificaciones (id, nombre, categoria, sla_horas, activa)
      VALUES ('${t.id}', '${t.nombre}', '${t.categoria}', ${t.sla_horas}, ${t.activa})
      ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        categoria = EXCLUDED.categoria,
        sla_horas = EXCLUDED.sla_horas;
    `).join('')}

    -- 3. Sembrar Configuración de Ruteo y Motivos en config_general
    INSERT INTO public.config_general (id, datos, updated_at)
    VALUES
      ('cx_routing', '{"colas": ${JSON.stringify(defaultQueues)}}'::jsonb, NOW()),
      ('cx_motivos_resolucion', '{"lista": ${JSON.stringify(defaultMotivosResolucion)}}'::jsonb, NOW()),
      ('cx_sla', '{"tiempoRespuestaMinutos": 15, "tiempoResolucionHoras": 24}'::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      datos = EXCLUDED.datos,
      updated_at = NOW();

    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Creando y sembrando tablas y configuraciones de CX en Supabase (192.168.0.70)...');
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
    console.log('✅ Tablas y datos de CX configurados exitosamente.');
  } else {
    const err = await res.text();
    console.error('❌ Error configurando CX:', err);
  }
}

run();
