import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { WhatsappChatConsole } from './WhatsappChatConsole';

export function ContactQuickActions({ contacto }) {
  const { hasPermission, isLector, user } = useUserRole();
  const { showAlert } = useToast();

  const [userConfig, setUserConfig] = useState(null);
  const [whatsappActive, setWhatsappActive] = useState(true);
  const [meetAgentDisabled, setMeetAgentDisabled] = useState(false);
  
  // Modales
  const [showMeetModal, setShowMeetModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);

  // Formulario de Meet
  const [meetTitle, setMeetTitle] = useState('');
  const [meetDesc, setMeetDesc] = useState('');
  const [meetScheduleMode, setMeetScheduleMode] = useState('inmediata');
  const [meetStartTime, setMeetStartTime] = useState('');
  const [meetDuration, setMeetDuration] = useState(30);
  const [meetConsent, setMeetConsent] = useState(false);
  const [meetLoading, setMeetLoading] = useState(false);

  useEffect(() => {
    const fetchUserConfig = async () => {
      if (user?.id) {
        try {
          const { data } = await supabase.from('usuarios').select('*').eq('id', user.id).maybeSingle();
          if (data) setUserConfig(data);
        } catch (err) {
          console.error('[ContactQuickActions] Error loading user config:', err);
        }
      }
    };
    fetchUserConfig();

    const checkIntegrations = async () => {
      try {
        const usage = await getConfigGeneral('whatsapp_usage');
        if (usage) {
          const disabled = (usage.disabledByBudget === true && usage.autoshutoffActive === true) || usage.manualPause === true;
          setWhatsappActive(!disabled);
        }
      } catch (err) {
        console.warn('Error checking integrations:', err);
      }
    };
    checkIntegrations();
  }, [user]);

  const handleMeetClick = () => {
    setMeetTitle(`Reunión CRM: ${contacto.nombre}`);
    setMeetDesc('');
    setMeetConsent(false);
    setMeetScheduleMode('inmediata');
    setMeetStartTime(new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16));
    setMeetDuration(30);
    setShowMeetModal(true);
  };

  const handleCreateMeet = async (e) => {
    e.preventDefault();
    if (!meetConsent) {
      showAlert('Debe confirmar que cuenta con el consentimiento del cliente para grabar la videollamada.', 'warning');
      return;
    }

    setMeetLoading(true);
    try {
      const meetLink = `https://meet.google.com/new`;
      showAlert('Videollamada de Google Meet preparada.', 'success');
      setShowMeetModal(false);

      if (meetScheduleMode === 'inmediata') {
        window.open(meetLink, '_blank');
      }
    } catch (err) {
      console.error(err);
      showAlert('Error al crear la videollamada.', 'danger');
    } finally {
      setMeetLoading(false);
    }
  };

  // Registrar interacción de click en Email e iniciar ventana
  const handleEmailClick = async () => {
    const contactEmail = contacto.email || contacto.correo || '';
    try {
      await supabase.from('interacciones').insert({
        cliente_id: contacto.clienteId || contacto.cliente_id || null,
        lead_id: contacto.leadId || contacto.lead_id || null,
        autor: user?.email || 'sistema',
        tipo: 'gmail_contacto',
        descripcion: `Redacción de correo corporativo iniciada con ${contacto.nombre} (${contactEmail}).`
      });
    } catch (err) {
      console.error('[ContactQuickActions] Error logging email interaction:', err);
    }
    // Abrir composición nativa de Gmail corporativo en nueva pestaña
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${contactEmail}`, '_blank');
  };

  // Abrir WhatsApp Chat Console
  const handleWhatsappClick = async () => {
    try {
      await supabase.from('interacciones').insert({
        cliente_id: contacto.clienteId || contacto.cliente_id || null,
        lead_id: contacto.leadId || contacto.lead_id || null,
        autor: user?.email || 'sistema',
        tipo: 'whatsapp_contacto',
        descripcion: `Conversación de WhatsApp iniciada con ${contacto.nombre} (${contacto.telefono}).`
      });
    } catch (err) {
      console.error('[ContactQuickActions] Error logging whatsapp interaction:', err);
    }

    setShowWhatsappModal(true);
  };

  return (
    <>
      <div className="d-flex align-items-center justify-content-end" style={{ gap: '5px' }}>
        <button
          type="button"
          onClick={handleMeetClick}
          className="btn btn-icon btn-outline-success d-flex align-items-center justify-content-center border-opacity-75 transition-transform"
          style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '50%', 
            padding: 0,
            fontSize: '0.8rem' 
          }}
          disabled={!hasPermission('actions', 'agendar_meet')}
          title={hasPermission('actions', 'agendar_meet') ? "Lanzar reunión de Google Meet" : "Sin permisos para agendar reuniones"}
        >
          <i className="bi bi-camera-video-fill"></i>
        </button>

        <button
          type="button"
          onClick={handleWhatsappClick}
          className={`btn btn-icon btn-outline-success d-flex align-items-center justify-content-center border-opacity-75 transition-transform ${(!whatsappActive || isLector) ? 'disabled' : ''}`}
          style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '50%', 
            padding: 0,
            fontSize: '0.8rem' 
          }}
          disabled={!whatsappActive || isLector}
          title={isLector ? "Sin permisos para iniciar chats (Rol Lector)" : (whatsappActive ? "Consola de WhatsApp" : "WhatsApp desactivado globalmente por la administración")}
        >
          <i className="bi bi-whatsapp"></i>
        </button>

        <button
          type="button"
          onClick={handleEmailClick}
          className="btn btn-icon btn-outline-primary d-flex align-items-center justify-content-center border-opacity-75 transition-transform"
          style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '50%', 
            padding: 0,
            fontSize: '0.8rem' 
          }}
          disabled={isLector}
          title={isLector ? "Sin permisos para redactar correos (Rol Lector)" : "Redactar en Gmail"}
        >
          <i className="bi bi-envelope-fill"></i>
        </button>
      </div>

      <style>{`
        .transition-transform {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .transition-transform:hover:not(:disabled) {
          transform: scale(1.12);
        }
      `}</style>

      {/* MODAL PROGRAMAR / INICIAR MEET */}
      {showMeetModal && (
        <div className="modal show d-block animate-fade-in" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg bg-white">
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <i className="bi bi-camera-video text-primary"></i>
                  Crear Videollamada de Google Meet
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowMeetModal(false)}></button>
              </div>
              <form onSubmit={handleCreateMeet}>
                <div className="modal-body py-3">
                  {meetAgentDisabled && (
                    <div className="alert alert-warning py-2 px-3 rounded-4 mb-3 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center gap-2 animate__animated animate__fadeIn" style={{ fontSize: '0.7rem' }}>
                      <i className="bi bi-robot fs-5 text-warning"></i>
                      <div className="text-start">
                        <strong>Procesamiento IA Inactivo:</strong> El análisis de compromisos y transcripción automática por IA de LUXIA IA Meet está deshabilitado temporalmente.
                      </div>
                    </div>
                  )}

                  {!(userConfig?.gmailSync?.connected && userConfig?.gmailSync?.hasMeetScopes) ? (
                    <div className="alert alert-danger rounded-4 py-3 px-3 d-flex align-items-start gap-3">
                      <i className="bi bi-shield-exclamation fs-4"></i>
                      <div>
                        <h6 className="fw-bold mb-1">Google Workspace no Vinculado</h6>
                        <p className="small mb-0 text-dark-emphasis" style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>
                          Para agendar videollamadas debes conectar tu cuenta corporativa y otorgar permisos de Meet y Drive. Ve a tu <strong>Perfil de Usuario</strong> para activarlo.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3">
                        <label className="form-label fw-bold text-dark small">Título de la Reunión</label>
                        <input 
                          type="text" 
                          className="form-control form-control-sm rounded-3 border" 
                          value={meetTitle} 
                          onChange={e => setMeetTitle(e.target.value)} 
                          required 
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label fw-bold text-dark small">Descripción (Opcional)</label>
                        <textarea 
                          className="form-control form-control-sm rounded-3 border" 
                          rows="2"
                          placeholder="Propósito de la llamada..."
                          value={meetDesc} 
                          onChange={e => setMeetDesc(e.target.value)}
                        />
                      </div>

                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <label className="form-label fw-bold text-dark small">Modo de Reunión</label>
                          <select 
                            className="form-select form-select-sm rounded-3 border text-dark fw-bold"
                            value={meetScheduleMode}
                            onChange={e => setMeetScheduleMode(e.target.value)}
                          >
                            <option value="inmediata">Iniciar Ahora</option>
                            <option value="programada">Programar Videollamada</option>
                          </select>
                        </div>
                        <div className="col-6">
                          <label className="form-label fw-bold text-dark small">Duración (Minutos)</label>
                          <select 
                            className="form-select form-select-sm rounded-3 border text-dark"
                            value={meetDuration}
                            onChange={e => setMeetDuration(parseInt(e.target.value))}
                          >
                            <option value="15">15 minutos</option>
                            <option value="30">30 minutos</option>
                            <option value="45">45 minutos</option>
                            <option value="60">60 minutos</option>
                            <option value="90">90 minutos</option>
                          </select>
                        </div>
                      </div>

                      {meetScheduleMode === 'programada' && (
                        <div className="mb-3">
                          <label className="form-label fw-bold text-dark small">Fecha y Hora de Inicio</label>
                          <input 
                            type="datetime-local" 
                            className="form-control form-control-sm rounded-3 border text-dark fw-bold" 
                            value={meetStartTime}
                            onChange={e => setMeetStartTime(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <div className="p-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-4 mb-2">
                        <div className="form-check d-flex align-items-start gap-2 ps-0">
                          <input 
                            className="form-check-input mt-1 cursor-pointer" 
                            type="checkbox" 
                            id="checkConsentMeetQuick" 
                            checked={meetConsent}
                            onChange={e => setMeetConsent(e.target.checked)}
                          />
                          <label className="form-check-label text-dark small cursor-pointer" htmlFor="checkConsentMeetQuick" style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>
                            <strong>Consentimiento de Grabación:</strong> Confirmo que informaré verbalmente o he obtenido el consentimiento explícito del cliente para registrar la pantalla compartida y el audio de esta reunión según las leyes aplicables.
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer border-top-0 pt-0 gap-2">
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-secondary rounded-pill px-4 fw-bold" 
                    onClick={() => setShowMeetModal(false)}
                    disabled={meetLoading}
                  >
                    Cerrar
                  </button>
                  {userConfig?.gmailSync?.connected && userConfig?.gmailSync?.hasMeetScopes && (
                    <button 
                      type="submit" 
                      className="btn btn-sm btn-primary rounded-pill px-4 fw-bold shadow-sm"
                      disabled={meetLoading || !meetConsent}
                    >
                      {meetLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Creando...
                        </>
                      ) : (
                        meetScheduleMode === 'inmediata' ? 'Iniciar Reunión' : 'Agendar Reunión'
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal WhatsApp Chat Console */}
      {showWhatsappModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '850px' }}>
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden" style={{ height: '80vh' }}>
              <div className="modal-header bg-white border-bottom p-3 px-4 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded-3 bg-success bg-opacity-10 text-success">
                    <i className="bi bi-whatsapp fs-5"></i>
                  </div>
                  <div>
                    <h6 className="modal-title fw-bold text-dark mb-0">Consola WhatsApp: {contacto.nombre}</h6>
                    <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Gestión directa de chats y plantillas de comunicación</span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowWhatsappModal(false)}></button>
              </div>
              <div className="modal-body p-0 d-flex flex-column flex-grow-1" style={{ height: 'calc(80vh - 56px)', overflow: 'hidden' }}>
                <WhatsappChatConsole 
                  clienteId={contacto.clienteId || null}
                  leadId={contacto.leadId || null} 
                  initialPhone={contacto.telefono} 
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
