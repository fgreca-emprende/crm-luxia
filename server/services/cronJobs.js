const cron = require('node-cron');

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
      console.error('[CRON] Error verificando contratos:', err);
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
      console.error('[CRON] Error procesando buffers de WhatsApp:', err);
    }
  });

  console.log('[CRON] Tareas programadas activas.');
}

module.exports = {
  initCronJobs
};
