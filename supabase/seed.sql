-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - SEED DATA INICIAL
-- Modelos de IA, Agentes Sentinel, Catálogo de Servicios y Configuraciones
-- ==============================================================================

-- 1. MODELOS DE IA FUNDACIONALES
INSERT INTO public.config_ia_modelos (id, nombre, proveedor, estado, es_default, descripcion, official_input_rate_per_1m, official_output_rate_per_1m, max_output_tokens, context_window)
VALUES
  ('gemini-3.5-flash-lite', 'Gemini 3.5 Flash Lite', 'Google Gemini', 'activo', true, 'Ultrarrápido, ligero y de respuesta instantánea optimizado para tareas de alta frecuencia y soporte técnico.', 0.075, 0.30, 8192, 1048576),
  ('gemini-3.5-flash', 'Gemini 3.5 Flash', 'Google Gemini', 'activo', false, 'Modelo principal multitarea de velocidad y equilibrio ideal para agentes de producción.', 0.10, 0.40, 8192, 1048576),
  ('gemini-3.6-flash', 'Gemini 3.6 Flash', 'Google Gemini', 'activo', false, 'Modelo de última generación con razonamiento avanzado, alta velocidad y capacidad multimodal profunda.', 0.15, 0.60, 8192, 2097152)
ON CONFLICT (id) DO NOTHING;

-- 2. SERVICIOS LOGÍSTICOS ESTÁNDAR
INSERT INTO public.config_servicios (id, nombre, descripcion)
VALUES
  ('saas_core', 'SaaS Core TMS / WMS', 'Plataforma central de trazabilidad y gestión logística'),
  ('distribucion_regional', 'Distribución Regional & Cross-Dock', 'Transporte y consolidación de carga en centros de distribución'),
  ('ultima_milla_express', 'Última Milla Express (Same Day)', 'Despacho urgente puerta a puerta en áreas metropolitanas'),
  ('fulfillment_3pl', 'Fulfillment & Almacenamiento 3PL', 'Recepción, guardado, picking, packing y despacho de inventario')
ON CONFLICT (id) DO NOTHING;

-- 3. SECCIONES Y CAMPOS DINÁMICOS POR DEFECTO
INSERT INTO public.config_secciones (id, nombre, icono, orden, entidad)
VALUES
  ('info_general', 'Información General y Operativa', 'bi-building', 1, 'cliente'),
  ('datos_fiscales', 'Datos Fiscales y Legales', 'bi-file-earmark-text', 2, 'cliente'),
  ('tecnologia', 'Stack Tecnológico e Integraciones', 'bi-cpu', 3, 'cliente')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.config_campos (id, key, nombre, tipo, opciones, origen_datos, orden, seccion_id, obligatorio, entidad)
VALUES
  ('campo_erp', 'software_erp', 'Sistema ERP / WMS Principal', 'select', '["SAP", "Oracle", "Odoo", "VTEX", "Shopify", "Custom"]'::jsonb, 'manual', 1, 'tecnologia', false, 'cliente'),
  ('campo_volumen', 'volumen_mensual_estimado', 'Volumen de Despachos Mensuales', 'number', '[]'::jsonb, 'manual', 2, 'info_general', false, 'cliente'),
  ('campo_tipo_contribuyente', 'tipo_contribuyente', 'Tipo de Contribuyente Fiscal', 'select', '["Persona Jurídica", "Persona Natural con Negocio", "Extranjero"]'::jsonb, 'manual', 3, 'datos_fiscales', false, 'cliente')
ON CONFLICT (id) DO NOTHING;

