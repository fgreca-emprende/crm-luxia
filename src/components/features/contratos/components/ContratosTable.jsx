import React from 'react';
import { SLAIndicator } from './SLAIndicator';

export function ContratosTable({
  contratos,
  iaPausada,
  isAdmin,
  isSuperAdmin,
  hasPermission,
  handleTriggerIA,
  handleEdit,
  handleDelete,
  onViewDetail,
  camposConfig,
  exchangeRates,
  clientePais,
  isHistorico = false
}) {
  const getCountryCurrency = (country) => {
    switch (country) {
      case 'AR': return 'ARS';
      case 'CL': return 'CLP';
      case 'PE': return 'PEN';
      case 'CO': return 'COP';
      case 'MX': return 'MXN';
      default: return 'USD';
    }
  };
  const renderRiesgoBadge = (riesgo) => {
    if (riesgo === 'Green') return <span className="badge bg-success">Urgencia Baja</span>;
    if (riesgo === 'Yellow') return <span className="badge bg-warning text-dark">Urgencia Media</span>;
    if (riesgo === 'Red') return <span className="badge bg-danger">Urgencia Alta</span>;
    return null;
  };

  return (
    <div className="d-flex flex-column gap-2">
      {contratos.map(c => {
        const inicioStr = c.fechaInicio?.toDate?.().toLocaleDateString() || 'N/A';
        const finStr = c.fechaVencimiento?.toDate?.().toLocaleDateString() || 'N/A';
        const isAnalyzing = c._triggerIA === true;

        let diasRestantesStr = '';
        if (!isHistorico && c.fechaVencimiento) {
          const venc = c.fechaVencimiento.toDate ? c.fechaVencimiento.toDate() : new Date(c.fechaVencimiento);
          const diffTime = venc.getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            diasRestantesStr = `Vence en ${diffDays} días`;
          }
        }

        return (
          <div key={c.id} className={`card border-0 shadow-sm rounded-3 ${isHistorico ? 'bg-light bg-opacity-50 border-start border-3 border-secondary' : 'border-start border-4 border-success'}`}>
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                  <div className="fw-bold mb-1 d-flex align-items-center flex-wrap gap-2">
                    <span className="text-dark fs-6 text-truncate" style={{ maxWidth: '280px' }}>
                      {c.nombre || c.tipoServicio || 'Contrato sin nombre'}
                    </span>
                    {c.versionContrato && (
                      <span className="badge bg-secondary bg-opacity-25 text-dark border px-2 py-1 rounded-pill extra-small">
                        v{c.versionContrato}
                      </span>
                    )}
                    {c.tipoServicio && c.nombre && (
                      <span className="badge bg-secondary bg-opacity-10 text-secondary border px-2 py-1 rounded-pill small fw-normal">
                        {c.tipoServicio}
                      </span>
                    )}
                    {c.monto !== undefined && c.monto > 0 && (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 rounded-pill small fw-bold">
                        {(() => {
                          const originalCurrency = c.moneda || 'USD';
                          const rateOriginal = c.tipoCambioUSD || exchangeRates[originalCurrency] || 1.0;
                          const amountUsd = c.montoUSD !== undefined && c.montoUSD !== null && c.montoUSD > 0
                            ? c.montoUSD
                            : Number(c.monto) / rateOriginal;

                          if (clientePais) {
                            const targetCurrency = getCountryCurrency(clientePais);
                            const rateLocal = exchangeRates[targetCurrency] || 1.0;
                            const amountLocal = amountUsd * rateLocal;
                            
                            if (targetCurrency === originalCurrency) {
                              return `${originalCurrency} ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(c.monto)}${originalCurrency !== 'USD' ? ` / USD ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountUsd)}` : ''}`;
                            } else {
                              return `${targetCurrency} ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountLocal)} / USD ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountUsd)}`;
                            }
                          } else {
                            return `${originalCurrency} ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(c.monto)}`;
                          }
                        })()}
                      </span>
                    )}
                    {c.renovacionAutomatica && !isHistorico && (
                      <span className="badge bg-primary bg-opacity-10 text-primary border small fw-normal">
                        <i className="bi bi-arrow-repeat me-1"></i>Renovación Aut.
                      </span>
                    )}
                  </div>
                  <div className="small text-muted mb-2 d-flex align-items-center flex-wrap gap-2">
                    <span>
                      <i className="bi bi-calendar3 me-1"></i> {inicioStr} - {finStr}
                    </span>
                    {!isHistorico && diasRestantesStr && (
                      <span className={`badge ${diasRestantesStr.includes('Vence') ? 'bg-light text-dark border' : 'bg-danger bg-opacity-10 text-danger border-danger border'} small fw-normal`}>
                        {diasRestantesStr}
                      </span>
                    )}
                  </div>
                  
                  {c.responsableRenovacion && !isHistorico && (
                    <div className="small mb-2" style={{ fontSize: '0.75rem' }}>
                      <span className="text-muted">Account Manager:</span> <strong className="text-dark">{c.responsableRenovacion}</strong>
                      <span className="badge bg-light text-dark border ms-2">Renovación: {c.estadoRenovacion || 'Pendiente'}</span>
                    </div>
                  )}
                  
                  {c.notas && (
                    <div className="bg-light p-2 rounded small text-muted border-start border-2 border-primary mb-2" style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap' }}>
                      <i className="bi bi-chat-left-text me-1"></i> {c.notas}
                    </div>
                  )}

                  {c.camposDinamicos && Object.keys(c.camposDinamicos).length > 0 && (
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {Object.entries(c.camposDinamicos).map(([key, val]) => {
                        const config = camposConfig.find(cc => cc.key === key);
                        const label = config ? config.nombre : key;
                        if (!val) return null;
                        return (
                          <span key={key} className="badge bg-light text-dark border px-2 py-1 rounded-pill small fw-normal" style={{ fontSize: '0.7rem' }}>
                            <strong>{label}:</strong> {val}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  
                  {(c.driveLink || (c.adjuntos && c.adjuntos.length > 0)) && (
                    <div className="mt-1 d-flex flex-wrap gap-1">
                      {c.driveLink && (
                        <a 
                          href={c.driveLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="badge bg-success bg-opacity-10 text-success text-decoration-none border d-inline-flex align-items-center gap-1"
                        >
                          <i className="bi bi-google"></i> Carpeta Drive
                        </a>
                      )}
                      {c.adjuntos && c.adjuntos.map((adj, index) => (
                        <a 
                          key={index} 
                          href={adj.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="badge bg-primary bg-opacity-10 text-primary text-decoration-none border d-inline-flex align-items-center gap-1"
                        >
                          <i className="bi bi-paperclip"></i> {adj.nombre}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-end flex-shrink-0">
                  {isHistorico ? (
                    <div className="mb-2">
                      {c.tipoDocumentoLegal === 'adenda' ? (
                        <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-1.5 rounded-pill small fw-bold d-inline-flex align-items-center gap-1">
                          <i className="bi bi-paperclip"></i> Adenda Registrada
                        </span>
                      ) : c.estadoContrato === 'finalizado' ? (
                        <span className="badge bg-secondary text-white px-3 py-1.5 rounded-pill small fw-bold d-inline-flex align-items-center gap-1">
                          <i className="bi bi-flag-fill"></i> Contrato Finalizado
                        </span>
                      ) : c.estadoContrato === 'cancelado' ? (
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-1.5 rounded-pill small fw-bold d-inline-flex align-items-center gap-1">
                          <i className="bi bi-x-circle"></i> Cancelado
                        </span>
                      ) : (
                        <span className="badge bg-light text-dark border border-secondary border-opacity-50 px-3 py-1.5 rounded-pill small fw-bold d-inline-flex align-items-center gap-1">
                          <i className="bi bi-clock-history text-secondary"></i> Reemplazado / Renovado
                        </span>
                      )}
                    </div>
                  ) : (
                    <SLAIndicator estadoSLA={c.estadoSLA} />
                  )}

                  <div className="d-flex align-items-center justify-content-end gap-1 mt-1">
                    <button 
                      className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1"
                      onClick={() => onViewDetail?.(c)}
                      title="Ver Expediente Completo"
                    >
                      <i className="bi bi-eye"></i> Ver Detalle
                    </button>
                    {!isHistorico && (
                      <>
                        <button 
                          className="btn btn-sm btn-outline-info rounded-pill"
                          onClick={() => handleTriggerIA(c.id)}
                          disabled={isAnalyzing || iaPausada || !hasPermission?.('actions', 'disparar_ia')}
                          title={iaPausada ? "Servicio IA Pausado Temporalmente" : !hasPermission?.('actions', 'disparar_ia') ? "No tienes permisos para disparar análisis de IA" : "Auditoría IA"}
                        >
                          {isAnalyzing ? (
                            <><span className="spinner-border spinner-border-sm"></span></>
                          ) : (
                            <><i className="bi bi-stars"></i> Evaluar IA</>
                          )}
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-secondary rounded-pill px-2"
                          onClick={() => handleEdit(c)}
                          title={!hasPermission?.('actions', 'editar_contrato') ? "No tienes permisos para editar contratos" : "Editar contrato"}
                          disabled={!hasPermission?.('actions', 'editar_contrato')}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                      </>
                    )}

                    <button 
                      className="btn btn-sm btn-outline-danger rounded-pill px-2"
                      onClick={() => handleDelete(c.id)}
                      title={!hasPermission?.('actions', 'eliminar_contrato') ? "No tienes permisos para eliminar contratos" : "Eliminar contrato"}
                      disabled={!hasPermission?.('actions', 'eliminar_contrato')}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>

              {!isHistorico && c.analisisRiesgo && !isAnalyzing && (
                <div className="mt-3 p-3 bg-light rounded-3 border">
                  <div className="d-flex align-items-center mb-1">
                    <i className="bi bi-robot text-primary me-2"></i>
                    <h6 className="mb-0 fw-bold small text-dark">LUXIA IA · Auditoría Documental</h6>
                    <div className="ms-auto">
                      {renderRiesgoBadge(c.analisisRiesgo.riesgo)}
                    </div>
                  </div>
                  <p className="small text-muted mb-0 mt-2">
                    {c.analisisRiesgo.justificacion}
                  </p>
                </div>
              )}
              
              {c.aiStatus === 'no_analizado' && !c.analisisRiesgo && (
                <div className="mt-2 p-2 bg-secondary bg-opacity-10 border border-secondary border-opacity-25 rounded-3 d-inline-flex align-items-center">
                  <i className="bi bi-robot text-secondary me-2"></i>
                  <span className="small text-secondary fw-bold">Documento no analizado por LUXIA IA (IA Pausada)</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
