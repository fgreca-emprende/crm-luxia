import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { DynamicFieldInput } from './DynamicFieldInput';
import { ContactQuickActions } from './ContactQuickActions';
import { ExportDrawer } from './ExportDrawer';
import { BulkImportModal } from './BulkImportModal';
import { ContactListWidget } from './ContactListWidget';
import { OportunidadGestionModal } from './OportunidadGestionModal';
import { SalesOperationalDashboard } from './dashboard/SalesOperationalDashboard';
import { getConfigGeneral } from '../../lib/configGeneral';

export function OportunidadesView({ selectedCountry }) {
  const { isSuperAdmin, isAdmin, isSupervisor, isLector, hasPermission, role, userTeam, getDataScope, user } = useUserRole();
  const canImportData = hasPermission('actions', 'alta_masiva_registros') || hasPermission('alta_masiva_registros');

  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);
  const oportunidadesScope = getDataScope('oportunidades');
  const isRestricted = oportunidadesScope !== 'ALL';
  const { showAlert } = useToast();
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  const getCountryCurrencyLocal = (country) => {
    switch (country) {
      case 'AR': return 'ARS';
      case 'CL': return 'CLP';
      case 'PE': return 'PEN';
      case 'CO': return 'COP';
      case 'MX': return 'MXN';
      default: return 'USD';
    }
  };

  // Data State
  const [oportunidades, setOportunidades] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [campos, setCampos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzingOpId, setAnalyzingOpId] = useState(null);

  // Modals & Drag State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [showWinContractModal, setShowWinContractModal] = useState(false);
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [selectedOportunidad, setSelectedOportunidad] = useState(null);
  const [targetStageTemp, setTargetStageTemp] = useState('');
  
  // Gatekeeping states
  const [pipelineConfigs, setPipelineConfigs] = useState({});
  const [activePipelineFilter, setActivePipelineFilter] = useState('adquisicion');
  const [activeServiceFilter, setActiveServiceFilter] = useState('default');
  const [allOpportunityFields, setAllOpportunityFields] = useState([]);
  const [showGatekeepingModal, setShowGatekeepingModal] = useState(false);
  const [gatekeepingMissingFields, setGatekeepingMissingFields] = useState([]);
  const [gatekeepingFormValues, setGatekeepingFormValues] = useState({});

  const [servicios, setServicios] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFecha, setFilterFecha] = useState('all');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [gatekeepingClientSearch, setGatekeepingClientSearch] = useState('');
  const [showGatekeepingClientDropdown, setShowGatekeepingClientDropdown] = useState(false);
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, ARS: 900, CLP: 940, PEN: 3.7, COP: 4100, MXN: 18 });
  const [iaPausada, setIaPausada] = useState(false);
  const [rangoCerradas, setRangoCerradas] = useState('30d'); // '30d', '6m', 'todos'

  // Forzar pipeline según equipo del usuario (solo si es Adquisicion o Retencion)
  useEffect(() => {
    if (isRestricted) {
      if (normalizedTeam === 'adquisicion' || normalizedTeam === 'retencion') {
        setActivePipelineFilter(normalizedTeam);
      }
    }
  }, [isRestricted, normalizedTeam]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const usage = await getConfigGeneral('config_ia_usage');
        if (usage) {
          setIaPausada((usage.disabledByBudget === true && usage.autoshutoffActive === true) || usage.manualPause === true);
        }
        const conf = await getConfigGeneral('rates');
        if (conf && conf.rates) {
          setExchangeRates(conf.rates);
        }
        const pipeConf = await getConfigGeneral('pipeline_config');
        if (pipeConf) {
          setPipelineConfigs(pipeConf);
        }
      } catch (err) {
        console.warn("Error loading general configs:", err.message);
      }
    };
    fetchConfig();
  }, []);

  // Forms State
  const [opForm, setOpForm] = useState({
    clienteId: '',
    nombre: '',
    etapa: 'diagnostico',
    montoEstimadoMensual: 5000,
    fechaEstimadaCierre: '',
    comercialEmail: '',
    pais: selectedCountry || 'AR',
    tipoPipeline: 'adquisicion',
    tipoServicio: 'default',
    notas: '',
    camposDinamicos: {}
  });

  const [lossForm, setLossForm] = useState({
    perdidaRazon: 'precio',
    perdidaDetalle: ''
  });

  const [contractForm, setContractForm] = useState({
    tipoServicio: 'distribucion_regional',
    driveLink: '',
    fechaInicio: new Date().toISOString().substring(0, 10),
    fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    volumenMensualProyectado: 1000,
    requiereIntegracion: false,
    modeloFacturacion: 'SaaS + Variable',
    moneda: 'USD'
  });

  const activeConfigKey = `${activePipelineFilter}_${activeServiceFilter}`;
  const defaultConfigKey = `${activePipelineFilter}_default`;
  const activeSegmentConfig = pipelineConfigs[activeConfigKey] || pipelineConfigs[defaultConfigKey] || {
    stages: [
      { id: 'diagnostico', label: '📋 Diagnóstico', orden: 10 },
      { id: 'propuesta', label: '💡 Propuesta', orden: 20 },
      { id: 'negociacion', label: '🤝 Negociación', orden: 30 }
    ],
    formFields: ['nombre', 'clienteId', 'comercialEmail', 'montoEstimadoMensual', 'fechaEstimadaCierre', 'pais', 'notas'],
    gatekeeping: {
      diagnostico: [],
      propuesta: [],
      negociacion: []
    }
  };

  const activeStagesList = [
    ...(activeSegmentConfig.stages || []).filter(st => st && st.id && st.id !== 'ganado' && st.id !== 'perdido'),
    { id: 'ganado', label: '🎉 Ganado', orden: 998 },
    { id: 'perdido', label: '❌ Perdido', orden: 999 }
  ];

  const formConfigKey = `${opForm.tipoPipeline || 'adquisicion'}_${opForm.tipoServicio || 'default'}`;
  const formDefaultKey = `${opForm.tipoPipeline || 'adquisicion'}_default`;
  const activeFormConfig = pipelineConfigs[formConfigKey] || pipelineConfigs[formDefaultKey] || {
    formFields: ['nombre', 'clienteId', 'comercialEmail', 'montoEstimadoMensual', 'fechaEstimadaCierre', 'pais', 'notas']
  };
  const visibleFormFields = activeFormConfig.formFields || [];

  const isFieldRequired = (fieldName) => {
    const stageRules = activeFormConfig.gatekeeping?.[opForm.etapa] || [];
    return stageRules.includes(fieldName);
  };

  // Reset Op Form
  const resetForm = useCallback(() => {
    const firstStage = (activeStagesList && activeStagesList.length > 2) ? activeStagesList[0].id : 'diagnostico';

    setOpForm({
      clienteId: '',
      nombre: '',
      etapa: firstStage,
      montoEstimadoMensual: 5000,
      fechaEstimadaCierre: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      comercialEmail: user?.email || 'admin@luxia.com',
      pais: selectedCountry || 'AR',
      tipoPipeline: activePipelineFilter,
      tipoServicio: activeServiceFilter,
      notas: '',
      camposDinamicos: {}
    });
    setClientSearch('');
  }, [selectedCountry, activePipelineFilter, activeServiceFilter, activeStagesList, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let opQuery = supabase.from('oportunidades').select('*');
      if (selectedCountry) opQuery = opQuery.eq('pais', selectedCountry);
      opQuery = opQuery.order('created_at', { ascending: false });

      let clientQuery = supabase.from('clientes').select('*');
      if (selectedCountry) clientQuery = clientQuery.eq('pais', selectedCountry);

      const [opsRes, clientsRes, usersRes, secRes, camposRes, servRes] = await Promise.all([
        opQuery,
        clientQuery,
        supabase.from('usuarios').select('*'),
        supabase.from('config_secciones').select('*').eq('entidad', 'oportunidad').order('orden'),
        supabase.from('config_campos').select('*').order('orden'),
        supabase.from('config_servicios').select('*')
      ]);

      if (opsRes.data) {
        const mapped = opsRes.data.map(o => ({
          id: o.id,
          clienteId: o.cliente_id,
          nombre: o.nombre,
          etapa: o.etapa,
          montoEstimadoMensual: Number(o.monto_estimado_mensual) || 0,
          valorContratoAnual: Number(o.valor_contrato_anual) || 0,
          descuentoOfrecidoPct: Number(o.descuento_ofrecido_pct) || 0,
          contactoPrincipalId: o.contacto_principal_id,
          probabilidad: Number(o.probabilidad) || 0,
          fechaEstimadaCierre: o.fecha_estimada_cierre,
          fechaUltimoCambioEtapa: o.fecha_ultimo_cambio_etapa,
          competidorGanador: o.competidor_ganador,
          perdidaRazon: o.perdida_razon,
          perdidaDetalle: o.perdida_detalle,
          comercialEmail: o.comercial_email,
          pais: o.pais,
          tipoPipeline: o.tipo_pipeline,
          tipoServicio: o.tipo_servicio,
          camposDinamicos: o.campos_dinamicos || {},
          createdAt: o.created_at,
          updatedAt: o.updated_at,
          _triggerIA: o._trigger_ia
        }));
        setOportunidades(mapped);
      }

      if (clientsRes.data) {
        const mappedClients = clientsRes.data.map(c => ({
          id: c.id,
          nombreEmpresa: c.nombre_empresa,
          pais: c.pais,
          estado: c.estado,
          ...c
        }));
        setClientes(mappedClients);
      }

      if (usersRes.data) {
        const temp = {};
        usersRes.data.forEach(u => {
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

      if (secRes.data) setSecciones(secRes.data);
      if (camposRes.data) setCampos(camposRes.data);
      if (servRes.data) setServicios(servRes.data);

    } catch (err) {
      console.error("Error al cargar datos de oportunidades:", err);
      showAlert(`Error al cargar datos: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [selectedCountry, showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset manual analyzing state when IA completes
  useEffect(() => {
    if (analyzingOpId) {
      const currentOp = oportunidades.find(o => o.id === analyzingOpId);
      if (currentOp && !currentOp._triggerIA) {
        setAnalyzingOpId(null);
      }
    }
  }, [oportunidades, analyzingOpId]);

  const opFields = campos.filter(c => {
    if (c.seccionId) {
      const sec = secciones.find(s => s.id === c.seccionId);
      return !!sec;
    }
    return c.entidad === 'oportunidad';
  });

  const getStageProbability = (stage) => {
    if (stage === 'ganado') return 100;
    if (stage === 'perdido') return 0;

    // Buscar si está configurada en la lista de etapas activas
    const foundStage = activeStagesList.find(s => s.id === stage);
    if (foundStage && foundStage.probabilidad !== undefined && foundStage.probabilidad !== null && foundStage.probabilidad !== '') {
      return Number(foundStage.probabilidad);
    }

    const activeCustomStages = activeStagesList.filter(s => s.id !== 'ganado' && s.id !== 'perdido');
    const idx = activeCustomStages.findIndex(s => s.id === stage);
    if (idx !== -1) {
      if (activeCustomStages.length === 1) return 50;
      return Math.round(20 + (idx / (activeCustomStages.length - 1)) * 60);
    }

    switch (stage) {
      case 'diagnostico': return 20;
      case 'propuesta': return 50;
      case 'negociacion': return 80;
      default: return 50;
    }
  };

  const handleTriggerLuxiaIa = async (op) => {
    if (!hasPermission('disparar_ia')) return;
    setAnalyzingOpId(op.id);
    try {
      await supabase.from('oportunidades').update({
        _trigger_ia: true,
        _triggered_by: user?.email || 'admin@luxia.com'
      }).eq('id', op.id);
      showAlert('Auditoría de salud de oportunidad solicitada a LUXIA IA.', 'success');
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error al solicitar auditoría de salud de oportunidad.', 'danger');
    } finally {
      setAnalyzingOpId(null);
    }
  };

  const getStageLabel = (stage) => {
    const configured = activeStagesList.find(s => s.id === stage);
    if (configured) return configured.label;
    
    for (const segmentKey of Object.keys(pipelineConfigs)) {
      const segStages = pipelineConfigs[segmentKey]?.stages || [];
      const found = segStages.find(s => s.id === stage);
      if (found) return found.label;
    }

    switch (stage) {
      case 'diagnostico': return '📋 Diagnóstico';
      case 'propuesta': return '💡 Propuesta';
      case 'negociacion': return '🤝 Negociación';
      case 'ganado': return '🎉 Ganado';
      case 'perdido': return '❌ Perdido';
      default: return stage;
    }
  };

  const handleDragStart = (e, opId) => {
    if (!hasPermission('editar_oportunidad')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', opId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    if (!hasPermission('editar_oportunidad')) return;
    const opId = e.dataTransfer.getData('text/plain');
    if (!opId) return;

    const op = oportunidades.find(o => o.id === opId);
    if (!op || op.etapa === targetStage) return;

    setSelectedOportunidad(op);
    setTargetStageTemp(targetStage);

    // Validar Reglas de Gobernanza (Gatekeeping)
    if (targetStage !== 'ganado' && targetStage !== 'perdido') {
      const pipeline = op.tipoPipeline || 'adquisicion';
      const servicio = op.tipoServicio || 'default';
      const compositeKey = `${pipeline}_${servicio}`;
      const defaultKey = `${pipeline}_default`;
      
      const config = pipelineConfigs[compositeKey] || pipelineConfigs[defaultKey] || { gatekeeping: {} };
      const gatekeeping = config.gatekeeping || {};
      const requiredKeys = gatekeeping[targetStage] || [];
      const missing = [];
      const formInitValues = {};

      requiredKeys.forEach(key => {
        let value = undefined;
        if (['montoEstimadoMensual', 'fechaEstimadaCierre', 'comercialEmail'].includes(key)) {
          value = op[key];
        } else {
          value = (op.camposDinamicos || {})[key];
        }

        if (value === undefined || value === null || String(value).trim() === '') {
          let label = key;
          let fieldObj = undefined;
          if (key === 'montoEstimadoMensual') label = 'Monto Estimado Mensual ($)';
          else if (key === 'fechaEstimadaCierre') label = 'Fecha Estimada de Cierre';
          else if (key === 'comercialEmail') label = 'Comercial Asignado';
          else {
            fieldObj = campos.find(c => c.key === key || c.id === key);
            label = fieldObj ? fieldObj.nombre : key;
          }
          missing.push({ key, label, fieldObj });
          formInitValues[key] = '';
        }
      });

      if (missing.length > 0) {
        setGatekeepingMissingFields(missing);
        setGatekeepingFormValues(formInitValues);
        setGatekeepingClientSearch('');
        setShowGatekeepingModal(true);
        return; // Detener transición
      }
    }

    if (targetStage === 'perdido') {
      const defaultReason = pipelineConfigs?.lossReasons?.find(r => r.active !== false)?.id || 'precio';
      setLossForm({ perdidaRazon: defaultReason, perdidaDetalle: '' });
      setShowLossModal(true);
    } else if (targetStage === 'ganado') {
      setContractForm({
        tipoServicio: 'distribucion_regional',
        driveLink: '',
        fechaInicio: new Date().toISOString().substring(0, 10),
        fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        volumenMensualProyectado: op.montoEstimadoMensual || 1000,
        requiereIntegracion: false,
        modeloFacturacion: 'SaaS + Variable',
        moneda: 'USD'
      });
      setShowWinContractModal(true);
    } else {
      try {
        await supabase.from('oportunidades').update({
          etapa: targetStage,
          probabilidad: getStageProbability(targetStage),
          updated_at: new Date().toISOString(),
          _trigger_ia: true,
          _triggered_by: user?.email || 'admin@luxia.com'
        }).eq('id', opId);
        showAlert(`Oportunidad movida a ${getStageLabel(targetStage)}`, 'success');
        loadData();
      } catch (err) {
        console.error(err);
        showAlert('Error al actualizar etapa de la oportunidad.', 'danger');
      }
    }
  };

  const handleSaveGatekeepingAndMove = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updatedBase = {};
      const updatedDynamic = { ...(selectedOportunidad.camposDinamicos || {}) };

      Object.entries(gatekeepingFormValues).forEach(([key, val]) => {
        if (['montoEstimadoMensual', 'fechaEstimadaCierre', 'comercialEmail'].includes(key)) {
          if (key === 'montoEstimadoMensual') {
            updatedBase.monto_estimado_mensual = Number(val);
          } else if (key === 'fechaEstimadaCierre') {
            updatedBase.fecha_estimada_cierre = new Date(val).toISOString();
          } else {
            updatedBase.comercial_email = val;
          }
        } else {
          updatedDynamic[key] = val;
        }
      });

      const payload = {
        ...updatedBase,
        campos_dinamicos: updatedDynamic,
        etapa: targetStageTemp,
        probabilidad: getStageProbability(targetStageTemp),
        updated_at: new Date().toISOString(),
        _trigger_ia: true,
        _triggered_by: user?.email || 'admin@luxia.com'
      };

      const { error } = await supabase.from('oportunidades').update(payload).eq('id', selectedOportunidad.id);
      if (error) throw error;

      showAlert(`Campos actualizados y oportunidad movida a ${getStageLabel(targetStageTemp)}`, 'success');
      setShowGatekeepingModal(false);
      setSelectedOportunidad(null);
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error al guardar gobernanza de oportunidad.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpportunity = async (e) => {
    e.preventDefault();
    if (selectedOportunidad ? !hasPermission('editar_oportunidad') : !hasPermission('crear_oportunidad')) return;
    setSaving(true);
    try {
      const fechaCierreTS = opForm.fechaEstimadaCierre ? new Date(opForm.fechaEstimadaCierre).toISOString() : new Date().toISOString();
      const opCurrency = getCountryCurrencyLocal(opForm.pais);
      const rate = exchangeRates && exchangeRates[opCurrency] ? Number(exchangeRates[opCurrency]) : 1.0;
      const montoEstimado = Number(opForm.montoEstimadoMensual) || 0;
      const valorAnual = montoEstimado * 12;

      const payload = {
        cliente_id: opForm.clienteId,
        nombre: opForm.nombre,
        etapa: opForm.etapa,
        monto_estimado_mensual: montoEstimado,
        valor_contrato_anual: valorAnual,
        probabilidad: getStageProbability(opForm.etapa),
        fecha_estimada_cierre: fechaCierreTS,
        comercial_email: opForm.comercialEmail,
        pais: opForm.pais,
        tipo_pipeline: opForm.tipoPipeline,
        tipo_servicio: opForm.tipoServicio,
        campos_dinamicos: opForm.camposDinamicos,
        updated_at: new Date().toISOString()
      };

      if (selectedOportunidad) {
        const { error } = await supabase.from('oportunidades').update(payload).eq('id', selectedOportunidad.id);
        if (error) throw error;
        showAlert('Oportunidad actualizada correctamente', 'success');
      } else {
        const { error } = await supabase.from('oportunidades').insert(payload);
        if (error) throw error;
        showAlert('Oportunidad creada correctamente', 'success');
      }

      setShowCreateModal(false);
      setSelectedOportunidad(null);
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
      showAlert(`Error al guardar oportunidad: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLoss = async (e) => {
    e.preventDefault();
    if (!hasPermission('editar_oportunidad') || !selectedOportunidad) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('oportunidades').update({
        etapa: 'perdido',
        probabilidad: 0,
        perdida_razon: lossForm.perdidaRazon,
        perdida_detalle: lossForm.perdidaDetalle,
        updated_at: new Date().toISOString()
      }).eq('id', selectedOportunidad.id);

      if (error) throw error;

      showAlert('Oportunidad marcada como Perdida', 'warning');
      setShowLossModal(false);
      setSelectedOportunidad(null);
      loadData();
    } catch (err) {
      console.error(err);
      showAlert('Error al registrar pérdida de oportunidad.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWinAndContract = async (e) => {
    e.preventDefault();
    if (!hasPermission('editar_oportunidad') || !selectedOportunidad) return;
    setSaving(true);
    try {
      // 1. Actualizar estado de oportunidad a Ganado
      await supabase.from('oportunidades').update({
        etapa: 'ganado',
        probabilidad: 100,
        updated_at: new Date().toISOString()
      }).eq('id', selectedOportunidad.id);

      // 2. Cambiar fase del cliente en clientes a "Onboarding"
      if (selectedOportunidad.clienteId) {
        await supabase.from('clientes').update({
          estado: 'Onboarding',
          ultimo_cambio_estado: new Date().toISOString()
        }).eq('id', selectedOportunidad.clienteId);
      }

      // 3. Crear el contrato con vinculación a oportunidadId
      await supabase.from('contratos').insert({
        cliente_id: selectedOportunidad.clienteId,
        oportunidad_id: selectedOportunidad.id,
        tipo_servicio: contractForm.tipoServicio,
        monto: Number(selectedOportunidad.montoEstimadoMensual),
        moneda: contractForm.moneda,
        drive_link: contractForm.driveLink || null,
        fecha_inicio: contractForm.fechaInicio ? new Date(contractForm.fechaInicio).toISOString() : null,
        fecha_vencimiento: contractForm.fechaVencimiento ? new Date(contractForm.fechaVencimiento).toISOString() : null,
        volumen_minimo_garantizado: Number(contractForm.volumenMensualProyectado) || null,
        es_contrato_vigente: true,
        version_contrato: 1,
        estado_contrato: 'vigente',
        estado_sla: 'Vigente'
      });

      showAlert('Oportunidad Ganada. Contrato creado correctamente', 'success');
      setShowWinContractModal(false);
      setSelectedOportunidad(null);
      loadData();
    } catch (err) {
      console.error(err);
      showAlert(`Error al guardar acuerdo ganado: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (op) => {
    if (!hasPermission('editar_oportunidad') && !isLector && role !== 'editor') return;
    setSelectedOportunidad(op);
    setShowGestionModal(true);
  };

  // Filtrar oportunidades centralizadamente para Kanban, Dashboard y KPIs
  const filteredOps = useMemo(() => {
    return oportunidades.filter(o => {
      // 1. Filtrar por tipo de pipeline
      if (o.tipoPipeline !== activePipelineFilter) return false;
      
      // 2. Filtrar por línea de producto / servicio del catálogo
      if (activeServiceFilter !== 'default' && activeServiceFilter !== 'todos' && activeServiceFilter !== '') {
        const opSvc = o.tipoServicio || o.camposDinamicos?.linea_producto || o.camposDinamicos?.tipo_servicio;
        if (opSvc !== activeServiceFilter) return false;
      }

      // 3. Restricción de equipo y rol
      if (oportunidadesScope !== 'ALL') {
        if (oportunidadesScope === 'OWN') {
          const isSelf = o.comercialEmail && o.comercialEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim();
          if (!isSelf) return false;
        } else if (oportunidadesScope === 'TEAM') {
          const isSelf = o.comercialEmail && o.comercialEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim();
          if (!isSelf) {
            const asignadoUser = usuarios.find(u => u.email?.toLowerCase().trim() === o.comercialEmail?.toLowerCase().trim());
            if (!asignadoUser || normalizarEquipo(asignadoUser.equipo) !== normalizedTeam) return false;
          }
        } else {
          return false; // NONE
        }
      }

      // 4. Filtrar por rango de fechas
      if (filterFecha && filterFecha !== 'all') {
        const now = new Date();
        if (filterFecha.startsWith('cierre_')) {
          if (!o.fechaEstimadaCierre) return false;
          const date = o.fechaEstimadaCierre.toDate ? o.fechaEstimadaCierre.toDate() : new Date(o.fechaEstimadaCierre);
          if (filterFecha === 'cierre_hoy') {
            if (date.toDateString() !== now.toDateString()) return false;
          } else if (filterFecha === 'cierre_semana') {
            const sevenDaysAhead = new Date();
            sevenDaysAhead.setDate(now.getDate() + 7);
            if (date < now || date > sevenDaysAhead) return false;
          } else if (filterFecha === 'cierre_mes') {
            const thirtyDaysAhead = new Date();
            thirtyDaysAhead.setDate(now.getDate() + 30);
            if (date < now || date > thirtyDaysAhead) return false;
          }
        } else if (filterFecha.startsWith('creado_')) {
          const createdDateVal = o.createdAt || o.fechaInicio;
          if (!createdDateVal) return false;
          const date = createdDateVal.toDate ? createdDateVal.toDate() : new Date(createdDateVal);
          if (filterFecha === 'creado_hoy') {
            if (date.toDateString() !== now.toDateString()) return false;
          } else if (filterFecha === 'creado_semana') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            if (date < sevenDaysAgo || date > now) return false;
          } else if (filterFecha === 'creado_mes') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            if (date < thirtyDaysAgo || date > now) return false;
          }
        }
      }

      // 5. Filtrar por buscador de texto
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const client = clientes.find(c => c.id === o.clienteId);
        const matchNombre = o.nombre?.toLowerCase().includes(queryLower);
        const matchEmpresa = client?.nombreEmpresa?.toLowerCase().includes(queryLower);
        const matchComercial = o.comercialEmail?.toLowerCase().includes(queryLower);
        if (!matchNombre && !matchEmpresa && !matchComercial) return false;
      }

      return true;
    });
  }, [oportunidades, activePipelineFilter, activeServiceFilter, oportunidadesScope, role, normalizedTeam, filterFecha, searchQuery, clientes, usuarios]);

  // Metrics Calculations
  const metrics = useMemo(() => {
    let totalUSD = 0;
    let ponderadoUSD = 0;
    let count = 0;

    const getCountryCurrencyLocal = (country) => {
      switch (country) {
        case 'AR': return 'ARS';
        case 'CL': return 'CLP';
        case 'PE': return 'PEN';
        case 'CO': return 'COP';
        case 'MX': return 'MXN';
        default: return 'USD';
      }
    };

    const selectedCurrency = selectedCountry ? getCountryCurrencyLocal(selectedCountry) : null;

    filteredOps.forEach(o => {
      if (o.etapa !== 'ganado' && o.etapa !== 'perdido') {
        const amount = o.montoEstimadoMensual || 0;
        const opCurrency = o.moneda || getCountryCurrencyLocal(o.pais);
        
        let amountUSD = 0;
        if (o.montoUSD) {
          amountUSD = o.montoUSD;
        } else {
          const rateToUSD = exchangeRates[opCurrency] || 1;
          amountUSD = amount / rateToUSD;
        }

        const prob = getStageProbability(o.etapa);
        totalUSD += amountUSD;
        ponderadoUSD += (amountUSD * prob) / 100;
        count++;
      }
    });

    let totalLocal = 0;
    let ponderadoLocal = 0;
    if (selectedCurrency) {
      const rateToLocal = exchangeRates[selectedCurrency] || 1;
      totalLocal = totalUSD * rateToLocal;
      ponderadoLocal = ponderadoUSD * rateToLocal;
    }

    return { totalUSD, ponderadoUSD, totalLocal, ponderadoLocal, count, selectedCurrency };
  }, [filteredOps, selectedCountry, exchangeRates]);

  const renderKanbanColumn = (stageKey) => {
    const stageOps = filteredOps.filter(o => o.etapa === stageKey);
    
    // Sort deals inside the column by last updated
    stageOps.sort((a, b) => {
      const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
      const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
      return dateB - dateA;
    });

    const isClosedStage = stageKey === 'ganado' || stageKey === 'perdido';
    const visibleOps = isClosedStage ? stageOps.slice(0, 15) : stageOps;

    const getCountryCurrencyLocal = (country) => {
      switch (country) {
        case 'AR': return 'ARS';
        case 'CL': return 'CLP';
        case 'PE': return 'PEN';
        case 'CO': return 'COP';
        case 'MX': return 'MXN';
        default: return 'USD';
      }
    };

    const selectedCurrency = selectedCountry ? getCountryCurrencyLocal(selectedCountry) : null;

    // Calcular suma en USD y moneda local
    const totalUSD = stageOps.reduce((acc, curr) => {
      const amount = curr.montoEstimadoMensual || 0;
      const opCurrency = curr.moneda || getCountryCurrencyLocal(curr.pais);
      const rateToUSD = exchangeRates[opCurrency] || 1;
      const amountUSD = amount / rateToUSD;
      return acc + amountUSD;
    }, 0);

    let totalLocal = 0;
    if (selectedCurrency) {
      const rateToLocal = exchangeRates[selectedCurrency] || 1;
      totalLocal = totalUSD * rateToLocal;
    }

    return (
      <div 
        className="col-lg col-md-6 mb-4 d-flex flex-column h-100" 
        style={{ minWidth: '260px' }}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, stageKey)}
        key={stageKey}
      >
        <div className="apple-card p-3 h-100 d-flex flex-column" style={{ minHeight: '560px', backgroundColor: 'var(--apple-surface)' }}>
          <div className="d-flex justify-content-between align-items-center mb-2.5">
            <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.92rem' }}>{getStageLabel(stageKey)}</h6>
            <span className="apple-badge apple-badge-neutral">
              {stageOps.length}
            </span>
          </div>
          <div className="small fw-semibold mb-3 pb-2 border-bottom" style={{ color: 'var(--apple-text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '0.76rem', borderColor: 'var(--apple-border)' }} title={`Volumen: $${Math.round(totalUSD).toLocaleString()} USD${selectedCurrency ? ` / $${Math.round(totalLocal).toLocaleString()} ${selectedCurrency}` : ''}`}>
            Volumen: ${Math.round(totalUSD).toLocaleString()} USD {selectedCurrency && `/ $${Math.round(totalLocal).toLocaleString()} ${selectedCurrency}`}
          </div>
          
          {isClosedStage && stageOps.length > 15 && (
            <div className="text-center small py-2 rounded-3 mb-2 border border-dashed" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)', borderColor: 'var(--apple-border)' }}>
              Mostrando 15 de {stageOps.length} cierres recientes
            </div>
          )}

          <div className="flex-grow-1 overflow-auto scrollbar-hidden d-flex flex-column gap-2.5" style={{ maxHeight: '500px' }}>
            {visibleOps.map(op => {
              const client = clientes.find(c => c.id === op.clienteId);
              return (
                <div 
                  className="apple-card apple-card-hover p-3 cursor-grab"
                  style={{ backgroundColor: 'var(--apple-surface-elevated)' }}
                  draggable={hasPermission('editar_oportunidad')}
                  onDragStart={(e) => handleDragStart(e, op.id)}
                  onClick={() => handleEditClick(op)}
                  key={op.id}
                >
                  <div className="d-flex justify-content-between mb-1.5 align-items-center">
                    <div className="d-flex align-items-center gap-1.5">
                      <span className="apple-badge apple-badge-blue" style={{ fontSize: '0.68rem' }}>
                        Prob: {op.probabilidad}%
                      </span>
                      {op.calificacionIA && (
                        <span className="badge rounded-pill px-1.5 py-0.5 d-inline-flex align-items-center gap-1" style={{ 
                          fontSize: '0.65rem',
                          background: op.calificacionIA.prioridad === 'Green' ? 'rgba(25, 135, 84, 0.08)' : op.calificacionIA.prioridad === 'Yellow' ? 'rgba(255, 193, 7, 0.08)' : 'rgba(220, 53, 69, 0.08)',
                          color: op.calificacionIA.prioridad === 'Green' ? '#198754' : op.calificacionIA.prioridad === 'Yellow' ? '#b25e00' : '#dc3545',
                          border: '1px solid currentColor'
                        }} title={`LUXIA IA Score: ${op.calificacionIA.score}/100`}>
                          <span className="dot-indicator" style={{ width: '4px', height: '4px', backgroundColor: 'currentColor', boxShadow: 'none' }}></span>
                          {op.calificacionIA.score}
                        </span>
                      )}
                    </div>
                    <span className="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-1.5 py-0.5" style={{ fontSize: '0.65rem' }}>
                      {op.pais}
                    </span>
                  </div>
                  <h6 className="fw-bold text-dark text-truncate mb-1">{op.nombre}</h6>
                  <div className="d-flex align-items-center justify-content-between gap-1 mb-2">
                    <span className="small text-muted text-truncate">
                      <i className="bi bi-building me-1"></i> {client ? client.nombreEmpresa : 'Empresa Externa'}
                    </span>
                    {(() => {
                      const svcKey = op.tipoServicio || op.camposDinamicos?.linea_producto || op.camposDinamicos?.tipo_servicio;
                      if (!svcKey || svcKey === 'default') return null;
                      const svcObj = servicios.find(s => s.id === svcKey);
                      return (
                        <span 
                          className="badge rounded-pill px-2 py-0.5 text-truncate"
                          style={{
                            fontSize: '0.62rem',
                            backgroundColor: 'var(--luxia-brand-light, rgba(150, 31, 128, 0.1))',
                            color: 'var(--luxia-brand, #961f80)',
                            border: '1px solid var(--luxia-brand-border, rgba(150, 31, 128, 0.2))',
                            maxWidth: '120px'
                          }}
                          title={svcObj ? svcObj.nombre : svcKey}
                        >
                          <i className="bi bi-box-seam me-1"></i>
                          {svcObj ? svcObj.nombre : svcKey}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-light">
                    {(() => {
                      const opCurrency = op.moneda || getCountryCurrencyLocal(op.pais);
                      const rate = op.tipoCambioUSD || exchangeRates[opCurrency] || 1;
                      const amountUsd = op.montoUSD !== undefined && op.montoUSD !== null && op.montoUSD > 0 
                        ? op.montoUSD 
                        : (op.montoEstimadoMensual || 0) / rate;

                      if (selectedCountry) {
                        const targetCurrency = getCountryCurrencyLocal(selectedCountry);
                        const rateLocal = exchangeRates[targetCurrency] || 1;
                        const amountLocal = amountUsd * rateLocal;
                        return (
                          <span className="fw-bold text-primary small" style={{ fontSize: '0.72rem' }} title={`${opCurrency} ${(op.montoEstimadoMensual || 0).toLocaleString()}`}>
                            ${Math.round(amountLocal).toLocaleString()} {targetCurrency} / ${Math.round(amountUsd).toLocaleString()} USD
                          </span>
                        );
                      } else {
                        return (
                          <span className="fw-bold text-primary small" title={`${opCurrency} ${(op.montoEstimadoMensual || 0).toLocaleString()}`}>
                            ${Math.round(amountUsd).toLocaleString()} USD
                          </span>
                        );
                      }
                    })()}
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      <i className="bi bi-calendar-event me-1"></i> {op.fechaEstimadaCierre?.toDate ? op.fechaEstimadaCierre.toDate().toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              );
            })}
            {visibleOps.length === 0 && (
              <div className="text-center text-muted py-5 my-auto small border border-light border-dashed rounded-3 bg-white bg-opacity-25">
                Arrastra aquí
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const [activeMainTab, setActiveMainTab] = useState('kanban'); // 'kanban' o 'dashboard'

  return (
    <div className="animate__animated animate__fadeIn">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <div>
            <h4 className="fw-bold mb-1 text-dark" style={{ fontFamily: "'Outfit', sans-serif" }}>
              <i className="bi bi-bar-chart-steps text-info me-2"></i>Pipeline de Ventas
            </h4>
            <p className="text-muted mb-0 small">Controla el embudo de ventas, negocia SLAs y proyecta el volumen de facturación.</p>
          </div>

          {/* Pill Switch Toggle (Metodologia Tablero CRM) */}
          <div className="btn-group bg-light p-1 rounded-pill shadow-sm border ms-2">
            <button
              className={`btn btn-xs rounded-pill px-3 py-1 fw-bold border-0 transition-all ${activeMainTab === 'kanban' ? 'bg-primary text-white shadow-sm' : 'text-muted'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setActiveMainTab('kanban')}
            >
              <i className="bi bi-kanban me-1"></i> Kanban Ventas
            </button>
            <button
              className={`btn btn-xs rounded-pill px-3 py-1 fw-bold border-0 transition-all ${activeMainTab === 'dashboard' ? 'bg-primary text-white shadow-sm' : 'text-muted'}`}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setActiveMainTab('dashboard')}
            >
              <i className="bi bi-graph-up me-1"></i> Dashboard Ventas
            </button>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          {hasPermission('actions', 'exportar_oportunidades') && (
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
            className="btn btn-primary rounded-pill px-4 shadow-sm"
            onClick={() => { setSelectedOportunidad(null); resetForm(); setShowCreateModal(true); }}
            disabled={!hasPermission('crear_oportunidad')}
          >
            <i className="bi bi-plus-lg me-2"></i>Nueva Oportunidad
          </button>
        </div>
      </div>

      {activeMainTab === 'dashboard' ? (
        <div className="glass-panel p-4 rounded-4 border bg-white shadow-sm mb-4">
          <h5 className="fw-bold mb-3 text-dark">Dashboard Operativo de Ventas & Pipeline</h5>
          <SalesOperationalDashboard
            oportunidades={filteredOps}
            comerciales={usuarios}
            isAgent={role === 'agente'}
            currentUserEmail={user?.email}
            isRestricted={isRestricted}
            role={role}
            userTeam={userTeam}
          />
        </div>
      ) : (
        <>

      {iaPausada && (
        <div className="alert alert-warning py-3 px-4 rounded-4 mb-4 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center gap-3">
          <i className="bi bi-robot fs-4 text-warning animate-pulse"></i>
          <div className="text-start">
            <h6 className="fw-bold mb-1">LUXIA IA en Mantenimiento</h6>
            <p className="mb-0 small text-muted-opacity">El motor inteligente de LUXIA IA ha sido pausado por la administración. Durante este periodo, las oportunidades se podrán crear y editar, pero el score de salud automatizado y la auditoría de riesgos no estarán disponibles en tiempo real.</p>
          </div>
        </div>
      )}

      {/* Segment and Service Selection Bar */}
      <div className="row g-3 mb-4 align-items-center bg-white p-3 rounded-4 shadow-sm border border-light">
        <div className="col-md-3 col-sm-12 text-start">
          <label className="form-label small fw-bold text-muted mb-1">
            <i className="bi bi-search me-1"></i>Buscador
          </label>
          <div className="filter-search-wrapper">
            <i className="bi bi-search filter-search-icon"></i>
            <input 
              type="text" 
              className="filter-search-input" 
              placeholder="Buscar por empresa, negocio, contacto o correo..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="filter-search-clear" 
                onClick={() => setSearchQuery('')} 
                aria-label="Limpiar búsqueda"
              >
                <i className="bi bi-x-circle-fill"></i>
              </button>
            )}
          </div>
        </div>
        <div className="col-md-2 col-sm-6 text-start">
          <label className="form-label small fw-bold text-muted mb-1"><i className="bi bi-funnel me-1"></i>Pipeline (División)</label>
          <select 
            className="form-select rounded-pill px-3 shadow-xs" 
            value={activePipelineFilter}
            onChange={(e) => setActivePipelineFilter(e.target.value)}
            disabled={isRestricted}
          >
            <option value="adquisicion">🌱 Adquisición</option>
            <option value="retencion">🌳 Retención</option>
          </select>
        </div>
        <div className="col-md-2 col-sm-6 text-start">
          <label className="form-label small fw-bold text-muted mb-1"><i className="bi bi-box-seam me-1"></i>Línea de Producto</label>
          <select 
            className="form-select rounded-pill px-3 shadow-xs" 
            value={activeServiceFilter}
            onChange={(e) => setActiveServiceFilter(e.target.value)}
          >
            <option value="default">Todas las Líneas</option>
            {servicios.map(s => (
              <option key={s.id} value={s.id}>{s.nombre || s.id}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2 col-sm-12 text-start">
          <label className="form-label small fw-bold text-muted mb-1">
            <i className="bi bi-calendar3 me-1"></i>Rango de Fechas
          </label>
          <select 
            className="form-select rounded-pill px-3 shadow-xs" 
            value={filterFecha}
            onChange={(e) => setFilterFecha(e.target.value)}
          >
            <option value="all">Cualquier Fecha</option>
            <option value="cierre_hoy">📅 Cierre: Hoy</option>
            <option value="cierre_semana">📅 Cierre: Próximos 7 Días</option>
            <option value="cierre_mes">📅 Cierre: Próximos 30 Días</option>
            <option value="creado_hoy">🌱 Creado: Hoy</option>
            <option value="creado_semana">🌱 Creado: Últimos 7 Días</option>
            <option value="creado_mes">🌱 Creado: Últimos 30 Días</option>
          </select>
        </div>
        <div className="col-md-3 col-sm-12 text-start">
          <label className="form-label small fw-bold text-muted mb-1">
            <i className="bi bi-clock-history me-1"></i>Historial Ganados/Perdidos
          </label>
          <select 
            className="form-select rounded-pill px-3 shadow-xs" 
            value={rangoCerradas}
            onChange={(e) => setRangoCerradas(e.target.value)}
          >
            <option value="30d">Últimos 30 Días (Predeterminado)</option>
            <option value="6m">Últimos 6 Meses</option>
            <option value="todos">Todo el Histórico</option>
          </select>
        </div>
      </div>

      {/* Apple Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="kpi-card-ambient kpi-glow-blue h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Oportunidades Activas</span>
              <div className="kpi-icon-badge kpi-icon-blue"><i className="bi bi-briefcase-fill"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-text-primary)', letterSpacing: '-0.02em' }}>
              {metrics.count} <span className="small fw-normal" style={{ fontSize: '0.82rem', color: 'var(--apple-text-secondary)' }}>negociaciones</span>
            </h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="kpi-card-ambient kpi-glow-teal h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Valor Total del Pipeline</span>
              <div className="kpi-icon-badge kpi-icon-teal"><i className="bi bi-cash-stack"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: metrics.selectedCurrency ? '1.35rem' : '1.75rem', color: 'var(--apple-text-primary)', letterSpacing: '-0.02em' }}>
              {metrics.selectedCurrency ? (
                <>
                  ${Math.round(metrics.totalLocal).toLocaleString()} {metrics.selectedCurrency}{' '}
                  <span className="mx-1" style={{ color: 'var(--apple-text-tertiary)', fontSize: '0.85rem' }}>/</span>{' '}
                  <span className="fw-semibold" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.95rem' }}>${Math.round(metrics.totalUSD).toLocaleString()} USD</span>
                </>
              ) : (
                <>${Math.round(metrics.totalUSD).toLocaleString()} <span className="small fw-normal" style={{ fontSize: '0.82rem', color: 'var(--apple-text-secondary)' }}>USD/mes</span></>
              )}
            </h3>
          </div>
        </div>
        <div className="col-md-4">
          <div className="kpi-card-ambient kpi-glow-green h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Valor Ponderado (Forecast)</span>
              <div className="kpi-icon-badge kpi-icon-green"><i className="bi bi-graph-up-arrow"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: metrics.selectedCurrency ? '1.35rem' : '1.75rem', color: 'var(--apple-green)', letterSpacing: '-0.02em' }}>
              {metrics.selectedCurrency ? (
                <>
                  ${Math.round(metrics.ponderadoLocal).toLocaleString()} {metrics.selectedCurrency}{' '}
                  <span className="mx-1" style={{ color: 'var(--apple-text-tertiary)', fontSize: '0.85rem' }}>/</span>{' '}
                  <span className="fw-semibold" style={{ fontSize: '0.95rem', color: 'var(--apple-green)' }}>${Math.round(metrics.ponderadoUSD).toLocaleString()} USD</span>
                </>
              ) : (
                <>${Math.round(metrics.ponderadoUSD).toLocaleString()} <span className="small fw-normal" style={{ fontSize: '0.82rem', color: 'var(--apple-text-secondary)' }}>USD/mes</span></>
              )}
            </h3>
          </div>
        </div>
      </div>


      {/* Kanban Board Container */}
      <div className="row flex-nowrap overflow-auto scrollbar-hidden pb-3">

        {activeStagesList.map(st => renderKanbanColumn(st.id))}
      </div>
      </>
      )}

      {/* Modal Crear Oportunidad */}
      {showCreateModal && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Nueva Oportunidad</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>

              <form onSubmit={handleSaveOpportunity}>
                <div className="modal-body px-4 py-3">
                  <div className="row g-3">
                    {/* Selectores de Pipeline y Servicio (Siempre Visibles) */}
                    <div className="col-md-6 text-start">
                      <label className="form-label small fw-bold mb-1">Pipeline (División Comercial)</label>
                      <select 
                        className="form-select text-start" 
                        required
                        value={opForm.tipoPipeline || 'adquisicion'} 
                        onChange={e => setOpForm({ ...opForm, tipoPipeline: e.target.value })}
                      >
                        <option value="adquisicion">División: Adquisición</option>
                        <option value="retencion">División: Retención</option>
                      </select>
                    </div>
                    <div className="col-md-6 text-start">
                      <label className="form-label small fw-bold mb-1">Etapa de la Venta</label>
                      <select 
                        className="form-select text-start" 
                        value={opForm.etapa} 
                        onChange={e => setOpForm({ ...opForm, etapa: e.target.value })}
                      >
                        {activeStagesList.map(st => (
                          <option key={st.id} value={st.id}>{st.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campos Dinámicamente Visibles según Configuración */}
                    {visibleFormFields.includes('nombre') && (
                      <div className="col-md-6 text-start">
                        <label className="form-label small fw-bold mb-1">Nombre Comercial de la Oportunidad</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          required={isFieldRequired('nombre')} 
                          placeholder="ej: Provisión Herbicidas - Campaña 2026/27"
                          value={opForm.nombre} 
                          onChange={e => setOpForm({ ...opForm, nombre: e.target.value })} 
                        />
                      </div>
                    )}

                    {visibleFormFields.includes('clienteId') && (
                      <div className="col-md-6 text-start position-relative">
                        <label className="form-label small fw-bold mb-1">Asociar a Cliente (Empresa)</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          required={isFieldRequired('clienteId')}
                          placeholder="Buscar y seleccionar empresa..." 
                          value={clientSearch}
                          onChange={e => {
                            setClientSearch(e.target.value);
                            setShowClientDropdown(true);
                            if (!e.target.value) {
                              setOpForm({ ...opForm, clienteId: '' });
                            }
                          }}
                          onFocus={() => setShowClientDropdown(true)}
                          onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                        />
                        {showClientDropdown && (
                          <div className="dropdown-menu show w-100 position-absolute border-secondary-subtle" style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1050 }}>
                            {clientes
                              .filter(c => c.nombreEmpresa?.toLowerCase().includes(clientSearch.toLowerCase()))
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="dropdown-item text-start"
                                  onClick={() => {
                                    setOpForm({ ...opForm, clienteId: c.id });
                                    setClientSearch(c.nombreEmpresa);
                                    setShowClientDropdown(false);
                                  }}
                                >
                                  {c.nombreEmpresa}
                                </button>
                              ))}
                            {clientes.filter(c => c.nombreEmpresa?.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                              <div className="dropdown-item disabled text-muted">No se encontraron empresas</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {visibleFormFields.includes('comercialEmail') && (
                      <div className="col-md-6 text-start">
                        <label className="form-label small fw-bold mb-1">Comercial Asignado</label>
                        <select 
                          className="form-select text-start" 
                          required={isFieldRequired('comercialEmail')}
                          value={opForm.comercialEmail} 
                          onChange={e => setOpForm({ ...opForm, comercialEmail: e.target.value })}
                        >
                          <option value="">Seleccionar Comercial...</option>
                          {usuarios
                            .filter(u => u.equipo === 'Adquisicion' || u.equipo === 'Retencion')
                            .map(u => (
                              <option key={u.email} value={u.email}>{u.nombre} ({u.equipo === 'Adquisicion' ? 'Adquisición' : 'Retención'})</option>
                            ))}
                        </select>
                      </div>
                    )}

                    {visibleFormFields.includes('montoEstimadoMensual') && (
                      <div className="col-md-6 text-start">
                        <label className="form-label small fw-bold mb-1">Monto Mensual Estimado ({getCountryCurrencyLocal(opForm.pais)})</label>
                        <div className="input-group">
                          <span className="input-group-text">{getCountryCurrencyLocal(opForm.pais)}</span>
                          <input 
                            type="number" 
                            className="form-control" 
                            required={isFieldRequired('montoEstimadoMensual')} 
                            value={opForm.montoEstimadoMensual} 
                            onChange={e => setOpForm({ ...opForm, montoEstimadoMensual: e.target.value })} 
                          />
                        </div>
                      </div>
                    )}

                    {visibleFormFields.includes('fechaEstimadaCierre') && (
                      <div className="col-md-6 text-start">
                        <label className="form-label small fw-bold mb-1">Fecha Estimada de Cierre</label>
                        <input 
                          type="date" 
                          className="form-control" 
                          required={isFieldRequired('fechaEstimadaCierre')} 
                          value={opForm.fechaEstimadaCierre} 
                          onChange={e => setOpForm({ ...opForm, fechaEstimadaCierre: e.target.value })} 
                        />
                      </div>
                    )}

                    {visibleFormFields.includes('pais') && (
                      <div className="col-md-6 text-start">
                        <label className="form-label small fw-bold mb-1">País Operativo</label>
                        <select 
                          className="form-select text-start" 
                          required={isFieldRequired('pais')}
                          value={opForm.pais} 
                          onChange={e => setOpForm({ ...opForm, pais: e.target.value })}
                        >
                          <option value="AR">Argentina</option>
                          <option value="CL">Chile</option>
                          <option value="PE">Perú</option>
                          <option value="CO">Colombia</option>
                          <option value="MX">México</option>
                        </select>
                      </div>
                    )}

                    <div className="col-md-6 text-start">
                      <label className="form-label small fw-bold mb-1">
                        <i className="bi bi-box-seam me-1 text-primary"></i>Línea de Producto / Catálogo
                      </label>
                      <select 
                        className="form-select text-start" 
                        value={opForm.tipoServicio} 
                        onChange={e => setOpForm({ ...opForm, tipoServicio: e.target.value })}
                      >
                        <option value="default">-- Seleccionar Línea de Producto --</option>
                        {servicios.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre || s.id}</option>
                        ))}
                      </select>
                    </div>

                    {visibleFormFields.includes('notas') && (
                      <div className="col-12 text-start">
                        <label className="form-label small fw-bold mb-1">Notas de Seguimiento / Bitácora</label>
                        <textarea 
                          className="form-control" 
                          rows="3" 
                          required={isFieldRequired('notas')}
                          placeholder="Registra avances, hectáreas proyectadas, cultivo objetivo, condiciones comerciales o comentarios de campo..."
                          value={opForm.notas} 
                          onChange={e => setOpForm({ ...opForm, notas: e.target.value })}
                        ></textarea>
                      </div>
                    )}
                  </div>

                  {/* IA y auditorías movidas a modal de gestión */}

                  {/* Render Dynamic Fields */}
                  {secciones.map(sec => {
                    const camposSec = opFields.filter(c => c.seccionId === sec.id && visibleFormFields.includes(c.key || c.id));
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
                              value={opForm.camposDinamicos[campo.key] || ''} 
                              onChange={val => setOpForm({
                                ...opForm,
                                camposDinamicos: { ...opForm.camposDinamicos, [campo.key]: val }
                              })}
                              clientId={selectedOportunidad?.id || 'temp'}
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
                    {saving ? 'Guardando...' : 'Crear Oportunidad'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cierre Perdido */}
      {showLossModal && selectedOportunidad && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title text-danger"><i className="bi bi-x-circle-fill me-2"></i>Registrar Cierre Perdido</h5>
                <button type="button" className="btn-close" onClick={() => { setShowLossModal(false); setSelectedOportunidad(null); }}></button>
              </div>
              <form onSubmit={handleSaveLoss}>
                <div className="modal-body px-4 py-3">
                  <p className="small text-muted">Documenta el motivo por el cual la oportunidad <strong>{selectedOportunidad.nombre}</strong> no se pudo concretar.</p>
                  
                  <div className="mb-3">
                    <label className="form-label small fw-bold mb-1">Motivo Principal de Pérdida</label>
                    <select 
                      className="form-select" 
                      value={lossForm.perdidaRazon}
                      onChange={e => setLossForm({ ...lossForm, perdidaRazon: e.target.value })}
                    >
                      {(Array.isArray(pipelineConfigs?.lossReasons) && pipelineConfigs.lossReasons.length > 0
                        ? pipelineConfigs.lossReasons.filter(r => r.active !== false)
                        : [
                            { id: 'precio', label: '💵 Precio elevado' },
                            { id: 'cobertura', label: '📍 Falta de cobertura / alcance' },
                            { id: 'competencia', label: '🛡️ Competencia ganó el negocio' },
                            { id: 'tecnologia', label: '⚙️ Limitación tecnológica / de integraciones' },
                            { id: 'otro', label: '❓ Otro motivo' }
                          ]
                      ).map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold mb-1">Detalles adicionales</label>
                    <textarea 
                      className="form-control" 
                      rows="3" 
                      placeholder="Escribe más detalles..." 
                      required
                      value={lossForm.perdidaDetalle}
                      onChange={e => setLossForm({ ...lossForm, perdidaDetalle: e.target.value })}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer px-4 py-3">
                  <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-semibold" onClick={() => { setShowLossModal(false); setSelectedOportunidad(null); }}>Cancelar</button>
                  <button type="submit" className="btn btn-danger rounded-pill px-4 fw-bold shadow-sm" disabled={saving}>
                    {saving ? 'Guardando...' : 'Confirmar Cierre Perdido'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cierre Ganado y Contrato */}
      {showWinContractModal && selectedOportunidad && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title text-success"><i className="bi bi-trophy-fill me-2"></i>Cierre Ganado: Generar Contrato y Onboarding</h5>
                <button type="button" className="btn-close" onClick={() => { setShowWinContractModal(false); setSelectedOportunidad(null); }}></button>
              </div>
              <form onSubmit={handleSaveWinAndContract}>
                <div className="modal-body px-4 py-3" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                  <div className="alert alert-success d-flex align-items-center small mb-4">
                    <i className="bi bi-check-circle-fill me-2 fs-5"></i>
                    Al confirmar, el cliente pasará automáticamente a fase <strong>Onboarding</strong> y se configurará su checklist de activación.
                  </div>

                  <h6 className="fw-bold border-bottom pb-2 mb-3 text-dark">Detalles del Contrato</h6>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Tipo de Solución / Servicio B2B</label>
                      <select 
                        className="form-select" 
                        value={contractForm.tipoServicio}
                        onChange={e => setContractForm({ ...contractForm, tipoServicio: e.target.value })}
                      >
                        <option value="saas_enterprise">SaaS Enterprise Core</option>
                        <option value="servicios_profesionales">Servicios Profesionales / Consultoría</option>
                        <option value="infraestructura_plataforma">Infraestructura & Plataforma Cloud</option>
                        <option value="soporte_sla_premium">Soporte & SLA Premium</option>
                        <option value="solucion_custom">Solución a Medida (Custom)</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Modelo de Facturación</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="ej: Suscripción Mensual + Consumo Variable / Tier"
                        required 
                        value={contractForm.modeloFacturacion}
                        onChange={e => setContractForm({ ...contractForm, modeloFacturacion: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Fecha de Inicio del Servicio</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        required 
                        value={contractForm.fechaInicio}
                        onChange={e => setContractForm({ ...contractForm, fechaInicio: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Fecha de Vencimiento de Contrato</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        required 
                        value={contractForm.fechaVencimiento}
                        onChange={e => setContractForm({ ...contractForm, fechaVencimiento: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Moneda de Facturación</label>
                      <select 
                        className="form-select" 
                        value={contractForm.moneda}
                        onChange={e => setContractForm({ ...contractForm, moneda: e.target.value })}
                      >
                        <option value="USD">Dólares Americanos (USD)</option>
                        <option value="ARS">Pesos Argentinos (ARS)</option>
                        <option value="CLP">Pesos Chilenos (CLP)</option>
                        <option value="COP">Pesos Colombianos (COP)</option>
                        <option value="PEN">Soles Peruanos (PEN)</option>
                        <option value="MXN">Pesos Mexicanos (MXN)</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1">Volumen / Consumo Proyectado/mes</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        placeholder="Ej. 1000"
                        required 
                        value={contractForm.volumenMensualProyectado}
                        onChange={e => setContractForm({ ...contractForm, volumenMensualProyectado: e.target.value })}
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-bold mb-1">Carpeta de Google Drive (Link de Respaldo)</label>
                      <input 
                        type="url" 
                        className="form-control" 
                        placeholder="https://drive.google.com/..." 
                        value={contractForm.driveLink}
                        onChange={e => setContractForm({ ...contractForm, driveLink: e.target.value })}
                      />
                    </div>
                    <div className="col-12 mt-3">
                      <div className="form-check form-switch bg-light p-3 rounded-3 border">
                        <input 
                          className="form-check-input ms-0 me-2" 
                          type="checkbox" 
                          id="requiereIntegracion" 
                          checked={contractForm.requiereIntegracion}
                          onChange={e => setContractForm({ ...contractForm, requiereIntegracion: e.target.checked })}
                        />
                        <label className="form-check-label fw-bold text-dark" htmlFor="requiereIntegracion">¿Requiere Integración de Sistemas (API/ERP)?</label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light border-top-0 px-4 py-3">
                  <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-semibold" onClick={() => { setShowWinContractModal(false); setSelectedOportunidad(null); }}>Cancelar</button>
                  <button type="submit" className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" disabled={saving}>
                    {saving ? 'Cerrando Negocio...' : 'Confirmar Cierre Ganado'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Validación de Gobernanza (Gatekeeping) */}
      {showGatekeepingModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-bottom-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-shield-lock-fill text-warning me-2"></i>Gobernanza de Pipeline
                </h5>
                <button type="button" className="btn-close" onClick={() => {
                  setShowGatekeepingModal(false);
                  setSelectedOportunidad(null);
                }}></button>
              </div>
              <form onSubmit={handleSaveGatekeepingAndMove}>
                <div className="modal-body px-4 py-3">
                  <div className="alert alert-warning border-0 small mb-4 py-2.5 px-3 rounded-3 d-flex align-items-start gap-2" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-info-circle-fill fs-6 mt-0.5"></i>
                    <div>
                      Para mover el negocio a la etapa <strong>{getStageLabel(targetStageTemp)}</strong>, la política corporativa exige completar los siguientes datos:
                    </div>
                  </div>

                  {gatekeepingMissingFields.map(f => {
                    const val = gatekeepingFormValues[f.key] || '';
                    return (
                      <div className="mb-3 text-start" key={f.key}>
                        {f.key !== 'fechaEstimadaCierre' && f.key !== 'montoEstimadoMensual' && f.key !== 'comercialEmail' && f.key !== 'pais' && f.key !== 'clienteId' && f.key !== 'notas' && f.key !== 'nombre' && !f.fieldObj ? (
                          <label className="form-label small fw-bold mb-1">{f.label}</label>
                        ) : null}

                        {f.key === 'fechaEstimadaCierre' ? (
                          <>
                            <label className="form-label small fw-bold mb-1">{f.label}</label>
                            <input 
                              type="date" 
                              className="form-control text-start" 
                              required 
                              value={val}
                              onChange={e => setGatekeepingFormValues({ ...gatekeepingFormValues, [f.key]: e.target.value })}
                            />
                          </>
                        ) : f.key === 'montoEstimadoMensual' ? (
                          <>
                            <label className="form-label small fw-bold mb-1">{f.label}</label>
                            <input 
                              type="number" 
                              className="form-control text-start" 
                              required 
                              value={val}
                              onChange={e => setGatekeepingFormValues({ ...gatekeepingFormValues, [f.key]: e.target.value })}
                            />
                          </>
                        ) : f.key === 'comercialEmail' ? (
                          <>
                            <label className="form-label small fw-bold mb-1">{f.label}</label>
                            <select 
                              className="form-select text-start" 
                              required 
                              value={val}
                              onChange={e => setGatekeepingFormValues({ ...gatekeepingFormValues, [f.key]: e.target.value })}
                            >
                              <option value="">Seleccionar Comercial...</option>
                              {usuarios
                                .filter(u => u.equipo === 'Adquisicion' || u.equipo === 'Retencion')
                                .map(u => (
                                  <option key={u.email} value={u.email}>{u.nombre} ({u.equipo === 'Adquisicion' ? 'Adquisición' : 'Retención'})</option>
                                ))}
                            </select>
                          </>
                        ) : f.key === 'pais' ? (
                          <>
                            <label className="form-label small fw-bold mb-1">{f.label}</label>
                            <select 
                              className="form-select text-start" 
                              required 
                              value={val}
                              onChange={e => setGatekeepingFormValues({ ...gatekeepingFormValues, [f.key]: e.target.value })}
                            >
                              <option value="AR">Argentina</option>
                              <option value="CL">Chile</option>
                              <option value="PE">Perú</option>
                              <option value="CO">Colombia</option>
                              <option value="MX">México</option>
                            </select>
                          </>
                        ) : f.key === 'clienteId' ? (
                          <div className="col-12 text-start position-relative">
                            <label className="form-label small fw-bold mb-1">{f.label}</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              required 
                              placeholder="Buscar y asociar empresa..." 
                              value={gatekeepingClientSearch}
                              onChange={e => {
                                setGatekeepingClientSearch(e.target.value);
                                setShowGatekeepingClientDropdown(true);
                                if (!e.target.value) {
                                  setGatekeepingFormValues({ ...gatekeepingFormValues, [f.key]: '' });
                                }
                              }}
                              onFocus={() => setShowGatekeepingClientDropdown(true)}
                              onBlur={() => setTimeout(() => setShowGatekeepingClientDropdown(false), 200)}
                            />
                            {showGatekeepingClientDropdown && (
                              <div className="dropdown-menu show w-100 position-absolute border-secondary-subtle" style={{ maxHeight: '180px', overflowY: 'auto', zIndex: 1050 }}>
                                {clientes
                                  .filter(c => c.nombreEmpresa?.toLowerCase().includes(gatekeepingClientSearch.toLowerCase()))
                                  .map(c => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      className="dropdown-item text-start"
                                      onClick={() => {
                                        setGatekeepingFormValues({ ...gatekeepingFormValues, [f.key]: c.id });
                                        setGatekeepingClientSearch(c.nombreEmpresa);
                                        setShowGatekeepingClientDropdown(false);
                                      }}
                                    >
                                      {c.nombreEmpresa}
                                    </button>
                                  ))}
                                {clientes.filter(c => c.nombreEmpresa?.toLowerCase().includes(gatekeepingClientSearch.toLowerCase())).length === 0 && (
                                  <div className="dropdown-item disabled text-muted">No se encontraron empresas</div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : f.key === 'notas' || f.key === 'nombre' ? (
                          <>
                            <label className="form-label small fw-bold mb-1">{f.label}</label>
                            <input 
                              type="text" 
                              className="form-control text-start" 
                              required 
                              value={val}
                              onChange={e => setGatekeepingFormValues({ ...gatekeepingFormValues, [f.key]: e.target.value })}
                            />
                          </>
                        ) : (
                          <DynamicFieldInput 
                            campo={f.fieldObj} 
                            value={val} 
                            onChange={v => setGatekeepingFormValues({ ...gatekeepingFormValues, [f.key]: v })}
                            clientId={selectedOportunidad?.id || 'temp'}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="modal-footer bg-light border-top-0 px-4 py-3 gap-2">
                  <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-semibold" onClick={() => {
                    setShowGatekeepingModal(false);
                    setSelectedOportunidad(null);
                  }} disabled={saving}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary flex-grow-1 rounded-pill fw-bold shadow-sm" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar y Avanzar Etapa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showGestionModal && selectedOportunidad && (
        <OportunidadGestionModal 
          show={showGestionModal} 
          onClose={() => {
            setShowGestionModal(false);
            setSelectedOportunidad(null);
          }} 
          oportunidadData={selectedOportunidad} 
          onSaved={() => {
            // refresh data handled by firestore snapshot
          }} 
          iaPausada={iaPausada}
        />
      )}

      <ExportDrawer 
        show={showExportDrawer} 
        onClose={() => setShowExportDrawer(false)} 
        defaultEntity="oportunidades" 
      />

      <BulkImportModal
        show={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        initialEntity="oportunidades"
        user={user}
      />
    </div>
  );
}

