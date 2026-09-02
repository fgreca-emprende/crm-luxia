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
  const defaultActions = {
    disparar_ia: ['agente', 'supervisor', 'admin', 'superadmin'],
    eliminar_contrato: ['superadmin'],
    configurar_logout: ['superadmin'],
    configurar_luxia: ['superadmin'],
    configurar_modelos_ia: ['superadmin'],
    configurar_presupuesto_whatsapp: ['superadmin'],
    rendir_examen: ['lector', 'agente', 'supervisor', 'admin', 'superadmin'],
    forzar_sincronizacion_infra: ['superadmin'],
    calificar_lead: ['agente', 'supervisor', 'admin', 'superadmin'],
    asignar_lead_manual: ['supervisor', 'admin', 'superadmin'],
    agendar_meet: ['agente', 'supervisor', 'admin', 'superadmin'],
    crear_formulario_web: ['admin', 'superadmin'],
    referencia_tecnica: ['superadmin', 'admin'],
    configuracion_pipeline: ['superadmin', 'admin'],
    configuracion_onboarding: ['superadmin', 'admin'],
    configuracion_servicios: ['superadmin', 'admin'],
    configuracion_negocio: ['superadmin', 'admin', 'lector'],
    configuracion_usuarios: ['superadmin', 'admin'],
    configuracion_equipos: ['superadmin', 'admin'],
    configuracion_capacitacion: ['superadmin', 'admin'],
    configuracion_metrics_studio: ['superadmin', 'admin'],
    configuracion_integraciones: ['superadmin', 'admin']
  };

  const defaultScopes = {
    leads: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'ALL' },
    oportunidades: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'ALL' },
    clientes: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'ALL' },
    tablero: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'OWN' },
    alertas: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'ALL' },
    capacitacion: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'OWN' },
    consumo_ia: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'NONE' }
  };

  const sql = `
    -- 1. Insertar rol_matrix en config_permisos
    INSERT INTO public.config_permisos (id, views, actions, scopes, updated_at)
    VALUES (
      'rol_matrix',
      '{}'::jsonb,
      '${JSON.stringify(defaultActions)}'::jsonb,
      '${JSON.stringify(defaultScopes)}'::jsonb,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      actions = EXCLUDED.actions,
      scopes = EXCLUDED.scopes,
      updated_at = NOW();

    -- 2. Insertar configuraciones generales en config_general
    INSERT INTO public.config_general (id, datos, updated_at)
    VALUES
      ('business', '{"diasActivacionObjetivo": 14, "tasaRetencionObjetivo": 95, "alertasVencimientoDias": 30, "monedaBase": "ARS"}'::jsonb, NOW()),
      ('rates', '{"rates": {"USD": 1.0, "ARS": 1250.0, "CLP": 950.0, "COP": 4100.0, "PEN": 3.75, "MXN": 19.5}, "moneda_defecto": "ARS"}'::jsonb, NOW()),
      ('security_config', '{"habilitado": true, "timeoutMinutos": 30, "bloqueoIpSospechosa": true}'::jsonb, NOW()),
      ('meet_config', '{"maxRecordingDurationMinutes": 60, "recordAudioOnly": true, "autoTranscribe": true}'::jsonb, NOW()),
      ('uptime_config', '{"intervalSeconds": 60, "alertWebhook": "", "services": ["database", "backend_worker", "auth", "storage"]}'::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      datos = EXCLUDED.datos,
      updated_at = NOW();

    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Sembrando configuraciones en config_permisos y config_general...');
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
    console.log('✅ Configuraciones sembradas exitosamente en 192.168.0.70.');
  } else {
    const err = await res.text();
    console.error('❌ Error sembrando configuraciones:', err);
  }
}

run();
