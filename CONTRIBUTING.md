# Guía de Contribución y Flujo de Trabajo (Workflow)

Este documento detalla el ciclo de vida del desarrollo de software para **CRM-Luxia Enterprise**. Sigue estrictamente este proceso para asegurar la estabilidad, mantenibilidad y calidad del código en los entornos de Desarrollo y Producción.

---

## 1. Entorno de Desarrollo Local

Para levantar el entorno completo en tu máquina local:

1. **Configuración de Variables de Entorno**:
   Copia el archivo de ejemplo o edita `.env.local` en la raíz del proyecto:
   ```env
   # Frontend (Vite)
   VITE_SUPABASE_URL=http://192.168.0.70:8000
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   VITE_API_URL=http://localhost:4000/api

   # Backend (Express Worker)
   PORT=4000
   SUPABASE_URL=http://192.168.0.70:8000
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   GEMINI_API_KEY=tu_gemini_api_key
   ```

2. **Iniciar el Frontend**:
   ```bash
   npm install
   npm run dev
   # El frontend estará disponible en http://localhost:5173
   ```

3. **Iniciar el Backend Worker**:
   ```bash
   cd server
   npm install
   npm start
   # El backend estará corriendo en http://localhost:4000
   ```

---

## 2. Flujo de Trabajo en Git (Git Flow)

Seguimos un modelo de ramas orientado a la integración continua:

1. **Rama `main`**: Es la rama principal de producción. Refleja el código estable desplegado. No se permiten *commits* directos a `main`.
2. **Rama `development`**: Refleja el estado de desarrollo integrado.
3. **Ramas de Características (`feature/*` o `fix/*`)**:
   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/nombre-de-la-tarea
   ```

---

## 3. Validación y Control de Calidad Previo a PR

Antes de enviar cualquier cambio para revisión:

1. **Linter & Formateo**:
   ```bash
   npm run lint
   ```
2. **Compilación de Producción (Build Validation)**:
   ```bash
   npm run build
   ```
   *El comando debe finalizar con código 0 y sin errores de empaquetado.*

3. **Creación del Pull Request**:
   - Crea un Pull Request desde tu rama hacia `development`.
   - Incluye una descripción clara de las mejoras introducidas y los pasos para su validación manual.
   - Una vez revisado y aprobado por el equipo, se realiza la fusión (*merge*) a `development`.

---

## 4. Lineamientos de Estilo y Buenas Prácticas

- **Diseño Visual**: Todo nuevo componente visual debe consumir las variables CSS de **Apple HIG** definidas en `src/index.css` (ej. `--apple-surface`, `--apple-text-primary`, `--apple-border`, etc.) para asegurar perfecta armonía en Modo Claro y Modo Oscuro.
- **Seguridad**: Nunca incluyas claves privadas, contraseñas o tokens en el código fuente. Toda comunicación privilegiada con la base de datos debe pasar por `server/` o validarse mediante políticas RLS en PostgreSQL.
- **Links de Archivos**: Al documentar en markdown, utiliza siempre enlaces clickeables relativos o con esquema estándar.
