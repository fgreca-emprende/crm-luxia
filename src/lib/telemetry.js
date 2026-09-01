import { supabase } from './supabase';

/**
 * Registra de forma asíncrona un evento de telemetría y auditoría operativa en logs_sistema.
 * Cuenta con persistencia directa en PostgreSQL vía Supabase y fallback a localStorage.
 * 
 * @param {object} user - El objeto de usuario autenticado.
 * @param {string} action - La acción clave realizada (ej: 'trigger_ia', 'resolve_alert', 'add_interaction').
 * @param {object} metadata - Información adicional contextual para el reporte.
 */
export async function logSystemEvent(user, action, metadata = {}) {
  if (!user || !user.email) return;

  const eventPayload = {
    usuario_email: user.email,
    accion: action,
    entidad: metadata.entidad || metadata.modulo || null,
    entidad_id: metadata.entidadId || metadata.clienteId || metadata.leadId || null,
    detalles: metadata,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Persistir en la tabla logs_sistema de Supabase
    await supabase.from('logs_sistema').insert(eventPayload);
  } catch (err) {
    console.warn('[Telemetry] Fallback a localStorage por error en Supabase:', err.message);
    try {
      const queue = JSON.parse(localStorage.getItem('telemetry_queue') || '[]');
      queue.push({
        ...eventPayload,
        usuarioNombre: user.user_metadata?.nombre || user.email.split('@')[0]
      });
      localStorage.setItem('telemetry_queue', JSON.stringify(queue.slice(-50)));
    } catch (e) {
      console.warn('[Telemetry] Error guardando en fallback localStorage:', e);
    }
  }
}
