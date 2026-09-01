-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - ROW LEVEL SECURITY (RLS) & TRIGGERS
-- Políticas de seguridad, Data Scopes y triggers de integridad de datos
-- ==============================================================================

-- ==============================================================================
-- 1. FUNCIONES AUXILIARES DE SEGURIDAD Y PERMISOS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE((SELECT rol FROM public.usuarios WHERE id = auth.uid()), 'lector');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE id = auth.uid() AND rol = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_team()
RETURNS TEXT AS $$
  SELECT COALESCE((SELECT equipo FROM public.usuarios WHERE id = auth.uid()), 'Global');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_data_scope(entity_name TEXT)
RETURNS TEXT AS $$
DECLARE
  u_role TEXT;
BEGIN
  SELECT rol INTO u_role FROM public.usuarios WHERE id = auth.uid();
  
  IF u_role IN ('superadmin', 'admin') THEN
    RETURN 'ALL';
  ELSIF u_role IN ('supervisor', 'supervisor_cx') THEN
    RETURN 'TEAM';
  ELSIF u_role IN ('agente', 'agente_cx') THEN
    RETURN 'OWN';
  ELSE
    RETURN 'ALL';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 2. HABILITACIÓN DE RLS EN TODAS LAS TABLAS
-- ==============================================================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_uso_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_general ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_ia_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_capacitacion_examenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examenes_intentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. POLÍTICAS RLS POR TABLA
-- ==============================================================================

-- -----------------------------
-- USUARIOS
-- -----------------------------
CREATE POLICY "usuarios_select_policy" ON public.usuarios
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "usuarios_update_policy" ON public.usuarios
FOR UPDATE USING (
  public.is_admin() OR id = auth.uid()
);

-- -----------------------------
-- CLIENTES
-- -----------------------------
CREATE POLICY "clientes_select_policy" ON public.clientes
FOR SELECT USING (
  public.is_admin()
  OR public.get_data_scope('clientes') = 'ALL'
  OR (public.get_data_scope('clientes') = 'TEAM' AND comercial_id IN (
        SELECT id FROM public.usuarios WHERE equipo = public.get_user_team()
     ))
  OR (public.get_data_scope('clientes') = 'OWN' AND comercial_id = auth.uid())
);

CREATE POLICY "clientes_insert_policy" ON public.clientes
FOR INSERT WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('supervisor', 'agente')
);

CREATE POLICY "clientes_update_policy" ON public.clientes
FOR UPDATE USING (
  public.is_admin() OR comercial_id = auth.uid()
);

CREATE POLICY "clientes_delete_policy" ON public.clientes
FOR DELETE USING (public.is_superadmin());

-- -----------------------------
-- LEADS / PROSPECTOS
-- -----------------------------
CREATE POLICY "leads_select_policy" ON public.leads
FOR SELECT USING (
  public.is_admin()
  OR public.get_data_scope('leads') = 'ALL'
  OR (public.get_data_scope('leads') = 'TEAM' AND asignado_id IN (
        SELECT id FROM public.usuarios WHERE equipo = public.get_user_team()
     ))
  OR (public.get_data_scope('leads') = 'OWN' AND asignado_id = auth.uid())
);

CREATE POLICY "leads_insert_policy" ON public.leads
FOR INSERT WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('agente', 'supervisor')
);

CREATE POLICY "leads_update_policy" ON public.leads
FOR UPDATE USING (
  public.is_admin() OR asignado_id = auth.uid()
);

CREATE POLICY "leads_delete_policy" ON public.leads
FOR DELETE USING (public.is_superadmin());

-- -----------------------------
-- OPORTUNIDADES
-- -----------------------------
CREATE POLICY "oportunidades_select_policy" ON public.oportunidades
FOR SELECT USING (
  public.is_admin()
  OR public.get_data_scope('oportunidades') = 'ALL'
  OR (public.get_data_scope('oportunidades') = 'TEAM' AND comercial_id IN (
        SELECT id FROM public.usuarios WHERE equipo = public.get_user_team()
     ))
  OR (public.get_data_scope('oportunidades') = 'OWN' AND comercial_id = auth.uid())
);

CREATE POLICY "oportunidades_insert_policy" ON public.oportunidades
FOR INSERT WITH CHECK (
  public.is_admin() OR public.current_user_role() IN ('supervisor', 'agente')
);

CREATE POLICY "oportunidades_update_policy" ON public.oportunidades
FOR UPDATE USING (
  public.is_admin() OR comercial_id = auth.uid()
);

-- -----------------------------
-- TICKETS & MENSAJES CX
-- -----------------------------
CREATE POLICY "tickets_select_policy" ON public.tickets
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tickets_insert_policy" ON public.tickets
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tickets_update_policy" ON public.tickets
FOR UPDATE USING (
  public.is_admin() OR agente_id = auth.uid() OR public.current_user_role() IN ('supervisor_cx', 'agente_cx')
);

CREATE POLICY "ticket_mensajes_select_policy" ON public.ticket_mensajes
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ticket_mensajes_insert_policy" ON public.ticket_mensajes
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- -----------------------------
-- CONTRATOS, INTERACCIONES, ALERTAS
-- -----------------------------
CREATE POLICY "contratos_all_policy" ON public.contratos
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "interacciones_all_policy" ON public.interacciones
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "alertas_all_policy" ON public.alertas
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "config_general_read" ON public.config_general
FOR SELECT USING (true);

CREATE POLICY "config_general_write" ON public.config_general
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "config_permisos_read" ON public.config_permisos
FOR SELECT USING (true);

CREATE POLICY "config_permisos_write" ON public.config_permisos
FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "config_ia_select" ON public.config_ia
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "config_ia_modify" ON public.config_ia
FOR ALL USING (public.is_admin());

CREATE POLICY "rag_select" ON public.rag_documents
FOR SELECT USING (auth.uid() IS NOT NULL);

-- ==============================================================================
-- 4. TRIGGERS DE INTEGRIDAD Y SINCRONIZACIÓN AUTOMÁTICA
-- ==============================================================================

-- A. Sincronizar nuevo usuario de auth.users a public.usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, rol, equipo, pais)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'lector'),
    COALESCE(NEW.raw_user_meta_data->>'equipo', 'Global'),
    COALESCE(NEW.raw_user_meta_data->>'pais', 'PE')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B. Proteger mutación indebida de health_score en clientes
CREATE OR REPLACE FUNCTION public.protect_clientes_system_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() AND (NEW.health_score IS DISTINCT FROM OLD.health_score) THEN
    RAISE EXCEPTION 'No está autorizado para modificar directamente el Health Score de Sentinel IA.';
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_clientes ON public.clientes;
CREATE TRIGGER trg_protect_clientes
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.protect_clientes_system_fields();

-- ==============================================================================
-- 5. CONFIGURACIÓN DE BUCKETS EN SUPABASE STORAGE
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('contratos', 'contratos', false, 52428800, '{application/pdf,image/png,image/jpeg}'),
  ('onboarding_evidencias', 'onboarding_evidencias', false, 52428800, null),
  ('whatsapp_media', 'whatsapp_media', true, 52428800, null),
  ('grabaciones_meet', 'grabaciones_meet', false, 104857600, '{audio/webm,audio/mp4,audio/ogg,video/webm}')
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "storage_authenticated_access" ON storage.objects
FOR ALL USING (auth.uid() IS NOT NULL);
