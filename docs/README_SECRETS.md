# Gobernanza y Gestión de Secretos en Producción (DevSecOps)

Este documento detalla las directivas obligatorias para gestionar las credenciales y claves de acceso en el entorno **CRM-Luxia Enterprise**, asegurando que ningún secreto sea expuesto en el repositorio Git.

---

## 1. Clasificación de Variables y Niveles de Exposición

### A. Variables Públicas del Frontend (Vite)
Estas variables se compilan e incrustan en el bundle del cliente. **Nunca deben contener claves maestras o administrativas**:
*   `VITE_SUPABASE_URL`: URL del endpoint público de Supabase (ej. `http://192.168.0.70:8000`).
*   `VITE_SUPABASE_ANON_KEY`: Llave pública anónima de Supabase. Solo permite operaciones que cumplan con las políticas de Row-Level Security (RLS).
*   `VITE_API_URL`: URL base del Backend Worker (ej. `http://localhost:4000/api`).

### B. Secretos Críticos del Backend Worker (`server/`)
Estas variables otorgan control administrativo total y **residen exclusivamente en el servidor**:
*   `SUPABASE_SERVICE_ROLE_KEY`: Clave administrativa de Supabase que bypasséa RLS para tareas de mantenimiento y cron jobs.
*   `GEMINI_API_KEY`: Clave de acceso a la API de Google Gemini para las funciones de Luxia IA.
*   `DATABASE_URL`: Cadena de conexión directa a PostgreSQL (puerto 5432).
*   `WHATSAPP_API_TOKEN` & `SLACK_BOT_TOKEN`: Credenciales para integraciones con canales de comunicación.

---

## 2. Directivas de Seguridad

1. **Protección en `.gitignore`**:
   Los archivos `.env`, `.env.local`, `.env.production` y cualquier archivo `.json` de credenciales están estrictamente ignorados por el control de versiones.
2. **Inyección en Servidores de Producción / CI/CD**:
   En entornos productivos (Docker, VPS o Kubernetes), las variables deben inyectarse mediante variables de entorno del sistema o administradores de secretos (ej. Vault, Docker Secrets o GitHub Actions Secrets).
3. **Rotación Periódica**:
   Las API Keys de terceros (`x-api-key`) y los tokens de proveedores (Gemini, WhatsApp) deben rotarse periódicamente desde la consola administrativa ([ApiKeysConsole.jsx](file:///e:/crm-luxia/src/components/features/integrations/components/ApiKeysConsole.jsx)).
