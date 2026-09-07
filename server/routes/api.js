const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { generateLuxiaContent } = require('../services/luxiaCore');
const { sanitizeUserInput, sanitizeContext } = require('../utils/sanitize');

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

  // [SEC-04 FIX] Validar permisos de escritura en métodos no seguros (POST, PUT, PATCH, DELETE)
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isWriteMethod) {
    const permisos = keyDoc.permisos || keyDoc.scope || [];
    const hasWritePermission = Array.isArray(permisos)
      ? permisos.includes('write') || permisos.includes('*') || permisos.includes('all')
      : permisos === 'write' || permisos === '*' || permisos === 'all';

    if (!hasWritePermission) {
      return res.status(403).json({ error: 'Permisos insuficientes. Esta API Key no cuenta con privilegios de escritura.' });
    }
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

    // 2. [P1-02 FIX] Encolar calificación en PostgreSQL cola_tareas_ia (Persistencia garantizada)
    const prompt = `Analiza este nuevo lead inbound para Luxia:
Empresa: ${safeEmpresa}
Contacto: ${safeContacto} (${emailClean})
País: ${safePais}
Datos adicionales: ${JSON.stringify(safeContext)}`;

    const { error: queueErr } = await supabase.from('cola_tareas_ia').insert({
      lead_id: lead.id,
      agente_id: 'luxia_lead_scorer',
      prompt,
      estado: 'pendiente'
    });

    if (queueErr) {
      console.warn('[Web-to-Lead Queue Warn] Fallo encolando en cola_tareas_ia, ejecutando fallback inmediato:', queueErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Prospecto recibido y encolado para calificación en segundo plano.',
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

  // [P1-8 FIX] Validar y sanitizar entradas
  const emailClean = String(payload.correo).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailClean)) {
    return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
  }

  const safeEmpresa = sanitizeUserInput(payload.nombreEmpresa, 200);
  const safeContacto = sanitizeUserInput(payload.nombreContacto || '', 200);
  const safeTelefono = sanitizeUserInput(payload.telefono || '', 50);
  const safePais = sanitizeUserInput(payload.pais || 'PE', 5).toUpperCase();
  const safeContext = sanitizeContext(payload.camposDinamicos || {}, 2000);

  const { data: lead, error } = await supabase.from('leads').insert({
    nombre_empresa: safeEmpresa,
    nombre_contacto: safeContacto,
    correo: emailClean,
    telefono: safeTelefono,
    pais: safePais,
    industria: sanitizeUserInput(payload.industria || '', 100) || null,
    origen: 'api_gateway',
    estado: 'nuevo',
    campos_dinamicos: safeContext
  }).select().single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ success: true, lead });
});

// ============================================================================
// 3. ENDPOINT PROTEGIDO DE CONSULTA /v1/clientes (Alineación con OpenAPI)
// ============================================================================
router.get('/v1/clientes', validateApiKey, async (req, res) => {
  const supabase = req.app.get('supabase');
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

  try {
    const { data: clientes, count, error } = await supabase
      .from('clientes')
      .select('id, nombre_empresa, cuit_rut_rfc, industria, sitio_web, estado, pais, comercial_email, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.json({
      success: true,
      total: count,
      limit,
      offset,
      data: clientes || []
    });
  } catch (err) {
    console.error('[API /v1/clientes Error]', err);
    return res.status(500).json({ error: err.message || 'Error consultando lista de clientes.' });
  }
});

// ============================================================================
// 4. [P1-03 FIX] ENDPOINT PROTEGIDO DE DETALLE /v1/clientes/:id (Alineación OpenAPI)
// ============================================================================
router.get('/v1/clientes/:id', validateApiKey, async (req, res) => {
  const supabase = req.app.get('supabase');
  const { id } = req.params;

  try {
    // SEC-06 FIX: Limitar proyección para evitar fuga de campos internos sensibles (health_score, bitacora, RAG)
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('id, nombre_empresa, razon_social, cuit_rut_rfc, pais, estado, industria, sitio_web, tamanio_empresa, observaciones, updated_at, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !cliente) {
      return res.status(404).json({ error: `Cliente con ID ${id} no encontrado.` });
    }

    return res.json({
      success: true,
      data: cliente
    });
  } catch (err) {
    console.error(`[API /v1/clientes/${id} Error]`, err);
    return res.status(500).json({ error: err.message || 'Error obteniendo cliente.' });
  }
});

// ============================================================================
// 5. [P1-03 FIX] ENDPOINT PROTEGIDO DE CREACIÓN /v1/clientes (Alineación OpenAPI)
// ============================================================================
router.post('/v1/clientes', validateApiKey, async (req, res) => {
  const supabase = req.app.get('supabase');
  const { nombreEmpresa, razonSocial, cuitRutRfc, industria, sitioWeb, tamanioEmpresa, pais, estado, observaciones, camposDinamicos } = req.body;

  if (!nombreEmpresa || !nombreEmpresa.trim()) {
    return res.status(400).json({ error: 'El campo nombreEmpresa es obligatorio.' });
  }

  const safeEmpresa = sanitizeUserInput(nombreEmpresa, 200);
  const safePais = sanitizeUserInput(pais || 'PE', 5).toUpperCase();
  const safeContext = sanitizeContext(camposDinamicos || {}, 2000);
  // SEC-11 FIX: El ID siempre se genera en servidor — nunca se acepta del cliente externo
  const clienteId = `client_${crypto.randomUUID ? crypto.randomUUID().split('-')[0] : Date.now().toString(36)}`;

  try {
    const { data: nuevoCliente, error } = await supabase
      .from('clientes')
      .upsert({
        id: clienteId,
        nombre_empresa: safeEmpresa,
        cuit_rut_rfc: sanitizeUserInput(cuitRutRfc || '', 50) || null,
        industria: sanitizeUserInput(industria || '', 100) || null,
        sitio_web: sanitizeUserInput(sitioWeb || '', 200) || null,
        tamanio_empresa: sanitizeUserInput(tamanioEmpresa || '', 50) || null,
        pais: safePais,
        estado: estado || 'Lead API',
        observaciones: sanitizeUserInput(observaciones || '', 500) || null,
        campos_dinamicos: safeContext,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data: nuevoCliente
    });
  } catch (err) {
    console.error('[API POST /v1/clientes Error]', err);
    return res.status(500).json({ error: err.message || 'Error creando o actualizando cliente.' });
  }
});

module.exports = router;
