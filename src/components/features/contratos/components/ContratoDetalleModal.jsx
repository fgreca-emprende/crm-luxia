import React from 'react';

export function ContratoDetalleModal({
  show,
  onClose,
  contrato,
  camposConfig = [],
  exchangeRates = {},
  clientePais = ''
}) {
  if (!show || !contrato) return null;

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

  const inicioStr = contrato.fechaInicio?.toDate?.().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) || (contrato.fechaInicio ? new Date(contrato.fechaInicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A');
  const finStr = contrato.fechaVencimiento?.toDate?.().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) || (contrato.fechaVencimiento ? new Date(contrato.fechaVencimiento).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A');

  const renderRiesgoBadge = (riesgo) => {
    if (riesgo === 'Green') return <span className="badge bg-success px-3 py-1 rounded-pill">Urgencia Baja</span>;
    if (riesgo === 'Yellow') return <span className="badge bg-warning text-dark px-3 py-1 rounded-pill">Urgencia Media</span>;
    if (riesgo === 'Red') return <span className="badge bg-danger px-3 py-1 rounded-pill">Urgencia Alta</span>;
    return null;
  };

  const isVigente = contrato.esContratoVigente === true;
  const hasFiles = (contrato.driveLink && contrato.driveLink.trim() !== '') || (contrato.adjuntos && contrato.adjuntos.length > 0);

  return (
    <div 
      className="modal fade show d-block" 
      tabIndex="-1" 
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          
          {/* MODAL HEADER */}
          <div className="modal-header bg-white border-bottom p-3 px-4 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                <i className="bi bi-file-earmark-text fs-5"></i>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h6 className="modal-title fw-bold text-dark mb-0">
                    {contrato.nombre || contrato.tipoServicio || 'Expediente de Contrato'}
                  </h6>
                  {contrato.versionContrato && (
                    <span className="badge bg-secondary bg-opacity-15 text-dark border rounded-pill extra-small">
                      v{contrato.versionContrato}
                    </span>
                  )}
                </div>
                <span className="small text-muted" style={{ fontSize: '0.78rem' }}>
                  {isVigente ? '🟢 Contrato Regulador Vigente' : '📜 Expediente Histórico / Archivado'}
                </span>
              </div>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            ></button>
          </div>

          {/* MODAL BODY */}
          <div className="modal-body p-4 bg-light" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            
            {/* CARD 1: ESTADO Y MONTO */}
            <div className="card border-0 shadow-xs rounded-3 mb-3">
              <div className="card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-2 bg-white rounded-3 border">
                <div>
                  <span className="extra-small text-muted d-block text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem' }}>
                    Estado del Acuerdo
                  </span>
                  {isVigente ? (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-1 fw-bold">
                      <i className="bi bi-check-circle-fill me-1"></i> Regulador Vigente
                    </span>
                  ) : (
                    <span className="badge bg-light text-dark border border-secondary border-opacity-50 rounded-pill px-3 py-1 fw-bold">
                      <i className="bi bi-clock-history me-1 text-secondary"></i> Histórico / Reemplazado
                    </span>
                  )}
                </div>

                {contrato.monto !== undefined && contrato.monto > 0 && (
                  <div className="text-end">
                    <span className="extra-small text-muted d-block text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem' }}>
                      Valor del Contrato
                    </span>
                    <span className="fs-5 fw-bold text-success">
                      {(() => {
                        const originalCurrency = contrato.moneda || 'USD';
                        const rateOriginal = contrato.tipoCambioUSD || exchangeRates[originalCurrency] || 1.0;
                        const amountUsd = contrato.montoUSD !== undefined && contrato.montoUSD !== null && contrato.montoUSD > 0
                          ? contrato.montoUSD
                          : Number(contrato.monto) / rateOriginal;

                        if (clientePais) {
                          const targetCurrency = getCountryCurrency(clientePais);
                          const rateLocal = exchangeRates[targetCurrency] || 1.0;
                          const amountLocal = amountUsd * rateLocal;
                          return `${targetCurrency} ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountLocal)} (USD ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountUsd)})`;
                        } else {
                          return `${originalCurrency} ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(contrato.monto)}`;
                        }
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: VIGENCIA Y RESPONSABLE */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <div className="p-3 bg-white rounded-3 border h-100">
                  <span className="extra-small text-muted d-block text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem' }}>
                    <i className="bi bi-calendar3 me-1 text-primary"></i> Período de Vigencia
                  </span>
                  <div className="fw-bold text-dark mb-1">{inicioStr} ➔ {finStr}</div>
                  {contrato.renovacionAutomatica ? (
                    <span className="badge bg-primary bg-opacity-10 text-primary border rounded-pill extra-small">
                      <i className="bi bi-arrow-repeat me-1"></i> Renovación Automática Activada
                    </span>
                  ) : (
                    <span className="badge bg-light text-muted border rounded-pill extra-small">
                      Sin Renovación Automática
                    </span>
                  )}
                </div>
              </div>

              <div className="col-md-6">
                <div className="p-3 bg-white rounded-3 border h-100">
                  <span className="extra-small text-muted d-block text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem' }}>
                    <i className="bi bi-person-badge me-1 text-primary"></i> Responsabilidad Comercial
                  </span>
                  <div className="fw-bold text-dark mb-1">{contrato.responsableRenovacion || 'No asignado'}</div>
                  <span className="badge bg-light text-dark border extra-small">
                    Estado Renovación: {contrato.estadoRenovacion || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 3: PARÁMETROS COMERCIALES Y DE OPERACIÓN */}
            <div className="p-3 bg-white rounded-3 border mb-3">
              <span className="extra-small text-muted d-block text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem' }}>
                <i className="bi bi-briefcase me-1 text-primary"></i> Datos Comerciales y Operativos
              </span>
              <div className="row g-2 text-dark small">
                <div className="col-md-4">
                  <span className="text-muted extra-small d-block">Tipo de Servicio:</span>
                  <strong className="text-dark">{contrato.tipoServicio || 'General'}</strong>
                </div>
                <div className="col-md-4">
                  <span className="text-muted extra-small d-block">Origen Venta:</span>
                  <strong className="text-dark">{contrato.origenVenta || 'N/A'}</strong>
                </div>
                <div className="col-md-4">
                  <span className="text-muted extra-small d-block">Modelo Facturación:</span>
                  <strong className="text-dark">{contrato.modeloFacturacion || 'Recurrente'}</strong>
                </div>
                {contrato.volumenMensualProyectado && (
                  <div className="col-md-4 mt-2">
                    <span className="text-muted extra-small d-block">Superficie / Volumen Proyectado:</span>
                    <strong className="text-dark">{Number(contrato.volumenMensualProyectado).toLocaleString()} Has / Lts</strong>
                  </div>
                )}
                <div className="col-md-8 mt-2 d-flex align-items-center gap-2 flex-wrap">
                  {contrato.esUnUpsell && (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-1 extra-small fw-bold">
                      <i className="bi bi-graph-up-arrow me-1"></i> Oportunidad Upsell
                    </span>
                  )}
                  {contrato.requiereIntegracion && (
                    <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 rounded-pill px-2 py-1 extra-small fw-bold">
                      <i className="bi bi-code-slash me-1"></i> Requiere Integración API
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CARD 4: ADJUNTOS Y EXPEDIENTE DIGITAL */}
            <div className="p-3 bg-white rounded-3 border mb-3">
              <span className="extra-small text-muted d-block text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem' }}>
                <i className="bi bi-paperclip me-1 text-primary"></i> Expediente Digital & Documentos Adjuntos
              </span>
              {hasFiles ? (
                <div className="d-flex flex-wrap gap-2">
                  {contrato.driveLink && (
                    <a 
                      href={contrato.driveLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-2"
                    >
                      <i className="bi bi-google"></i> Carpeta en Google Drive
                    </a>
                  )}
                  {contrato.adjuntos && contrato.adjuntos.map((adj, idx) => (
                    <a 
                      key={idx} 
                      href={adj.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-2"
                    >
                      <i className="bi bi-file-earmark-pdf"></i> {adj.nombre}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="alert alert-light border border-dashed py-2.5 px-3 mb-0 text-muted extra-small d-flex align-items-center gap-2 rounded-3">
                  <i className="bi bi-folder2-open fs-5 text-secondary"></i>
                  <span>No hay archivos PDF cargados ni enlace a carpeta de Google Drive asociados a esta versión.</span>
                </div>
              )}
            </div>

            {/* CARD 5: CAMPOS DINÁMICOS Y ATRIBUTOS PERSONALIZADOS */}
            <div className="p-3 bg-white rounded-3 border mb-3">
              <span className="extra-small text-muted d-block text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem' }}>
                <i className="bi bi-sliders me-1 text-primary"></i> Atributos Personalizados y Campos Dinámicos
              </span>
              {contrato.camposDinamicos && Object.keys(contrato.camposDinamicos).some(k => !!contrato.camposDinamicos[k]) ? (
                <div className="d-flex flex-wrap gap-2">
                  {Object.entries(contrato.camposDinamicos).map(([key, val]) => {
                    if (!val) return null;
                    const config = camposConfig.find(cc => cc.key === key);
                    const label = config ? config.nombre : key;
                    return (
                      <span key={key} className="badge bg-light text-dark border px-3 py-2 rounded-3 text-start">
                        <strong className="text-muted me-1">{label}:</strong> <span className="fw-bold">{val}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="alert alert-light border border-dashed py-2.5 px-3 mb-0 text-muted extra-small d-flex align-items-center gap-2 rounded-3">
                  <i className="bi bi-sliders fs-5 text-secondary"></i>
                  <span>Sin valores en campos dinámicos personalizados asociados a esta versión.</span>
                </div>
              )}
            </div>

            {/* CARD 6: NOTAS Y OBSERVACIONES */}
            {contrato.notas && (
              <div className="p-3 bg-white rounded-3 border mb-3">
                <span className="extra-small text-muted d-block text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem' }}>
                  <i className="bi bi-chat-left-text me-1 text-primary"></i> Observaciones y Notas
                </span>
                <p className="small text-dark mb-0 style-pre-line" style={{ whiteSpace: 'pre-wrap' }}>
                  {contrato.notas}
                </p>
              </div>
            )}

            {/* CARD 7: LUXIA IA AUDITORÍA */}
            {contrato.analisisRiesgo ? (
              <div className="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-robot text-primary fs-5"></i>
                    <h6 className="mb-0 fw-bold small text-dark">LUXIA IA · Auditoría Documental</h6>
                  </div>
                  {renderRiesgoBadge(contrato.analisisRiesgo.riesgo)}
                </div>
                <p className="small text-dark mb-0 mt-1">
                  {contrato.analisisRiesgo.justificacion}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-white border rounded-3 text-muted extra-small d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-robot text-secondary fs-5"></i>
                  <span>Sin reporte de auditoría generado por LUXIA IA.</span>
                </div>
              </div>
            )}

          </div>

          {/* MODAL FOOTER */}
          <div className="modal-footer bg-white border-top p-3 d-flex justify-content-end">
            <button 
              type="button" 
              className="btn btn-sm btn-secondary rounded-pill px-4 fw-bold"
              onClick={onClose}
            >
              Cerrar Expediente
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
