const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { generateSentinelContent } = require('../services/sentinelCore');

/**
 * Middleware para validar API Keys en llamadas a /api/v1/
 */
async function validateApiKey(req, res, next) {
  const apiKey = req.header('x-api-key');
  if (!apiKey) {
    return res.status(401).json({ error: 'API Key requerida en cabecera x-api-key.' });
  }

  const supabase = req.app.get('supabase');
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

  const { data: keyDoc, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('hash', hashedKey)
    .eq('active', true)
    .single();

  if (error || !keyDoc) {
    return res.status(403).json({ error: 'API Key inválida o inactiva.' });
  }

  req.apiContext = keyDoc;
  next();
}

// ============================================================================
// 1. ENDPOINT PÚBLICO WEB-TO-LEAD (Formularios Inbound sin autenticación)
// ============================================================================
router.post('/public/web-to-lead', async (req, res) => {
  const supabase = req.app.get('supabase');
  const { nombreEmpresa, nombreContacto, correo, telefono, pais, camposDinamicos, formId } = req.body;

  if (!nombreEmpresa || !correo) {
    return res.status(400).json({ error: 'nombreEmpresa y correo son obligatorios.' });
  }

  try {
    // 1. Insertar el Lead en PostgreSQL
    const { data: lead, error: insertErr } = await supabase.from('leads').insert({
      nombre_empresa: nombreEmpresa,
      nombre_contacto: nombreContacto || '',
      correo,
      telefono: telefono || '',
      pais: (pais || 'PE').toUpperCase(),
      origen: 'web_form',
      estado: 'nuevo',
      campos_dinamicos: camposDinamicos || {},
      _trigger_ia: true
    }).select().single();

    if (insertErr) throw insertErr;

    // 2. Ejecutar calificación en segundo plano con Sentinel Lead Scorer
    const prompt = `Analiza este nuevo lead inbound para Luxia:
Empresa: ${nombreEmpresa}
Contacto: ${nombreContacto} (${correo})
País: ${pais}
Datos adicionales: ${JSON.stringify(camposDinamicos || {})}`;

    generateSentinelContent({
      agenteId: 'sentinel_lead_scorer',
      prompt,
      userEmail: 'Web Inbound Form',
      contextInfo: { leadId: lead.id },
      supabase
    }).then(async (aiRes) => {
      if (aiRes.success && aiRes.data) {
        await supabase.from('leads').update({
          score_calculado: aiRes.data.score || 70,
          calificacion_ia: aiRes.data
        }).eq('id', lead.id);
      }
    }).catch(err => console.error('[Web-to-Lead IA Error]', err));

    return res.status(201).json({
      success: true,
      message: 'Prospecto recibido y encolado para calificación.',
      leadId: lead.id
    });
  } catch (err) {
    console.error('[Web-to-Lead Error]', err);
    return res.status(500).json({ error: 'Error interno procesando el formulario.' });
  }
});

// ============================================================================
// 2. ENDPOINT PROTEGIDO DE INGESTA /v1/leads (API Externa para clientes/partners)
// ============================================================================
router.post('/v1/leads', validateApiKey, async (req, res) => {
  const supabase = req.app.get('supabase');
  const payload = req.body;

  if (!payload.nombreEmpresa || !payload.correo) {
    return res.status(400).json({ error: 'Campos nombreEmpresa y correo son obligatorios.' });
  }

  const { data: lead, error } = await supabase.from('leads').insert({
    nombre_empresa: payload.nombreEmpresa,
    nombre_contacto: payload.nombreContacto || '',
    correo: payload.correo,
    telefono: payload.telefono || '',
    pais: (payload.pais || 'PE').toUpperCase(),
    industria: payload.industria || null,
    origen: 'api_gateway',
    estado: 'nuevo',
    campos_dinamicos: payload.camposDinamicos || {}
  }).select().single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ success: true, lead });
});

module.exports = router;
