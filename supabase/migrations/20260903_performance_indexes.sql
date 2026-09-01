-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - ÍNDICES DE RENDIMIENTO Y CATÁLOGO IA (P2-4 & P2-6)
-- Optimización de queries analíticas, logs y registro del modelo Gemini 3.7 Flash
-- ==============================================================================

-- 1. Índices para logs_ia_consumo (Dashboard de telemetría y costos IA)
CREATE INDEX IF NOT EXISTS idx_logs_ia_user_email 
  ON public.logs_ia_consumo (user_email, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_ia_model_name 
  ON public.logs_ia_consumo (model_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_ia_timestamp 
  ON public.logs_ia_consumo (timestamp DESC);

-- 2. Índices para logs_sistema (Auditoría operativa y seguridad)
CREATE INDEX IF NOT EXISTS idx_logs_sistema_usuario 
  ON public.logs_sistema (usuario_email, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_sistema_accion 
  ON public.logs_sistema (accion, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_sistema_timestamp 
  ON public.logs_sistema (timestamp DESC);

-- 3. Índice parcial para alertas pendientes de resolución (Query frecuente)
CREATE INDEX IF NOT EXISTS idx_alertas_no_leidas 
  ON public.alertas (comercial_email, creada_en DESC) 
  WHERE leida = false;

-- 4. Índice para historial de exámenes e intentos
CREATE INDEX IF NOT EXISTS idx_examenes_usuario 
  ON public.examenes_intentos (usuario_id, fecha_intento DESC);

-- 5. Índice para buffer de WhatsApp activo
CREATE INDEX IF NOT EXISTS idx_whatsapp_buffer_pending 
  ON public.whatsapp_buffer (status, process_after) 
  WHERE status = 'pending';

-- 6. Catálogo de Modelos: Registrar Gemini 3.7 Flash (Flagship agosto 2026)
INSERT INTO public.config_ia_modelos (
  id, nombre, proveedor, estado, es_default, descripcion, 
  official_input_rate_per_1m, official_output_rate_per_1m, max_output_tokens, context_window
) VALUES (
  'gemini-3.7-flash', 
  'Gemini 3.7 Flash', 
  'Google Gemini', 
  'activo', 
  false, 
  'Modelo flagship agosto 2026. Optimizado para coding, razonamiento avanzado y flujos agénticos complejos.', 
  0.25, 
  1.00, 
  8192, 
  1048576
) ON CONFLICT (id) DO NOTHING;
