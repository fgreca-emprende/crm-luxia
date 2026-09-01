import { useState, useEffect } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../../lib/configGeneral';
import { useToast } from '../../../ui/ToastProvider';
import { SpinnerPremium } from '../../../ui/SpinnerPremium';

export function WhatsappConfigCard() {
  const { showAlert } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  const [config, setConfig] = useState({
    active: false,
    phoneId: '',
    verifyToken: '',
    accessToken: ''
  });

  const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const data = await getConfigGeneral('whatsapp_config');
        if (data) {
          setConfig(prev => ({ ...prev, ...data }));
        } else {
          // Generate a default verification token for the user if it doesn't exist
          const randomToken = 'luxia_verify_' + Math.random().toString(36).substring(2, 10);
          setConfig(prev => ({ ...prev, verifyToken: randomToken }));
        }
      } catch (err) {
        console.warn('Error loading WhatsApp config:', err);
        showAlert('Error al cargar configuración de WhatsApp.', 'danger');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [showAlert]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setConfigGeneral('whatsapp_config', config);
      showAlert('Configuración de WhatsApp guardada exitosamente.', 'success');
    } catch (error) {
      console.warn('Error saving WhatsApp config:', error);
      showAlert('Error al guardar configuración de WhatsApp.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showAlert(`${label} copiado al portapapeles.`, 'success');
  };

  if (loading) {
    return (
      <div className="card border-0 bg-white shadow-sm rounded-4 p-4 text-center">
        <SpinnerPremium size="sm" text="Cargando configuración de WhatsApp..." />
      </div>
    );
  }

  return (
    <div className="card border-0 bg-white shadow-sm rounded-4 position-relative overflow-hidden">
      <div className="position-absolute top-0 start-0 w-100" style={{ height: '4px', backgroundColor: '#25D366' }}></div>

      <div className="card-body p-4 p-xl-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-light rounded p-2 border">
              <i className="bi bi-whatsapp fs-3" style={{ color: '#25D366' }}></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-dark">Meta WhatsApp Business API</h5>
              <span className="small text-muted">Sincronización bidireccional y auditoría</span>
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
          Integra la API oficial de WhatsApp en la nube para recibir mensajes entrantes de tus contactos, auditar alertas de riesgo con LUXIA IA y permitir el envío de plantillas comerciales.
        </p>

        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <label className="form-label small fw-bold text-dark">Phone Number ID (ID del Teléfono)</label>
            <input
              type="text"
              className="form-control form-control-sm border"
              placeholder="Ej: 100806499427181"
              value={config.phoneId}
              onChange={(e) => setConfig({ ...config, phoneId: e.target.value })}
              disabled={!config.active}
            />
            <div className="form-text" style={{ fontSize: '0.7rem' }}>
              Encuentra este ID en el panel de Meta Developers / WhatsApp / Configuración de la API.
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label small fw-bold text-dark">Meta Access Token (Token de Acceso Permanente)</label>
            <div className="input-group input-group-sm">
              <input
                type={showToken ? "text" : "password"}
                className="form-control border"
                placeholder="EAAGb..."
                value={config.accessToken}
                onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                disabled={!config.active}
              />
              <button 
                className="btn btn-outline-secondary" 
                type="button"
                onClick={() => setShowToken(!showToken)}
                disabled={!config.active}
              >
                <i className={`bi ${showToken ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
              </button>
            </div>
            <div className="form-text" style={{ fontSize: '0.7rem' }}>
              Token de acceso del sistema de Meta con permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
            </div>
          </div>
        </div>

        {/* METADATA WEBHOOK REQUISITE (READ ONLY INFORMATION TO MATCH IN META WEBHOOK SETUP) */}
        <div className="p-3 bg-light rounded-3 mb-4 border border-light-subtle">
          <h6 className="small fw-bold text-dark mb-3"><i className="bi bi-gear-fill me-1"></i> Configuración de Webhook en Meta Portal</h6>
          
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label text-muted mb-1" style={{ fontSize: '0.68rem' }}>Callback URL (URL de retorno)</label>
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="form-control bg-white font-monospace border"
                  style={{ fontSize: '0.72rem' }}
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl, 'URL')}
                >
                  <i className="bi bi-clipboard"></i>
                </button>
              </div>
            </div>

            <div className="col-md-6 mt-2">
              <label className="form-label text-muted mb-1" style={{ fontSize: '0.68rem' }}>Verify Token (Token de verificación)</label>
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  value={config.verifyToken}
                  onChange={(e) => setConfig({ ...config, verifyToken: e.target.value })}
                  disabled={!config.active}
                  className="form-control bg-white font-monospace border"
                  style={{ fontSize: '0.72rem' }}
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button"
                  onClick={() => copyToClipboard(config.verifyToken, 'Token')}
                  disabled={!config.verifyToken}
                >
                  <i className="bi bi-clipboard"></i>
                </button>
              </div>
              <div className="form-text" style={{ fontSize: '0.65rem' }}>
                Establece este token e ingrésalo en el portal de desarrolladores de Meta.
              </div>
            </div>
          </div>
        </div>

        <button
          className="btn rounded-pill px-4 fw-bold shadow-sm"
          style={{ backgroundColor: '#25D366', color: 'white' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
