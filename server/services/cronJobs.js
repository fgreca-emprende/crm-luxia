const cron = require('node-cron');

async function reportCronError(supabase, context, err) {
  console.error(`[CRON ERROR][${context}]`, err);
  try {
    if (supabase) {
      await supabase.from('logs_sistema').insert({
        nivel: 'ERROR',
        accion: `cron_${context}`,
        descripcion: `Fallo en tarea programada: ${err.message || String(err)}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (_) { /* bypass silent logging failure */ }
}

function initCronJobs(supabase) {
  console.log('[CRON] Inicializando tareas programadas locales con node-cron...');

  // 1. Verificación diaria de contratos por vencer o vencidos (cada medianoche)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Ejecutando verificación de vencimientos de contratos...');
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const en30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Contratos próximos a vencer (< 30 días)
      const { data: porVencer } = await supabase
        .from('contratos')
        .select('id, cliente_id, fecha_vencimiento, monto, moneda')
        .eq('es_contrato_vigente', true)
        .gte('fecha_vencimiento', hoy)
        .lte('fecha_vencimiento', en30Dias);

      if (porVencer && porVencer.length > 0) {
        for (const c of porVencer) {
          await supabase.from('alertas').upsert({
            id: `CONTRATO_POR_VENCER_${c.id}`,
            cliente_id: c.cliente_id,
            tipo: 'contrato_por_vencer',
            urgency: 'media',
            mensaje: `El contrato regulador (${c.moneda} ${c.monto}) vencerá el ${c.fecha_vencimiento}.`,
            accion_recomendada: 'Iniciar negociación de renovación comercial.',
            leida: false
          });
        }
        console.log(`[CRON] ${porVencer.length} alertas de contratos por vencer generadas.`);
      }
    } catch (err) {
      await reportCronError(supabase, 'contratos_vencimiento', err);
    }
  });

  // 2. Procesamiento de buffers de WhatsApp cada 1 minuto
  cron.schedule('* * * * *', async () => {
    try {
      const nowIso = new Date().toISOString();
      const { data: buffers } = await supabase
        .from('whatsapp_buffer')
        .select('*')
        .eq('status', 'pending')
        .lte('process_after', nowIso);

      if (buffers && buffers.length > 0) {
        console.log(`[CRON] Procesando ${buffers.length} buffers de WhatsApp en batch...`);
        const bufferIds = buffers.map(b => b.id).filter(Boolean);
        const clienteIds = buffers.map(b => b.cliente_id).filter(Boolean);

        if (bufferIds.length > 0) {
          await supabase
            .from('whatsapp_buffer')
            .update({ status: 'completed', updated_at: nowIso })
            .in('id', bufferIds);
        } else if (clienteIds.length > 0) {
          await supabase
            .from('whatsapp_buffer')
            .update({ status: 'completed', updated_at: nowIso })
            .in('cliente_id', clienteIds);
        }
        console.log(`[CRON] ${buffers.length} buffers de WhatsApp completados en batch.`);
      }
    } catch (err) {
      await reportCronError(supabase, 'whatsapp_buffer', err);
    }
  });

  // 3. [P3-OPS-01 FIX] Purga y retención automática de logs y telemetría (Cada domingo a las 3:00 AM)
  cron.schedule('0 3 * * 0', async () => {
    console.log('[CRON] Ejecutando purga semanal de logs y telemetría histórica...');
    try {
      const { data: res, error } = await supabase.rpc('purgar_logs_historicos', {
        p_dias_retencion: 90
      });

      if (error) {
        await reportCronError(supabase, 'purga_logs_rpc', error);
      } else {
        console.log('[CRON Purga Éxito] Registros purgados:', JSON.stringify(res?.registros_purgados));
      }
    } catch (cronErr) {
      await reportCronError(supabase, 'purga_logs_exception', cronErr);
    }
  });

  console.log('[CRON] Tareas programadas activas.');
}

module.exports = {
  initCronJobs
};

