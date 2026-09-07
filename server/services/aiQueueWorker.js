/**
 * Worker asíncrono para procesamiento persistente de cola de IA (PostgreSQL cola_tareas_ia)
 * Reemplaza tareas en memoria tipo setImmediate para prevenir pérdida de jobs ante reinicios.
 */

const { generateLuxiaContent } = require('./luxiaCore');

let isWorkerRunning = false;

async function processAiQueue(supabase) {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    // 1. Obtener tareas pendientes con límite controlado
    const { data: tareas, error } = await supabase
      .from('cola_tareas_ia')
      .select('*')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error || !tareas || tareas.length === 0) {
      isWorkerRunning = false;
      return;
    }

    for (const tarea of tareas) {
      // Marcar como procesando
      await supabase
        .from('cola_tareas_ia')
        .update({ estado: 'procesando', intentos: (tarea.intentos || 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', tarea.id);

      try {
        const aiRes = await generateLuxiaContent({
          agenteId: tarea.agente_id || 'luxia_lead_scorer',
          prompt: tarea.prompt,
          userEmail: 'Luxia Queue Worker',
          contextInfo: { leadId: tarea.lead_id },
          supabase
        });

        if (aiRes && aiRes.success && aiRes.data) {
          // Si es lead_scorer, actualizar el lead asociado
          if (tarea.lead_id && tarea.agente_id === 'luxia_lead_scorer') {
            await supabase.from('leads').update({
              score_calculado: aiRes.data.score || 70,
              calificacion_ia: aiRes.data,
              updated_at: new Date().toISOString()
            }).eq('id', tarea.lead_id);
          }

          await supabase.from('cola_tareas_ia').update({
            estado: 'completado',
            updated_at: new Date().toISOString()
          }).eq('id', tarea.id);
        } else {
          throw new Error(aiRes?.error || 'Respuesta de IA sin éxito');
        }
      } catch (procErr) {
        console.error(`[AI Queue Worker] Error procesando tarea ${tarea.id}:`, procErr.message);
        const maxIntentos = 3;
        const nuevoEstado = (tarea.intentos + 1) >= maxIntentos ? 'fallido' : 'pendiente';
        await supabase.from('cola_tareas_ia').update({
          estado: nuevoEstado,
          error_log: procErr.message,
          updated_at: new Date().toISOString()
        }).eq('id', tarea.id);
      }
    }
  } catch (err) {
    console.error('[AI Queue Worker] Error en ciclo de procesamiento:', err);
  } finally {
    isWorkerRunning = false;
  }
}

function initAiQueueWorker(supabase, intervalMs = 15000) {
  console.log('[AI Queue Worker] Inicializando monitor de cola_tareas_ia (cada 15s)...');
  setInterval(() => {
    processAiQueue(supabase);
  }, intervalMs);
}

module.exports = {
  initAiQueueWorker,
  processAiQueue
};
