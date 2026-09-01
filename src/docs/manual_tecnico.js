export const MANUAL_TECNICO_MD = `# Referencia Técnica y Arquitectura de Sistema
## LUXIA® Agro Enterprise CRM · Documentación para Desarrolladores y Administradores

Este documento proporciona la especificación técnica exhaustiva sobre la infraestructura, modelo de base de datos PostgreSQL, catálogo de APIs Inbound B2B, webhooks salientes y arquitectura de agentes de Inteligencia Artificial (LUXIA IA).

---

### 1. Topología de Infraestructura y Stack Tecnológico

* **Frontend**: React 19 SPA + Vite + Vanilla CSS / Apple Human Interface Guidelines (Dark Mode Space OLED & Light Mode).
* **Capa de Persistencia**: PostgreSQL 15 administrado mediante **Supabase On-Premise** (\`http://192.168.0.70:8000\`).
* **Autenticación**: Supabase Auth (JWT Stateless con persistencia local en sesión).
* **Motor de Telemetría**: Logger reactivo de auditoría inmutable en tabla \`telemetria_eventos\`.
* **Procesamiento de Lenguaje Natural**: Modelos Gemini 2.5 Flash / Pro con fallback a Anthropic Claude 3.5 Sonnet y OpenAI GPT-4o.

---

### 2. Modelo de Datos Relacional (PostgreSQL)

El esquema central de datos opera sobre las siguientes tablas maestras:

1. **\`usuarios\`**:
   * Identidad del operador (\`id\`, \`email\`, \`nombre\`, \`rol\`, \`equipo\`, \`pais\`, \`activo\`, \`last_active_at\`).
2. **\`leads\`**:
   * Prospectos agropecuarios (\`id\`, \`nombre_empresa\`, \`cuit\`, \`contacto_nombre\`, \`email\`, \`telefono\`, \`pais\`, \`provincia\`, \`localidad\`, \`superficie_has\`, \`cultivo_principal\`, \`estado\`, \`origen\`, \`asignado_a\`, \`score_ia\`, \`calificacion_ia\`, \`custom_fields\`).
3. **\`oportunidades\`**:
   * Negociaciones del pipeline fitosanitario (\`id\`, \`titulo\`, \`cliente_id\`, \`lead_id\`, \`etapa\`, \`monto\`, \`moneda\`, \`probabilidad\`, \`modalidad_pago\`, \`volumen_has\`, \`linea_fitosanitaria\`, \`fecha_cierre_estimada\`, \`comercial_email\`, \`pais\`).
4. **\`clientes\`**:
   * Cuentas y productores consolidados (\`id\`, \`nombre_empresa\`, \`cuit\`, \`tipo_cuenta\`, \`superficie_has\`, \`cultivos\`, \`pais\`, \`estado\`, \`tier\`, \`health_score\`, \`health_riesgo\`, \`comercial_email\`, \`custom_fields\`).
5. **\`contratos\`**:
   * Acuerdos de provisión y Canje Cereal (\`id\`, \`cliente_id\`, \`numero_contrato\`, \`monto\`, \`moneda\`, \`estado\`, \`modalidad_pago\`, \`fecha_inicio\`, \`fecha_fin\`, \`riesgo_legal\`, \`comercial_email\`).
6. **\`config_general\`**:
   * Parametrización central (\`id\` [PK TEXT], \`datos\` [JSONB]). Almacena manuales, calibración de IA, workflows y reglas de negocio.
7. **\`dynamic_fields_catalog\` & \`dynamic_sections_catalog\`**:
   * Catálogo de metadatos dinámicos por entidad para extensibilidad de esquemas.

---

### 3. Matriz de Gobernanza y Control de Acceso (RBAC)

El sistema define 6 roles estrictos:

| Rol | Código | Nivel de Privilegios | Data Scope Típico |
| :--- | :--- | :--- | :--- |
| **SuperAdmin** | \`superadmin\` | Acceso irrestricto, prompts LUXIA IA, seguridad y telemetría. | \`ALL\` (Global) |
| **Administrador** | \`admin\` | Gestión de catálogo fitosanitario, integraciones y usuarios. | \`ALL\` (Global) |
| **Supervisor Comercial** | \`supervisor\` | Gestión de equipo de ventas, asignación de leads y aprobación. | \`TEAM\` (Equipo Regional) |
| **Asesor Técnico Comercial** | \`agente\` | Gestión operativa a campo de leads, oportunidades y cuentas asignadas. | \`OWN\` (Asignado) |
| **Editor Operativo** | \`editor\` | Carga técnica de contratos, remitos y tareas de onboarding. | \`ALL\` o \`TEAM\` |
| **Lector / Auditor** | \`lector\` | Visualización de reportes e indicadores en modo solo lectura. | \`ALL\` (Lectura) |

---

### 4. Catálogo Oficial de APIs Inbound B2B

Todas las solicitudes autenticadas requieren el encabezado:
\`Authorization: Bearer <API_KEY_OR_JWT>\`
\`Content-Type: application/json\`

#### 4.1 Ingesta Pública de Prospectos Web
* **Endpoint**: \`POST /public/web-to-lead\`
* **Acceso**: Público (Rate-limited por IP)
* **Payload de Ejemplo**:
\`\`\`json
{
  "nombreEmpresa": "Establecimiento La Juanita",
  "cuit": "30-71234567-8",
  "contactoNombre": "Ing. Martín Gómez",
  "email": "mgomez@lajuanita.com.ar",
  "telefono": "+54 9 351 555-1234",
  "pais": "AR",
  "provincia": "Córdoba",
  "superficieHas": 3200,
  "cultivoPrincipal": "Soja",
  "origen": "web_campana_fitosanitarios"
}
\`\`\`

#### 4.2 Ingesta de Leads Calificados (Agtech & Ferias)
* **Endpoint**: \`POST /v1/leads\`
* **Acceso**: Autenticado (\`Bearer API_KEY\`)
* **Retorno**: \`201 Created\` con ID del Lead y evaluación inmediata de LUXIA IA.

#### 4.3 Carga Masiva por Lotes
* **Endpoint**: \`POST /v1/leads/bulk\`
* **Payload**: \`{ "leads": [ ... ] }\` (Hasta 500 registros por lote).

#### 4.4 Sincronización ERP de Cuentas y Productores
* **Endpoint**: \`POST /v1/clientes\`
* **Uso**: Upsert automático contra sistemas ERP (SAP, Tango, Bejerman, Finnegans).

#### 4.5 Ingesta de Health Score Crediticio y Canje
* **Endpoint**: \`POST /v1/clientes/health-score\`
* **Payload**: \`{ "clienteId": "CLI-104", "score": 88, "riesgo": "Green", "moraDias": 0, "disputaCanje": false }\`

#### 4.6 Registro de Contratos Fitosanitarios
* **Endpoint**: \`POST /v1/contratos\`
* **Campos clave**: \`numeroContrato\`, \`modalidadPago\` (*canje_cereal, dolar_link*), \`monto\`, \`volumenHas\`.

#### 4.7 Notificación de Despacho y Remito a Campo
* **Endpoint**: \`POST /v1/despachos/notificacion\`
* **Payload**: \`{ "clienteId": "...", "remitoNumero": "R-0001-00045123", "productos": [ { "sku": "HERB-GLIFO-II", "litros": 2000 } ], "estadoEntrega": "entregado_a_campo" }\`

---

### 5. Webhooks Outbound (Eventos en Tiempo Real)

El sistema despacha payloads firmados criptográficamente (\`X-Luxia-Signature\`) ante los siguientes eventos:
* \`lead.created\` / \`lead.qualified\`
* \`opportunity.stage_changed\` / \`opportunity.won\`
* \`contract.signed\` / \`contract.expiring_soon\`
* \`client.health_critical\`
* \`despacho.notificacion\`
`;
