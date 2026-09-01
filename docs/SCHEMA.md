# Esquema de Base de Datos Relacional (PostgreSQL en Supabase)

El sistema **CRM-Luxia Enterprise** utiliza una arquitectura de datos relacional basada en **PostgreSQL**, optimizada con tipos de datos estructurados, extensiones especializadas (`vector`, `pg_trgm`, `pgcrypto`) y flexibilidad de esquemas mediante columnas **JSONB** (`campos_dinamicos`).

---

## 1. Extensiones Habilitadas
- `uuid-ossp` & `pgcrypto`: Generación de claves primarias UUID criptográficamente seguras (`gen_random_uuid()`).
- `pg_trgm`: Búsquedas difusas de texto completo (*Fuzzy search*) con alta velocidad sobre nombres, razones sociales y emails.
- `vector`: Soporte para embeddings vectoriales de 768 / 1536 dimensiones para la base de conocimiento RAG de Sentinel IA.

---

## 2. Tablas Principales del Sistema

### 2.1 `usuarios` (RBAC & Perfiles)
Vinculada con `auth.users` de Supabase para gestión de identidad, permisos y telemetría:
- **`id`** (`UUID PRIMARY KEY`): Referencia a `auth.users(id)`.
- **`email`** (`TEXT UNIQUE NOT NULL`): Correo institucional.
- **`nombre`** (`TEXT`): Nombre completo del operador o ejecutivo.
- **`rol`** (`TEXT NOT NULL`): `superadmin`, `admin`, `supervisor`, `agente`, `agente_cx`, `supervisor_cx`, `editor`, `lector`.
- **`equipo`** (`TEXT NOT NULL DEFAULT 'Global'`): Agrupación comercial/operativa (ej. `Ventas`, `Soporte`, `Finanzas`).
- **`pais`** (`TEXT NOT NULL DEFAULT 'AR'`): País base (`AR`, `CL`, `PE`, `CO`, `MX`).
- **`estado_cx`** (`TEXT DEFAULT 'activo'`): Disponibilidad operativa (`activo`, `break`, `ocupado`, `offline`).
- **`estado_presencia`** (`TEXT DEFAULT 'Conectado'`): Estado de conexión en tiempo real.
- **`capacitacion`** (`JSONB`): Estado y progreso en Sentinel Exam.
- **`gamificacion`** (`JSONB`): Nivel, XP acumulado y medallas.

---

### 2.2 `clientes` (Cartera de Cuentas)
Almacena las empresas activas, su estado en el ciclo de vida y la evaluación predictiva de salud:
- **`id`** (`TEXT PRIMARY KEY`): Identificador único de la cuenta.
- **`nombre_empresa`** (`TEXT NOT NULL`): Razón social o nombre comercial.
- **`cuit_rut_rfc`** (`TEXT`): Identificación tributaria/fiscal.
- **`industria`** (`TEXT`): Segmento vertical de la empresa.
- **`sitio_web`** (`TEXT`): URL corporativa.
- **`tamanio_empresa`** (`TEXT`): Rango de empleados (`1-50`, `51-200`, `201-500`, `500+`).
- **`tier_cuenta`** (`TEXT DEFAULT 'Tier 3'`): `Tier 1` (Estratégico), `Tier 2` (Medio), `Tier 3` (Estándar).
- **`tier_override`** (`BOOLEAN DEFAULT FALSE`): Bloqueo manual del cálculo automático de tier.
- **`parent_company_id`** (`TEXT REFERENCES clientes(id)`): Jerarquía de holdings o matrices.
- **`estado`** (`TEXT NOT NULL DEFAULT 'Ingresado'`): Fase actual (`Onboarding`, `Activo`, `En Riesgo`, `Churn`).
- **`pais`** (`TEXT NOT NULL DEFAULT 'AR'`): Territorio de la cuenta.
- **`comercial_asignado`** (`TEXT`): Email o identificador del Account Executive responsable.
- **`health_score`** (`JSONB`): Score analítico de IA (`{"score": 85, "riesgo": "Green", "analisis": "..."}`).
- **`campos_dinamicos`** (`JSONB`): Diccionario de campos personalizados por la empresa.

---

