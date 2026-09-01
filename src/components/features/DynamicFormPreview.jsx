

export function DynamicFormPreview({ campos, secciones, entidadPreview }) {
  // Filtrar secciones por entidad
  const seccionesDeEntidad = secciones.filter(s => s.entidad === entidadPreview).sort((a, b) => a.orden - b.orden);
  
  // Agrupar campos por sección
  const getEntidadDeCampo = (campo) => {
    if (campo.seccionId) {
      const sec = secciones.find(s => s.id === campo.seccionId);
      if (sec) return sec.entidad;
    }
    return campo.entidad || 'cliente';
  };

  const camposAgrupados = {};
  campos.forEach(campo => {
    const entidad = getEntidadDeCampo(campo);
    if (entidad === entidadPreview) {
      const sId = campo.seccionId || 'huerfanos';
      if (!camposAgrupados[sId]) camposAgrupados[sId] = [];
      camposAgrupados[sId].push(campo);
    }
  });

  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white h-100">
      <div className="card-header bg-transparent border-bottom-0 pt-4 pb-3 px-4 d-flex justify-content-between align-items-center">
        <div>
          <h6 className="fw-bold mb-0 text-dark">
            <i className="bi bi-eye text-primary me-2"></i>Live Preview
          </h6>
          <span className="small text-muted">Vista previa de cómo se verá el formulario</span>
        </div>
        <div>
          <span className={`badge fw-semibold ${
            entidadPreview === 'contrato' ? 'bg-info bg-opacity-10 text-info border border-info' :
            entidadPreview === 'contacto' ? 'bg-success bg-opacity-10 text-success border border-success' :
            entidadPreview === 'crm_actividad' ? 'bg-warning bg-opacity-10 text-warning border border-warning' :
            entidadPreview === 'lead' ? 'bg-success bg-opacity-10 text-success border border-success' :
            entidadPreview === 'oportunidad' ? 'bg-info bg-opacity-10 text-info border border-info' :
            entidadPreview === 'ticket' ? 'bg-danger bg-opacity-10 text-danger border border-danger' :
            'bg-primary bg-opacity-10 text-primary border border-primary'
          } rounded-pill px-3 py-1`}>
            {entidadPreview === 'contrato' ? (
              <><i className="bi bi-briefcase me-1"></i>Contrato</>
            ) : entidadPreview === 'contacto' ? (
              <><i className="bi bi-envelope me-1"></i>Contacto</>
            ) : entidadPreview === 'crm_actividad' ? (
              <><i className="bi bi-calendar-event me-1"></i>Actividad CRM</>
            ) : entidadPreview === 'lead' ? (
              <><i className="bi bi-person-plus me-1"></i>Lead</>
            ) : entidadPreview === 'oportunidad' ? (
              <><i className="bi bi-bar-chart-steps me-1"></i>Oportunidad</>
            ) : entidadPreview === 'ticket' ? (
              <><i className="bi bi-ticket-perforated me-1"></i>Ticket CX</>
            ) : (
              <><i className="bi bi-person me-1"></i>Cliente</>
            )}
          </span>
        </div>
      </div>
      <div className="card-body p-4 bg-light bg-opacity-50" style={{ overflowY: 'auto', maxHeight: '600px' }}>
        
        {seccionesDeEntidad.length === 0 && (!camposAgrupados['huerfanos'] || camposAgrupados['huerfanos'].length === 0) ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-layout-wtf fs-1 text-secondary opacity-50"></i>
            <p className="mt-3 mb-0 small">No hay secciones ni campos configurados para esta entidad.</p>
          </div>
        ) : (
          <>
            {seccionesDeEntidad.map(seccion => {
              const camposSeccion = (camposAgrupados[seccion.id] || []).sort((a, b) => a.orden - b.orden);
              
              if (camposSeccion.length === 0) return (
                <div key={seccion.id} className="mb-4 bg-white p-3 rounded-4 shadow-sm border border-light border-dashed">
                  <h6 className="fw-bold mb-0 text-muted">
                    <i className={`bi ${seccion.icono || 'bi-list-ul'} me-2`}></i> 
                    {seccion.nombre} <span className="small fw-normal ms-2">(Sección vacía)</span>
                  </h6>
                </div>
              );
              
              return (
                <div key={seccion.id} className="mb-4 bg-white p-3 rounded-4 shadow-sm border border-light">
                  <h6 className="fw-bold mb-3 text-dark border-bottom pb-2">
                    <i className={`bi ${seccion.icono || 'bi-list-ul'} text-primary me-2`}></i> 
                    {seccion.nombre}
                  </h6>
                  <div className="row g-3">
                    {camposSeccion.map(campo => (
                      <div key={campo.id} className="col-12">
                        <label className="form-label small fw-bold text-muted">
                          {campo.nombre} {campo.obligatorio && <span className="text-danger">*</span>}
                        </label>
                        {campo.tipo === 'select' ? (
                          <select className="form-select form-select-sm" disabled>
                            {campo.origenDatos && campo.origenDatos !== 'manual' ? (
                              <option>-- Catálogo: {campo.origenDatos} --</option>
                            ) : (
                              <>
                                <option>-- Seleccione --</option>
                                {(campo.opciones || []).map((opt, idx) => (
                                  <option key={idx}>{opt}</option>
                                ))}
                              </>
                            )}
                          </select>
                        ) : campo.tipo === 'checkbox' ? (
                          <div className="form-check mt-1">
                            <input 
                              type="checkbox"
                              className="form-check-input"
                              disabled
                            />
                            <label className="form-check-label small text-muted">
                              Marcar / Desmarcar [Checkbox]
                            </label>
                          </div>
                        ) : (
                          <input 
                            type={campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : campo.tipo === 'email' ? 'email' : 'text'}
                            className="form-control form-control-sm"
                            placeholder={`[${campo.tipo}]`}
                            disabled
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Campos huérfanos (si los hay) */}
            {(camposAgrupados['huerfanos'] || []).length > 0 && (
              <div className="mb-4 bg-white p-3 rounded-4 shadow-sm border border-warning border-opacity-50">
                <h6 className="fw-bold mb-3 text-warning border-bottom pb-2">
                  <i className="bi bi-exclamation-triangle me-2"></i> Información Adicional (Sin Sección)
                </h6>
                <div className="row g-3">
                  {(camposAgrupados['huerfanos'] || []).sort((a,b) => a.orden - b.orden).map(campo => (
                    <div key={campo.id} className="col-12">
                      <label className="form-label small fw-bold text-muted">{campo.nombre}</label>
                      <input type="text" className="form-control form-control-sm" placeholder="[Huérfano]" disabled />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