-- 4. LOS 13 AGENTES DE SENTINEL IA
INSERT INTO public.config_ia (id, nombre, system_prompt, model_name, temperature, max_output_tokens, disabled, buffer_window_minutes)
VALUES
  ('sentinel', 'Auditor de Salud de Cuenta (Health Score)', 'Rol: Eres Sentinel IA, el Auditor de Riesgo Inteligente y Revenue Assurance de Luxia. Tu misión es evaluar la salud financiera, operativa y comercial de nuestros clientes para prevenir Churn. Responde estrictamente con JSON.', 'gemini-3.5-flash', 0.2, 1000, false, 5),
  ('sentinel_gmail', 'Analista de Correos Gmail', 'Rol: Eres Sentinel IA para Gmail. Analiza hilos de correos de clientes, detectando sentimiento, compromisos comerciales y riesgos de insatisfacción. Responde estrictamente con JSON.', 'gemini-3.5-flash-lite', 0.1, 1000, false, 5),
  ('sentinel_whatsapp', 'Copiloto y Sugerencias de WhatsApp', 'Rol: Eres Sentinel IA para WhatsApp Business. Analiza mensajes entrantes y genera sugerencias de respuesta en tono profesional y empático. Responde estrictamente con JSON.', 'gemini-3.5-flash-lite', 0.3, 1000, false, 5),
  ('sentinel_contracts', 'Auditor de Contratos y Riesgo Legal', 'Rol: Eres Sentinel IA Auditor Legal Senior. Analiza cláusulas de contratos, penalidades de SLA, condiciones de pago y volumen mínimo Take-or-Pay. Responde estrictamente con JSON.', 'gemini-3.6-flash', 0.1, 2048, false, 5),
  ('sentinel_copilot', 'Copiloto de Voz y Dictados de Terreno', 'Rol: Eres Sentinel Copilot. Interpreta notas de voz y comandos en lenguaje natural para crear interacciones, leads o actualizar clientes. Responde estrictamente con JSON.', 'gemini-3.5-flash', 0.2, 1000, false, 5),
  ('sentinel_search', 'Buscador Inteligente de Ficha de Cliente', 'Rol: Eres Sentinel Search Agent. Responde consultas estratégicas sobre la ficha del cliente cruzando bitácora, contratos y contactos. Responde estructuradamente en viñetas Markdown.', 'gemini-3.5-flash', 0.2, 1500, false, 5),
  ('sentinel_triage', 'Triage y Criticidad de Bitácora', 'Rol: Eres Sentinel IA Triage. Evalúa el impacto comercial y urgencia de cada nota o reunión registrada en el sistema. Responde estrictamente con JSON.', 'gemini-3.5-flash-lite', 0.1, 800, false, 5),
  ('sentinel_architect', 'Metrics Studio Architect', 'Rol: Eres Metrics Studio Architect. Traduce preguntas analíticas en configuraciones de consultas y gráficos Recharts. Responde estrictamente con JSON.', 'gemini-3.5-flash', 0.1, 1200, false, 5),
  ('sentinel_exam', 'Evaluador de Capacitación Comercial', 'Rol: Eres Sentinel Exam Evaluator. Califica respuestas prácticas de casos de estudio y genera retroalimentación pedagógica en Markdown. Responde estrictamente con JSON.', 'gemini-3.5-flash', 0.2, 1500, false, 5),
  ('sentinel_support', 'Soporte Conversacional (Manuales)', 'Rol: Eres Sentinel Support. Asiste a los usuarios paso a paso en el uso del CRM basado en los manuales de operaciones RAG. Responde amigablemente en Markdown.', 'gemini-3.5-flash-lite', 0.3, 1200, false, 5),
  ('sentinel_lead_scorer', 'Calificador de Leads B2B (ICP Scorer)', 'Rol: Eres Sentinel Lead Scorer. Califica el encaje de un prospecto comercial con el perfil de cliente ideal (ICP) calculando score y prioridad. Responde estrictamente con JSON.', 'gemini-3.5-flash', 0.2, 1000, false, 5),
  ('sentinel_pipeline_health', 'Auditor de Pipeline de Ventas', 'Rol: Eres Sentinel Pipeline Auditor. Evalúa estancamiento de oportunidades y probabilidad real de cierre según interacciones recientes. Responde estrictamente con JSON.', 'gemini-3.5-flash', 0.2, 1000, false, 5),
  ('sentinel_ia_auditor', 'Auditor de Calidad y Base de Conocimiento', 'Rol: Eres Sentinel IA Auditor. Analiza el feedback negativo de los usuarios para proponer nuevos artículos de ayuda y manuales operativos. Responde estrictamente con JSON.', 'gemini-3.5-flash', 0.2, 1500, false, 5)
ON CONFLICT (id) DO NOTHING;

-- 5. CONFIGURACIÓN GLOBAL DE PIPELINES Y SEGURIDAD
INSERT INTO public.config_general (id, datos)
VALUES
  ('security_config', '{
    "habilitado": true,
    "timeoutMinutos": 30,
    "exportRateLimitHabilitado": true,
    "exportMaxPorHora": 10,
    "exportAlertaExfiltracionMaxFilas": 500
  }'::jsonb),
  ('pipeline_config', '{
    "adquisicion_default": {
      "stages": [
        {"id": "diagnostico", "label": "📋 Diagnóstico", "orden": 10, "probabilidad": 20},
        {"id": "propuesta", "label": "💼 Propuesta", "orden": 20, "probabilidad": 50},
        {"id": "negociacion", "label": "🤝 Negociación", "orden": 30, "probabilidad": 80},
        {"id": "ganado", "label": "🎉 Ganado", "orden": 40, "probabilidad": 100},
        {"id": "perdido", "label": "❌ Perdido", "orden": 50, "probabilidad": 0}
      ]
    },
    "retencion_default": {
      "stages": [
        {"id": "evaluacion", "label": "🔍 Evaluación de Renovación", "orden": 10, "probabilidad": 30},
        {"id": "propuesta_upsell", "label": "📈 Oferta Upsell/Cross-sell", "orden": 20, "probabilidad": 60},
        {"id": "acuerdo_firmado", "label": "✍️ Contrato Renovado", "orden": 30, "probabilidad": 100}
      ]
    }
  }'::jsonb),
  ('rates', '{
    "USD": 1.0,
    "PEN": 3.75,
    "CLP": 950.0,
    "ARS": 1250.0,
    "COP": 4100.0,
    "MXN": 19.50
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;
