-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - POLÍTICA DE RETENCIÓN DE LOGS TEMPORALES (P4-2)
-- Función de limpieza periódica de registros con TTL para prevenir crecimiento desmedido
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_api_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar logs de webhook o API externa con expire_at vencido o mayores a 30 días
  DELETE FROM public.incoming_api_logs
  WHERE expire_at < NOW()
     OR (expire_at IS NULL AND timestamp < NOW() - INTERVAL '30 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario explicativo para pg_cron:
-- SELECT cron.schedule('cleanup-api-logs-daily', '0 3 * * *', 'SELECT public.cleanup_expired_api_logs()');
