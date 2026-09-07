-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - DESACOPLAMIENTO DEFINITIVO DE INTEGRACIÓN SLACK
-- Remoción de columna slack_sync en public.usuarios y configuración general
-- ==============================================================================

-- 1. Eliminar columna slack_sync de la tabla public.usuarios
ALTER TABLE IF EXISTS public.usuarios 
DROP COLUMN IF EXISTS slack_sync;

-- 2. Eliminar registro de configuración de Slack en public.config_general
DELETE FROM public.config_general 
WHERE id = 'slack_config';
