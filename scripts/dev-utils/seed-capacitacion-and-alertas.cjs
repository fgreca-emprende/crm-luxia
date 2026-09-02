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
  const defaultExamsPath = path.resolve(__dirname, '../../functions/defaultExams.json');
  const examsData = JSON.parse(fs.readFileSync(defaultExamsPath, 'utf-8'));

  console.log(`Cargando ${Object.keys(examsData).length} exámenes desde defaultExams.json...`);

  // Crear sentencias SQL
  let insertExamsSql = '';
  for (const [examId, exam] of Object.entries(examsData)) {
    const rol = exam.rol || 'usuario';
    const dificultad = exam.dificultad || 'basico';
    const titulo = `Examen ${rol.toUpperCase()} - Nivel ${dificultad.toUpperCase()}`;
    const teoricoJson = JSON.stringify(exam.teorico || []).replace(/'/g, "''");
    const practicoJson = JSON.stringify(exam.practico || {}).replace(/'/g, "''");

    insertExamsSql += `
      INSERT INTO public.config_capacitacion_examenes (id, rol, dificultad, titulo, descripcion, teorico, practico)
      VALUES ('${examId}', '${rol}', '${dificultad}', '${titulo}', 'Evaluación oficial de competencias', '${teoricoJson}'::jsonb, '${practicoJson}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        rol = EXCLUDED.rol,
        dificultad = EXCLUDED.dificultad,
        titulo = EXCLUDED.titulo,
        teorico = EXCLUDED.teorico,
        practico = EXCLUDED.practico,
        updated_at = NOW();
    `;
  }

  const sampleAlertas = [
    {
      id: 'alerta-1',
      cliente_id: 'CLI-001',
      nombre_empresa: 'Logística Austral S.A.',
      tipo: 'contrato_por_vencer',
      urgency: 'alta',
      mensaje: 'Contrato marco de distribución expira en 15 días.',
      accion_recomendada: 'Contactar al director de operaciones para iniciar renovación anual con ajuste tarifario.',
      leida: false,
      comercial_email: 'admin@luxia.com'
    },
    {
      id: 'alerta-2',
      cliente_id: 'CLI-002',
      nombre_empresa: 'Distribuidora del Plata',
      tipo: 'churn_detectado',
      urgency: 'alta',
      mensaje: 'Disminución del 45% en volumen de despachos respecto al trimestre anterior.',
      accion_recomendada: 'Coordinar reunión ejecutiva de revisión de servicio con el KAM.',
      leida: false,
      comercial_email: 'admin@luxia.com'
    },
    {
      id: 'alerta-3',
      cliente_id: 'CLI-003',
      nombre_empresa: 'Transportes Cordillera SRL',
      tipo: 'lead_estancado',
      urgency: 'media',
      mensaje: 'Oportunidad sin interacción comercial en los últimos 14 días.',
      accion_recomendada: 'Enviar propuesta de valor y seguimiento de propuesta técnica.',
      leida: false,
      comercial_email: 'admin@luxia.com'
    }
  ];

  let insertAlertasSql = sampleAlertas.map(a => `
    INSERT INTO public.alertas (id, cliente_id, nombre_empresa, tipo, urgency, mensaje, accion_recomendada, leida, comercial_email)
    VALUES ('${a.id}', '${a.cliente_id}', '${a.nombre_empresa}', '${a.tipo}', '${a.urgency}', '${a.mensaje}', '${a.accion_recomendada}', ${a.leida}, '${a.comercial_email}')
    ON CONFLICT (id) DO UPDATE SET
      nombre_empresa = EXCLUDED.nombre_empresa,
      mensaje = EXCLUDED.mensaje,
      urgency = EXCLUDED.urgency;
  `).join('');

  const sql = `
    -- 1. Tabla config_capacitacion_examenes
    CREATE TABLE IF NOT EXISTS public.config_capacitacion_examenes (
      id TEXT PRIMARY KEY,
      rol TEXT NOT NULL,
      dificultad TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      teorico JSONB NOT NULL DEFAULT '[]'::jsonb,
      practico JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.config_capacitacion_examenes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "examenes_read" ON public.config_capacitacion_examenes;
    CREATE POLICY "examenes_read" ON public.config_capacitacion_examenes FOR SELECT USING (true);
    DROP POLICY IF EXISTS "examenes_write" ON public.config_capacitacion_examenes;
    CREATE POLICY "examenes_write" ON public.config_capacitacion_examenes FOR ALL USING (true);

    -- 2. Tabla examenes_intentos
    CREATE TABLE IF NOT EXISTS public.examenes_intentos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_email TEXT NOT NULL,
      usuario_id UUID,
      usuario_nombre TEXT,
      rol TEXT NOT NULL,
      dificultad TEXT NOT NULL,
      fecha_intento TIMESTAMPTZ DEFAULT NOW(),
      respuestas_teorico JSONB DEFAULT '[]'::jsonb,
      score_teorico NUMERIC DEFAULT 0,
      respuesta_practico TEXT,
      score_practico NUMERIC,
      feedback_practico TEXT,
      score_global NUMERIC,
      aprobado BOOLEAN DEFAULT FALSE,
      evaluado_por TEXT DEFAULT 'luxia_ia',
      estado TEXT DEFAULT 'aprobado',
      processed BOOLEAN DEFAULT TRUE
    );

    ALTER TABLE public.examenes_intentos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "intentos_read" ON public.examenes_intentos;
    CREATE POLICY "intentos_read" ON public.examenes_intentos FOR SELECT USING (true);
    DROP POLICY IF EXISTS "intentos_write" ON public.examenes_intentos;
    CREATE POLICY "intentos_write" ON public.examenes_intentos FOR ALL USING (true);

    -- 3. Tabla alertas
    CREATE TABLE IF NOT EXISTS public.alertas (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      cliente_id TEXT,
      nombre_empresa TEXT,
      tipo TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'media',
      mensaje TEXT NOT NULL,
      accion_recomendada TEXT,
      leida BOOLEAN DEFAULT FALSE,
      comercial_email TEXT,
      creada_en TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "alertas_read" ON public.alertas;
    CREATE POLICY "alertas_read" ON public.alertas FOR SELECT USING (true);
    DROP POLICY IF EXISTS "alertas_write" ON public.alertas;
    CREATE POLICY "alertas_write" ON public.alertas FOR ALL USING (true);

    -- 4. Sembrar configuración general de capacitación
    INSERT INTO public.config_general (id, datos, updated_at)
    VALUES (
      'capacitacion',
      '{"habilitado": true, "frecuenciaDias": 90, "porcentajeAprobacion": 75, "pesoTeorico": 50, "pesoPractico": 50, "aiGradingEnabled": true}'::jsonb,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      datos = EXCLUDED.datos,
      updated_at = NOW();

    -- 5. Sembrar Exámenes
    ${insertExamsSql}

    -- 6. Sembrar Alertas
    ${insertAlertasSql}

    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Aplicando migraciones y siembras en PostgreSQL (192.168.0.70)...');
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
    console.log('✅ Tablas config_capacitacion_examenes, examenes_intentos y alertas creadas y sembradas exitosamente.');
  } else {
    const err = await res.text();
    console.error('❌ Error ejecutando migración:', err);
  }
}

run();
