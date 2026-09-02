-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - REMEDIACIÓN CRÍTICA DE RLS, PERMISOS Y COLA DE IA (P0/P1)
-- 1. Restricción estricta de políticas de escritura en config_permisos y config_general
-- 2. Scopes granulares para contratos, interacciones y alertas
-- 3. Protección de logs_auditoria_exportacion
-- 4. Creación de tabla cola_tareas_ia para procesamiento asincrónico nativo
-- ==============================================================================

-- 1. RESTRICCIÓN DE ESCRITURA EN CONFIG_PERMISOS (P0-1)
DROP POLICY IF EXISTS "config_permisos_write" ON public.config_permisos;
CREATE POLICY "config_permisos_write" ON public.config_permisos
FOR ALL USING (public.is_admin());

-- 2. RESTRICCIÓN DE ESCRITURA EN CONFIG_GENERAL (P0-2)
DROP POLICY IF EXISTS "config_general_write" ON public.config_general;
CREATE POLICY "config_general_write" ON public.config_general
FOR ALL USING (public.is_admin());

-- 3. REMEDIACIÓN DE SCOPES EN CONTRATOS (P1-1)
DROP POLICY IF EXISTS "contratos_all_policy" ON public.contratos;

CREATE POLICY "contratos_select_policy" ON public.contratos
FOR SELECT USING (
  public.is_admin()
  OR (public.get_data_scope('contratos') = 'ALL')
  OR (public.get_data_scope('contratos') = 'TEAM' AND cliente_id IN (
        SELECT id FROM public.clientes WHERE comercial_id IN (
          SELECT id FROM public.usuarios WHERE equipo = public.get_user_team()
        )
     ))
  OR (public.get_data_scope('contratos') = 'OWN' AND cliente_id IN (
        SELECT id FROM public.clientes WHERE comercial_id = auth.uid()
     ))
);

CREATE POLICY "contratos_insert_policy" ON public.contratos
FOR INSERT WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('supervisor', 'agente')
);

CREATE POLICY "contratos_update_policy" ON public.contratos
FOR UPDATE USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM public.clientes WHERE comercial_id = auth.uid()
  )
);

CREATE POLICY "contratos_delete_policy" ON public.contratos
FOR DELETE USING (public.is_superadmin());

-- 4. REMEDIACIÓN DE INTERACCIONES Y ALERTAS (P1-2)
DROP POLICY IF EXISTS "interacciones_all_policy" ON public.interacciones;
CREATE POLICY "interacciones_select_policy" ON public.interacciones
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "interacciones_insert_policy" ON public.interacciones
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "interacciones_update_policy" ON public.interacciones
FOR UPDATE USING (public.is_admin() OR usuario_id = auth.uid());

DROP POLICY IF EXISTS "alertas_all_policy" ON public.alertas;
CREATE POLICY "alertas_select_policy" ON public.alertas
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "alertas_update_policy" ON public.alertas
FOR UPDATE USING (public.is_admin() OR usuario_id = auth.uid());

-- 5. PROTECCIÓN DE AUDITORÍA DE EXPORTACIÓN (P1-3)
ALTER TABLE IF EXISTS public.logs_auditoria_exportacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_exportacion_select" ON public.logs_auditoria_exportacion;
CREATE POLICY "logs_exportacion_select" ON public.logs_auditoria_exportacion
FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "logs_exportacion_insert" ON public.logs_auditoria_exportacion;
CREATE POLICY "logs_exportacion_insert" ON public.logs_auditoria_exportacion
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. CREACIÓN DE TABLA DE COLA DE TAREAS DE IA (P2-1)
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

CREATE POLICY "cola_tareas_ia_select" ON public.cola_tareas_ia
FOR SELECT USING (public.is_admin());

CREATE POLICY "cola_tareas_ia_insert" ON public.cola_tareas_ia
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR true); -- Permite inserción desde web-to-lead público
