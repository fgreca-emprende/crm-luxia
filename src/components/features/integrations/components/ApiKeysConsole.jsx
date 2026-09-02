import { useState } from 'react';
import { useApiKeys } from '../hooks/useApiKeys';
import { useToast } from '../../../ui/ToastProvider';

export function ApiKeysConsole() {
  const { showAlert } = useToast();
  const {
    apiKeys,
    loadingKeys,
    generatingKey,
    fetchApiKeys,
    handleToggleKeyDebug,
    handleToggleKeyActive,
    handleGenerateApiKey
  } = useApiKeys();

  const [newSystemId, setNewSystemId] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState({ read: true, write: false });
  const [newKeyDebugMode, setNewKeyDebugMode] = useState(false);
  const [generatedKeyReveal, setGeneratedKeyReveal] = useState('');
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const toggleEndpoint = (id) => {
    setExpandedEndpoint(prev => prev === id ? null : id);
  };

  const onGenerate = async () => {
    const key = await handleGenerateApiKey(newSystemId, newKeyPermissions, newKeyDebugMode);
    if (key) {
      setGeneratedKeyReveal(key);
      setNewSystemId('');
      setNewKeyPermissions({ read: true, write: false });
      setNewKeyDebugMode(false);
    }
  };

  return (
    <div className="apple-card border rounded-4 position-relative overflow-hidden w-100 shadow-sm" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
      <div className="position-absolute top-0 start-0 w-100" style={{ height: '4px', backgroundColor: 'var(--apple-blue)' }}></div>

      <div className="card-body p-4 p-xl-5 text-start">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="rounded p-2 border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
              <i className="bi bi-code-slash fs-3" style={{ color: 'var(--apple-blue)' }}></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0" style={{ color: 'var(--apple-text-primary)' }}>Consola de API e Integración B2B</h5>
              <span className="small text-muted">Documentación y Monitoreo de APIs Inbound para ERPs, AgTechs y Plataformas Externas</span>
            </div>
          </div>
        </div>

        <p className="small text-muted mb-4">
          Permite a sistemas externos (ERPs como SAP/Finnegans, plataformas AgTech, formularios web y aplicaciones móviles) leer y escribir datos en LUXIA CRM.
        </p>

        <div className="alert alert-primary bg-primary-subtle text-primary-emphasis border border-primary-subtle rounded-3 p-3 mb-4 d-flex align-items-start gap-3">
          <i className="bi bi-info-circle-fill fs-5 mt-0.5"></i>
          <div className="small flex-grow-1">
            <strong>Información de Conexión:</strong>
            <div className="mt-1">
              <strong>Base URL:</strong> <code className="px-2 py-0.5 rounded border font-monospace" style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}>{apiBaseUrl}</code>
            </div>
            <div className="mt-1">
              <strong>Headers Requeridos:</strong>
              <ul className="m-0 ps-3">
                <li><code className="font-monospace">x-api-key: TU_API_KEY</code></li>
                <li><code className="font-monospace">Content-Type: application/json</code></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Columna Izquierda: Gestión de API Keys */}
          <div className="col-lg-5">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0" style={{ fontSize: '0.9rem', color: 'var(--apple-text-primary)' }}>API Keys Registradas</h6>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill px-2.5"
                onClick={fetchApiKeys}
                disabled={loadingKeys}
                style={{ fontSize: '0.72rem' }}
              >
                {loadingKeys ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : <i className="bi bi-arrow-clockwise"></i>}
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="text-muted small text-center py-4 rounded border border-dashed px-3" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                {loadingKeys ? 'Cargando claves de API...' : 'No hay API Keys registradas en el sistema. Genera tu primera clave abajo.'}
              </div>
            ) : (
              <div className="d-flex flex-column gap-3 overflow-auto" style={{ maxHeight: '420px', paddingRight: '4px' }}>
                {apiKeys.map((apiKeyDoc) => (
                  <div key={apiKeyDoc.id} className="border rounded-3 p-3 shadow-2xs" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span className="fw-bold d-block mb-1" style={{ fontSize: '0.85rem', color: 'var(--apple-text-primary)' }}>
                          {apiKeyDoc.systemId}
                        </span>
                        <div className="d-flex gap-2 align-items-center flex-wrap">
                          {apiKeyDoc.permissions?.read && <span className="badge bg-secondary-subtle text-secondary border rounded-pill" style={{ fontSize: '0.65rem' }}>Read</span>}
                          {apiKeyDoc.permissions?.write && <span className="badge bg-primary-subtle text-primary border rounded-pill" style={{ fontSize: '0.65rem' }}>Write</span>}
                          {apiKeyDoc.active ? (
                            <span className="badge bg-success-subtle text-success border rounded-pill" style={{ fontSize: '0.65rem' }}>Activa</span>
                          ) : (
                            <span className="badge bg-danger-subtle text-danger border rounded-pill" style={{ fontSize: '0.65rem' }}>Inactiva</span>
                          )}
                        </div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          checked={apiKeyDoc.active}
                          onChange={(e) => handleToggleKeyActive(apiKeyDoc.id, e.target.checked)}
                          title={apiKeyDoc.active ? 'Desactivar API Key' : 'Activar API Key'}
                        />
                      </div>
                    </div>

                    <div className="mb-2">
                      <span className="text-muted extra-small d-block mb-1" style={{ fontSize: '0.7rem' }}>API Key Hash:</span>
                      <code className="p-1 rounded border extra-small font-monospace d-block text-truncate" style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}>
                        {apiKeyDoc.keyMask || apiKeyDoc.hash ? `${apiKeyDoc.hash?.substring(0, 16)}...` : 'Key en formato seguro'}
                      </code>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top" style={{ borderColor: 'var(--apple-border)' }}>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          id={`debug_${apiKeyDoc.id}`}
                          checked={apiKeyDoc.debugMode || false}
                          onChange={(e) => handleToggleKeyDebug(apiKeyDoc.id, e.target.checked)}
                        />
                        <label className="form-check-label extra-small text-muted ms-1" htmlFor={`debug_${apiKeyDoc.id}`}>
                          Modo Depuración
                        </label>
                      </div>

                      <span className="text-muted extra-small">
                        {apiKeyDoc.createdAt ? new Date(apiKeyDoc.createdAt.toDate ? apiKeyDoc.createdAt.toDate() : apiKeyDoc.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-top" style={{ borderColor: 'var(--apple-border)' }}>
              <h6 className="fw-bold mb-3" style={{ fontSize: '0.9rem', color: 'var(--apple-text-primary)' }}>Generar Nueva API Key</h6>
              
              {generatedKeyReveal && (
                <div className="alert alert-success border-0 shadow-sm rounded-3 p-3 mb-3">
                  <div className="d-flex align-items-start gap-2">
                    <i className="bi bi-shield-check-fill fs-5 mt-0.5 text-success"></i>
                    <div className="small flex-grow-1">
                      <strong>¡API Key Generada Exitosamente!</strong>
                      <div className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                        Copia esta clave ahora. Por seguridad, no volverás a ver el valor completo.
                      </div>
                      
                      <div className="input-group mb-2">
                        <input
                          type="text"
                          className="form-control form-control-sm font-monospace"
                          style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)' }}
                          value={generatedKeyReveal}
                          readOnly
                        />
                        <button
                          className="btn btn-sm btn-outline-success"
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedKeyReveal);
                            showAlert('API Key copiada al portapapeles', 'success');
                          }}
                        >
                          <i className="bi bi-clipboard"></i>
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        className="btn btn-sm btn-success rounded-pill px-3 mt-1 fw-bold"
                        style={{ fontSize: '0.72rem' }}
                        onClick={() => setGeneratedKeyReveal('')}
                      >
                        Entendido
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-3 border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                <div className="mb-3">
                  <label className="form-label small fw-bold" style={{ color: 'var(--apple-text-primary)' }}>Identificador de Sistema</label>
                  <input
                    type="text"
                    className="form-control form-control-sm border"
                    style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
                    placeholder="Ej. ERP-SAP, Finnegans-Agro, AppTecnica"
                    value={newSystemId}
                    onChange={(e) => setNewSystemId(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold d-block" style={{ color: 'var(--apple-text-primary)' }}>Permisos Asignados</label>
                  <div className="d-flex gap-3">
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="perm_read"
                        checked={newKeyPermissions.read}
                        onChange={(e) => setNewKeyPermissions(prev => ({ ...prev, read: e.target.checked }))}
                      />
                      <label className="form-check-label small" htmlFor="perm_read" style={{ color: 'var(--apple-text-primary)' }}>Lectura (read)</label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="perm_write"
                        checked={newKeyPermissions.write}
                        onChange={(e) => setNewKeyPermissions(prev => ({ ...prev, write: e.target.checked }))}
                      />
                      <label className="form-check-label small" htmlFor="perm_write" style={{ color: 'var(--apple-text-primary)' }}>Escritura (write)</label>
                    </div>
                  </div>
                </div>

                <div className="mb-3 form-check form-switch">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    id="newKeyDebugMode"
                    checked={newKeyDebugMode}
                    onChange={(e) => setNewKeyDebugMode(e.target.checked)}
                  />
                  <label className="form-check-label small fw-bold ms-2" htmlFor="newKeyDebugMode" style={{ color: 'var(--apple-text-primary)' }}>
                    Activar Modo Depuración
                  </label>
                  <div className="form-text text-muted" style={{ fontSize: '0.72rem' }}>
                    Registra todas las peticiones exitosas para depuración. Peticiones de fallo (&ge; 400) se guardan siempre.
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-primary rounded-pill px-3 fw-bold shadow-sm"
                  onClick={onGenerate}
                  disabled={generatingKey}
                >
                  {generatingKey ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Generando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-plus-lg me-1"></i>Generar Clave
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Catálogo Interactivo de Endpoints Inbound */}
          <div className="col-lg-7 border-start ps-lg-4" style={{ borderColor: 'var(--apple-border)' }}>
            <h6 className="fw-bold mb-3" style={{ fontSize: '0.9rem', color: 'var(--apple-text-primary)' }}>Catálogo de Endpoints Inbound</h6>
            
            <div className="d-flex flex-column rounded-3 border overflow-hidden shadow-sm" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
              
              {/* Endpoint 1: POST /public/web-to-lead */}
              <div className="border-bottom" style={{ borderColor: 'var(--apple-border)' }}>
                <button
                  type="button"
                  className="w-100 text-start py-2.5 px-3 border-0 bg-transparent d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => toggleEndpoint('publicLead')}
                  style={{ background: expandedEndpoint === 'publicLead' ? 'var(--apple-surface-elevated)' : 'transparent' }}
                >
                  <div className="small font-monospace fw-bold text-primary">
                    <span className="badge bg-success me-2" style={{ fontSize: '0.65rem' }}>POST</span>/public/web-to-lead <span className="badge bg-info ms-2 text-dark" style={{ fontSize: '0.55rem' }}>Público</span>
                  </div>
                  <i className={`bi bi-chevron-${expandedEndpoint === 'publicLead' ? 'up' : 'down'} text-muted`}></i>
                </button>

                {expandedEndpoint === 'publicLead' && (
                  <div className="small text-muted p-3 border-top" style={{ fontSize: '0.78rem', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <p className="mb-2"><strong>[Público - Sin API Key]</strong> Ingestión directa de consultas comerciales desde la web oficial o landings de campaña fitosanitaria. Ejecuta scoring con LUXIA IA y asignación territorial Round-Robin.</p>
                    <strong>Cuerpo (JSON):</strong>
                    <pre className="bg-dark text-light p-2.5 rounded mt-1 font-monospace" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
{`{
  "nombreContacto": "Ing. Martín Rossi",
  "correo": "mrossi@agropecuaria-sur.com",
  "nombreEmpresa": "Agropecuaria del Sur S.A.",
  "telefono": "+5491144445555",
  "pais": "AR",
  "origen": "web_campana_soja",
  "notas": "Consulta por provisión de herbicidas y tratamiento de semillas para 4,500 Has.",
  "camposDinamicos": {
    "superficie_has": 4500,
    "cultivo_principal": "Soja"
  }
}`}
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 2: POST /v1/leads */}
              <div className="border-bottom" style={{ borderColor: 'var(--apple-border)' }}>
                <button
                  type="button"
                  className="w-100 text-start py-2.5 px-3 border-0 bg-transparent d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => toggleEndpoint('leads')}
                  style={{ background: expandedEndpoint === 'leads' ? 'var(--apple-surface-elevated)' : 'transparent' }}
                >
                  <div className="small font-monospace fw-bold" style={{ color: 'var(--apple-text-primary)' }}>
                    <span className="badge bg-success me-2" style={{ fontSize: '0.65rem' }}>POST</span>/v1/leads
                  </div>
                  <i className={`bi bi-chevron-${expandedEndpoint === 'leads' ? 'up' : 'down'} text-muted`}></i>
                </button>

                {expandedEndpoint === 'leads' && (
                  <div className="small text-muted p-3 border-top" style={{ fontSize: '0.78rem', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <p className="mb-2">Ingesta un nuevo prospecto calificado desde eventos (Expoagro, Agronea) o integraciones externas B2B.</p>
                    <strong>Cuerpo (JSON):</strong>
                    <pre className="bg-dark text-light p-2.5 rounded mt-1 font-monospace" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
{`{
  "nombreEmpresa": "Cooperativa Agrícola Ganadera Pampeana",
  "nombreContacto": "Esteban Larrea",
  "correo": "elarrea@coopampeana.com.ar",
  "telefono": "+5492302455667",
  "pais": "AR",
  "origen": "feria_agro",
  "notas": "Distribuidor regional interesado en fungicidas para trigo y cebada.",
  "camposDinamicos": {
    "superficie_has": 12000,
    "cultivo_principal": "Trigo"
  }
}`}
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 3: POST /v1/leads/bulk */}
              <div className="border-bottom" style={{ borderColor: 'var(--apple-border)' }}>
                <button
                  type="button"
                  className="w-100 text-start py-2.5 px-3 border-0 bg-transparent d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => toggleEndpoint('postBulkLeads')}
                  style={{ background: expandedEndpoint === 'postBulkLeads' ? 'var(--apple-surface-elevated)' : 'transparent' }}
                >
                  <div className="small font-monospace fw-bold" style={{ color: 'var(--apple-text-primary)' }}>
                    <span className="badge bg-success me-2" style={{ fontSize: '0.65rem' }}>POST</span>/v1/leads/bulk
                  </div>
                  <i className={`bi bi-chevron-${expandedEndpoint === 'postBulkLeads' ? 'up' : 'down'} text-muted`}></i>
                </button>

                {expandedEndpoint === 'postBulkLeads' && (
                  <div className="small text-muted p-3 border-top" style={{ fontSize: '0.78rem', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <p className="mb-2"><strong>[Integración Masiva]</strong> Carga por lotes de prospectos agropecuarios (hasta 100 por solicitud) con asignación territorial automática.</p>
                    <strong>Cuerpo (JSON):</strong>
                    <pre className="bg-dark text-light p-2.5 rounded mt-1 font-monospace" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
{`{
  "leads": [
    {
      "nombreEmpresa": "Establecimiento Don Joaquín S.A.",
      "nombreContacto": "Joaquín Benítez",
      "correo": "jbenitez@donjoaquin.com.ar",
      "pais": "AR",
      "origen": "base_productores_crea"
    }
  ]
}`}
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 4: POST /v1/clientes */}
              <div className="border-bottom" style={{ borderColor: 'var(--apple-border)' }}>
                <button
                  type="button"
                  className="w-100 text-start py-2.5 px-3 border-0 bg-transparent d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => toggleEndpoint('clientes')}
                  style={{ background: expandedEndpoint === 'clientes' ? 'var(--apple-surface-elevated)' : 'transparent' }}
                >
                  <div className="small font-monospace fw-bold" style={{ color: 'var(--apple-text-primary)' }}>
                    <span className="badge bg-success me-2" style={{ fontSize: '0.65rem' }}>POST</span>/v1/clientes
                  </div>
                  <i className={`bi bi-chevron-${expandedEndpoint === 'clientes' ? 'up' : 'down'} text-muted`}></i>
                </button>

                {expandedEndpoint === 'clientes' && (
                  <div className="small text-muted p-3 border-top" style={{ fontSize: '0.78rem', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <p className="mb-2"><strong>[Sincronización ERP]</strong> Crea o actualiza una cuenta (Productor, Distribuidor, Cooperativa) en la cartera activa de LUXIA.</p>
                    <strong>Cuerpo (JSON):</strong>
                    <pre className="bg-dark text-light p-2.5 rounded mt-1 font-monospace" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
{`{
  "nombreEmpresa": "Agronomía Central del Litoral S.R.L.",
  "cuit": "30-71458923-9",
  "nombreContacto": "Ing. Gonzalo Martínez",
  "correo": "gmartinez@agrocentrallitoral.com",
  "telefono": "+5493424112233",
  "pais": "AR",
  "tier": "Tier 1",
  "comercialEmail": "asesor.litoral@luxia.com"
}`}
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 5: POST /v1/clientes/health-score */}
              <div className="border-bottom" style={{ borderColor: 'var(--apple-border)' }}>
                <button
                  type="button"
                  className="w-100 text-start py-2.5 px-3 border-0 bg-transparent d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => toggleEndpoint('postHealth')}
                  style={{ background: expandedEndpoint === 'postHealth' ? 'var(--apple-surface-elevated)' : 'transparent' }}
                >
                  <div className="small font-monospace fw-bold" style={{ color: 'var(--apple-text-primary)' }}>
                    <span className="badge bg-success me-2" style={{ fontSize: '0.65rem' }}>POST</span>/v1/clientes/health-score
                  </div>
                  <i className={`bi bi-chevron-${expandedEndpoint === 'postHealth' ? 'up' : 'down'} text-muted`}></i>
                </button>

                {expandedEndpoint === 'postHealth' && (
                  <div className="small text-muted p-3 border-top" style={{ fontSize: '0.78rem', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <p className="mb-2"><strong>[ERP / SISA / Créditos]</strong> Ingesta scores de salud comercial y riesgo crediticio de la cuenta (Green/Yellow/Red) y estado de canje de cereal.</p>
                    <strong>Cuerpo (JSON):</strong>
                    <pre className="bg-dark text-light p-2.5 rounded mt-1 font-monospace" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
{`{
  "clienteId": "CLI-88231",
  "riesgo": "Green", // Green, Yellow, Red
  "analisis": "Línea de crédito aprobada para Campaña 2026/27. Canje cereal garantizado.",
  "facturacionMensualUSD": 45000
}`}
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 6: POST /v1/contratos */}
              <div className="border-bottom" style={{ borderColor: 'var(--apple-border)' }}>
                <button
                  type="button"
                  className="w-100 text-start py-2.5 px-3 border-0 bg-transparent d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => toggleEndpoint('contratos')}
                  style={{ background: expandedEndpoint === 'contratos' ? 'var(--apple-surface-elevated)' : 'transparent' }}
                >
                  <div className="small font-monospace fw-bold" style={{ color: 'var(--apple-text-primary)' }}>
                    <span className="badge bg-success me-2" style={{ fontSize: '0.65rem' }}>POST</span>/v1/contratos
                  </div>
                  <i className={`bi bi-chevron-${expandedEndpoint === 'contratos' ? 'up' : 'down'} text-muted`}></i>
                </button>

                {expandedEndpoint === 'contratos' && (
                  <div className="small text-muted p-3 border-top" style={{ fontSize: '0.78rem', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <p className="mb-2">Registra un contrato de suministro fitosanitario u orden de compra cerrada.</p>
                    <strong>Cuerpo (JSON):</strong>
                    <pre className="bg-dark text-light p-2.5 rounded mt-1 font-monospace" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
{`{
  "clienteId": "CLI-88231",
  "nombre": "Acuerdo Provisión Herbicidas & Fungicidas Soja 2026/27",
  "montoMensualMinimo": 85000,
  "fechaVencimiento": "2027-05-31",
  "modalidadPago": "Canje Cereal Soja Rosario"
}`}
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 7: POST /v1/entregas/notificacion */}
              <div className="border-bottom" style={{ borderColor: 'var(--apple-border)' }}>
                <button
                  type="button"
                  className="w-100 text-start py-2.5 px-3 border-0 bg-transparent d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => toggleEndpoint('postEntrega')}
                  style={{ background: expandedEndpoint === 'postEntrega' ? 'var(--apple-surface-elevated)' : 'transparent' }}
                >
                  <div className="small font-monospace fw-bold" style={{ color: 'var(--apple-text-primary)' }}>
                    <span className="badge bg-success me-2" style={{ fontSize: '0.65rem' }}>POST</span>/v1/entregas/notificacion
                  </div>
                  <i className={`bi bi-chevron-${expandedEndpoint === 'postEntrega' ? 'up' : 'down'} text-muted`}></i>
                </button>

                {expandedEndpoint === 'postEntrega' && (
                  <div className="small text-muted p-3 border-top" style={{ fontSize: '0.78rem', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <p className="mb-2"><strong>[Suministro & Operaciones]</strong> Notifica la entrega de remito fitosanitario en campo o depósito.</p>
                    <strong>Cuerpo (JSON):</strong>
                    <pre className="bg-dark text-light p-2.5 rounded mt-1 font-monospace" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
{`{
  "remitoNumero": "REM-0001-00045231",
  "clienteId": "CLI-88231",
  "estadoEntrega": "entregado", // entregado, en_transito
  "fechaEntrega": "2026-09-01T14:30:00Z",
  "receptorNombre": "Capataz / Ing. Agrónomo de Campo"
}`}
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 8: GET /v1/alertas */}
              <div>
                <button
                  type="button"
                  className="w-100 text-start py-2.5 px-3 border-0 bg-transparent d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => toggleEndpoint('alertas')}
                  style={{ background: expandedEndpoint === 'alertas' ? 'var(--apple-surface-elevated)' : 'transparent' }}
                >
                  <div className="small font-monospace fw-bold" style={{ color: 'var(--apple-text-primary)' }}>
                    <span className="badge bg-primary me-2" style={{ fontSize: '0.65rem' }}>GET</span>/v1/alertas
                  </div>
                  <i className={`bi bi-chevron-${expandedEndpoint === 'alertas' ? 'up' : 'down'} text-muted`}></i>
                </button>

                {expandedEndpoint === 'alertas' && (
                  <div className="small text-muted p-3 border-top" style={{ fontSize: '0.78rem', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                    <p className="mb-0">Consulta alertas activas operativas y comerciales generadas por el motor de LUXIA IA para clientes y cuentas.</p>
                  </div>
                )}
              </div>

            </div>
            
            <div className="mt-4 p-3 rounded-3 border text-center" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
              <i className="bi bi-shield-lock-fill text-muted me-2"></i>
              <span className="small text-muted" style={{ fontSize: '0.78rem' }}>A excepción de <code className="font-monospace">/public/web-to-lead</code>, las llamadas a la API requieren el header <code className="font-monospace">x-api-key</code>.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
