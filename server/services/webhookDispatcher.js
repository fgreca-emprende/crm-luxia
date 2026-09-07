/**
 * Servicio de Despacho de Webhooks Salientes con firma criptográfica HMAC-SHA256
 * Conecta las suscripciones de config_general.webhook_subscriptions con endpoints de terceros
 */

const crypto = require('crypto');

/**
 * Despacha un evento a todas las suscripciones activas registradas
 * @param {object} params
 * @param {string} params.eventType - Tipo de evento (ej. 'cliente.created', 'lead.created')
 * @param {object} params.payload - Datos del evento a enviar
 * @param {object} params.supabase - Cliente Supabase Admin
 */
async function dispatchWebhookEvent({ eventType, payload, supabase }) {
  try {
    // 1. Obtener las suscripciones activas desde config_general
    const { data: configDoc, error } = await supabase
      .from('config_general')
      .select('valor')
      .eq('id', 'webhook_subscriptions')
      .maybeSingle();

    if (error || !configDoc || !Array.isArray(configDoc.valor)) {
      return;
    }

    const matchingSubs = configDoc.valor.filter(sub => 
      sub.active === true &&
      Array.isArray(sub.events) &&
      (sub.events.includes(eventType) || sub.events.includes('*'))
    );

    if (matchingSubs.length === 0) return;

    const eventEnvelope = {
      id: `evt_${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload
    };

    const serializedPayload = JSON.stringify(eventEnvelope);

    // 2. Enviar peticiones HTTP a cada suscriptor de forma asíncrona
    matchingSubs.forEach(async (sub) => {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'Luxia-Webhook-Dispatcher/1.0',
          'X-Luxia-Event': eventType
        };

        // Generar firma HMAC-SHA256 si la suscripción tiene secreto
        if (sub.secret) {
          const hmac = crypto.createHmac('sha256', sub.secret);
          hmac.update(serializedPayload);
          headers['X-Luxia-Signature'] = `sha256=${hmac.digest('hex')}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(sub.url, {
          method: 'POST',
          headers,
          body: serializedPayload,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[Webhook Dispatcher] Suscripción ${sub.id} respondió con HTTP ${response.status} para evento ${eventType}`);
        }
      } catch (dispErr) {
        console.error(`[Webhook Dispatcher Error] Error enviando a ${sub.url}:`, dispErr.message);
      }
    });
  } catch (err) {
    console.error('[Webhook Dispatcher Critical Error]', err);
  }
}

module.exports = {
  dispatchWebhookEvent
};
