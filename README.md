# CRM Enterprise Luxia

Sistema de Gestión de Clientes, Pipeline Comercial, Operaciones y Mesa de Ayuda (CX) de nivel empresarial, equipado con Inteligencia Artificial analítica (**Sentinel IA**) y una experiencia de usuario de alta gama (**Apple Command SuperBar**).

---

## 1. Arquitectura del Sistema

- **Frontend:** Single Page Application (SPA) construida en **React 19**, **Vite**, Vanilla CSS y Sistema de Diseño **Liquid Glass (Apple HIG)**.
- **Backend & Worker:** API REST y ejecutor de tareas asíncronas / cron jobs en **Node.js + Express** (Ubicado en `server/`).
- **Base de Datos & Auth:** **PostgreSQL en Supabase** con seguridad declarativa mediante **Row-Level Security (RLS)** y autenticación JWT.
- **Motor de Inteligencia Artificial:** **Sentinel IA** potenciado por Google Gemini (Health Score predictivo, resúmenes automáticos, auditoría de calidad y copiloto de ventas).

---

## 2. Módulos Principales

1. **📊 Inteligencia (Dashboard & KPIs)**: Métricas en tiempo real de MRR, ARR, conversión, cartera activa y monitor de disponibilidad de agentes.
2. **💼 Comercial**:
   - **Prospección (Leads)**: Captura, calificación territorial y scoring predictivo.
   - **Pipeline de Ventas (CLM)**: Negociaciones por etapas, contratos y proyecciones de cierre.
3. **⚡ Operaciones**:
   - **Gestión de Clientes (Ficha 360°)**: Historial completo, SLA, bitácoras, contactos y contratos vigentes.
   - **Tablero CRM (Kanban)**: Gestión de actividades, onboarding y cuentas clave.
4. **🎧 Soporte & CX**: Bandeja omnicanal de tickets con notas privadas (*whisper notes*), SLA y encuestas CSAT.
5. **🔔 Alertas de Riesgo**: Detección temprana de churn, mora y degradación de servicio.
6. **⚙️ Centro de Control (Admin)**: Configuración de permisos RBAC, catálogo de servicios, modelos de IA, prompts de Sentinel y observabilidad del sistema.

---

## 3. Guía de Puesta en Marcha Local

### Prerrequisitos
- **Node.js**: v18+ o v20+
- **Instancia de Supabase**: Local o en red local (`http://192.168.0.70:8000`)

### Paso 1: Configurar Variables de Entorno
Crea o edita el archivo `.env.local` en la raíz del proyecto:

```env
# Frontend (Vite)
VITE_SUPABASE_URL=http://192.168.0.70:8000
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
VITE_API_URL=http://localhost:4000/api

# Backend Worker (Express)
PORT=4000
SUPABASE_URL=http://192.168.0.70:8000
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
GEMINI_API_KEY=tu_gemini_api_key_aqui
```

### Paso 2: Instalar Dependencias y Levantar la Aplicación

```bash
# 1. Instalar dependencias del Frontend
npm install

# 2. Iniciar el Frontend en modo desarrollo (Vite)
npm run dev
# -> Disponible en http://localhost:5173

# 3. En otra terminal, iniciar el Backend Worker
cd server
npm install
npm start
# -> Backend corriendo en http://localhost:4000
```

---

## 4. Scripts de Desarrollo y Compilación

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo local con Hot Module Replacement (HMR). |
| `npm run build` | Compila y optimiza el frontend para producción en la carpeta `dist/`. |
| `npm run preview` | Previsualiza localmente el paquete compilado de producción. |
| `npm run lint` | Ejecuta el linter ESLint para validar calidad y estilo de código. |

---

## 5. Seguridad y Gobernanza de Datos
- **Row-Level Security (RLS)**: Cada consulta a la base de datos está protegida por políticas estrictas en PostgreSQL basadas en el rol del usuario autenticado.
- **Cero Secretos en Cliente**: Las claves de servicio privilegiadas (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) residen exclusivamente en el entorno del Backend Worker (`server/`).

---

## 6. Documentación del Sistema

- 🎨 **[Guía de Estilo y Sistema de Diseño (STYLE_GUIDE.md)](file:///e:/crm-luxia/STYLE_GUIDE.md)**: Especificación de la paleta oficial de Apple macOS Sequoia & iOS 18, materiales Liquid Glass, tokens CSS, componentes y reglas visuales.
- 🏛️ **[Arquitectura y Principios del Sistema (ARCHITECTURE.md)](file:///e:/crm-luxia/ARCHITECTURE.md)**: Estructura técnica, diagrama de datos, Backend Worker y Sentinel IA.
- 🗄️ **[Diseño de Base de Datos PostgreSQL (docs/SCHEMA.md)](file:///e:/crm-luxia/docs/SCHEMA.md)**: Esquema de tablas relacionales en Supabase y políticas RLS.
- 🔒 **[Gobernanza de Secretos (docs/README_SECRETS.md)](file:///e:/crm-luxia/docs/README_SECRETS.md)**: Gestión de credenciales seguras en producción.
- 🤝 **[Guía de Contribución (CONTRIBUTING.md)](file:///e:/crm-luxia/CONTRIBUTING.md)**: Flujo de trabajo en Git y validación previa a PRs.

