import React from 'react';
import { SpinnerPremium } from '../../../ui/SpinnerPremium';

export function ExamDashboard({
  profileData,
  selectedDifficulty,
  setSelectedDifficulty,
  isLector,
  handleStartExam,
  examLoading,
  attempts,
  capacitacionHabilitada = true
}) {
  const cert = profileData?.capacitacion;
  const isCertificado = cert?.estado === 'certificado';
  const proximoVencimiento = cert?.proximoExamenLimite 
    ? (cert.proximoExamenLimite.toDate ? cert.proximoExamenLimite.toDate() : new Date(cert.proximoExamenLimite))
    : null;

  const daysRemaining = proximoVencimiento 
    ? Math.ceil((proximoVencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="row g-4">
      {/* Tarjeta de Estado de Certificación */}
      <div className="col-lg-6">
        {isCertificado ? (
          <div className="card-premium h-100 p-4 border border-success border-opacity-25" style={{ background: 'linear-gradient(135deg, #f0fff4 0%, #dcfce7 100%)' }}>
            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="bg-success bg-opacity-20 rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                <i className="bi bi-patch-check-fill text-success fs-1"></i>
              </div>
              <div>
                <h5 className="fw-bold mb-0 text-success text-uppercase" style={{ letterSpacing: '0.5px' }}>Certificación Activa</h5>
                <span className="small text-muted fw-bold">Operador Acreditado CRM Luxia</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-4 shadow-sm text-dark small border mb-4">
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Perfil Acreditado:</span>
                <strong className="text-capitalize text-success">{cert.rolCertificado} ({cert.dificultadCertificada})</strong>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Aprobado el:</span>
                <strong>{cert.ultimoExamenAprobado?.toDate ? cert.ultimoExamenAprobado.toDate().toLocaleDateString('es-ES') : new Date(cert.ultimoExamenAprobado).toLocaleDateString('es-ES')}</strong>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Puntaje Obtenido:</span>
                <strong className="text-success">{cert.ultimoScore}%</strong>
              </div>
              <div className="d-flex justify-content-between border-top pt-2">
                <span className="text-muted">Vence en:</span>
                <span className={`fw-bold ${daysRemaining < 15 ? 'text-danger' : 'text-success'}`}>{daysRemaining} días ({proximoVencimiento?.toLocaleDateString('es-ES')})</span>
              </div>
            </div>

            {!isLector && (
              <div className="mb-4 bg-white p-3 rounded-4 border">
                <label className="form-label small fw-bold mb-1.5 text-dark">Selecciona Nivel para Rendir/Mejorar</label>
                <select 
                  className="form-select" 
                  value={selectedDifficulty}
                  onChange={e => setSelectedDifficulty(e.target.value)}
                  disabled={examLoading}
                >
                  <option value="basico">Básico (Otorga +150 XP)</option>
                  <option value="avanzado">Avanzado (Otorga +300 XP)</option>
                </select>
              </div>
            )}

            <div className="d-flex gap-2">
              <button 
                className={`btn ${selectedDifficulty === cert.dificultadCertificada ? 'btn-success' : 'btn-primary'} rounded-pill px-4 fw-bold text-white`} 
                onClick={handleStartExam}
                disabled={examLoading || !capacitacionHabilitada}
              >
                {examLoading ? (
                  <span className="spinner-border spinner-border-sm me-2"></span>
                ) : null}
                {selectedDifficulty === cert.dificultadCertificada ? (
                  <>
                    <i className="bi bi-arrow-repeat me-1"></i>Recertificar o Mejorar Nota
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-fill me-1"></i>Iniciar Examen {selectedDifficulty === 'avanzado' ? 'Avanzado' : 'Básico'}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="card-premium h-100 p-4 border border-warning border-opacity-25" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }}>
            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="bg-warning bg-opacity-20 rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                <i className="bi bi-exclamation-triangle-fill text-warning fs-2"></i>
              </div>
              <div>
                <h5 className="fw-bold mb-0 text-dark">Certificación Pendiente</h5>
                <span className="small text-muted fw-bold">Requiere rendir examen obligatorio</span>
              </div>
            </div>

            <p className="small text-muted mb-4">
              Para interactuar con LUXIA IA de forma completa y subir de nivel global en la tabla de clasificación, debes aprobar el examen teórico/práctico de tu perfil.
            </p>

            {!isLector && (
              <div className="mb-4 bg-white p-3 rounded-4 border">
                <label className="form-label small fw-bold mb-1.5 text-dark">Selecciona Nivel de Dificultad</label>
                <select 
                  className="form-select" 
                  value={selectedDifficulty}
                  onChange={e => setSelectedDifficulty(e.target.value)}
                  disabled={examLoading || !capacitacionHabilitada}
                >
                  <option value="basico">Básico (Otorga +150 XP)</option>
                  <option value="avanzado">Avanzado (Otorga +300 XP)</option>
                </select>
              </div>
            )}

            <button className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" onClick={handleStartExam} disabled={examLoading || !capacitacionHabilitada}>
              {examLoading ? (
                <span className="spinner-border spinner-border-sm me-2"></span>
              ) : (
                <i className="bi bi-play-fill me-1"></i>
              )}
              Iniciar Evaluación
            </button>
          </div>
        )}
      </div>

      {/* Historial de Intentos */}
      <div className="col-lg-6">
        <div className="card-premium h-100 p-4">
          <h5 className="fw-bold mb-3 text-dark">
            <i className="bi bi-clock-history text-secondary me-2"></i>Historial de Intentos
          </h5>
          <div className="overflow-auto pe-1" style={{ maxHeight: '280px' }}>
            {attempts.length === 0 ? (
              <div className="text-center text-muted small py-5">No has realizado ningún examen todavía.</div>
            ) : (
              attempts.map(att => {
                const date = att.fechaIntento?.toDate ? att.fechaIntento.toDate() : new Date(att.fechaIntento);
                const formattedDate = date.toLocaleDateString('es-ES') + ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div key={att.id} className="p-3 rounded-3 border bg-light mb-2 d-flex justify-content-between align-items-center shadow-xs">
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-bold text-dark text-capitalize small">
                        Examen {att.rol} ({att.dificultad})
                      </div>
                      <div className="text-muted font-monospace" style={{ fontSize: '0.7rem' }}>{formattedDate}</div>
                    </div>
                    <div className="text-end">
                      {att.estado === 'pendiente' ? (
                        <span className="badge bg-warning text-dark rounded-pill px-2.5">
                          <i className="bi bi-hourglass-split me-1"></i>Pendiente Admin
                        </span>
                      ) : att.aprobado ? (
                        <span className="badge bg-success rounded-pill px-2.5">
                          Aprobado: {att.scoreGlobal}%
                        </span>
                      ) : (
                        <span className="badge bg-danger rounded-pill px-2.5">
                          Reprobado: {att.scoreGlobal}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
