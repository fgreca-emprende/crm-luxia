import { useState, useEffect, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../../lib/configGeneral';
import { useToast } from '../../../ui/ToastProvider';
import { ConfirmModal } from '../../admin/ConfirmModal';

const AVAILABLE_EVENTS = [
  { id: 'cliente.created', label: 'Alta de Nuevo Cliente / Cuenta' },
  { id: 'cliente.healthscore_changed', label: 'Cambio de Health Score (Riesgo IA)' },
  { id: 'cliente.onboarding_completed', label: 'Finalización de Onboarding Agronómico' },
  { id: 'lead.created', label: 'Nuevo Prospecto Ingestado' },
  { id: 'lead.assigned', label: 'Asignación de Lead a Asesor Comercial' },
  { id: 'oportunidad.created', label: 'Nueva Oportunidad Comercial' },
  { id: 'oportunidad.stage_changed', label: 'Cambio de Etapa en Pipeline' },
  { id: 'contrato.created', label: 'Alta de Acuerdo Comercial / Contrato' },
  { id: 'entrega.notificacion', label: 'Notificación de Remito / Entrega a Campo' },
  { id: 'luxia_ia.alert_triggered', label: 'Disparo de Alerta de Riesgo IA' }
];

export function OutboundWebhooksManager() {
  const { showAlert } = useToast();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [newSubUrl, setNewSubUrl] = useState('');
  const [newSubEvents, setNewSubEvents] = useState([]);
  const [newSubActive, setNewSubActive] = useState(true);
  const [generatingSubSecret, setGeneratingSubSecret] = useState(false);
  const [generatedSubSecretReveal, setGeneratedSubSecretReveal] = useState('');
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState(null);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigGeneral('webhook_subscriptions');
      setSubscriptions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Error fetching webhook subscriptions:', error);
      showAlert('Error al cargar las suscripciones a eventos.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleAddSubscription = async () => {
    if (!newSubUrl.trim() || !newSubUrl.startsWith('https://')) {
      showAlert('Debes especificar una URL válida (https://).', 'warning');
      return;
    }
    if (newSubEvents.length === 0) {
      showAlert('Debes seleccionar al menos un evento.', 'warning');
      return;
    }

    try {
      let secret = null;
      if (generatingSubSecret) {
        const array = new Uint8Array(24);
        window.crypto.getRandomValues(array);
        secret = 'whsec_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        setGeneratedSubSecretReveal(secret);
      }

      const currentSubs = (await getConfigGeneral('webhook_subscriptions')) || [];
      const newSub = {
        id: 'sub_' + Date.now(),
        url: newSubUrl.trim(),
        events: newSubEvents,
        active: newSubActive,
        secret: secret,
        createdAt: new Date().toISOString()
      };

      const updated = [newSub, ...currentSubs];
      await setConfigGeneral('webhook_subscriptions', updated);
      setSubscriptions(updated);

      showAlert('Suscripción Webhook creada con éxito.', 'success');
      setNewSubUrl('');
      setNewSubEvents([]);
      setNewSubActive(true);
      setGeneratingSubSecret(false);
    } catch (error) {
      console.warn('Error adding webhook subscription:', error);
      showAlert('Error al crear la suscripción.', 'danger');
    }
  };

  const handleToggleSubscription = async (id, currentActive) => {
    try {
      const currentSubs = (await getConfigGeneral('webhook_subscriptions')) || [];
      const updated = currentSubs.map(s => s.id === id ? { ...s, active: !currentActive } : s);
      await setConfigGeneral('webhook_subscriptions', updated);
      setSubscriptions(updated);
    } catch (error) {
      console.warn('Error toggling subscription:', error);
      showAlert('Error al cambiar estado.', 'danger');
    }
  };

  const confirmDeleteSubAction = async () => {
    if (!confirmDeleteSubId) return;
    const id = confirmDeleteSubId;
    setConfirmDeleteSubId(null);
    try {
      const currentSubs = (await getConfigGeneral('webhook_subscriptions')) || [];
      const updated = currentSubs.filter(s => s.id !== id);
      await setConfigGeneral('webhook_subscriptions', updated);
      setSubscriptions(updated);
      showAlert('Suscripción eliminada.', 'success');
    } catch (error) {
      console.warn('Error deleting subscription:', error);
      showAlert('Error al eliminar suscripción.', 'danger');
    }
  };

  return (
    <div className="card border-0 bg-white shadow-sm rounded-4 position-relative overflow-hidden w-100">
      <div className="position-absolute top-0 start-0 w-100" style={{ height: '4px', background: 'linear-gradient(90deg, #8E2DE2 0%, #4A00E0 100%)' }}></div>

      <div className="card-body p-4 p-xl-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-light rounded p-2 border">
              <i className="bi bi-broadcast-pin fs-3" style={{ color: '#4A00E0' }}></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-dark">Suscripciones a Eventos (Webhooks Salientes)</h5>
              <span className="small text-muted">Configura endpoints externos (Make, Zapier, ERPs) para escuchar eventos del CRM en tiempo real.</span>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="bg-light p-4 rounded-3 border">
              <h6 className="fw-bold mb-3 text-dark" style={{ fontSize: '0.9rem' }}>Nueva Suscripción</h6>
              
              <div className="mb-3">
                <label className="form-label small fw-bold text-dark">URL del Endpoint (POST)</label>
                <input
                  type="url"
                  className="form-control bg-white"
                  placeholder="https://hook.us1.make.com/..."
                  value={newSubUrl}
                  onChange={(e) => setNewSubUrl(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-dark d-block">Eventos a Escuchar</label>
                <div className="d-flex flex-column gap-2 bg-white p-3 rounded border" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {AVAILABLE_EVENTS.map(ev => (
                    <div className="form-check" key={ev.id}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`evt_${ev.id}`}
                        checked={newSubEvents.includes(ev.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSubEvents(prev => [...prev, ev.id]);
                          } else {
                            setNewSubEvents(prev => prev.filter(x => x !== ev.id));
                          }
                        }}
                      />
                      <label className="form-check-label small" htmlFor={`evt_${ev.id}`}>
                        {ev.label} <span className="text-muted" style={{ fontSize: '0.7rem' }}>({ev.id})</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    id="newSubGenerateSecret"
                    checked={generatingSubSecret}
                    onChange={(e) => setGeneratingSubSecret(e.target.checked)}
                  />
                  <label className="form-check-label small fw-bold text-dark ms-2" htmlFor="newSubGenerateSecret">
                    Firmar Payloads (HMAC-SHA256)
                  </label>
                  <div className="form-text text-muted" style={{ fontSize: '0.72rem' }}>
                    Genera un secreto para firmar criptográficamente las peticiones y evitar suplantación.
                  </div>
                </div>
              </div>

              {generatedSubSecretReveal && (
                <div className="alert alert-success border-0 shadow-sm rounded-3 p-3 mb-3">
                  <div className="d-flex align-items-start gap-2">
                    <i className="bi bi-shield-lock-fill fs-5 mt-0.5 text-success"></i>
                    <div className="small flex-grow-1">
                      <strong>¡Secreto Generado!</strong>
                      <div className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                        Usa esta clave en tu sistema destino para validar el header <code>x-luxia-signature</code>.
                      </div>
                      <div className="input-group mb-2">
                        <input type="text" className="form-control form-control-sm bg-white font-monospace text-dark" value={generatedSubSecretReveal} readOnly />
                        <button className="btn btn-sm btn-outline-success" onClick={() => { navigator.clipboard.writeText(generatedSubSecretReveal); showAlert('Secreto copiado', 'success'); }}>
                          <i className="bi bi-clipboard"></i>
                        </button>
                      </div>
                      <button type="button" className="btn btn-sm btn-success rounded-pill px-3 mt-1 fw-bold" style={{ fontSize: '0.72rem' }} onClick={() => setGeneratedSubSecretReveal('')}>Entendido</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    checked={newSubActive}
                    onChange={(e) => setNewSubActive(e.target.checked)}
                  />
                  <label className="form-check-label small text-muted ms-1">Activo</label>
                </div>
                <button type="button" className="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-bold shadow-sm" style={{ fontSize: '0.8rem' }} onClick={handleAddSubscription}>
                  <i className="bi bi-plus-lg me-1"></i>Crear Suscripción
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>Suscripciones Activas</h6>
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1" onClick={fetchSubscriptions} disabled={loading} style={{ fontSize: '0.75rem' }}>
                {loading ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-arrow-clockwise me-1"></i>} Refrescar
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <div className="text-muted small text-center py-4 bg-light rounded border border-dashed px-3">
                {loading ? 'Cargando suscripciones...' : 'No hay webhooks salientes configurados.'}
              </div>
            ) : (
              <div className="d-flex flex-column gap-3 overflow-auto" style={{ maxHeight: '500px', paddingRight: '4px' }}>
                {subscriptions.map(sub => (
                  <div key={sub.id} className="border rounded-3 p-3 bg-light shadow-sm d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="text-truncate flex-grow-1 pe-3">
                        <span className="badge bg-secondary mb-1">POST</span>
                        <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.85rem' }} title={sub.url}>{sub.url}</div>
                      </div>
                      <div className="form-check form-switch flex-shrink-0">
                        <input className="form-check-input cursor-pointer" type="checkbox" checked={sub.active || false} onChange={() => handleToggleSubscription(sub.id, sub.active)} title="Activar/Desactivar" />
                      </div>
                    </div>

                    <div>
                      <div className="small text-muted fw-bold mb-1" style={{ fontSize: '0.7rem' }}>Eventos Suscritos:</div>
                      <div className="d-flex flex-wrap gap-1">
                        {(sub.events || []).map(ev => (
                          <span key={ev} className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill" style={{ fontSize: '0.65rem' }}>{ev}</span>
                        ))}
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                      <div className="small text-muted" style={{ fontSize: '0.7rem' }}>
                        {sub.secret ? <><i className="bi bi-shield-lock-fill text-success me-1"></i>Firmado (HMAC)</> : <><i className="bi bi-shield-slash text-warning me-1"></i>Sin Firma</>}
                      </div>
                      <button type="button" className="btn btn-sm btn-outline-danger rounded-pill px-2 py-0" onClick={() => setConfirmDeleteSubId(sub.id)} style={{ fontSize: '0.7rem' }}>
                        <i className="bi bi-trash"></i> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        show={!!confirmDeleteSubId}
        title="Eliminar Suscripción Webhook"
        message="¿Seguro que deseas eliminar esta suscripción a Webhook? Las aplicaciones externas dejarán de recibir eventos."
        confirmBtnClass="btn-danger"
        confirmText="Eliminar"
        onConfirm={confirmDeleteSubAction}
        onClose={() => setConfirmDeleteSubId(null)}
      />
    </div>
  );
}
