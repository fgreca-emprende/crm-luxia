-- ==============================================================================
-- CRM-LUXIA ENTERPRISE — REMEDIACIÓN P1 (RLS Y PERFORMANCE)
-- 1. RLS en tablas de auditoría, logs y API keys
-- 2. Índices B-Tree / parciales para acelerar consultas frecuentes
-- 3. Trigger de sanitización para redacción de tokens y passwords en logs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RLS EN TABLAS CRÍTICAS
-- ------------------------------------------------------------------------------

-- logs_sistema: Solo admins pueden leer, el backend escribe vía service_role
ALTER TABLE IF EXISTS public.logs_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logs_sistema_admin_only" ON public.logs_sistema;
CREATE POLICY "logs_sistema_admin_only" ON public.logs_sistema
  FOR ALL USING (
    (auth.role() = 'service_role') OR 
    (public.is_admin())
  );

-- logs_ia_consumo: Admin ve todo, usuario ve sus propios registros
ALTER TABLE IF EXISTS public.logs_ia_consumo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logs_ia_consumo_select" ON public.logs_ia_consumo;
CREATE POLICY "logs_ia_consumo_select" ON public.logs_ia_consumo
  FOR SELECT USING (
    (auth.role() = 'service_role') OR
    (public.is_admin()) OR 
    (user_email = (SELECT email FROM public.usuarios WHERE id = auth.uid()))
  );

-- incoming_api_logs: Solo admins y service_role
ALTER TABLE IF EXISTS public.incoming_api_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "incoming_api_logs_admin_only" ON public.incoming_api_logs;
CREATE POLICY "incoming_api_logs_admin_only" ON public.incoming_api_logs
  FOR ALL USING (
    (auth.role() = 'service_role') OR 
    (public.is_admin())
  );

-- logs_auditoria_exportacion: Solo admins y service_role
ALTER TABLE IF EXISTS public.logs_auditoria_exportacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logs_auditoria_admin_only" ON public.logs_auditoria_exportacion;
CREATE POLICY "logs_auditoria_admin_only" ON public.logs_auditoria_exportacion
  FOR ALL USING (
    (auth.role() = 'service_role') OR 
    (public.is_admin())
  );

-- api_keys: Solo administradores y service_role
ALTER TABLE IF EXISTS public.api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_keys_admin_only" ON public.api_keys;
CREATE POLICY "api_keys_admin_only" ON public.api_keys
  FOR ALL USING (
    (auth.role() = 'service_role') OR 
    (public.is_admin())
  );

-- ------------------------------------------------------------------------------
-- 2. ÍNDICES DE PERFORMANCE FALTANTES
-- ------------------------------------------------------------------------------

-- Cola de IA: índice parcial para polling de tareas pendientes y en proceso
CREATE INDEX IF NOT EXISTS idx_cola_tareas_ia_estado
  ON public.cola_tareas_ia (estado, created_at)
  WHERE estado IN ('pendiente', 'procesando');

-- Leads: Kanban y filtrado frecuente por estado
CREATE INDEX IF NOT EXISTS idx_leads_estado_created
  ON public.leads (estado, created_at DESC);

-- Oportunidades: pipeline y filtrado por etapa y país
CREATE INDEX IF NOT EXISTS idx_oportunidades_etapa_pais
  ON public.oportunidades (etapa, pais, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. SANITIZACIÓN AUTOMÁTICA DE LOGS DE API
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sanitize_incoming_log()
RETURNS TRIGGER AS $$
BEGIN
  -- Redactar Authorization headers si existen
  IF NEW.headers IS NOT NULL AND NEW.headers::text ILIKE '%authorization%' THEN
    NEW.headers = (NEW.headers::jsonb - 'authorization' - 'Authorization' || '{"authorization": "[REDACTED]"}'::jsonb);
  END IF;

  -- Redactar passwords o secrets en payload si existen
  IF NEW.payload IS NOT NULL AND NEW.payload::text ILIKE '%password%' THEN
    NEW.payload = jsonb_set(COALESCE(NEW.payload, '{}'::jsonb), '{password}', '"[REDACTED]"', false);
  END IF;

  IF NEW.payload IS NOT NULL AND NEW.payload::text ILIKE '%secret%' THEN
    NEW.payload = jsonb_set(COALESCE(NEW.payload, '{}'::jsonb), '{secret}', '"[REDACTED]"', false);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sanitize_incoming_log ON public.incoming_api_logs;
CREATE TRIGGER trg_sanitize_incoming_log
  BEFORE INSERT ON public.incoming_api_logs
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_incoming_log();