### 2.3 `contratos` (Ciclo de Vida de Contratos & CLM)
Gestión legal y financiera de los contratos vigentes e históricos asociados a un cliente:
- **`id`** (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`): Identificador único del contrato.
- **`cliente_id`** (`TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE`): Cuenta titular.
- **`oportunidad_id`** (`TEXT`): Negocio u oportunidad de origen.
- **`tipo_servicio`** (`TEXT`): Clave del servicio contratado (`config_servicios`).
- **`fecha_inicio`** (`TIMESTAMPTZ`): Inicio de vigencia.
- **`fecha_vencimiento`** (`TIMESTAMPTZ`): Fin de vigencia.
- **`monto`** (`NUMERIC(15,2)`): Valor monetario del acuerdo.
- **`moneda`** (`TEXT DEFAULT 'USD'`): Divisa (`USD`, `ARS`, `CLP`, `PEN`, `COP`, `MXN`).
- **`frecuencia_facturacion`** (`TEXT`): `mensual`, `trimestral`, `anual`, `prepagado`.
- **`es_contrato_vigente`** (`BOOLEAN DEFAULT TRUE`): Indica si es la versión activa del acuerdo.
- **`version_contrato`** (`INTEGER DEFAULT 1`): Número de renovación/adenda.
- **`estado_sla`** (`TEXT DEFAULT 'Vigente'`): Semáforo de SLA (`Vigente`, `Proximo a Vencer`, `Vencido`).
- **`drive_link`** (`TEXT`): URL al documento digital en la nube.
- **`adjuntos`** (`JSONB DEFAULT '[]'`): Metadatos de archivos adjuntos.

---

### 2.4 `leads` & `oportunidades` (Módulo Comercial)
- **`leads`**: Prospectos comerciales con scoring de IA, origen, territorio (`pais`), estado de contacto y comercial asignado.
- **`oportunidades`**: Pipeline de ventas con etapas configurables (`prospeccion`, `calificacion`, `propuesta`, `negociacion`, `ganada`, `perdida`), montos en divisa local/USD y probabilidad de cierre.

---

### 2.5 `tickets_cx` (Mesa de Ayuda & Atención al Cliente)
- **`id`** (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`): Número de ticket.
- **`cliente_id`** (`TEXT REFERENCES clientes(id)`): Cuenta asociada.
- **`asunto`** (`TEXT NOT NULL`): Título del requerimiento o incidente.
- **`prioridad`** (`TEXT DEFAULT 'media'`): `baja`, `media`, `alta`, `urgente`.
- **`estado`** (`TEXT DEFAULT 'abierto'`): `abierto`, `en_progreso`, `esperando_cliente`, `resuelto`, `cerrado`.
- **`canal`** (`TEXT`): `whatsapp`, `email`, `portal`, `telefono`.
- **`mensajes`** (`JSONB DEFAULT '[]'`): Hilo cronológico de mensajes públicos y notas internas (*whisper notes*).
- **`csat`** (`JSONB`): Calificación y feedback post-atención.

---

### 2.6 `config_*` (Gobernanza y Centro de Control)
- **`config_general`**: Tipos de cambio de divisas, reglas de retención y alertas globales.
- **`config_permisos`**: Matriz de permisos RBAC y scopes de acceso (`ALL`, `TEAM`, `OWN`).
- **`config_servicios`**: Catálogo de productos y líneas de negocio.
- **`config_ia_modelos`** & **`config_ia_prompts`**: Modelos de Gemini autorizados, prompts de Sentinel IA y límites de consumo.
- **`rag_knowledge_base`**: Chunks de conocimiento con embeddings vectoriales para asistencia de IA.
- **`api_keys`**: Credenciales para integraciones externas vía REST API (`x-api-key`).

---

## 3. Seguridad Row-Level Security (RLS)

Cada tabla implementa políticas de RLS automáticas:
1. **Administradores y Superadmins**: Acceso total (`ALL`) de lectura y escritura.
2. **Supervisores y Agentes**: Acceso condicionado por la función `auth.jwt() -> app_metadata -> rol` y pertenencia a `equipo` o asignación directa (`comercial_asignado = auth.email()`).
3. **Lectores**: Acceso restringido únicamente a sentencias `SELECT`.
