const express = require('express');
const router = express.Router();
const { generateLuxiaContent } = require('../services/luxiaCore');
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
// 2. EVALUAR EXAMEN (Calificación automática y Luxia IA)
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

  // 2. Calificar Caso Práctico con Luxia IA
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

    const aiRes = await generateLuxiaContent({
      agenteId: 'luxia_exam',
      prompt: promptIA,
      userEmail: user.email,
      supabase
    });

    if (aiRes.success && aiRes.data) {
      scorePractico = aiRes.data.scorePractico || 75;
      feedbackPractico = aiRes.data.feedback || "Evaluado por Luxia IA.";
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
    evaluado_por: 'luxia_ia',
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
// 3. COPILOTO LUXIA (Comandos por voz y consultas inteligentes)
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

  const aiRes = await generateLuxiaContent({
    agenteId: 'luxia_copilot',
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

  const aiRes = await generateLuxiaContent({
    agenteId: 'luxia_support',
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
  const { entidad, filtros = {} } = req.body;
  const supabase = req.app.get('supabase');
  const user = req.user;

  if (!['leads', 'clientes', 'oportunidades'].includes(entidad)) {
    return res.status(400).json({ error: 'Entidad no válida para exportación.' });
  }

  // 1. Obtener perfil y rol real del usuario
  const { data: uProfile } = await supabase
    .from('usuarios')
    .select('rol, equipo')
    .eq('id', user.id)
    .maybeSingle();

  const userRole = uProfile?.rol || 'lector';
  const userTeam = uProfile?.equipo || 'Global';

  // 2. Construir consulta con Data Scopes y Filtros
  let query = supabase.from(entidad).select('*');

  // Aplicar Data Scopes según el rol si no es administrador
  if (!['superadmin', 'admin'].includes(userRole)) {
    if (['supervisor', 'supervisor_cx'].includes(userRole)) {
      // Supervisor: miembros de su mismo equipo
      const { data: teamUsers } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('equipo', userTeam);

      const teamEmails = (teamUsers || []).map(u => u.email).filter(Boolean);
      if (entidad === 'leads') {
        query = query.in('asignado_a', teamEmails.length > 0 ? teamEmails : [user.email]);
      } else if (entidad === 'clientes' || entidad === 'oportunidades') {
        query = query.in('comercial_email', teamEmails.length > 0 ? teamEmails : [user.email]);
      }
    } else {
      // Agente / Lector / Editor
      if (entidad === 'leads') {
        query = query.eq('asignado_a', user.email);
      } else if (entidad === 'clientes' || entidad === 'oportunidades') {
        query = query.eq('comercial_email', user.email);
      }
    }
  }

  // Aplicar filtros de fecha si fueron provistos
  if (filtros.startDate) {
    query = query.gte('created_at', filtros.startDate);
  }
  if (filtros.endDate) {
    query = query.lte('created_at', filtros.endDate);
  }

  const { data: rows, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const exportedRows = rows || [];

  // 3. Registrar auditoría inmutable con rol real
  await supabase.from('logs_auditoria_exportacion').insert({
    usuario: user.email,
    rol: userRole,
    entidad,
    filas_exportadas: exportedRows.length,
    ip: req.ip || '127.0.0.1',
    alerta_exfiltracion: exportedRows.length > 500
  });

  return res.json({
    total: exportedRows.length,
    data: exportedRows
  });
});

// ============================================================================
// 6. INVITACIÓN / CREACIÓN SEGURA DE USUARIOS (Supabase Admin Auth)
// ============================================================================
router.post('/usuarios/invitar', requireAuth, async (req, res) => {
  const { email, rol, equipo } = req.body;
  const supabase = req.app.get('supabase');
  const requestingUser = req.user;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Correo electrónico válido es requerido.' });
  }

  // Verificar que el usuario solicitante sea admin/superadmin
  const { data: requesterProfile } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', requestingUser.id)
    .single();

  if (!requesterProfile || !['admin', 'superadmin'].includes(requesterProfile.rol)) {
    return res.status(403).json({ error: 'No tienes permisos de administrador para invitar usuarios.' });
  }

  try {
    // 1. Crear o invitar usuario en Supabase Auth usando Service Role
    const emailClean = email.trim().toLowerCase();
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: emailClean,
      email_confirm: true,
      user_metadata: { rol: rol || 'agente', equipo: equipo || 'Global' }
    });

    let targetUserId = authData?.user?.id;

    if (authErr) {
      // Si el usuario ya existe en auth.users, buscar su ID
      if (authErr.message && authErr.message.includes('already been registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const found = (existingUsers?.users || []).find(u => u.email === emailClean);
        if (found) targetUserId = found.id;
      } else {
        throw authErr;
      }
    }

    if (!targetUserId) {
      return res.status(500).json({ error: 'No se pudo obtener el ID de usuario en Supabase Auth.' });
    }

    // 2. Insertar o actualizar el perfil en public.usuarios
    const { data: userProfile, error: profileErr } = await supabase
      .from('usuarios')
      .upsert({
        id: targetUserId,
        email: emailClean,
        nombre: emailClean.split('@')[0],
        rol: rol || 'agente',
        equipo: equipo || 'Global',
        activo: true
      })
      .select()
      .single();

    if (profileErr) throw profileErr;

    return res.status(201).json({
      success: true,
      message: `Usuario ${emailClean} registrado con éxito en Supabase Auth y Base de Datos.`,
      user: userProfile
    });
  } catch (err) {
    console.error('[Invitar Usuario Error]', err);
    return res.status(500).json({ error: err.message || 'Error procesando el registro del usuario.' });
  }
});

module.exports = router;
