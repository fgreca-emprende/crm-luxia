import React from 'react';

export function ExamRoom({
  step,
  setStep,
  currentExam,
  teoricoRespuestas,
  setTeoricoRespuestas,
  practicoRespuesta,
  setPracticoRespuesta,
  handleSubmitExam
}) {
  return (
    <div className="row g-4 justify-content-center">
      <div className="col-lg-8">
        <div className="card-premium p-4 border border-primary border-opacity-10 shadow-lg bg-white">
          
          {/* STEP 2: EXAMEN TEÓRICO (Opciones Múltiples) */}
          {step === 'teorico' && (
            <>
              <div className="d-flex justify-content-between align-items-center pb-2 mb-4 border-bottom">
                <span className="badge bg-primary rounded-pill px-3 fw-bold small text-uppercase">Paso 1: Examen Teórico</span>
                <button className="btn btn-sm btn-link text-muted" onClick={() => setStep('dashboard')}>Cancelar</button>
              </div>

              <h5 className="fw-bold mb-4 text-dark text-center">Cuestionario sobre CRM Luxia</h5>
              
              {currentExam.teorico.map((q, idx) => (
                <div key={q.id || idx} className="mb-4 p-3 bg-light rounded-4 border">
                  <p className="fw-bold text-dark mb-3">{idx + 1}. {q.pregunta}</p>
                  <div className="d-flex flex-column gap-2">
                    {q.opciones.map((opt, oIdx) => (
                      <div key={oIdx} className="form-check p-0 m-0">
                        <input 
                          type="radio" 
                          className="btn-check" 
                          name={`q_${q.id || idx}`} 
                          id={`opt_${idx}_${oIdx}`} 
                          checked={teoricoRespuestas[idx] === oIdx}
                          onChange={() => {
                            const newResp = [...teoricoRespuestas];
                            newResp[idx] = oIdx;
                            setTeoricoRespuestas(newResp);
                          }}
                        />
                        <label className="btn btn-outline-primary text-start w-100 px-3 py-2.5 rounded-3 fw-semibold small" htmlFor={`opt_${idx}_${oIdx}`}>
                          {opt}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="d-flex justify-content-end mt-4">
                <button 
                  className="btn btn-primary rounded-pill px-4 fw-bold py-2 shadow-sm"
                  onClick={() => setStep('practico')}
                  disabled={teoricoRespuestas.includes(null)}
                >
                  Continuar al Examen Práctico <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </>
          )}

          {/* STEP 3: EXAMEN PRÁCTICO (Consigna Abierta) */}
          {step === 'practico' && (
            <>
              <div className="d-flex justify-content-between align-items-center pb-2 mb-4 border-bottom">
                <span className="badge bg-primary rounded-pill px-3 fw-bold small text-uppercase">Paso 2: Examen Práctico</span>
                <button className="btn btn-sm btn-link text-muted" onClick={() => setStep('teorico')}><i className="bi bi-arrow-left me-1"></i>Atrás</button>
              </div>

              <h5 className="fw-bold mb-3 text-dark">Caso Práctico Operativo</h5>
              <p className="text-muted small mb-4">Escribe una respuesta detallada estructurando tu justificación y los pasos que seguirías.</p>

              <div className="bg-light p-3 rounded-4 border mb-4 text-dark">
                <div className="fw-bold mb-2">Pregunta / Consigna:</div>
                <div className="mb-3 fs-6 font-monospace text-wrap">{currentExam.practico.pregunta}</div>
                
                <div className="border-top pt-2 mt-2">
                  <div className="small fw-bold text-muted mb-1"><i className="bi bi-info-circle me-1 text-primary"></i>Criterios de Evaluación a Considerar:</div>
                  <ul className="mb-0 small text-muted">
                    {(currentExam.practico.criteriosEvaluacion || []).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-bold mb-1 text-dark">Tu Respuesta (Mínimo 20 caracteres)</label>
                <textarea 
                  className="form-control font-monospace text-wrap" 
                  rows="8" 
                  value={practicoRespuesta}
                  placeholder="Escribe tu respuesta aquí..."
                  onChange={e => setPracticoRespuesta(e.target.value)}
                ></textarea>
              </div>

              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary rounded-pill px-4 fw-bold" onClick={() => setStep('teorico')}>
                  <i className="bi bi-arrow-left me-1"></i>Volver
                </button>
                <button 
                  className="btn btn-success rounded-pill px-5 fw-bold py-2 shadow-sm"
                  onClick={handleSubmitExam}
                  disabled={practicoRespuesta.trim().length < 20}
                >
                  <i className="bi bi-send me-1"></i>Enviar Examen a LUXIA IA
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
