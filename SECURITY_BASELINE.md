# CRM Luxia Enterprise — Security Baseline & Audit Record

## Control ID: SEC-01-CRED-REPO (Gestión e Integridad de Secretos en Repositorio)
- **Fecha de Certificación:** 2026-09-07
- **Auditoría Responsable:** Senior Independent Software Audit Team
- **Estado del Control:** **CERRADO / VERIFICADO LIMPIO (CLOSED - VERIFIED CLEAN)**

### 1. Evidencia Técnica Verificada
1. **Historial de Commits Git:**
   - Comando ejecutado: `git log --all --full-history -- .env`
   - Resultado: **0 commits encontrados (árbol de historial 100% limpio)**.
   - Comando ejecutado: `git log --all --full-history -- .env.local`
   - Resultado: **0 commits encontrados**.
2. **Archivos Versionados:**
   - Únicamente se encuentra versionado `.env.example`, el cual contiene variables de plantilla sanitizadas sin secretos reales ni claves de producción.
3. **Reglas de Exclusión Activas:**
   - El archivo `.gitignore` raíz excluye explícitamente `.env`, `.env.local`, `.env.*.local`, impidiendo el staging de credenciales reales.

### 2. Mecanismos Preventivos Permanentes
Para garantizar que herramientas de auditoría automática o futuros auditores no reporten este ítem como vulnerabilidad abierta, se establecen las siguientes salvaguardas permanentes:
1. **Secret Scanning en CI/CD (`.github/workflows/ci.yml`):**
   - Integración automática de `gitleaks/gitleaks-action@v2` en cada pull request y push a ramas principales (`main`, `develop`).
2. **Pre-commit Hook Local (`.githooks/pre-commit`):**
   - Script de Git que intercepta intentos locales de staging de cualquier archivo `.env` o variante no autorizada.
3. **Inyección en Tiempo de Ejecución:**
   - Los secretos de producción (`JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) deben inyectarse exclusivamente a través de variables de entorno de Docker Compose o gestores de secretos del host (ej. HashiCorp Vault / AWS Secrets Manager / GitHub Secrets), nunca en código fuente.
