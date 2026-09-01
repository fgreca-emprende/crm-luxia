import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, callBackendApi } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { useUserRole } from '../../contexts/UserRoleContext';

export function WhatsappChatConsole({ clienteId, leadId, initialPhone }) {
  const { showAlert } = useToast();
  const { hasPermission, user } = useUserRole();
  const canSendWhatsapp = hasPermission('actions', 'enviar_mensajes_whatsapp');
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Input State
  const [textMessage, setTextMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isWhisper, setIsWhisper] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Template State
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateParams, setTemplateParams] = useState({});

  // 24 Hour Window Status
  const [isWindowActive, setIsWindowActive] = useState(true);
  const [whatsappActive, setWhatsappActive] = useState(true);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // User Name for autocompletion
  const [userName, setUserName] = useState(user?.nombre || user?.email || 'Comercial');
  const fileInputRef = useRef(null);

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
  };

  useEffect(() => {
    if (user?.nombre) setUserName(user.nombre);
    else if (user?.email) setUserName(user.email);
  }, [user]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const usage = await getConfigGeneral('whatsapp_usage');
        if (usage) {
          const disabled = (usage.disabledByBudget === true && usage.autoshutoffActive === true) || usage.manualPause === true;
          setWhatsappActive(!disabled);
        }
      } catch (err) {
        console.warn('Error sub to whatsapp_usage:', err);
      }
    };
    checkStatus();
  }, []);

  const getAutofilledValue = (field) => {
    if (field === 'Nombre del Cliente') return selectedContact?.nombre || '';
    if (field === 'Nombre del Comercial') return userName || '';
    return null;
  };

  const messagesEndRef = useRef(null);

  // Approved Meta Templates configuration for mock testing
  const TEMPLATE_CONFIG = {
    contacto_inicial: {
      name: 'contacto_inicial',
      label: 'Contacto Inicial (Bienvenida)',
      fields: ['Nombre del Cliente', 'Nombre del Comercial']
    },
    seguimiento_comercial: {
      name: 'seguimiento_comercial',
      label: 'Seguimiento de Propuesta',
      fields: ['Nombre del Comercial']
    },
    recordatorio_reunion: {
      name: 'recordatorio_reunion',
      label: 'Recordatorio de Reunión',
      fields: ['Nombre del Comercial', 'Fecha/Hora de la cita']
    }
  };

  // 1. Fetch contacts for this client or lead from Supabase
  const loadContacts = useCallback(async () => {
    if (!clienteId && !leadId) {
      setLoadingContacts(false);
      return;
    }
    setLoadingContacts(true);

    try {
      let query = supabase.from('contactos').select('*');
      if (clienteId) query = query.eq('cliente_id', clienteId);
      else if (leadId) query = query.eq('lead_id', leadId);

      const { data, error } = await query;
      if (error) throw error;

      const list = (data || []).map(d => ({
        id: d.id,
        nombre: d.nombre,
        email: d.email,
        telefono: d.telefono,
        cargo: d.cargo,
        esPrincipal: d.es_principal,
        clienteId: d.cliente_id,
        leadId: d.lead_id
      }));

      setContacts(list);
      if (list.length > 0 && !selectedContact) {
        setSelectedContact(list[0]);
      }
    } catch (err) {
      console.error('Error fetching contacts for chat console:', err);
      showAlert('Error al cargar contactos.', 'danger');
    } finally {
      setLoadingContacts(false);
    }
  }, [clienteId, leadId, selectedContact, showAlert]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // 2. Fetch WhatsApp messages from interacciones
  const loadMessages = useCallback(async () => {
    if (!selectedContact) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      let query = supabase
        .from('interacciones')
        .select('*')
        .eq('tipo', 'whatsapp')
        .order('created_at', { ascending: true });

      if (clienteId) query = query.eq('cliente_id', clienteId);
      else if (leadId) query = query.eq('lead_id', leadId);

      const { data, error } = await query;
      if (error) throw error;

      const cleanPhone = (selectedContact.telefono || '').replace(/\D/g, '');
      const list = (data || [])
        .filter(d => {
          const matchById = d.contacto_id === selectedContact.id;
          const matchByPhone = cleanPhone && d.contacto_telefono && 
                               (d.contacto_telefono.endsWith(cleanPhone) || cleanPhone.endsWith(d.contacto_telefono));
          return matchById || matchByPhone;
        })
        .map(d => ({
          id: d.id,
          tipo: d.tipo,
          isWhisper: d.is_whisper,
          contactoId: d.contacto_id,
          contactoTelefono: d.contacto_telefono,
          descripcion: d.descripcion,
          autor: d.autor,
          timestamp: d.created_at
        }));

      setMessages(list);

      if (list.length > 0) {
        const lastMsg = list[list.length - 1];
        const isLastMsgIncoming = lastMsg.autor !== 'Comercial (CRM)' && !lastMsg.autor.includes('@');
        if (isLastMsgIncoming) {
          const lastMsgTime = new Date(lastMsg.timestamp || 0).getTime();
          const timeDiffHours = (Date.now() - lastMsgTime) / (1000 * 60 * 60);
          setIsWindowActive(timeDiffHours < 24);
        } else {
          setIsWindowActive(false);
        }
      } else {
        setIsWindowActive(false);
      }
    } catch (err) {
      console.error('Error fetching messages for chat console:', err);
      showAlert('Error al cargar historial del chat.', 'danger');
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedContact, clienteId, leadId, showAlert]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTemplateChange = (e) => {
    const templateKey = e.target.value;
    setSelectedTemplate(templateKey);
    setTemplateParams({});
  };

  const handleParamChange = (field, val) => {
    setTemplateParams(prev => ({
      ...prev,
      [field]: val
    }));
  };

  // 3. Send WhatsApp message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!canSendWhatsapp) {
      showAlert('No tienes permisos para enviar mensajes de WhatsApp.', 'warning');
      return;
    }
    if (!selectedContact) return;
    if (!selectedTemplate && !textMessage.trim()) return;

    setSending(true);
    try {
      const msgContent = selectedTemplate 
        ? `[Plantilla: ${selectedTemplate}] ${Object.entries(templateParams).map(([k, v]) => `${k}: ${v}`).join(', ')}`
        : textMessage.trim();

      const whisperDoc = {
        cliente_id: clienteId || null,
        lead_id: leadId || null,
        tipo: 'whatsapp',
        is_whisper: isWhisper,
        contacto_id: selectedContact.id,
        contacto_telefono: (selectedContact.telefono || '').replace(/\D/g, ''),
        descripcion: msgContent,
        autor: isWhisper ? (userName || 'Comercial (Nota Interna)') : (userName || 'Comercial (CRM)')
      };

      const { error } = await supabase.from('interacciones').insert(whisperDoc);
      if (error) throw error;

      setTextMessage('');
      setSelectedTemplate('');
      setTemplateParams({});
      setIsWhisper(false);
      showAlert(isWhisper ? 'Nota interna guardada.' : 'Registrado en Bitácora / Registro Interno.', 'success');
      loadMessages();
    } catch (err) {
      console.error('Error sending WhatsApp message:', err);
      showAlert(`Falla al enviar: ${err.message}`, 'danger');
    } finally {
      setSending(false);
    }
  };

  // 4. Copilot AI Suggestion
  const handleGetAISuggestion = async () => {
    if (!selectedContact) return;
    setSuggesting(true);
    try {
      const prompt = `Genera un mensaje cordial, profesional y empático para enviar por WhatsApp a ${selectedContact?.nombre || 'el contacto'} de LUXIA Agro. Contexto de teléfono: ${selectedContact?.telefono || ''}.`;
      
      const aiRes = await callBackendApi('/copilot', {
        prompt,
        clienteId: clienteId || null,
        contexto: {
          contactoNombre: selectedContact.nombre,
          telefono: selectedContact.telefono,
          clienteId,
          leadId
        }
      }).catch(() => null);

      let draft = '';
      if (aiRes?.success && (aiRes.text || aiRes.data?.sugerencia)) {
        draft = aiRes.data?.sugerencia || aiRes.text;
      } else {
        draft = `Hola ${selectedContact?.nombre || 'estimado cliente'}, ¿cómo estás? Te escribo de parte del equipo de LUXIA Agro para dar seguimiento a nuestra conversación técnica y comercial. ¿Tendrás unos minutos esta semana para revisar los detalles?`;
      }

      setTextMessage(draft);
      showAlert('Sugerencia de Sentinel Copilot cargada con éxito.', 'success');
    } catch (err) {
      console.error('Error fetching suggestion:', err);
      showAlert(`Copilot falló: ${err.message}`, 'danger');
    } finally {
      setSuggesting(false);
    }
  };

  // 5. File attachment and upload
  const handleFileAttach = async (e) => {
    if (!canSendWhatsapp) {
      showAlert('No tienes permisos para adjuntar archivos por WhatsApp.', 'warning');
      return;
    }
    const file = e.target.files[0];
    if (!file || !selectedContact) return;

    setUploadingFile(true);
    setUploadProgress(50);

    try {
      const whisperDoc = {
        cliente_id: clienteId || null,
        lead_id: leadId || null,
        tipo: 'whatsapp',
        is_whisper: false,
        contacto_id: selectedContact.id,
        contacto_telefono: (selectedContact.telefono || '').replace(/\D/g, ''),
        descripcion: `📎 Archivo adjunto: ${file.name}`,
        autor: userName || 'Comercial (CRM)'
      };

      await supabase.from('interacciones').insert(whisperDoc);
      setUploadProgress(100);
      showAlert('Archivo adjuntado y registrado en la conversación.', 'success');
      loadMessages();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('File upload error:', err);
      showAlert('Error al procesar el archivo.', 'danger');
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Filtrado y ordenamiento en memoria para +100 contactos (Fase 1 y 2)
  const filteredContacts = contacts.filter(c => {
    const nameMatch = (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = (c.telefono || '').includes(searchTerm);
    return nameMatch || phoneMatch;
  });

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const dateA = a.lastMessageAt ? (a.lastMessageAt.toDate ? a.lastMessageAt.toDate() : new Date(a.lastMessageAt)) : new Date(0);
    const dateB = b.lastMessageAt ? (b.lastMessageAt.toDate ? b.lastMessageAt.toDate() : new Date(b.lastMessageAt)) : new Date(0);
    return dateB - dateA;
  });

  return (
    <div className="card border-0 rounded-4 overflow-hidden shadow-sm" style={{ height: '520px' }}>
      <div className="row g-0 h-100">
        
        {/* SIDEBAR: CONTACT SELECTOR */}
        <div className="col-md-4 border-end bg-light h-100 d-flex flex-column" style={{ maxHeight: '520px' }}>
          <div className="p-3 border-bottom bg-white">
            <h6 className="fw-bold mb-0 text-dark">Contactos de WhatsApp</h6>
            <small className="text-muted mb-2 d-block">Selecciona una línea para chatear</small>
            
            {/* Buscador de contactos (Fase 1) */}
            <div className="input-group input-group-sm mt-2 shadow-sm rounded-pill overflow-hidden border">
              <span className="input-group-text bg-white border-0 text-muted"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control border-0 ps-0 text-dark"
                placeholder="Buscar contacto..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ fontSize: '0.75rem', outline: 'none', boxShadow: 'none' }}
              />
              {searchTerm && (
                <button type="button" className="btn btn-link btn-sm text-muted border-0 bg-white p-0 px-2" onClick={() => setSearchTerm('')}>
                  <i className="bi bi-x-lg" style={{ fontSize: '0.7rem' }}></i>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-grow-1 overflow-y-auto p-2" style={{ maxHeight: '430px' }}>
            {loadingContacts ? (
              <div className="d-flex justify-content-center p-4">
                <SpinnerPremium size="sm" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-center text-muted small py-4">No hay contactos registrados.</p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-center text-muted small py-4">Ningún contacto coincide.</p>
            ) : (
              sortedContacts.map(c => {
                const isSelected = selectedContact?.id === c.id;
                
                // Determinar si la ventana de 24h está activa en base al timestamp del contacto (Fase 2)
                const isContactWindowActive = c.windowActiveUntil 
                  ? (c.windowActiveUntil.toDate ? c.windowActiveUntil.toDate() : new Date(c.windowActiveUntil)) > new Date() 
                  : false;

                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectContact(c)}
                    className={`w-100 text-start p-3 mb-2 border-0 rounded-3 transition-all d-flex align-items-start gap-2.5 position-relative ${
                      isSelected 
                        ? 'bg-success bg-opacity-10 text-success fw-bold border-start border-4 border-success shadow-sm' 
                        : 'bg-white text-dark hover-bg-light border'
                    }`}
                    style={{ transition: 'all 0.2s' }}
                    type="button"
                  >
                    <div className="rounded-circle bg-success bg-opacity-10 text-success p-2 d-flex justify-content-center align-items-center flex-shrink-0" style={{ width: '32px', height: '32px', marginTop: '2px' }}>
                      <i className="bi bi-person-fill" style={{ fontSize: '0.9rem' }}></i>
                    </div>
                    <div className="overflow-hidden flex-grow-1" style={{ maxWidth: 'calc(100% - 70px)' }}>
                      <div className="small text-truncate text-dark fw-bold mb-0.5">{c.nombre}</div>
                      <div className="text-muted small text-truncate" style={{ fontSize: '0.68rem', lineHeight: '1.2' }}>{c.telefono || 'Sin teléfono'}</div>
                      
                      {/* Vista previa del último mensaje (Fase 2) */}
                      {c.lastMessageText && (
                        <div className="text-muted text-truncate mt-1" style={{ fontSize: '0.65rem', fontStyle: 'italic' }}>
                          {c.lastMessageText}
                        </div>
                      )}
                      
                      {/* Píldora de estado de ventana 24h (Fase 1 y 2) */}
                      <div className="mt-1.5">
                        <span className={`badge rounded-pill ${isContactWindowActive ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-muted'}`} style={{ fontSize: '0.55rem', padding: '0.2em 0.5em' }}>
                          {isContactWindowActive ? '🟢 Activo 24h' : '🔴 Inactivo'}
                        </span>
                      </div>
                    </div>

                    {/* Contador de no leídos (Fase 1 y 2) */}
                    {c.unreadCount > 0 && !isSelected && (
                      <span className="badge rounded-pill bg-success text-white fw-bold ms-auto position-absolute" style={{ fontSize: '0.62rem', top: '12px', right: '12px', padding: '0.25em 0.6em' }}>
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CHAT WINDOW */}
        <div className="col-md-8 h-100 d-flex flex-column bg-white">
          {selectedContact ? (
            <>
              {/* CHAT HEADER */}
              <div className="p-3 border-bottom bg-light d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="fw-bold mb-0 text-dark">{selectedContact.nombre}</h6>
                  <small className="text-muted d-flex align-items-center gap-1">
                    <i className="bi bi-whatsapp text-success"></i> {selectedContact.telefono}
                  </small>
                </div>
                <div>
                  <span className={`badge rounded-pill ${isWindowActive ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-muted'}`} style={{ fontSize: '0.65rem' }}>
                    {isWindowActive ? 'Ventana 24h Activa' : 'Conversación Cerrada'}
                  </span>
                </div>
              </div>

              {/* CHAT VIEWPORT */}
              <div className="flex-grow-1 overflow-y-auto p-3 bg-light bg-opacity-50 d-flex flex-column" style={{ minHeight: '100px' }}>
                {loadingMessages ? (
                  <div className="d-flex justify-content-center my-auto">
                    <SpinnerPremium size="sm" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center my-auto p-4">
                    <div className="rounded-circle bg-light p-3 d-inline-flex mb-2 text-muted">
                      <i className="bi bi-chat-left-text-fill fs-4"></i>
                    </div>
                    <p className="text-muted small mb-0">No hay mensajes previos.</p>
                    <small className="text-muted" style={{ fontSize: '0.7rem' }}>Inicia la conversación enviando una plantilla.</small>
                  </div>
                ) : (
                  messages.map(msg => {
                    const timestampStr = msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Reciente';

                    // Whisper (Internal Note) layout
                    if (msg.isWhisper) {
                      return (
                        <div key={msg.id} className="w-100 text-center mb-3">
                          <div className="d-inline-block p-3 rounded-4 bg-warning bg-opacity-10 text-dark border border-warning-subtle small shadow-sm text-start" style={{ maxWidth: '85%', minWidth: '220px' }}>
                            <div className="d-flex align-items-center gap-1 fw-bold mb-2 text-warning-emphasis" style={{ fontSize: '0.72rem' }}>
                              <i className="bi bi-lock-fill text-warning"></i> Nota Interna ({msg.autor}):
                            </div>
                            <p className="mb-0 small text-secondary" style={{ whiteSpace: 'pre-wrap' }}>{msg.descripcion}</p>
                            <div className="text-end text-muted mt-1" style={{ fontSize: '0.58rem' }}>
                              {timestampStr}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isOutbound = msg.descripcion.includes('📤 WhatsApp Enviado');
                    const text = msg.descripcion.split('\n\n')[1] || msg.descripcion;
                    const hasMedia = !!msg.metadata?.mediaUrl;
                    const mediaType = msg.metadata?.mediaType;
                    const mediaUrl = msg.metadata?.mediaUrl;
                    const fileName = msg.metadata?.fileName || 'archivo';

                    return (
                      <div 
                        key={msg.id}
                        className={`d-flex flex-column mb-3 ${isOutbound ? 'align-self-end align-items-end' : 'align-self-start align-items-start'}`}
                        style={{ maxWidth: '75%' }}
                      >
                        <div className={`p-3 rounded-4 shadow-sm border ${
                          isOutbound 
                            ? 'bg-success text-white border-success rounded-tr-0' 
                            : 'bg-white text-dark border-light rounded-tl-0'
                        }`}>
                          {hasMedia && (
                            <div className="mb-2">
                              {mediaType === 'image' && (
                                <img src={mediaUrl} alt={fileName} className="img-fluid rounded border border-light" style={{ maxHeight: '180px', objectFit: 'cover' }} />
                              )}
                              {mediaType === 'audio' && (
                                <audio controls src={mediaUrl} className="w-100" style={{ maxHeight: '36px' }} />
                              )}
                              {mediaType === 'document' && (
                                <div className="d-flex align-items-center gap-2 p-2 bg-black bg-opacity-10 rounded-3 text-start">
                                  <i className="bi bi-file-earmark-arrow-down-fill fs-4 text-info"></i>
                                  <div className="overflow-hidden flex-grow-1" style={{ maxWidth: '180px' }}>
                                    <div className="text-truncate small fw-bold text-white">{fileName}</div>
                                    <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-info small text-decoration-none d-inline-flex align-items-center gap-1">
                                      Descargar <i className="bi bi-download"></i>
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <p className="mb-1 small" style={{ whiteSpace: 'pre-wrap' }}>
                            {hasMedia ? (mediaType === 'document' ? `Documento enviado: ${fileName}` : '') : text.replace(/^"|"$/g, '')}
                          </p>
                          <div className="d-flex justify-content-between align-items-center mt-1" style={{ fontSize: '0.62rem', opacity: 0.8 }}>
                            <span className="me-2">{timestampStr}</span>
                            {isOutbound && (
                              <span>
                                {msg.metadata?.deliveryStatus === 'read' ? (
                                  <i className="bi bi-check2-all text-info fw-bold"></i>
                                ) : msg.metadata?.deliveryStatus === 'delivered' ? (
                                  <i className="bi bi-check2-all text-white"></i>
                                ) : (
                                  <i className="bi bi-check2 text-white"></i>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* LUXIA IA Sentiment Badge and Summary for inbound messages */}
                        {!isOutbound && (msg.metadata?.sentimiento || msg.metadata?.resumen) && (
                          <div className="d-flex flex-column align-items-start mt-1 gap-1" style={{ maxWidth: '280px' }}>
                            {msg.metadata.sentimiento && (
                              <span 
                                className="badge bg-secondary bg-opacity-10 text-muted rounded-pill px-2"
                                style={{ fontSize: '0.58rem' }}
                              >
                                Sentimiento IA: {msg.metadata.sentimiento}
                              </span>
                            )}
                            {msg.metadata.resumen && (
                              <small className="text-muted px-1" style={{ fontSize: '0.65rem', fontStyle: 'italic', display: 'block' }}>
                                💡 {msg.metadata.resumen}
                              </small>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* CHAT INPUT AREA */}
              <div className="p-3 border-top bg-white">
                {!canSendWhatsapp ? (
                  <div className="alert alert-warning py-3 px-3 rounded-3 text-center mb-0 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center justify-content-center gap-2 animate__animated animate__fadeIn" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-shield-lock-fill fs-5 text-warning"></i>
                    <div>
                      <strong>Permisos de Solo Lectura:</strong> Tu rol no cuenta con permisos para enviar mensajes o iniciar plantillas de WhatsApp.
                    </div>
                  </div>
                ) : !whatsappActive ? (
                  <div className="alert alert-warning py-3 px-3 rounded-3 text-center mb-0 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center justify-content-center gap-2 animate__animated animate__fadeIn" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-whatsapp fs-5 text-warning animate-pulse"></i>
                    <div>
                      <strong>Integración Desactivada:</strong> Meta WhatsApp corporativo ha sido deshabilitado globalmente. El envío de mensajes y plantillas está suspendido.
                    </div>
                  </div>
                ) : isWindowActive ? (
                  /* Standard Input for Active 24h Window */
                  <div className="d-flex flex-column gap-2">
                    {/* Whisper (Internal Note) Toggle & Suggestion button */}
                    <div className="d-flex align-items-center justify-content-between px-1">
                      <div className="form-check form-switch mb-0" style={{ fontSize: '0.75rem' }}>
                        <input 
                          className="form-check-input" 
                          type="checkbox" 
                          role="switch" 
                          id="whisperToggle" 
                          checked={isWhisper} 
                          onChange={(e) => setIsWhisper(e.target.checked)} 
                        />
                        <label className="form-check-label text-muted fw-bold" htmlFor="whisperToggle">
                          <i className={`bi ${isWhisper ? 'bi-lock-fill text-warning' : 'bi-unlock-fill text-muted'} me-1`}></i>
                          {isWhisper ? 'Nota Interna (Susurro)' : 'Mensaje Público'}
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleGetAISuggestion}
                        disabled={suggesting || sending || uploadingFile}
                        className="btn btn-link text-success p-0 d-flex align-items-center gap-1 text-decoration-none"
                        style={{ fontSize: '0.72rem', fontWeight: '600' }}
                      >
                        {suggesting ? (
                          <>
                            <SpinnerPremium size="sm" /> Generando...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-magic"></i> Sugerir con LUXIA IA
                          </>
                        )}
                      </button>
                    </div>

                    {/* Progress Bar for File Uploads */}
                    {uploadingFile && (
                      <div className="w-100 bg-light rounded overflow-hidden mb-1" style={{ height: '5px' }}>
                        <div className="bg-success h-100 transition-all" style={{ width: `${uploadProgress}%`, transition: 'width 0.2s' }}></div>
                      </div>
                    )}

                    {/* Standard Message Form */}
                    <form onSubmit={handleSendMessage} className="d-flex gap-2 align-items-center">
                      {/* Hidden File Input */}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileAttach} 
                        style={{ display: 'none' }} 
                        disabled={sending || uploadingFile}
                      />

                      {/* File Clip Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploadingFile}
                        className="btn btn-outline-secondary btn-sm rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: '34px', height: '34px' }}
                        title="Adjuntar archivo"
                      >
                        <i className="bi bi-paperclip" style={{ fontSize: '0.9rem' }}></i>
                      </button>

                      <textarea
                        value={textMessage}
                        onChange={e => setTextMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        placeholder={isWhisper ? "Escribe una nota interna para este cliente..." : "Escribe un mensaje de respuesta..."}
                        className={`form-control form-control-sm rounded-3 px-3 py-2 border ${isWhisper ? 'bg-warning bg-opacity-10 border-warning-subtle' : ''}`}
                        disabled={sending || uploadingFile}
                        style={{ fontSize: '0.8rem', resize: 'none', minHeight: '52px' }}
                      />

                      <button
                        type="submit"
                        disabled={sending || uploadingFile || !textMessage.trim()}
                        className={`btn ${isWhisper ? 'btn-warning text-dark' : 'btn-success'} btn-sm rounded-circle d-flex align-items-center justify-content-center shadow`}
                        style={{ width: '34px', height: '34px' }}
                      >
                        {sending ? <SpinnerPremium size="sm" /> : <i className="bi bi-send-fill" style={{ fontSize: '0.85rem' }}></i>}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Template Selector for Expired/Closed Session */
                  <div className="p-2 border rounded-3 bg-light bg-opacity-70">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-warning text-dark" style={{ fontSize: '0.62rem' }}>Ventana Expirada</span>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>Debes iniciar la conversación usando una plantilla comercial aprobada por Meta.</small>
                    </div>

                    <form onSubmit={handleSendMessage} className="row g-2">
                      <div className="col-12">
                        <select
                          value={selectedTemplate}
                          onChange={handleTemplateChange}
                          className="form-select form-select-sm border small"
                          style={{ fontSize: '0.8rem' }}
                        >
                          <option value="">-- Seleccionar Plantilla de WhatsApp --</option>
                          {Object.values(TEMPLATE_CONFIG).map(t => (
                            <option key={t.name} value={t.name}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Dynamic Parameters Inputs */}
                      {selectedTemplate && TEMPLATE_CONFIG[selectedTemplate].fields.map(field => {
                        const autofillVal = getAutofilledValue(field);
                        const isAutofilled = autofillVal !== null;
                        const value = isAutofilled ? autofillVal : (templateParams[field] || '');

                        return (
                          <div key={field} className="col-md-6">
                            <label className="form-label text-muted mb-1" style={{ fontSize: '0.65rem' }}>{field}</label>
                            <input
                              type="text"
                              required
                              disabled={isAutofilled}
                              placeholder={isAutofilled ? '' : `Ingresar ${field}`}
                              value={value}
                              onChange={e => handleParamChange(field, e.target.value)}
                              className={`form-control form-control-sm border ${isAutofilled ? 'bg-light text-muted' : ''}`}
                              style={{ fontSize: '0.75rem' }}
                            />
                          </div>
                        );
                      })}

                      <div className="col-12 text-end">
                        <button
                          type="submit"
                          disabled={sending || !selectedTemplate}
                          className="btn btn-success btn-sm rounded-pill px-4 fw-bold shadow-sm"
                          style={{ fontSize: '0.75rem' }}
                        >
                          {sending ? 'Enviando...' : 'Enviar Plantilla'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center my-auto p-4">
              <div className="rounded-circle bg-light p-3 d-inline-flex mb-3 text-muted">
                <i className="bi bi-whatsapp fs-3"></i>
              </div>
              <h6 className="fw-bold text-dark">No hay contactos seleccionados</h6>
              <p className="text-muted small">Selecciona o registra un contacto en la lista lateral para iniciar el chat.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
