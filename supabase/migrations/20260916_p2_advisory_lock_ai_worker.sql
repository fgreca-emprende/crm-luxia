-- ==============================================================================
-- CRM-LUXIA ENTERPRISE — ADVISORY LOCK & SKIP LOCKED FOR AI QUEUE WORKER
-- Permite concurrencia segura y escalado horizontal de workers sin tareas duplicadas
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.dequeue_ai_tasks(p_limit integer DEFAULT 5)
RETURNS SETOF public.cola_tareas_ia AS $$
DECLARE
  r public.cola_tareas_ia;
BEGIN
  RETURN QUERY
  WITH selected AS (
    SELECT id
    FROM public.cola_tareas_ia
    WHERE estado = 'pendiente' AND COALESCE(intentos, 0) < 5
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.cola_tareas_ia t
  SET estado = 'procesando',
      intentos = COALESCE(t.intentos, 0) + 1,
      updated_at = NOW()
  FROM selected
  WHERE t.id = selected.id
  RETURNING t.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos de ejecución al rol service_role
GRANT EXECUTE ON FUNCTION public.dequeue_ai_tasks(integer) TO service_role;
