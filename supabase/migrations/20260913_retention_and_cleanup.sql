-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - PROCEDIMIENTO Y CRON DE RETENCIÓN DE LOGS (P3-OPS-01)
-- Purga automática de registros históricos de IA, telemetría y auditoría
-- ==============================================================================

-- 1. PROCEDIMIENTO ALMACENADO DE PURGA CONTROLADA
CREATE OR REPLACE FUNCTION public.purgar_logs_historicos(p_dias_retencion INTEGER DEFAULT 90)
RETURNS JSONB AS $$
DECLARE
  v_fecha_corte TIMESTAMPTZ;
  v_fecha_corte_cola TIMESTAMPTZ;
  v_fecha_corte_auditoria TIMESTAMPTZ;
  v_ia_purgados BIGINT := 0;
  v_cola_purgados BIGINT := 0;
  v_uso_purgados BIGINT := 0;
  v_audit_purgados BIGINT := 0;
BEGIN
  -- Días de retención mínimos para telemetría general
  v_fecha_corte := NOW() - (p_dias_retencion || ' days')::INTERVAL;
  -- Tareas completadas/fallidas de IA: 30 días
  v_fecha_corte_cola := NOW() - INTERVAL '30 days';
  -- Logs de auditoría de exportación: retención legal de 180 días
  v_fecha_corte_auditoria := NOW() - INTERVAL '180 days';

  -- A. Purgar logs de consumo de IA
  WITH deleted AS (
    DELETE FROM public.logs_ia_consumo
    WHERE timestamp < v_fecha_corte
    RETURNING id
  )
  SELECT COUNT(*) INTO v_ia_purgados FROM deleted;

  -- B. Purgar cola de tareas de IA completadas o fallidas antiguas
  WITH deleted_cola AS (
    DELETE FROM public.cola_tareas_ia
    WHERE estado IN ('completado', 'fallido')
      AND updated_at < v_fecha_corte_cola
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cola_purgados FROM deleted_cola;

  -- C. Purgar usuario uso diario antiguo (> 180 días)
  WITH deleted_uso AS (
    DELETE FROM public.usuario_uso_diario
    WHERE fecha < (CURRENT_DATE - INTERVAL '180 days')::DATE
    RETURNING id
  )
  SELECT COUNT(*) INTO v_uso_purgados FROM deleted_uso;

  -- D. Purgar logs de auditoría de exportación antiguos (> 180 días)
  WITH deleted_audit AS (
    DELETE FROM public.logs_auditoria_exportacion
    WHERE timestamp < v_fecha_corte_auditoria
    RETURNING id
  )
  SELECT COUNT(*) INTO v_audit_purgados FROM deleted_audit;

  RETURN jsonb_build_object(
    'success', true,
    'fecha_ejecucion', NOW(),
    'dias_retencion_aplicados', p_dias_retencion,
    'registros_purgados', jsonb_build_object(
      'logs_ia_consumo', v_ia_purgados,
      'cola_tareas_ia', v_cola_purgados,
      'usuario_uso_diario', v_uso_purgados,
      'logs_auditoria_exportacion', v_audit_purgados
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
