-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - CORRECCIÓN DE POLÍTICAS RLS PERMISIVAS (P1-7)
-- Reemplaza policies abiertas FOR ALL con policies granulares por operación
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. CONTRATOS: Acceso basado en comercial asignado al cliente o Data Scope
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "contratos_all_policy" ON public.contratos;

CREATE POLICY "contratos_select" ON public.contratos
FOR SELECT USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = contratos.cliente_id
    AND (
      c.comercial_id = auth.uid()
      OR public.get_data_scope('clientes') = 'ALL'
      OR (
        public.get_data_scope('clientes') = 'TEAM'
        AND c.comercial_id IN (
          SELECT id FROM public.usuarios WHERE equipo = public.get_user_team()
        )
      )
    )
  )
);

CREATE POLICY "contratos_insert" ON public.contratos
FOR INSERT WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('supervisor', 'agente')
);

CREATE POLICY "contratos_update" ON public.contratos
FOR UPDATE USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = contratos.cliente_id AND c.comercial_id = auth.uid()
  )
);

CREATE POLICY "contratos_delete" ON public.contratos
FOR DELETE USING (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- 2. INTERACCIONES: Scope por autor o ámbito de cliente asociado
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "interacciones_all_policy" ON public.interacciones;

CREATE POLICY "interacciones_select" ON public.interacciones
FOR SELECT USING (
  public.is_admin()
  OR autor_id = auth.uid()
  OR public.get_data_scope('clientes') = 'ALL'
  OR (
    public.get_data_scope('clientes') = 'TEAM'
    AND autor_id IN (
      SELECT id FROM public.usuarios WHERE equipo = public.get_user_team()
    )
  )
);

CREATE POLICY "interacciones_insert" ON public.interacciones
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "interacciones_update" ON public.interacciones
FOR UPDATE USING (
  public.is_admin() OR autor_id = auth.uid()
);

CREATE POLICY "interacciones_delete" ON public.interacciones
FOR DELETE USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. ALERTAS: Scope por comercial_email o rol de supervisión
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "alertas_all_policy" ON public.alertas;

CREATE POLICY "alertas_select" ON public.alertas
FOR SELECT USING (
  public.is_admin()
  OR comercial_email = (SELECT email FROM public.usuarios WHERE id = auth.uid())
  OR public.get_data_scope('alertas') = 'ALL'
);

CREATE POLICY "alertas_insert" ON public.alertas
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "alertas_update" ON public.alertas
FOR UPDATE USING (
  public.is_admin()
  OR comercial_email = (SELECT email FROM public.usuarios WHERE id = auth.uid())
);

CREATE POLICY "alertas_delete" ON public.alertas
FOR DELETE USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. CONFIG_GENERAL: Escritura restringida exclusivamente a Administradores
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "config_general_write" ON public.config_general;

CREATE POLICY "config_general_write_admin" ON public.config_general
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. CONFIG_PERMISOS: Escritura restringida exclusivamente a Superadministradores
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "config_permisos_write" ON public.config_permisos;

CREATE POLICY "config_permisos_write_superadmin" ON public.config_permisos
FOR ALL USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- 6. STORAGE: Bucket whatsapp_media privado y con MIME types seguros
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
SET 
  public = false,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/ogg', 'audio/mpeg', 'audio/webm',
    'video/mp4', 'video/webm',
    'application/pdf'
  ]
WHERE id = 'whatsapp_media';
