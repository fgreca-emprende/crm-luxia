-- ==============================================================================
-- CRM-LUXIA ENTERPRISE - REMEDIACIÓN CRÍTICA P0 & P1 (POSTGRESQL & RLS)
-- 1. Restricción del Scope por defecto para el rol 'lector' (Principio de Menor Privilegio)
-- 2. Asegurar buckets de Storage y politicas granulares
-- ==============================================================================

-- 1. CORRECCIÓN DE DATA SCOPE PARA ROL 'LECTOR' (P0-1)
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
  ELSIF u_role IN ('agente', 'agente_cx', 'editor') THEN
    RETURN 'OWN';
  ELSIF u_role = 'lector' THEN
    RETURN 'OWN'; -- Corregido: Lectores solo acceden a registros propios por defecto
  ELSE
    RETURN 'OWN'; -- Fallback restrictivo seguro por defecto
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. ASEGURAR BUCKET DE STORAGE PARA GRABACIONES DE MEET (P1-3)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('grabaciones_meet', 'grabaciones_meet', false, 104857600, '{audio/webm,audio/mp4,audio/ogg,video/webm}'),
  ('crm-files', 'crm-files', false, 104857600, null)
ON CONFLICT (id) DO NOTHING;
