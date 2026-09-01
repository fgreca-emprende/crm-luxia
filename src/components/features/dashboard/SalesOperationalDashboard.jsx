import { useMemo } from 'react';

export function SalesOperationalDashboard({ 
  oportunidades, 
  comerciales = [], 
  currentUserEmail, 
  isAgent,
  isRestricted,
  role,
  userTeam
}) {
  // 1. Filtrar negociaciones activas y cerradas
  const activeOps = useMemo(() => {
    return oportunidades.filter(o => o.etapa !== 'ganado' && o.etapa !== 'perdido');
  }, [oportunidades]);

  const closedOps = useMemo(() => {
    return oportunidades.filter(o => o.etapa === 'ganado' || o.etapa === 'perdido');
  }, [oportunidades]);

  const wonOps = useMemo(() => {
    return closedOps.filter(o => o.etapa === 'ganado');
  }, [closedOps]);

  const lostOps = useMemo(() => {
    return closedOps.filter(o => o.etapa === 'perdido');
  }, [closedOps]);

  // 2. Calcular KPIs principales
  const activeCount = activeOps.length;
  const proposalOrNegotiationCount = useMemo(() => {
    return activeOps.filter(o => o.etapa === 'propuesta' || o.etapa === 'negociacion').length;
  }, [activeOps]);

  const winRate = useMemo(() => {
    if (closedOps.length === 0) return 0;
    return Math.round((wonOps.length / closedOps.length) * 100);
  }, [closedOps, wonOps]);

  const avgHealthScore = useMemo(() => {
    const scoredOps = activeOps.filter(o => o.calificacionIA?.score !== undefined);
    if (scoredOps.length === 0) return null;
    const sum = scoredOps.reduce((acc, o) => acc + Number(o.calificacionIA.score), 0);
    return Math.round(sum / scoredOps.length);
  }, [activeOps]);

  // 3. Distribución por etapa de negociación
  const stageDistribution = useMemo(() => {
    const counts = { diagnostico: 0, propuesta: 0, negociacion: 0, aprobacion: 0 };
    activeOps.forEach(o => {
      if (counts[o.etapa] !== undefined) counts[o.etapa]++;
    });
    return counts;
  }, [activeOps]);

  // 4. Distribución por razones de pérdida
  const lossDistribution = useMemo(() => {
    const counts = { precio: 0, cobertura: 0, competencia: 0, tecnologia: 0, otro: 0 };
    lostOps.forEach(o => {
      const reason = (o.perdidaRazon || 'otro').toLowerCase();
      if (counts[reason] !== undefined) {
        counts[reason]++;
      } else {
        counts.otro++;
      }
    });
    return counts;
  }, [lostOps]);

  // 5. Balanceo de carga y riesgo por comercial
  const workloadList = useMemo(() => {
    const workloadMap = {};

    const normalizarEquipo = (teamStr) => {
      if (!teamStr) return '';
      return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };

    // Inicializar con comerciales conocidos
    comerciales.forEach(u => {
      if (u.equipo === 'Adquisicion' || u.equipo === 'Retencion') {
        const emailKey = (u.email || '').toLowerCase().trim();
        if (emailKey) {
          workloadMap[emailKey] = {
            email: emailKey,
            nombre: u.nombre || emailKey,
            equipo: u.equipo || '',
            activeCount: 0,
            wonCount: 0,
            lostCount: 0,
            isUnassigned: false
          };
        }
      }
    });

    // Agrupar oportunidades
    oportunidades.forEach(o => {
      const rawEmail = (o.comercialEmail || 'sin_asignar').toLowerCase().trim();
      const isUnassigned = !o.comercialEmail || rawEmail === 'sin_asignar' || rawEmail === 'sin asignar';
      const ownerKey = isUnassigned ? 'sin_asignar' : rawEmail;

      if (!workloadMap[ownerKey]) {
        const matchedComm = comerciales.find(c => (c.email || '').toLowerCase().trim() === ownerKey);
        workloadMap[ownerKey] = {
          email: ownerKey,
          nombre: isUnassigned ? '🔓 Sin Asignar (Pendientes)' : ownerKey,
          equipo: matchedComm?.equipo || '',
          isUnassigned,
          activeCount: 0,
          wonCount: 0,
          lostCount: 0
        };
      }

      if (o.etapa === 'ganado') {
        workloadMap[ownerKey].wonCount++;
      } else if (o.etapa === 'perdido') {
        workloadMap[ownerKey].lostCount++;
      } else {
        workloadMap[ownerKey].activeCount++;
      }
    });

    let list = Object.values(workloadMap);
    if (isRestricted && currentUserEmail) {
      if (isAgent) {
        const selfEmail = currentUserEmail.toLowerCase().trim();
        list = list.filter(item => item.email === selfEmail);
      } else if (role === 'supervisor' && userTeam) {
        const supTeamNorm = normalizarEquipo(userTeam);
        list = list.filter(item => normalizarEquipo(item.equipo) === supTeamNorm);
      }
    }

    return list.sort((a, b) => b.activeCount - a.activeCount);
  }, [oportunidades, comerciales, currentUserEmail, isAgent, isRestricted, role, userTeam]);

  return (
    <div className="animate__animated animate__fadeIn">
      {/* Grid de KPIs principales */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card p-3 border-0 shadow-sm rounded-4 bg-primary bg-opacity-10">
            <span className="text-muted small fw-bold text-uppercase">Negociaciones Activas</span>
            <h3 className="fw-bold text-primary mb-0">{activeCount}</h3>
            <span className="text-muted small">Deals en curso en el pipeline</span>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3 border-0 shadow-sm rounded-4 bg-warning bg-opacity-10">
            <span className="text-muted small fw-bold text-uppercase">Propuesta / Negociación</span>
            <h3 className="fw-bold text-warning mb-0">{proposalOrNegotiationCount}</h3>
            <span className="text-muted small">Deals avanzados</span>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3 border-0 shadow-sm rounded-4 bg-success bg-opacity-10">
            <span className="text-muted small fw-bold text-uppercase">Tasa de Conversión</span>
            <h3 className="fw-bold text-success mb-0">{winRate}%</h3>
            <span className="text-muted small">Win Rate de deals cerrados</span>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3 border-0 shadow-sm rounded-4 bg-info bg-opacity-10">
            <span className="text-muted small fw-bold text-uppercase">Salud LUXIA IA</span>
            <h3 className="fw-bold text-info mb-0">
              {avgHealthScore !== null ? `${avgHealthScore}%` : 'N/A'}
            </h3>
            <span className="text-muted small">Puntaje promedio de salud</span>
          </div>
        </div>
      </div>

      {/* Distribución y Pérdidas */}
      <div className="row g-4 mb-4">
        {/* Distribución por etapa */}
        <div className="col-md-6">
          <div className="p-3 border rounded-4 bg-light h-100">
            <h6 className="fw-bold text-dark mb-3">Distribución por Etapa de Negociación</h6>
            {[
              { key: 'diagnostico', label: 'Diagnóstico' },
              { key: 'propuesta', label: 'Propuesta' },
              { key: 'negociacion', label: 'Negociación' },
              { key: 'aprobacion', label: 'Aprobación / Contrato' }
            ].map(st => {
              const count = stageDistribution[st.key] || 0;
              const pct = activeCount > 0 ? Math.round((count / activeCount) * 100) : 0;
              const colorMap = { diagnostico: 'bg-primary', propuesta: 'bg-warning text-dark', negociacion: 'bg-info text-dark', aprobacion: 'bg-success' };
              return (
                <div key={st.key} className="mb-3">
                  <div className="d-flex justify-content-between small fw-bold mb-1">
                    <span>{st.label}</span>
                    <span>{count} ({pct}%)</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className={`progress-bar ${colorMap[st.key]}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribución de pérdidas */}
        <div className="col-md-6">
          <div className="p-3 border rounded-4 bg-light h-100">
            <h6 className="fw-bold text-dark mb-3">Distribución de Pérdidas de Pipeline</h6>
            {[
              { key: 'precio', label: 'Precio Elevado' },
              { key: 'cobertura', label: 'Falta de Cobertura' },
              { key: 'competencia', label: 'Competencia' },
              { key: 'tecnologia', label: 'Tecnología' },
              { key: 'otro', label: 'Otro / No Especificado' }
            ].map(loss => {
              const count = lossDistribution[loss.key] || 0;
              const totalLost = lostOps.length;
              const pct = totalLost > 0 ? Math.round((count / totalLost) * 100) : 0;
              return (
                <div key={loss.key} className="mb-3">
                  <div className="d-flex justify-content-between small fw-bold mb-1">
                    <span>{loss.label}</span>
                    <span>{count} ({pct}%)</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-secondary" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Balanceo de carga y riesgo por comercial */}
      <div className="row g-4">
        <div className="col-12">
          <div className="p-4 border rounded-4 bg-white shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h6 className="fw-bold text-dark mb-0">
                <i className="bi bi-people-fill text-primary me-2"></i>
                Balanceo de Carga Operativa y Riesgo por AM/Comercial
              </h6>
              <span className="badge bg-light text-muted border rounded-pill px-3 py-1 small">
                {workloadList.length} ejecutivos con cartera
              </span>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ fontSize: '0.75rem' }}>Ejecutivo Comercial</th>
                    <th style={{ fontSize: '0.75rem' }} className="text-center">Negociaciones Activas</th>
                    <th style={{ fontSize: '0.75rem' }} className="text-center">Deals Ganados</th>
                    <th style={{ fontSize: '0.75rem' }} className="text-center">Deals Perdidos</th>
                    <th style={{ fontSize: '0.75rem' }} className="text-end">Estado Carga</th>
                  </tr>
                </thead>
                <tbody>
                  {workloadList.map((item, idx) => (
                    <tr key={idx} className={item.isUnassigned ? 'table-warning bg-warning bg-opacity-10' : ''}>
                      <td className="fw-bold text-dark small">
                        {item.isUnassigned ? (
                          <span className="text-danger fw-bold">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>{item.nombre}
                          </span>
                        ) : (
                          <span>
                            <i className="bi bi-person-circle text-secondary me-2"></i>{item.nombre}
                          </span>
                        )}
                      </td>
                      <td className="text-center fw-bold">{item.activeCount}</td>
                      <td className="text-center">
                        <span className={`badge rounded-pill ${item.wonCount > 0 ? 'bg-success' : 'bg-light text-muted'}`}>
                          {item.wonCount}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge rounded-pill ${item.lostCount > 0 ? 'bg-secondary' : 'bg-light text-muted'}`}>
                          {item.lostCount}
                        </span>
                      </td>
                      <td className="text-end">
                        {item.isUnassigned ? (
                          <span className="badge bg-danger rounded-pill px-3 py-1">⚠️ Requiere Asignación</span>
                        ) : (
                          <span className={`badge rounded-pill px-3 py-1 ${
                            item.activeCount > 5 ? 'bg-danger' : item.activeCount > 2 ? 'bg-success' : 'bg-light text-muted'
                          }`}>
                            {item.activeCount > 5 ? 'Sobrecargado' : item.activeCount > 2 ? 'Óptimo' : 'Bajo'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
