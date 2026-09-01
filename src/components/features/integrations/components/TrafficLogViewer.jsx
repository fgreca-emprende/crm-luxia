import { useState, useEffect } from 'react';
import { useIntegrationLogs } from '../hooks/useIntegrationLogs';
import { useToast } from '../../../ui/ToastProvider';
import { ConfirmModal } from '../../admin/ConfirmModal';

export function TrafficLogViewer({ mode = 'api' }) {
  const { showAlert } = useToast();
  const {
    webhookLogs,
    loadingLogs,
    fetchWebhookLogs,
    clearWebhookLogs,
    apiLogs,
    loadingApiLogs,
    fetchApiLogs,
    clearApiLogs
  } = useIntegrationLogs();

  const [activeSubTab, setActiveSubTab] = useState(mode); // 'api' or 'webhooks'

  // Sincronizar activeSubTab si mode cambia
  useEffect(() => {
    setActiveSubTab(mode);
  }, [mode]);

  // Search & Filter state
  const [webhookSearchQuery, setWebhookSearchQuery] = useState('');
  const [webhookTimeFilter, setWebhookTimeFilter] = useState('all'); // 'all', '1h', '24h', '7d'
  const [logFilter, setLogFilter] = useState('all'); // 'all' or 'errors'
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [showConfirmClearWebhooks, setShowConfirmClearWebhooks] = useState(false);

  const [apiSearchQuery, setApiSearchQuery] = useState('');
  const [apiTimeFilter, setApiTimeFilter] = useState('all'); // 'all', '1h', '24h', '7d'
  const [apiLogFilter, setApiLogFilter] = useState('all'); // 'all' or 'errors'
  const [expandedApiLogId, setExpandedApiLogId] = useState(null);
  const [showConfirmClearApiLogs, setShowConfirmClearApiLogs] = useState(false);

  useEffect(() => {
    if (mode === 'api' || mode === 'both') fetchApiLogs();
    if (mode === 'webhooks' || mode === 'both') fetchWebhookLogs();
  }, [fetchApiLogs, fetchWebhookLogs, mode]);

  // Filters for Webhook Logs
  const filteredWebhookLogs = webhookLogs.filter(log => {
    if (logFilter === 'errors' && log.statusCode < 400) return false;
    if (webhookTimeFilter !== 'all') {
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date((log.timestamp?.seconds * 1000) || log.timestamp);
      const now = new Date();
      const diffHours = (now - logDate) / (1000 * 60 * 60);
      if (webhookTimeFilter === '1h' && diffHours > 1) return false;
      if (webhookTimeFilter === '24h' && diffHours > 24) return false;
      if (webhookTimeFilter === '7d' && diffHours > 24 * 7) return false;
    }
    if (webhookSearchQuery.trim()) {
      const search = webhookSearchQuery.toLowerCase();
      const payloadStr = JSON.stringify(log.payload || {}).toLowerCase();
      const idMatch = log.id.toLowerCase().includes(search);
      if (!idMatch && !payloadStr.includes(search)) return false;
    }
    return true;
  });

  // Filters for API Logs
  const filteredApiLogs = apiLogs.filter(log => {
    if (apiLogFilter === 'errors' && log.statusCode < 400) return false;
    if (apiTimeFilter !== 'all') {
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date((log.timestamp?.seconds * 1000) || log.timestamp);
      const now = new Date();
      const diffHours = (now - logDate) / (1000 * 60 * 60);
      if (apiTimeFilter === '1h' && diffHours > 1) return false;
      if (apiTimeFilter === '24h' && diffHours > 24) return false;
      if (apiTimeFilter === '7d' && diffHours > 24 * 7) return false;
    }
    if (apiSearchQuery.trim()) {
      const search = apiSearchQuery.toLowerCase();
      const bodyStr = JSON.stringify(log.body || {}).toLowerCase();
      const queryStr = JSON.stringify(log.query || {}).toLowerCase();
      const idMatch = log.id.toLowerCase().includes(search);
      if (!idMatch && !bodyStr.includes(search) && !queryStr.includes(search)) return false;
    }
    return true;
  });

  return (
    <div className="card border-0 bg-white shadow-sm rounded-4 w-100">
      <div className="card-body p-4 p-xl-5">
        {mode === 'both' && (
          <div className="d-flex justify-content-between align-items-center mb-4">
            <ul className="nav nav-tabs border-0 gap-2 mb-0">
              <li className="nav-item">
                <button
                  className={`nav-link rounded-pill fw-bold px-3 py-1.5 border-0 ${activeSubTab === 'api' ? 'active bg-light text-dark shadow-sm' : 'text-muted'}`}
                  onClick={() => setActiveSubTab('api')}
                >
                  Inbound API Requests
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link rounded-pill fw-bold px-3 py-1.5 border-0 ${activeSubTab === 'webhooks' ? 'active bg-light text-dark shadow-sm' : 'text-muted'}`}
                  onClick={() => setActiveSubTab('webhooks')}
                >
                  Logs de Webhooks & Ingesta
                </button>
              </li>
            </ul>
          </div>
        )}


        {activeSubTab === 'api' && (
          <div>
            <div className="d-flex flex-column gap-2 mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Solicitudes de API Recientes</h6>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1"
                    onClick={() => setShowConfirmClearApiLogs(true)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    <i className="bi bi-trash3 me-1"></i>
                    Vaciar Logs
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1"
                    onClick={fetchApiLogs}
                    disabled={loadingApiLogs}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {loadingApiLogs ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    ) : (
                      <i className="bi bi-arrow-clockwise me-1"></i>
                    )}
                    Refrescar
                  </button>
                </div>
              </div>
              <div className="d-flex gap-2 align-items-center bg-light p-2 rounded border border-dashed">
                <input 
                  type="text" 
                  className="form-control form-control-sm rounded-pill" 
                  placeholder="Buscar ID, payload o ruta..." 
                  value={apiSearchQuery}
                  onChange={(e) => setApiSearchQuery(e.target.value)}
                  style={{ fontSize: '0.75rem', maxWidth: '250px' }}
                />
                <select
                  className="form-select form-select-sm rounded-pill"
                  style={{ fontSize: '0.75rem', width: 'auto' }}
                  value={apiTimeFilter}
                  onChange={(e) => setApiTimeFilter(e.target.value)}
                >
                  <option value="all">Cualquier momento</option>
                  <option value="1h">Última Hora</option>
                  <option value="24h">Últimas 24 Horas</option>
                  <option value="7d">Últimos 7 Días</option>
                </select>
                <select
                  className="form-select form-select-sm rounded-pill"
                  style={{ fontSize: '0.75rem', width: 'auto' }}
                  value={apiLogFilter}
                  onChange={(e) => setApiLogFilter(e.target.value)}
                >
                  <option value="all">Todas las peticiones</option>
                  <option value="errors">Solo errores</option>
                </select>
              </div>
            </div>

            {apiLogs.length === 0 ? (
              <div className="text-muted small text-center py-4 bg-light rounded border border-dashed px-3">
                {loadingApiLogs ? 'Cargando logs de API...' : 'No se registran peticiones de API recientes.'}
              </div>
            ) : (
              <div className="d-flex flex-column gap-2 webhook-logs-container" style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '4px' }}>
                {filteredApiLogs.length === 0 ? (
                  <div className="text-muted small text-center py-3 bg-light rounded border border-dashed px-3">
                    No hay logs que coincidan con el filtro seleccionado.
                  </div>
                ) : filteredApiLogs.map((log) => {
                  const isExpanded = expandedApiLogId === log.id;
                  let badgeBg = 'bg-success-subtle text-success border border-success';
                  if (log.statusCode === 401 || log.statusCode === 403) badgeBg = 'bg-warning-subtle text-warning-emphasis border border-warning';
                  else if (log.statusCode >= 400) badgeBg = 'bg-danger-subtle text-danger border border-danger';

                  return (
                    <div key={log.id} className="border rounded-3 p-2 bg-light shadow-sm">
                      <div 
                        className="d-flex justify-content-between align-items-center cursor-pointer" 
                        onClick={() => setExpandedApiLogId(isExpanded ? null : log.id)}
                        style={{ userSelect: 'none' }}
                      >
                        <div className="d-flex align-items-center gap-2 min-w-0 flex-wrap">
                          <span className={`badge ${badgeBg} font-monospace px-2 py-0.5`} style={{ fontSize: '0.7rem' }}>
                            {log.statusCode} {log.method}
                          </span>
                          <span className="small text-dark fw-bold font-monospace text-truncate" style={{ maxWidth: '180px' }} title={log.path}>
                            {log.path}
                          </span>
                          <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded" style={{ fontSize: '0.62rem' }}>
                            {log.systemId}
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                          <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                            {log.formattedDate}
                          </span>
                          <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} text-secondary`} style={{ fontSize: '0.75rem' }}></i>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-2 border-top">
                          <div className="d-flex justify-content-end mb-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark rounded-pill px-2.5 d-flex align-items-center gap-1"
                              style={{ fontSize: '0.72rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const successText = log.statusCode >= 200 && log.statusCode < 300 ? 'Exitoso' : 'Fallido';
                                const logMarkdown = [
                                  `### API Inbound Request Log [${log.statusCode} ${log.method} ${log.path}]`,
                                  `- **Fecha/Hora:** ${log.formattedDate}`,
                                  `- **Cliente Autorizado:** ${log.systemId}`,
                                  `- **Estado:** ${successText}`,
                                  log.response?.error ? `- **Detalle Error:** ${log.response.error}` : '',
                                  '- **Headers:**',
                                  '```json',
                                  JSON.stringify(log.headers || {}, null, 2),
                                  '```',
                                  '',
                                  '- **Query Parameters:**',
                                  '```json',
                                  JSON.stringify(log.query || {}, null, 2),
                                  '```',
                                  '',
                                  '- **Request Payload (Body):**',
                                  '```json',
                                  JSON.stringify(log.payload || {}, null, 2),
                                  '```',
                                  '',
                                  '- **Response Body (Retornado por Servidor):**',
                                  '```json',
                                  JSON.stringify(log.response || {}, null, 2),
                                  '```'
                                ].filter(Boolean).join('\n');
                                navigator.clipboard.writeText(logMarkdown);
                                showAlert('Detalles de API copiados en formato Markdown', 'success');
                              }}
                            >
                              <i className="bi bi-clipboard-data"></i> Copiar Detalles (Markdown)
                            </button>
                          </div>

                          {log.response?.error && (
                            <div className="alert alert-danger py-2 px-3 small mb-2 d-flex align-items-start gap-2 rounded-3 border-0">
                              <i className="bi bi-exclamation-triangle-fill fs-6 mt-0.5"></i>
                              <div>
                                <strong style={{ fontSize: '0.75rem' }}>Mensaje de Error Retornado:</strong>
                                <div style={{ fontSize: '0.72rem' }}>{log.response.error}</div>
                              </div>
                            </div>
                          )}

                          <div className="mb-2">
                            <span className="small fw-bold text-dark d-block mb-1" style={{ fontSize: '0.75rem' }}>Headers Recibidos:</span>
                            <div className="bg-white p-2 rounded border font-monospace text-muted" style={{ fontSize: '0.68rem', maxHeight: '110px', overflowY: 'auto' }}>
                              {Object.entries(log.headers || {}).map(([key, val]) => (
                                <div key={key} className="text-truncate">
                                  <span className="text-dark fw-bold">{key}:</span> {val}
                                </div>
                              ))}
                            </div>
                          </div>

                          {Object.keys(log.query || {}).length > 0 && (
                            <div className="mb-2">
                              <span className="small fw-bold text-dark d-block mb-1" style={{ fontSize: '0.75rem' }}>Parámetros URL (Query):</span>
                              <pre className="bg-white p-2 rounded border font-monospace text-muted m-0 overflow-auto" style={{ fontSize: '0.68rem', maxHeight: '90px' }}>
                                {JSON.stringify(log.query, null, 2)}
                              </pre>
                            </div>
                          )}

                          <div className="mb-2">
                            <span className="small fw-bold text-dark d-block mb-1" style={{ fontSize: '0.75rem' }}>Request Body (Payload):</span>
                            <pre className="bg-dark text-light p-2 rounded-3 font-monospace m-0 overflow-auto" style={{ fontSize: '0.68rem', maxHeight: '150px' }}>
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>

                          <div>
                            <span className="small fw-bold text-dark d-block mb-1" style={{ fontSize: '0.75rem' }}>Response Body (Respuesta):</span>
                            <pre className="bg-dark text-light p-2 rounded-3 font-monospace m-0 overflow-auto" style={{ fontSize: '0.68rem', maxHeight: '150px' }}>
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'webhooks' && (

          <div>
            <div className="d-flex flex-column gap-2 mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Peticiones Recientes (Webhook Logs)</h6>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1"
                    onClick={() => setShowConfirmClearWebhooks(true)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    <i className="bi bi-trash3 me-1"></i>
                    Vaciar Logs
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1"
                    onClick={fetchWebhookLogs}
                    disabled={loadingLogs}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {loadingLogs ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    ) : (
                      <i className="bi bi-arrow-clockwise me-1"></i>
                    )}
                    Refrescar
                  </button>
                </div>
              </div>
              <div className="d-flex gap-2 align-items-center bg-light p-2 rounded border border-dashed">
                <input 
                  type="text" 
                  className="form-control form-control-sm rounded-pill" 
                  placeholder="Buscar cliente o payload..." 
                  value={webhookSearchQuery}
                  onChange={(e) => setWebhookSearchQuery(e.target.value)}
                  style={{ fontSize: '0.75rem', maxWidth: '250px' }}
                />
                <select
                  className="form-select form-select-sm rounded-pill"
                  style={{ fontSize: '0.75rem', width: 'auto' }}
                  value={webhookTimeFilter}
                  onChange={(e) => setWebhookTimeFilter(e.target.value)}
                >
                  <option value="all">Cualquier momento</option>
                  <option value="1h">Última Hora</option>
                  <option value="24h">Últimas 24 Horas</option>
                  <option value="7d">Últimos 7 Días</option>
                </select>
                <select
                  className="form-select form-select-sm rounded-pill"
                  style={{ fontSize: '0.75rem', width: 'auto' }}
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                >
                  <option value="all">Todas las peticiones</option>
                  <option value="errors">Solo errores</option>
                </select>
              </div>
            </div>

            {webhookLogs.length === 0 ? (
              <div className="text-muted small text-center py-4 bg-light rounded border border-dashed px-3">
                {loadingLogs ? 'Cargando logs de webhook...' : 'No se registran peticiones recientes de webhook.'}
              </div>
            ) : (
              <div className="d-flex flex-column gap-2 webhook-logs-container" style={{ maxHeight: '380px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '4px' }}>
                {filteredWebhookLogs.length === 0 ? (
                  <div className="text-muted small text-center py-3 bg-light rounded border border-dashed px-3">
                    No hay logs que coincidan con el filtro seleccionado.
                  </div>
                ) : filteredWebhookLogs.map((log) => {
                  const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div key={log.id} className="border rounded-3 p-2 bg-light shadow-sm">
                      <div 
                        className="d-flex justify-content-between align-items-center cursor-pointer" 
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        style={{ userSelect: 'none' }}
                      >
                        <div className="d-flex align-items-center gap-2 min-w-0">
                          <span className={`badge ${isSuccess ? 'bg-success-subtle text-success border border-success' : 'bg-danger-subtle text-danger border border-danger'} font-monospace px-2 py-0.5`} style={{ fontSize: '0.7rem' }}>
                            {log.statusCode} {log.method}
                          </span>
                          <span className="small text-dark fw-bold text-truncate" style={{ maxWidth: '140px' }} title={isSuccess ? log.message : log.errorMessage}>
                            {isSuccess ? (log.message || 'Exitoso') : (log.errorMessage || 'Error')}
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                          <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                            {log.formattedDate}
                          </span>
                          <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} text-secondary`} style={{ fontSize: '0.75rem' }}></i>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-2 border-top">
                          <div className="d-flex justify-content-end mb-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-dark rounded-pill px-2.5 d-flex align-items-center gap-1"
                              style={{ fontSize: '0.72rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                                const logMarkdown = [
                                  `### Webhook Log [${log.statusCode} ${log.method}]`,
                                  `- **Fecha/Hora:** ${log.formattedDate}`,
                                  `- **Estado:** ${isSuccess ? 'Exitoso' : 'Fallido'}`,
                                  log.errorMessage ? `- **Error:** ${log.errorMessage}` : '',
                                  '- **Headers:**',
                                  '```json',
                                  JSON.stringify(log.headers || {}, null, 2),
                                  '```',
                                  '',
                                  '- **Payload:**',
                                  '```json',
                                  JSON.stringify(log.payload || {}, null, 2),
                                  '```'
                                ].filter(Boolean).join('\n');
                                navigator.clipboard.writeText(logMarkdown);
                                showAlert('Detalles completos copiados en formato Markdown', 'success');
                              }}
                            >
                              <i className="bi bi-clipboard-data"></i> Copiar Detalles (Markdown)
                            </button>
                          </div>

                          {log.errorMessage && (
                            <div className="alert alert-danger py-2 px-3 small mb-2 d-flex align-items-start gap-2 rounded-3 border-0">
                              <i className="bi bi-exclamation-triangle-fill fs-6 mt-0.5"></i>
                              <div>
                                <strong style={{ fontSize: '0.75rem' }}>Error del Servidor:</strong>
                                <div style={{ fontSize: '0.72rem' }}>{log.errorMessage}</div>
                              </div>
                            </div>
                          )}

                          <div className="mb-2">
                            <span className="small fw-bold text-dark d-block mb-1" style={{ fontSize: '0.75rem' }}>Headers HTTP:</span>
                            <div className="bg-white p-2 rounded border font-monospace text-muted" style={{ fontSize: '0.68rem', maxHeight: '110px', overflowY: 'auto' }}>
                              {Object.entries(log.headers || {}).map(([key, val]) => (
                                <div key={key} className="text-truncate">
                                  <span className="text-dark fw-bold">{key}:</span> {val}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="small fw-bold text-dark" style={{ fontSize: '0.75rem' }}>Payload (Cuerpo JSON):</span>
                              <button
                                type="button"
                                className="btn btn-link p-0 text-decoration-none small text-dark"
                                style={{ fontSize: '0.72rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2));
                                  showAlert('Payload copiado al portapapeles', 'success');
                                }}
                              >
                                <i className="bi bi-clipboard me-1"></i>Copiar JSON
                              </button>
                            </div>
                            <pre className="bg-dark text-light p-2 rounded-3 font-monospace m-0 overflow-auto" style={{ fontSize: '0.68rem', maxHeight: '180px' }}>
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        show={showConfirmClearWebhooks}
        title="Vaciar Logs de Webhook"
        message="¿Estás seguro de que deseas vaciar todos los logs de webhook almacenados? Esta acción es irreversible."
        confirmBtnClass="btn-danger"
        confirmText="Vaciar"
        onConfirm={async () => {
          setShowConfirmClearWebhooks(false);
          await clearWebhookLogs();
        }}
        onClose={() => setShowConfirmClearWebhooks(false)}
      />

      <ConfirmModal
        show={showConfirmClearApiLogs}
        title="Vaciar Logs de API"
        message="¿Estás seguro de que deseas vaciar todos los logs de API almacenados? Esta acción es irreversible."
        confirmBtnClass="btn-danger"
        confirmText="Vaciar"
        onConfirm={async () => {
          setShowConfirmClearApiLogs(false);
          await clearApiLogs();
        }}
        onClose={() => setShowConfirmClearApiLogs(false)}
      />
    </div>
  );
}
