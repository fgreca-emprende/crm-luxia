/**
 * Servicio de Gamificación para CRM-Luxia con Supabase
 */

const XP_TABLE = {
  nota_manual: 15,
  crear_lead: 25,
  calificar_lead: 35,
  crear_oportunidad: 40,
  ganar_oportunidad: 150,
  crear_contrato: 50,
  completar_onboarding_paso: 30,
  aprobar_examen: 100,
  csat_excelente: 50,
  csat_bueno: 25
};

async function processUserAction(userIdentifier, actionType, supabase) {
  if (!userIdentifier || !actionType) return;

  const xpEarned = XP_TABLE[actionType] || 10;

  try {
    // Buscar usuario por ID o por Email
    let query = supabase.from('usuarios').select('*');
    if (userIdentifier.includes('@')) {
      query = query.eq('email', userIdentifier);
    } else {
      query = query.eq('id', userIdentifier);
    }

    const { data: user, error } = await query.single();
    if (error || !user) {
      console.warn(`[Gamification] Usuario no encontrado para acción: ${userIdentifier}`);
      return;
    }

    const currentGamif = user.gamificacion || { nivelGlobal: 1, xpGlobal: 0, rachas: {} };
    const newXpGlobal = (currentGamif.xpGlobal || 0) + xpEarned;
    const newLevel = Math.floor(newXpGlobal / 200) + 1;

    const updatedGamif = {
      ...currentGamif,
      xpGlobal: newXpGlobal,
      nivelGlobal: newLevel,
      lastAction: {
        type: actionType,
        xpEarned,
        timestamp: new Date().toISOString()
      }
    };

    await supabase
      .from('usuarios')
      .update({ gamificacion: updatedGamif })
      .eq('id', user.id);

    console.log(`[Gamification] +${xpEarned} XP asignados a ${user.email} (${actionType}). Nivel actual: ${newLevel}`);
  } catch (err) {
    console.error(`[Gamification] Error procesando acción ${actionType}:`, err);
  }
}

module.exports = {
  processUserAction,
  XP_TABLE
};
