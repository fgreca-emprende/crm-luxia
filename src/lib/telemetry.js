import { supabase } from './supabase';

/**
 * Registra de forma pasiva y asíncrona un evento de telemetría.
 * Diseñado para medir la adopción, el uso de IA y la eficacia operativa.
 * 
 * @param {object} user - El objeto de usuario autenticado.
 * @param {string} action - La acción clave realizada (ej: 'trigger_ia', 'resolve_alert', 'add_interaction').
 * @param {object} metadata - Información adicional contextual para el reporte.
 */
export async function logSystemEvent(user, action, metadata = {}) {
  if (!user || !user.email) return;
  
  try {
    const queue = JSON.parse(localStorage.getItem('telemetry_queue') || '[]');
    queue.push({
      usuarioEmail: user.email,
      usuarioNombre: user.user_metadata?.nombre || user.email.split('@')[0],
      accion: action,
      metadata: metadata,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('telemetry_queue', JSON.stringify(queue.slice(-50)));
  } catch (e) {
    console.warn('[Telemetry] Error guardando log en localStorage:', e);
  }
}
