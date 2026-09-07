-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - REMOCIÓN DE GAMIFICACIÓN Y LOGROS
-- Elimina columnas de gamificación en public.usuarios y public.equipos
-- ==============================================================================

ALTER TABLE public.usuarios DROP COLUMN IF EXISTS gamificacion;
ALTER TABLE public.equipos DROP COLUMN IF EXISTS participa_gamificacion;
