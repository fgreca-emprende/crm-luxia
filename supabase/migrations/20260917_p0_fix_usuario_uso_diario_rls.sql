-- ==============================================================================
-- CRM-LUXIA ENTERPRISE — POLÍTICAS RLS PARA usuario_uso_diario
-- Permite a los usuarios autenticados registrar su actividad diaria (Heartbeat)
-- ==============================================================================

-- Asegurar constraint único en (user_id, fecha) para soportar upsert ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.usuario_uso_diario'::regclass 
      AND contype = 'u' 
      AND conname = 'usuario_uso_diario_user_id_fecha_key'
  ) THEN
    ALTER TABLE public.usuario_uso_diario
      ADD CONSTRAINT usuario_uso_diario_user_id_fecha_key UNIQUE (user_id, fecha);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Habilitar RLS
ALTER TABLE public.usuario_uso_diario ENABLE ROW LEVEL SECURITY;

-- 1. Política de Lectura (SELECT)
DROP POLICY IF EXISTS "usuario_uso_diario_select" ON public.usuario_uso_diario;
CREATE POLICY "usuario_uso_diario_select" ON public.usuario_uso_diario
  FOR SELECT USING (
    (auth.role() = 'service_role') OR
    (public.is_admin()) OR
    (auth.uid() = user_id)
  );

-- 2. Política de Inserción (INSERT)
DROP POLICY IF EXISTS "usuario_uso_diario_insert" ON public.usuario_uso_diario;
CREATE POLICY "usuario_uso_diario_insert" ON public.usuario_uso_diario
  FOR INSERT WITH CHECK (
    (auth.role() = 'service_role') OR
    (public.is_admin()) OR
    (auth.uid() = user_id)
  );

-- 3. Política de Actualización (UPDATE)
DROP POLICY IF EXISTS "usuario_uso_diario_update" ON public.usuario_uso_diario;
CREATE POLICY "usuario_uso_diario_update" ON public.usuario_uso_diario
  FOR UPDATE USING (
    (auth.role() = 'service_role') OR
    (public.is_admin()) OR
    (auth.uid() = user_id)
  );
