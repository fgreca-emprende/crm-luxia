-- ==============================================================================
-- MIGRACIÓN 20260911: ELIMINACIÓN DEL EQUIPO CX DE LA BASE DE DATOS
-- ==============================================================================

-- 1. Reasignar cualquier usuario que aún pudiera tener equipo CX a 'Global'
UPDATE public.usuarios
SET equipo = 'Global'
WHERE LOWER(equipo) = 'cx';

-- 2. Eliminar el equipo CX de la tabla equipos
DELETE FROM public.equipos
WHERE id = 'CX' OR LOWER(nombre) LIKE '%atención al cliente%' OR LOWER(id) = 'cx';

-- 3. Limpiar referencias de configuración general si existen
UPDATE public.config_general
SET datos = jsonb_set(
  datos,
  '{lista}',
  COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(datos->'lista') elem
      WHERE elem->>'id' NOT IN ('CX', 'cx')
    ),
    '[]'::jsonb
  )
)
WHERE id = 'equipos' AND datos->'lista' IS NOT NULL;
