/**
 * SEC-009: Centralized error handling utility.
 * Converts technical Supabase/PostgreSQL/system errors into safe, user-friendly messages
 * without exposing internal database structure or table names.
 */

const SYSTEM_ERROR_MESSAGES = {
  // Auth & Session
  'invalid_grant':              'Credenciales inválidas o expiradas.',
  'user_not_found':            'Usuario no encontrado.',
  'invalid_password':          'Contraseña incorrecta.',
  'too_many_requests':         'Demasiados intentos. Espera unos minutos.',
  'network_error':             'Sin conexión a internet. Verifica tu red.',
  'JWT expired':               'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',

  // PostgreSQL / Database errors
  '42501':                     'No tienes permisos para realizar esta acción (RLS).',
  '23505':                     'Este registro ya existe (duplicado).',
  '23503':                     'No se puede completar la operación por registros dependientes.',
  'PGRST116':                  'No se encontró el registro solicitado.',
  'PGRST301':                  'Sesión expirada o token no válido.',
  'permission-denied':         'No tienes permisos para realizar esta acción.',
  'not-found':                 'El recurso solicitado no existe.',
  'unavailable':               'Servicio de base de datos no disponible.',
  'Failed to fetch':           'Error de conexión con el servidor. Revisa tu red.',

  // Storage
  'storage/unauthorized':      'No tienes permisos para acceder a este archivo.',
  'storage/object-not-found':  'El archivo no existe.',
  'storage/quota-exceeded':    'Límite de almacenamiento alcanzado.',
};

/**
 * Extracts a safe, user-friendly error message from a Database/JS error.
 * @param {Error|Object} error - The caught error object
 * @param {string} context - A label for the console log
 * @returns {string} A safe, user-friendly message in Spanish
 */
export function getErrorMessage(error, context = 'App') {
  console.error(`[${context}] Error técnico:`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });

  if (!error) return 'Ocurrió un error inesperado.';

  const code = error.code || error.message;
  if (code && SYSTEM_ERROR_MESSAGES[code]) {
    return SYSTEM_ERROR_MESSAGES[code];
  }

  if (error.message) {
    for (const [key, msg] of Object.entries(SYSTEM_ERROR_MESSAGES)) {
      if (error.message.includes(key)) {
        return msg;
      }
    }
  }

  return 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.';
}

export const getFirebaseErrorMessage = getErrorMessage;

