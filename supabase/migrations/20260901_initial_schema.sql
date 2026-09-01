-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - POSTGRESQL INITIAL SCHEMA
-- Migración completa desde Firestore NoSQL hacia PostgreSQL Relacional + JSONB
-- ==============================================================================

-- 1. EXTENSIONES DE POSTGRESQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ==============================================================================
-- 2. USUARIOS Y PERFILES (Vinculado con auth.users de Supabase)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    rol TEXT NOT NULL DEFAULT 'lector' CHECK (rol IN ('superadmin', 'admin', 'supervisor', 'agente', 'lector', 'agente_cx', 'supervisor_cx', 'editor')),
    equipo TEXT NOT NULL DEFAULT 'Global',
    pais TEXT NOT NULL DEFAULT 'PE',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    estado_cx TEXT DEFAULT 'activo',
    estado_presencia TEXT DEFAULT 'Conectado',
    presencia JSONB DEFAULT '{"estado": "disponible", "desdeIso": null}'::jsonb,
    capacitacion JSONB DEFAULT '{"estado": "pendiente"}'::jsonb,
    gamificacion JSONB DEFAULT '{"nivelGlobal": 1, "xpGlobal": 0, "rachas": {}}'::jsonb,
    slack_sync JSONB DEFAULT '{}'::jsonb,
    gmail_sync JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subcolección / Registro de uso diario de usuarios
CREATE TABLE IF NOT EXISTS public.usuario_uso_diario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    minutos_conectado INTEGER DEFAULT 0,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, fecha)
);

