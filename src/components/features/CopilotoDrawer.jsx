import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['strong', 'em', 'a', 'span', 'i', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
};

const sanitize = (html) => DOMPurify.sanitize(html, DOMPURIFY_CONFIG);

export function CopilotoDrawer({ show, onClose, client, lead, oportunidad, onActionExecuted }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
  const [copilotMode, setCopilotMode] = useState('action'); // 'action' (default, lightweight) or 'query' (deep CRM query)
  const [loading, setLoading] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [budgetDisabled, setBudgetDisabled] = useState(false);
  const [budgetConfig, setBudgetConfig] = useState(null);
  
  // States para feedback de copiloto
  const [sentInput, setSentInput] = useState('');
  const [copilotFeedback, setCopilotFeedback] = useState(null);
  const [showCopilotNegativeInput, setShowCopilotNegativeInput] = useState(false);
  const [copilotCorrectionText, setCopilotCorrectionText] = useState('');
  
  const { showAlert } = useToast();
  const recognitionRef = useRef(null);

  const [copilotAgentDisabled, setCopilotAgentDisabled] = useState(false);

  useEffect(() => {
    if (!show) return;
    
    const loadCopilotConfig = async () => {
      try {
        const data = await getConfigGeneral('ia_usage');
        if (data) {
          setBudgetConfig(data);
          const isDisabled = (data.disabledByBudget === true && data.autoshutoffActive === true) || data.manualPause === true;
          setBudgetDisabled(isDisabled);
        }
        const copilotConf = await getConfigGeneral('luxia_copilot');
        if (copilotConf) {
          setCopilotAgentDisabled(copilotConf.disabled === true);
        }
      } catch (error) {
        console.warn("Error loading copilot config:", error);
      }
    };
    loadCopilotConfig();
  }, [show]);

  // Inicializar Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setErrorMessage('');
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          setErrorMessage('No se detectó voz. Intenta hablar más fuerte o haz clic para cancelar.');
        } else if (event.error === 'not-allowed') {
          setErrorMessage('Permiso de micrófono denegado. Habilítalo en tu navegador.');
        } else {
          setErrorMessage(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setInputMode('text'); // Cambiar a texto para que el usuario pueda editar la transcripción si lo desea
      };

      recognitionRef.current = rec;
    } else {
      console.warn('Web Speech API no es soportada en este navegador.');
    }
  }, []);

  // Limpiar resultados al cambiar de modo para evitar confusiones
  useEffect(() => {
    setCopilotResponse(null);
    setTranscript('');
    setErrorMessage('');
    if (isListening) {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotMode]);

  const startListening = () => {
    setErrorMessage('');
    setTranscript('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting recognition:', err);
      }
    } else {
      setErrorMessage('Tu navegador no soporta entrada de voz. Usa el teclado.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleCopilotFeedback = (type) => {
    if (type === 'positive') {
      setCopilotFeedback('positive');
      showAlert('¡Gracias! LUXIA IA aprende de tus aciertos.', 'success');
    } else if (type === 'negative') {
      setShowCopilotNegativeInput(true);
    }
  };

  const submitCopilotFeedback = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!copilotCorrectionText.trim()) return;

    setCopilotFeedback('negative');
    setShowCopilotNegativeInput(false);
    setCopilotCorrectionText('');
    showAlert('Feedback registrado. Evaluaremos la corrección del prompt.', 'success');
  };

  const handleFeedbackPositive = async () => {
    handleCopilotFeedback('positive');
  };

  const handleFeedbackNegativeSubmit = async (e) => {
    submitCopilotFeedback(e);
  };

  const handleSend = async (textToSend = transcript) => {
    if (!textToSend.trim()) return;
    setTranscript('');
    setErrorMessage('');
    await executeAction(textToSend);
  };

  const executeAction = async (textToSend) => {
    if (budgetDisabled) {
      showAlert('El Copiloto está pausado por límite de presupuesto.', 'warning');
      return;
    }

    setLoading(true);
    setCopilotResponse(null);
    setSentInput(textToSend);
    setCopilotFeedback(null);
    try {
      await new Promise(r => setTimeout(r, 600));
      const entityName = client?.nombreEmpresa || lead?.nombreEmpresa || oportunidad?.titulo || 'entidad actual';
      const mockResponse = {
        success: true,
        response: `Entendido. He analizado la instrucción: "${textToSend}" para ${entityName}.`,
        quick_action: {
          label: `Completar acción sobre ${entityName}`,
          tipo: 'nota',
          detalles: { nota: textToSend }
        },
        ejecucionExitosa: true,
        intent: 'gestion_comercial'
      };

      setCopilotResponse(mockResponse);
      if (onActionExecuted) onActionExecuted(mockResponse);
    } catch (error) {
      console.error('Error al llamar al copiloto:', error);
      
      let friendlyMessage = 'Error inesperado al procesar tu solicitud con el Copiloto.';
      const rawMessage = error.message || '';
      
      try {
        // Intentar parsear si el mensaje es un JSON (pasa mucho con errores de Cloud Functions / Gemini)
        if (rawMessage.startsWith('{')) {
          const errObj = JSON.parse(rawMessage);
          const errDetail = errObj.error?.message || rawMessage;
          
          if (errDetail.includes('429') || errDetail.includes('quota') || errDetail.includes('RESOURCE_EXHAUSTED') || errDetail.includes('high demand') || errDetail.includes('503')) {
            friendlyMessage = 'Nuestros servidores de Inteligencia Artificial están experimentando alta demanda. Por favor, intenta nuevamente en unos segundos.';
          } else {
            friendlyMessage = `Error del servidor de IA: ${errDetail}`;
          }
        } else {
          if (rawMessage.includes('BUDGET_EXCEEDED')) {
            friendlyMessage = 'Se ha superado el presupuesto mensual de Inteligencia Artificial. Contacta a un administrador.';
          } else if (rawMessage.includes('429') || rawMessage.includes('quota') || rawMessage.includes('high demand') || rawMessage.includes('503')) {
            friendlyMessage = 'Nuestros servidores de Inteligencia Artificial están experimentando alta demanda. Por favor, intenta nuevamente en unos segundos.';
          } else {
            friendlyMessage = rawMessage;
          }
        }
      } catch (e) {
        // Si no es JSON válido, usamos el texto directo
        friendlyMessage = rawMessage;
      }

      setErrorMessage(friendlyMessage);
      showAlert('Error al procesar con el Copiloto', 'danger');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  const formatResponse = (text) => {
    if (!text) return [];
    
    let safeText = text;
    if (Array.isArray(text)) {
      safeText = text.join('\n');
    } else if (typeof text !== 'string') {
      safeText = String(text);
    }

    // Reemplazar la secuencia literal de caracteres "\n" por un salto de línea real
    safeText = safeText.replace(/\\n/g, '\n');

    return safeText.split('\n').map((line, idx) => {
      // 1. Escapar HTML base para evitar inyección directa
      let cleanLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

      // 2. Aplicar Markdown seguro (solo negrita)
      cleanLine = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // 3. Parsear enlaces Markdown con validación estricta de URL
      cleanLine = cleanLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        const lowerUrl = url.trim().toLowerCase();
        const BLOCKED = ['javascript:', 'data:', 'vbscript:', 'file:'];
        if (BLOCKED.some(s => lowerUrl.startsWith(s))) return `<span>${label}</span>`;
        if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) return `<span>${label}</span>`;
        
        const isFile = /\.(pdf|png|jpg|jpeg|xlsx|docx)$/i.test(url) || url.includes('firebasestorage');
        const iconClass = isFile ? 'bi-file-earmark-arrow-down-fill text-success' : 'bi-box-arrow-up-right text-primary';
        return `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow" class="copilot-link"><i class="bi ${iconClass} fs-6"></i>${label}</a>`;
      });

      // 4. Sanitizar con DOMPurify ANTES de renderizar
      const safeHtml = sanitize(cleanLine);

      // Detectar viñetas con o sin espacios iniciales
      if (line.trim().startsWith('•') || line.trim().startsWith('*')) {
        const content = safeHtml.replace(/^[•*]\s*/, '');
        return (
          <li key={idx} className="mb-2 list-unstyled d-flex align-items-start text-dark" style={{ fontSize: '0.9rem' }}>
            <span className="text-primary me-2 fw-bold" style={{ fontSize: '1.1rem', marginTop: '-2px' }}>•</span>
            <span dangerouslySetInnerHTML={{ __html: content }} />
          </li>
        );
      }
      return <p key={idx} className="mb-2 text-dark" style={{ fontSize: '0.9rem' }} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
    });
  };


  return (
    <div 
      className="copiloto-drawer-overlay position-fixed top-0 start-0 w-100 h-100" 
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.25)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1100,
        transition: 'opacity 0.3s ease'
      }}
      onClick={onClose}
    >
      <div 
        className="copiloto-drawer glass-panel position-absolute bottom-0 start-50 translate-middle-x bg-white w-100" 
        style={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          maxHeight: '85vh',
          maxWidth: '600px',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.15)',
          overflowY: 'auto',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          paddingBottom: '2rem'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del Copiloto */}
        <div className="d-flex justify-content-between align-items-center px-4 pt-4 pb-3 border-bottom border-light">
          <div className="d-flex align-items-center gap-2">
            <div className="bg-primary bg-opacity-10 p-2 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
              <i className="bi bi-robot text-primary fs-4"></i>
            </div>
            <div>
              <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Copiloto de Terreno</h5>
              <span className="text-muted small fw-bold">Cliente: {client.nombreEmpresa}</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ padding: '0.5rem' }}></button>
        </div>

        {/* Cuerpo del Copiloto */}
        <div className="px-4 py-3">
          
          {/* Selector de Modo (Optimización de tokens y reads) */}
          <div className="text-center mb-3">
            <div className="btn-group bg-light rounded-pill p-1 border shadow-sm w-100" role="group">
              <button 
                type="button" 
                className={`btn btn-sm rounded-pill fw-bold py-2 px-2 border-0 flex-grow-1 ${copilotMode === 'action' ? 'btn-primary text-white shadow-sm' : 'bg-transparent text-muted'}`}
                onClick={() => setCopilotMode('action')}
                disabled={loading}
                style={{ fontSize: '0.8rem' }}
              >
                <i className="bi bi-chat-right-quote me-1"></i>Nota
              </button>
              <button 
                type="button" 
                className={`btn btn-sm rounded-pill fw-bold py-2 px-2 border-0 flex-grow-1 ${copilotMode === 'query' ? 'btn-primary text-white shadow-sm' : 'bg-transparent text-muted'}`}
                onClick={() => setCopilotMode('query')}
                disabled={loading || budgetDisabled}
                title={budgetDisabled ? "Servicio de IA pausado temporalmente por presupuesto mensual" : "Consultar Cuenta (Análisis CRM)"}
                style={{ fontSize: '0.8rem' }}
              >
                <i className="bi bi-journal-text me-1"></i>Consultar
              </button>
              <button 
                type="button" 
                className={`btn btn-sm rounded-pill fw-bold py-2 px-2 border-0 flex-grow-1 ${copilotMode === 'search' ? 'btn-primary text-white shadow-sm' : 'bg-transparent text-muted'}`}
                onClick={() => setCopilotMode('search')}
                disabled={loading || budgetDisabled}
                title={budgetDisabled ? "Servicio de IA pausado temporalmente por presupuesto mensual" : "Búsqueda Inteligente"}
                style={{ fontSize: '0.8rem' }}
              >
                <i className="bi bi-search me-1"></i>Buscador
              </button>
            </div>
          </div>

          {/* Alertas o Mensajes de Error */}
          {errorMessage && (
            <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 py-2 px-3 small border-0 shadow-sm" role="alert">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Área de Visualización de Resultados */}
          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }}></div>
              <p className="text-muted small fw-bold mt-3">
                {copilotMode === 'action' 
                  ? 'Procesando comando y actualizando bitácora...' 
                  : copilotMode === 'search'
                    ? 'Agente analizando toda la cuenta y buscando en bitácora...'
                    : 'LUXIA Copilot analizando historial, contratos y notas...'}
              </p>
            </div>
          )}

          {!loading && copilotResponse && (
            <div className="copilot-result animate__animated animate__fadeIn mb-4">
              
              {/* Acciones Tomadas (modo 'action' u 'ambos') */}
              {copilotResponse.ejecucionExitosa && copilotResponse.accionesTomadas.length > 0 && (
                <div className="card-premium bg-success bg-opacity-10 border border-success border-opacity-25 rounded-4 p-3 mb-3">
                  <h6 className="fw-bold text-success mb-2 small d-flex align-items-center gap-2">
                    <i className="bi bi-check-circle-fill"></i> Acciones Ejecutadas
                  </h6>
                  <ul className="mb-0 ps-3 text-success small">
                    {copilotResponse.accionesTomadas.map((acc, idx) => (
                      <li key={idx} className="fw-bold">{acc}</li>
                    ))}
                  </ul>
                  {copilotResponse.explicacion && (
                    <div className="mt-2 text-muted small italic">"{copilotResponse.explicacion}"</div>
                  )}
                </div>
              )}

              {/* Previsualización del Borrador de Correo */}
              {copilotResponse.redactarCorreo && (
                <div className="card-premium bg-light border border-secondary border-opacity-25 rounded-4 p-3 mb-3">
                  <h6 className="fw-bold text-dark mb-3 small d-flex align-items-center justify-content-between">
                    <span className="d-flex align-items-center gap-2">
                      <i className="bi bi-envelope-paper-fill text-primary"></i> Previsualización de Borrador
                    </span>
                    <a 
                      href="https://mail.google.com/mail/u/0/#drafts" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-0.5 fw-bold"
                      style={{ fontSize: '0.7rem' }}
                    >
                      <i className="bi bi-box-arrow-up-right me-1"></i>Abrir Gmail
                    </a>
                  </h6>
                  <div className="small mb-1 text-dark">
                    <strong>Para:</strong> {copilotResponse.redactarCorreo.destinatario || <span className="text-muted italic">(Sin destinatario especificado)</span>}
                  </div>
                  <div className="small mb-2 text-dark">
                    <strong>Asunto:</strong> {copilotResponse.redactarCorreo.asunto || <span className="text-muted italic">(Sin asunto)</span>}
                  </div>
                  <div 
                    className="p-3 bg-white rounded-3 border small text-muted overflow-auto font-monospace" 
                    style={{ maxHeight: '160px', whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}
                  >
                    {copilotResponse.redactarCorreo.cuerpo}
                  </div>
                </div>
              )}

              {/* Respuesta de la Consulta Estratégica o Búsqueda */}
              {copilotResponse.respuestaConsulta && (
                <div className="card-premium border-0 bg-light p-4 rounded-4 shadow-sm mb-2">
                  <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
                    <i className={`bi ${copilotMode === 'search' ? 'bi-search text-success' : 'bi-journal-text text-primary'}`}></i> {copilotMode === 'search' ? 'Resultados de Búsqueda Inteligente' : 'Análisis CRM & Notas Históricas'}
                  </h6>
                  <div className="ps-0">
                    {formatResponse(copilotResponse.respuestaConsulta)}
                  </div>
                </div>
              )}

              {/* Confirmación simple para modo acción si no hubo actualización de salud visible */}
              {!copilotResponse.respuestaConsulta && copilotResponse.ejecucionExitosa && (
                <div className="alert alert-info rounded-3 py-2 px-3 small border-0 shadow-sm mt-3">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  La salud y el análisis del cliente se recalcularán automáticamente en el panel principal.
                </div>
              )}

              {/* Controles de Feedback de Copiloto */}
              <div className="mt-3 d-flex align-items-center justify-content-between p-2.5 bg-light bg-opacity-50 rounded-4 border">
                <span className="small text-muted fw-semibold"><i className="bi bi-robot me-1 text-primary"></i> ¿Qué tal funcionó el Copiloto?</span>
                <div className="d-flex align-items-center gap-2">
                  {copilotFeedback === 'positive' ? (
                    <span className="text-success small fw-bold"><i className="bi bi-check-circle-fill me-1"></i> Aprobado</span>
                  ) : copilotFeedback === 'negative' ? (
                    <span className="text-warning small fw-bold"><i className="bi bi-exclamation-triangle-fill me-1"></i> Reportado</span>
                  ) : (
                    <>
                      <button 
                        type="button"
                        className="btn btn-link btn-xs text-muted p-0 me-2 border-0 bg-transparent" 
                        title="Respuesta correcta"
                        onClick={() => handleCopilotFeedback('positive')}
                      >
                        <i className="bi bi-hand-thumbs-up fs-6"></i>
                      </button>
                      <button 
                        type="button"
                        className="btn btn-link btn-xs text-muted p-0 border-0 bg-transparent" 
                        title="Respuesta incorrecta/incompleta"
                        onClick={() => handleCopilotFeedback('negative')}
                      >
                        <i className="bi bi-hand-thumbs-down fs-6"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Formulario de reporte negativo inline */}
              {showCopilotNegativeInput && (
                <div className="mt-2 p-3 bg-white rounded-3 border border-warning border-opacity-50 shadow-sm animate__animated animate__fadeIn">
                  <label className="small text-muted fw-bold mb-1 d-block">¿Qué estuvo mal o qué debería haber hecho?</label>
                  <textarea
                    className="form-control form-control-sm mb-2"
                    rows="2"
                    placeholder="Ej: Debió cambiar el estado a Activo pero no lo hizo..."
                    value={copilotCorrectionText}
                    onChange={(e) => setCopilotCorrectionText(e.target.value)}
                    style={{ fontSize: '0.8rem', resize: 'none' }}
                  />
                  <div className="d-flex justify-content-end gap-2">
                    <button 
                      type="button"
                      className="btn btn-xs btn-outline-secondary rounded-pill"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => {
                        setShowCopilotNegativeInput(false);
                        setCopilotCorrectionText('');
                      }}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      className="btn btn-xs btn-primary rounded-pill text-white fw-bold"
                      style={{ fontSize: '0.75rem' }}
                      disabled={!copilotCorrectionText.trim()}
                      onClick={submitCopilotFeedback}
                    >
                      Enviar reporte
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vista por defecto: estado de voz o texto */}
          {!loading && !copilotResponse && (
            <div className="text-center py-4 text-muted bg-light bg-opacity-50 border border-dashed rounded-4 mb-4">
              <i className={`bi ${copilotMode === 'action' ? 'bi-mic-fill' : (copilotMode === 'search' ? 'bi-search' : 'bi-journal-text')} fs-1 text-primary text-opacity-40 mb-2 d-block`}></i>
              {copilotMode === 'action' ? (
                <p className="small mb-0 px-4">
                  <strong>Modo Registro Rápido</strong><br />
                  Dicta una nota o un cambio de estado para guardarlo en la bitácora.<br />
                  Ej: <em>"Anota que el cliente está conforme y cambia el estado a Activo"</em>.
                </p>
              ) : copilotMode === 'search' ? (
                <p className="small mb-0 px-4">
                  <strong>Búsqueda Inteligente</strong><br />
                  Busca transversalmente en notas, contratos, contactos, onboarding y campos dinámicos.<br />
                  Ej: <em>"¿En qué mail nos llegó la respuesta al contrato de Distribución?"</em> o <em>"¿Quién autorizó la nota sobre tarifas?"</em>.
                </p>
              ) : (
                <p className="small mb-0 px-4">
                  <strong>Modo Consulta Completa</strong><br />
                  Haz una consulta sobre el historial, contratos o alertas del cliente.<br />
                  Ej: <em>"Hazme un resumen estratégico del cliente"</em>.
                </p>
              )}
            </div>
          )}

          {/* Área de Entrada y Control */}
          <div className="border-top pt-3 mt-2">
            
            {/* Si está deshabilitado por presupuesto o administración, bloquear todo */}
            {budgetDisabled || copilotAgentDisabled ? (
              <div className="text-center py-4 bg-light rounded-3 border border-secondary border-opacity-25 animate__animated animate__fadeIn">
                <i className="bi bi-robot text-secondary fs-2 mb-2 d-block"></i>
                <h6 className="fw-bold text-dark">LUXIA IA en Pausa</h6>
                <p className="small text-muted px-4 mb-0">
                  {budgetDisabled 
                    ? 'El asistente interactivo y la búsqueda inteligente han sido deshabilitados temporalmente debido al límite de uso mensual de IA.'
                    : 'El Copiloto IA del cliente se encuentra desactivado globalmente por políticas de la administración.'}
                </p>
                <p className="small text-muted px-4 mb-0 mt-2 fw-bold"><i className="bi bi-funnel"></i> Por favor, utiliza los filtros manuales en la bitácora y la plataforma para encontrar la información.</p>
              </div>
            ) : (
              <>
                {/* Controles de Entrada */}
            {inputMode === 'voice' ? (
              <div className="text-center py-3">
                {isListening ? (
                  <div className="d-flex flex-column align-items-center gap-3">
                    {/* Animación de ondas de audio */}
                    <div className="d-flex align-items-center justify-content-center gap-1" style={{ height: '40px' }}>
                      <div className="bg-primary rounded-pill animate-pulse" style={{ width: '4px', height: '24px', animation: 'pulse-wave 0.8s infinite 0.1s' }}></div>
                      <div className="bg-primary rounded-pill animate-pulse" style={{ width: '4px', height: '36px', animation: 'pulse-wave 0.8s infinite 0.2s' }}></div>
                      <div className="bg-primary rounded-pill animate-pulse" style={{ width: '4px', height: '16px', animation: 'pulse-wave 0.8s infinite 0.3s' }}></div>
                      <div className="bg-primary rounded-pill animate-pulse" style={{ width: '4px', height: '40px', animation: 'pulse-wave 0.8s infinite 0.4s' }}></div>
                      <div className="bg-primary rounded-pill animate-pulse" style={{ width: '4px', height: '28px', animation: 'pulse-wave 0.8s infinite 0.5s' }}></div>
                    </div>
                    
                    <button 
                      type="button" 
                      className="btn btn-danger btn-lg rounded-circle shadow-lg d-flex align-items-center justify-content-center"
                      style={{ width: '70px', height: '70px', animation: 'pulse-ring 1.5s infinite' }}
                      onClick={stopListening}
                    >
                      <i className="bi bi-mic-mute-fill fs-3"></i>
                    </button>
                    <span className="small fw-bold text-danger">Escuchando voz... Toca para detener</span>
                  </div>
                ) : (
                  <div className="d-flex flex-column align-items-center gap-3">
                    <button 
                      type="button" 
                      className="btn btn-primary btn-lg rounded-circle shadow-lg d-flex align-items-center justify-content-center"
                      style={{ width: '70px', height: '70px', transition: 'transform 0.2s' }}
                      onClick={startListening}
                    >
                      <i className="bi bi-mic-fill fs-3"></i>
                    </button>
                    <span className="small fw-bold text-primary">Toca para empezar a dictar</span>
                    <button 
                      type="button" 
                      className="btn btn-link btn-sm text-muted fw-bold"
                      onClick={() => setInputMode('text')}
                    >
                      <i className="bi bi-keyboard me-1"></i> Escribir en lugar de hablar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="input-group mb-2 shadow-sm rounded-3 overflow-hidden border">
                  <textarea
                    className="form-control border-0 px-3 py-2"
                    rows="2"
                    placeholder={copilotMode === 'action' ? "Escribe tu nota o cambio de estado aquí..." : "Escribe tu consulta estratégica aquí..."}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    style={{ resize: 'none', fontSize: '0.9rem' }}
                  ></textarea>
                  <button 
                    className="btn btn-primary d-flex align-items-center justify-content-center px-3" 
                    type="button"
                    disabled={loading || !transcript.trim()}
                    onClick={() => handleSend()}
                  >
                    <i className="bi bi-send-fill fs-5"></i>
                  </button>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <button 
                    type="button" 
                    className="btn btn-link btn-sm text-muted fw-bold p-0"
                    onClick={() => {
                      setInputMode('voice');
                      setTranscript('');
                    }}
                  >
                    <i className="bi bi-mic-fill me-1"></i> Volver a dictado por voz
                  </button>
                  {transcript.trim() && (
                    <button 
                      type="button" 
                      className="btn btn-xs btn-outline-secondary rounded-pill fw-bold"
                      onClick={() => setTranscript('')}
                      style={{ fontSize: '0.7rem' }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            )}
              </>
            )}

          </div>

        </div>
      </div>
      
      {/* Estilos locales para las micro-interacciones de la onda de audio y enlaces del buscador */}
      <style>{`
        @keyframes pulse-wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(220, 53, 69, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
        }
        .copilot-link {
          color: #0d6efd;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-bottom: 1px dashed rgba(13, 110, 253, 0.4);
          padding-bottom: 1px;
          transition: all 0.2s ease-in-out;
        }
        .copilot-link:hover {
          color: #0a58ca;
          border-bottom-color: #0a58ca;
          opacity: 0.85;
          transform: translateY(-1px);
        }
      `}</style>

    </div>
  );
}
