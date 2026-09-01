import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { SpinnerPremium } from '../ui/SpinnerPremium';

export function UserProfileView({ 
  user, 
  isManualDismissed, 
  setIsManualDismissed, 
  isSupportDismissed, 
  setIsSupportDismissed 
}) {
  const { showAlert } = useToast();
  const { isSuperAdmin, isAdmin, isLector, role } = useUserRole();
  const [profileData, setProfileData] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEquipos = async () => {
      try {
        const { data } = await supabase.from('equipos').select('*');
        if (data && data.length > 0) {
          setEquipos(data);
        } else {
          setEquipos([
            { id: '1', nombre: 'Ventas' },
            { id: '2', nombre: 'CX' },
            { id: '3', nombre: 'Operaciones' },
            { id: '4', nombre: 'Dirección' }
          ]);
        }
      } catch (err) {
        setEquipos([
          { id: '1', nombre: 'Ventas' },
          { id: '2', nombre: 'CX' },
          { id: '3', nombre: 'Operaciones' }
        ]);
      }
    };
    loadEquipos();
  }, []);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  const [aiConsumption, setAiConsumption] = useState(0);
  const [roleLimit, setRoleLimit] = useState(0);
  
  const [whatsappConsumption, setWhatsappConsumption] = useState(0);
  const [whatsappGlobalLimit, setWhatsappGlobalLimit] = useState(150);

  const [gmailConfig, setGmailConfig] = useState(null);
  const [slackConfig, setSlackConfig] = useState(null);

  const [exchangeRates, setExchangeRates] = useState({ USD: 1, ARS: 1250, CLP: 940, PEN: 3.7, COP: 4100, MXN: 18 });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const conf = await getConfigGeneral('rates');
        if (conf && conf.rates) {
          setExchangeRates(conf.rates);
        }
      } catch (err) {
        console.warn("Error loading exchange rates in UserProfileView:", err.message);
      }
    };
    fetchRates();
  }, []);

  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const gConf = await getConfigGeneral('gmail_config');
        if (gConf) setGmailConfig(gConf);
        const sConf = await getConfigGeneral('slack_config');
        if (sConf) setSlackConfig(sConf);
      } catch (err) {
        // Safe fallback
      }
    };
    loadIntegrations();
  }, []);


  const renderUserCosto = (costInUsd, decimals = 4) => {
    return `USD $${costInUsd.toFixed(decimals)}`;
  };

  const renderUserLimit = (limitInUsd, labelText = "Límite: ") => {
    return `${labelText}USD $${limitInUsd.toFixed(2)}`;
  };

  const [emailNotif, setEmailNotif] = useState(true);
  const [slackNotif, setSlackNotif] = useState(true);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackInfo, setSlackInfo] = useState(null);
  const [savingNotif, setSavingNotif] = useState(false);

  // Resolver la URL de la API del Backend según el entorno
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack_connected') === 'true') {
      showAlert('Cuenta de Slack vinculada exitosamente.', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (params.get('slack_error')) {
      showAlert(`Error de Slack: ${params.get('slack_error')}`, 'danger');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (params.get('gmail_connected') === 'true') {
      showAlert('Cuenta de Gmail vinculada exitosamente.', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [showAlert]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email && !user?.uid) return;
      setLoading(true);
      try {
        let userDocData = null;
        const lookup = user.uid || user.id;
        if (lookup) {
          const { data } = await supabase
            .from('usuarios')
            .select('*')
            .or(`id.eq.${lookup},email.eq.${user.email}`)
            .maybeSingle();
          userDocData = data;
        } else if (user.email) {
          const { data } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();
          userDocData = data;
        }

        if (userDocData) {
          setProfileData(userDocData);
          const savedNotifs = JSON.parse(localStorage.getItem(`user_notif_pref_${user.email}`) || '{}');
          setEmailNotif(savedNotifs.email !== false);
          setSlackNotif(savedNotifs.slack !== false);
          setSlackConnected(userDocData.slack_sync?.connected || false);
          setSlackInfo(userDocData.slack_sync || null);
        } else {
          const baseData = {
            id: user.uid || user.id,
            email: user.email,
            nombre: user.displayName || user.email?.split('@')[0] || '',
            rol: role || 'superadmin',
            equipo: 'Global',
            estado_presencia: 'Conectado',
            notifications_config: {
              email: { enabled: true },
              slack: { enabled: true }
            }
          };
          setProfileData(baseData);
          setEmailNotif(true);
          setSlackNotif(true);
        }
      } catch (err) {
        console.warn('Error loading user profile:', err.message);
        setProfileData({
          email: user?.email,
          nombre: user?.email?.split('@')[0] || '',
          rol: role || 'superadmin',
          equipo: 'Global'
        });
      } finally {
        setLoading(false);
      }
    };

    const loadConsumption = async () => {
      if (!user?.email) return;
      try {
        const confDoc = await getConfigGeneral('ia_usage');
        let roleLimits = confDoc?.roleLimits || { superadmin: 500, admin: 300, supervisor: 150, agente: 100, lector: 50 };
        const userRol = (role || 'superadmin').toLowerCase();
        setRoleLimit(roleLimits[userRol] || 150);

        // --- WhatsApp Consumption ---
        const waConfig = await getConfigGeneral('whatsapp_usage');
        if (waConfig) {
          setWhatsappGlobalLimit(waConfig.limitMonthlyUsd || 150);
        }

        // Consultar consumos de IA desde PostgreSQL
        const { data: aiData } = await supabase
          .from('logs_ia_consumo')
          .select('cost_usd, user_email')
          .eq('user_email', user.email)
          .limit(100);

        let total = 0;
        (aiData || []).forEach(d => {
          total += Number(d.cost_usd) || 0;
        });
        setAiConsumption(total);

        // Consultar consumos de WhatsApp desde PostgreSQL
        const { data: waData } = await supabase
          .from('logs_whatsapp_consumo')
          .select('costo_usd, usuario_email')
          .eq('usuario_email', user.email)
          .limit(100);

        let totalWa = 0;
        (waData || []).forEach(d => {
          totalWa += Number(d.costo_usd) || 0;
        });
        setWhatsappConsumption(totalWa);

      } catch (err) {
        console.warn("Error loading consumption:", err.message);
      }
    };

    loadProfile();
    loadConsumption();
  }, [user, role, showAlert]);

  const handleConnectGmail = () => {
    if (!user?.email) return;
    const redirectOrigin = window.location.origin;
    const authUrl = `${apiBaseUrl}/gmail/auth?email=${encodeURIComponent(user.email)}&uid=${encodeURIComponent(user.uid || '')}&redirect=${encodeURIComponent(redirectOrigin)}`;
    window.location.href = authUrl;
  };

  const handleDisconnectGmail = async () => {
    if (!user?.email) return;
    setDisconnecting(true);
    try {
      await supabase
        .from('usuarios')
        .update({
          gmail_sync: {
            connected: false,
            email: null,
            syncMode: null,
            syncStartDate: null,
            lastSyncTimestamp: null
          }
        })
        .or(`id.eq.${user.uid || user.id},email.eq.${user.email}`);

      setProfileData(prev => ({
        ...prev,
        gmail_sync: {
          connected: false,
          email: null,
          syncMode: null,
          syncStartDate: null
        }
      }));

      showAlert('Cuenta de Gmail desconectada exitosamente.', 'success');
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
      showAlert('Error al desconectar la cuenta de Gmail.', 'danger');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleForceSync = async () => {
    if (!user?.email) return;
    setSyncing(true);
    try {
      showAlert('Sincronización manual iniciada.', 'info');
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectSlack = async () => {
    if (!user?.email) return;
    setSavingNotif(true);
    try {
      const slackConfig = await getConfigGeneral('slack_config');
      if (!slackConfig || !slackConfig.clientId || !slackConfig.active) {
        showAlert('La integración de Slack no está activa o configurada en la consola de administración.', 'danger');
        return;
      }
      const redirectOrigin = window.location.origin;
      const authUrl = `${apiBaseUrl}/slack/auth?email=${encodeURIComponent(user.email)}&uid=${encodeURIComponent(user.uid || '')}&redirect=${encodeURIComponent(redirectOrigin)}`;
      window.location.href = authUrl;
    } catch (err) {
      console.error('Error prechecking Slack configuration:', err);
      showAlert('Error al validar la configuración de Slack.', 'danger');
    } finally {
      setSavingNotif(false);
    }
  };

  const handleDisconnectSlack = async () => {
    if (!user?.email) return;
    try {
      await supabase
        .from('usuarios')
        .update({
          slack_sync: {
            connected: false,
            slackUserId: null,
            slackUserMail: null,
            connectedAt: null
          }
        })
        .or(`id.eq.${user.uid || user.id},email.eq.${user.email}`);

      setSlackConnected(false);
      setSlackInfo(null);
      showAlert('Cuenta de Slack desvinculada exitosamente.', 'success');
    } catch (err) {
      console.error('Error disconnecting Slack:', err);
      showAlert('Error al desvincular la cuenta de Slack.', 'danger');
    }
  };

  const handleSavePreferences = async (emailEnabled, slackEnabled) => {
    if (!user?.email) return;
    setSavingNotif(true);
    try {
      localStorage.setItem(`user_notif_pref_${user.email}`, JSON.stringify({
        email: emailEnabled,
        slack: slackEnabled
      }));

      await supabase
        .from('usuarios')
        .update({
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${user.uid || user.id},email.eq.${user.email}`);

      showAlert('Preferencias de notificación guardadas con éxito.', 'success');
    } catch (err) {
      console.error('Error saving notification preferences:', err);
      showAlert('Error al guardar las preferencias de notificación.', 'danger');
    } finally {
      setSavingNotif(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <SpinnerPremium size="md" text="Cargando perfil..." />
      </div>
    );
  }

  const isConnected = profileData?.gmailSync?.connected;
  const hasMeetScopes = profileData?.gmailSync?.hasMeetScopes;
  const connectedEmail = profileData?.gmailSync?.email || user.email;
  const syncStartDate = profileData?.gmailSync?.syncStartDate 
    ? new Date(profileData.gmailSync.syncStartDate).toLocaleDateString('es-ES') 
    : 'No disponible';

  return (
    <div className="row g-4 animate-fade-in">
      {/* ---------------- INFO DE PERFIL ---------------- */}
      <div className="col-lg-4">
        <div className="card border-0 bg-white shadow-sm rounded-4 text-center p-4">
          <div className="d-flex justify-content-center mb-3">
            <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
              <i className="bi bi-person-fill text-primary fs-1"></i>
            </div>
          </div>
          <h5 className="fw-bold mb-1 text-dark">{user.displayName || 'Comercial Luxia'}</h5>
          <p className="text-muted small mb-3">{user.email}</p>
          <div className="border-top pt-3 text-start">
            <div className="mb-2">
              <label className="text-muted small fw-bold mb-0">Equipo de Trabajo</label>
              <div className="fw-bold text-dark">
                {equipos.find(eq => eq.id === profileData?.equipo)?.nombre || profileData?.equipo || 'Global'}
              </div>
            </div>
            <div>
              <label className="text-muted small fw-bold mb-0">Rol del Sistema</label>
              <div>
                {(() => {
                  const r = (profileData?.rol || role || '').toLowerCase();
                  if (r === 'superadmin') {
                    return (
                      <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 rounded-pill px-3 fw-bold small">
                        SuperAdmin
                      </span>
                    );
                  }
                  if (r === 'admin') {
                    return (
                      <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-3 fw-bold small">
                        Admin
                      </span>
                    );
                  }
                  if (r === 'lector') {
                    return (
                      <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 rounded-pill px-3 fw-bold small">
                        Lector (Solo Lectura)
                      </span>
                    );
                  }
                  if (r === 'supervisor') {
                    return (
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-3 fw-bold small">
                        Supervisor Comercial
                      </span>
                    );
                  }
                  if (r === 'agente') {
                    return (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 fw-bold small">
                        Asesor Técnico Comercial
                      </span>
                    );
                  }
                  return (
                    <span className="badge bg-light text-muted border rounded-pill px-3 fw-normal small">
                      {profileData?.rol || 'Comercial'}
                    </span>
                  );
                })()}
              </div>
            </div>
            
            {/* Widget Consumo IA */}
            <div className="mt-4 pt-3 border-top text-start">
              <label className="text-muted small fw-bold mb-1">
                <i className="bi bi-robot text-primary me-1"></i>
                Mi Consumo IA (Este Mes)
              </label>
              <div className="d-flex justify-content-between mb-1 flex-wrap gap-1">
                <span className="small fw-bold text-dark">{renderUserCosto(aiConsumption, 4)}</span>
                <span className="small text-muted">{renderUserLimit(roleLimit, "Límite: ")}</span>
              </div>
              <div className="progress rounded-pill shadow-xs" style={{ height: '8px', backgroundColor: '#e9ecef' }}>
                <div 
                  className={`progress-bar rounded-pill ${aiConsumption >= roleLimit && roleLimit > 0 ? 'bg-danger' : aiConsumption >= roleLimit * 0.8 ? 'bg-warning' : 'bg-success'}`}
                  role="progressbar" 
                  style={{ width: `${Math.min((aiConsumption / (roleLimit || 1)) * 100, 100)}%` }}
                ></div>
              </div>
              {aiConsumption >= roleLimit && roleLimit > 0 && (
                <div className="form-text text-danger mt-1" style={{fontSize: '0.65rem'}}>
                  Has alcanzado tu límite de presupuesto asignado.
                </div>
              )}
            </div>

            {/* Widget Consumo WhatsApp */}
            <div className="mt-3 pt-3 border-top text-start">
              <label className="text-muted small fw-bold mb-1">
                <i className="bi bi-whatsapp text-success me-1"></i>
                Mi Consumo WhatsApp (Este Mes)
              </label>
              <div className="d-flex justify-content-between mb-1 flex-wrap gap-1">
                <span className="small fw-bold text-dark">{renderUserCosto(whatsappConsumption, 3)}</span>
                <span className="small text-muted">{renderUserLimit(whatsappGlobalLimit, "Límite Global: ")}</span>
              </div>
              <div className="progress rounded-pill shadow-xs" style={{ height: '8px', backgroundColor: '#e9ecef' }}>
                <div 
                  className="progress-bar rounded-pill bg-success"
                  role="progressbar" 
                  style={{ width: `${Math.min((whatsappConsumption / (whatsappGlobalLimit || 1)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Widget Capacitación */}
            <div className="mt-4 pt-3 border-top text-start">
              <label className="text-muted small fw-bold mb-2">
                <i className="bi bi-mortarboard-fill text-primary me-1"></i>
                Mi Capacitación
              </label>
              {profileData?.capacitacion?.estado === 'certificado' ? (
                <div className="p-3 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-success rounded-pill small fw-bold">🎓 Certificado</span>
                  </div>
                  <div className="text-dark mb-1" style={{ fontSize: '0.75rem' }}>
                    <strong>Acreditación:</strong> <span className="text-capitalize">{profileData.capacitacion.rolCertificado} ({profileData.capacitacion.dificultadCertificada})</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                    <div><strong>Aprobado:</strong> {profileData.capacitacion.ultimoExamenAprobado ? (profileData.capacitacion.ultimoExamenAprobado.toDate ? profileData.capacitacion.ultimoExamenAprobado.toDate().toLocaleDateString('es-ES') : new Date(profileData.capacitacion.ultimoExamenAprobado).toLocaleDateString('es-ES')) : 'Reciente'}</div>
                    <div><strong>Vence:</strong> {profileData.capacitacion.proximoExamenLimite ? (profileData.capacitacion.proximoExamenLimite.toDate ? profileData.capacitacion.proximoExamenLimite.toDate().toLocaleDateString('es-ES') : new Date(profileData.capacitacion.proximoExamenLimite).toLocaleDateString('es-ES')) : 'N/A'}</div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-warning text-dark rounded-pill small fw-bold">⚠️ Pendiente</span>
                  </div>
                  <div className="text-muted text-wrap" style={{ fontSize: '0.75rem' }}>
                    Debes completar y aprobar la auto-capacitación correspondiente a tu rol para estar certificado.
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ---------------- INTEGRACIONES Y CONFIGURACIÓN ---------------- */}
      <div className="col-lg-8">
        <div className="row g-4 h-100">
          
          {/* Gmail Card */}
          <div className="col-md-6 d-flex">
            <div className="card border-0 bg-white shadow-sm rounded-4 position-relative overflow-hidden w-100 d-flex flex-column justify-content-between">
              <div className="position-absolute top-0 start-0 w-100" style={{ height: '4px', background: 'linear-gradient(90deg, #4285F4 0%, #EA4335 25%, #FBBC05 50%, #34A853 100%)' }}></div>
              
              <div className="card-body p-4 d-flex flex-column justify-content-between h-100">
                <div>
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="bg-light rounded p-2 border">
                      <i className="bi bi-google fs-3" style={{ color: '#EA4335' }}></i>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.05rem' }}>Sincronización de Gmail</h5>
                      <span className="small text-muted" style={{ fontSize: '0.75rem' }}>LUXIA IA Email Analytics</span>
                    </div>
                  </div>

                  <p className="text-muted small mb-4" style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                    Conecta tu cuenta institucional de Google Workspace para sincronización en segundo plano. LUXIA IA analizará tus correos y dictados para registrar interacciones, evaluar la salud del cliente, y agendar automáticamente tus compromisos comerciales.
                  </p>

                  {gmailConfig && gmailConfig.active === false && (
                    <div className="alert alert-warning py-2 px-3 rounded-3 mb-3 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center gap-2" style={{ fontSize: '0.72rem' }}>
                      <i className="bi bi-exclamation-triangle-fill fs-6 text-warning"></i>
                      <div className="text-start">
                        <strong>Sincronización Inactiva:</strong> El servicio global de Gmail ha sido pausado por la administración de Luxia.
                      </div>
                    </div>
                  )}

                  {isConnected ? (
                    <div className="p-3 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-4 mb-4">
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-success bg-opacity-20 p-2">
                          <i className="bi bi-check-circle-fill text-success fs-5"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold mb-0 text-success" style={{ fontSize: '0.85rem' }}>Cuenta Vinculada</h6>
                          <span className="small text-muted" style={{ fontSize: '0.75rem' }}>{connectedEmail}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-top border-success border-opacity-10 text-dark small" style={{ fontSize: '0.72rem' }}>
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">Fecha Sincronización:</span>
                          <span className="fw-bold">{syncStartDate}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">Google Meet Sinc:</span>
                          <span className={`fw-bold ${hasMeetScopes ? 'text-success' : 'text-warning'}`}>
                            {hasMeetScopes ? 'Conectado (Grabación OK)' : 'Inactivo (Faltan Permisos)'}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Estado del Servicio:</span>
                          <span className={`fw-bold ${gmailConfig?.active ? 'text-success' : 'text-danger'}`}>
                            {gmailConfig?.active ? 'Activo (Cron 15m)' : 'Pausado por Admin'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-2.5 bg-light rounded-3 border-light border mb-0 mt-3" style={{ fontSize: '0.68rem', lineHeight: '1.35' }}>
                        <div className="fw-bold text-dark d-flex align-items-center gap-1 mb-1">
                          <i className="bi bi-info-circle text-primary"></i>
                          <span>Compatibilidad de Grabaciones</span>
                        </div>
                        <p className="text-muted mb-0">
                          Para grabar videollamadas en Google Meet, tu cuenta corporativa requiere una licencia de Google Workspace <strong>Business Standard/Plus</strong> o <strong>Enterprise</strong>. Las licencias <em>Business Starter</em> no admiten grabación nativa.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-light border rounded-4 mb-4">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="rounded-circle bg-secondary bg-opacity-10 p-2">
                          <i className="bi bi-exclamation-triangle text-warning fs-5"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.85rem' }}>Sincronización Desconectada</h6>
                        </div>
                      </div>
                      <p className="text-muted mb-0" style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>
                        Tus correos actuales no están siendo registrados en el CRM. Al hacer clic en conectar, asegúrate de iniciar sesión con tu cuenta corporativa @luxia.com.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-3 border-top">
                  {isConnected ? (
                    <div className="d-flex gap-2 flex-wrap">
                      {!hasMeetScopes && (
                        <button
                          className="btn btn-sm btn-warning text-white rounded-pill px-3 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
                          onClick={handleConnectGmail}
                          disabled={syncing || disconnecting || (gmailConfig && gmailConfig.active === false)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          <i className="bi bi-shield-exclamation"></i>
                          <span>Re-autorizar Meet</span>
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-primary rounded-pill px-3 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
                        onClick={handleForceSync}
                        disabled={syncing || disconnecting || (gmailConfig && gmailConfig.active === false)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {syncing ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            <span>Sincronizando...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-arrow-clockwise"></i>
                            <span>Sincronizar</span>
                          </>
                        )}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold"
                        onClick={handleDisconnectGmail}
                        disabled={syncing || disconnecting}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {disconnecting ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary rounded-pill px-3 py-2 fw-bold shadow-sm d-inline-flex align-items-center gap-2 w-100 justify-content-center"
                      onClick={handleConnectGmail}
                      disabled={gmailConfig && gmailConfig.active === false}
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="bi bi-google"></i>
                      {gmailConfig && gmailConfig.active === false ? 'Sincronización de Gmail Desactivada' : 'Conectar Google Workspace'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Slack & Notifications Card */}
          <div className="col-md-6 d-flex">
            <div className="card border-0 bg-white shadow-sm rounded-4 position-relative overflow-hidden w-100 d-flex flex-column justify-content-between">
              <div className="position-absolute top-0 start-0 w-100" style={{ height: '4px', backgroundColor: '#E01E5A' }}></div>
              
              <div className="card-body p-4 d-flex flex-column justify-content-between h-100">
                <div>
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="bg-light rounded p-2 border border-secondary border-opacity-10">
                      <i className="bi bi-bell-fill fs-3 text-primary"></i>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.05rem' }}>Centro de Notificaciones</h5>
                      <span className="small text-muted" style={{ fontSize: '0.75rem' }}>Configuración de canales y alertas</span>
                    </div>
                  </div>

                  <p className="text-muted small mb-4" style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                    Determina los canales secundarios a través de los cuales deseas enterarte cuando un contacto responda tus mensajes de WhatsApp y te encuentres en estado <b>Desconectado</b>.
                  </p>

                  {/* Matriz de Preferencias */}
                  <div className="p-3 bg-light rounded-4 mb-4 border">
                    <h6 className="fw-bold text-dark small mb-3" style={{ fontSize: '0.8rem' }}>Canales de Respaldo</h6>
                    
                    <div className="d-flex flex-column gap-3">
                      <div className="form-check form-switch d-flex justify-content-between align-items-center ps-0">
                        <div>
                          <label className="form-check-label fw-bold text-dark small d-block" htmlFor="emailNotifSwitch" style={{ fontSize: '0.8rem' }}>
                            <i className="bi bi-envelope-fill text-muted me-2"></i> Correo Electrónico
                          </label>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>Recibe una alerta en tu email corporativo.</span>
                        </div>
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          id="emailNotifSwitch"
                          checked={emailNotif}
                          disabled={savingNotif}
                          onChange={(e) => {
                            setEmailNotif(e.target.checked);
                            handleSavePreferences(e.target.checked, slackNotif);
                          }}
                        />
                      </div>

                      <div className="form-check form-switch d-flex justify-content-between align-items-center ps-0 border-top pt-3">
                        <div>
                          <label className="form-check-label fw-bold text-dark small d-block" htmlFor="slackNotifSwitch" style={{ fontSize: '0.8rem' }}>
                            <i className="bi bi-slack text-muted me-2"></i> Slack Direct Message
                          </label>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>Mensaje directo de nuestro bot en Slack.</span>
                        </div>
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          id="slackNotifSwitch"
                          checked={slackNotif}
                          disabled={savingNotif || (slackConfig && slackConfig.active === false)}
                          onChange={(e) => {
                            setSlackNotif(e.target.checked);
                            handleSavePreferences(emailNotif, e.target.checked);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preferencias de Interfaz */}
                  <div className="p-3 bg-light rounded-4 mb-4 border animate-fade-in">
                    <h6 className="fw-bold text-dark small mb-3" style={{ fontSize: '0.8rem' }}>
                      <i className="bi bi-window-sidebar text-muted me-2"></i> Preferencias de Interfaz
                    </h6>
                    
                    <div className="d-flex flex-column gap-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <span className="fw-bold text-dark small d-block" style={{ fontSize: '0.8rem' }}>
                            <i className="bi bi-journal-text text-muted me-2"></i> Ayuda y Manual
                          </span>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                            {isManualDismissed ? 'Oculto en pantalla principal.' : 'Visible en pantalla principal.'}
                          </span>
                        </div>
                        <button 
                          className={`btn btn-xs rounded-pill px-3 fw-bold border ${isManualDismissed ? 'btn-primary' : 'btn-outline-secondary'}`}
                          style={{ fontSize: '0.72rem', height: '28px' }}
                          onClick={() => {
                            if (isManualDismissed) {
                              window.sessionStorage.removeItem(`dismissed_fab_manual_${user.uid}`);
                              setIsManualDismissed(false);
                              showAlert('Botón de Manual restaurado.', 'success');
                            } else {
                              window.sessionStorage.setItem(`dismissed_fab_manual_${user.uid}`, 'true');
                              setIsManualDismissed(true);
                              showAlert('Botón de Manual ocultado.', 'info');
                            }
                          }}
                        >
                          {isManualDismissed ? 'Mostrar' : 'Ocultar'}
                        </button>
                      </div>

                      <div className="d-flex justify-content-between align-items-center border-top pt-3">
                        <div>
                          <span className="fw-bold text-dark small d-block" style={{ fontSize: '0.8rem' }}>
                            <i className="bi bi-patch-question-fill text-muted me-2"></i> Soporte IA
                          </span>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                            {isSupportDismissed ? 'Oculto en pantalla principal.' : 'Visible en pantalla principal.'}
                          </span>
                        </div>
                        <button 
                          className={`btn btn-xs rounded-pill px-3 fw-bold border ${isSupportDismissed ? 'btn-primary' : 'btn-outline-secondary'}`}
                          style={{ fontSize: '0.72rem', height: '28px' }}
                          onClick={() => {
                            if (isSupportDismissed) {
                              window.sessionStorage.removeItem(`dismissed_fab_support_${user.uid}`);
                              setIsSupportDismissed(false);
                              showAlert('Botón de Soporte IA restaurado.', 'success');
                            } else {
                              window.sessionStorage.setItem(`dismissed_fab_support_${user.uid}`, 'true');
                              setIsSupportDismissed(true);
                              showAlert('Botón de Soporte IA ocultado.', 'info');
                            }
                          }}
                        >
                          {isSupportDismissed ? 'Mostrar' : 'Ocultar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vinculación Slack OAuth */}
                <div className="border-top pt-3 mt-auto">
                  {slackConfig && slackConfig.active === false && (
                    <div className="alert alert-warning py-2 px-3 rounded-3 mb-3 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center gap-2" style={{ fontSize: '0.72rem' }}>
                      <i className="bi bi-exclamation-triangle-fill fs-6 text-warning"></i>
                      <div className="text-start">
                        <strong>Slack Desactivado:</strong> Las notificaciones de Slack han sido deshabilitadas globalmente por la administración de Luxia.
                      </div>
                    </div>
                  )}
                  <h6 className="fw-bold text-dark mb-2" style={{ fontSize: '0.85rem' }}>Vinculación de Slack</h6>
                   {slackConfig && slackConfig.active === false ? (
                    <div className="p-2 bg-light border border-dashed rounded-4 d-flex justify-content-between align-items-center flex-wrap gap-2 text-muted">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-pause-circle-fill text-muted fs-5"></i>
                        <div>
                          <span className="fw-bold text-muted d-block" style={{ fontSize: '0.75rem' }}>Vinculación Inactiva</span>
                          <span className="small text-muted" style={{ fontSize: '0.68rem' }}>Deshabilitada globalmente</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-xs btn-outline-secondary rounded-pill px-2 fw-bold"
                        style={{ fontSize: '0.7rem' }}
                        disabled={true}
                      >
                        Suspendido
                      </button>
                    </div>
                  ) : slackConnected ? (
                    <div className="p-2 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-check-circle-fill text-success fs-5"></i>
                        <div>
                          <span className="fw-bold text-success d-block" style={{ fontSize: '0.75rem' }}>Slack Conectado</span>
                          <span className="small text-muted" style={{ fontSize: '0.68rem' }}>ID: {slackInfo?.slackUserId}</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-xs btn-outline-danger rounded-pill px-2 fw-bold"
                        style={{ fontSize: '0.7rem' }}
                        onClick={handleDisconnectSlack}
                      >
                        Desconectar
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 bg-light border rounded-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div>
                        <span className="fw-bold text-dark d-block" style={{ fontSize: '0.75rem' }}>Slack desvinculado</span>
                      </div>
                      <button
                        className="btn btn-xs btn-primary rounded-pill px-3 fw-bold shadow-sm d-inline-flex align-items-center gap-1"
                        style={{ backgroundColor: '#E01E5A', borderColor: '#E01E5A', fontSize: '0.72rem' }}
                        onClick={handleConnectSlack}
                        disabled={savingNotif || (slackConfig && slackConfig.active === false)}
                      >
                        <i className="bi bi-slack"></i>
                        Vincular Slack
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* ---------------- GAMIFICATION ENGINE ---------------- */}
      <div className="col-lg-12">
        <div className="card border-0 bg-white shadow-sm rounded-4 position-relative overflow-hidden">
          <div className="card-body p-4 p-xl-5">
            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="bg-warning bg-opacity-10 rounded p-2 border border-warning border-opacity-25">
                <i className="bi bi-trophy-fill fs-3 text-warning"></i>
              </div>
              <div>
                <h5 className="fw-bold mb-0 text-dark">Logros y Desarrollo Profesional</h5>
                <span className="small text-muted">Sube de nivel completando tareas operativas y comerciales</span>
              </div>
            </div>

            <div className="row g-4">
              {/* Nivel Global y XP */}
              <div className="col-12 col-lg-4">
                <div className="card-premium gamification-card text-center h-100 d-flex flex-column justify-content-center p-4 shadow-sm border border-warning border-opacity-25" style={{ background: 'linear-gradient(135deg, #fffcf0 0%, #fff4d6 100%)' }}>
                  <div className="fw-bold text-dark small text-uppercase mb-3" style={{ letterSpacing: '1px' }}>Nivel Global</div>
                  <div className="d-flex align-items-center justify-content-center mb-3">
                    <div className="bg-white rounded-circle shadow-sm d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px', border: '4px solid #ffc107' }}>
                      <span className="display-4 fw-extrabold text-dark" style={{ fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                        {profileData?.gamificacion?.nivelGlobal || 1}
                      </span>
                    </div>
                  </div>
                  <div className="badge bg-white text-dark border border-warning border-opacity-50 rounded-pill px-3 py-2 mb-4 fw-bold mx-auto shadow-sm" style={{ fontSize: '0.8rem' }}>
                    <i className="bi bi-star-fill text-warning me-1"></i>
                    {profileData?.gamificacion?.xpGlobal || 0} XP Acumulada
                  </div>
                  
                  <div className="mt-auto px-2">
                    <div className="d-flex justify-content-between small text-dark fw-bold mb-2" style={{ fontSize: '0.75rem' }}>
                      <span>Nivel {profileData?.gamificacion?.nivelGlobal || 1}</span>
                      <span>Nivel {(profileData?.gamificacion?.nivelGlobal || 1) + 1}</span>
                    </div>
                    <div className="progress rounded-pill bg-white shadow-sm border border-warning border-opacity-25" style={{ height: '14px' }}>
                      <div 
                        className="progress-bar bg-warning progress-bar-striped progress-bar-animated" 
                        role="progressbar" 
                        style={{ width: `${Math.max(((profileData?.gamificacion?.xpGlobal || 0) % 500) / 500 * 100, 5)}%` }}
                      ></div>
                    </div>
                    <div className="small text-muted mt-2 fw-bold" style={{ fontSize: '0.75rem' }}>
                      Faltan {500 - ((profileData?.gamificacion?.xpGlobal || 0) % 500)} XP para el próximo nivel
                    </div>
                  </div>
                </div>
              </div>

              {/* Rachas */}
              <div className="col-12 col-md-6 col-lg-4">
                <div className="card-premium h-100 p-4" style={{ backgroundColor: 'var(--bg-app)' }}>
                  <div className="fw-bold text-muted small text-uppercase mb-4 text-center" style={{ letterSpacing: '0.5px' }}>Tus Rachas Activas</div>
                  
                  {/* Racha Actividad CRM */}
                  <div className="glass-panel p-3 d-flex flex-row align-items-center justify-content-between mb-3 border-danger border-opacity-10 gap-2 overflow-hidden">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <div className="bg-danger bg-opacity-10 rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px' }}>
                        <i className="bi bi-fire text-danger fs-5 icon-flame"></i>
                      </div>
                      <div className="text-truncate">
                        <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.85rem' }}>Actividad CRM</div>
                        <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Uso diario continuo</div>
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <div className="d-flex align-items-baseline gap-1 justify-content-end">
                        <span className="fw-extrabold text-danger fs-3" style={{ fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                          {profileData?.gamificacion?.rachas?.actividadDiaria?.actual || 0}
                        </span>
                        <span className="text-muted fw-bold" style={{ fontSize: '0.7rem' }}>días</span>
                      </div>
                      <div className="text-muted mt-1" style={{ fontSize: '0.65rem' }}>Récord: {profileData?.gamificacion?.rachas?.actividadDiaria?.record || 0}</div>
                    </div>
                  </div>

                  {/* Racha Interacciones */}
                  <div className="glass-panel p-3 d-flex flex-row align-items-center justify-content-between border-success border-opacity-10 gap-2 overflow-hidden">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <div className="bg-success bg-opacity-10 rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px' }}>
                        <i className="bi bi-journal-check text-success fs-5"></i>
                      </div>
                      <div className="text-truncate">
                        <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.85rem' }}>Interacciones</div>
                        <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>Notas y llamadas</div>
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <div className="d-flex align-items-baseline gap-1 justify-content-end">
                        <span className="fw-extrabold text-success fs-3" style={{ fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                          {profileData?.gamificacion?.rachas?.interacciones?.actual || 0}
                        </span>
                        <span className="text-muted fw-bold" style={{ fontSize: '0.7rem' }}>días</span>
                      </div>
                      <div className="text-muted mt-1" style={{ fontSize: '0.65rem' }}>Récord: {profileData?.gamificacion?.rachas?.interacciones?.record || 0}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arbol de Habilidades */}
              <div className="col-12 col-md-6 col-lg-4">
                <div className="card-premium h-100 p-4">
                  <div className="fw-bold text-muted small text-uppercase mb-4 text-center" style={{ letterSpacing: '0.5px' }}>Árbol de Habilidades</div>
                  
                  <div className="d-flex flex-column justify-content-around h-100">
                    {['ventas', 'soporte', 'retencion'].map(rama => {
                      const skill = profileData?.gamificacion?.arbolHabilidades?.[rama] || { nivel: 1, xp: 0, nombre: rama };
                      const progress = (skill.xp % 200) / 200 * 100;
                      
                      let icon, colorClass;
                      if (rama === 'ventas') { icon = 'bi-briefcase-fill'; colorClass = 'primary'; }
                      else if (rama === 'soporte') { icon = 'bi-headset'; colorClass = 'info'; }
                      else { icon = 'bi-shield-check'; colorClass = 'success'; }

                      return (
                        <div key={rama} className="mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="small fw-bold text-dark text-capitalize d-flex align-items-center gap-2">
                              <i className={`bi ${icon} text-${colorClass} fs-5`}></i>
                              {skill.nombre || rama}
                            </span>
                            <span className={`badge bg-${colorClass} bg-opacity-10 text-${colorClass} border border-${colorClass} border-opacity-25 rounded-pill px-3 py-1`}>
                              Nivel {skill.nivel}
                            </span>
                          </div>
                          <div className="progress rounded-pill bg-light shadow-inner border" style={{ height: '14px', backgroundColor: '#f1f5f9' }}>
                            <div 
                              className={`progress-bar bg-${colorClass}`} 
                              role="progressbar" 
                              style={{ width: `${Math.max(progress, 5)}%`, opacity: progress === 0 ? 0.3 : 1 }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
