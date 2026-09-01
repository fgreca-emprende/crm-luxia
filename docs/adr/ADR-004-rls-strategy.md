# ADR-004: Estrategia de Row Level Security (RLS) y Data Scopes

## Estado
Aceptado (2026-09-01)

## Contexto
El sistema CRM es multi-país y multi-equipo con 4 roles jerárquicos (`superadmin`, `admin`, `supervisor`, `agente`, `lector`). Se debe garantizar que los usuarios solo puedan acceder a los datos que les corresponden sin depender exclusivamente de filtros de frontend.

## Decisión
1. **Row Level Security (RLS)** habilitado de forma obligatoria en todas las tablas de datos (`clientes`, `leads`, `oportunidades`, `contratos`, `interacciones`, `alertas`).
2. Implementación de funciones `SECURITY DEFINER` en PostgreSQL para determinar el Data Scope dinámico:
   - `ALL`: Acceso irrestricto (Superadmin y Admin).
   - `TEAM`: Acceso a registros asignados a miembros del mismo equipo (Supervisores).
   - `OWN`: Acceso exclusivamente a registros donde `comercial_id = auth.uid()` (Agentes comerciales).
3. Auditoría inmutable de exportaciones masivas en `logs_auditoria_exportacion`.
