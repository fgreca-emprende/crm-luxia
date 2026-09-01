import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { DynamicFieldInput } from './DynamicFieldInput';
import { WhatsappChatConsole } from './WhatsappChatConsole';
import { ContactQuickActions } from './ContactQuickActions';
import { useLeadsPaginados } from '../../hooks/useLeadsPaginados';
import { ExportDrawer } from './ExportDrawer';
import { BulkImportModal } from './BulkImportModal';
import { useVirtualWindow } from '../../hooks/useVirtualWindow';
import { ContactListWidget } from './ContactListWidget';
import { LeadGestionModal } from './LeadGestionModal';

export function LeadsView({ selectedCountry }) {
  const { isSuperAdmin, isAdmin, isSupervisor, isLector, hasPermission, role, userTeam, getDataScope, user } = useUserRole();
  const canImportData = hasPermission('actions', 'alta_masiva_registros') || hasPermission('alta_masiva_registros');

  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);
  const leadsScope = getDataScope ? getDataScope('leads') : 'ALL';
  const isRestricted = leadsScope !== 'ALL';

  const { showAlert } = useToast();
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban', 'tabla' o 'estadisticas'
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  const [exchangeRates, setExchangeRates] = useState({ USD: 1, ARS: 1250, CLP: 940, PEN: 3.7, COP: 4100, MXN: 18 });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const conf = await getConfigGeneral('rates');
        if (conf && conf.rates) {
          setExchangeRates(conf.rates);
        }
      } catch (err) {
        console.warn("Error loading exchange rates in LeadsView:", err.message);
      }
    };
    fetchRates();
  }, []);
  
  const getOrigenLabel = (val) => {
    const mapping = {
      'web': 'Web / Formulario',
      'linkedin': 'LinkedIn',
      'cold_call': 'Llamada Fría',
      'referido': 'Referido'
    };
    return mapping[val] || val;
  };

  const getCountryCurrency = (country) => {
    switch (country) {
      case 'AR': return 'ARS';
      case 'CL': return 'CLP';
      case 'PE': return 'PEN';
      case 'CO': return 'COP';
      case 'MX': return 'MXN';
      default: return 'USD';
    }
  };

  const [saving, setSaving] = useState(false);
  const [analyzingLeadId, setAnalyzingLeadId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [campos, setCampos] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [iaPausada, setIaPausada] = useState(false);
  const [leadScorerDisabled, setLeadScorerDisabled] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterComercial, setFilterComercial] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [activeLeadTabs, setActiveLeadTabs] = useState({});
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappLead, setWhatsappLead] = useState(null);
  const [meetingDetailsLead, setMeetingDetailsLead] = useState(null);

  // Search & Pagination
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { leads, loading, hasMore, loadLeads, refresh, error } =
    useLeadsPaginados(25, selectedCountry, searchTerm);

  const scrollObserverRef = useRef(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const usage = await getConfigGeneral('config_ia_usage');
        if (usage) {
          const paused = (usage.disabledByBudget === true && usage.autoshutoffActive === true) || usage.manualPause === true;
          setIaPausada(paused);
        }
        const scorer = await getConfigGeneral('luxia_lead_scorer');
        if (scorer) {
          setLeadScorerDisabled(scorer.disabled === true);
        }
      } catch (err) {
        console.warn('[LeadsView] Error loading luxia_ia config:', err.message);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const el = scrollObserverRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && leads.length > 0) {
          loadLeads(true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, leads.length, loadLeads]);

  // Form States
  const [leadForm, setLeadForm] = useState({
    nombreContacto: '',
    correo: '',
    telefono: '',
    nombreEmpresa: '',
    pais: selectedCountry || 'AR',
    origen: 'web',
    estado: 'nuevo',
    asignadoA: hasPermission('asignar_lead_manual') ? (user?.email || '') : '',
    notas: '',
    cuit_rut_rfc: '',
    industria: '',
    sitioWeb: '',
    volumenMensualProyectado: '',
    stackTecnologicoActual: '',
    camposDinamicos: {},
    primeraReunion: {
      fecha: '',
      resumen: '',
      necesidadPrincipal: '',
      acuerdos: '',
      clasificacionInteres: 'Medio'
    }
  });

  const [convertForm, setConvertForm] = useState({
    montoEstimadoMensual: 5000,
    nombreOportunidad: '',
    etapa: 'diagnostico'
  });

  const resetForm = useCallback(() => {
    setLeadForm({
      nombreContacto: '',
      correo: '',
      telefono: '',
      nombreEmpresa: '',
      pais: selectedCountry || 'AR',
      origen: 'web',
      estado: 'nuevo',
      asignadoA: hasPermission('asignar_lead_manual') ? (user?.email || '') : '',
      notas: '',
      cuit_rut_rfc: '',
      industria: '',
      sitioWeb: '',
      volumenMensualProyectado: '',
      stackTecnologicoActual: '',
      camposDinamicos: {},
      primeraReunion: {
        fecha: '',
        resumen: '',
        necesidadPrincipal: '',
        acuerdos: '',
        clasificacionInteres: 'Medio'
      }
    });
  }, [selectedCountry, hasPermission, user]);

  // Load Users and Dynamic Fields Config
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [secRes, camposRes, userRes] = await Promise.all([
          supabase.from('config_secciones').select('*').eq('entidad', 'lead').order('orden'),
          supabase.from('config_campos').select('*').order('orden'),
          supabase.from('usuarios').select('*')
        ]);
        if (secRes.data) setSecciones(secRes.data);
        if (camposRes.data) setCampos(camposRes.data);
        if (userRes.data) {
          const temp = {};
          userRes.data.forEach(u => {
            const email = (u.email || u.id || '').toLowerCase().trim();
            if (!email || !email.includes('@')) return;
            temp[email] = {
              email: email,
              nombre: u.nombre || email,
              equipo: u.equipo || '',
              hasRealName: true
            };
          });
          setUsuarios(Object.values(temp));
        }
      } catch (err) {
        console.warn('[LeadsView] Error loading meta:', err.message);
      }
    };
    loadMeta();
  }, []);

  const leadFields = campos.filter(c => {
    if (c.seccionId) {
      const sec = secciones.find(s => s.id === c.seccionId);
      return !!sec;
    }
    return c.entidad === 'lead';
  });

  const handleTriggerLuxiaIa = async (lead) => {
    if (!hasPermission('disparar_ia')) return;
    setAnalyzingLeadId(lead.id);
    try {
      await supabase.from('leads').update({
        _trigger_ia: true,
        _triggered_by: user?.email || 'admin@luxia.com'
      }).eq('id', lead.id);

      showAlert('Análisis de LUXIA IA solicitado.', 'success');
      refresh();
    } catch (err) {
      console.error(err);
      showAlert('Error al solicitar análisis de LUXIA IA.', 'danger');
    } finally {
      setAnalyzingLeadId(null);
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!hasPermission('crear_lead')) return;
    setSaving(true);
    try {
      const { data: newLead, error: insertError } = await supabase.from('leads').insert({
        nombre_empresa: leadForm.nombreEmpresa,
        nombre_contacto: leadForm.nombreContacto,
        correo: leadForm.correo,
        telefono: leadForm.telefono,
        pais: leadForm.pais,
        origen: leadForm.origen,
        estado: leadForm.estado,
        asignado_a: leadForm.asignadoA,
        notas: leadForm.notas,
        cuit_rut_rfc: leadForm.cuit_rut_rfc,
        industria: leadForm.industria,
        sitio_web: leadForm.sitioWeb,
        volumen_mensual_proyectado: leadForm.volumenMensualProyectado ? Number(leadForm.volumenMensualProyectado) : null,
        stack_tecnologico_actual: leadForm.stackTecnologicoActual,
        campos_dinamicos: leadForm.camposDinamicos
      }).select().single();

      if (insertError) throw insertError;

      if (newLead) {
        await supabase.from('contactos').insert({
          lead_id: newLead.id,
          nombre: leadForm.nombreContacto,
          email: leadForm.correo,
          telefono: leadForm.telefono,
          puesto: 'Contacto Comercial Principal (Lead)'
        });
      }

      showAlert('Prospecto creado correctamente', 'success');
      setShowCreateModal(false);
      resetForm();
      refresh();
    } catch (err) {
      console.error(err);
      showAlert(`Error al crear el prospecto: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (lead) => {
    if (!hasPermission('editar_lead') && !isLector && role !== 'editor') return;
    setSelectedLead(lead);
    setShowGestionModal(true);
  };

  const handleUpdateLead = async (e) => {
    e.preventDefault();
    if (!hasPermission('editar_lead') || !selectedLead) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase.from('leads').update({
        nombre_empresa: leadForm.nombreEmpresa,
        nombre_contacto: leadForm.nombreContacto,
        correo: leadForm.correo,
        telefono: leadForm.telefono,
        pais: leadForm.pais,
        origen: leadForm.origen,
        estado: leadForm.estado,
        asignado_a: leadForm.asignadoA,
        notas: leadForm.notas,
        cuit_rut_rfc: leadForm.cuit_rut_rfc,
        industria: leadForm.industria,
        sitio_web: leadForm.sitioWeb,
        volumen_mensual_proyectado: leadForm.volumenMensualProyectado ? Number(leadForm.volumenMensualProyectado) : null,
        stack_tecnologico_actual: leadForm.stackTecnologicoActual,
        campos_dinamicos: leadForm.camposDinamicos
      }).eq('id', selectedLead.id);

      if (updateError) throw updateError;

      showAlert('Prospecto actualizado correctamente', 'success');
      setShowCreateModal(false);
      setSelectedLead(null);
      resetForm();
      refresh();
    } catch (err) {
      console.error(err);
      showAlert(`Error al actualizar el prospecto: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const openConvertModal = (lead) => {
    setSelectedLead(lead);
    setConvertForm({
      montoEstimadoMensual: 5000,
      nombreOportunidad: `Servicios de Distribución - ${lead.nombreEmpresa}`,
      etapa: 'diagnostico'
    });
    setShowConvertModal(true);
  };

  const handleConvertLead = async (e) => {
    e.preventDefault();
    if (!hasPermission('calificar_lead') || !selectedLead) return;
    setSaving(true);
    try {
      const clientDocId = `lead_converted_${selectedLead.id}`;
      
      // 1. Crear el cliente
      await supabase.from('clientes').insert({
        id: clientDocId,
        nombre_empresa: selectedLead.nombreEmpresa,
        cuit_rut_rfc: selectedLead.cuit_rut_rfc || null,
        industria: selectedLead.industria || null,
        sitio_web: selectedLead.sitioWeb || null,
        tamanio_empresa: selectedLead.tamanioEmpresa || null,
        estado: 'Onboarding',
        observaciones: `Cliente convertido del Lead calificado: ${selectedLead.nombreContacto}. ${selectedLead.notas || ''}`,
        comercial_email: selectedLead.asignadoA || user?.email || 'admin@luxia.com',
        pais: selectedLead.pais,
        campos_dinamicos: {}
      });

      // 2. Asociar el contacto existente
      await supabase.from('contactos').insert({
        cliente_id: clientDocId,
        lead_id: selectedLead.id,
        nombre: selectedLead.nombreContacto,
        email: selectedLead.correo,
        telefono: selectedLead.telefono,
        puesto: 'Contacto Comercial Principal'
      });

      // 3. Crear la oportunidad
      const opCurrency = getCountryCurrency(selectedLead.pais);
      const montoEstimado = Number(convertForm.montoEstimadoMensual) || 0;

      await supabase.from('oportunidades').insert({
        cliente_id: clientDocId,
        nombre: convertForm.nombreOportunidad,
        etapa: convertForm.etapa,
        monto_estimado_mensual: montoEstimado,
        probabilidad: convertForm.etapa === 'diagnostico' ? 20 : (convertForm.etapa === 'propuesta' ? 50 : 80),
        comercial_email: selectedLead.asignadoA || user?.email || 'admin@luxia.com',
        pais: selectedLead.pais,
        tipo_pipeline: 'adquisicion',
        tipo_servicio: 'default',
        campos_dinamicos: {}
      });

      // 4. Actualizar estado del lead
      await supabase.from('leads').update({
        estado: 'ganado'
      }).eq('id', selectedLead.id);

      showAlert('Lead convertido a Cliente y Oportunidad correctamente', 'success');
      setShowConvertModal(false);
      setSelectedLead(null);
      refresh();
    } catch (err) {
      console.error(err);
      showAlert(`Error al convertir el lead: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Filter Logic
  const filteredLeads = leads.filter(l => {
    // Restricción de equipo para Supervisores y Agentes (solo si es Adquisicion o Retencion)
    if (leadsScope !== 'ALL') {
      const isSelf = l.asignadoA && l.asignadoA.toLowerCase().trim() === user?.email?.toLowerCase().trim();
      const isUnassigned = !l.asignadoA;
      if (leadsScope === 'OWN') {
        if (!isSelf && !isUnassigned) return false;
      } else if (leadsScope === 'TEAM') {
        if (!isSelf && !isUnassigned) {
          const asignadoUser = usuarios.find(u => u.email?.toLowerCase().trim() === l.asignadoA.toLowerCase().trim());
          if (!asignadoUser || normalizarEquipo(asignadoUser.equipo) !== normalizedTeam) return false;
        }
      } else {
        return false; // NONE
      }
    }

    if (filterEstado && l.estado !== filterEstado) return false;
    if (filterComercial && l.asignadoA !== filterComercial) return false;

    if (filterFecha) {
      const dateVal = l.createdAt || l.fechaIngreso;
      if (!dateVal) return false;
      const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
      const now = new Date();
      if (filterFecha === 'hoy') {
        if (date.toDateString() !== now.toDateString()) return false;
      } else if (filterFecha === 'semana') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        if (date < sevenDaysAgo || date > now) return false;
      } else if (filterFecha === 'mes') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        if (date < thirtyDaysAgo || date > now) return false;
      }
    }

    if (searchTerm.trim()) {
      const queryLower = searchTerm.toLowerCase();
      const matchEmpresa = l.nombreEmpresa?.toLowerCase().includes(queryLower);
      const matchContacto = l.nombreContacto?.toLowerCase().includes(queryLower);
      const matchCorreo = l.correo?.toLowerCase().includes(queryLower);
      return matchEmpresa || matchContacto || matchCorreo;
    }
    return true;
  });

  // ── Virtualization ──────────────────────────────────────────────────────────
  const { visibleItems: visibleLeadsList, paddingTop: listPaddingTop, paddingBottom: listPaddingBottom } =
    useVirtualWindow(filteredLeads, 75, 10);

  return (
    <div className="animate__animated animate__fadeIn">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1 text-dark" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <i className="bi bi-person-plus-fill text-success me-2"></i>Buzón de Prospección (Leads)
          </h4>
          <p className="text-muted mb-0 small">Administra los prospectos, califica las cuentas e inícialas en el pipeline.</p>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {/* Selector de modo de vista */}
          <div className="btn-group border rounded-pill p-1 bg-light d-inline-flex" role="group" style={{ height: '38px' }}>
            <button 
              type="button" 
              className={`btn btn-xs rounded-pill px-3 border-0 d-flex align-items-center gap-1 fw-bold transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
              onClick={() => setViewMode('grid')}
              style={{ fontSize: '0.75rem' }}
            >
              <i className="bi bi-grid-3x3-gap-fill"></i> Tarjetas
            </button>
            <button 
              type="button" 
              className={`btn btn-xs rounded-pill px-3 border-0 d-flex align-items-center gap-1 fw-bold transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
              onClick={() => setViewMode('list')}
              style={{ fontSize: '0.75rem' }}
            >
              <i className="bi bi-table"></i> Lista
            </button>
            <button 
              type="button" 
              className={`btn btn-xs rounded-pill px-3 border-0 d-flex align-items-center gap-1 fw-bold transition-all ${viewMode === 'dashboard' ? 'bg-primary text-white shadow-sm' : 'text-muted'}`}
              onClick={() => setViewMode('dashboard')}
              style={{ fontSize: '0.75rem' }}
            >
              <i className="bi bi-graph-up me-1"></i> Dashboard SDR
            </button>
          </div>

          {hasPermission('actions', 'exportar_leads') && (
            <button 
              className="btn btn-outline-primary rounded-pill px-3 shadow-sm d-flex align-items-center gap-2"
              onClick={() => setShowExportDrawer(true)}
              style={{ height: '38px', fontSize: '0.85rem' }}
            >
              <i className="bi bi-download"></i>
              Exportar
            </button>
          )}

          {canImportData && (
            <button 
              className="btn btn-outline-info text-info rounded-pill px-3 shadow-sm d-flex align-items-center gap-2"
              onClick={() => setShowBulkImportModal(true)}
              style={{ height: '38px', fontSize: '0.85rem' }}
            >
              <i className="bi bi-file-earmark-arrow-up"></i>
              Carga Masiva
            </button>
          )}




          <button 
            className="btn btn-success rounded-pill px-4 shadow-sm"
            onClick={() => { setSelectedLead(null); resetForm(); setShowCreateModal(true); }}
            disabled={!hasPermission('crear_lead')}
            style={{ height: '38px', display: 'inline-flex', alignItems: 'center' }}
          >
            <i className="bi bi-plus-lg me-2"></i>Nuevo Prospecto
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="filter-bar-premium mb-4">
        <div className="filter-search-wrapper" style={{ flex: 2 }}>
          <i className="bi bi-search filter-search-icon"></i>
          <input 
            type="text" 
            className="filter-search-input" 
            placeholder="Buscar por empresa, contacto o correo..." 
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className="filter-search-clear" onClick={() => { setSearchInput(''); setSearchTerm(''); }} aria-label="Limpiar búsqueda">
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>
        <div className="filter-select-wrapper">
          <i className="bi bi-funnel filter-select-icon"></i>
          <select 
            className="filter-select" 
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
          >
            <option value="">Todos los Estados</option>
            <option value="nuevo">🆕 Nuevo</option>
            <option value="contactado">📞 Contactado</option>
            <option value="calificado">✅ Calificado</option>
            <option value="descalificado">❌ Descalificado</option>
          </select>
        </div>
        <div className="filter-select-wrapper">
          <i className="bi bi-person filter-select-icon"></i>
          <select 
            className="filter-select" 
            value={filterComercial}
            onChange={e => setFilterComercial(e.target.value)}
          >
            <option value="">Todos los Comerciales</option>
            {usuarios
              .filter(u => {
                const normU = normalizarEquipo(u.equipo);
                const belongsToTeam = normU === 'adquisicion' || normU === 'retencion';
                if (isRestricted) {
                  if (leadsScope === 'OWN') {
                    return u.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim();
                  }
                  return normU === normalizedTeam;
                }
                return belongsToTeam;
              })
              .map(u => (
                <option key={u.email} value={u.email}>{u.nombre} ({normalizarEquipo(u.equipo) === 'adquisicion' ? 'Adquisición' : 'Retención'})</option>
              ))}
          </select>
        </div>
        <div className="filter-select-wrapper">
          <i className="bi bi-calendar3 filter-select-icon"></i>
          <select 
            className="filter-select" 
            value={filterFecha}
            onChange={e => setFilterFecha(e.target.value)}
          >
            <option value="">Cualquier Fecha</option>
            <option value="hoy">📅 Registrado Hoy</option>
            <option value="semana">📅 Últimos 7 Días</option>
            <option value="mes">📅 Últimos 30 Días</option>
          </select>
        </div>
      </div>

      {/* Banner de Lead Scorer IA Desactivado */}
      {(iaPausada || leadScorerDisabled) && (
        <div className="alert alert-warning py-3 px-4 rounded-4 mb-4 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center gap-3 shadow-sm animate__animated animate__fadeIn" role="alert">
          <i className="bi bi-robot fs-4 text-warning"></i>
          <div className="text-start">
            <h6 className="fw-bold mb-1" style={{ fontSize: '0.85rem' }}>Calificación de Leads (LUXIA Scorer) Inactiva</h6>
            <span style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
              El análisis automático de la viabilidad de prospectos (ICP, Score y Calificación Técnica) se encuentra suspendido {iaPausada ? 'por límite de presupuesto' : 'temporalmente por la administración'}. Puedes calificar prospectos manualmente.
            </span>
          </div>
        </div>
      )}

      {/* Leads List / Dashboard */}
      {loading ? (
        <div className="text-center py-5">
          <SpinnerPremium size="md" text="Cargando prospectos..." />
        </div>
      ) : viewMode === 'dashboard' ? (
        <div className="glass-panel p-4 rounded-4 border shadow-sm mb-4" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
          <h5 className="fw-bold mb-3" style={{ color: 'var(--apple-text-primary)' }}>Dashboard Operativo de Prospección (SDRs)</h5>
          

          {/* KPI Grid for SDRs */}

          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card p-3 border-0 shadow-sm rounded-4 bg-primary bg-opacity-10">
                <span className="text-muted small fw-bold text-uppercase">Prospectos Totales</span>
                <h3 className="fw-bold text-primary mb-0">{filteredLeads.length}</h3>
                <span className="text-muted small">En cartera filtrada</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card p-3 border-0 shadow-sm rounded-4 bg-warning bg-opacity-10">
                <span className="text-muted small fw-bold text-uppercase">Sin Contactar (&gt;24h)</span>
                <h3 className="fw-bold text-warning mb-0">
                  {filteredLeads.filter(l => l.estado === 'nuevo' || !l.estado).length}
                </h3>
                <span className="text-muted small">Requieren primer contacto</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card p-3 border-0 shadow-sm rounded-4 bg-success bg-opacity-10">
                <span className="text-muted small fw-bold text-uppercase">Tasa de Conversión</span>
                <h3 className="fw-bold text-success mb-0">
                  {filteredLeads.length > 0 ? Math.round((filteredLeads.filter(l => l.estado === 'calificado').length / filteredLeads.length) * 100) : 0}%
                </h3>
                <span className="text-muted small">Calificados a Oportunidad</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card p-3 border-0 shadow-sm rounded-4 bg-info bg-opacity-10">
                <span className="text-muted small fw-bold text-uppercase">LUXIA IA Analizados</span>
                <h3 className="fw-bold text-info mb-0">
                  {filteredLeads.filter(l => l.calificacionIA).length}
                </h3>
                <span className="text-muted small">Con scoring de idoneidad</span>
              </div>
            </div>
          </div>

          {/* Breakdown Charts & Workload */}
          <div className="row g-4">
            <div className="col-md-6">
              <div className="p-3 border rounded-4 bg-light h-100">
                <h6 className="fw-bold text-dark mb-3">Distribución por Estado de Calificación</h6>
                {['nuevo', 'contactado', 'calificado', 'descalificado'].map(st => {
                  const count = filteredLeads.filter(l => (l.estado || 'nuevo') === st).length;
                  const pct = filteredLeads.length > 0 ? Math.round((count / filteredLeads.length) * 100) : 0;
                  const labelMap = { nuevo: 'Nuevos / Por Contactar', contactado: 'En Contacto', calificado: 'Calificados', descalificado: 'Descalificados' };
                  const colorMap = { nuevo: 'bg-primary', contactado: 'bg-info', calificado: 'bg-success', descalificado: 'bg-danger' };
                  return (
                    <div key={st} className="mb-3">
                      <div className="d-flex justify-content-between small fw-bold mb-1">
                        <span>{labelMap[st]}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className={`progress-bar ${colorMap[st]}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="col-md-6">
              <div className="p-3 border rounded-4 bg-light h-100">
                <h6 className="fw-bold text-dark mb-3">Distribución por Origen / Fuente de Captación</h6>
                {['web', 'linkedin', 'cold_call', 'referido'].map(orig => {
                  const count = filteredLeads.filter(l => l.origen === orig).length;
                  const pct = filteredLeads.length > 0 ? Math.round((count / filteredLeads.length) * 100) : 0;
                  return (
                    <div key={orig} className="mb-3">
                      <div className="d-flex justify-content-between small fw-bold mb-1">
                        <span>{getOrigenLabel(orig)}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-dark" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Balanceo de Carga por Comercial SDR */}
          {(() => {
            const sdrWorkloadMap = {};
            filteredLeads.forEach(lead => {
              const rawEmail = (lead.asignadoA || 'sin_asignar').toLowerCase().trim();
              const isUnassigned = !lead.asignadoA || rawEmail === 'sin_asignar' || rawEmail === 'sin asignar';
              const ownerKey = isUnassigned ? 'sin_asignar' : rawEmail;

              if (!sdrWorkloadMap[ownerKey]) {
                const uObj = usuarios.find(u => (u.email || '').toLowerCase().trim() === ownerKey);
                sdrWorkloadMap[ownerKey] = {
                  email: isUnassigned ? 'sin_asignar' : ownerKey,
                  nombre: isUnassigned ? '🔓 Sin Asignar (Pendientes de Triaje)' : (uObj?.nombre || ownerKey),
                  isUnassigned,
                  total: 0,
                  nuevo: 0,
                  contactado: 0,
                  calificado: 0,
                  descalificado: 0
                };
              }

              const st = lead.estado || 'nuevo';
              sdrWorkloadMap[ownerKey].total++;
              if (st === 'nuevo') sdrWorkloadMap[ownerKey].nuevo++;
              else if (st === 'contactado') sdrWorkloadMap[ownerKey].contactado++;
              else if (st === 'calificado') sdrWorkloadMap[ownerKey].calificado++;
              else if (st === 'descalificado') sdrWorkloadMap[ownerKey].descalificado++;
            });

            const sdrWorkloadList = Object.values(sdrWorkloadMap).sort((a, b) => b.total - a.total);

            return (
              <div className="row g-4 mt-1">
                <div className="col-12">
                  <div className="p-4 border rounded-4 bg-white shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                      <h6 className="fw-bold text-dark mb-0">
                        <i className="bi bi-people-fill text-primary me-2"></i>
                        Balanceo de Carga Operativa por Comercial SDR
                      </h6>
                      <span className="badge bg-light text-muted border rounded-pill px-3 py-1 small">
                        {sdrWorkloadList.length} ejecutivos con cartera
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ fontSize: '0.75rem' }}>Comercial SDR</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-center">Leads Totales</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-center">Nuevos (Sin Contactar)</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-center">En Seguimiento</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-center">Calificados</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-end">Estado Carga</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sdrWorkloadList.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="text-center py-4 text-muted small">
                                <i className="bi bi-inbox me-2"></i> No hay registros de prospectos para mostrar en el balance de carga.
                              </td>
                            </tr>
                          ) : (
                            sdrWorkloadList.map((item, idx) => (
                              <tr key={idx} className={item.isUnassigned ? 'table-warning bg-warning bg-opacity-10' : ''}>
                                <td className="fw-bold text-dark small">
                                  {item.isUnassigned ? (
                                    <span className="text-danger fw-bold"><i className="bi bi-exclamation-triangle-fill me-1"></i>{item.nombre}</span>
                                  ) : (
                                    <span><i className="bi bi-person-circle text-secondary me-2"></i>{item.nombre}</span>
                                  )}
                                </td>
                                <td className="text-center fw-bold">{item.total}</td>
                                <td className="text-center">
                                  <span className={`badge rounded-pill ${item.nuevo > 0 ? 'bg-primary' : 'bg-light text-muted'}`}>
                                    {item.nuevo}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <span className={`badge rounded-pill ${item.contactado > 0 ? 'bg-info text-dark' : 'bg-light text-muted'}`}>
                                    {item.contactado}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <span className={`badge rounded-pill ${item.calificado > 0 ? 'bg-success' : 'bg-light text-muted'}`}>
                                    {item.calificado}
                                  </span>
                                </td>
                                <td className="text-end">
                                  {item.isUnassigned ? (
                                    <span className="badge bg-danger rounded-pill px-3 py-1">⚠️ Requiere Triaje</span>
                                  ) : (
                                    <span className={`badge rounded-pill px-3 py-1 ${
                                      item.nuevo > 5 ? 'bg-danger' : item.nuevo > 2 ? 'bg-warning text-dark' : 'bg-success'
                                    }`}>
                                      {item.nuevo > 5 ? 'Sobrecargado' : item.nuevo > 2 ? 'Atención' : 'Normal'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="card border shadow-sm rounded-4 p-5 text-center" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
          <i className="bi bi-person-slash fs-1 text-secondary opacity-50 mb-3"></i>
          <h5 className="fw-bold" style={{ color: 'var(--apple-text-primary)' }}>No se encontraron prospectos</h5>
          <p className="small text-muted mb-0">Modifica los filtros o registra un nuevo lead en el botón superior.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="row g-3">
          {filteredLeads.map(lead => (
            <div className="col-lg-4 col-md-6" key={lead.id}>
              <div className="card border-0 shadow-sm rounded-4 h-100 bg-white hover-shadow-lg transition-all">
                <div className="card-body p-4 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <span className={`badge px-3 py-1.5 rounded-pill small fw-bold ${
                      lead.estado === 'calificado' ? 'bg-success bg-opacity-10 text-success border border-success' :
                      lead.estado === 'descalificado' ? 'bg-danger bg-opacity-10 text-danger border border-danger' :
                      lead.estado === 'contactado' ? 'bg-info bg-opacity-10 text-info border border-info' :
                      'bg-primary bg-opacity-10 text-primary border border-primary'
                    }`}>
                      {lead.estado === 'calificado' ? '✅ Calificado' :
                       lead.estado === 'descalificado' ? '❌ Descalificado' :
                       lead.estado === 'contactado' ? '📞 Contactado' : '🆕 Nuevo'}
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill px-2.5 py-1 text-uppercase fw-bold small" style={{ fontSize: '0.7rem' }}>
                        {lead.pais}
                      </span>
                      {(hasPermission('editar_lead') || isLector || role === 'editor') && (
                        <button 
                          className="btn btn-link text-muted p-0 border-0 hover-text-primary lh-1"
                          onClick={() => handleEditClick(lead)}
                          title={(isLector || role === 'editor') ? "Ver prospecto" : "Editar prospecto"}
                        >
                          <i className={(isLector || role === 'editor') ? "bi bi-eye fs-5" : "bi bi-pencil-square fs-5"}></i>
                        </button>
                      )}
                    </div>
                  </div>

                  <h5 className="fw-bold text-dark mb-3 text-start">{lead.nombreEmpresa}</h5>

                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3 text-start">
                      <span className="small text-muted">Origen:</span>
                      <span className="small fw-semibold text-dark">{getOrigenLabel(lead.origen)}</span>
                    </div>

                    {lead.calificacionIA ? (
                      <div className="p-3 rounded-3 mb-3 text-start" style={{ 
                        background: lead.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.04)' : lead.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.04)' : 'rgba(220, 53, 69, 0.04)',
                        border: '1px solid',
                        borderColor: lead.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.15)' : lead.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(220, 53, 69, 0.15)'
                      }}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small fw-bold text-dark d-flex align-items-center gap-1">
                            <i className="bi bi-cpu text-primary"></i> LUXIA IA:
                          </span>
                          <span className="badge rounded-pill px-2.5 py-0.5 text-uppercase fw-bold" style={{ 
                            fontSize: '0.65rem',
                            backgroundColor: lead.calificacionIA.prioridad === 'Green' ? '#198754' : lead.calificacionIA.prioridad === 'Yellow' ? '#ffc107' : '#dc3545',
                            color: lead.calificacionIA.prioridad === 'Yellow' ? '#212529' : '#fff'
                          }}>
                            {lead.calificacionIA.prioridad === 'Green' ? 'Prioridad Alta' :
                             lead.calificacionIA.prioridad === 'Yellow' ? 'Prioridad Media' :
                             'Prioridad Baja'}
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-2 mt-2">
                          <div className="progress flex-grow-1" style={{ height: '6px' }}>
                            <div 
                              className={`progress-bar ${
                                lead.calificacionIA.prioridad === 'Green' ? 'bg-success' : 
                                lead.calificacionIA.prioridad === 'Yellow' ? 'bg-warning' : 
                                'bg-danger'
                              }`}
                              role="progressbar" 
                              style={{ width: `${lead.calificacionIA.score}%` }} 
                              aria-valuenow={lead.calificacionIA.score} 
                              aria-valuemin="0" 
                              aria-valuemax="100"
                            ></div>
                          </div>
                          <span className="small fw-bold font-monospace" style={{ fontSize: '0.8rem' }}>{lead.calificacionIA.score}/100</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-3 border border-dashed mb-3 text-center bg-light bg-opacity-50">
                        <p className="small text-muted mb-0">Sin calificar por LUXIA IA</p>
                      </div>
                    )}
                  </div>

                  {lead.estado !== 'calificado' && (
                    <div className="mt-auto pt-3 d-flex flex-wrap gap-2 justify-content-between border-top">
                      {hasPermission('disparar_ia') && (
                        <button 
                          className={`btn btn-sm btn-outline-secondary rounded-pill px-3 flex-grow-1 ${analyzingLeadId === lead.id || lead._triggerIA || iaPausada || leadScorerDisabled ? 'disabled' : ''}`}
                          onClick={() => handleTriggerLuxiaIa(lead)}
                          style={{ minWidth: '100px' }}
                          disabled={analyzingLeadId === lead.id || lead._triggerIA || iaPausada || leadScorerDisabled}
                        >
                          {analyzingLeadId === lead.id || lead._triggerIA ? (
                            <><span className="spinner-border spinner-border-sm me-1" role="status"></span>Scoring...</>
                          ) : (
                            <><i className="bi bi-cpu me-1"></i>Calificar IA</>
                          )}
                        </button>
                      )}

                      <button 
                        className="btn btn-sm btn-primary rounded-pill px-3 w-100 mt-1 fw-bold shadow-sm"
                        onClick={() => openConvertModal(lead)}
                        disabled={!hasPermission('calificar_lead')}
                      >
                        <i className="bi bi-check-circle me-1"></i>Calificar Prospecto
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="table-responsive">
            <table className="table table-premium align-middle mb-0">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-muted small fw-bold">Empresa / Contacto</th>
                  <th className="px-3 py-3 text-muted small fw-bold">País</th>
                  <th className="px-3 py-3 text-muted small fw-bold">Información de Contacto</th>
                  <th className="px-3 py-3 text-muted small fw-bold">Origen</th>
                  <th className="px-3 py-3 text-muted small fw-bold">LUXIA IA</th>
                  <th className="px-3 py-3 text-muted small fw-bold">Estado</th>
                  <th className="px-4 py-3 text-muted small fw-bold text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listPaddingTop > 0 && <tr style={{ height: listPaddingTop }}><td colSpan="7" /></tr>}
                {visibleLeadsList.map(lead => (
                  <tr key={lead.id}>
                    <td className="px-4 py-3">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <h6 className="fw-bold text-dark mb-0">{lead.nombreEmpresa}</h6>
                          <span className="text-muted small d-flex align-items-center gap-1">
                            <i className="bi bi-person text-muted"></i> {lead.nombreContacto}
                          </span>
                          {lead.primeraReunion?.fecha && (
                            <button
                              type="button"
                              className="btn btn-link p-0 text-decoration-none border-0 text-start d-flex align-items-center gap-1 mt-1.5 transition-all hover-text-primary"
                              onClick={() => setMeetingDetailsLead(lead)}
                              title="Ver detalles de la primera reunión"
                              style={{ fontSize: '0.72rem' }}
                            >
                              <span className="badge bg-light text-primary border rounded-pill px-2 py-0.5 fw-semibold d-inline-flex align-items-center gap-1">
                                <i className="bi bi-calendar2-check-fill"></i>
                                <span>Reunión ({lead.primeraReunion.clasificacionInteres})</span>
                              </span>
                            </button>
                          )}
                        </div>
                        {(hasPermission('editar_lead') || isLector || role === 'editor') && (
                          <button 
                            className="btn btn-link text-muted p-1 border-0 hover-text-primary lh-1 ms-2"
                            onClick={() => handleEditClick(lead)}
                            title={(isLector || role === 'editor') ? "Ver prospecto" : "Editar prospecto"}
                          >
                            <i className={(isLector || role === 'editor') ? "bi bi-eye fs-5" : "bi bi-pencil-square fs-5"}></i>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill px-2 py-0.5 text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>
                        {lead.pais}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="small text-dark fw-semibold">{lead.correo}</div>
                      <div className="small text-muted mb-2">{lead.telefono || 'Sin teléfono'}</div>
                      <ContactQuickActions 
                        contacto={{
                          id: lead.id,
                          nombre: lead.nombreContacto,
                          email: lead.correo,
                          telefono: lead.telefono,
                          leadId: lead.id
                        }} 
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className="small text-muted">{getOrigenLabel(lead.origen)}</span>
                    </td>
                    <td className="px-3 py-3">
                      {lead.calificacionIA ? (
                        <div className="d-inline-flex align-items-center gap-1.5 px-2.5 py-0.5 rounded-pill border small fw-bold text-start" style={{ 
                          fontSize: '0.72rem',
                          background: lead.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.08)' : lead.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.08)' : 'rgba(220, 53, 69, 0.08)',
                          borderColor: lead.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.2)' : lead.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                          color: lead.calificacionIA.prioridad === 'Green' ? '#198754' : lead.calificacionIA.prioridad === 'Yellow' ? '#b25e00' : '#dc3545'
                        }}>
                          <span className="dot-indicator" style={{ backgroundColor: 'currentColor' }}></span>
                          {lead.calificacionIA.prioridad === 'Green' ? 'Alta' :
                           lead.calificacionIA.prioridad === 'Yellow' ? 'Media' :
                           'Baja'} ({lead.calificacionIA.score}/100)
                        </div>
                      ) : (
                        <span className="small text-muted font-monospace opacity-50">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`badge px-2.5 py-1 rounded-pill small fw-bold ${
                        lead.estado === 'calificado' ? 'bg-success bg-opacity-10 text-success border border-success' :
                        lead.estado === 'descalificado' ? 'bg-danger bg-opacity-10 text-danger border border-danger' :
                        lead.estado === 'contactado' ? 'bg-info bg-opacity-10 text-info border border-info' :
                        'bg-primary bg-opacity-10 text-primary border border-primary'
                      }`} style={{ fontSize: '0.72rem' }}>
                        {lead.estado === 'calificado' ? 'Calificado' :
                         lead.estado === 'descalificado' ? 'Descalificado' :
                         lead.estado === 'contactado' ? 'Contactado' : 'Nuevo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="d-inline-flex gap-2">

                        {lead.estado !== 'calificado' && hasPermission('disparar_ia') && (
                          <button 
                            className={`btn btn-xs btn-outline-secondary rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1 ${analyzingLeadId === lead.id || lead._triggerIA ? 'disabled' : ''}`}
                            onClick={() => handleTriggerLuxiaIa(lead)}
                            style={{ fontSize: '0.72rem' }}
                          >
                            <i className="bi bi-cpu"></i> IA
                          </button>
                        )}

                        {lead.estado !== 'calificado' && (
                          <button 
                            className="btn btn-xs btn-primary rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                            onClick={() => openConvertModal(lead)}
                            disabled={!hasPermission('calificar_lead')}
                            style={{ fontSize: '0.72rem' }}
                          >
                            <i className="bi bi-check-circle"></i> Calificar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {listPaddingBottom > 0 && <tr style={{ height: listPaddingBottom }}><td colSpan="7" /></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scroll luxia_ia element for lazy loading */}
      {!loading && hasMore && (
        <div ref={scrollObserverRef} className="text-center py-4">
          <SpinnerPremium size="sm" text="Cargando más prospectos..." />
        </div>
      )}

      {/* Modal Crear / Editar Lead */}
      {showCreateModal && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedLead ? 'Editar Prospecto' : 'Nuevo Prospecto'}</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <form onSubmit={selectedLead ? handleUpdateLead : handleCreateLead}>
                <div className="modal-body px-4 py-3" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Nombre de la Empresa</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        value={leadForm.nombreEmpresa} 
                        onChange={e => setLeadForm({ ...leadForm, nombreEmpresa: e.target.value })} 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Nombre de Contacto</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        required 
                        value={leadForm.nombreContacto} 
                        onChange={e => setLeadForm({ ...leadForm, nombreContacto: e.target.value })} 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Correo Electrónico</label>
                      <input 
                        type="email" 
                        className="form-control" 
                        required 
                        value={leadForm.correo} 
                        onChange={e => setLeadForm({ ...leadForm, correo: e.target.value })} 
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Teléfono</label>
                      <input 
                        type="tel" 
                        className="form-control" 
                        placeholder="+54911..." 
                        required 
                        value={leadForm.telefono} 
                        onChange={e => setLeadForm({ ...leadForm, telefono: e.target.value })} 
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold mb-1">País</label>
                      <select 
                        className="form-select" 
                        value={leadForm.pais} 
                        onChange={e => setLeadForm({ ...leadForm, pais: e.target.value })}
                      >
                        <option value="AR">Argentina</option>
                        <option value="CL">Chile</option>
                        <option value="PE">Perú</option>
                        <option value="CO">Colombia</option>
                        <option value="MX">México</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold mb-1">Origen del Lead</label>
                      <select 
                        className="form-select" 
                        value={leadForm.origen} 
                        onChange={e => setLeadForm({ ...leadForm, origen: e.target.value })}
                      >
                        <option value="web">Web / Formulario</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="cold_call">Llamada Fría</option>
                        <option value="referido">Referido</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold mb-1">Estado</label>
                      <select 
                        className="form-select" 
                        value={leadForm.estado} 
                        onChange={e => setLeadForm({ ...leadForm, estado: e.target.value })}
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="contactado">Contactado</option>
                        <option value="calificado">Calificado</option>
                        <option value="descalificado">Descalificado</option>
                      </select>
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-bold mb-1">Comercial Asignado</label>
                      <select 
                        className="form-select" 
                        value={leadForm.asignadoA} 
                        onChange={e => setLeadForm({ ...leadForm, asignadoA: e.target.value })}
                        disabled={!hasPermission('asignar_lead_manual')}
                      >
                        <option value="">Seleccionar Comercial...</option>
                        {usuarios
                          .filter(u => {
                            const normU = normalizarEquipo(u.equipo);
                            const belongsToTeam = normU === 'adquisicion' || normU === 'retencion';
                            if (isRestricted) {
                              if (leadsScope === 'OWN') {
                                return u.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim();
                              }
                              return normU === normalizedTeam;
                            }
                            return belongsToTeam;
                          })
                          .map(u => (
                            <option key={u.email} value={u.email}>{u.nombre} ({normalizarEquipo(u.equipo) === 'adquisicion' ? 'Adquisición' : 'Retención'})</option>
                          ))}
                      </select>
                      {!hasPermission('asignar_lead_manual') && (
                        <div className="form-text text-muted small mt-1">
                          <i className="bi bi-robot me-1"></i> Ruteo y asignación automática gestionada por LUXIA IA.
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-bold mb-1">Notas de Seguimiento</label>
                      <textarea 
                        className="form-control" 
                        rows="2" 
                        value={leadForm.notas} 
                        onChange={e => setLeadForm({ ...leadForm, notas: e.target.value })}
                      ></textarea>
                    </div>

                    {/* DATOS FIRMOGRÁFICOS Y B2B */}
                    <div className="col-md-4">
                      <label className="form-label small fw-bold mb-1">CUIT / RUT / RFC (Id. Fiscal)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Ej. 20-12345678-9"
                        value={leadForm.cuit_rut_rfc} 
                        onChange={e => setLeadForm({ ...leadForm, cuit_rut_rfc: e.target.value })} 
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold mb-1">Industria / Vertical</label>
                      <select 
                        className="form-select" 
                        value={leadForm.industria} 
                        onChange={e => setLeadForm({ ...leadForm, industria: e.target.value })}
                      >
                        <option value="">Seleccionar vertical agropecuaria...</option>
                        <option value="productor">🌾 Productor Agropecuario / Campo</option>
                        <option value="agronomia">🏪 Distribuidor / Agronomía</option>
                        <option value="cooperativa">🏢 Acopio & Cooperativa Agrícola</option>
                        <option value="semillero">🌱 Semillero & Genética Vegetal</option>
                        <option value="servicios_agro">🚜 Servicios Agronómicos & Contratista</option>
                        <option value="laboratorio">🧪 Industria / Laboratorio Fitosanitario</option>
                        <option value="otro">🏢 Otro Rubro Agroindustrial</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold mb-1">Sitio Web Empresa</label>
                      <input 
                        type="url" 
                        className="form-control" 
                        placeholder="https://empresa.com"
                        value={leadForm.sitioWeb} 
                        onChange={e => setLeadForm({ ...leadForm, sitioWeb: e.target.value })} 
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Superficie Agrícola Estimada (Has)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Ej. 1500 (Hectáreas)"
                        value={leadForm.volumenMensualProyectado} 
                        onChange={e => setLeadForm({ ...leadForm, volumenMensualProyectado: e.target.value })} 
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Cultivo Principal de Interés</label>
                      <select 
                        className="form-select" 
                        value={leadForm.stackTecnologicoActual} 
                        onChange={e => setLeadForm({ ...leadForm, stackTecnologicoActual: e.target.value })}
                      >
                        <option value="">Seleccionar cultivo...</option>
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
                  </div>

                  {/* Detalles de la Primera Reunión (Condicional para Contactado o Calificado) */}
                  {(leadForm.estado === 'contactado' || leadForm.estado === 'calificado') && (
                    <div className="mt-4 p-4 rounded-4 bg-white border shadow-sm">
                      <h6 className="fw-bold mb-3 text-dark d-flex align-items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <i className="bi bi-calendar2-check text-primary fs-5"></i>
                        <span>Detalles de Primera Reunión</span>
                      </h6>
                      
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label small fw-bold mb-1">Fecha de la Reunión</label>
                          <input 
                            type="date" 
                            className="form-control"
                            value={leadForm.primeraReunion?.fecha || ''}
                            onChange={e => setLeadForm({
                              ...leadForm,
                              primeraReunion: { ...leadForm.primeraReunion, fecha: e.target.value }
                            })}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold mb-1">Clasificación de Interés</label>
                          <select 
                            className="form-select"
                            value={leadForm.primeraReunion?.clasificacionInteres || 'Medio'}
                            onChange={e => setLeadForm({
                              ...leadForm,
                              primeraReunion: { ...leadForm.primeraReunion, clasificacionInteres: e.target.value }
                            })}
                          >
                            <option value="Bajo">Bajo Interés (Tibia/Fría)</option>
                            <option value="Medio">Interés Medio</option>
                            <option value="Alto">Interés Alto (Caliente)</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-bold mb-1">Necesidad Principal o Dolor Detectado</label>
                          <textarea 
                            className="form-control text-sm" 
                            rows="2"
                            placeholder="Describir los principales desafíos operacionales o necesidades del cliente..."
                            value={leadForm.primeraReunion?.necesidadPrincipal || ''}
                            onChange={e => setLeadForm({
                              ...leadForm,
                              primeraReunion: { ...leadForm.primeraReunion, necesidadPrincipal: e.target.value }
                            })}
                          ></textarea>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold mb-1">Resumen / Notas de la Reunión</label>
                          <textarea 
                            className="form-control text-sm" 
                            rows="2.5"
                            placeholder="Detalles sobre lo conversado..."
                            value={leadForm.primeraReunion?.resumen || ''}
                            onChange={e => setLeadForm({
                              ...leadForm,
                              primeraReunion: { ...leadForm.primeraReunion, resumen: e.target.value }
                            })}
                          ></textarea>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold mb-1">Acuerdos y Siguientes Pasos</label>
                          <textarea 
                            className="form-control text-sm" 
                            rows="2.5"
                            placeholder="Compromisos y fecha del próximo contacto..."
                            value={leadForm.primeraReunion?.acuerdos || ''}
                            onChange={e => setLeadForm({
                              ...leadForm,
                              primeraReunion: { ...leadForm.primeraReunion, acuerdos: e.target.value }
                            })}
                          ></textarea>
                        </div>
                      </div>

                      {/* Renderizado de Campos Dinámicos correspondientes a la reunión */}
                      {secciones.filter(s => s.id === 'primera_reunion').map(sec => {
                        const camposSec = leadFields.filter(c => c.seccionId === sec.id);
                        if (camposSec.length === 0) return null;
                        return (
                          <div className="mt-3 pt-3 border-top" key={sec.id}>
                            <span className="small text-muted fw-bold d-block mb-2">Campos de Reunión Personalizados:</span>
                            <div className="row g-2">
                              {camposSec.map(campo => (
                                <div className="col-md-6" key={campo.id}>
                                  <DynamicFieldInput 
                                    campo={campo} 
                                    value={leadForm.camposDinamicos[campo.key] || ''} 
                                    onChange={val => setLeadForm({
                                      ...leadForm,
                                      camposDinamicos: { ...leadForm.camposDinamicos, [campo.key]: val }
                                    })}
                                    clientId={selectedLead?.id || 'temp'}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Render Dynamic Fields */}
                  {secciones.filter(sec => sec.id !== 'primera_reunion').map(sec => {
                    const camposSec = leadFields.filter(c => c.seccionId === sec.id);
                    if (camposSec.length === 0) return null;
                    return (
                      <div className="mt-4 p-3 rounded-4 bg-light border border-light" key={sec.id}>
                        <h6 className="fw-bold mb-3 text-dark">
                          <i className={`bi ${sec.icono || 'bi-grid'} text-primary me-2`}></i>{sec.nombre}
                        </h6>
                        <div className="row g-3">
                          {camposSec.map(campo => (
                            <DynamicFieldInput 
                              key={campo.id}
                              campo={campo} 
                              value={leadForm.camposDinamicos[campo.key] || ''} 
                              onChange={val => setLeadForm({
                                ...leadForm,
                                camposDinamicos: { ...leadForm.camposDinamicos, [campo.key]: val }
                              })}
                              clientId={selectedLead?.id || 'temp'}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="modal-footer px-4 py-3">
                  <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-semibold" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Prospecto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Calificar y Convertir */}
      {showConvertModal && selectedLead && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title text-success"><i className="bi bi-trophy-fill me-2"></i>Calificar y Convertir Lead</h5>
                <button type="button" className="btn-close" onClick={() => setShowConvertModal(false)}></button>
              </div>
              <form onSubmit={handleConvertLead}>
                <div className="modal-body px-4 py-3">
                  <p className="small text-muted">
                    Esta acción convertirá permanentemente el prospecto <strong>{selectedLead.nombreEmpresa}</strong> en un Cliente Activo de la cartera y registrará una oportunidad comercial en el pipeline de ventas.
                  </p>

                  <div className="mb-3">
                    <label className="form-label small fw-bold mb-1">Nombre de la Oportunidad Comercial</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      required 
                      value={convertForm.nombreOportunidad} 
                      onChange={e => setConvertForm({ ...convertForm, nombreOportunidad: e.target.value })} 
                    />
                  </div>

                  <div className="row g-3">
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Monto Mensual Estimado ({selectedLead ? getCountryCurrency(selectedLead.pais) : 'USD'})</label>
                      <div className="input-group">
                        <span className="input-group-text">{selectedLead ? getCountryCurrency(selectedLead.pais) : '$'}</span>
                        <input 
                          type="number" 
                          className="form-control" 
                          required 
                          value={convertForm.montoEstimadoMensual} 
                          onChange={e => setConvertForm({ ...convertForm, montoEstimadoMensual: e.target.value })} 
                        />
                      </div>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Etapa Inicial</label>
                      <select 
                        className="form-select" 
                        value={convertForm.etapa} 
                        onChange={e => setConvertForm({ ...convertForm, etapa: e.target.value })}
                      >
                        <option value="diagnostico">📋 Diagnóstico</option>
                        <option value="propuesta">📂 Propuesta</option>
                        <option value="negociacion">💬 Negociación</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light border-top-0 px-4 py-3">
                  <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-semibold" onClick={() => setShowConvertModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" disabled={saving}>
                    {saving ? 'Convirtiendo...' : 'Confirmar Conversión'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal WhatsApp Chat Console */}
      {showWhatsappModal && whatsappLead && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '850px' }}>
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden" style={{ height: '80vh' }}>
              <div className="modal-header bg-white border-bottom p-3 px-4 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded-3 bg-success bg-opacity-10 text-success">
                    <i className="bi bi-whatsapp fs-5"></i>
                  </div>
                  <div>
                    <h6 className="modal-title fw-bold text-dark mb-0">Consola WhatsApp: {whatsappLead.nombreEmpresa}</h6>
                    <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Gestión directa de conversaciones y plantillas</span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowWhatsappModal(false)}></button>
              </div>
              <div className="modal-body p-0 d-flex flex-column flex-grow-1" style={{ height: 'calc(80vh - 56px)', overflow: 'hidden' }}>
                <WhatsappChatConsole 
                  leadId={whatsappLead.id} 
                  initialPhone={whatsappLead.telefono} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Primera Reunión */}
      {meetingDetailsLead && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-white border-bottom p-3 px-4 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                    <i className="bi bi-calendar2-check-fill fs-5"></i>
                  </div>
                  <div>
                    <h6 className="modal-title fw-bold text-dark mb-0">Primera Reunión: {meetingDetailsLead.nombreEmpresa}</h6>
                    <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Resumen de minutas, fecha y notas de la reunión inicial</span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setMeetingDetailsLead(null)}></button>
              </div>
              <div className="modal-body px-4 py-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="row g-4">
                  {/* Meta info */}
                  <div className="col-md-6 border-end">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="small text-muted fw-bold text-uppercase">Fecha de Reunión:</span>
                      <span className="badge bg-light text-dark border px-3 py-1.5 rounded-pill fw-semibold">
                        <i className="bi bi-calendar-event text-primary me-1"></i>
                        {meetingDetailsLead.primeraReunion?.fecha ? new Date(meetingDetailsLead.primeraReunion.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin registrar'}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="small text-muted fw-bold text-uppercase">Interés del Cliente:</span>
                      <span className={`badge px-3 py-1.5 rounded-pill fw-bold ${
                        meetingDetailsLead.primeraReunion?.clasificacionInteres === 'Alto' ? 'bg-danger bg-opacity-10 text-danger border border-danger' :
                        meetingDetailsLead.primeraReunion?.clasificacionInteres === 'Medio' ? 'bg-warning bg-opacity-10 text-warning text-dark border border-warning' :
                        'bg-secondary bg-opacity-10 text-secondary border border-secondary'
                      }`}>
                        <i className="bi bi-heart-fill me-1"></i>
                        Interés {meetingDetailsLead.primeraReunion?.clasificacionInteres || 'No clasificado'}
                      </span>
                    </div>
                  </div>

                  {/* Diagnóstico */}
                  <div className="col-12">
                    <div className="p-3 bg-light rounded-4 border-start border-primary border-4 text-start">
                      <h6 className="fw-bold text-primary mb-2 small text-uppercase font-monospace">Necesidad Principal o Dolor Detectado</h6>
                      <p className="text-dark mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>{meetingDetailsLead.primeraReunion?.necesidadPrincipal || 'Sin registrar.'}</p>
                    </div>
                  </div>

                  {/* Resumen */}
                  <div className="col-md-6 text-start">
                    <h6 className="fw-bold text-muted mb-2 small text-uppercase font-monospace">Resumen y Notas de la Reunión</h6>
                    <div className="p-3 bg-light rounded-4 border" style={{ minHeight: '120px' }}>
                      <p className="text-dark mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>{meetingDetailsLead.primeraReunion?.resumen || 'Sin notas.'}</p>
                    </div>
                  </div>

                  {/* Acuerdos */}
                  <div className="col-md-6 text-start">
                    <h6 className="fw-bold text-muted mb-2 small text-uppercase font-monospace">Acuerdos y Siguientes Pasos</h6>
                    <div className="p-3 bg-light rounded-4 border" style={{ minHeight: '120px' }}>
                      <p className="text-dark mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>{meetingDetailsLead.primeraReunion?.acuerdos || 'Sin acuerdos registrados.'}</p>
                    </div>
                  </div>

                  {/* Dynamic Fields for primera_reunion section */}
                  {secciones.filter(s => s.id === 'primera_reunion').map(sec => {
                    const camposSec = leadFields.filter(c => c.seccionId === sec.id);
                    const hasData = camposSec.some(c => meetingDetailsLead.camposDinamicos?.[c.key]);
                    if (!hasData) return null;
                    return (
                      <div className="col-12 text-start mt-4 pt-3 border-top" key={sec.id}>
                        <h6 className="fw-bold text-dark mb-3 small text-uppercase font-monospace">Campos Personalizados de la Reunión</h6>
                        <div className="row g-3">
                          {camposSec.map(campo => {
                            const val = meetingDetailsLead.camposDinamicos?.[campo.key];
                            if (!val) return null;
                            const displayVal = typeof val === 'object' ? (val.valor || '') : String(val);
                            return (
                              <div className="col-md-6" key={campo.id}>
                                <div className="p-2 border rounded bg-white">
                                  <span className="small text-muted font-monospace d-block" style={{ fontSize: '0.72rem' }}>{campo.nombre}:</span>
                                  <span className="fw-semibold text-dark small">{displayVal}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer bg-light border-top-0 px-4 py-3">
                <button type="button" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" onClick={() => setMeetingDetailsLead(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showGestionModal && selectedLead && (
        <LeadGestionModal 
          show={showGestionModal} 
          onClose={() => {
            setShowGestionModal(false);
            setSelectedLead(null);
          }} 
          leadData={selectedLead} 
          onSaved={() => {
            refresh();
          }} 
          iaPausada={iaPausada}
          leadScorerDisabled={leadScorerDisabled}
        />
      )}


      <ExportDrawer 
        show={showExportDrawer} 
        onClose={() => setShowExportDrawer(false)} 
        defaultEntity="leads" 
      />

      <BulkImportModal
        show={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        initialEntity="leads"
        user={user}
      />
    </div>
  );
}

