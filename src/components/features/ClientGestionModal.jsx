import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import { DynamicFieldInput } from './DynamicFieldInput';
import { ContratosList } from './ContratosList';
import { OnboardingChecklist } from './OnboardingChecklist';
import { HealthScoreTimeline } from './HealthScoreTimeline';
import { ClienteTimeline } from './ClienteTimeline';
import { CopilotoDrawer } from './CopilotoDrawer';
import { useUserRole } from '../../contexts/UserRoleContext';
import { ContactListWidget } from './ContactListWidget';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { WhatsappChatConsole } from './WhatsappChatConsole';
import { formatDateTime } from '../../utils/dateUtils';

export function ClientGestionModal({ show, onClose, clientData, onSaved, iaPausada }) {
  const { isAdmin, isSuperAdmin, isLector: isLectorRole, hasPermission, user } = useUserRole();
  const isLector = isLectorRole || !hasPermission('actions', 'editar_cliente');
  const [activeTab, setActiveTab] = useState('general');
  const [estado, setEstado] = useState(clientData?.estado || 'Activo');
  const [observaciones, setObservaciones] = useState(clientData?.observaciones || '');
  const [pais, setPais] = useState(clientData?.pais || '');
  const [originalPais, setOriginalPais] = useState(clientData?.pais || '');
  const [camposConfig, setCamposConfig] = useState([]);
  const [seccionesConfig, setSeccionesConfig] = useState([]);
  const [camposDinamicos, setCamposDinamicos] = useState(clientData?.campos_dinamicos || {});
  
  const [comercialEmail, setComercialEmail] = useState(clientData?.comercial_email || '');
  const [originalComercialEmail, setOriginalComercialEmail] = useState(clientData?.comercial_email || '');
  const [comercialNombre, setComercialNombre] = useState(clientData?.comercial_nombre || 'Sin Asignar');
  const [usuariosComerciales, setUsuariosComerciales] = useState([]);

  const [cuit_rut_rfc, setCuitRutRfc] = useState(clientData?.cuit_rut_rfc || '');
  const [industria, setIndustria] = useState(clientData?.industria || '');
  const [sitioWeb, setSitioWeb] = useState(clientData?.sitio_web || '');
  const [tamanioEmpresa, setTamanioEmpresa] = useState(clientData?.tamanio_empresa || '');
  const [tierOverride, setTierOverride] = useState(clientData?.tier_override === true);
  const [parentCompanyId, setParentCompanyId] = useState(clientData?.parent_company_id || '');
  const [tierCuenta, setTierCuenta] = useState(clientData?.tier_cuenta || 'Tier 3');

  const [originalEstado, setOriginalEstado] = useState(clientData?.estado || 'Activo');
  const [originalObservaciones, setOriginalObservaciones] = useState(clientData?.observaciones || '');
  const [faseManual, setFaseManual] = useState(clientData?.fase_manual || '');
  const [originalFaseManual, setOriginalFaseManual] = useState(clientData?.fase_manual || '');
  
  const [saving, setSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCopiloto, setShowCopiloto] = useState(false);
  const [budgetDisabled, setBudgetDisabled] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [selectedChatContactPhone, setSelectedChatContactPhone] = useState('');
  const { showAlert } = useToast();

  useEffect(() => {
    const handleNav = (e) => {
      setActiveTab('whatsapp');
      setSelectedChatContactPhone(e.detail.telefono || '');
    };
    window.addEventListener('navigateToWhatsAppChat', handleNav);
    return () => window.removeEventListener('navigateToWhatsAppChat', handleNav);
  }, []);

  useEffect(() => {
    if (!show) return;
    const fetchBudget = async () => {
      try {
        const data = await getConfigGeneral('config_ia_usage');
        if (data) {
          setBudgetDisabled((data.disabledByBudget === true && data.autoshutoffActive === true) || data.manualPause === true);
        }
      } catch (err) {
        console.warn("Error fetching budget config:", err);
      }
    };
    fetchBudget();
  }, [show]);

  useEffect(() => {
    if (!show || !clientData?.id) return;

    setActiveTab('general');
    setSaving(false);
    setDeleting(false);
    setShowDeleteConfirm(false);
    setShowCopiloto(false);

    const loadMeta = async () => {
      try {
        const [camposRes, seccionesRes, usuariosRes, clientRes] = await Promise.all([
          supabase.from('config_campos').select('*').order('orden'),
          supabase.from('config_secciones').select('*').order('orden'),
          supabase.from('usuarios').select('*'),
          supabase.from('clientes').select('*').eq('id', clientData.id).maybeSingle()
        ]);

        if (camposRes.data) setCamposConfig(camposRes.data);
        if (seccionesRes.data) setSeccionesConfig(seccionesRes.data);
        if (usuariosRes.data) {
          const temp = {};
          usuariosRes.data.forEach(u => {
            const email = (u.email || u.id || '').toLowerCase().trim();
            if (!email || !email.includes('@')) return;
            temp[email] = { email, nombre: u.nombre || email, rol: u.rol || 'usuario', equipo: u.equipo || '' };
          });
          setUsuariosComerciales(Object.values(temp));
        }

        if (clientRes.data) {
          const d = clientRes.data;
          setEstado(d.estado || 'Activo');
          setOriginalEstado(d.estado || 'Activo');
          setObservaciones(d.observaciones || '');
          setOriginalObservaciones(d.observaciones || '');
          setPais(d.pais || '');
          setOriginalPais(d.pais || '');
          setCamposDinamicos(d.campos_dinamicos || {});
          setComercialEmail(d.comercial_email || '');
          setOriginalComercialEmail(d.comercial_email || '');
          setFaseManual(d.fase_manual || '');
          setOriginalFaseManual(d.fase_manual || '');
          setCuitRutRfc(d.cuit_rut_rfc || '');
          setIndustria(d.industria || '');
          setSitioWeb(d.sitio_web || '');
          setTamanioEmpresa(d.tamanio_empresa || '');
          setTierOverride(d.tier_override === true);
          setParentCompanyId(d.parent_company_id || '');
          setTierCuenta(d.tier_cuenta || 'Tier 3');
        }
      } catch (err) {
        console.error("Error cargando metadatos de cliente:", err);
      }
    };

    loadMeta();
  }, [clientData?.id, show]);

  if (!show || !clientData) return null;

  const saveClientData = async (triggerIA = false) => {
    setSaving(true);
    try {
      const payload = {
        estado,
        observaciones,
        pais,
        cuit_rut_rfc: cuit_rut_rfc.trim() || null,
        industria: industria || null,
        sitio_web: sitioWeb.trim() || null,
        tamanio_empresa: tamanioEmpresa || null,
        tier_override: !!tierOverride,
        parent_company_id: parentCompanyId.trim() || null,
        campos_dinamicos: camposDinamicos,
        comercial_email: comercialEmail,
        fase_manual: faseManual || null,
        ultimo_cambio_estado: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', clientData.id);

      if (updateError) throw updateError;

      if (estado !== originalEstado) {
        await supabase.from('interacciones').insert({
          cliente_id: clientData.id,
          tipo: 'cambio_estado',
          descripcion: `Cambio de estado manual: de "${originalEstado || 'Sin Estado'}" a "${estado}"`,
          autor: user?.email || 'admin@luxia.com'
        });
      }

      if (faseManual !== originalFaseManual) {
        await supabase.from('interacciones').insert({
          cliente_id: clientData.id,
          tipo: 'cambio_fase',
          descripcion: `Cambio de fase comercial manual: de "${originalFaseManual || 'Automático'}" a "${faseManual || 'Automático'}"`,
          autor: user?.email || 'admin@luxia.com'
        });
      }

      if (triggerIA) {
        showAlert('Análisis IA solicitado. Se han guardado tus cambios.', 'success');
        onSaved();
      } else {
        showAlert('Cliente actualizado correctamente', 'success');
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error(err);
      showAlert(`Error al actualizar cliente: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from('contratos').delete().eq('cliente_id', clientData.id),
        supabase.from('interacciones').delete().eq('cliente_id', clientData.id),
        supabase.from('alertas').delete().eq('cliente_id', clientData.id),
        supabase.from('contactos').delete().eq('cliente_id', clientData.id)
      ]);

      const { error: deleteError } = await supabase.from('clientes').delete().eq('id', clientData.id);
      if (deleteError) throw deleteError;

      showAlert(`Cliente ${clientData.nombreEmpresa} eliminado permanentemente.`, 'success');
      setShowDeleteConfirm(false);
      onSaved();
      onClose();
    } catch (err) {
      console.error("Error al borrar cliente en cascada:", err);
      showAlert(`Error al eliminar: ${err.message}`, 'danger');
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = () => saveClientData(false);
  const handleIA = () => saveClientData(true);

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-fullscreen-md-down">
        <div className="modal-content glass-panel" style={{ position: 'relative' }}>
          {saving && (
            <SpinnerPremium 
              overlay={true} 
              text="Guardando cambios del cliente..." 
            />
          )}
          <div className="modal-header border-bottom-0 pb-0">


            <h5 className="modal-title">Gestionar: {clientData.nombreEmpresa}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <div className="px-3 pt-2">
            {/* Tabs deslizables en móvil (Mobile-First: swipeable nav) */}
            <ul className="nav nav-tabs-mobile-scroll border-bottom-0">
              <li className="nav-item">
                <button className={`nav-link ${activeTab === 'general' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('general')}>General</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${activeTab === 'contactos' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('contactos')}>Contactos</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${activeTab === 'contratos' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('contratos')}>
                  <i className="bi bi-briefcase me-1"></i> Negocios y Contratos
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${activeTab === 'onboarding' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('onboarding')}>Onboarding</button>
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
                    <option value="Onboarding">Onboarding</option>
                    <option value="Activo">Activo</option>
                    <option value="En Riesgo">En Riesgo</option>
                    <option value="Churn">Churn</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">País de Operación</label>
                  <select className="form-select form-select-sm" value={pais} onChange={e => setPais(e.target.value)} disabled={isLector}>
                    <option value="">🌐 Regional (Sin Asignar)</option>
                    <option value="AR">🇦🇷 Argentina (AR)</option>
                    <option value="CL">🇨🇱 Chile (CL)</option>
                    <option value="CO">🇨🇴 Colombia (CO)</option>
                    <option value="PE">🇵🇪 Perú (PE)</option>
                    <option value="MX">🇲🇽 México (MX)</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">Fase Comercial</label>
                  <select 
                    className="form-select form-select-sm" 
                    value={faseManual} 
                    onChange={e => setFaseManual(e.target.value)}
                    disabled={isLector || !hasPermission('actions', 'forzar_fase_comercial')}
                    title={(!hasPermission('actions', 'forzar_fase_comercial')) ? "Solo administradores pueden forzar la fase comercial" : "Establece la fase comercial del cliente de forma manual o automática"}
                  >
                    <option value="">⚙️ Automático (Negocio)</option>
                    <option value="Adquisicion">🎯 Adquisición</option>
                    <option value="Retencion">🌳 Retención</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">Comercial Asignado</label>
                  <select 
                    className="form-select form-select-sm" 
                    value={comercialEmail} 
                    onChange={e => {
                      const email = e.target.value;
                      setComercialEmail(email);
                      const userObj = usuariosComerciales.find(u => u.email === email);
                      setComercialNombre(userObj ? userObj.nombre : 'Sin Asignar');
                      
                      // Auto-asignación de fase comercial basada en el equipo
                      if (userObj) {
                        if (userObj.equipo === 'Adquisicion') setFaseManual('Adquisicion');
                        else if (userObj.equipo === 'Retencion') setFaseManual('Retencion');
                        else setFaseManual(''); // Automático
                      } else {
                        setFaseManual(''); // Si elige "Sin Asignar", pasa a automático
                      }
                    }}
                    disabled={isLector || !hasPermission('actions', 'forzar_fase_comercial')}
                  >
                    <option value="">Sin Asignar</option>
                    {usuariosComerciales
                      .filter(u => {
                        const norm = (u.equipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                        return norm === 'adquisicion' || norm === 'retencion';
                      })
                      .map(u => (
                        <option key={u.email} value={u.email}>{u.nombre}</option>
                      ))}
                  </select>
                </div>

                {/* ===== SECCIÓN DE DATOS FIRMOGRÁFICOS Y TIER DE CUENTA ===== */}
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
                  <label className="form-label small fw-bold">Sitio Web</label>
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
                  <label className="form-label small fw-bold">Tamaño (Headcount)</label>
                  <select
                    className="form-select form-select-sm"
                    value={tamanioEmpresa}
                    onChange={(e) => setTamanioEmpresa(e.target.value)}
                    disabled={isLector}
                  >
                    <option value="">Selecciona tamaño...</option>
                    <option value="1-50">1-50 Empleados (Pequeña)</option>
                    <option value="51-200">51-200 Empleados (Mediana)</option>
                    <option value="201-500">201-500 Empleados (Grande)</option>
                    <option value="500+">500+ Empleados (Enterprise)</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Clasificación Tier de Cuenta</label>
                  <div className="d-flex align-items-center gap-2 mt-1">
                    <span className={`badge px-3 py-2 ${tierCuenta === 'Tier 1' ? 'bg-danger text-white' : (tierCuenta === 'Tier 2' ? 'bg-warning text-dark' : 'bg-secondary text-white')}`} style={{ fontSize: '0.82rem' }}>
                      <i className="bi bi-diagram-3-fill me-1"></i> {tierCuenta}
                    </span>
                    {tierOverride && (
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary" style={{ fontSize: '0.7rem' }}>
                        Forzado Manual
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Forzar Tier 1 (VIP Account)</label>
                  <div className="form-check form-switch mt-1">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="tierOverrideSwitch"
                      checked={tierOverride}
                      onChange={(e) => setTierOverride(e.target.checked)}
                      disabled={isLector}
                    />
                    <label className="form-check-label small text-muted" htmlFor="tierOverrideSwitch">
                      {tierOverride ? 'Tier 1 Forzado (Manual)' : 'Calculado por Contratos'}
                    </label>
                  </div>
                </div>

                <div className="col-md-9">
                  <label className="form-label small">Observaciones</label>
                  <textarea className="form-control form-control-sm" rows="2" value={observaciones} onChange={e => setObservaciones(e.target.value)} disabled={isLector}></textarea>
                </div>
                <div className="col-md-3 d-flex align-items-end gap-2 pb-1">
                  <button 
                    className="btn btn-warning btn-sm w-50 fw-bold rounded-pill shadow-sm" 
                    onClick={handleIA} 
                    disabled={saving || isAnalyzing || budgetDisabled || isLector}
                    title={isLector ? "Permiso denegado (Rol Lector)" : (budgetDisabled ? "Servicio de IA pausado temporalmente por presupuesto mensual" : "Analizar salud del cliente con LUXIA IA")}
                  >
                    {isAnalyzing ? (
                      <span className="d-flex align-items-center justify-content-center gap-1">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '0.75rem', height: '0.75rem' }}></span>
                        <span>Analizando...</span>
                      </span>
                    ) : (
                      '✨ Analizar'
                    )}

                  </button>
                  <button 
                    type="button"
                    className="btn btn-primary btn-sm w-50 fw-bold rounded-pill shadow-sm" 
                    onClick={() => setShowCopiloto(true)}
                    disabled={saving || isAnalyzing || !hasPermission('actions', 'configurar_copiloto')}
                    title={!hasPermission('actions', 'configurar_copiloto') ? "Permiso denegado (Falta configurar_copiloto)" : ""}
                  >
                    🎙️ Copiloto
                  </button>
                </div>
                {(() => {
                  const seccionesCliente = seccionesConfig.filter(s => s.entidad === 'cliente').sort((a,b) => a.orden - b.orden);
                  
                  // Agrupar campos por sección
                  const getEntidadDeCampo = (campo) => {
                    if (campo.seccionId) {
                      const sec = seccionesConfig.find(s => s.id === campo.seccionId);
                      if (sec) return sec.entidad;
                    }
                    return campo.entidad || 'cliente';
                  };

                  const camposAgrupados = {};
                  camposConfig.forEach(campo => {
                    const entidad = getEntidadDeCampo(campo);
                    if (entidad === 'cliente') {
                      const sId = campo.seccionId || 'huerfanos';
                      if (!camposAgrupados[sId]) camposAgrupados[sId] = [];
                      camposAgrupados[sId].push(campo);
                    }
                  });

                  if (seccionesCliente.length === 0 && (!camposAgrupados['huerfanos'] || camposAgrupados['huerfanos'].length === 0)) {
                    return null;
                  }

                  const renderCampo = (campo) => (
                    <DynamicFieldInput 
                      key={campo.id}
                      campo={campo}
                      value={camposDinamicos[campo.key]}
                      onChange={(val) => setCamposDinamicos(prev => ({ ...prev, [campo.key]: val }))}
                      clientId={clientData?.id}
                    />
                  );

                  return (
                    <div className="col-12 mt-3 pt-3 border-top">
                      {seccionesCliente.map(seccion => {
                        const camposSeccion = (camposAgrupados[seccion.id] || []).sort((a,b) => a.orden - b.orden);
                        if (camposSeccion.length === 0) return null;

                        return (
                          <div key={seccion.id} className="mb-4">
                            <h6 className="fw-bold mb-3 text-dark"><i className={`bi ${seccion.icono || 'bi-grid'} text-primary me-2`}></i> {seccion.nombre}</h6>
                            <div className="row g-3">
                              {camposSeccion.map(renderCampo)}
                            </div>
                          </div>
                        );
                      })}

                      {(camposAgrupados['huerfanos'] || []).length > 0 && (
                        <div className="mb-4">
                          <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-tags-fill text-primary me-2"></i> Información Adicional</h6>
                          <div className="row g-3">
                            {(camposAgrupados['huerfanos'] || []).sort((a,b) => a.orden - b.orden).map(renderCampo)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="col-12 mt-2 pt-2 border-top">
                  <HealthScoreTimeline clientData={clientData} />
                </div>
                
                {/* Meta info of creation and update */}
                <div className="col-12 mt-3 pt-2 border-top d-flex justify-content-between text-muted" style={{ fontSize: '0.75rem' }}>
                  <span><i className="bi bi-calendar-plus me-1"></i>Creado: {formatDateTime(clientData.createdAt || clientData.fechaIngreso)}</span>
                  <span><i className="bi bi-calendar-check me-1"></i>Última Act.: {formatDateTime(clientData.updatedAt || clientData.ultimoCambioEstado || clientData.createdAt || clientData.fechaIngreso)}</span>
                </div>
              </div>
            </div>

            <div className={activeTab === 'onboarding' ? 'd-block' : 'd-none'}>
              <OnboardingChecklist clienteId={clientData.id} />
            </div>

            <div className={activeTab === 'contratos' ? 'd-block' : 'd-none'}>
              <ContratosList clienteId={clientData.id} clientePais={pais} iaPausada={iaPausada} />
            </div>

            <div className={activeTab === 'bitacora' ? 'd-block' : 'd-none'}>
              <ClienteTimeline clienteId={clientData.id} iaPausada={iaPausada} />
            </div>

            <div className={activeTab === 'contactos' ? 'd-block' : 'd-none'}>
              <div className="contactos-manager mt-2 p-1">
                <ContactListWidget clienteId={clientData.id} />
              </div>
            </div>

            <div className={activeTab === 'whatsapp' ? 'd-block' : 'd-none'}>
              <WhatsappChatConsole clienteId={clientData.id} initialPhone={selectedChatContactPhone} />
            </div>
          </div>
          
          <div className="modal-footer border-top-0 d-flex justify-content-between" style={{ borderBottomLeftRadius: 'var(--radius-card)', borderBottomRightRadius: 'var(--radius-card)' }}>
            <div>
              {isSuperAdmin && activeTab === 'general' && (
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1" style={{ fontSize: '0.65rem' }}>SuperAdmin Only</span>
                  <button type="button" className="btn btn-outline-danger btn-sm rounded-pill px-3 shadow-sm border-0 bg-danger bg-opacity-10 text-danger fw-bold" onClick={() => setShowDeleteConfirm(true)} disabled={saving || isAnalyzing || deleting}>
                    <i className="bi bi-trash-fill me-1"></i> Eliminar Cliente
                  </button>
                </div>
              )}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={onClose} disabled={saving || deleting}>Cerrar</button>
              {activeTab === 'general' && (
                <button className="btn btn-sm btn-primary rounded-pill px-4 shadow-sm" onClick={handleSave} disabled={saving || isAnalyzing || deleting || isLector} title={isLector ? "Permiso denegado (Rol Lector)" : ""}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {showCopiloto && (
        <CopilotoDrawer 
          show={showCopiloto} 
          onClose={() => setShowCopiloto(false)} 
          client={clientData}
          onActionExecuted={() => {
            if (onSaved) onSaved();
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(10px)', zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '450px' }}>
            <div className="modal-content glass-panel border border-white border-opacity-10 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <i className="bi bi-exclamation-triangle-fill text-danger me-2 fs-4"></i> Eliminar Definitivamente
                </h5>
                <button type="button" className="btn-close" onClick={() => !deleting && setShowDeleteConfirm(false)} disabled={deleting}></button>
              </div>
              <div className="modal-body px-4 py-3">
                <p className="small text-muted mb-3" style={{ lineHeight: '1.5' }}>
                  Estás a punto de borrar al cliente <strong className="text-dark">{clientData.nombreEmpresa}</strong>. Esta es una acción irreversible.
                </p>
                <div className="bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 p-3 mb-2">
                  <p className="small text-danger fw-bold mb-1"><i className="bi bi-info-circle me-1"></i> Se eliminarán en cascada:</p>
                  <ul className="small text-danger mb-0" style={{ listStyleType: 'disc', paddingLeft: '1.5rem' }}>
                    <li>El cliente principal.</li>
                    <li>Todos sus contratos y archivos.</li>
                    <li>Su historial de interacciones y notas.</li>
                    <li>Registros de Onboarding y alertas.</li>
                    <li>Sus contactos asociados.</li>
                  </ul>
                </div>
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
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold flex-grow-1" 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-sm btn-danger rounded-pill px-3 fw-bold flex-grow-1 shadow-sm" 
                  onClick={handleDeleteClient}
                  disabled={deleting || motivoEliminar.trim().length < 10}
                >
                  {deleting ? 'Borrando...' : 'Confirmar Borrado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
