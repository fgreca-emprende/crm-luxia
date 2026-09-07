-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - REMEDIACIÓN CRÍTICA P0 (SEGURIDAD Y TRANSACCIONES)
-- 1. Cierre de brecha de escalación de privilegios en auto-registro
-- 2. Procedimiento almacenado atómico para conversión de leads a clientes
-- 3. Blindaje de RLS en cola_tareas_ia
-- ==============================================================================

-- 1. CIERRE DE BRECHA EN TRIGGER DE AUTO-REGISTRO (SEC-01)
-- Se elimina la lectura de raw_user_meta_data->>'rol'. Todo nuevo usuario queda como 'lector' estrictamente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, rol, equipo, pais, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    'lector', -- Estricto: Los roles superiores deben ser asignados explícitamente por un superadmin
    COALESCE(NEW.raw_user_meta_data->>'equipo', 'Global'),
    COALESCE(NEW.raw_user_meta_data->>'pais', 'PE'),
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. PROCEDIMIENTO ALMACENADO TRANSACCIONAL ATÓMICO: CONVERSIÓN DE LEAD (DAT-01)
CREATE OR REPLACE FUNCTION public.convertir_lead_a_cliente(
  p_lead_id UUID,
  p_nombre_empresa TEXT,
  p_cuit_rut_rfc TEXT DEFAULT NULL,
  p_industria TEXT DEFAULT NULL,
  p_sitio_web TEXT DEFAULT NULL,
  p_tamanio_empresa TEXT DEFAULT NULL,
  p_pais TEXT DEFAULT 'PE',
  p_comercial_email TEXT DEFAULT NULL,
  p_nombre_oportunidad TEXT DEFAULT 'Oportunidad Inicial',
  p_monto_estimado_mensual NUMERIC DEFAULT 0,
  p_etapa_oportunidad TEXT DEFAULT 'diagnostico'
)
RETURNS JSONB AS $$
DECLARE
  v_lead RECORD;
  v_client_id TEXT;
  v_contacto_id UUID;
  v_oportunidad_id UUID;
  v_user_email TEXT;
  v_probabilidad NUMERIC;
BEGIN
  -- 1. Validar que el lead exista
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead con ID % no encontrado.', p_lead_id;
  END IF;

  IF v_lead.estado = 'ganado' THEN
    RAISE EXCEPTION 'El lead ya ha sido convertido previamente.';
  END IF;

  v_client_id := 'lead_converted_' || p_lead_id::TEXT;
  v_user_email := COALESCE(p_comercial_email, v_lead.asignado_a, 'admin@luxia.com');

  -- 2. Inserción o actualización segura del Cliente (Idempotente)
  INSERT INTO public.clientes (
    id,
    nombre_empresa,
    cuit_rut_rfc,
    industria,
    sitio_web,
    tamanio_empresa,
    estado,
    observaciones,
    comercial_email,
    pais,
    campos_dinamicos
  ) VALUES (
    v_client_id,
    p_nombre_empresa,
    p_cuit_rut_rfc,
    p_industria,
    p_sitio_web,
    p_tamanio_empresa,
    'Onboarding',
    'Cliente convertido del Lead calificado: ' || COALESCE(v_lead.nombre_contacto, 'Sin contacto') || '. ' || COALESCE(v_lead.notas, ''),
    v_user_email,
    p_pais,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre_empresa = EXCLUDED.nombre_empresa,
    updated_at = NOW();

  -- 3. Inserción del Contacto Principal
  INSERT INTO public.contactos (
    cliente_id,
    lead_id,
    nombre,
    email,
    telefono,
    puesto
  ) VALUES (
    v_client_id,
    p_lead_id,
    COALESCE(v_lead.nombre_contacto, 'Contacto Principal'),
    v_lead.correo,
    v_lead.telefono,
    'Contacto Comercial Principal'
  ) RETURNING id INTO v_contacto_id;

  -- 4. Inserción de la Oportunidad en el Pipeline
  IF p_etapa_oportunidad = 'diagnostico' THEN
    v_probabilidad := 20;
  ELSIF p_etapa_oportunidad = 'propuesta' THEN
    v_probabilidad := 50;
  ELSE
    v_probabilidad := 80;
  END IF;

  INSERT INTO public.oportunidades (
    cliente_id,
    nombre,
    etapa,
    monto_estimado_mensual,
    valor_contrato_anual,
    probabilidad,
    comercial_email,
    pais,
    tipo_pipeline,
    tipo_servicio,
    campos_dinamicos
  ) VALUES (
    v_client_id,
    p_nombre_oportunidad,
    p_etapa_oportunidad,
    p_monto_estimado_mensual,
    p_monto_estimado_mensual * 12,
    v_probabilidad,
    v_user_email,
    p_pais,
    'adquisicion',
    'default',
    '{}'::jsonb
  ) RETURNING id INTO v_oportunidad_id;

  -- 5. Actualizar estado del lead a 'ganado'
  UPDATE public.leads
  SET estado = 'ganado', updated_at = NOW()
  WHERE id = p_lead_id;

  -- 6. Registrar bitácora de auditoría en interacciones
  INSERT INTO public.interacciones (
    cliente_id,
    lead_id,
    oportunidad_id,
    tipo,
    descripcion,
    autor
  ) VALUES (
    v_client_id,
    p_lead_id,
    v_oportunidad_id,
    'conversion_lead',
    'Lead convertido exitosamente a Cliente y Oportunidad mediante transacción atómica.',
    v_user_email
  );

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', v_client_id,
    'oportunidad_id', v_oportunidad_id,
    'contacto_id', v_contacto_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREACIÓN Y BLINDAJE DE POLÍTICA RLS EN COLA_TAREAS_IA (SEC-03 / AI-01)
CREATE TABLE IF NOT EXISTS public.cola_tareas_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    agente_id TEXT NOT NULL DEFAULT 'luxia_lead_scorer',
    prompt TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesando', 'completado', 'fallido')),
    intentos INTEGER NOT NULL DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cola_tareas_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cola_tareas_ia_select" ON public.cola_tareas_ia;
CREATE POLICY "cola_tareas_ia_select" ON public.cola_tareas_ia
FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "cola_tareas_ia_insert" ON public.cola_tareas_ia;
CREATE POLICY "cola_tareas_ia_insert" ON public.cola_tareas_ia
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL OR current_user = 'service_role' OR current_user = 'postgres'
);
