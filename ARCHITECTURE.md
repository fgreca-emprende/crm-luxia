# Arquitectura y Principios del Sistema CRM-Luxia Enterprise

Este documento establece la "fuente de la verdad" técnica y funcional para la arquitectura, los patrones de diseño y los principios fundamentales que rigen el ecosistema **CRM-Luxia Enterprise** (con motor de inteligencia analítica **Luxia IA** y base de datos relacional **PostgreSQL en Supabase**).

---

## 1. Principios Fundamentales (Core Concepts)

### 1.1 Hyper-Premium Design & Apple Command SuperBar (UX/UI)
La interfaz de usuario sigue los lineamientos de diseño de alta gama de **Apple Human Interface Guidelines (macOS Sequoia & iOS 18)**:
- **Apple Command SuperBar:** Reubicación de la navegación global hacia una barra superior acrílica flotante (`.apple-superbar`) con `backdrop-filter: blur(36px) saturate(210%)`, píldoras segmentadas para los módulos de negocio y menús desplegables translúcidos.
- **Liberación del 100% del Ancho de Pantalla:** Eliminación del sidebar lateral izquierdo fijo de 270px para brindar máxima holgura horizontal a las tablas de datos, tableros Kanban y a la consola multicanal CX.
- **Temas Dinámicos:** Soporte nativo para modo Claro (cerámico `#f5f5f7`) y modo Oscuro (*Deep OLED `#09090b`*) gestionados por variables CSS en `src/index.css`.
- **Micro-interacciones Fluidas:** Curvas de aceleración tipo resorte Apple (`cubic-bezier(0.16, 1, 0.3, 1)`), baliza pulsante de presencia y transiciones visuales instantáneas.
- **Navegación Móvil Adaptativa:** Menú tipo *Sheet* deslizable con desenfoque de fondo para dispositivos móviles y tablets.

### 1.2 IA-First (Luxia IA Integrado)
Luxia IA es el motor de inteligencia analítica y operativa del CRM:
- **Modelos Multimodales:** Potenciado por Google Gemini (`gemini-3.5-flash`, `gemini-3.6-flash`, etc.) configurados y versionados dinámicamente en la tabla `config_ia_modelos`.
- **Agentes Especializados:** Evaluación predictiva de Health Score, transcripción y análisis de llamadas Meet, copiloto conversacional, auditoría de tickets CX, generador de resúmenes y exámenes de capacitación.
- **Resiliencia y Degradación Graciosa:** Cada agente puede pausarse o reactivarse de forma granular desde la interfaz administrativa (`AdminIaModelsManager.jsx`).
- **Límites de Presupuesto y Safeguards:** Detección de cuotas y modo manual preventivo (`luxiaPausado`).

### 1.3 Arquitectura de Datos Relacional (PostgreSQL en Supabase)
Toda la persistencia de datos opera sobre **PostgreSQL**:
- **Consistencia y Relaciones:** Tablas normalizadas con claves primarias (`UUID` / `BIGSERIAL`), claves foráneas (`REFERENCES`), índices B-Tree/GIN y disparadores automáticos (`triggers`).
- **Campos Dinámicos con JSONB:** Flexibilidad para campos personalizados por cliente mediante columnas de tipo `jsonb` (`campos_dinamicos`), permitiendo indexación y consultas directas sin alterar el esquema relacional.
- **Paginación Eficiente en Servidor:** Las tablas de alto volumen (Leads, Clientes, Auditoría) utilizan paginación mediante `LIMIT` y `OFFSET` (o cursores por ID/timestamp) con hooks especializados como `useClientesPaginados` y `useLeadsPaginados`.

### 1.4 Seguridad Declarativa (Zero-Trust & RLS)
- **Row-Level Security (RLS):** La seguridad no recae en filtros del frontend. PostgreSQL valida cada sentencia SQL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) en función del JWT y el rol del usuario autenticado (`auth.uid()`, `usuarios.rol`).
- **Scopes Territoriales y de Equipo:** Matriz de permisos declarativa (`ALL`, `TEAM`, `OWN`) en `config_permisos` para restringir el acceso a leads, oportunidades y clientes según el equipo asignado.
- **Cero Secretos Expuestos:** El frontend solo maneja la `ANON_KEY` pública de Supabase. La `SERVICE_ROLE_KEY` administrativa y las credenciales de Gemini residen exclusivamente en el Backend Worker (`server/`).

