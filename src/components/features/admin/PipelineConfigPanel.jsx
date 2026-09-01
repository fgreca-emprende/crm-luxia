import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';
import { cacheManager } from '../../../lib/api';

const BASE_FIELDS = [
  { key: 'nombre', label: 'Nombre de la Oportunidad' },
  { key: 'clienteId', label: 'Asociar a Cliente (Empresa)' },
  { key: 'comercialEmail', label: 'Comercial Asignado' },
  { key: 'montoEstimadoMensual', label: 'Monto Estimado Mensual ($)' },
  { key: 'fechaEstimadaCierre', label: 'Fecha Estimada de Cierre' },
  { key: 'pais', label: 'País Operativo' },
  { key: 'notas', label: 'Notas de Seguimiento / Bitácora' }
];

const DEFAULT_LOSS_REASONS = [
  { id: 'precio', label: '💵 Precio elevado', active: true, orden: 10 },
  { id: 'cobertura', label: '📍 Falta de cobertura / alcance', active: true, orden: 20 },
  { id: 'competencia', label: '🛡️ Competencia ganó el negocio', active: true, orden: 30 },
  { id: 'tecnologia', label: '⚙️ Limitación tecnológica / integraciones', active: true, orden: 40 },
  { id: 'otro', label: '❓ Otro motivo', active: true, orden: 50 }
];

