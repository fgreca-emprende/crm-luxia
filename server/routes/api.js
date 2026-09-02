const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { generateLuxiaContent } = require('../services/luxiaCore');

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
const { sanitizeUserInput, sanitizeContext } = require('../utils/sanitize');

  const { nombreEmpresa, nombreContacto, correo, telefono, pais, camposDinamicos, formId } = req.body;

  if (!nombreEmpresa || !correo) {
    return res.status(400).json({ error: 'nombreEmpresa y correo son obligatorios.' });
  }

  // [P1-8 FIX] Validar formato de correo electrónico
  const emailClean = String(correo).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailClean)) {
    return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
  }

  // [P1-8 FIX] Sanitizar entradas no confiables
  const safeEmpresa = sanitizeUserInput(nombreEmpresa, 200);
  const safeContacto = sanitizeUserInput(nombreContacto, 200);
  const safeTelefono = sanitizeUserInput(telefono, 50);
  const safePais = sanitizeUserInput(pais || 'PE', 5).toUpperCase();
  const safeContext = sanitizeContext(camposDinamicos, 2000);

  try {
    // 1. Insertar el Lead en PostgreSQL
    const { data: lead, error: insertErr } = await supabase.from('leads').insert({
      nombre_empresa: safeEmpresa,
      nombre_contacto: safeContacto,
      correo: emailClean,
      telefono: safeTelefono,
      pais: safePais,
      origen: 'web_form',
      estado: 'nuevo',
      campos_dinamicos: safeContext,
      _trigger_ia: true
    }).select().single();

    if (insertErr) throw insertErr;

    // 2. Ejecutar calificación en segundo plano con Luxia Lead Scorer de forma segura
    const prompt = `Analiza este nuevo lead inbound para Luxia:
Empresa: ${safeEmpresa}
Contacto: ${safeContacto} (${emailClean})
País: ${safePais}
Datos adicionales: ${JSON.stringify(safeContext)}`;

    setImmediate(async () => {
      try {
        const aiRes = await generateLuxiaContent({
          agenteId: 'luxia_lead_scorer',
          prompt,
          userEmail: 'Web Inbound Form',
          contextInfo: { leadId: lead.id },
          supabase
        });

        if (aiRes && aiRes.success && aiRes.data) {
          const { error: updateErr } = await supabase.from('leads').update({
            score_calculado: aiRes.data.score || 70,
            calificacion_ia: aiRes.data
          }).eq('id', lead.id);

          if (updateErr) {
            console.error(`[Web-to-Lead IA Error] Error actualizando lead ${lead.id}:`, updateErr);
          }
        } else if (aiRes && !aiRes.success) {
          console.warn(`[Web-to-Lead IA Warn] Luxia IA falló para lead ${lead.id}: ${aiRes.error}`);
        }
      } catch (bgErr) {
        console.error(`[Web-to-Lead IA Critical Error] Excepción no controlada en scoring background para lead ${lead.id}:`, bgErr);
      }
    });

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
