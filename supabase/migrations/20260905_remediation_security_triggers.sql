-- ==============================================================================
-- CRM-LUXIA ENTERPRISE (LUXIA AGRO) - SEGURIDAD CRÍTICA Y TRIGGERS (P0)
-- 1. Protección contra escalación de privilegios en public.usuarios
-- 2. Corrección del Scope por defecto en get_data_scope (Principio de Menor Privilegio)
-- 3. Políticas RLS granulares en storage.objects
-- ==============================================================================

-- 1. TRIGGER DE PROTECCIÓN DE ROLES Y PRIVILEGIOS DE USUARIOS
CREATE OR REPLACE FUNCTION public.protect_user_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el usuario actual no es admin/superadmin, no puede alterar su propio rol, equipo ni estado activo
  IF NOT public.is_admin() THEN
    IF (NEW.rol IS DISTINCT FROM OLD.rol) THEN
      RAISE EXCEPTION 'Violación de seguridad: No está autorizado para modificar roles de usuario.';
    END IF;
    IF (NEW.equipo IS DISTINCT FROM OLD.equipo) THEN
      RAISE EXCEPTION 'Violación de seguridad: No está autorizado para modificar la asignación de equipo.';
    END IF;
    IF (NEW.activo IS DISTINCT FROM OLD.activo) THEN
      RAISE EXCEPTION 'Violación de seguridad: No está autorizado para modificar el estado de activación.';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_usuarios ON public.usuarios;
CREATE TRIGGER trg_protect_usuarios
BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.protect_user_privilege_escalation();

-- 2. CORRECCIÓN DE DATA SCOPE POR DEFECTO (Principio de Menor Privilegio)
CREATE OR REPLACE FUNCTION public.get_data_scope(entity_name TEXT)
RETURNS TEXT AS $$
DECLARE
  u_role TEXT;
BEGIN
  SELECT rol INTO u_role FROM public.usuarios WHERE id = auth.uid();
  
  IF u_role IN ('superadmin', 'admin') THEN
    RETURN 'ALL';
  ELSIF u_role = 'supervisor' THEN
    RETURN 'TEAM';
  ELSIF u_role IN ('agente', 'editor') THEN
    RETURN 'OWN';
  ELSIF u_role = 'lector' THEN
    RETURN 'ALL'; -- Lectores tienen acceso de solo lectura global
  ELSE
    RETURN 'OWN'; -- Fallback restrictivo seguro por defecto
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. POLÍTICAS RLS EN STORAGE.OBJECTS (Contratos, Evidencias, Grabaciones)
DROP POLICY IF EXISTS "storage_authenticated_access" ON storage.objects;

-- Política de lectura: Administradores o creador del archivo / bucket específico
CREATE POLICY "storage_granular_select" ON storage.objects
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR bucket_id IN ('whatsapp_media') -- Bucket de multimedia operacional
    OR (
      bucket_id IN ('contratos', 'onboarding_evidencias', 'grabaciones_meet')
      AND (
        owner = auth.uid()
        OR public.get_data_scope('clientes') = 'ALL'
        OR (
          public.get_data_scope('clientes') = 'TEAM'
          AND EXISTS (
            SELECT 1 FROM public.usuarios u
            WHERE u.id = storage.objects.owner AND u.equipo = public.get_user_team()
          )
        )
      )
    )
  )
);

-- Política de subida (Insert): Usuarios autenticados autorizados
CREATE POLICY "storage_granular_insert" ON storage.objects
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR public.current_user_role() IN ('supervisor', 'agente', 'editor')
  )
);

-- Política de actualización: Solo administradores o propietario
CREATE POLICY "storage_granular_update" ON storage.objects
FOR UPDATE USING (
  public.is_admin() OR owner = auth.uid()
);

-- Política de eliminación: Exclusivo Superadmin y Admin
CREATE POLICY "storage_granular_delete" ON storage.objects
FOR DELETE USING (
  public.is_admin()
);
