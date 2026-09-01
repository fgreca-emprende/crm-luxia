import { useState, useEffect } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { useUserRole } from '../../contexts/UserRoleContext';

// Subcomponents
import { SlackConfigCard } from './integrations/components/SlackConfigCard';
import { GmailConfigCard } from './integrations/components/GmailConfigCard';
import { ApiKeysConsole } from './integrations/components/ApiKeysConsole';
import { OutboundWebhooksManager } from './integrations/components/OutboundWebhooksManager';
import { TrafficLogViewer } from './integrations/components/TrafficLogViewer';
import { WhatsappConfigCard } from './integrations/components/WhatsappConfigCard';
import { WebFormsManager } from './integrations/components/WebFormsManager';

export function IntegrationsManager() {
  const { showAlert } = useToast();
  const { hasPermission } = useUserRole();
  const [activeTab, setActiveTab] = useState('conexiones'); // 'conexiones', 'apis', 'webhooks'
  const [loading, setLoading] = useState(true);

  // Core configurations to pass down
  const [slackConfig, setSlackConfig] = useState(null);
  const [gmailConfig, setGmailConfig] = useState(null);

  useEffect(() => {
    const loadConfigurations = async () => {
      setLoading(true);
      try {
        const [slackData, gmailData] = await Promise.all([
          getConfigGeneral('slack_config'),
          getConfigGeneral('gmail_config')
        ]);

        if (slackData) {
          setSlackConfig(slackData);
        }

        if (gmailData) {
          setGmailConfig(gmailData);
        } else {
          const defaultGmail = {
            active: false,
            domain_excludelist: ['luxia.com', 'gmail.com', 'outlook.com', 'hotmail.com'],
            sync_frequency_minutes: 15,
            ai_analysis_enabled: true,
            ai_risk_threshold: 7
          };
          await setConfigGeneral('gmail_config', defaultGmail);
          setGmailConfig(defaultGmail);
        }
      } catch (error) {
        console.warn('Error loading integrations:', error);
        showAlert('Error al cargar configuraciones de integraciones.', 'danger');
      } finally {
        setLoading(false);
      }
    };

    loadConfigurations();
  }, [showAlert]);

  if (loading) {
    return (
      <div className="py-5">
        <SpinnerPremium size="md" text="Cargando integraciones..." />
      </div>
    );
  }

  return (
    <div>
      {/* Navigation Tabs */}
      <ul className="nav nav-pills mb-4 border-bottom pb-3 gap-2">
        <li className="nav-item">
          <button 
            className={`nav-link rounded-pill fw-bold px-4 ${activeTab === 'conexiones' ? 'active bg-dark' : 'text-dark bg-light'}`}
            onClick={() => setActiveTab('conexiones')}
          >
            <i className="bi bi-diagram-3 me-2"></i>Conexiones
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link rounded-pill fw-bold px-4 ${activeTab === 'apis' ? 'active bg-dark' : 'text-dark bg-light'}`}
            onClick={() => setActiveTab('apis')}
          >
            <i className="bi bi-code-slash me-2"></i>Consola APIs
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link rounded-pill fw-bold px-4 ${activeTab === 'webhooks' ? 'active bg-dark' : 'text-dark bg-light'}`}
            onClick={() => setActiveTab('webhooks')}
          >
            <i className="bi bi-activity me-2"></i>Webhooks
          </button>
        </li>
        {hasPermission('crear_formulario_web') && (
          <li className="nav-item">
            <button 
              className={`nav-link rounded-pill fw-bold px-4 ${activeTab === 'formularios' ? 'active bg-dark' : 'text-dark bg-light'}`}
              onClick={() => setActiveTab('formularios')}
            >
              <i className="bi bi-window-sidebar me-2"></i>Formularios Web
            </button>
          </li>
        )}
      </ul>

      {/* Tab Content */}
      <div className="row g-4">
        {activeTab === 'conexiones' && (
          <>
            <div className="col-12">
              <WhatsappConfigCard />
            </div>
            <div className="col-12">
              <GmailConfigCard initialConfig={gmailConfig} />
            </div>
            <div className="col-12">
              <SlackConfigCard initialConfig={slackConfig} />
            </div>
          </>
        )}

        {activeTab === 'apis' && (
          <>
            <div className="col-12">
              <ApiKeysConsole />
            </div>
            <div className="col-12">
              <TrafficLogViewer mode="api" />
            </div>
          </>
        )}

        {activeTab === 'webhooks' && (
          <>
            <div className="col-12">
              <OutboundWebhooksManager />
            </div>
            <div className="col-12">
              <TrafficLogViewer mode="webhooks" />
            </div>
          </>
        )}



        {activeTab === 'formularios' && hasPermission('crear_formulario_web') && (
          <div className="col-12">
            <WebFormsManager />
          </div>
        )}
      </div>
    </div>
  );
}
