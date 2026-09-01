import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { DynamicFieldInput } from './DynamicFieldInput';
import { ClienteTimeline } from './ClienteTimeline';
import { useUserRole } from '../../contexts/UserRoleContext';
import { ContactListWidget } from './ContactListWidget';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { WhatsappChatConsole } from './WhatsappChatConsole';
import { formatDateTime } from '../../utils/dateUtils';

export function LeadGestionModal({ show, onClose, leadData, onSaved, iaPausada, leadScorerDisabled }) {
  const { isAdmin, isSuperAdmin, isLector: isLectorRole, hasPermission, user } = useUserRole();
  const isLector = isLectorRole || !hasPermission('actions', 'editar_lead');
  const [activeTab, setActiveTab] = useState('general');
  const [estado, setEstado] = useState(leadData?.estado || 'nuevo');
  const [origen, setOrigen] = useState(leadData?.origen || 'web');
  const [notas, setNotas] = useState(leadData?.notas || '');
  const [pais, setPais] = useState(leadData?.pais || '');
  const [camposConfig, setCamposConfig] = useState([]);
  const [camposDinamicos, setCamposDinamicos] = useState(leadData?.camposDinamicos || {});
  
  const [asignadoA, setAsignadoA] = useState(leadData?.asignadoA || '');
  const [usuariosComerciales, setUsuariosComerciales] = useState([]);

  // Nuevos campos firmográficos, Inbound y calificación de Lead
  const [cuit_rut_rfc, setCuitRutRfc] = useState(leadData?.cuit_rut_rfc || '');
  const [industria, setIndustria] = useState(leadData?.industria || '');
  const [sitioWeb, setSitioWeb] = useState(leadData?.sitioWeb || '');
  const [volumenMensualProyectado, setVolumenMensualProyectado] = useState(leadData?.volumenMensualProyectado || '');
  const [stackTecnologicoActual, setStackTecnologicoActual] = useState(leadData?.stackTecnologicoActual || '');
  const [subEstadoContacto, setSubEstadoContacto] = useState(leadData?.subEstadoContacto || '');
  const [motivoDescalificacion, setMotivoDescalificacion] = useState(leadData?.motivoDescalificacion || '');

  const [originalEstado, setOriginalEstado] = useState(leadData?.estado || 'nuevo');
  const [originalNotas, setOriginalNotas] = useState(leadData?.notas || '');
  const [originalAsignadoA, setOriginalAsignadoA] = useState(leadData?.asignadoA || '');
  const [originalOrigen, setOriginalOrigen] = useState(leadData?.origen || 'web');
  
  const [saving, setSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const { showAlert } = useToast();
  const [selectedChatContactPhone, setSelectedChatContactPhone] = useState('');

  useEffect(() => {
    const handleNav = (e) => {
      setActiveTab('whatsapp');
      setSelectedChatContactPhone(e.detail.telefono || '');
    };
    window.addEventListener('navigateToWhatsAppChat', handleNav);
    return () => window.removeEventListener('navigateToWhatsAppChat', handleNav);
  }, []);

  useEffect(() => {
    if (!show || !leadData?.id) return;

    setActiveTab('general');
    setSaving(false);
    setDeleting(false);
    setShowDeleteConfirm(false);
    setMotivoEliminar('');

    const initEstado = leadData.estado || 'nuevo';
    const initNotas = leadData.notas || '';
    const initPais = leadData.pais || 'AR';
    const initAsignadoA = leadData.asignadoA || '';
    const initOrigen = leadData.origen || 'web';

    setEstado(initEstado);
    setOriginalEstado(initEstado);
    setNotas(initNotas);
    setOriginalNotas(initNotas);
    setPais(initPais);
    setAsignadoA(initAsignadoA);
    setOriginalAsignadoA(initAsignadoA);
    setOrigen(initOrigen);
    setOriginalOrigen(initOrigen);
    setCuitRutRfc(leadData.cuit_rut_rfc || '');
    setIndustria(leadData.industria || '');
    setSitioWeb(leadData.sitioWeb || '');
    setVolumenMensualProyectado(leadData.volumenMensualProyectado || '');
    setStackTecnologicoActual(leadData.stackTecnologicoActual || '');
    setSubEstadoContacto(leadData.subEstadoContacto || '');
    setMotivoDescalificacion(leadData.motivoDescalificacion || '');
    setCamposDinamicos(leadData.camposDinamicos || {});

    const loadMeta = async () => {
      try {
        const [camposRes, userRes, leadRes] = await Promise.all([
          supabase.from('config_campos').select('*').order('orden'),
          supabase.from('usuarios').select('*'),
          supabase.from('leads').select('*').eq('id', leadData.id).maybeSingle()
        ]);

        if (camposRes.data) setCamposConfig(camposRes.data);
        if (userRes.data) {
          const temp = {};
          userRes.data.forEach(u => {
            const email = (u.email || u.id || '').toLowerCase().trim();
            if (!email || !email.includes('@')) return;
            temp[email] = { email, nombre: u.nombre || email, equipo: u.equipo || '' };
          });
          setUsuariosComerciales(Object.values(temp));
        }

        if (leadRes.data) {
          const d = leadRes.data;
          setEstado(d.estado || 'nuevo');
          setOriginalEstado(d.estado || 'nuevo');
          setNotas(d.notas || '');
          setOriginalNotas(d.notas || '');
          setPais(d.pais || 'AR');
          setAsignadoA(d.asignado_a || '');
          setOriginalAsignadoA(d.asignado_a || '');
          setOrigen(d.origen || 'web');
          setOriginalOrigen(d.origen || 'web');
          setCuitRutRfc(d.cuit_rut_rfc || '');
          setIndustria(d.industria || '');
          setSitioWeb(d.sitio_web || '');
          setVolumenMensualProyectado(d.volumen_mensual_proyectado || '');
          setStackTecnologicoActual(d.stack_tecnologico_actual || '');
          setSubEstadoContacto(d.sub_estado_contacto || '');
          setMotivoDescalificacion(d.motivo_descalificacion || '');
          setCamposDinamicos(d.campos_dinamicos || {});
          setIsAnalyzing(d._trigger_ia === true);
        }
      } catch (err) {
        console.warn("Error cargando datos del lead:", err);
      }
    };

    loadMeta();
  }, [leadData?.id, show]);

  if (!show || !leadData) return null;

  const saveLeadData = async (triggerIA = false) => {
    if ((estado === 'perdido' || estado === 'descalificado') && !motivoDescalificacion) {
      showAlert('Debes indicar la razón de descalificación del prospecto.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = { 
        estado, 
        notas, 
        pais, 
        asignado_a: asignadoA, 
        origen,
        cuit_rut_rfc: cuit_rut_rfc.trim() || null,
        industria: industria || null,
        sitio_web: sitioWeb.trim() || null,
        volumen_mensual_proyectado: volumenMensualProyectado ? Number(volumenMensualProyectado) : null,
        stack_tecnologico_actual: stackTecnologicoActual || null,
        sub_estado_contacto: subEstadoContacto || null,
        motivo_descalificacion: (estado === 'perdido' || estado === 'descalificado') ? motivoDescalificacion : null,
        campos_dinamicos: camposDinamicos, 
        updated_at: new Date().toISOString()
      };

      if (triggerIA) payload._trigger_ia = true;

      const { error: updateError } = await supabase
        .from('leads')
        .update(payload)
        .eq('id', leadData.id);

      if (updateError) throw updateError;

      if (estado !== originalEstado) {
        await supabase.from('interacciones').insert({
          lead_id: leadData.id,
          tipo: 'cambio_estado',
          descripcion: `Cambio de estado manual: de "${originalEstado || 'Sin Estado'}" a "${estado}"`,
          autor: user?.email || 'admin@luxia.com'
        });
      }

      if (triggerIA) {
        showAlert('Análisis IA solicitado.', 'success');
        onSaved();
      } else {
        showAlert('Prospecto actualizado correctamente', 'success');
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error(err);
      showAlert(`Error al actualizar prospecto: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLead = async () => {
    if (motivoEliminar.trim().length < 10) {
      showAlert('Por favor ingresa un motivo válido (mínimo 10 caracteres).', 'warning');
      return;
    }
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from('interacciones').delete().eq('lead_id', leadData.id),
        supabase.from('contactos').delete().eq('lead_id', leadData.id)
      ]);

      const { error: deleteError } = await supabase.from('leads').delete().eq('id', leadData.id);
      if (deleteError) throw deleteError;

      showAlert(`Lead ${leadData.nombreEmpresa} eliminado permanentemente.`, 'success');
      setShowDeleteConfirm(false);
      setMotivoEliminar('');
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      showAlert(`Error al eliminar lead: ${err.message}`, 'danger');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-fullscreen-md-down">
        <div className="modal-content glass-panel" style={{ position: 'relative' }}>
          {saving && <SpinnerPremium overlay={true} text="Guardando cambios del lead..." />}
          <div className="modal-header border-bottom-0 pb-0">
            <h5 className="modal-title">Lead: {leadData.nombreEmpresa}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <div className="px-3 pt-2">
            <ul className="nav nav-tabs-mobile-scroll border-bottom-0">
              <li className="nav-item">
                <button className={`nav-link ${activeTab === 'general' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('general')}>General</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${activeTab === 'contactos' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('contactos')}>Contactos</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${activeTab === 'bitacora' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('bitacora')}>Bitácora</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${activeTab === 'whatsapp' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('whatsapp')}>
                  <i className="bi bi-whatsapp text-success me-1"></i> WhatsApp
                </button>
              </li>
            </ul>
          </div>
          
          <div className="modal-body border-top">
            <div className={activeTab === 'general' ? 'd-block' : 'd-none'}>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label small fw-bold">Estado</label>
                  <select className="form-select form-select-sm" value={estado} onChange={e => setEstado(e.target.value)} disabled={isLector}>
                    <option value="nuevo">Nuevo</option>
                    <option value="contactado">Contactado</option>
                    <option value="calificado">Calificado</option>
                    <option value="perdido">Perdido</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">Origen</label>
                  <select className="form-select form-select-sm" value={origen} onChange={e => setOrigen(e.target.value)} disabled={isLector}>
                    <option value="web">Web</option>
                    <option value="chatbot">Chatbot IA</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="referido">Referido</option>
                    <option value="manual">Manual</option>
                    <option value="pauta">Pauta (Ads)</option>
                    <option value="bd">Base de Datos</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">País</label>
                  <select className="form-select form-select-sm" value={pais} onChange={e => setPais(e.target.value)} disabled={isLector}>
                    <option value="AR">🇦🇷 Argentina (AR)</option>
                    <option value="CL">🇨🇱 Chile (CL)</option>
                    <option value="CO">🇨🇴 Colombia (CO)</option>
                    <option value="PE">🇵🇪 Perú (PE)</option>
                    <option value="MX">🇲🇽 México (MX)</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">Comercial Asignado</label>
                  <select className="form-select form-select-sm" value={asignadoA} onChange={e => setAsignadoA(e.target.value)} disabled={isLector || !hasPermission('actions', 'asignar_responsable_comercial')}>
                    <option value="">Sin Asignar</option>
                    {usuariosComerciales.filter(u => {
                      const norm = (u.equipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                      return norm === 'adquisicion' || norm === 'retencion';
                    }).map(u => (
                      <option key={u.email} value={u.email}>{u.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* ===== SECCIÓN DE DATOS FIRMOGRÁFICOS Y DE PROSPECTO B2B ===== */}
                <div className="col-md-3">
                  <label className="form-label small fw-bold">CUIT / RUT / RFC (Id. Fiscal)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Ej. 20-12345678-9"
                    value={cuit_rut_rfc}
                    onChange={(e) => setCuitRutRfc(e.target.value)}
                    disabled={isLector}
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label small fw-bold">Industria / Vertical</label>
                  <select
                    className="form-select form-select-sm"
                    value={industria}
                    onChange={(e) => setIndustria(e.target.value)}
                    disabled={isLector}
                  >
                    <option value="">Selecciona vertical agropecuaria...</option>
                    <option value="productor">🌾 Productor Agropecuario / Campo</option>
                    <option value="agronomia">🏪 Distribuidor / Agronomía</option>
                    <option value="cooperativa">🏢 Acopio & Cooperativa Agrícola</option>
                    <option value="semillero">🌱 Semillero & Genética Vegetal</option>
                    <option value="servicios_agro">🚜 Servicios Agronómicos & Contratista</option>
                    <option value="laboratorio">🧪 Industria / Laboratorio Fitosanitario</option>
                    <option value="otro">🏢 Otro Rubro Agroindustrial</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label small fw-bold">Sitio Web Empresa</label>
                  <input
                    type="url"
                    className="form-control form-control-sm"
                    placeholder="https://empresa.com"
                    value={sitioWeb}
                    onChange={(e) => setSitioWeb(e.target.value)}
                    disabled={isLector}
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label small fw-bold">Superficie Estimada (Has)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Ej. 1500 (Has)"
                    value={volumenMensualProyectado}
                    onChange={(e) => setVolumenMensualProyectado(e.target.value)}
                    disabled={isLector}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-bold">Cultivo Principal de Interés</label>
                  <select
                    className="form-select form-select-sm"
                    value={stackTecnologicoActual}
                    onChange={(e) => setStackTecnologicoActual(e.target.value)}
                    disabled={isLector}
                  >
                    <option value="">Selecciona cultivo...</option>
                    <option value="soja">🌱 Soja</option>
                    <option value="maiz">🌽 Maíz</option>
                    <option value="trigo">🌾 Trigo</option>
                    <option value="girasol">🌻 Girasol</option>
                    <option value="cebada">🌾 Cebada</option>
                    <option value="arroz">🍚 Arroz</option>
                    <option value="frutales">🍎 Frutales & Hortalizas</option>
                    <option value="barbecho">🧪 Barbecho Químico / Varios</option>
                    <option value="otro">🌾 Otro Cultivo</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-bold">Estatus de Contacto (Sub-Estado)</label>
                  <select
                    className="form-select form-select-sm"
                    value={subEstadoContacto}
                    onChange={(e) => setSubEstadoContacto(e.target.value)}
                    disabled={isLector}
                  >
                    <option value="">Sin Estatus</option>
                    <option value="intento_1">📞 Intento 1 de Contacto</option>
                    <option value="intento_2">📞 Intento 2 de Contacto</option>
                    <option value="sin_respuesta">🚫 Sin Respuesta / No Contesta</option>
                    <option value="reunion_agendada">📅 Reunión Demo Agendada</option>
                  </select>
                </div>

                {(estado === 'perdido' || estado === 'descalificado') && (
                  <div className="col-md-4">
                    <label className="form-label small fw-bold text-danger">Motivo de Descalificación *</label>
                    <select
                      className="form-select form-select-sm border-danger"
                      value={motivoDescalificacion}
                      onChange={(e) => setMotivoDescalificacion(e.target.value)}
                      disabled={isLector}
                      required
                    >
                      <option value="">Selecciona motivo...</option>
                      <option value="sin_presupuesto">💸 Sin Presupuesto / Tarifas</option>
                      <option value="sin_cobertura">🗺️ Sin Cobertura en Zonas</option>
                      <option value="competencia">🏢 Optó por Competidor</option>
                      <option value="datos_falsos">❌ Datos de Contacto Falsos</option>
                      <option value="volumen_bajo">📉 Volumen Insuficiente</option>
                      <option value="otro">❓ Otro Motivo</option>
                    </select>
                  </div>
                )}

                {/* BADGES ATRIBUCIÓN MARKETING INBOUND (UTMs) */}
                {(leadData.utmSource || leadData.utmMedium || leadData.utmCampaign) && (
                  <div className="col-12">
                    <div className="p-2 rounded bg-light border d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.75rem' }}>
                      <span className="fw-bold text-primary"><i className="bi bi-funnel-fill me-1"></i> Atribución Inbound:</span>
                      {leadData.utmSource && <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">Source: {leadData.utmSource}</span>}
                      {leadData.utmMedium && <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25">Medium: {leadData.utmMedium}</span>}
                      {leadData.utmCampaign && <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">Campaign: {leadData.utmCampaign}</span>}
                    </div>
                  </div>
                )}

                <div className="col-md-9">
                  <label className="form-label small">Notas internas</label>
                  <textarea className="form-control form-control-sm" rows="2" value={notas} onChange={e => setNotas(e.target.value)} disabled={isLector}></textarea>
                </div>
                <div className="col-md-3 d-flex align-items-end gap-2 pb-1">
                  <button 
                    className="btn btn-warning btn-sm w-100 fw-bold rounded-pill shadow-sm" 
                    onClick={() => saveLeadData(true)} 
                    disabled={saving || isAnalyzing || isLector || iaPausada || leadScorerDisabled}
                  >
                    {isAnalyzing ? (
                      <span className="d-flex align-items-center justify-content-center gap-1">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '0.75rem', height: '0.75rem' }}></span>
                        <span>Analizando...</span>
                      </span>
                    ) : (
                      '✨ Calificar IA'
                    )}
                  </button>
                </div>
                
                {leadData.calificacionIA && (
                  <div className="col-12 mt-3">
                    <div className="p-3 rounded-3" style={{ 
                      background: leadData.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.04)' : leadData.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.04)' : 'rgba(220, 53, 69, 0.04)',
                      border: '1px solid', borderColor: leadData.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.15)' : leadData.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(220, 53, 69, 0.15)'
                    }}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small fw-bold text-dark d-flex align-items-center gap-1"><i className="bi bi-cpu text-primary"></i> Calificación LUXIA IA</span>
                        <span className="badge rounded-pill px-2.5 py-0.5 text-uppercase fw-bold" style={{ backgroundColor: leadData.calificacionIA.prioridad === 'Green' ? '#198754' : leadData.calificacionIA.prioridad === 'Yellow' ? '#ffc107' : '#dc3545', color: leadData.calificacionIA.prioridad === 'Yellow' ? '#212529' : '#fff' }}>
                          {leadData.calificacionIA.prioridad === 'Green' ? 'Prioridad Alta' : leadData.calificacionIA.prioridad === 'Yellow' ? 'Prioridad Media' : 'Prioridad Baja'}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-2">
                        <div className="progress flex-grow-1" style={{ height: '6px' }}>
                          <div className={`progress-bar ${leadData.calificacionIA.prioridad === 'Green' ? 'bg-success' : leadData.calificacionIA.prioridad === 'Yellow' ? 'bg-warning' : 'bg-danger'}`} role="progressbar" style={{ width: `${leadData.calificacionIA.score}%` }}></div>
                        </div>
                        <span className="small fw-bold font-monospace" style={{ fontSize: '0.8rem' }}>{leadData.calificacionIA.score}/100</span>
                      </div>
                      <p className="small text-muted mb-0 mt-2">{leadData.calificacionIA.explicacion}</p>
                    </div>
                  </div>
                )}

                {(() => {
                  const camposLead = camposConfig.filter(c => c.entidad === 'lead').sort((a,b) => a.orden - b.orden);
                  if (camposLead.length === 0) return null;
                  return (
                    <div className="col-12 mt-3 pt-3 border-top">
                      <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-tags-fill text-primary me-2"></i> Campos Dinámicos</h6>
                      <div className="row g-3">
                        {camposLead.map(campo => (
                          <DynamicFieldInput 
                            key={campo.id} campo={campo} value={camposDinamicos[campo.key]}
                            onChange={(val) => setCamposDinamicos(prev => ({ ...prev, [campo.key]: val }))}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Meta info of creation and update */}
                <div className="col-12 mt-3 pt-2 border-top d-flex justify-content-between text-muted" style={{ fontSize: '0.75rem' }}>
                  <span><i className="bi bi-calendar-plus me-1"></i>Creado: {formatDateTime(leadData.createdAt)}</span>
                  <span><i className="bi bi-calendar-check me-1"></i>Última Act.: {formatDateTime(leadData.updatedAt || leadData.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className={activeTab === 'contactos' ? 'd-block' : 'd-none'}>
              <ContactListWidget leadId={leadData.id} />
            </div>
            <div className={activeTab === 'bitacora' ? 'd-block' : 'd-none'}>
              <ClienteTimeline leadId={leadData.id} iaPausada={iaPausada} />
            </div>
            <div className={activeTab === 'whatsapp' ? 'd-block' : 'd-none'}>
              <WhatsappChatConsole leadId={leadData.id} initialPhone={selectedChatContactPhone} />
            </div>
          </div>
          
          <div className="modal-footer border-top-0 d-flex justify-content-between" style={{ borderBottomLeftRadius: 'var(--radius-card)', borderBottomRightRadius: 'var(--radius-card)' }}>
            <div>
              {hasPermission('actions', 'eliminar_lead') && activeTab === 'general' && (
                <button type="button" className="btn btn-outline-danger btn-sm rounded-pill px-3 shadow-sm border-0 bg-danger bg-opacity-10 text-danger fw-bold" onClick={() => { setShowDeleteConfirm(true); setMotivoEliminar(''); }} disabled={saving || isAnalyzing || deleting}>
                  <i className="bi bi-trash-fill me-1"></i> Eliminar Lead
                </button>
              )}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={onClose} disabled={saving || deleting}>Cerrar</button>
              {activeTab === 'general' && (
                <button className="btn btn-sm btn-primary rounded-pill px-4 shadow-sm" onClick={() => saveLeadData(false)} disabled={saving || isAnalyzing || deleting || isLector}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(10px)', zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '450px' }}>
            <div className="modal-content glass-panel border border-white border-opacity-10 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill text-danger me-2 fs-4"></i> Eliminar Lead
                </h5>
                <button type="button" className="btn-close" onClick={() => !deleting && setShowDeleteConfirm(false)} disabled={deleting}></button>
              </div>
              <div className="modal-body px-4 py-3">
                <p className="small text-muted mb-3" style={{ lineHeight: '1.5' }}>Estás a punto de borrar al prospecto <strong className="text-dark">{leadData.nombreEmpresa}</strong>. Esta es una acción irreversible.</p>
                <div className="mt-3">
                  <label className="form-label text-dark small fw-bold mb-1">Motivo de eliminación <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control rounded-3 small"
                    rows="3"
                    placeholder="Describe brevemente el motivo del borrado (mínimo 10 caracteres)..."
                    value={motivoEliminar}
                    onChange={e => setMotivoEliminar(e.target.value)}
                    disabled={deleting}
                    style={{ fontSize: '0.8rem' }}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-2 d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold flex-grow-1" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancelar</button>
                <button type="button" className="btn btn-sm btn-danger rounded-pill px-3 fw-bold flex-grow-1 shadow-sm" onClick={handleDeleteLead} disabled={deleting || motivoEliminar.trim().length < 10}>{deleting ? 'Borrando...' : 'Confirmar Borrado'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
