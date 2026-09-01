import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { DynamicFieldInput } from './DynamicFieldInput';
import { ClienteTimeline } from './ClienteTimeline';
import { useUserRole } from '../../contexts/UserRoleContext';
import { ContactListWidget } from './ContactListWidget';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { WhatsappChatConsole } from './WhatsappChatConsole';
import { formatDateTime } from '../../utils/dateUtils';

export function OportunidadGestionModal({ show, onClose, oportunidadData, onSaved, iaPausada, leadScorerDisabled }) {
  const { isAdmin, isSuperAdmin, isLector: isLectorRole, hasPermission, user } = useUserRole();
  const isLector = isLectorRole || !hasPermission('actions', 'editar_oportunidad');
  const [activeTab, setActiveTab] = useState('general');
  const [etapa, setEtapa] = useState(oportunidadData?.etapa || 'diagnostico');
  const [nombre, setNombre] = useState(oportunidadData?.nombre || '');
  const [montoEstimadoMensual, setMontoEstimadoMensual] = useState(oportunidadData?.montoEstimadoMensual || 0);
  const [pais, setPais] = useState(oportunidadData?.pais || '');
  const [camposConfig, setCamposConfig] = useState([]);
  const [camposDinamicos, setCamposDinamicos] = useState(oportunidadData?.camposDinamicos || {});
  
  const [comercialEmail, setComercialEmail] = useState(oportunidadData?.comercialEmail || '');
  const [usuariosComerciales, setUsuariosComerciales] = useState([]);
  const [tipoPipeline, setTipoPipeline] = useState(oportunidadData?.tipoPipeline || 'adquisicion');
  const [tipoServicio, setTipoServicio] = useState(oportunidadData?.tipoServicio || 'default');
  const [serviciosCatalog, setServiciosCatalog] = useState([]);
  const [competidorGanador, setCompetidorGanador] = useState(oportunidadData?.competidorGanador || '');
  const [contactoPrincipalId, setContactoPrincipalId] = useState(oportunidadData?.contactoPrincipalId || '');
  const [descuentoOfrecidoPct, setDescuentoOfrecidoPct] = useState(oportunidadData?.descuentoOfrecidoPct || 0);
  const [contactosCliente, setContactosCliente] = useState([]);

  const [originalEtapa, setOriginalEtapa] = useState(oportunidadData?.etapa || 'diagnostico');
  const [originalNombre, setOriginalNombre] = useState(oportunidadData?.nombre || '');
  const [originalComercialEmail, setOriginalComercialEmail] = useState(oportunidadData?.comercialEmail || '');
  
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
    if (!show || !oportunidadData?.id) return;

    setActiveTab('general');
    setSaving(false);
    setDeleting(false);
    setShowDeleteConfirm(false);
    setMotivoEliminar('');

    const initEtapa = oportunidadData.etapa || 'diagnostico';
    const initNombre = oportunidadData.nombre || '';
    const initPais = oportunidadData.pais || 'AR';
    const initComercialEmail = oportunidadData.comercialEmail || '';
    const initPipeline = oportunidadData.tipoPipeline || 'adquisicion';

    setEtapa(initEtapa);
    setOriginalEtapa(initEtapa);
    setNombre(initNombre);
    setOriginalNombre(initNombre);
    setPais(initPais);
    setComercialEmail(initComercialEmail);
    setOriginalComercialEmail(initComercialEmail);
    setTipoPipeline(initPipeline);
    setCompetidorGanador(oportunidadData.competidorGanador || '');
    setContactoPrincipalId(oportunidadData.contactoPrincipalId || '');
    setDescuentoOfrecidoPct(oportunidadData.descuentoOfrecidoPct || 0);
    setCamposDinamicos(oportunidadData.camposDinamicos || {});
    setMontoEstimadoMensual(oportunidadData.montoEstimadoMensual || 0);

    const loadMeta = async () => {
      try {
        const [camposRes, userRes, opRes, contactsRes, servRes] = await Promise.all([
          supabase.from('config_campos').select('*').order('orden'),
          supabase.from('usuarios').select('*'),
          supabase.from('oportunidades').select('*').eq('id', oportunidadData.id).maybeSingle(),
          oportunidadData.clienteId ? supabase.from('contactos').select('*').eq('cliente_id', oportunidadData.clienteId) : Promise.resolve({ data: [] }),
          supabase.from('config_servicios').select('*').order('nombre')
        ]);

        if (camposRes.data) setCamposConfig(camposRes.data);
        if (contactsRes.data) setContactosCliente(contactsRes.data);
        if (servRes.data) setServiciosCatalog(servRes.data);
        if (userRes.data) {
          const temp = {};
          userRes.data.forEach(u => {
            const email = (u.email || u.id || '').toLowerCase().trim();
            if (!email || !email.includes('@')) return;
            temp[email] = { email, nombre: u.nombre || email, equipo: u.equipo || '' };
          });
          setUsuariosComerciales(Object.values(temp));
        }

        if (opRes.data) {
          const d = opRes.data;
          setEtapa(d.etapa || 'diagnostico');
          setOriginalEtapa(d.etapa || 'diagnostico');
          setNombre(d.nombre || '');
          setOriginalNombre(d.nombre || '');
          setPais(d.pais || 'AR');
          setComercialEmail(d.comercial_email || '');
          setOriginalComercialEmail(d.comercial_email || '');
          setTipoPipeline(d.tipo_pipeline || 'adquisicion');
          setTipoServicio(d.tipo_servicio || 'default');
          setCompetidorGanador(d.competidor_ganador || '');
          setContactoPrincipalId(d.contacto_principal_id || '');
          setDescuentoOfrecidoPct(d.descuento_ofrecido_pct || 0);
          setCamposDinamicos(d.campos_dinamicos || {});
          setMontoEstimadoMensual(d.monto_estimado_mensual || 0);
          setIsAnalyzing(d._trigger_ia === true);
        }
      } catch (err) {
        console.warn("Error cargando oportunidad en modal:", err);
      }
    };

    loadMeta();
  }, [oportunidadData?.id, show]);

  if (!show || !oportunidadData) return null;

  const saveOportunidadData = async (triggerIA = false) => {
    if (etapa === 'perdido' && !competidorGanador) {
      showAlert('Debes indicar la empresa competidora que ganó el acuerdo comercial.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const valorAnual = Number(montoEstimadoMensual) * 12;

      const payload = { 
        etapa, 
        nombre, 
        pais, 
        comercial_email: comercialEmail, 
        tipo_servicio: tipoServicio,
        campos_dinamicos: camposDinamicos,
        monto_estimado_mensual: Number(montoEstimadoMensual),
        valor_contrato_anual: valorAnual,
        competidor_ganador: etapa === 'perdido' ? competidorGanador : null,
        contacto_principal_id: contactoPrincipalId || null,
        descuento_ofrecido_pct: Number(descuentoOfrecidoPct) || 0,
        updated_at: new Date().toISOString()
      };

      if (etapa !== originalEtapa) {
        payload.fecha_ultimo_cambio_etapa = new Date().toISOString();
      }

      if (triggerIA) payload._trigger_ia = true;

      const { error: updateError } = await supabase
        .from('oportunidades')
        .update(payload)
        .eq('id', oportunidadData.id);

      if (updateError) throw updateError;

      if (etapa !== originalEtapa) {
        await supabase.from('interacciones').insert({
          oportunidad_id: oportunidadData.id,
          tipo: 'cambio_etapa',
          descripcion: `Cambio de etapa en oportunidad: de "${originalEtapa}" a "${etapa}"`,
          autor: user?.email || 'admin@luxia.com'
        });
      }

      if (triggerIA) {
        showAlert('Auditoría IA solicitada.', 'success');
        onSaved();
      } else {
        showAlert('Oportunidad actualizada correctamente', 'success');
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error(err);
      showAlert(`Error al guardar oportunidad: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOportunidad = async () => {
    if (motivoEliminar.trim().length < 10) {
      showAlert('Por favor ingresa un motivo válido (mínimo 10 caracteres).', 'warning');
      return;
    }
    setDeleting(true);
    try {
      await supabase.from('interacciones').delete().eq('oportunidad_id', oportunidadData.id);
      const { error: deleteError } = await supabase.from('oportunidades').delete().eq('id', oportunidadData.id);
      if (deleteError) throw deleteError;

      showAlert(`Oportunidad ${oportunidadData.nombre} eliminada permanentemente.`, 'success');
      setShowDeleteConfirm(false);
      setMotivoEliminar('');
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      showAlert(`Error al eliminar oportunidad: ${err.message}`, 'danger');
    } finally {
      setDeleting(false);
    }
  };


  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-fullscreen-md-down">
        <div className="modal-content glass-panel" style={{ position: 'relative' }}>
          {saving && <SpinnerPremium overlay={true} text="Guardando cambios..." />}
          <div className="modal-header border-bottom-0 pb-0">
            <h5 className="modal-title">Oportunidad: {nombre}</h5>
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
                <div className="col-md-12">
                  <label className="form-label small fw-bold">Nombre de la Oportunidad</label>
                  <input type="text" className="form-control form-control-sm" value={nombre} onChange={e => setNombre(e.target.value)} disabled={isLector} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">Etapa</label>
                  <select className="form-select form-select-sm" value={etapa} onChange={e => setEtapa(e.target.value)} disabled={isLector}>
                    {tipoPipeline === 'adquisicion' && (
                      <>
                        <option value="diagnostico">1. Diagnóstico / Descubrimiento</option>
                        <option value="presentacion">2. Presentación de Valor</option>
                        <option value="propuesta">3. Propuesta / Negociación</option>
                        <option value="cierre">4. Cierre Ganado</option>
                        <option value="perdido">5. Cierre Perdido</option>
                      </>
                    )}
                    {tipoPipeline !== 'adquisicion' && (
                      <>
                        <option value="analisis">1. Análisis Inicial</option>
                        <option value="propuesta">2. Propuesta Entregada</option>
                        <option value="cierre">3. Cierre Ganado</option>
                        <option value="perdido">4. Perdido</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">Monto Mensual (USD)</label>
                  <input type="number" className="form-control form-control-sm" value={montoEstimadoMensual} onChange={e => setMontoEstimadoMensual(e.target.value)} disabled={isLector} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">Valor Anual Proyectado (ACV)</label>
                  <input type="text" className="form-control form-control-sm bg-light fw-bold text-success" value={`$${(Number(montoEstimadoMensual) * 12).toLocaleString()}`} disabled readOnly />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">País</label>
                  <select className="form-select form-select-sm" value={pais} onChange={e => setPais(e.target.value)} disabled={isLector}>
                    <option value="AR">🇦🇷 Argentina (AR)</option>
                    <option value="CL">🇨🇱 Chile (CL)</option>
                    <option value="CO">🇨🇴 Colombia (CO)</option>
                    <option value="PE">🇵🇪 Perú (PE)</option>
                    <option value="MX">🇲🇽 México (MX)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">
                    <i className="bi bi-box-seam me-1 text-primary"></i>Línea de Producto
                  </label>
                  <select 
                    className="form-select form-select-sm" 
                    value={tipoServicio} 
                    onChange={e => setTipoServicio(e.target.value)} 
                    disabled={isLector}
                  >
                    <option value="default">-- Sin Asignar --</option>
                    {serviciosCatalog.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre || s.id}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">Contacto Principal ("Champion")</label>
                  <select className="form-select form-select-sm" value={contactoPrincipalId} onChange={e => setContactoPrincipalId(e.target.value)} disabled={isLector}>
                    <option value="">-- Seleccionar Contacto Clave --</option>
                    {contactosCliente.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.cargo || c.puesto || 'Contacto'}) {c.rolDecision ? `- ${c.rolDecision}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {etapa === 'perdido' && (
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-danger">Competidor Ganador *</label>
                    <select className="form-select form-select-sm border-danger" value={competidorGanador} onChange={e => setCompetidorGanador(e.target.value)} required disabled={isLector}>
                      <option value="">-- Seleccionar Fabricante / Competidor --</option>
                      <option value="syngenta">Syngenta</option>
                      <option value="bayer">Bayer Crop Science</option>
                      <option value="corteva">Corteva Agriscience</option>
                      <option value="basf">BASF Agro</option>
                      <option value="upl">UPL OpenAg</option>
                      <option value="fmc">FMC Agricultural Solutions</option>
                      <option value="adama">Adama</option>
                      <option value="summit_rainbow">Summit Agro / Rainbow</option>
                      <option value="generico_otro">Genéricos / Otro Fabricante</option>
                    </select>
                  </div>
                )}
                <div className="col-md-6">
                  <label className="form-label small fw-bold">Comercial Asignado</label>
                  <select className="form-select form-select-sm" value={comercialEmail} onChange={e => setComercialEmail(e.target.value)} disabled={isLector || !hasPermission('actions', 'asignar_responsable_comercial')}>
                    <option value="">Sin Asignar</option>
                    {usuariosComerciales.map(u => (
                      <option key={u.email} value={u.email}>{u.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6 d-flex align-items-end gap-2 pb-1">
                  <button 
                    className="btn btn-warning btn-sm w-100 fw-bold rounded-pill shadow-sm" 
                    onClick={() => saveOportunidadData(true)} 
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
                
                {oportunidadData.calificacionIA && (
                  <div className="col-12 mt-3">
                    <div className="p-3 rounded-3" style={{ 
                      background: oportunidadData.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.04)' : oportunidadData.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.04)' : 'rgba(220, 53, 69, 0.04)',
                      border: '1px solid', borderColor: oportunidadData.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.15)' : oportunidadData.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(220, 53, 69, 0.15)'
                    }}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small fw-bold text-dark d-flex align-items-center gap-1"><i className="bi bi-cpu text-primary"></i> Calificación LUXIA IA</span>
                        <span className="badge rounded-pill px-2.5 py-0.5 text-uppercase fw-bold" style={{ backgroundColor: oportunidadData.calificacionIA.prioridad === 'Green' ? '#198754' : oportunidadData.calificacionIA.prioridad === 'Yellow' ? '#ffc107' : '#dc3545', color: oportunidadData.calificacionIA.prioridad === 'Yellow' ? '#212529' : '#fff' }}>
                          {oportunidadData.calificacionIA.prioridad === 'Green' ? 'Prioridad Alta' : oportunidadData.calificacionIA.prioridad === 'Yellow' ? 'Prioridad Media' : 'Prioridad Baja'}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-2">
                        <div className="progress flex-grow-1" style={{ height: '6px' }}>
                          <div className={`progress-bar ${oportunidadData.calificacionIA.prioridad === 'Green' ? 'bg-success' : oportunidadData.calificacionIA.prioridad === 'Yellow' ? 'bg-warning' : 'bg-danger'}`} role="progressbar" style={{ width: `${oportunidadData.calificacionIA.score}%` }}></div>
                        </div>
                        <span className="small fw-bold font-monospace" style={{ fontSize: '0.8rem' }}>{oportunidadData.calificacionIA.score}/100</span>
                      </div>
                      <p className="small text-muted mb-0 mt-2">{oportunidadData.calificacionIA.explicacion}</p>
                    </div>
                  </div>
                )}

                {(() => {
                  const camposOportunidad = camposConfig.filter(c => c.entidad === 'oportunidad').sort((a,b) => a.orden - b.orden);
                  if (camposOportunidad.length === 0) return null;
                  return (
                    <div className="col-12 mt-3 pt-3 border-top">
                      <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-tags-fill text-primary me-2"></i> Campos Dinámicos</h6>
                      <div className="row g-3">
                        {camposOportunidad.map(campo => (
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
                  <span><i className="bi bi-calendar-plus me-1"></i>Creado: {formatDateTime(oportunidadData.createdAt)}</span>
                  <span><i className="bi bi-calendar-check me-1"></i>Última Act.: {formatDateTime(oportunidadData.updatedAt || oportunidadData.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className={activeTab === 'contactos' ? 'd-block' : 'd-none'}>
              <ContactListWidget oportunidadId={oportunidadData.id} clienteId={oportunidadData.clienteId} />
            </div>
            <div className={activeTab === 'bitacora' ? 'd-block' : 'd-none'}>
              <ClienteTimeline oportunidadId={oportunidadData.id} iaPausada={iaPausada} />
            </div>
            <div className={activeTab === 'whatsapp' ? 'd-block' : 'd-none'}>
              <WhatsappChatConsole clienteId={oportunidadData.clienteId} initialPhone={selectedChatContactPhone} />
            </div>
          </div>
          
          <div className="modal-footer border-top-0 d-flex justify-content-between" style={{ borderBottomLeftRadius: 'var(--radius-card)', borderBottomRightRadius: 'var(--radius-card)' }}>
            <div>
              {hasPermission('actions', 'eliminar_oportunidad') && activeTab === 'general' && (
                <button type="button" className="btn btn-outline-danger btn-sm rounded-pill px-3 shadow-sm border-0 bg-danger bg-opacity-10 text-danger fw-bold" onClick={() => { setShowDeleteConfirm(true); setMotivoEliminar(''); }} disabled={saving || isAnalyzing || deleting}>
                  <i className="bi bi-trash-fill me-1"></i> Eliminar
                </button>
              )}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={onClose} disabled={saving || deleting}>Cerrar</button>
              {activeTab === 'general' && (
                <button className="btn btn-sm btn-primary rounded-pill px-4 shadow-sm" onClick={() => saveOportunidadData(false)} disabled={saving || isAnalyzing || deleting || isLector}>
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
                  <i className="bi bi-exclamation-triangle-fill text-danger me-2 fs-4"></i> Eliminar Oportunidad
                </h5>
                <button type="button" className="btn-close" onClick={() => !deleting && setShowDeleteConfirm(false)} disabled={deleting}></button>
              </div>
              <div className="modal-body px-4 py-3">
                <p className="small text-muted mb-3" style={{ lineHeight: '1.5' }}>Estás a punto de borrar la oportunidad <strong className="text-dark">{nombre}</strong>. Esta es una acción irreversible.</p>
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
                <button type="button" className="btn btn-sm btn-danger rounded-pill px-3 fw-bold flex-grow-1 shadow-sm" onClick={handleDeleteOportunidad} disabled={deleting || motivoEliminar.trim().length < 10}>{deleting ? 'Borrando...' : 'Confirmar Borrado'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
