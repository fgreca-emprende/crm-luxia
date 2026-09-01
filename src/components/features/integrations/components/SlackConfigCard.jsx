import { useState } from 'react';
import { setConfigGeneral } from '../../../../lib/configGeneral';
import { useToast } from '../../../ui/ToastProvider';

const AVAILABLE_EVENTS = [
  { id: 'cliente.created', label: 'Alta de Nuevo Cliente' },
  { id: 'cliente.healthscore_changed', label: 'Cambio de Health Score (Riesgo IA)' },
  { id: 'cliente.onboarding_completed', label: 'Finalización de Onboarding' }
];

export function SlackConfigCard({ initialConfig }) {
  const { showAlert } = useToast();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(() => {
    const base = initialConfig || { active: false, webhookUrl: '', events: [] };
    return {
      clientId: '',
      clientSecret: '',
      botToken: '',
      ...base
    };
  });

  const handleToggleEvent = (eventId) => {
    setConfig(prev => {
      const isSelected = prev.events?.includes(eventId);
      return {
        ...prev,
        events: isSelected
          ? prev.events.filter(id => id !== eventId)
          : [...(prev.events || []), eventId]
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setConfigGeneral('slack_config', config);
      showAlert('Configuración de Slack guardada exitosamente.', 'success');
    } catch (error) {
      console.warn('Error saving Slack config:', error);
      showAlert('Error al guardar configuración de Slack.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 bg-white shadow-sm rounded-4 h-100 position-relative overflow-hidden">
      <div className="position-absolute top-0 start-0 w-100" style={{ height: '4px', backgroundColor: '#E01E5A' }}></div>

      <div className="card-body p-4 p-xl-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-light rounded p-2 border">
              <i className="bi bi-slack fs-3" style={{ color: '#E01E5A' }}></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-dark">Slack Notifications</h5>
              <span className="small text-muted">Outbound Events</span>
            </div>
          </div>
          <div className="form-check form-switch form-switch-lg mb-0" style={{ transform: 'scale(1.2)', marginRight: '10px' }}>
            <input
              className="form-check-input cursor-pointer"
              type="checkbox"
              checked={config.active}
              onChange={(e) => setConfig({ ...config, active: e.target.checked })}
            />
          </div>
        </div>

        <p className="small text-muted mb-4">
          Conecta el CRM con tu workspace de Slack para recibir notificaciones en tiempo real sobre el estado de tus clientes.
        </p>

        <div className="mb-4">
          <label className="form-label small fw-bold text-dark">Webhook URL (Notificaciones de Canal)</label>
          <input
            type="url"
            className="form-control bg-light border-0"
            placeholder="https://hooks.slack.com/services/..."
            value={config.webhookUrl}
            onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
            disabled={!config.active}
          />
          <div className="form-text" style={{ fontSize: '0.75rem' }}>
            Crea una Incoming Webhook App en tu canal de Slack y pega la URL aquí.
          </div>
        </div>

        <div className="mb-4 border-top pt-3">
          <label className="form-label small fw-bold text-dark d-block mb-1">Configuración OAuth (Notificaciones Personales)</label>
          <span className="text-muted d-block mb-3" style={{ fontSize: '0.72rem' }}>
            Requerido para permitir la vinculación individual de Slack y el envío de DMs de respaldo.
          </span>
          
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>Client ID</label>
              <input
                type="text"
                className="form-control bg-light border-0 text-truncate"
                placeholder="Ej: 123456789.987654"
                value={config.clientId || ''}
                onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                disabled={!config.active}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>Client Secret</label>
              <input
                type="password"
                className="form-control bg-light border-0"
                placeholder="••••••••••••••••"
                value={config.clientSecret || ''}
                onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                disabled={!config.active}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold text-dark mb-1" style={{ fontSize: '0.72rem' }}>Bot User OAuth Token (Workspace Bot Token)</label>
              <input
                type="password"
                className="form-control bg-light border-0"
                placeholder="xoxb-..."
                value={config.botToken || ''}
                onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                disabled={!config.active}
                style={{ fontSize: '0.8rem' }}
              />
              <div className="form-text" style={{ fontSize: '0.68rem' }}>
                Token de acceso de bot del workspace (generado al instalar la app en Slack).
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="form-label small fw-bold text-dark d-block mb-3">Eventos a Notificar</label>
          <div className="d-flex flex-column gap-2">
            {AVAILABLE_EVENTS.map(event => (
              <div key={event.id} className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`slack_evt_${event.id}`}
                  checked={config.events.includes(event.id)}
                  onChange={() => handleToggleEvent(event.id)}
                  disabled={!config.active}
                />
                <label className="form-check-label small" htmlFor={`slack_evt_${event.id}`}>
                  {event.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn rounded-pill px-4 fw-bold shadow-sm"
          style={{ backgroundColor: '#4A154B', color: 'white' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
