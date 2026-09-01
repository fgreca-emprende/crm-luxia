import React from 'react';

export function GamificationPanel({
  gamification = { churnStreakDays: 0, dataQualityScore: 0 },
  comerciales = []
}) {
  const sortedGamers = (comerciales || [])
    .map(u => ({
      ...u,
      gamificacion: u.gamificacion || { xpGlobal: 0, nivelGlobal: 1 }
    }))
    .sort((a, b) => {
      const xpA = a.gamificacion?.xpGlobal || 0;
      const xpB = b.gamificacion?.xpGlobal || 0;
      return xpB - xpA;
    });

  const totalXP = sortedGamers.reduce((acc, u) => acc + (u.gamificacion?.xpGlobal || 0), 0);
  const topLevel = sortedGamers.length > 0 ? (sortedGamers[0].gamificacion?.nivelGlobal || 1) : 1;

  return (
    <div className="row g-3 mb-4">
      {/* Grilla Superior de Gamificación */}
      <div className="col-12">
        <div className="row g-3">
          <div className="col-md-6 col-lg-3">
            <div className="card-premium gamification-card h-100 p-4 text-center gradient-bg-gold">
              <i className="bi bi-star-fill fs-1 icon-flame mb-2 text-warning"></i>
              <h6 className="fw-bold text-dark text-uppercase mb-1" style={{ fontSize: '0.75rem' }}>XP Total del Equipo</h6>
              <h2 className="fw-extrabold text-dark mb-0" style={{ fontSize: '2.5rem' }}>{totalXP}</h2>
            </div>
          </div>
          <div className="col-md-6 col-lg-3">
            <div className="card-premium gamification-card h-100 p-4 text-center gradient-bg-silver">
              <i className="bi bi-trophy-fill fs-1 icon-trophy mb-2 text-secondary"></i>
              <h6 className="fw-bold text-dark text-uppercase mb-1" style={{ fontSize: '0.75rem' }}>Nivel Máximo Alcanzado</h6>
              <h2 className="fw-extrabold text-dark mb-0" style={{ fontSize: '2.5rem' }}>{topLevel}</h2>
            </div>
          </div>
          <div className="col-md-6 col-lg-3">
            <div className="card-premium gamification-card h-100 p-4 text-center gradient-bg-bronze">
              <i className="bi bi-shield-check fs-1 icon-target mb-2 text-success"></i>
              <h6 className="fw-bold text-dark text-uppercase mb-1" style={{ fontSize: '0.75rem' }}>Completitud de Datos</h6>
              <h2 className="fw-extrabold text-dark mb-0" style={{ fontSize: '2.5rem' }}>{gamification.dataQualityScore}%</h2>
            </div>
          </div>
          <div className="col-md-6 col-lg-3">
            <div className="card-premium gamification-card h-100 p-4 text-center border border-primary border-opacity-25">
              <i className="bi bi-heart-pulse-fill fs-1 text-danger mb-2"></i>
              <h6 className="fw-bold text-dark text-uppercase mb-1" style={{ fontSize: '0.75rem' }}>Mejor Racha de Salvataje</h6>
              <h2 className="fw-extrabold text-dark mb-0" style={{ fontSize: '2.5rem' }}>
                {gamification.churnStreakDays === 999 ? '∞' : gamification.churnStreakDays} <span className="fs-6 text-muted">días</span>
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="col-12 mt-4">
        <div className="card-premium p-4 d-flex flex-column">
          <h6 className="fw-bold text-dark mb-3">
            <i className="bi bi-list-ol text-primary me-2"></i>Tabla de Clasificación General
          </h6>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead className="table-light text-muted">
                <tr>
                  <th className="fw-bold border-0 rounded-start" style={{ width: '80px' }}>Rank</th>
                  <th className="fw-bold border-0">Agente</th>
                  <th className="fw-bold border-0 text-center">Nivel</th>
                  <th className="fw-bold border-0 text-center">XP Total</th>
                  <th className="fw-bold border-0 text-center">Mejor Racha</th>
                  <th className="fw-bold border-0 text-end rounded-end">Rama Principal</th>
                </tr>
              </thead>
              <tbody>
                {sortedGamers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">Aún no hay datos de gamificación en el equipo.</td>
                  </tr>
                ) : (
                  sortedGamers.map((user, index) => {
                    let badgeContent = <span className="fw-bold text-muted">#{index + 1}</span>;
                    if (index === 0) badgeContent = <span className="badge bg-warning text-dark px-2 py-1 rounded-pill"><i className="bi bi-trophy-fill me-1"></i>1ro</span>;
                    else if (index === 1) badgeContent = <span className="badge bg-secondary text-white px-2 py-1 rounded-pill">2do</span>;
                    else if (index === 2) badgeContent = <span className="badge" style={{ backgroundColor: '#cd7f32', color: 'white' }}>3ro</span>;
                    
                    const g = user.gamificacion;
                    const rachaMaxima = Math.max(g.rachas?.actividadDiaria?.record || 0, g.rachas?.interacciones?.record || 0);
                    
                    // Find best skill or infer default branch based on user team
                    let bestSkillName = "";
                    let maxSkillXp = -1;

                    const arbol = g.arbolHabilidades || {
                      ventas: { nivel: 1, xp: 0, nombre: "Cazador (Ventas)" },
                      soporte: { nivel: 1, xp: 0, nombre: "Soporte Técnico" },
                      retencion: { nivel: 1, xp: 0, nombre: "Retención y Farming" }
                    };

                    Object.entries(arbol).forEach(([key, skill]) => {
                      const skillXp = skill.xp || 0;
                      if (skillXp > maxSkillXp) {
                        maxSkillXp = skillXp;
                        bestSkillName = skill.nombre || key;
                      }
                    });

                    // If maxSkillXp is 0 (new user or no XP yet), infer branch from user team
                    if (maxSkillXp <= 0) {
                      const eq = (user.equipo || '').toLowerCase().trim();
                      if (eq.includes('cx') || eq.includes('soporte')) {
                        bestSkillName = "Soporte Técnico";
                      } else if (eq.includes('retencion') || eq.includes('farming')) {
                        bestSkillName = "Retención y Farming";
                      } else {
                        bestSkillName = "Cazador (Ventas)";
                      }
                    }

                    return (
                      <tr key={user.email}>
                        <td>{badgeContent}</td>
                        <td className="fw-bold text-dark">
                          <div className="d-flex align-items-center gap-2">
                            <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                              {user.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-dark fw-bold d-flex align-items-center gap-1">
                                {user.nombre}
                                {user.capacitacion?.estado === 'certificado' && (
                                  <span className="text-primary small" title={`Capacitado: ${user.capacitacion.rolCertificado}`}>🎓</span>
                                )}
                              </div>
                              <div className="text-muted small" style={{ fontSize: '0.7rem' }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-primary rounded-pill px-3 py-2">Lv. {g.nivelGlobal || 1}</span>
                        </td>
                        <td className="text-center fw-bold text-dark">{g.xpGlobal || 0} XP</td>
                        <td className="text-center fw-bold text-danger"><i className="bi bi-fire me-1"></i>{rachaMaxima} días</td>
                        <td className="text-end text-muted small fw-bold text-capitalize">{bestSkillName}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
