const express = require('express');
const router = express.Router();
const { generateSentinelContent } = require('../services/sentinelCore');
const { processUserAction } = require('../services/gamificationService');

/**
 * Middleware para validar el JWT de Supabase en las peticiones del frontend
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token JWT ausente.' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = req.app.get('supabase');

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Token JWT inválido o expirado.' });
  }

  req.user = user;
  next();
}

// ============================================================================
// 1. OBTENER EXAMEN (Zero-Trust: Remueve la propiedad 'correcta' del frontend)
// ============================================================================
router.post('/obtener-examen', requireAuth, async (req, res) => {
  const { rol, dificultad } = req.body;
  const supabase = req.app.get('supabase');

  if (!rol || !dificultad) {
    return res.status(400).json({ error: 'Rol y dificultad son requeridos.' });
  }

  const examId = `${rol}_${dificultad}`.toLowerCase();
  const { data: examen, error } = await supabase
    .from('config_capacitacion_examenes')
    .select('*')
    .eq('id', examId)
    .single();

  if (error || !examen) {
    return res.status(404).json({ error: 'Examen no encontrado en la base de datos.' });
  }

  // Zero-Trust: Filtrar la respuesta correcta de cada pregunta teórica
  const sanitizedTeorico = (examen.teorico || []).map(({ correcta, ...rest }) => rest);

  return res.json({
    id: examen.id,
    rol: examen.rol,
    dificultad: examen.dificultad,
    titulo: examen.titulo,
    descripcion: examen.descripcion,
    teorico: sanitizedTeorico,
    practico: examen.practico
  });
});

// ============================================================================
// 2. EVALUAR EXAMEN (Calificación automática y Sentinel IA)
// ============================================================================
router.post('/evaluar-examen', requireAuth, async (req, res) => {
  const { rol, dificultad, respuestasTeorico, respuestaPractico, usuarioNombre } = req.body;
  const supabase = req.app.get('supabase');
  const user = req.user;

  const examId = `${rol}_${dificultad}`.toLowerCase();
  const { data: examen, error } = await supabase
    .from('config_capacitacion_examenes')
    .select('*')
    .eq('id', examId)
    .single();

  if (error || !examen) {
    return res.status(404).json({ error: 'Examen no encontrado para calificar.' });
  }

  // 1. Calificar Teórico (Backend Fuente de Verdad)
  let aciertos = 0;
  const totalPreguntas = (examen.teorico || []).length;
  (examen.teorico || []).forEach((preg, idx) => {
    if (respuestasTeorico && respuestasTeorico[idx] === preg.correcta) {
      aciertos++;
    }
  });

  const scoreTeorico = totalPreguntas > 0 ? Math.round((aciertos / totalPreguntas) * 100) : 0;

  // 2. Calificar Caso Práctico con Sentinel IA
  let scorePractico = 80;
  let feedbackPractico = "Evaluación completada satisfactoriamente.";

  if (respuestaPractico && respuestaPractico.trim().length > 10) {
    const promptIA = `Evalúa la siguiente respuesta práctica de capacitación para el rol ${rol} (${dificultad}):
Pregunta: ${examen.practico?.pregunta || ""}
Criterios: ${JSON.stringify(examen.practico?.criteriosEvaluacion || [])}
Respuesta del usuario: "${respuestaPractico}"

Devuelve un JSON con:
{
  "scorePractico": (número de 0 a 100),
  "feedback": (texto breve en markdown con fortalezas y oportunidades de mejora)
}`;

    const aiRes = await generateSentinelContent({
      agenteId: 'sentinel_exam',
      prompt: promptIA,
      userEmail: user.email,
      supabase
    });

    if (aiRes.success && aiRes.data) {
      scorePractico = aiRes.data.scorePractico || 75;
      feedbackPractico = aiRes.data.feedback || "Evaluado por Sentinel IA.";
    }
  }

  // 3. Score Global (50% teórico, 50% práctico)
  const scoreGlobal = Math.round((scoreTeorico * 0.5) + (scorePractico * 0.5));
  const aprobado = scoreGlobal >= 80;

  // 4. Guardar intento en examenes_intentos
  const { data: intento } = await supabase.from('examenes_intentos').insert({
    usuario_email: user.email,
    usuario_id: user.id,
    usuario_nombre: usuarioNombre || user.email,
    rol,
    dificultad,
    respuestas_teorico: respuestasTeorico || [],
    score_teorico: scoreTeorico,
    respuesta_practico: respuestaPractico || '',
    score_practico: scorePractico,
    feedback_practico: feedbackPractico,
    score_global: scoreGlobal,
    aprobado,
    evaluado_por: 'sentinel_ia',
    estado: 'evaluado',
    processed: true
  }).select().single();

  // 5. Actualizar certificación y gamificación si aprobó
  if (aprobado) {
    const proximoLimite = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('usuarios').update({
      capacitacion: {
        estado: 'certificado',
        ultimoExamenAprobado: new Date().toISOString(),
        proximoExamenLimite: proximoLimite,
        rolCertificado: rol,
        dificultadCertificada: dificultad,
        ultimoScore: scoreGlobal
      }
    }).eq('id', user.id);

    await processUserAction(user.id, 'aprobar_examen', supabase);
  }

  return res.json({
    intentoId: intento?.id,
    scoreTeorico,
    scorePractico,
    scoreGlobal,
    aprobado,
    feedbackPractico
  });
});

const { sanitizeUserInput, sanitizeContext } = require('../utils/sanitize');

// ============================================================================
// 3. COPILOTO SENTINEL (Comandos por voz y consultas inteligentes)
// ============================================================================
router.post('/copilot', requireAuth, async (req, res) => {
  const { prompt, clienteId, contexto } = req.body;
  const supabase = req.app.get('supabase');
  const user = req.user;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt es requerido.' });
  }

  // [P1-8 FIX] Sanitizar inputs antes de inyectar en prompt de IA
  const safePrompt = sanitizeUserInput(prompt, 2000);
  const safeContext = sanitizeContext(contexto, 4000);

  if (!safePrompt) {
    return res.status(400).json({ error: 'El prompt contiene caracteres inválidos.' });
  }

  const promptFinal = `Contexto del cliente: ${JSON.stringify(safeContext)}\nComando/Consulta del operador: "${safePrompt}"`;

  const aiRes = await generateSentinelContent({
    agenteId: 'sentinel_copilot',
    prompt: promptFinal,
    userEmail: user.email,
    contextInfo: { clienteId },
    supabase
  });

  return res.json(aiRes);
});

// ============================================================================
// 4. SOPORTE AYUDA DRAWER (Asistente de manuales RAG)
// ============================================================================
router.post('/soporte-agent', requireAuth, async (req, res) => {
  const { pregunta, seccionActual } = req.body;
  const supabase = req.app.get('supabase');
  const user = req.user;

  if (!pregunta) {
    return res.status(400).json({ error: 'Pregunta es requerida.' });
  }

  // [P1-8 FIX] Sanitizar pregunta y sección
  const safePregunta = sanitizeUserInput(pregunta, 1000);
  const safeSeccion = sanitizeUserInput(seccionActual || 'General', 100);

  const promptFinal = `El operador se encuentra en la pantalla "${safeSeccion}".\nPregunta: "${safePregunta}"\nExplica paso a paso cómo realizar la acción en el CRM.`;

  const aiRes = await generateSentinelContent({
    agenteId: 'sentinel_support',
    prompt: promptFinal,
    userEmail: user.email,
    supabase
  });

  return res.json(aiRes);
});

// ============================================================================
// 5. EXPORTACIÓN SEGURA DE DATOS (Con auditoría y Data Scopes)
// ============================================================================
router.post('/exportar-datos', requireAuth, async (req, res) => {
  const { entidad, filtros } = req.body;
  const supabase = req.app.get('supabase');
  const user = req.user;

  if (!['leads', 'clientes', 'oportunidades', 'tickets'].includes(entidad)) {
    return res.status(400).json({ error: 'Entidad no válida para exportación.' });
  }

  // Consultar registros respetando RLS del usuario
  const { data: rows, error } = await supabase.from(entidad).select('*');
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Registrar auditoría inmutable
  await supabase.from('logs_auditoria_exportacion').insert({
    usuario: user.email,
    rol: 'operador',
    entidad,
    filas_exportadas: rows.length,
    ip: req.ip || '127.0.0.1',
    alerta_exfiltracion: rows.length > 500
  });

  return res.json({
    total: rows.length,
    data: rows
  });
});

module.exports = router;