export function PipelineConfigPanel() {
  const [dynamicFields, setDynamicFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Segmented selectors
  const [selectedPipeline, setSelectedPipeline] = useState('adquisicion');
  const [selectedService, setSelectedService] = useState('default');
  const [services, setServices] = useState([]);
  
  // Rules catalog keyed by ${pipelineId}_${serviceId}
  const [allConfigs, setAllConfigs] = useState({});

  // Inline inputs for new stage
  const [newStageId, setNewStageId] = useState('');
  const [newStageLabel, setNewStageLabel] = useState('');
  const [newStageProbability, setNewStageProbability] = useState('');

  // Loss reasons catalog
  const [lossReasons, setLossReasons] = useState(DEFAULT_LOSS_REASONS);
  const [newReasonId, setNewReasonId] = useState('');
  const [newReasonLabel, setNewReasonLabel] = useState('');

  // UX Responsive Redesign State
  const [rightPanelTab, setRightPanelTab] = useState('campos'); // 'campos' | 'gobernanza'
  const [selectedGovStage, setSelectedGovStage] = useState(null);
  const [showAddStageForm, setShowAddStageForm] = useState(false);

  const { showAlert } = useToast();

  const loadConfigData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load sections and fields to identify opportunity fields
      const { data: secData } = await supabase.from('config_secciones').select('*').order('orden');
      const sectionsMap = {};
      (secData || []).forEach(d => {
        sectionsMap[d.id] = d.entidad;
      });

      const { data: fieldsData } = await supabase.from('config_campos').select('*').order('orden');
      const opportunityFields = [];
      (fieldsData || []).forEach(fieldData => {
        const entity = sectionsMap[fieldData.seccion_id || fieldData.seccionId];
        if (entity === 'oportunidad') {
          opportunityFields.push({
            key: fieldData.key || fieldData.id,
            label: fieldData.nombre || fieldData.id
          });
        }
      });
      setDynamicFields(opportunityFields);

      // 2. Load services list
      const { data: svcData } = await supabase.from('config_servicios').select('*');
      const svcList = [{ id: 'default', nombre: 'Por Defecto (Cualquier Servicio)' }];
      (svcData || []).forEach(d => {
        svcList.push({ id: d.id, nombre: d.nombre || d.id });
      });
      setServices(svcList);

      // 3. Load dynamic stages, form fields configs and loss reasons
      const configDoc = await getConfigGeneral('pipeline_config');
      let loadedConfigs = {};
      if (configDoc) {
        loadedConfigs = configDoc;
        if (Array.isArray(configDoc.lossReasons) && configDoc.lossReasons.length > 0) {
          setLossReasons(configDoc.lossReasons);
        } else {
          setLossReasons(DEFAULT_LOSS_REASONS);
        }
      } else {
        setLossReasons(DEFAULT_LOSS_REASONS);
      }
      setAllConfigs(loadedConfigs);
    } catch (err) {
      showAlert(`Error cargando configuración de pipelines: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadConfigData();
  }, [loadConfigData]);

  // Resolve active config for the selected pipeline segment
  const activeKey = `${selectedPipeline}_${selectedService}`;
  const activeConfig = allConfigs[activeKey] || allConfigs[`${selectedPipeline}_default`] || {
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

  const handleSaveConfigs = async () => {
    setSaving(true);
    try {
      const updatedConfigs = {
        ...allConfigs,
        [activeKey]: activeConfig,
        lossReasons
      };

      await setConfigGeneral('pipeline_config', updatedConfigs);
      await logSystemEvent(null, 'system_config_change', {
        tipoConfig: 'pipeline_config',
        segmentKey: activeKey
      });

      // Clear local config caches
      cacheManager.data.delete('config_general/pipeline_config');
      cacheManager.data.delete('config_general');
      
      showAlert('Configuraciones de Pipelines y Motivos de Pérdida guardados correctamente', 'success');
      loadConfigData();
    } catch (err) {
      showAlert(`Error al guardar configuraciones: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLossReason = (id) => {
    setLossReasons(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const handleAddLossReason = (e) => {
    e.preventDefault();
    const cleanId = newReasonId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || `motivo_${Date.now()}`;
    const cleanLabel = newReasonLabel.trim();
    if (!cleanLabel) {
      showAlert('Ingresa la etiqueta descriptiva del motivo de pérdida.', 'warning');
      return;
    }
    if (lossReasons.some(r => r.id === cleanId)) {
      showAlert(`El ID "${cleanId}" ya existe en el catálogo de motivos.`, 'warning');
      return;
    }
    const nextOrder = lossReasons.length > 0 ? Math.max(...lossReasons.map(r => r.orden || 0)) + 10 : 10;
    setLossReasons(prev => [...prev, { id: cleanId, label: cleanLabel, active: true, orden: nextOrder }]);
    setNewReasonId('');
    setNewReasonLabel('');
    showAlert(`Motivo "${cleanLabel}" agregado correctamente al catálogo.`, 'success');
  };

  const handleRemoveLossReason = (id) => {
    setLossReasons(prev => prev.filter(r => r.id !== id));
  };

  const handleAddStage = (e) => {
    e.preventDefault();
    const cleanId = newStageId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanLabel = newStageLabel.trim();
    if (!cleanId || !cleanLabel) {
      showAlert('Por favor, completa un ID y etiqueta válidos.', 'warning');
      return;
    }
    if (['ganado', 'perdido'].includes(cleanId)) {
      showAlert('Los IDs de cierre "ganado" y "perdido" están reservados por el sistema.', 'warning');
      return;
    }

    const currentStages = activeConfig.stages || [];
    if (currentStages.some(s => s.id === cleanId)) {
      showAlert('Ese ID de etapa ya existe en este pipeline.', 'warning');
      return;
    }

    const maxOrden = currentStages.length > 0 ? Math.max(...currentStages.map(s => s.orden || 0)) : 0;
    const newStageObj = { id: cleanId, label: cleanLabel, orden: maxOrden + 10 };
    if (newStageProbability.trim() !== '') {
      const parsedProb = Number(newStageProbability);
      if (!isNaN(parsedProb)) {
        newStageObj.probabilidad = Math.max(0, Math.min(100, parsedProb));
      }
    }
    const updatedStages = [...currentStages, newStageObj];

    setAllConfigs(prev => ({
      ...prev,
      [activeKey]: {
        ...activeConfig,
        stages: updatedStages
      }
    }));

    setNewStageId('');
    setNewStageLabel('');
    setNewStageProbability('');
  };

  const handleChangeStageProbability = (stageId, value) => {
    const currentStages = activeConfig.stages || [];
    const updatedStages = currentStages.map(s => {
      if (s.id === stageId) {
        if (value === '') {
          const { probabilidad, ...rest } = s;
          return rest;
        }
        const numVal = Number(value);
        if (isNaN(numVal)) return s;
        return {
          ...s,
          probabilidad: Math.max(0, Math.min(100, numVal))
        };
      }
      return s;
    });

    setAllConfigs(prev => ({
      ...prev,
      [activeKey]: {
        ...activeConfig,
        stages: updatedStages
      }
    }));
  };

  const handleRemoveStage = (stageId) => {
    const currentStages = activeConfig.stages || [];
    const updatedStages = currentStages.filter(s => s.id !== stageId);
    
    const updatedGatekeeping = { ...(activeConfig.gatekeeping || {}) };
    delete updatedGatekeeping[stageId];

    setAllConfigs(prev => ({
      ...prev,
      [activeKey]: {
        ...activeConfig,
        stages: updatedStages,
        gatekeeping: updatedGatekeeping
      }
    }));
  };

  const handleToggleFormField = (fieldKey) => {
    const currentFields = activeConfig.formFields || [];
    const updatedFields = currentFields.includes(fieldKey)
      ? currentFields.filter(k => k !== fieldKey)
      : [...currentFields, fieldKey];

    // If removed from form, also remove from gatekeeping requirements
    const updatedGatekeeping = { ...(activeConfig.gatekeeping || {}) };
    Object.keys(updatedGatekeeping).forEach(stageId => {
      updatedGatekeeping[stageId] = (updatedGatekeeping[stageId] || []).filter(k => k !== fieldKey);
    });

    setAllConfigs(prev => ({
      ...prev,
      [activeKey]: {
        ...activeConfig,
        formFields: updatedFields,
        gatekeeping: updatedGatekeeping
      }
    }));
  };

  const handleToggleGatekeepingField = (stageId, fieldKey) => {
    const currentGate = activeConfig.gatekeeping || {};
    const stageRules = currentGate[stageId] || [];
    const newRules = stageRules.includes(fieldKey)
      ? stageRules.filter(k => k !== fieldKey)
      : [...stageRules, fieldKey];

    setAllConfigs(prev => ({
      ...prev,
      [activeKey]: {
        ...activeConfig,
        gatekeeping: {
          ...currentGate,
          [stageId]: newRules
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando configuración...</span>
        </div>
      </div>
    );
  }

  // Helper lists for checkboxes
  const visibleFieldsList = activeConfig.formFields || [];
  const activeStagesList = activeConfig.stages || [];

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h5 className="fw-bold mb-1 text-dark">Diseño y Gobernanza del Pipeline</h5>
          <p className="small text-muted mb-0">Define las etapas del embudo, los campos visibles del formulario y las reglas de validación en cascada por división y servicio.</p>
        </div>
        <button 
          className="btn btn-primary rounded-pill fw-bold px-4 shadow-sm"
          onClick={handleSaveConfigs}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>

      <hr className="my-4" style={{ borderColor: 'var(--apple-border)' }} />

      {/* Selectores de Segmentación */}
      <div className="row g-3 mb-4 p-3 rounded-4 border text-start" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
        <div className="col-md-6">
          <label className="form-label small fw-bold mb-1" style={{ color: 'var(--apple-blue)' }}>Pipeline (División Comercial)</label>
          <select 
            className="form-select" 
            value={selectedPipeline} 
            onChange={e => setSelectedPipeline(e.target.value)}
          >
            <option value="adquisicion">División: Adquisición</option>
            <option value="retencion">División: Retención</option>
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-bold mb-1" style={{ color: 'var(--apple-blue)' }}>
            <i className="bi bi-box-seam me-1"></i>Línea de Producto / Catálogo
          </label>
          <select 
            className="form-select" 
            value={selectedService} 
            onChange={e => setSelectedService(e.target.value)}
          >
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row g-4 text-start">
        {/* 1. PANEL IZQUIERDO: ETAPAS DEL EMBUDO (col-lg-5) */}
        <div className="col-lg-5">
          <div className="apple-card h-100 p-4 border rounded-4 shadow-sm" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
            <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-3" style={{ borderColor: 'var(--apple-border)' }}>
              <div>
                <h6 className="fw-bold mb-1 d-flex align-items-center" style={{ color: 'var(--apple-blue)' }}>
                  <i className="bi bi-diagram-3-fill me-2 fs-5"></i>1. Etapas del Pipeline
                </h6>
                <p className="extra-small text-muted mb-0" style={{ fontSize: '0.78rem' }}>
                  Secuencia del embudo y probabilidad de cierre estimada.
                </p>
              </div>
              <span className="badge rounded-pill px-2.5 py-1" style={{ background: 'rgba(13, 110, 253, 0.1)', color: 'var(--apple-blue)', fontSize: '0.75rem' }}>
                {activeStagesList.length} Etapas
              </span>
            </div>
            
            <div className="d-flex flex-column gap-2.5 mb-4">
              {activeStagesList.map((st, idx) => (
                <div 
                  key={st.id} 
                  className="p-3 rounded-3 border d-flex justify-content-between align-items-center gap-3 transition-all"
                  style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}
                >
                  <div className="d-flex align-items-center gap-3 flex-grow-1 overflow-hidden">
                    <span className="badge rounded-circle d-flex align-items-center justify-content-center text-muted border font-monospace flex-shrink-0" style={{ width: '28px', height: '28px', fontSize: '0.75rem', background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
                      #{idx + 1}
                    </span>
                    <div className="overflow-hidden">
                      <span className="fw-bold d-block text-truncate" style={{ color: 'var(--apple-text-primary)', fontSize: '0.92rem' }}>{st.label}</span>
                      <code className="small text-muted font-monospace" style={{ fontSize: '0.7rem' }}>ID: {st.id}</code>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 flex-shrink-0">
                    <div 
                      className="d-flex align-items-center px-2 py-1 rounded-pill border" 
                      style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}
                      title="Probabilidad de Conversión Estimada (%)"
                    >
                      <input 
                        type="number" 
                        className="border-0 bg-transparent text-center p-0 fw-bold" 
                        placeholder="0" 
                        min="0" 
                        max="100" 
                        value={st.probabilidad !== undefined ? st.probabilidad : ''} 
                        onChange={e => handleChangeStageProbability(st.id, e.target.value)} 
                        style={{ width: '42px', fontSize: '0.85rem', color: 'var(--apple-text-primary)', outline: 'none' }}
                      />
                      <span className="small text-muted fw-bold" style={{ fontSize: '0.75rem' }}>%</span>
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-sm btn-link text-danger p-1 rounded-circle" 
                      onClick={() => handleRemoveStage(st.id)}
                      title="Eliminar Etapa"
                    >
                      <i className="bi bi-trash3 fs-6"></i>
                    </button>
                  </div>
                </div>
              ))}

              <div className="p-2.5 text-muted small rounded-3 border border-dashed text-center" style={{ background: 'var(--apple-surface-subtle)', borderColor: 'var(--apple-border)', fontSize: '0.78rem' }}>
                <i className="bi bi-lock-fill me-1 text-secondary"></i> [ganado] y [perdido] se añaden automáticamente al final.
              </div>
            </div>

            {/* Añadir Nueva Etapa Form / Toggle */}
            {!showAddStageForm ? (
              <button 
                type="button" 
                className="btn btn-outline-primary btn-sm w-100 rounded-pill py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-2xs"
                onClick={() => setShowAddStageForm(true)}
              >
                <i className="bi bi-plus-circle-fill"></i> Añadir Nueva Etapa al Embudo
              </button>
            ) : (
              <form onSubmit={(e) => { handleAddStage(e); setShowAddStageForm(false); }} className="p-3.5 rounded-3 border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                <div className="d-flex align-items-center justify-content-between mb-2.5">
                  <span className="small fw-bold" style={{ color: 'var(--apple-text-primary)' }}>+ Nueva Etapa</span>
                  <button type="button" className="btn-close btn-sm" onClick={() => setShowAddStageForm(false)}></button>
                </div>
                <div className="row g-2 mb-2.5">
                  <div className="col-sm-7">
                    <label className="extra-small text-muted mb-1 d-block" style={{ fontSize: '0.72rem' }}>Etiqueta con Emoji</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm" 
                      placeholder="ej: 📋 Diagnóstico" 
                      required 
                      value={newStageLabel}
                      onChange={e => setNewStageLabel(e.target.value)}
                    />
                  </div>
                  <div className="col-sm-5">
                    <label className="extra-small text-muted mb-1 d-block" style={{ fontSize: '0.72rem' }}>ID Único</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm" 
                      placeholder="ej: diagnostico" 
                      required 
                      value={newStageId}
                      onChange={e => setNewStageId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mb-3 d-flex align-items-center gap-2">
                  <label className="extra-small text-muted mb-0" style={{ fontSize: '0.72rem' }}>Probabilidad:</label>
                  <input 
                    type="number" 
                    className="form-control form-control-sm" 
                    placeholder="0-100" 
                    min="0" 
                    max="100" 
                    style={{ width: '80px' }}
                    value={newStageProbability}
                    onChange={e => setNewStageProbability(e.target.value)}
                  />
                  <span className="small text-muted">%</span>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm rounded-pill px-4 fw-bold flex-grow-1">
                    Agregar Etapa
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={() => setShowAddStageForm(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* 2. PANEL DERECHO: CAMPOS Y GOBERNANZA CON SUB-TABS (col-lg-7) */}
        <div className="col-lg-7">
          <div className="apple-card h-100 p-4 border rounded-4 shadow-sm" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
            
            {/* Header de Pestañas del Panel Derecho */}
            <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-3 flex-wrap gap-2" style={{ borderColor: 'var(--apple-border)' }}>
              <div>
                <h6 className="fw-bold mb-1 d-flex align-items-center" style={{ color: 'var(--apple-text-primary)' }}>
                  <i className="bi bi-sliders me-2 fs-5 text-primary"></i>2. Formulario & Gobernanza
                </h6>
                <p className="extra-small text-muted mb-0" style={{ fontSize: '0.78rem' }}>
                  Control de visibilidad y requisitos de avance para este segmento.
                </p>
              </div>

              {/* Sub-Tabs Nav */}
              <div className="d-flex p-1 rounded-pill border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold transition-all ${rightPanelTab === 'campos' ? 'btn-primary shadow-xs' : 'btn-link text-muted text-decoration-none'}`}
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setRightPanelTab('campos')}
                >
                  <i className="bi bi-ui-checks-grid me-1.5"></i>Campos Visibles ({visibleFieldsList.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold transition-all ${rightPanelTab === 'gobernanza' ? 'btn-primary shadow-xs' : 'btn-link text-muted text-decoration-none'}`}
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setRightPanelTab('gobernanza')}
                >
                  <i className="bi bi-shield-check me-1.5"></i>Reglas de Gobernanza
                </button>
              </div>
            </div>

            {/* TAB 1: CAMPOS VISIBLES EN FORMULARIO */}
            {rightPanelTab === 'campos' && (
              <div>
                <div className="mb-4">
                  <span className="small text-muted fw-bold d-block mb-2 text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                    <i className="bi bi-cpu me-1 text-primary"></i> Campos Nativos del Sistema
                  </span>
                  <div className="row g-2.5">
                    {BASE_FIELDS.map(f => {
                      const isChecked = visibleFieldsList.includes(f.key);
                      return (
                        <div className="col-sm-6" key={f.key}>
                          <div 
                            className={`p-2.5 rounded-3 border d-flex align-items-center gap-2.5 cursor-pointer transition-all`}
                            style={{ 
                              background: isChecked ? 'rgba(13, 110, 253, 0.08)' : 'var(--apple-surface-elevated)', 
                              borderColor: isChecked ? 'var(--apple-blue)' : 'var(--apple-border)' 
                            }}
                            onClick={() => handleToggleFormField(f.key)}
                          >
                            <input 
                              type="checkbox" 
                              className="form-check-input mt-0" 
                              checked={isChecked}
                              onChange={() => {}}
                            />
                            <span className="small fw-semibold flex-grow-1" style={{ color: 'var(--apple-text-primary)' }}>{f.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="small text-muted fw-bold d-block mb-2 text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                    <i className="bi bi-flower1 me-1 text-success"></i> Campos Dinámicos Agropecuarios
                  </span>
                  <div className="row g-2.5">
                    {dynamicFields.length === 0 ? (
                      <div className="col-12 text-center text-muted small p-4 rounded-3 border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                        <i className="bi bi-info-circle d-block fs-5 mb-1 text-muted"></i>
                        No hay campos dinámicos de oportunidad dados de alta en la configuración general.
                      </div>
                    ) : (
                      dynamicFields.map(f => {
                        const isChecked = visibleFieldsList.includes(f.key);
                        return (
                          <div className="col-sm-6" key={f.key}>
                            <div 
                              className={`p-2.5 rounded-3 border d-flex align-items-center gap-2.5 cursor-pointer transition-all`}
                              style={{ 
                                background: isChecked ? 'rgba(13, 110, 253, 0.08)' : 'var(--apple-surface-elevated)', 
                                borderColor: isChecked ? 'var(--apple-blue)' : 'var(--apple-border)' 
                              }}
                              onClick={() => handleToggleFormField(f.key)}
                            >
                              <input 
                                type="checkbox" 
                                className="form-check-input mt-0" 
                                checked={isChecked}
                                onChange={() => {}}
                              />
                              <div className="flex-grow-1 overflow-hidden">
                                <span className="small fw-semibold d-block text-truncate" style={{ color: 'var(--apple-text-primary)' }}>{f.label}</span>
                                <code className="text-muted" style={{ fontSize: '0.65rem' }}>{f.key}</code>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REGLAS DE GOBERNANZA POR ETAPA */}
            {rightPanelTab === 'gobernanza' && (
              <div>
                <p className="small text-muted mb-3">
                  Selecciona una etapa del embudo para definir qué campos son <strong>estrictamente obligatorios</strong> antes de permitir el avance de una oportunidad.
                </p>

                {/* Selector de Etapa Activa para Gobernanza */}
                <div className="d-flex align-items-center gap-2 flex-wrap mb-4 pb-2 border-bottom" style={{ borderColor: 'var(--apple-border)' }}>
                  {activeStagesList.map(st => {
                    const currentGovStage = selectedGovStage || activeStagesList[0]?.id;
                    const isSelected = currentGovStage === st.id;
                    const reqCount = (activeConfig.gatekeeping?.[st.id] || []).length;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center gap-2 border transition-all`}
                        style={{
                          background: isSelected ? 'var(--apple-blue)' : 'var(--apple-surface-elevated)',
                          color: isSelected ? '#ffffff' : 'var(--apple-text-primary)',
                          borderColor: isSelected ? 'var(--apple-blue)' : 'var(--apple-border)'
                        }}
                        onClick={() => setSelectedGovStage(st.id)}
                      >
                        <span>{st.label}</span>
                        {reqCount > 0 && (
                          <span className={`badge rounded-pill ${isSelected ? 'bg-white text-primary' : 'bg-primary text-white'}`} style={{ fontSize: '0.65rem' }}>
                            {reqCount} req.
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Lista de Campos con Switch de Gobernanza para la Etapa Seleccionada */}
                {(() => {
                  const currentGovStage = selectedGovStage || activeStagesList[0]?.id;
                  const currentStageObj = activeStagesList.find(s => s.id === currentGovStage);
                  const stageGateFields = activeConfig.gatekeeping?.[currentGovStage] || [];

                  if (visibleFieldsList.length === 0) {
                    return (
                      <div className="text-center text-muted small p-5 rounded-3 border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                        <i className="bi bi-exclamation-triangle fs-3 text-warning d-block mb-2"></i>
                        No has seleccionado ningún campo visible en la pestaña <strong>"Campos Visibles"</strong>. Primero habilita los campos del formulario.
                      </div>
                    );
                  }

                  return (
                    <div>
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <span className="small fw-bold" style={{ color: 'var(--apple-text-primary)' }}>
                          Requisitos para ingresar a <span className="text-primary">{currentStageObj?.label || currentGovStage}</span>:
                        </span>
                        <span className="extra-small text-muted" style={{ fontSize: '0.75rem' }}>
                          {stageGateFields.length} de {visibleFieldsList.length} obligatorios
                        </span>
                      </div>

                      <div className="row g-2.5">
                        {visibleFieldsList.map(fieldKey => {
                          const isChecked = stageGateFields.includes(fieldKey);
                          const baseObj = BASE_FIELDS.find(b => b.key === fieldKey);
                          const dynObj = dynamicFields.find(d => d.key === fieldKey);
                          const label = baseObj ? baseObj.label : (dynObj ? dynObj.label : fieldKey);

                          return (
                            <div className="col-sm-6" key={fieldKey}>
                              <div 
                                className={`p-3 rounded-3 border d-flex justify-content-between align-items-center gap-2 cursor-pointer transition-all`}
                                style={{
                                  background: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'var(--apple-surface-elevated)',
                                  borderColor: isChecked ? '#10b981' : 'var(--apple-border)'
                                }}
                                onClick={() => handleToggleGatekeepingField(currentGovStage, fieldKey)}
                              >
                                <div className="overflow-hidden">
                                  <span className="small fw-bold d-block text-truncate" style={{ color: 'var(--apple-text-primary)' }}>{label}</span>
                                  <span className="extra-small" style={{ fontSize: '0.72rem', color: isChecked ? '#10b981' : 'var(--apple-text-secondary)' }}>
                                    {isChecked ? '🛡️ Obligatorio' : 'Opcional'}
                                  </span>
                                </div>
                                <div className="form-check form-switch m-0 flex-shrink-0">
                                  <input 
                                    type="checkbox" 
                                    className="form-check-input" 
                                    checked={isChecked}
                                    onChange={() => {}}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}

          </div>
        </div>

        {/* 4. GESTOR DE MOTIVOS DE PÉRDIDA DE OPORTUNIDADES */}
        <div className="col-12 mt-4">
          <div className="apple-card p-4 border rounded-4" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
            <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-3" style={{ borderColor: 'var(--apple-border)' }}>
              <div>
                <h6 className="fw-bold mb-1 text-danger d-flex align-items-center">
                  <i className="bi bi-x-circle-fill me-2"></i>4. Catálogo de Motivos de Pérdida de Negocios
                </h6>
                <p className="small text-muted mb-0">
                  Administra las razones estándar que los ejecutivos comerciales podrán seleccionar al declarar una oportunidad como perdida.
                </p>
              </div>
              <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-1.5 rounded-pill">
                {lossReasons.filter(r => r.active !== false).length} Motivos Activos
              </span>
            </div>

            <div className="row g-4">
              {/* Listado de Motivos */}
              <div className="col-lg-8">
                <div className="table-responsive p-3 rounded-3 border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="text-muted" style={{ borderBottomColor: 'var(--apple-border)' }}>
                      <tr>
                        <th className="border-0 bg-transparent">ID Término</th>
                        <th className="border-0 bg-transparent">Etiqueta & Emoji</th>
                        <th className="border-0 bg-transparent text-center">Estado</th>
                        <th className="border-0 bg-transparent text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lossReasons.map((reason) => (
                        <tr key={reason.id} style={{ borderBottomColor: 'var(--apple-border)' }}>
                          <td className="bg-transparent"><code className="small text-muted">{reason.id}</code></td>
                          <td className="bg-transparent fw-bold" style={{ color: 'var(--apple-text-primary)' }}>{reason.label}</td>
                          <td className="bg-transparent text-center">
                            <div className="form-check form-switch d-flex justify-content-center">
                              <input 
                                className="form-check-input" 
                                type="checkbox" 
                                checked={reason.active !== false} 
                                onChange={() => handleToggleLossReason(reason.id)} 
                              />
                            </div>
                          </td>
                          <td className="bg-transparent text-end">
                            <button 
                              type="button" 
                              className="btn btn-link text-danger p-0 ms-2" 
                              onClick={() => handleRemoveLossReason(reason.id)}
                              title="Eliminar motivo"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Formulario para agregar nuevo motivo */}
              <div className="col-lg-4">
                <div className="p-3 rounded-3 border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                  <h6 className="fw-bold small mb-2" style={{ color: 'var(--apple-text-primary)' }}>+ Agregar Nuevo Motivo de Pérdida</h6>
                  <form onSubmit={handleAddLossReason}>
                    <div className="mb-2">
                      <label className="form-label small text-muted mb-1">ID (Clave opcional)</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="ej: presupuesto_cancelado" 
                        value={newReasonId} 
                        onChange={e => setNewReasonId(e.target.value)} 
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label small text-muted mb-1">Etiqueta con Emoji</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="ej: 💰 Presupuesto congelado" 
                        required 
                        value={newReasonLabel} 
                        onChange={e => setNewReasonLabel(e.target.value)} 
                      />
                    </div>
                    <button type="submit" className="btn btn-danger btn-sm w-100 rounded-pill text-white fw-bold">
                      + Agregar Motivo
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