-- ==============================================================================
-- 3. CLIENTES (Empresas Ganadas / Cartera)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clientes (
    id TEXT PRIMARY KEY, -- Mantiene compatibilidad con 'hubspot_123' o UUIDs
    nombre_empresa TEXT NOT NULL,
    cuit_rut_rfc TEXT,
    industria TEXT,
    sitio_web TEXT,
    tamanio_empresa TEXT,
    tier_cuenta TEXT DEFAULT 'Tier 3',
    tier_override BOOLEAN DEFAULT FALSE,
    parent_company_id TEXT REFERENCES public.clientes(id) ON DELETE SET NULL,
    estado TEXT NOT NULL DEFAULT 'Ingresado',
    fase_manual TEXT,
    pais TEXT NOT NULL DEFAULT 'PE',
    comercial_email TEXT,
    comercial_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    observaciones TEXT,
    health_score JSONB DEFAULT '{"riesgo": "Green", "analisis": "Sin evaluar"}'::jsonb,
    campos_dinamicos JSONB DEFAULT '{}'::jsonb,
    fecha_ingreso TIMESTAMPTZ DEFAULT NOW(),
    ultimo_cambio_estado TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. CONTRATOS REGULADORES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    oportunidad_id UUID,
    tipo_servicio TEXT NOT NULL,
    fecha_inicio DATE,
    fecha_vencimiento DATE,
    monto NUMERIC(15, 2) DEFAULT 0,
    moneda TEXT NOT NULL DEFAULT 'USD',
    frecuencia_facturacion TEXT DEFAULT 'mensual',
    condiciones_pago TEXT DEFAULT 'net_30',
    volumen_minimo_garantizado NUMERIC DEFAULT 0,
    periodo_preaviso_dias INTEGER DEFAULT 30,
    penalizacion_sla BOOLEAN DEFAULT FALSE,
    es_contrato_vigente BOOLEAN DEFAULT TRUE,
    version_contrato INTEGER DEFAULT 1,
    tipo_documento_legal TEXT DEFAULT 'inicial',
    estado_contrato TEXT DEFAULT 'vigente',
    estado_sla TEXT DEFAULT 'Vigente',
    adjuntos JSONB DEFAULT '[]'::jsonb,
    drive_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. LEADS / PROSPECTOS COMERCIALES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_empresa TEXT NOT NULL,
    nombre_contacto TEXT,
    correo TEXT,
    telefono TEXT,
    pais TEXT NOT NULL DEFAULT 'PE',
    cuit_rut_rfc TEXT,
    industria TEXT,
    sitio_web TEXT,
    volumen_mensual_proyectado NUMERIC,
    stack_tecnologico_actual TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    origen TEXT DEFAULT 'web',
    estado TEXT NOT NULL DEFAULT 'nuevo',
    sub_estado_contacto TEXT,
    motivo_descalificacion TEXT,
    score_calculado NUMERIC,
    calificacion_ia JSONB DEFAULT '{}'::jsonb,
    _trigger_ia BOOLEAN DEFAULT FALSE,
    _triggered_by TEXT,
    asignado_a TEXT,
    asignado_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    notas TEXT,
    campos_dinamicos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. OPORTUNIDADES (Pipeline de Ventas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.oportunidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    etapa TEXT NOT NULL DEFAULT 'diagnostico',
    monto_estimado_mensual NUMERIC(15, 2) DEFAULT 0,
    valor_contrato_anual NUMERIC(15, 2) DEFAULT 0,
    descuento_ofrecido_pct NUMERIC DEFAULT 0,
    contacto_principal_id UUID,
    probabilidad NUMERIC DEFAULT 10,
    fecha_estimada_cierre DATE,
    fecha_ultimo_cambio_etapa TIMESTAMPTZ,
    dias_en_etapa_actual INTEGER DEFAULT 0,
    competidor_ganador TEXT,
    perdida_razon TEXT,
    perdida_detalle TEXT,
    comercial_email TEXT NOT NULL,
    comercial_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    pais TEXT NOT NULL DEFAULT 'PE',
    tipo_pipeline TEXT NOT NULL DEFAULT 'adquisicion',
    tipo_servicio TEXT DEFAULT 'default',
    campos_dinamicos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. CONTACTOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contactos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    oportunidad_id UUID REFERENCES public.oportunidades(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    puesto TEXT,
    linkedin TEXT,
    rol_decision TEXT,
    departamento TEXT,
    whatsapp_opt_in JSONB DEFAULT '{"status": false}'::jsonb,
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ,
    window_active_until TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. TICKETS CX Y MENSAJES (Soporte Omnicanal)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descripcion TEXT,
    ultimo_mensaje_preview TEXT,
    tipo_frente TEXT DEFAULT 'corporate',
    origen TEXT DEFAULT 'manual',
    prioridad TEXT DEFAULT 'media',
    estado TEXT DEFAULT 'open',
    equipo_asignado TEXT DEFAULT 'soporte_l1',
    agente_asignado TEXT,
    agente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tipificacion_id TEXT,
    raiz_causa_subcat_id TEXT,
    ticket_padre_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    envios_afectados_count INTEGER DEFAULT 1,
    csat_score NUMERIC,
    csat_feedback TEXT,
    fcr BOOLEAN DEFAULT FALSE,
    motivo_resolucion TEXT,
    nota_resolucion TEXT,
    cliente_id TEXT REFERENCES public.clientes(id) ON DELETE SET NULL,
    cliente_nombre TEXT,
    contacto_nombre TEXT,
    contacto_email TEXT,
    contacto_telefono TEXT,
    pais TEXT DEFAULT 'PE',
    es_creacion_manual BOOLEAN DEFAULT FALSE,
    unread_count INTEGER DEFAULT 0,
    sla JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ticket_mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    remitente TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo TEXT DEFAULT 'incoming',
    is_whisper BOOLEAN DEFAULT FALSE,
    adjuntos JSONB DEFAULT '[]'::jsonb,
    enviado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. INTERACCIONES (Timeline Polimórfico de Eventos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.interacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    oportunidad_id UUID REFERENCES public.oportunidades(id) ON DELETE CASCADE,
    autor TEXT NOT NULL,
    autor_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    descripcion TEXT NOT NULL,
    tipo TEXT NOT NULL,
    detalles JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. ALERTAS
-- ==============================================================================
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

-- ==============================================================================
-- 11. ONBOARDING CHECKLISTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.onboarding_checklists (
    cliente_id TEXT PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
    comercial_email TEXT,
    porcentaje_completado NUMERIC DEFAULT 0,
    pasos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 12. CONFIGURACIONES GENERALES Y CAMPOS DINÁMICOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.config_secciones (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    icono TEXT,
    orden INTEGER DEFAULT 0,
    entidad TEXT DEFAULT 'cliente'
);

CREATE TABLE IF NOT EXISTS public.config_campos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    opciones JSONB DEFAULT '[]'::jsonb,
    origen_datos TEXT DEFAULT 'manual',
    orden INTEGER DEFAULT 0,
    seccion_id TEXT REFERENCES public.config_secciones(id) ON DELETE SET NULL,
    obligatorio BOOLEAN DEFAULT FALSE,
    entidad TEXT DEFAULT 'cliente'
);

CREATE TABLE IF NOT EXISTS public.config_servicios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS public.config_general (
    id TEXT PRIMARY KEY,
    datos JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.config_permisos (
    id TEXT PRIMARY KEY DEFAULT 'rol_matrix',
    views JSONB NOT NULL DEFAULT '{}'::jsonb,
    actions JSONB NOT NULL DEFAULT '{}'::jsonb,
    scopes JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 13. CONFIGURACIÓN DE SENTINEL IA Y MODELOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.config_ia_modelos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    proveedor TEXT DEFAULT 'Google Gemini',
    estado TEXT DEFAULT 'activo',
    es_default BOOLEAN DEFAULT FALSE,
    descripcion TEXT,
    official_input_rate_per_1m NUMERIC DEFAULT 0,
    official_output_rate_per_1m NUMERIC DEFAULT 0,
    agreed_input_rate_per_1m NUMERIC,
    agreed_output_rate_per_1m NUMERIC,
    tiene_acuerdo BOOLEAN DEFAULT FALSE,
    max_output_tokens INTEGER DEFAULT 2048,
    context_window INTEGER DEFAULT 32000,
    last_price_sync TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.config_ia (
    id TEXT PRIMARY KEY, -- 'sentinel', 'sentinel_lead_scorer', 'sentinel_support', etc.
    nombre TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    temperature NUMERIC DEFAULT 0.2,
    max_output_tokens INTEGER DEFAULT 1000,
    disabled BOOLEAN DEFAULT FALSE,
    icp_config JSONB,
    buffer_window_minutes INTEGER DEFAULT 5,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.config_ia_versiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agente_id TEXT NOT NULL REFERENCES public.config_ia(id) ON DELETE CASCADE,
    system_prompt TEXT NOT NULL,
    model_name TEXT NOT NULL,
    temperature NUMERIC,
    max_output_tokens INTEGER,
    disabled BOOLEAN,
    updated_by TEXT,
    restored_from TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Base de conocimiento vectorial para RAG
CREATE TABLE IF NOT EXISTS public.rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    categoria TEXT,
    contenido TEXT NOT NULL,
    embedding VECTOR(768),
    metadata JSONB DEFAULT '{}'::jsonb,
    hash_sha256 TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 14. AUTO-CAPACITACIÓN Y EVALUACIONES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.config_capacitacion_examenes (
    id TEXT PRIMARY KEY, -- ej. 'comercial_facil'
    rol TEXT NOT NULL,
    dificultad TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    teorico JSONB NOT NULL DEFAULT '[]'::jsonb,
    practico JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.examenes_intentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_email TEXT NOT NULL,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
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
    evaluado_por TEXT DEFAULT 'sentinel_ia',
    estado TEXT DEFAULT 'pendiente',
    processed BOOLEAN DEFAULT FALSE
);

-- ==============================================================================
-- 15. METRICS STUDIO (KPIs Dinámicos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.kpi_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    chart_type TEXT DEFAULT 'bar',
    collection_name TEXT NOT NULL,
    query_logic JSONB NOT NULL DEFAULT '{}'::jsonb,
    update_frequency_hours INTEGER DEFAULT 1,
    dashboard_tab TEXT DEFAULT 'cartera',
    created_by TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kpi_results (
    kpi_id UUID PRIMARY KEY REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '[]'::jsonb,
    x_axis_key TEXT DEFAULT 'label',
    y_axis_keys JSONB DEFAULT '["value"]'::jsonb
);

-- ==============================================================================
-- 16. TELEMETRÍA, LOGS Y AUDITORÍA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.logs_ia_consumo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_email TEXT,
    cliente_id TEXT,
    lead_id UUID,
    oportunidad_id UUID,
    model_name TEXT,
    type TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd NUMERIC(10, 6) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.logs_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_email TEXT,
    accion TEXT NOT NULL,
    entidad TEXT,
    entidad_id TEXT,
    detalles JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.logs_auditoria_exportacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario TEXT NOT NULL,
    rol TEXT NOT NULL,
    entidad TEXT NOT NULL,
    filas_exportadas INTEGER DEFAULT 0,
    ip TEXT,
    alerta_exfiltracion BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.incoming_api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    integration TEXT,
    system_id TEXT,
    method TEXT,
    path TEXT,
    status_code INTEGER,
    status TEXT,
    headers JSONB,
    query JSONB,
    payload JSONB,
    response JSONB,
    expire_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.logs_whatsapp_consumo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    usuario_email TEXT,
    cliente_id TEXT,
    tipo_conversacion TEXT,
    costo_usd NUMERIC(10, 4) DEFAULT 0,
    pais TEXT,
    destino TEXT
);

CREATE TABLE IF NOT EXISTS public.logs_whatsapp_errores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    error TEXT,
    destino TEXT
);

-- ==============================================================================
-- 17. INTEGRACIONES Y BUFFERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.integrations (
    id TEXT PRIMARY KEY, -- 'slack_config', 'hubspot_config', 'gmail_config', etc.
    datos JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    events JSONB DEFAULT '[]'::jsonb,
    secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash TEXT UNIQUE NOT NULL,
    key_hint TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    system_id TEXT,
    permissions JSONB DEFAULT '["read"]'::jsonb,
    debug_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_buffer (
    cliente_id TEXT PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
    comercial_email TEXT,
    contact_nombre TEXT,
    messages JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'pending',
    process_after TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 18. ÍNDICES DE RENDIMIENTO (B-Tree, GIN y Trigram)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_clientes_nombre_trgm ON public.clientes USING GIN (nombre_empresa gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_campos_dinamicos ON public.clientes USING GIN (campos_dinamicos);
CREATE INDEX IF NOT EXISTS idx_clientes_health_score ON public.clientes USING GIN (health_score);
CREATE INDEX IF NOT EXISTS idx_clientes_comercial_email ON public.clientes (comercial_email);
CREATE INDEX IF NOT EXISTS idx_clientes_pais ON public.clientes (pais);

CREATE INDEX IF NOT EXISTS idx_leads_nombre_trgm ON public.leads USING GIN (nombre_empresa gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_correo ON public.leads (correo);
CREATE INDEX IF NOT EXISTS idx_leads_asignado_a ON public.leads (asignado_a);
CREATE INDEX IF NOT EXISTS idx_leads_pais ON public.leads (pais);
CREATE INDEX IF NOT EXISTS idx_leads_campos_dinamicos ON public.leads USING GIN (campos_dinamicos);

CREATE INDEX IF NOT EXISTS idx_oportunidades_nombre ON public.oportunidades (nombre);
CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente_id ON public.oportunidades (cliente_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_comercial_email ON public.oportunidades (comercial_email);
CREATE INDEX IF NOT EXISTS idx_oportunidades_etapa ON public.oportunidades (etapa);

CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id ON public.contratos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_fecha_vencimiento ON public.contratos (fecha_vencimiento);

CREATE INDEX IF NOT EXISTS idx_tickets_estado ON public.tickets (estado);
CREATE INDEX IF NOT EXISTS idx_tickets_agente_asignado ON public.tickets (agente_asignado);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente_id ON public.tickets (cliente_id);
CREATE INDEX IF NOT EXISTS idx_ticket_mensajes_ticket_id ON public.ticket_mensajes (ticket_id);

CREATE INDEX IF NOT EXISTS idx_interacciones_cliente_id ON public.interacciones (cliente_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_lead_id ON public.interacciones (lead_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_oportunidad_id ON public.interacciones (oportunidad_id);

CREATE INDEX IF NOT EXISTS idx_alertas_comercial_email ON public.alertas (comercial_email);
CREATE INDEX IF NOT EXISTS idx_alertas_leida ON public.alertas (leida);
