-- ==============================================================================
-- MIGRACIÓN 20260908: REMOCIÓN TOTAL DEL MÓDULO CX / TICKETS Y ROLES ASOCIADOS
-- ==============================================================================

-- 1. ELIMINAR TABLAS DEL MÓDULO CX / TICKETS DE SOPORTE
DROP TABLE IF EXISTS public.tickets_cx CASCADE;
DROP TABLE IF EXISTS public.faq_articulos CASCADE;

-- 2. ACTUALIZAR CHECK CONSTRAINT DE ROLES EN TABLA USUARIOS
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check 
  CHECK (rol IN ('superadmin', 'admin', 'supervisor', 'agente', 'lector', 'editor'));

-- 3. ACTUALIZAR ROL POR DEFECTO PARA USUARIOS QUE ERAN AGENTE_CX O SUPERVISOR_CX
UPDATE public.usuarios 
SET rol = 'agente' 
WHERE rol IN ('agente_cx', 'supervisor_cx');

-- 4. LIMPIAR PERMISOS O CONFIGURACIONES DE CX_INBOX EN TABLAS DE CONFIGURACIÓN
DELETE FROM public.config_permisos WHERE accion LIKE '%cx%' OR modulo = 'cx_inbox';
