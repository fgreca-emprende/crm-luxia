# ADR-002: Formato de Identificador en Tabla Clientes (`TEXT` vs `UUID`)

## Estado
Aceptado (Transitorio para compatibilidad con integraciones CRM externas)

## Contexto
Durante la migración y coexistencia con sistemas CRM de terceros (como HubSpot o Salesforce), los identificadores de empresas pueden provenir de claves alfanuméricas externas (ej: `hs_company_9812401`).

## Decisión
Mantener `clientes.id` de tipo `TEXT PRIMARY KEY` en la fase actual para preservar compatibilidad con cargas masivas y sincronización bidireccional. Para relaciones internas generadas por el sistema, se recomienda el uso de `gen_random_uuid()::text`.

## Hoja de Ruta de Evolución (P4-1)
En la versión mayor v2.0, se incorporará una columna explícita `external_id TEXT` indexada y se migrará la clave primaria `id` a tipo nativo `UUID`.
