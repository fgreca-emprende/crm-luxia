# ADR-001: Adopción de Supabase On-Premise con Docker Compose

## Estado
Aceptado (2026-09-01)

## Contexto
El sistema CRM Luxia requiere una arquitectura de base de datos relacional de nivel enterprise, con control estricto de residencia de datos, soporte multi-tenant y costos predecibles para despliegues locales y en infraestructura privada.

## Decisión
Desplegar Supabase en modalidad On-Premise mediante Docker Compose con los siguientes componentes:
1. **PostgreSQL 15+** con extensiones de seguridad (`pgcrypto`, `pg_trgm`, `vector`).
2. **GoTrue (Supabase Auth)** para autenticación JWT segura.
3. **PostgREST** para capa de acceso a datos directa desde el cliente con RLS.
4. **Supabase Realtime** para Presence y Change Data Capture vía WebSockets.
5. **Kong Gateway** como punto de entrada unificado y enrutador de microservicios.
6. **Backend Worker (Express)** para orquestación de IA y tareas pesadas en segundo plano.

## Consecuencias
- **Positivas:** Control total sobre la infraestructura y privacidad de datos de clientes, cero costos de licencia por volumen de lecturas/escrituras, latencia sub-milisegundo en red local.
- **Negativas / Mitigaciones:** La administración y respaldo de la base de datos es responsabilidad del equipo DevOps (mitigado mediante scripts de backup automatizados en Docker).
