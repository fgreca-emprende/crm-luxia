import { useState, useEffect, useRef } from 'react';
import { supabase, callBackendApi } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import ReactMarkdown from 'react-markdown';

export function SoporteAyudaDrawer({ show, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: '¡Hola! Soy tu asistente de **Soporte IA de LUXIA® Agro**. \n\nPuedo guiarte sobre la gestión del catálogo fitosanitario, registro de oportunidades y cultivos, configuración de campos dinámicos o cualquier consulta operativa del CRM.',
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [budgetDisabled, setBudgetDisabled] = useState(false);
  const [agentDisabled, setAgentDisabled] = useState(false);
  const [budgetConfig, setBudgetConfig] = useState(null);
  const [ragStatus, setRagStatus] = useState(null);

  // Estados para feedback negativo
  const [negativeFeedbackMsgId, setNegativeFeedbackMsgId] = useState(null);
  const [correctionText, setCorrectionText] = useState('');

  const { showAlert } = useToast();
  const chatEndRef = useRef(null);

  // Escuchar configuración
  useEffect(() => {
    if (!show) return;
    
    const loadSupportConfig = async () => {
      try {
        const usage = await getConfigGeneral('ia_usage');
        if (usage) {
          setBudgetConfig(usage);
          const isDisabled = (usage.disabledByBudget === true && usage.autoshutoffActive === true) || usage.manualPause === true;
          setBudgetDisabled(isDisabled);
        }
        const agent = await getConfigGeneral('luxia_support');
        if (agent) {
          setAgentDisabled(agent.disabled === true);
        }
      } catch (err) {
        console.warn("Error loading support config:", err);
      }
    };
    loadSupportConfig();
  }, [show]);

  // Scroll automático al final del chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, negativeFeedbackMsgId]);

  const handleSend = async (e) => {
    e.preventDefault();
    const queryText = inputText.trim();
    if (!queryText || loading || budgetDisabled || agentDisabled) return;

    // Agregar mensaje del usuario
    const userMsgId = `user-${Date.now()}`;
    const newMessages = [...messages, { id: userMsgId, role: 'user', text: queryText }];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);
    setErrorMessage('');

    try {
      const aiRes = await callBackendApi('/soporte-agent', {
        pregunta: queryText,
        seccionActual: 'General / CRM'
      }).catch(err => {
        console.warn('[SoporteAyudaDrawer] Fallback local ante error de red:', err);
        return null;
      });

      let reply = '';
      if (aiRes && aiRes.success && (aiRes.text || aiRes.data?.respuesta)) {
        reply = aiRes.data?.respuesta || aiRes.text;
      } else {
        reply = `Para resolver tu consulta sobre **"${queryText}"**:\n\n1. Dirígete a la sección correspondiente en el menú superior de **LUXIA CRM**.\n2. Si requieres permisos administrativos, solicita a tu Supervisor o Administrador el rol adecuado en *Configuración > Usuarios*.\n3. Todos los datos se sincronizan en tiempo real en la base de datos PostgreSQL de Supabase.`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: reply,
          originalInput: queryText,
          feedback: null
        }
      ]);
    } catch (error) {
      console.error('Error al consultar al Soporte IA:', error);
      setErrorMessage('Error inesperado al conectar con el servidor de soporte.');
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ **Error:** ${error.message || 'Error inesperado al conectar con el servidor de soporte.'}`,
          isError: true
        }
      ]);
      showAlert('Error en Soporte IA', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Enviar feedback positivo 👍
  const handleLike = async (msgId, originalInput, generatedOutput) => {
    try {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: 'positive' } : m));
      showAlert('¡Gracias por ayudarnos a mejorar!', 'success');
    } catch (err) {
      console.error('Error al registrar feedback positivo:', err);
      showAlert('No se pudo enviar el feedback.', 'danger');
    }
  };

  // Enviar feedback negativo con corrección/comentario 👎
  const handleDislikeSubmit = async (msgId, originalInput, generatedOutput) => {
    if (!correctionText.trim()) return;

    try {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: 'negative', feedbackComment: correctionText } : m));
      showAlert('Reporte enviado con éxito. El equipo revisará esta información.', 'warning');
      setNegativeFeedbackMsgId(null);
      setCorrectionText('');
    } catch (err) {
      console.error('Error al registrar feedback negativo:', err);
      showAlert('No se pudo enviar el reporte.', 'danger');
    }
  };

  if (!show) return null;

  return (
    <div 
      className="soporte-drawer-overlay position-fixed top-0 start-0 w-100 h-100 animate__animated animate__fadeIn"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 1100,
        transition: 'all 0.3s ease'
      }}
      onClick={onClose}
    >
      <div 
        className="soporte-drawer position-absolute top-0 end-0 h-100 animate__animated animate__slideInRight"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--apple-surface-elevated)',
          borderLeft: '1px solid var(--apple-border)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-3.5 px-4 border-bottom d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--apple-border-subtle)', background: 'var(--apple-surface-elevated)' }}>
          <div className="d-flex align-items-center gap-2.5">
            <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, var(--apple-purple), var(--apple-indigo))', color: '#ffffff' }}>
              <i className="bi bi-stars fs-5"></i>
            </div>
            <div>
              <h6 className="fw-bold mb-0" style={{ color: 'var(--apple-text-primary)', letterSpacing: '-0.02em' }}>Centro de Soporte IA</h6>
              <span className="small" style={{ fontSize: '0.76rem', color: 'var(--apple-text-secondary)' }}>Asistente inteligente para LUXIA CRM</span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close" 
            onClick={onClose} 
            aria-label="Cerrar"
          ></button>
        </div>

        {ragStatus?.status === 'syncing' && (
          <div className="bg-warning bg-opacity-10 text-warning px-4 py-2.5 border-bottom d-flex align-items-center gap-2 small animate__animated animate__fadeIn" style={{ fontSize: '0.73rem' }}>
            <style>{`
              @keyframes pulse-custom {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
              .animate-pulse-custom {
                animation: pulse-custom 1.5s infinite;
              }
            `}</style>
            <i className="bi bi-exclamation-triangle-fill animate-pulse-custom flex-shrink-0"></i>
            <span>
              <strong>Base de conocimiento en actualización:</strong> Las respuestas de soporte podrían tardar unos momentos en incluir los manuales más recientes.
            </span>
          </div>
        )}

        {/* Zona de Chat */}
        <div className="flex-grow-1 p-4 overflow-y-auto bg-light bg-opacity-30" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div 
                key={msg.id} 
                className={`d-flex flex-column mb-3 ${isUser ? 'align-items-end' : 'align-items-start'}`}
              >
                <div 
                  className={`p-3 rounded-4 shadow-sm border ${
                    isUser 
                      ? 'bg-primary text-white border-primary rounded-tr-0' 
                      : msg.isError
                        ? 'bg-danger-subtle text-danger border-danger border-opacity-25 rounded-tl-0'
                        : 'bg-white text-dark border-secondary border-opacity-10 rounded-tl-0'
                  }`}
                  style={{ 
                    maxWidth: '85%', 
                    fontSize: '0.9rem',
                    lineHeight: '1.5'
                  }}
                >
                  {isUser ? (
                    <p className="mb-0 text-white fw-medium">{msg.text}</p>
                  ) : (
                    <div className="markdown-chat">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Quick Prompts Chips if Welcome Message */}
                {msg.id === 'welcome' && (
                  <div className="mt-3 w-100" style={{ maxWidth: '85%' }}>
                    <span className="text-uppercase text-muted fw-bold d-block mb-2" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                      <i className="bi bi-lightbulb me-1 text-warning"></i> Preguntas Sugeridas
                    </span>
                    <div className="d-flex flex-column gap-1.5">
                      {[
                        '🌾 ¿Cómo asociar una línea fitosanitaria a una oportunidad?',
                        '🚜 ¿Cómo registrar hectáreas y cultivo objetivo en una cotización?',
                        '📊 ¿Cómo analizar motivos de pérdida contra competidores fitosanitarios?',
                        '🌱 ¿Cómo dar de alta un nuevo producto en el catálogo?'
                      ].map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="btn btn-sm btn-light border text-start rounded-3 py-1.5 px-3 shadow-2xs text-truncate text-secondary"
                          style={{ fontSize: '0.78rem', background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}
                          onClick={() => {
                            setInputText(prompt);
                          }}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acciones de Feedback (Solo para respuestas de la IA no erróneas) */}
                {!isUser && !msg.isError && msg.id !== 'welcome' && (
                  <div className="mt-1 d-flex align-items-center gap-2 px-2">
                    {msg.feedback === 'positive' ? (
                      <span className="text-success small fw-bold"><i className="bi bi-hand-thumbs-up-fill me-1"></i> Útil</span>
                    ) : msg.feedback === 'negative' ? (
                      <span className="text-warning small fw-bold"><i className="bi bi-hand-thumbs-down-fill me-1"></i> Reportado</span>
                    ) : (
                      <>
                        <button 
                          className="btn btn-link btn-xs text-muted p-0 me-2" 
                          title="Esta respuesta me ayudó"
                          onClick={() => handleLike(msg.id, msg.originalInput, msg.text)}
                        >
                          <i className="bi bi-hand-thumbs-up fs-6"></i>
                        </button>
                        <button 
                          className="btn btn-link btn-xs text-muted p-0" 
                          title="Esta respuesta es incorrecta o confusa"
                          onClick={() => setNegativeFeedbackMsgId(msg.id)}
                        >
                          <i className="bi bi-hand-thumbs-down fs-6"></i>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Formulario de feedback negativo inline */}
                {negativeFeedbackMsgId === msg.id && (
                  <div className="mt-2 p-3 bg-white rounded-3 border border-warning border-opacity-50 w-85 shadow-sm">
                    <label className="small text-muted fw-bold mb-1 d-block">¿Qué estuvo mal o cómo debería ser?</label>
                    <textarea
                      className="form-control form-control-sm mb-2"
                      rows="2"
                      placeholder="Ej: Dice que vaya a Clientes, pero ese botón está en Configuración..."
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      style={{ fontSize: '0.8rem', resize: 'none' }}
                    />
                    <div className="d-flex justify-content-end gap-2">
                      <button 
                        className="btn btn-xs btn-outline-secondary rounded-pill"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => {
                          setNegativeFeedbackMsgId(null);
                          setCorrectionText('');
                        }}
                      >
                        Cancelar
                      </button>
                      <button 
                        className="btn btn-xs btn-primary rounded-pill text-white fw-bold"
                        style={{ fontSize: '0.75rem' }}
                        disabled={!correctionText.trim()}
                        onClick={() => handleDislikeSubmit(msg.id, msg.originalInput, msg.text)}
                      >
                        Enviar reporte
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="d-flex align-items-center gap-2 mb-3 text-muted">
              <div className="spinner-grow spinner-grow-sm text-primary" role="status"></div>
              <span className="small fw-semibold">Consultando manuales...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Formulario de Entrada */}
        <div className="p-3 border-top bg-white">
          {budgetDisabled || agentDisabled ? (
            <div className="text-center py-3 bg-light rounded-3 border border-secondary border-opacity-25">
              <i className="bi bi-shield-slash-fill text-muted fs-4 mb-1 d-block"></i>
              <span className="small text-muted fw-bold">Soporte IA Deshabilitado</span>
              <p className="mb-0 text-muted" style={{ fontSize: '0.75rem' }}>
                {budgetDisabled 
                  ? 'Límite de presupuesto mensual excedido.' 
                  : 'Desactivado por políticas globales de administración.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="input-group rounded-3 overflow-hidden border">
              <input
                type="text"
                className="form-control border-0 px-3 py-2.5"
                placeholder="Pregunta cómo hacer algo... Ej: ¿Cómo configuro un campo dinámico?"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={loading}
                style={{ fontSize: '0.9rem' }}
              />
              <button 
                type="submit" 
                className="btn btn-primary px-3 d-flex align-items-center justify-content-center"
                disabled={loading || !inputText.trim()}
              >
                <i className="bi bi-send-fill"></i>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Estilos locales para Markdown y Chat */}
      <style>{`
        .markdown-chat p {
          margin-bottom: 0.5rem;
        }
        .markdown-chat p:last-child {
          margin-bottom: 0;
        }
        .markdown-chat ul, .markdown-chat ol {
          margin-bottom: 0.5rem;
          padding-left: 1.25rem;
        }
        .markdown-chat li {
          margin-bottom: 0.25rem;
        }
        .rounded-tr-0 {
          border-top-right-radius: 0 !important;
        }
        .rounded-tl-0 {
          border-top-left-radius: 0 !important;
        }
        .w-85 {
          width: 85% !important;
        }
      `}</style>
    </div>
  );
}
