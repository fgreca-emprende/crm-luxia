-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - FUNCIONES RPC DE AGREGACIÓN DE KPIS EN POSTGRESQL (P2-1)
-- Evita descargas masivas de colecciones completas al navegador para calculos KPI
-- ==============================================================================

-- 1. Obtener resumen de KPIs de Pipeline por Etapa y Tipo
CREATE OR REPLACE FUNCTION public.get_pipeline_kpi_summary(p_pais TEXT DEFAULT NULL)
RETURNS TABLE (
  etapa TEXT,
  total_oportunidades BIGINT,
  monto_total NUMERIC,
  monto_promedio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.etapa,
    COUNT(o.id) AS total_oportunidades,
    COALESCE(SUM(o.monto_estimado_mensual), 0) AS monto_total,
    COALESCE(AVG(o.monto_estimado_mensual), 0) AS monto_promedio
  FROM public.oportunidades o
  WHERE (p_pais IS NULL OR o.pais = p_pais)
  GROUP BY o.etapa;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Obtener resumen de Health Score de Clientes por Tier
CREATE OR REPLACE FUNCTION public.get_customer_health_summary()
RETURNS TABLE (
  tier_cuenta TEXT,
  total_clientes BIGINT,
  green_count BIGINT,
  yellow_count BIGINT,
  red_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.tier_cuenta,
    COUNT(c.id) AS total_clientes,
    COUNT(CASE WHEN c.health_score->>'riesgo' = 'Green' THEN 1 END) AS green_count,
    COUNT(CASE WHEN c.health_score->>'riesgo' = 'Yellow' THEN 1 END) AS yellow_count,
    COUNT(CASE WHEN c.health_score->>'riesgo' = 'Red' THEN 1 END) AS red_count
  FROM public.clientes c
  GROUP BY c.tier_cuenta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
