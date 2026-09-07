/**
 * Utilidades compartidas para CRM-Luxia Enterprise
 */

/**
 * Normaliza nombres de equipos comerciales eliminando tildes, espacios y convirtiendo a minúsculas.
 * Ej: "Adquisición" -> "adquisicion", "Retención" -> "retencion"
 * @param {string} teamStr
 * @returns {string}
 */
export function normalizarEquipo(teamStr) {
  if (!teamStr || typeof teamStr !== 'string') return '';
  return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Formatea valores numéricos a moneda
 */
export function formatCurrency(val, currency = 'USD') {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(num);
}