### 1.5 Backend Worker & Ejecutor Asíncrono (`server/`)
- Servidor dedicado en **Node.js + Express**:
  - **Endpoints API REST (`/api/v1`)**: Autenticación mediante cabecera `x-api-key` y control de cuotas para integraciones externas.
  - **Crons y Sincronización en Segundo Plano**: Cálculo periódico de métricas, análisis de retención, health scores, alertas de SLA y telemetría del sistema.
  - **Webhooks Entrantes y Salientes**: Recepción de eventos de WhatsApp y despacho de notificaciones a Slack/endpoints de terceros con firmas criptográficas HMAC.

---

## 2. Diagrama de Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React 19 + Vite)                                 │
│  [ Apple Command SuperBar: Inteligencia | Comercial ▾ | Operaciones ▾ | CX | Alertas ]  │
└───────────────────────────┬─────────────────────────────────┬───────────────────────────┘
                            │ (Supabase Client / JWT)         │ (HTTP REST / API Keys)
                            ▼                                 ▼
┌──────────────────────────────────────────────┐   ┌──────────────────────────────────────┐
│        SUPABASE (PostgreSQL + RLS)           │   │    BACKEND WORKER (Node.js/Express)  │
│  - Tablas: clientes, leads, oportunidades,   │◀──┤  - Cron Jobs & Sincronizaciones      │
│    contratos, actividades, usuarios, etc.     │   │  - Invocaciones a Google Gemini      │
│  - Políticas RLS por Rol y Equipo            │   │  - Webhooks WhatsApp / Slack         │
│  - Supabase Auth (JWT & Sesiones)            │   │  - API Gateway Inbound / Outbound    │
└──────────────────────────────────────────────┘   └──────────────────┬───────────────────┘
                                                                      │ (AI Prompts & RAG)
                                                                      ▼
                                                   ┌──────────────────────────────────────┐
                                                   │        GOOGLE GEMINI (Luxia IA)      │
                                                   └──────────────────────────────────────┘
```

---

## 3. Estructura del Código Fuente

```
crm-luxia/
├── docs/                       # Esquema de base de datos y documentación técnica
├── server/                     # Backend Worker en Node.js / Express
│   ├── routes/                 # Rutas API (callables, integraciones, salud)
│   ├── services/               # Servicios de crons, IA y sincronización
│   └── index.js                # Servidor HTTP principal
├── src/                        # Código fuente del Frontend (SPA)
│   ├── components/
│   │   ├── features/           # Vistas funcionales (Dashboard, Leads, Clientes, CX, etc.)
│   │   │   ├── admin/          # Centro de Control Administrativo (Permisos, IA, etc.)
│   │   │   ├── capacitacion/   # Módulo de Auto Capacitación con Luxia Exam
│   │   │   ├── contratos/      # Gestión y ciclo de vida de contratos
│   │   │   ├── cx/             # Componentes de soporte omnicanal
│   │   │   ├── dashboard/      # Paneles y widgets de analítica
│   │   │   └── integrations/   # Consola de API Keys y Webhooks
│   │   └── ui/                 # Componentes base (Toasts, Spinners, Error Boundaries)
│   ├── contexts/               # Contextos globales (UserRoleContext)
│   ├── hooks/                  # Hooks personalizados de datos y presencia
│   ├── lib/                    # Clientes de API, Supabase, telemetría y errores
│   ├── utils/                  # Utilidades generales (fechas, formateos)
│   ├── App.jsx                 # Orquestador visual con Apple Command SuperBar
│   ├── index.css               # Sistema de diseño Liquid Glass y tokens visuales
│   └── main.jsx                # Punto de entrada de React 19
├── supabase/
│   ├── migrations/             # Migraciones declarativas SQL
│   └── seed.sql                # Datos iniciales de configuración
├── docker-compose.yml          # Configuración de contenedores
├── package.json                # Dependencias del frontend
└── vite.config.js              # Configuración de compilación Vite
```
