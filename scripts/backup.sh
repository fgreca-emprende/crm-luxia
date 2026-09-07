#!/bin/bash
# ==============================================================================
# CRM-LUXIA ENTERPRISE — AUTOMATED POSTGRESQL BACKUP SCRIPT
# Ejecución recomendada vía cron: 0 2 * * * /ruta/crm-luxia/scripts/backup.sh
# ==============================================================================
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_PATH:-/var/backups/crm-luxia}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
CONTAINER_NAME="${DB_CONTAINER:-crm-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Iniciando dump de base de datos CRM-Luxia desde contenedor $CONTAINER_NAME..."

if command -v docker &> /dev/null; then
  docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -Fc \
    --no-password \
    "$DB_NAME" > "$BACKUP_DIR/crm_luxia_$TIMESTAMP.dump"
  echo "[$(date -Iseconds)] Dump creado con éxito: $BACKUP_DIR/crm_luxia_$TIMESTAMP.dump"
elif command -v pg_dump &> /dev/null; then
  pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$BACKUP_DIR/crm_luxia_$TIMESTAMP.dump"
  echo "[$(date -Iseconds)] Dump local creado: $BACKUP_DIR/crm_luxia_$TIMESTAMP.dump"
else
  echo "[ERROR] Ni docker ni pg_dump están disponibles en el PATH del sistema." >&2
  exit 1
fi

# Purgar copias de seguridad que excedan los días de retención
echo "[$(date -Iseconds)] Purgando backups anteriores a $RETENTION_DAYS días..."
find "$BACKUP_DIR" -name "crm_luxia_*.dump" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -Iseconds)] Proceso de backup finalizado exitosamente."
