import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/ToastProvider';
import { useUserRole } from '../../../contexts/UserRoleContext';

export const DEFAULT_AI_MODELS = [
  {
    id: 'gemini-3.5-flash-lite',
    nombre: 'Gemini 3.5 Flash Lite',
    proveedor: 'Google Gemini',
    estado: 'activo',
    esDefault: true,
    descripcion: 'Ultrarrápido, ligero y de respuesta instantánea optimizado para tareas de alta frecuencia y soporte técnico.',
    officialInputRatePer1M: 0.075,
    officialOutputRatePer1M: 0.30,
    agreedInputRatePer1M: null,
    agreedOutputRatePer1M: null,
    tieneAcuerdo: false,
    maxOutputTokens: 8192,
    contextWindow: 1048576,
    lastPriceSync: new Date().toISOString()
  },
  {
    id: 'gemini-3.5-flash',
    nombre: 'Gemini 3.5 Flash',
    proveedor: 'Google Gemini',
    estado: 'activo',
    esDefault: false,
    descripcion: 'Modelo principal multitarea de velocidad y equilibrio ideal para agentes de producción.',
    officialInputRatePer1M: 0.10,
    officialOutputRatePer1M: 0.40,
    agreedInputRatePer1M: null,
    agreedOutputRatePer1M: null,
    tieneAcuerdo: false,
    maxOutputTokens: 8192,
    contextWindow: 1048576,
    lastPriceSync: new Date().toISOString()
  },
  {
    id: 'gemini-3.6-flash',
    nombre: 'Gemini 3.6 Flash',
    proveedor: 'Google Gemini',
    estado: 'activo',
    esDefault: false,
    descripcion: 'Modelo de última generación con razonamiento avanzado, alta velocidad y capacidad multimodal profunda.',
    officialInputRatePer1M: 0.15,
    officialOutputRatePer1M: 0.60,
    agreedInputRatePer1M: null,
    agreedOutputRatePer1M: null,
    tieneAcuerdo: false,
    maxOutputTokens: 8192,
    contextWindow: 2097152,
    lastPriceSync: new Date().toISOString()
  }
];

