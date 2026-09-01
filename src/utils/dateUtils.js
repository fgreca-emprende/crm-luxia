/**
 * dateUtils.js
 * Utilidades para formatear fechas y timestamps de forma segura y consistente.
 */

export function formatDateTime(val) {
  if (!val) return 'N/D';
  let date;
  if (val.toDate && typeof val.toDate === 'function') {
    date = val.toDate();
  } else {
    date = new Date(val);
  }
  if (isNaN(date.getTime())) return 'N/D';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
