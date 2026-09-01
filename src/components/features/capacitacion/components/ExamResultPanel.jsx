import React from 'react';
import ReactMarkdown from 'react-markdown';

export function ExamResultPanel({ examResult, setStep }) {
  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="card-premium p-5 border border-primary border-opacity-10 shadow-lg bg-white">
          {examResult.estado === 'pendiente' ? (
            /* Caso Fallback: Pendiente de corrección manual */
            <div className="text-center">
              <div className="rounded-circle bg-warning bg-opacity-15 p-4 d-inline-flex mb-3">
                <i className="bi bi-hourglass-split text-warning display-4"></i>
              </div>
              <h3 className="fw-bold text-dark mb-2">Examen Guardado con Éxito</h3>
              <p className="text-muted mb-4" style={{ maxWidth: '500px', margin: '0 auto' }}>
                LUXIA IA se encuentra fuera de línea en este momento. Tu respuesta práctica ha sido enviada para la revisión manual de un administrador. Tu nota teórica es de <strong>{examResult.scoreTeorico}%</strong>.
              </p>
              <button className="btn btn-primary rounded-pill px-4 fw-bold" onClick={() => setStep('dashboard')}>
                Volver a la consola
              </button>
            </div>
          ) : (
            /* Caso Éxito: Evaluado por la IA */
            <div className="text-center">
              {examResult.aprobado ? (
                <div className="animate-bounce">
                  <div className="rounded-circle bg-success bg-opacity-15 p-4 d-inline-flex mb-3">
                    <i className="bi bi-trophy-fill text-success display-3"></i>
                  </div>
                  <h3 className="fw-bold text-success mb-2">¡Felicitaciones, Aprobaste!</h3>
                </div>
              ) : (
                <div>
                  <div className="rounded-circle bg-danger bg-opacity-15 p-4 d-inline-flex mb-3">
                    <i className="bi bi-x-circle-fill text-danger display-3"></i>
                  </div>
                  <h3 className="fw-bold text-danger mb-2">Examen no Aprobado</h3>
                </div>
              )}

              <p className="text-muted mb-4">
                Has completado la evaluación del examen con los siguientes resultados:
              </p>

              {/* Notas Grid */}
              <div className="row g-3 justify-content-center mb-4">
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-4 border">
                    <div className="small text-muted fw-bold">Teórico</div>
                    <div className="fs-3 fw-extrabold text-dark">{examResult.scoreTeorico}%</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-4 border">
                    <div className="small text-muted fw-bold">Práctico</div>
                    <div className="fs-3 fw-extrabold text-dark">{examResult.scorePractico}%</div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="p-3 bg-primary bg-opacity-10 rounded-4 border border-primary border-opacity-25">
                    <div className="small text-primary fw-bold">Nota Global</div>
                    <div className="fs-3 fw-extrabold text-primary">{examResult.scoreGlobal}%</div>
                  </div>
                </div>
              </div>

              {/* Feedback Box */}
              {examResult.feedbackPractico && (
                <div className="text-start p-4 bg-light rounded-4 border mb-4" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <h6 className="fw-bold mb-2 text-dark"><i className="bi bi-chat-left-quote-fill text-primary me-2"></i>Feedback de LUXIA IA:</h6>
                  <div className="small text-dark font-monospace text-wrap border-start border-primary border-3 ps-3 py-1">
                    <ReactMarkdown>{examResult.feedbackPractico}</ReactMarkdown>
                  </div>
                </div>
              )}

              <button className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" onClick={() => setStep('dashboard')}>
                Volver a la consola
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
