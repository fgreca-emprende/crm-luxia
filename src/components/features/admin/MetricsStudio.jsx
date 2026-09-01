import { useState, useEffect, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { ConfirmModal } from './ConfirmModal';

export function MetricsStudio({ user }) {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dashboardTab, setDashboardTab] = useState('cartera');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { showAlert } = useToast();

  const [feedbackText, setFeedbackText] = useState({});
  const [showFeedbackInput, setShowFeedbackInput] = useState({});
  
  const [iaPausada, setIaPausada] = useState(false);
  const [architectDisabled, setArchitectDisabled] = useState(false);

  const loadKpis = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigGeneral('kpi_definitions');
      setKpis(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Error loading kpi_definitions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    const fetchIaStatus = async () => {
      try {
        const usage = await getConfigGeneral('config_ia_usage');
        if (usage) {
          const paused = (usage.disabledByBudget === true && usage.autoshutoffActive === true) || usage.manualPause === true;
          setIaPausada(paused);
        }
        const architect = await getConfigGeneral('config_ia_luxia_architect');
        if (architect) {
          setArchitectDisabled(architect.disabled === true);
        }
      } catch (err) {
        console.warn("Error fetching IA status in MetricsStudio:", err);
      }
    };
    fetchIaStatus();
  }, []);

  const handleCreateKPI = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setIsProcessing(true);
    try {
      const kpiId = `kpi_${Date.now()}`;
      const newKpi = {
        id: kpiId,
        nombre: prompt.length > 35 ? prompt.substring(0, 35) + '...' : prompt,
        descripcion: prompt,
        promptOriginal: prompt,
        chartType: 'bar',
        collection: 'clientes',
        updateFrequencyHours: 24,
        dashboardTab: dashboardTab,
        createdBy: user?.email || 'Desconocido',
        createdAt: new Date().toISOString(),
        status: 'active'
      };
      
      const updated = [newKpi, ...kpis];
      await setConfigGeneral('kpi_definitions', updated);
      setKpis(updated);
      setPrompt('');
      showAlert('Nuevo KPI personalizado creado correctamente.', 'success');
    } catch (err) {
      showAlert(`Error: ${err.message}`, 'danger');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDeleteAction = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      const updated = kpis.filter(k => k.id !== id);
      await setConfigGeneral('kpi_definitions', updated);
      setKpis(updated);
      showAlert('KPI eliminado.', 'success');
    } catch (err) {
      showAlert(`Error eliminando: ${err.message}`, 'danger');
    }
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const toggleStatus = async (kpi) => {
    try {
      const newStatus = kpi.status === 'active' ? 'paused' : 'active';
      const updated = kpis.map(k => k.id === kpi.id ? { ...k, status: newStatus } : k);
      await setConfigGeneral('kpi_definitions', updated);
      setKpis(updated);
      showAlert(`KPI ${newStatus === 'active' ? 'activado' : 'pausado'}.`, 'success');
    } catch (err) {
      showAlert(`Error actualizando: ${err.message}`, 'danger');
    }
  };

  const retryKpi = async (kpi) => {
    try {
      const updated = kpis.map(k => k.id === kpi.id ? { ...k, status: 'active', errorLog: null } : k);
      await setConfigGeneral('kpi_definitions', updated);
      setKpis(updated);
      showAlert('Reintentando análisis con la IA...', 'info');
    } catch (err) {
      showAlert(`Error reintentando: ${err.message}`, 'danger');
    }
  };

  const handleLikeKpi = async (kpi) => {
    try {
      const updated = kpis.map(k => k.id === kpi.id ? { ...k, feedback: 'positive' } : k);
      await setConfigGeneral('kpi_definitions', updated);
      setKpis(updated);
      showAlert('¡Gracias! Registramos este KPI como ejemplo de traducción exitosa.', 'success');
    } catch (err) {
      showAlert('Error al enviar feedback: ' + err.message, 'danger');
    }
  };

  const handleDislikeKpiSubmit = async (kpi) => {
    const correction = feedbackText[kpi.id] || '';
    if (!correction.trim()) {
      showAlert('Por favor ingresa una corrección o descripción del error.', 'warning');
      return;
    }

    try {
      const updated = kpis.map(k => k.id === kpi.id ? { ...k, feedback: 'negative', feedbackComment: correction } : k);
      await setConfigGeneral('kpi_definitions', updated);
      setKpis(updated);
      setShowFeedbackInput(prev => ({ ...prev, [kpi.id]: false }));
      showAlert('¡Gracias! Registramos tu corrección para mejorar los modelos.', 'info');
    } catch (err) {
      showAlert('Error al enviar feedback: ' + err.message, 'danger');
    }
  };

  return (
    <div className="row g-4 text-start">
      <div className="col-lg-5">
        <div className="apple-card border rounded-4 p-4 h-100 shadow-sm" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
          <h5 className="fw-bold mb-2 d-flex align-items-center" style={{ color: 'var(--apple-text-primary)' }}>
            <i className="bi bi-robot text-primary me-2 fs-5"></i>Arquitecto de Datos (IA)
          </h5>
          <p className="small text-muted mb-4" style={{ fontSize: '0.82rem' }}>
            Describe el indicador agronómico o comercial que deseas medir en lenguaje natural. El agente analizará el esquema y construirá el gráfico dinámicamente.
          </p>
          
          {/* Alerta de Asistente IA Desactivado */}
          {(iaPausada || architectDisabled) && (
            <div className="alert alert-warning py-2.5 px-3 rounded-3 mb-3 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center gap-2 animate__animated animate__fadeIn" style={{ fontSize: '0.72rem' }}>
              <i className="bi bi-exclamation-triangle-fill fs-6 text-warning"></i>
              <div className="text-start">
                <strong>Asistente IA Inactivo:</strong> La generación de KPIs por IA ha sido desactivada {iaPausada ? 'por límite de presupuesto' : 'globalmente por la administración'}.
              </div>
            </div>
          )}

          <form onSubmit={handleCreateKPI} className="d-flex flex-column gap-3">
            <div>
              <label className="form-label small fw-bold mb-1" style={{ color: 'var(--apple-text-primary)' }}>¿Qué quieres medir?</label>
              <textarea 
                className="form-control rounded-3" 
                rows="4" 
                placeholder="Ej: Muéstrame el total de hectáreas cubiertas agrupadas por cultivo principal en un gráfico de barras."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={isProcessing || iaPausada || architectDisabled}
                required
                style={{ background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
              ></textarea>
            </div>
            <div>
              <label className="form-label small fw-bold mb-1" style={{ color: 'var(--apple-text-primary)' }}>Solapa de Destino en el Dashboard</label>
              <select 
                className="form-select rounded-3 mb-2" 
                value={dashboardTab} 
                onChange={e => setDashboardTab(e.target.value)}
                disabled={isProcessing || iaPausada || architectDisabled}
                style={{ background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
              >
                <option value="cartera">Resumen de Cartera Agrícola</option>
                <option value="pipeline">Embudo y Pipeline Comercial</option>
                <option value="cultivos">Distribución por Cultivos & Has</option>
                <option value="fitosanitarios">Líneas de Fitosanitarios</option>
                <option value="adopcion">Adopción y Rendimiento</option>
              </select>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary rounded-pill fw-bold shadow-sm py-2"
              disabled={isProcessing || !prompt.trim() || iaPausada || architectDisabled}
            >
              {isProcessing ? (
                <><span className="spinner-border spinner-border-sm me-2"></span> Analizando esquema...</>
              ) : (
                <><i className="bi bi-magic me-2"></i> Generar KPI Dinámico</>
              )}
            </button>
          </form>
          
          <div className="mt-4 pt-3 border-top" style={{ borderColor: 'var(--apple-border)' }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-lightbulb-fill text-warning"></i>
              <span className="small fw-bold" style={{ color: 'var(--apple-text-primary)' }}>Ejemplos de Métricas Agropecuarias:</span>
            </div>
            <div className="d-flex flex-column gap-1.5 mb-3">
              <button 
                type="button"
                className="btn btn-xs btn-outline-secondary text-start rounded-3 px-2.5 py-1.5 border"
                style={{ fontSize: '0.74rem', background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
                onClick={() => setPrompt("Muéstrame la distribución de clientes y cuentas por Segmento Agropecuario (Grandes Productores, Cooperativas, Distribuidores) en un gráfico de torta.")}
              >
                📊 Clientes por Segmento Agro (Grandes Productores / Cooperativas / Distribuidores)
              </button>
              <button 
                type="button"
                className="btn btn-xs btn-outline-secondary text-start rounded-3 px-2.5 py-1.5 border"
                style={{ fontSize: '0.74rem', background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
                onClick={() => setPrompt("Grafica el total de hectáreas agrícolas estimadas agrupadas por cultivo principal (Soja, Maíz, Trigo, Girasol) en un gráfico de barras.")}
              >
                🌱 Superficie Agrícola Estimada (Has) por Cultivo Principal
              </button>
              <button 
                type="button"
                className="btn btn-xs btn-outline-secondary text-start rounded-3 px-2.5 py-1.5 border"
                style={{ fontSize: '0.74rem', background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
                onClick={() => setPrompt("Distribución de contratos de suministro fitosanitario por modalidad de pago (Canje Cereal, Dólar Link, Contado) en un gráfico de barras.")}
              >
                📜 Contratos de Suministro por Modalidad de Pago (Canje Cereal / Dólar Link)
              </button>
              <button 
                type="button"
                className="btn btn-xs btn-outline-secondary text-start rounded-3 px-2.5 py-1.5 border"
                style={{ fontSize: '0.74rem', background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
                onClick={() => setPrompt("Monto estimado acumulado de oportunidades ganadas agrupadas por línea de fitosanitarios (Herbicidas, Fungicidas, Insecticidas, Tratamiento de Semillas).")}
              >
                🌾 Oportunidades Ganadas por Familia Fitosanitaria
              </button>
              <button 
                type="button"
                className="btn btn-xs btn-outline-secondary text-start rounded-3 px-2.5 py-1.5 border"
                style={{ fontSize: '0.74rem', background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
                onClick={() => setPrompt("Cantidad de prospectos (leads) calificados agrupados por zona productiva agrícola y rango de hectáreas.")}
              >
                🚜 Leads Calificados por Zona Productiva y Superficie
              </button>
            </div>

            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-info-circle-fill text-muted"></i>
              <span className="small fw-bold text-muted">¿Cómo funciona?</span>
            </div>
            <ul className="small text-muted ps-3 mb-0" style={{ fontSize: '0.75rem' }}>
              <li className="mb-1">El agente valida que las entidades existan en la base de datos de LUXIA.</li>
              <li className="mb-1">Se configura una regla de agregación periódica para el gráfico.</li>
              <li>Podrás previsualizar y aprobar el KPI antes de que aparezca en el Dashboard Global.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="col-lg-7">
        <div className="apple-card border rounded-4 p-4 h-100 shadow-sm" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h5 className="fw-bold mb-0 d-flex align-items-center" style={{ color: 'var(--apple-text-primary)' }}>
              <i className="bi bi-collection-fill text-primary me-2"></i>KPIs Dinámicos
            </h5>
            <span className="badge rounded-pill border" style={{ background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}>
              {kpis.length} definidos
            </span>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : kpis.length === 0 ? (
            <div className="text-center text-muted py-5 px-3 rounded-4 border border-dashed" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
              <i className="bi bi-bar-chart fs-1 text-secondary mb-3 d-block"></i>
              <p className="mb-0">Aún no has creado KPIs dinámicos. Utiliza el Arquitecto de Datos para generar el primero.</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {kpis.map(kpi => (
                <div key={kpi.id} className="p-3 border rounded-4 shadow-2xs position-relative" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h6 className="fw-bold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--apple-text-primary)' }}>
                        {kpi.nombre}
                        {kpi.status === 'draft' && <span className="badge bg-warning bg-opacity-10 text-warning border border-warning rounded-pill" style={{fontSize: '0.6rem'}}><span className="spinner-border spinner-border-sm me-1" style={{width: '0.6rem', height: '0.6rem'}}></span>En Análisis</span>}
                        {kpi.status === 'active' && <span className="badge bg-success bg-opacity-10 text-success border border-success rounded-pill" style={{fontSize: '0.6rem'}}>Activo</span>}
                        {kpi.status === 'paused' && <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary rounded-pill" style={{fontSize: '0.6rem'}}>Pausado</span>}
                        {kpi.status === 'error' && <span className="badge bg-danger bg-opacity-10 text-danger border border-danger rounded-pill" style={{fontSize: '0.6rem'}} title={kpi.errorLog}><i className="bi bi-exclamation-triangle-fill me-1"></i>Error</span>}
                      </h6>
                      <p className="small text-muted mb-0 lh-sm" style={{ fontSize: '0.75rem' }}>{kpi.descripcion}</p>
                      {kpi.status === 'error' && kpi.errorLog && (
                        <div className="mt-2 p-2 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 text-danger lh-sm" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-exclamation-circle-fill me-1"></i> <strong>Motivo del fallo:</strong> {kpi.errorLog}
                        </div>
                      )}
                    </div>
                    <div className="dropdown position-relative">
                      <button 
                        className="btn btn-link text-muted p-0 border-0" 
                        type="button" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === kpi.id ? null : kpi.id);
                        }}
                      >
                        <i className="bi bi-three-dots-vertical"></i>
                      </button>
                      {activeDropdown === kpi.id && (
                        <>
                          <div 
                            className="position-fixed top-0 start-0 w-100 h-100" 
                            style={{ zIndex: 999 }} 
                            onClick={() => setActiveDropdown(null)}
                          ></div>
                          <ul className="dropdown-menu dropdown-menu-end shadow-sm border show" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000, background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
                            {(kpi.status === 'active' || kpi.status === 'paused') && (
                              <li>
                                <button className="dropdown-item small" style={{ color: 'var(--apple-text-primary)' }} onClick={() => { setActiveDropdown(null); toggleStatus(kpi); }}>
                                  <i className={`bi ${kpi.status === 'active' ? 'bi-pause-circle' : 'bi-play-circle'} me-2`}></i>
                                  {kpi.status === 'active' ? 'Pausar KPI' : 'Activar KPI'}
                                </button>
                              </li>
                            )}
                            {kpi.status !== 'draft' && (
                              <li>
                                <button className="dropdown-item small text-primary" onClick={() => { setActiveDropdown(null); retryKpi(kpi); }}>
                                  <i className="bi bi-arrow-repeat me-2"></i>{kpi.status === 'error' ? 'Reintentar Análisis' : 'Regenerar con IA'}
                                </button>
                              </li>
                            )}
                            <li>
                              <button className="dropdown-item small text-danger" onClick={() => { setActiveDropdown(null); handleDelete(kpi.id); }}>
                                <i className="bi bi-trash me-2"></i>Eliminar
                              </button>
                            </li>
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top" style={{ borderColor: 'var(--apple-border)' }}>
                    <div className="d-flex gap-2 flex-wrap">
                      <span className="badge border" style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }} title="Destino en el Dashboard">
                        <i className="bi bi-layout-text-window me-1"></i>
                        {kpi.dashboardTab === 'pipeline' ? 'Embudo Comercial' : kpi.dashboardTab === 'cartera' ? 'Resumen Cartera' : kpi.dashboardTab === 'cultivos' ? 'Cultivos & Has' : kpi.dashboardTab === 'fitosanitarios' ? 'Fitosanitarios' : (kpi.dashboardTab || 'Global')}
                      </span>
                      <span className="badge border" style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }} title="Tipo de Gráfico">
                        <i className={`bi bi-${kpi.chartType === 'pie' ? 'pie-chart' : kpi.chartType === 'line' ? 'graph-up' : 'bar-chart'} me-1`}></i>
                        {kpi.status === 'draft' ? 'Calculando...' : kpi.chartType}
                      </span>
                      <span className="badge border" style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }} title="Colección de Datos">
                        <i className="bi bi-database me-1"></i>
                        {kpi.status === 'draft' ? 'Buscando...' : kpi.collection}
                      </span>
                      <span className="badge border" style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }} title="Frecuencia de Actualización">
                        <i className="bi bi-clock-history me-1"></i>
                        {kpi.updateFrequencyHours}h
                      </span>
                    </div>

                    {kpi.status !== 'draft' && (
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-muted small" style={{ fontSize: '0.7rem' }}>¿Calidad de IA?</span>
                        <button
                          type="button"
                          className={`btn btn-xs p-1 lh-1 rounded-circle border-0 ${kpi.feedback === 'positive' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                          style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => handleLikeKpi(kpi)}
                          title="Fórmula e IA Correctas"
                          disabled={kpi.feedback === 'positive'}
                        >
                          <i className="bi bi-hand-thumbs-up-fill" style={{ fontSize: '0.8rem' }}></i>
                        </button>
                        <button
                          type="button"
                          className={`btn btn-xs p-1 lh-1 rounded-circle border-0 ${kpi.feedback === 'negative' ? 'btn-danger text-white' : 'btn-outline-secondary'}`}
                          style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => setShowFeedbackInput(prev => ({ ...prev, [kpi.id]: !prev[kpi.id] }))}
                          title="Reportar error en la consulta"
                        >
                          <i className="bi bi-hand-thumbs-down-fill" style={{ fontSize: '0.8rem' }}></i>
                        </button>
                      </div>
                    )}
                  </div>

                  {showFeedbackInput[kpi.id] && (
                    <div className="mt-2 p-2 border border-danger border-opacity-25 rounded-3" style={{ background: 'var(--apple-surface-card)' }}>
                      <div className="d-flex gap-2">
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-3"
                          placeholder="Indica qué campos debió usar o la corrección..."
                          value={feedbackText[kpi.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFeedbackText(prev => ({ ...prev, [kpi.id]: val }));
                          }}
                          style={{ background: 'var(--apple-surface-elevated)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-danger rounded-pill px-3"
                          onClick={() => handleDislikeKpiSubmit(kpi)}
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        show={!!confirmDeleteId}
        title="Eliminar KPI Dinámico"
        message="¿Seguro que deseas eliminar este KPI dinámico? Esta acción no se puede deshacer."
        confirmBtnClass="btn-danger"
        confirmText="Eliminar"
        onConfirm={confirmDeleteAction}
        onClose={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
