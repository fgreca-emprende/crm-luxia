import { useState } from 'react';
import { setConfigGeneral } from '../../../../lib/configGeneral';
import { useToast } from '../../../ui/ToastProvider';

export function GmailConfigCard({ initialConfig }) {
  const { showAlert } = useToast();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(initialConfig || {
    active: false,
    domain_excludelist: [],
    sync_frequency_minutes: 15,
    ai_analysis_enabled: true,
    ai_risk_threshold: 7
  });
  const [newExcludedDomain, setNewExcludedDomain] = useState('');

  const handleAddExcludedDomain = () => {
    if (!newExcludedDomain.trim()) return;
    const domain = newExcludedDomain.trim().toLowerCase();
    if (!config.domain_excludelist.includes(domain)) {
      setConfig(prev => ({
        ...prev,
        domain_excludelist: [...prev.domain_excludelist, domain]
      }));
    }
    setNewExcludedDomain('');
  };

  const handleRemoveExcludedDomain = (domainToRemove) => {
    setConfig(prev => ({
      ...prev,
      domain_excludelist: prev.domain_excludelist.filter(d => d !== domainToRemove)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setConfigGeneral('gmail_config', config);
      showAlert('Configuración de Gmail guardada exitosamente.', 'success');
    } catch (error) {
      console.warn('Error saving Gmail config:', error);
      showAlert('Error al guardar configuración de Gmail.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 bg-white shadow-sm rounded-4 position-relative overflow-hidden">
      <div className="position-absolute top-0 start-0 w-100" style={{ height: '4px', background: 'linear-gradient(90deg, #4285F4 0%, #EA4335 25%, #FBBC05 50%, #34A853 100%)' }}></div>

      <div className="card-body p-4 p-xl-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-light rounded p-2 border">
              <i className="bi bi-google fs-3" style={{ color: '#EA4335' }}></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-dark">Gmail & LUXIA IA Sync</h5>
              <span className="small text-muted">Sincronización en Segundo Plano y Análisis IA</span>
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
          Sincroniza y analiza automáticamente las interacciones de correo electrónico de los comerciales con clientes registrados para extraer resúmenes y disparar alertas de Churn con LUXIA IA.
        </p>

        <div className="row g-4">
          <div className="col-md-6">
            <div className="mb-4">
              <label className="form-label small fw-bold text-dark">Frecuencia de Sincronización</label>
              <select
                className="form-select bg-light border-0"
                value={config.sync_frequency_minutes}
                onChange={(e) => setConfig({ ...config, sync_frequency_minutes: parseInt(e.target.value) })}
                disabled={!config.active}
              >
                <option value={15}>Cada 15 minutos</option>
                <option value={30}>Cada 30 minutos</option>
                <option value={60}>Cada hora</option>
                <option value={180}>Cada 3 horas</option>
              </select>
              <div className="form-text" style={{ fontSize: '0.75rem' }}>
                Frecuencia en la que el backend polleará nuevos correos desde Gmail.
              </div>
            </div>

            <div className="mb-4">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="ai_analysis_enabled"
                  checked={config.ai_analysis_enabled}
                  onChange={(e) => setConfig({ ...config, ai_analysis_enabled: e.target.checked })}
                  disabled={!config.active}
                />
                <label className="form-check-label small fw-bold text-dark" htmlFor="ai_analysis_enabled">
                  Habilitar Análisis de IA (LUXIA IA)
                </label>
              </div>
              <div className="form-text" style={{ fontSize: '0.75rem' }}>
                Si está activo, Gemini procesará cada email para registrar sentimientos, compromisos y alertas.
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold text-dark">Umbral de Alerta de Churn (IA Score 1-10)</label>
              <div className="d-flex align-items-center gap-3">
                <input
                  type="range"
                  className="form-range"
                  min="1"
                  max="10"
                  step="1"
                  value={config.ai_risk_threshold}
                  onChange={(e) => setConfig({ ...config, ai_risk_threshold: parseInt(e.target.value) })}
                  disabled={!config.active || !config.ai_analysis_enabled}
                />
                <span className="badge bg-danger rounded-pill px-3 py-2 fw-bold">{config.ai_risk_threshold}/10</span>
              </div>
              <div className="form-text" style={{ fontSize: '0.75rem' }}>
                Nivel de severidad de riesgo a partir del cual se generará una alerta de LUXIA IA.
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="mb-4">
              <label className="form-label small fw-bold text-dark">Exclusión de Dominios de Correo (Evita Fugas de Privacidad)</label>
              <div className="input-group mb-2">
                <input
                  type="text"
                  className="form-control bg-light border-0"
                  placeholder="ejemplo.com"
                  value={newExcludedDomain}
                  onChange={(e) => setNewExcludedDomain(e.target.value)}
                  disabled={!config.active}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExcludedDomain())}
                />
                <button
                  className="btn btn-secondary px-3"
                  type="button"
                  onClick={handleAddExcludedDomain}
                  disabled={!config.active}
                >
                  Añadir
                </button>
              </div>
              <div className="form-text mb-3" style={{ fontSize: '0.75rem' }}>
                Los correos de estos dominios nunca se importarán ni serán leídos por LUXIA IA.
              </div>

              <div className="d-flex flex-wrap gap-2 p-3 bg-light rounded-3 border" style={{ minHeight: '100px', maxHeight: '180px', overflowY: 'auto' }}>
                {config.domain_excludelist.length === 0 ? (
                  <span className="text-muted small">No hay dominios excluidos.</span>
                ) : (
                  config.domain_excludelist.map(domain => (
                    <span key={domain} className="badge bg-white text-dark border d-flex align-items-center gap-2 rounded-pill px-3 py-2 shadow-sm">
                      <span>{domain}</span>
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '0.65rem' }}
                        onClick={() => handleRemoveExcludedDomain(domain)}
                        disabled={!config.active}
                      ></button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-top d-flex gap-2">
          <button
            className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar Configuración de Gmail'}
          </button>
        </div>
      </div>
    </div>
  );
}