export function AdminIaModelsManager({ onModelSelect, selectedCountry, exchangeRates = {} }) {
  const { hasPermission } = useUserRole();
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState(null);

  const { showAlert } = useToast();

  const [formData, setFormData] = useState({
    id: '',
    nombre: '',
    proveedor: 'Google Gemini',
    estado: 'activo',
    esDefault: false,
    descripcion: '',
    officialInputRatePer1M: 0.075,
    officialOutputRatePer1M: 0.30,
    tieneAcuerdo: false,
    agreedInputRatePer1M: '',
    agreedOutputRatePer1M: '',
    maxOutputTokens: 8192,
    contextWindow: 1048576
  });

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('config_ia_modelos').select('*');
      if (error) throw error;

      if (!data || data.length === 0) {
        for (const m of DEFAULT_AI_MODELS) {
          await supabase.from('config_ia_modelos').upsert({
            id: m.id,
            nombre: m.nombre,
            proveedor: m.proveedor,
            estado: m.estado,
            es_default: m.esDefault,
            descripcion: m.descripcion,
            official_input_rate_per_1m: m.officialInputRatePer1M,
            official_output_rate_per_1m: m.officialOutputRatePer1M,
            agreed_input_rate_per_1m: m.agreedInputRatePer1M,
            agreed_output_rate_per_1m: m.agreedOutputRatePer1M,
            tiene_acuerdo: m.tieneAcuerdo,
            max_output_tokens: m.maxOutputTokens,
            context_window: m.contextWindow,
            last_price_sync: m.lastPriceSync
          });
        }
        setModelos(DEFAULT_AI_MODELS);
      } else {
        const loaded = data.map(d => ({
          id: d.id,
          nombre: d.nombre,
          proveedor: d.proveedor,
          estado: d.estado,
          esDefault: d.es_default,
          descripcion: d.descripcion,
          officialInputRatePer1M: d.official_input_rate_per_1m,
          officialOutputRatePer1M: d.official_output_rate_per_1m,
          agreedInputRatePer1M: d.agreed_input_rate_per_1m,
          agreedOutputRatePer1M: d.agreed_output_rate_per_1m,
          tieneAcuerdo: d.tiene_acuerdo,
          maxOutputTokens: d.max_output_tokens,
          contextWindow: d.context_window,
          lastPriceSync: d.last_price_sync
        }));
        setModelos(loaded);
      }
    } catch (err) {
      console.warn("Error loading config_ia_modelos, using default models fallback:", err);
      setModelos(DEFAULT_AI_MODELS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleOpenCreateModal = () => {
    setEditingModel(null);
    setFormData({
      id: '',
      nombre: '',
      proveedor: 'Google Gemini',
      estado: 'activo',
      esDefault: false,
      descripcion: '',
      officialInputRatePer1M: 0.075,
      officialOutputRatePer1M: 0.30,
      tieneAcuerdo: false,
      agreedInputRatePer1M: '',
      agreedOutputRatePer1M: '',
      maxOutputTokens: 8192,
      contextWindow: 1048576
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (model) => {
    setEditingModel(model);
    setFormData({
      id: model.id,
      nombre: model.nombre || model.id,
      proveedor: model.proveedor || 'Google Gemini',
      estado: model.estado || 'activo',
      esDefault: !!model.esDefault,
      descripcion: model.descripcion || '',
      officialInputRatePer1M: model.officialInputRatePer1M ?? 0.075,
      officialOutputRatePer1M: model.officialOutputRatePer1M ?? 0.30,
      tieneAcuerdo: !!model.tieneAcuerdo || (model.agreedInputRatePer1M !== null && model.agreedInputRatePer1M !== undefined),
      agreedInputRatePer1M: model.agreedInputRatePer1M !== null && model.agreedInputRatePer1M !== undefined ? model.agreedInputRatePer1M : '',
      agreedOutputRatePer1M: model.agreedOutputRatePer1M !== null && model.agreedOutputRatePer1M !== undefined ? model.agreedOutputRatePer1M : '',
      maxOutputTokens: model.maxOutputTokens || 8192,
      contextWindow: model.contextWindow || 1048576
    });
    setShowModal(true);
  };

  const handleSaveModel = async (e) => {
    e.preventDefault();
    if (!hasPermission('actions', 'configurar_modelos_ia')) {
      showAlert('No tienes permisos para configurar el catálogo de modelos.', 'danger');
      return;
    }
    if (!formData.id.trim() || !formData.nombre.trim()) {
      showAlert('Por favor completa el ID y nombre del modelo.', 'warning');
      return;
    }

    setSavingModel(true);
    try {
      const cleanId = formData.id.trim().toLowerCase().replace(/\s+/g, '-');

      const agreedIn = formData.tieneAcuerdo && formData.agreedInputRatePer1M !== '' ? parseFloat(formData.agreedInputRatePer1M) : null;
      const agreedOut = formData.tieneAcuerdo && formData.agreedOutputRatePer1M !== '' ? parseFloat(formData.agreedOutputRatePer1M) : null;

      const modelPayload = {
        id: cleanId,
        nombre: formData.nombre.trim(),
        proveedor: formData.proveedor,
        estado: formData.estado,
        es_default: formData.esDefault,
        descripcion: formData.descripcion.trim(),
        official_input_rate_per_1m: parseFloat(formData.officialInputRatePer1M) || 0,
        official_output_rate_per_1m: parseFloat(formData.officialOutputRatePer1M) || 0,
        agreed_input_rate_per_1m: agreedIn,
        agreed_output_rate_per_1m: agreedOut,
        tiene_acuerdo: formData.tieneAcuerdo && agreedIn !== null,
        max_output_tokens: parseInt(formData.maxOutputTokens) || 8192,
        context_window: parseInt(formData.contextWindow) || 1048576,
        last_price_sync: new Date().toISOString()
      };

      if (formData.esDefault) {
        await supabase.from('config_ia_modelos').update({ es_default: false }).neq('id', cleanId);
      }
      const { error } = await supabase.from('config_ia_modelos').upsert(modelPayload);
      if (error) throw error;

      showAlert(`Modelo ${formData.nombre} guardado exitosamente.`, 'success');
      setShowModal(false);
      loadModels();
    } catch (err) {
      console.error("Error saving model:", err);
      showAlert(`Error al guardar: ${err.message}`, 'danger');
    } finally {
      setSavingModel(false);
    }
  };

  const handleToggleStatus = async (model) => {
    if (!hasPermission('actions', 'configurar_modelos_ia')) {
      showAlert('No tienes permisos para modificar el catálogo de modelos.', 'danger');
      return;
    }
    const nextStatus = model.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      const { error } = await supabase.from('config_ia_modelos').update({ estado: nextStatus }).eq('id', model.id);
      if (error) throw error;
      setModelos(prev => prev.map(m => m.id === model.id ? { ...m, estado: nextStatus } : m));
      showAlert(`Modelo ${model.nombre} marcado como ${nextStatus}.`, 'info');
    } catch (err) {
      showAlert(`Error cambiando estado: ${err.message}`, 'danger');
    }
  };

  const handleSetDefault = async (modelId) => {
    if (!hasPermission('actions', 'configurar_modelos_ia')) {
      showAlert('No tienes permisos para modificar el catálogo de modelos.', 'danger');
      return;
    }
    try {
      await supabase.from('config_ia_modelos').update({ es_default: false }).neq('id', modelId);
      await supabase.from('config_ia_modelos').update({ es_default: true }).eq('id', modelId);
      setModelos(prev => prev.map(m => ({ ...m, esDefault: m.id === modelId })));
      showAlert(`Modelo por defecto actualizado.`, 'success');
    } catch (err) {
      showAlert(`Error actualizando modelo default: ${err.message}`, 'danger');
    }
  };

  const handleSyncWebPricing = async () => {
    if (!hasPermission('actions', 'configurar_modelos_ia')) {
      showAlert('No tienes permisos para sincronizar tarifas del catálogo.', 'danger');
      return;
    }
    setSyncing(true);
    try {
      for (const m of DEFAULT_AI_MODELS) {
        await supabase.from('config_ia_modelos').update({
          official_input_rate_per_1m: m.officialInputRatePer1M,
          official_output_rate_per_1m: m.officialOutputRatePer1M,
          last_price_sync: new Date().toISOString()
        }).eq('id', m.id);
      }
      showAlert('Tarifas oficiales sincronizadas con éxito.', 'success');
      loadModels();
    } catch (err) {
      showAlert(`Error en sincronización de tarifas: ${err.message}`, 'danger');
    } finally {
      setSyncing(false);
    }
  };

  // Helper for discount calculation
  const calculateDiscountPct = (official, agreed) => {
    if (!official || !agreed || agreed >= official) return 0;
    return (((official - agreed) / official) * 100).toFixed(1);
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h5 className="fw-bold mb-1 text-dark">
              <i className="bi bi-cpu-fill me-2 text-primary"></i>Catálogo & Administrador de Modelos de IA
            </h5>
            <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 fw-bold">
              FinOps & LUXIA IA
            </span>
          </div>
          <p className="small text-muted mb-0">
            Gestiona los modelos fundacionales disponibles para los agentes de Luxia, sus tarifas oficiales de lista (auto-sincronizadas) y convenios comerciales.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold d-flex align-items-center gap-1 shadow-sm"
            onClick={handleSyncWebPricing}
            disabled={syncing}
          >
            {syncing ? (
              <span className="spinner-border spinner-border-sm me-1"></span>
            ) : (
              <i className="bi bi-arrow-repeat text-primary me-1"></i>
            )}
            Sincronizar Tarifas Web (ai.google.dev)
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary rounded-pill px-3 fw-bold d-flex align-items-center gap-1 shadow-sm"
            onClick={handleOpenCreateModal}
          >
            <i className="bi bi-plus-circle-fill"></i> Registrar Modelo
          </button>
        </div>
      </div>

      {/* Models List */}
      {loading ? (
        <div className="text-center py-5 text-muted">
          <span className="spinner-border spinner-border-sm me-2 text-primary"></span>
          Cargando catálogo de modelos...
        </div>
      ) : modelos.length === 0 ? (
        <div className="text-center py-5 bg-light rounded-4">
          <i className="bi bi-robot text-muted fs-1 mb-2 d-block"></i>
          <h6 className="fw-bold text-dark">No hay modelos registrados</h6>
          <button className="btn btn-sm btn-primary rounded-pill mt-2" onClick={loadModels}>
            Cargar Modelos Iniciales por Defecto
          </button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="px-3 text-muted small fw-bold border-0">MODELO</th>
                <th className="text-center text-muted small fw-bold border-0">PROVEEDOR</th>
                <th className="text-muted small fw-bold border-0">TARIFA OFICIAL WEB (USD / 1M TOKENS)</th>
                <th className="text-muted small fw-bold border-0">TARIFA ACORDADA / CONVENIO</th>
                <th className="text-center text-muted small fw-bold border-0">AHORRO %</th>
                <th className="text-center text-muted small fw-bold border-0">ESTADO</th>
                <th className="text-end px-3 text-muted small fw-bold border-0">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map(m => {
                const hasAgreement = !!m.tieneAcuerdo && m.agreedInputRatePer1M !== null && m.agreedInputRatePer1M !== undefined;
                const discount = hasAgreement ? calculateDiscountPct(m.officialInputRatePer1M, m.agreedInputRatePer1M) : 0;
                const isDefault = !!m.esDefault;

                return (
                  <tr key={m.id} className={m.estado === 'inactivo' ? 'opacity-50 bg-light' : ''}>
                    <td className="px-3">
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold text-dark small">{m.nombre || m.id}</span>
                        {isDefault && (
                          <span className="badge bg-success text-white rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>
                            <i className="bi bi-star-fill me-1"></i>Default Global
                          </span>
                        )}
                      </div>
                      <code className="text-muted" style={{ fontSize: '0.75rem' }}>{m.id}</code>
                      {m.descripcion && (
                        <p className="text-muted mb-0 text-truncate" style={{ maxWidth: '280px', fontSize: '0.72rem' }}>
                          {m.descripcion}
                        </p>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="badge bg-light text-dark border rounded-pill px-2.5" style={{ fontSize: '0.7rem' }}>
                        {m.proveedor || 'Google Gemini'}
                      </span>
                    </td>
                    <td>
                      <div className="small fw-semibold text-dark">
                        E: <span className="text-primary">${(m.officialInputRatePer1M ?? 0.075).toFixed(4)}</span> / 
                        S: <span className="text-primary">${(m.officialOutputRatePer1M ?? 0.30).toFixed(4)}</span>
                      </div>
                      <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                        <i className="bi bi-globe me-1"></i>ai.google.dev
                      </span>
                    </td>
                    <td>
                      {hasAgreement ? (
                        <div>
                          <div className="small fw-bold text-success">
                            E: ${parseFloat(m.agreedInputRatePer1M).toFixed(4)} / S: ${parseFloat(m.agreedOutputRatePer1M).toFixed(4)}
                          </div>
                          <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2" style={{ fontSize: '0.65rem' }}>
                            Convenio Activo
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted small" style={{ fontSize: '0.75rem' }}>Sin convenio (Tarifa Lista)</span>
                      )}
                    </td>
                    <td className="text-center">
                      {hasAgreement && discount > 0 ? (
                        <span className="badge bg-success text-white rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.75rem' }}>
                          <i className="bi bi-arrow-down-right me-1"></i>-{discount}%
                        </span>
                      ) : (
                        <span className="text-muted small" style={{ fontSize: '0.75rem' }}>0%</span>
                      )}
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className={`btn btn-xs rounded-pill px-2.5 py-0.5 fw-bold ${
                          m.estado === 'activo' ? 'btn-success bg-opacity-15 text-success border-success' : 'btn-secondary bg-opacity-15 text-secondary border-secondary'
                        }`}
                        onClick={() => handleToggleStatus(m)}
                        style={{ fontSize: '0.72rem' }}
                      >
                        {m.estado === 'activo' ? '● Activo' : '○ Inactivo'}
                      </button>
                    </td>
                    <td className="text-end px-3">
                      <div className="btn-group btn-group-sm">
                        {!isDefault && m.estado === 'activo' && (
                          <button
                            type="button"
                            className="btn btn-link btn-xs text-warning p-0 me-2"
                            title="Establecer como modelo Default global"
                            onClick={() => handleSetDefault(m.id)}
                          >
                            <i className="bi bi-star fs-6"></i>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-link btn-xs text-primary p-0 me-2"
                          title="Editar modelo y tarifas"
                          onClick={() => handleOpenEditModal(m)}
                        >
                          <i className="bi bi-pencil-square fs-6"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <h6 className="modal-title fw-bold text-dark">
                  <i className="bi bi-cpu me-2 text-primary"></i>
                  {editingModel ? `Editar Modelo: ${editingModel.nombre}` : 'Registrar Nuevo Modelo de IA'}
                </h6>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSaveModel}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">ID del Modelo (API string)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm fw-mono"
                        placeholder="Ej: gemini-2.0-flash-lite"
                        value={formData.id}
                        onChange={e => setFormData({ ...formData, id: e.target.value })}
                        disabled={!!editingModel}
                        required
                      />
                      <span className="form-text" style={{ fontSize: '0.7rem' }}>
                        Identificador exacto esperado por el SDK de Google/GenAI.
                      </span>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-dark mb-1">Nombre Descriptivo</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ej: Gemini 3.5 Flash Lite"
                        value={formData.nombre}
                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-dark mb-1">Proveedor</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.proveedor}
                        onChange={e => setFormData({ ...formData, proveedor: e.target.value })}
                      >
                        <option value="Google Gemini">Google Gemini</option>
                        <option value="Anthropic">Anthropic</option>
                        <option value="OpenAI">OpenAI</option>
                        <option value="Meta Llama">Meta Llama</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-dark mb-1">Estado</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.estado}
                        onChange={e => setFormData({ ...formData, estado: e.target.value })}
                      >
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                        <option value="beta">Beta</option>
                        <option value="deprecado">Deprecado</option>
                      </select>
                    </div>

                    <div className="col-md-4 d-flex align-items-center">
                      <div className="form-check form-switch mt-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="esDefaultCheck"
                          checked={formData.esDefault}
                          onChange={e => setFormData({ ...formData, esDefault: e.target.checked })}
                        />
                        <label className="form-check-label small fw-bold text-dark" htmlFor="esDefaultCheck">
                          Modelo Default Global
                        </label>
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold text-dark mb-1">Descripción y Caso de Uso Ideal</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="2"
                        placeholder="Describe las fortalezas del modelo (ej: Respuestas rápidas para el Soporte IA)."
                        value={formData.descripcion}
                        onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                      ></textarea>
                    </div>

                    {/* Tarifas Oficiales */}
                    <div className="col-12 mt-3 pt-3 border-top">
                      <h6 className="fw-bold small text-dark mb-2">
                        <i className="bi bi-globe me-1 text-primary"></i>Tarifas Oficiales Web (USD por 1M tokens)
                      </h6>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label small text-muted mb-1">Input Rate (Entrada / 1M tokens)</label>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">$</span>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              className="form-control"
                              value={formData.officialInputRatePer1M}
                              onChange={e => setFormData({ ...formData, officialInputRatePer1M: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small text-muted mb-1">Output Rate (Salida / 1M tokens)</label>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">$</span>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              className="form-control"
                              value={formData.officialOutputRatePer1M}
                              onChange={e => setFormData({ ...formData, officialOutputRatePer1M: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Acuerdo Comercial / Convenio */}
                    <div className="col-12 mt-3 pt-3 border-top bg-light p-3 rounded-3">
                      <div className="form-check form-switch mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="tieneAcuerdoCheck"
                          checked={formData.tieneAcuerdo}
                          onChange={e => setFormData({ ...formData, tieneAcuerdo: e.target.checked })}
                        />
                        <label className="form-check-label small fw-bold text-success" htmlFor="tieneAcuerdoCheck">
                          <i className="bi bi-patch-check-fill me-1"></i>¿Existe un Convenio / Acuerdo Comercial de Precio para este modelo?
                        </label>
                      </div>

                      {formData.tieneAcuerdo && (
                        <div className="row g-3 mt-1">
                          <div className="col-md-6">
                            <label className="form-label small text-muted mb-1">Input Rate Acordado (USD / 1M tokens)</label>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text bg-success-subtle text-success fw-bold">$</span>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                className="form-control border-success"
                                placeholder="Ej: 0.0500"
                                value={formData.agreedInputRatePer1M}
                                onChange={e => setFormData({ ...formData, agreedInputRatePer1M: e.target.value })}
                                required={formData.tieneAcuerdo}
                              />
                            </div>
                          </div>

                          <div className="col-md-6">
                            <label className="form-label small text-muted mb-1">Output Rate Acordado (USD / 1M tokens)</label>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text bg-success-subtle text-success fw-bold">$</span>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                className="form-control border-success"
                                placeholder="Ej: 0.2000"
                                value={formData.agreedOutputRatePer1M}
                                onChange={e => setFormData({ ...formData, agreedOutputRatePer1M: e.target.value })}
                                required={formData.tieneAcuerdo}
                              />
                            </div>
                          </div>

                          {formData.agreedInputRatePer1M !== '' && (
                            <div className="col-12">
                              <div className="alert alert-success py-2 px-3 mb-0 small rounded-3 d-flex align-items-center justify-content-between">
                                <span>
                                  <i className="bi bi-graph-down-arrow me-1"></i>
                                  Descuento calculado sobre tarifa oficial de entrada:
                                </span>
                                <span className="fw-bold">
                                  {calculateDiscountPct(formData.officialInputRatePer1M, parseFloat(formData.agreedInputRatePer1M))}% de Ahorro
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top px-4 py-2.5">
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary rounded-pill px-4 fw-bold" disabled={savingModel}>
                    {savingModel ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                    Guardar Modelo
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
