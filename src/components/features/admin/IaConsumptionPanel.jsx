import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { ConfirmModal } from './ConfirmModal';
import { AdminIaModelsManager } from './AdminIaModelsManager';
import { useUserRole } from '../../../contexts/UserRoleContext';

export function IaConsumptionPanel({ selectedCountry }) {
  const { role, userTeam, getDataScope, userEmail } = useUserRole();
  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);
  const consumoIaScope = getDataScope('consumo_ia');

  const [logsIaConsumo, setLogsIaConsumo] = useState([]);
  const [logsIaErrores, setLogsIaErrores] = useState([]);
  const [logsIaLoading, setLogsIaLoading] = useState(false);
  const [filtroPeriodoIa, setFiltroPeriodoIa] = useState('este_mes');
  const { showAlert } = useToast();
  const [budgetConfig, setBudgetConfig] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [showModelsModal, setShowModelsModal] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, ARS: 900, CLP: 940, PEN: 3.7, COP: 4100, MXN: 18 });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const data = await getConfigGeneral('rates');
        if (data && data.rates) {
          setExchangeRates(data.rates);
        }
      } catch (err) {
        console.warn("Error loading exchange rates in IaConsumptionPanel:", err);
      }
    };
    fetchRates();
  }, []);

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

  const renderCosto = (costInUsd, decimals = 5) => {
    if (selectedCountry) {
      const localCurr = getCountryCurrency(selectedCountry);
      const localRate = exchangeRates[localCurr] || 1.0;
      const localCost = costInUsd * localRate;
      return `${localCurr} ${localCost.toFixed(decimals === 5 ? 2 : decimals)} / USD $${costInUsd.toFixed(decimals)}`;
    }
    return `USD $${costInUsd.toFixed(decimals)}`;
  };

  const getCostoHeaderLabel = () => {
    return `COSTO (${selectedCountry ? `${getCountryCurrency(selectedCountry)} / USD` : 'USD'})`;
  };

  const filterByConsumptionScope = useCallback((log) => {
    if (consumoIaScope === 'ALL') return true;
    if (consumoIaScope === 'NONE') return false;

    const rawAmKey = log.triggeredBy || log.user_email || "System/Cron";
    const amKey = rawAmKey.split(' (')[0].trim().toLowerCase();

    const isSelf = amKey === (userEmail || '').toLowerCase().trim();
    if (consumoIaScope === 'OWN') {
      return isSelf || amKey === 'system/cron';
    }
    if (consumoIaScope === 'TEAM') {
      if (isSelf || amKey === 'system/cron') return true;
      const userObj = usuarios.find(u => u.email?.toLowerCase().trim() === amKey);
      return userObj && normalizarEquipo(userObj.equipo) === normalizedTeam;
    }
    return false;
  }, [consumoIaScope, usuarios, normalizedTeam, userEmail]);

  const loadLogsIaConsumo = useCallback(async () => {
    setLogsIaLoading(true);
    try {
      const { data, error } = await supabase
        .from('logs_ia_consumo')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);
      if (error) throw error;
      const loaded = (data || []).filter(filterByConsumptionScope);
      setLogsIaConsumo(loaded);
    } catch (err) {
      console.warn("Error cargando consumo de IA:", err);
      showAlert(`Error cargando consumo de IA: ${err.message}`, 'danger');
    } finally {
      setLogsIaLoading(false);
    }
  }, [showAlert, filterByConsumptionScope]);

  const loadLogsIaErrores = useCallback(async () => {
    try {
      const data = await getConfigGeneral('logs_ia_errores');
      const loaded = (Array.isArray(data) ? data : []).filter(filterByConsumptionScope);
      setLogsIaErrores(loaded);
    } catch (err) {
      console.warn("Error loading IA errors:", err);
    }
  }, [filterByConsumptionScope]);

  const loadBudgetConfig = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const data = await getConfigGeneral('config_ia_usage');
      if (data) {
        setBudgetConfig(data);
      }
    } catch (err) {
      console.warn("Error loading budget config:", err);
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  const loadUsuarios = useCallback(async () => {
    try {
      const { data } = await supabase.from('usuarios').select('*');
      setUsuarios(data || []);
    } catch (err) {
      console.warn("Error loading usuarios:", err);
    }
  }, []);

  const handleSaveBudgetConfig = async (newConfig) => {
    setSavingConfig(true);
    try {
      const updated = { ...(budgetConfig || {}), ...newConfig };
      await setConfigGeneral('config_ia_usage', updated);
      setBudgetConfig(updated);
      showAlert('Límite de presupuesto de IA guardado.', 'success');
    } catch (err) {
      showAlert(`Error al guardar: ${err.message}`, 'danger');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleReactivateIa = () => {
    setShowReactivateConfirm(true);
  };

  const executeReactivate = async (resetCost) => {
    setShowReactivateConfirm(false);
    setSavingConfig(true);
    try {
      const updates = {
        ...(budgetConfig || {}),
        disabledByBudget: false,
        lastAlertSent: 'none'
      };
      if (resetCost) {
        updates.accumulatedCostUsd = 0.0;
        updates.accumulatedTokens = 0;
      }
      await setConfigGeneral('config_ia_usage', updates);
      setBudgetConfig(updates);
      showAlert('Servicio de IA reactivado y reconfigurado', 'success');
    } catch (err) {
      showAlert(`Error al reactivar: ${err.message}`, 'danger');
    } finally {
      setSavingConfig(false);
    }
  };

  useEffect(() => {
    loadBudgetConfig();
    loadUsuarios();
  }, [loadBudgetConfig, loadUsuarios]);

  useEffect(() => {
    if (usuarios.length > 0 || consumoIaScope !== 'TEAM') {
      loadLogsIaConsumo();
      loadLogsIaErrores();
    }
  }, [usuarios, loadLogsIaConsumo, loadLogsIaErrores, consumoIaScope]);

  const getAggregatedData = () => {
    let totalCost = 0;
    let totalOfficialCost = 0;
    let totalSavings = 0;
    let totalTokens = 0;
    const clientMap = {};
    const amMap = {};
    const modelMap = {};
    const typeMap = {};

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const logsFiltrados = logsIaConsumo.filter(log => {
      if (filtroPeriodoIa === 'total') return true;
      if (!log.timestamp) return false;
      
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      
      if (filtroPeriodoIa === 'este_mes') {
        return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
      } else if (filtroPeriodoIa === 'mes_pasado') {
        let lastMonth = currentMonth - 1;
        let lastYear = currentYear;
        if (lastMonth < 0) {
          lastMonth = 11;
          lastYear -= 1;
        }
        return logDate.getMonth() === lastMonth && logDate.getFullYear() === lastYear;
      } else if (filtroPeriodoIa === 'este_anio') {
        return logDate.getFullYear() === currentYear;
      }
      return true;
    });

    logsFiltrados.forEach(log => {
      const cost = log.estimatedCostUsd || 0;
      const official = log.officialCostUsd || cost;
      const savings = log.savingsUsd || Math.max(0, official - cost);
      const tokens = log.totalTokens || 0;

      totalCost += cost;
      totalOfficialCost += official;
      totalSavings += savings;
      totalTokens += tokens;

      const isFeatureLog = 
        log.clienteId === "SYSTEM" || 
        log.clienteId === "Capacitacion" || 
        log.type === "capacitacion_grading" || 
        log.type === "metrics_architect" ||
        log.type === "lead_scoring" ||
        log.type === "pipeline_health" ||
        log.nombreEmpresa === "Triage Evaluation" ||
        log.nombreEmpresa === "Metrics Studio" ||
        (log.nombreEmpresa && log.nombreEmpresa.startsWith("Examen:"));

      if (!isFeatureLog) {
        const clientKey = log.nombreEmpresa || "Desconocido";
        if (!clientMap[clientKey]) clientMap[clientKey] = { name: clientKey, cost: 0, count: 0 };
        clientMap[clientKey].cost += cost;
        clientMap[clientKey].count += 1;
      }

      const rawAmKey = log.triggeredBy || "System/Cron";
      // Clean up suffixes like " (vía Copiloto - Acción Rápida)" to summarize correctly
      const amKey = rawAmKey.split(' (')[0].trim();
      
      if (!amMap[amKey]) {
        const userObj = usuarios.find(u => u.email === amKey);
        const rol = userObj ? (userObj.rol || 'N/A') : (amKey === 'System/Cron' ? 'Sistema' : 'N/A');
        amMap[amKey] = { name: amKey, rol, cost: 0, count: 0 };
      }
      amMap[amKey].cost += cost;
      amMap[amKey].count += 1;

      const modelKey = log.modelName || "gemini-2.0-flash";
      if (!modelMap[modelKey]) modelMap[modelKey] = { name: modelKey, cost: 0, count: 0 };
      modelMap[modelKey].cost += cost;
      modelMap[modelKey].count += 1;

      const rawType = log.type || 'cliente_holistico';
      let typeLabel = 'Análisis Holístico';
      if (rawType === 'contrato_multimodal') typeLabel = 'Auditoría Contratos';
      else if (rawType === 'gmail_sync') typeLabel = 'Sincronización Gmail';
      else if (rawType === 'whatsapp_sync') typeLabel = 'Sincronización WhatsApp';
      else if (rawType === 'copilot_agent' || rawType === 'copiloto_action_only') typeLabel = 'LUXIA Copiloto';
      else if (rawType === 'metrics_architect') typeLabel = 'Metrics Studio';
      else if (rawType === 'luxia_search') typeLabel = 'Búsqueda Inteligente';
      else if (rawType === 'capacitacion_grading') typeLabel = 'Evaluación Capacitación';
      else if (rawType === 'support_agent') typeLabel = 'Soporte Técnico IA';
      else if (rawType === 'lead_scoring') typeLabel = 'LUXIA Lead Scorer';
      else if (rawType === 'pipeline_health') typeLabel = 'LUXIA Pipeline Health';
      
      if (!typeMap[typeLabel]) typeMap[typeLabel] = { name: typeLabel, cost: 0, count: 0 };
      typeMap[typeLabel].cost += cost;
      typeMap[typeLabel].count += 1;
    });

    const topClients = Object.values(clientMap).sort((a, b) => b.cost - a.cost).slice(0, 5);
    const topAMs = Object.values(amMap).sort((a, b) => b.cost - a.cost).slice(0, 5);
    const modelStats = Object.values(modelMap).sort((a, b) => b.cost - a.cost);
    const featureStats = Object.values(typeMap).sort((a, b) => b.cost - a.cost);

    return { totalCost, totalOfficialCost, totalSavings, totalTokens, topClients, topAMs, modelStats, featureStats, totalLogs: logsFiltrados.length };
  };

  const { totalCost, totalOfficialCost, totalSavings, totalTokens, topClients, topAMs, modelStats, featureStats, totalLogs } = getAggregatedData();

  return (
    <div className="row g-4 mb-4">
      <div className="col-12">
        <div className="card border-0 bg-transparent p-0">
          <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold mb-1 text-dark"><i className="bi bi-bar-chart-line-fill me-2 text-primary"></i>Dashboard de Consumo y Costo de IA</h5>
              <p className="small text-muted mb-0">Auditoría en tiempo real del uso de tokens y estimación de costos acumulados por cliente, AM y modelo.</p>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <button 
                className="btn btn-sm btn-primary rounded-pill px-3 shadow-sm d-flex align-items-center gap-1"
                onClick={() => setShowModelsModal(true)}
              >
                <i className="bi bi-cpu-fill me-1"></i>Administrar Modelos & Tarifas
              </button>
              <select 
                className="form-select form-select-sm rounded-pill fw-bold shadow-sm"
                style={{ width: 'auto', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}
                value={filtroPeriodoIa}
                onChange={e => setFiltroPeriodoIa(e.target.value)}
              >
                <option value="este_mes">Este Mes</option>
                <option value="mes_pasado">Mes Pasado</option>
                <option value="este_anio">Este Año</option>
                <option value="total">Histórico Total</option>
              </select>
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm" onClick={loadLogsIaConsumo} disabled={logsIaLoading}>
                {logsIaLoading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-arrow-clockwise me-1"></i>}
                Actualizar
              </button>
              <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 fw-bold align-self-center shadow-sm">
                SuperAdmin Only
              </span>
            </div>
          </div>
        </div>
      </div>

      {logsIaLoading && logsIaConsumo.length === 0 ? (
        <div className="col-12 text-center py-5">
          <span className="spinner-border spinner-border-sm me-2 text-primary"></span>Cargando métricas de telemetría de IA...
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="col-md-3">
            <div className="card border-0 bg-light shadow-sm rounded-4 p-4 text-center">
              <div className="text-muted small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem' }}>Costo Efectivo Acumulado</div>
              <h2 className="fw-bold text-dark mb-1" style={{ fontFamily: "'Outfit', sans-serif", fontSize: selectedCountry ? '1.2rem' : '1.8rem' }}>
                {renderCosto(totalCost, 5)}
              </h2>
              <p className="text-muted small mb-0" style={{ fontSize: '0.7rem' }}>
                <i className="bi bi-info-circle me-1"></i>Tarifa efectiva con convenios
              </p>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card border-0 bg-success bg-opacity-10 border-success border-opacity-25 shadow-sm rounded-4 p-4 text-center">
              <div className="text-success small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem' }}>🎉 Ahorro por Convenios</div>
              <h2 className="fw-bold text-success mb-1" style={{ fontFamily: "'Outfit', sans-serif", fontSize: selectedCountry ? '1.2rem' : '1.8rem' }}>
                {renderCosto(totalSavings, 5)}
              </h2>
              <p className="text-success small mb-0 fw-bold" style={{ fontSize: '0.7rem' }}>
                {totalOfficialCost > 0 ? `${(((totalSavings) / totalOfficialCost) * 100).toFixed(1)}% Ahorrado vs Lista Web` : '100% Tarifa Optimizada'}
              </p>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card border-0 bg-light shadow-sm rounded-4 p-4 text-center">
              <div className="text-muted small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem' }}>Tokens Consumidos</div>
              <h2 className="fw-bold text-primary mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens}
              </h2>
              <p className="text-muted small mb-0" style={{ fontSize: '0.7rem' }}><i className="bi bi-cpu-fill me-1"></i>Total acumulado (E/S)</p>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card border-0 bg-light shadow-sm rounded-4 p-4 text-center">
              <div className="text-muted small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem' }}>Ejecuciones Exitosas</div>
              <h2 className="fw-bold text-dark mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {totalLogs}
              </h2>
              <p className="text-muted small mb-0" style={{ fontSize: '0.7rem' }}><i className="bi bi-check-circle-fill text-success me-1"></i>Llamadas exitosas al motor</p>
            </div>
          </div>

          {/* CONSOLA DE CONFIGURACIÓN DE PRESUPUESTO IA */}
          {budgetConfig && (
            <div className="col-12 animate__animated animate__fadeIn">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div>
                    <div className="d-flex align-items-center gap-3">
                      <h6 className="fw-bold mb-1 text-dark">
                        <i className="bi bi-wallet2 me-2 text-primary"></i>Configuración de Alertas & Autoshutoff de Presupuesto
                      </h6>
                      <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 fw-bold">SuperAdmin Only</span>
                    </div>
                    <p className="small text-muted mb-0">Control de costos automatizado global y por rol para evitar sorpresas de consumo en la API de Gemini.</p>
                  </div>
                  {budgetConfig.disabledByBudget && (
                    <div className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-3 py-2 fw-bold animate-pulse">
                      🚨 Servicio Pausado por Presupuesto Excedido
                    </div>
                  )}
                </div>

                <div className="row g-4 align-items-center">
                  {/* Progreso del Presupuesto */}
                  <div className="col-lg-6">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="small text-muted fw-bold">Costo Acumulado este Mes:</span>
                      <span className="small fw-bold text-dark">
                        {selectedCountry ? (() => {
                          const localCurr = getCountryCurrency(selectedCountry);
                          const localRate = exchangeRates[localCurr] || 1.0;
                          return `${localCurr} ${(budgetConfig.accumulatedCostUsd * localRate).toFixed(2)} / ${(budgetConfig.limitUsd * localRate).toFixed(2)} (${localCurr}) | USD $${budgetConfig.accumulatedCostUsd.toFixed(4)} / $${budgetConfig.limitUsd.toFixed(2)}`;
                        })() : `USD $${budgetConfig.accumulatedCostUsd.toFixed(4)} / $${budgetConfig.limitUsd.toFixed(2)}`}
                      </span>
                    </div>
                    
                    {/* Barra de Progreso HSL Dinámica */}
                    {(() => {
                      const pct = Math.min((budgetConfig.accumulatedCostUsd / (budgetConfig.limitUsd || 1.0)) * 100, 100);
                      const hue = Math.max(120 - (pct * 1.2), 0);
                      return (
                        <div>
                          <div className="progress rounded-pill shadow-xs" style={{ height: '14px', backgroundColor: '#e9ecef' }}>
                            <div 
                              className="progress-bar rounded-pill transition-all" 
                              role="progressbar" 
                              style={{ 
                                width: `${pct}%`,
                                backgroundColor: `hsl(${hue}, 85%, 45%)`,
                                transition: 'width 0.6s ease'
                              }}
                            ></div>
                          </div>
                          <div className="d-flex justify-content-between mt-2" style={{ fontSize: '0.7rem' }}>
                            <span className="text-muted">0%</span>
                            <span className="fw-bold text-warning">{budgetConfig.alertThresholdPct}% (Alerta)</span>
                            <span className="fw-bold text-danger">100% (Bloqueo)</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Formulario de Configuración */}
                  <div className="col-lg-6">
                    <div className="card bg-light border-0 rounded-3 p-3">
                      <div className="row g-3">
                        <div className="col-sm-4">
                          <label className="small text-muted fw-bold mb-1.5 d-block">Límite USD</label>
                          <div className="input-group input-group-sm">
                            <span className="input-group-text">$</span>
                            <input 
                              type="number" 
                              className="form-control fw-bold" 
                              step="1"
                              min="1"
                              value={budgetConfig.limitUsd}
                              onChange={e => setBudgetConfig(prev => ({ ...prev, limitUsd: parseFloat(e.target.value) || 1.0 }))}
                              onBlur={() => {
                                const sum = ['superadmin', 'admin', 'lector', 'usuario'].reduce((acc, rolId) => acc + (budgetConfig.roleLimits?.[rolId] || 0), 0);
                                if (budgetConfig.limitUsd < sum) {
                                  showAlert(`El presupuesto global no puede ser menor que la suma de los límites de los roles ($${sum.toFixed(2)}).`, 'warning');
                                  setBudgetConfig(prev => ({ ...prev, limitUsd: sum }));
                                  handleSaveBudgetConfig({ limitUsd: sum });
                                } else {
                                  handleSaveBudgetConfig({ limitUsd: budgetConfig.limitUsd });
                                }
                              }}
                              disabled={savingConfig}
                            />
                          </div>
                        </div>
                        
                        <div className="col-sm-4">
                          <label className="small text-muted fw-bold mb-1.5 d-block">Umbral Alerta</label>
                          <div className="input-group input-group-sm">
                            <input 
                              type="number" 
                              className="form-control fw-bold"
                              step="5"
                              min="50"
                              max="95"
                              value={budgetConfig.alertThresholdPct}
                              onChange={e => setBudgetConfig(prev => ({ ...prev, alertThresholdPct: parseInt(e.target.value) || 80 }))}
                              onBlur={() => handleSaveBudgetConfig({ alertThresholdPct: budgetConfig.alertThresholdPct })}
                              disabled={savingConfig}
                            />
                            <span className="input-group-text">%</span>
                          </div>
                        </div>

                        <div className="col-sm-4 d-flex flex-column justify-content-center">
                          <div className="form-check form-switch ps-0 d-flex align-items-center gap-2 mb-2">
                            <label className="small text-muted fw-bold form-check-label" htmlFor="autoshutoffSwitch">Autoshutoff</label>
                            <input 
                              className="form-check-input ms-0" 
                              type="checkbox" 
                              id="autoshutoffSwitch"
                              checked={budgetConfig.autoshutoffActive}
                              onChange={e => handleSaveBudgetConfig({ autoshutoffActive: e.target.checked })}
                              disabled={savingConfig}
                            />
                          </div>
                          <div className="form-check form-switch ps-0 d-flex align-items-center gap-2">
                            <label className="small text-danger fw-bold form-check-label" htmlFor="manualPauseSwitch" title="Apagar el motor de IA para toda la plataforma manualmente">Apagar IA</label>
                            <input 
                              className="form-check-input ms-0" 
                              type="checkbox" 
                              id="manualPauseSwitch"
                              checked={budgetConfig.manualPause || false}
                              onChange={e => handleSaveBudgetConfig({ manualPause: e.target.checked })}
                              disabled={savingConfig}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Configuración de Límites por Rol */}
                      <div className="mt-3 pt-3 border-top border-secondary border-opacity-10">
                        <label className="small text-muted fw-bold mb-2 d-block">Límites Individuales por Rol ({selectedCountry ? `${getCountryCurrency(selectedCountry)} / USD` : 'USD'})</label>
                        <div className="row g-3">
                          {[
                            { id: 'superadmin', label: 'SuperAdmin' },
                            { id: 'admin', label: 'Admin' },
                            { id: 'lector', label: 'Lector' },
                            { id: 'usuario', label: 'Usuario' }
                          ].map(rol => (
                            <div className="col-6 col-sm-3" key={rol.id}>
                              <label className="small text-muted mb-1 d-block" style={{ fontSize: '0.7rem' }}>{rol.label}</label>
                              <div className="input-group input-group-sm shadow-sm">
                                <span className="input-group-text bg-light text-muted fw-bold border-end-0">$</span>
                                <input 
                                  type="number" 
                                  className="form-control fw-bold border-start-0 ps-0"
                                  style={{ backgroundColor: '#fff' }}
                                  step="0.5"
                                  min="0"
                                                                   value={budgetConfig.roleLimits?.[rol.id] || 0}
                                  onChange={e => {
                                    let val = parseFloat(e.target.value) || 0;
                                    const sumOfOthers = ['superadmin', 'admin', 'lector', 'usuario']
                                      .filter(id => id !== rol.id)
                                      .reduce((acc, id) => acc + (budgetConfig.roleLimits?.[id] || 0), 0);
                                    
                                    const maxAllowed = Math.max(0, (budgetConfig.limitUsd || 0) - sumOfOthers);
                                    if (val > maxAllowed) {
                                      val = maxAllowed;
                                      showAlert(`La suma de los límites individuales no puede superar el presupuesto global ($${budgetConfig.limitUsd}). El valor máximo disponible para este rol es $${maxAllowed.toFixed(2)}.`, 'warning');
                                    }
                                    setBudgetConfig(prev => ({ 
                                      ...prev, 
                                      roleLimits: { ...(prev.roleLimits || {}), [rol.id]: val } 
                                    }));
                                  }}
                                  onBlur={() => handleSaveBudgetConfig({ roleLimits: budgetConfig.roleLimits })}
                                  disabled={savingConfig}
                                />
                              </div>
                              {selectedCountry && (() => {
                                const localCurr = getCountryCurrency(selectedCountry);
                                const localRate = exchangeRates[localCurr] || 1.0;
                                const valLocal = (budgetConfig.roleLimits?.[rol.id] || 0) * localRate;
                                return (
                                  <span className="text-muted d-block mt-1" style={{ fontSize: '0.62rem' }}>
                                    {localCurr} {valLocal.toFixed(2)}
                                  </span>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                        <div className="form-text mt-2" style={{ fontSize: '0.65rem' }}>
                          La suma de los límites individuales por rol no puede superar el presupuesto global (${budgetConfig.limitUsd}).
                        </div>
                      </div>

                      {/* Botón Override de Reactivación */}
                      {budgetConfig.disabledByBudget && (
                        <div className="d-flex justify-content-end gap-2 mt-3 pt-2 border-top border-secondary border-opacity-10">
                          <button 
                            type="button" 
                            className="btn btn-sm btn-success rounded-pill px-3 fw-bold d-flex align-items-center gap-1 shadow-sm"
                            onClick={handleReactivateIa}
                            disabled={savingConfig}
                          >
                            <i className="bi bi-play-circle-fill"></i> Reactivar Motor IA
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Rankings */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-2">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4">
                <h6 className="fw-bold mb-0 text-dark"><i className="bi bi-person-badge me-2 text-primary"></i>Top 5 Clientes por Costo de IA</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="px-4 text-muted small fw-bold border-0">CLIENTE / EMPRESA</th>
                        <th className="text-center text-muted small fw-bold border-0">LLAMADAS</th>
                        <th className="text-end px-4 text-muted small fw-bold border-0">{getCostoHeaderLabel()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClients.length === 0 ? (
                        <tr><td colSpan="3" className="text-center text-muted py-4">No hay datos de consumo registrados aún.</td></tr>
                      ) : (
                        topClients.map((tc, idx) => (
                          <tr key={tc.name || `tc_${idx}`}>
                            <td className="px-4 fw-bold text-dark small">{tc.name}</td>
                            <td className="text-center"><span className="badge bg-light text-dark rounded-pill px-2.5">{tc.count}</span></td>
                            <td className="text-end px-4 fw-bold text-primary small">{renderCosto(tc.cost, 5)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-2">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4">
                <h6 className="fw-bold mb-0 text-dark"><i className="bi bi-people-fill me-2 text-primary"></i>Uso por Usuario</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="px-4 text-muted small fw-bold border-0">USUARIO</th>
                        <th className="text-center text-muted small fw-bold border-0">ROL</th>
                        <th className="text-center text-muted small fw-bold border-0">EJECUCIONES</th>
                        <th className="text-end px-4 text-muted small fw-bold border-0">{getCostoHeaderLabel()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAMs.length === 0 ? (
                        <tr><td colSpan="4" className="text-center text-muted py-4">No hay datos de consumo registrados aún.</td></tr>
                      ) : (
                        topAMs.map((ta, idx) => (
                          <tr key={ta.name || `ta_${idx}`}>
                            <td className="px-4 text-dark small">{ta.name}</td>
                            <td className="text-center"><span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill px-2 py-1" style={{ fontSize: '0.65rem' }}>{ta.rol}</span></td>
                            <td className="text-center"><span className="badge bg-light text-dark rounded-pill px-2.5">{ta.count}</span></td>
                            <td className="text-end px-4 fw-bold text-primary small">{renderCosto(ta.cost, 5)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Models and Types stats */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-2">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4">
                <h6 className="fw-bold mb-0 text-dark"><i className="bi bi-cpu-fill me-2 text-primary"></i>Distribución por Modelo</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="px-4 text-muted small fw-bold border-0">MODELO</th>
                        <th className="text-end px-4 text-muted small fw-bold border-0">{getCostoHeaderLabel()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelStats.length === 0 ? (
                        <tr><td colSpan="2" className="text-center text-muted py-4">Sin datos de modelos.</td></tr>
                      ) : (
                        modelStats.map((ms, idx) => (
                          <tr key={ms.name || `ms_${idx}`}>
                            <td className="px-4"><code className="text-primary small">{ms.name}</code></td>
                            <td className="text-end px-4 fw-bold text-dark small">{renderCosto(ms.cost, 5)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Distribution stats */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-2">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4">
                <h6 className="fw-bold mb-0 text-dark"><i className="bi bi-diagram-3-fill me-2 text-primary"></i>Distribución por Funcionalidad</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="px-4 text-muted small fw-bold border-0">FUNCIONALIDAD</th>
                        <th className="text-center text-muted small fw-bold border-0">EJECUCIONES</th>
                        <th className="text-end px-4 text-muted small fw-bold border-0">{getCostoHeaderLabel()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featureStats.length === 0 ? (
                        <tr><td colSpan="3" className="text-center text-muted py-4">Sin datos de funcionalidades.</td></tr>
                      ) : (
                        featureStats.map((fs, idx) => (
                          <tr key={fs.name || `fs_${idx}`}>
                            <td className="px-4 text-dark small fw-bold">{fs.name}</td>
                            <td className="text-center"><span className="badge bg-light text-dark rounded-pill px-2.5">{fs.count}</span></td>
                            <td className="text-end px-4 fw-bold text-primary small">{renderCosto(fs.cost, 5)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Errores de Infraestructura */}
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-2">
              <div className="card-header bg-danger bg-opacity-10 border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-danger"><i className="bi bi-exclamation-octagon-fill me-2"></i>Errores de Infraestructura (Incidentes)</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                      <tr>
                        <th className="px-4 text-muted small fw-bold border-0" style={{ width: '150px' }}>FECHA</th>
                        <th className="text-muted small fw-bold border-0" style={{ width: '200px' }}>COMPONENTE</th>
                        <th className="text-muted small fw-bold border-0">ERROR</th>
                        <th className="text-end px-4 text-muted small fw-bold border-0" style={{ width: '100px' }}>CÓDIGO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsIaErrores.length === 0 ? (
                        <tr><td colSpan="4" className="text-center text-muted py-4">No hay incidentes técnicos registrados. Servicio estable.</td></tr>
                      ) : (
                        logsIaErrores.map((err, idx) => {
                          const fecha = err.timestamp?.toDate ? err.timestamp.toDate().toLocaleString('es-ES') : (err.timestamp ? new Date(err.timestamp).toLocaleString('es-ES') : 'Reciente');
                          return (
                            <tr key={err.id || `err_ia_${idx}`}>
                              <td className="px-4 small text-muted">{fecha}</td>
                              <td className="fw-bold text-dark small">{err.component}</td>
                              <td className="small text-danger">{err.errorMessage}</td>
                              <td className="text-end px-4 fw-bold text-secondary small"><span className="badge bg-light text-dark border">{err.errorCode}</span></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Logs table */}
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-2">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-dark"><i className="bi bi-journal-text me-2 text-primary"></i>Bitácora de Ejecuciones Recientes</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                      <tr>
                        <th className="px-4 text-muted small fw-bold border-0">FECHA</th>
                        <th className="text-muted small fw-bold border-0">CLIENTE / TIPO</th>
                        <th className="text-muted small fw-bold border-0">AM / INICIADOR</th>
                        <th className="text-center text-muted small fw-bold border-0">TOKENS</th>
                        <th className="text-end px-4 text-muted small fw-bold border-0">{getCostoHeaderLabel()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsIaConsumo.length === 0 ? (
                        <tr><td colSpan="5" className="text-center text-muted py-4">No hay logs registrados.</td></tr>
                      ) : (
                        logsIaConsumo.map((log, idx) => {
                          const fecha = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('es-ES') : (log.timestamp ? new Date(log.timestamp).toLocaleString('es-ES') : 'Reciente');
                          const rawType = log.type || 'cliente_holistico';
                          const label = rawType === 'cliente_holistico' ? 'Análisis Holístico' : 
                                        rawType === 'contrato_multimodal' ? 'Auditoría Contratos' : 
                                        rawType === 'gmail_sync' ? 'Sincronización Gmail' : 
                                        rawType === 'whatsapp_sync' ? 'Sincronización WhatsApp' :
                                        (rawType === 'copilot_agent' || rawType === 'copiloto_action_only') ? 'LUXIA Copiloto' :
                                        rawType === 'metrics_architect' ? 'Metrics Studio' :
                                        rawType === 'luxia_search' ? 'Búsqueda Inteligente' : 
                                        rawType === 'capacitacion_grading' ? 'Evaluación Capacitación' : 
                                        rawType === 'support_agent' ? 'Soporte Técnico IA' : rawType;
                          return (
                            <tr key={log.id || `log_ia_${idx}`}>
                              <td className="px-4 small text-muted" style={{ fontSize: '0.75rem' }}>{fecha}</td>
                              <td>
                                <div className="fw-bold text-dark small">{log.nombreEmpresa}</div>
                                <span className="badge bg-secondary bg-opacity-10 text-muted rounded-pill px-2" style={{ fontSize: '0.62rem' }}>
                                  {label}
                                </span>
                              </td>
                              <td className="small text-muted text-truncate" style={{ maxWidth: '120px', fontSize: '0.75rem' }} title={log.triggeredBy}>{log.triggeredBy}</td>
                              <td className="text-center small" style={{ fontSize: '0.75rem' }}>
                                <span className="text-muted">{log.inputTokens || 0}</span> / <span className="text-primary">{log.outputTokens || 0}</span>
                              </td>
                              <td className="text-end px-4 fw-bold text-primary small">{renderCosto(log.estimatedCostUsd || 0, 5)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        show={showReactivateConfirm}
        title="Reactivar Motor IA"
        message="Vas a reactivar el servicio. ¿Deseas reiniciar también el costo acumulado de este mes a cero?"
        confirmBtnClass="btn-success"
        confirmText="Sí, reiniciar costo"
        onConfirm={() => executeReactivate(true)}
        secondaryConfirmText="No, conservar costo"
        onSecondaryConfirm={() => executeReactivate(false)}
        onClose={() => setShowReactivateConfirm(false)}
      />

      {showModelsModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <h6 className="modal-title fw-bold text-dark">
                  <i className="bi bi-cpu-fill me-2 text-primary"></i>Administración de Modelos & Tarifas IA
                </h6>
                <button type="button" className="btn-close" onClick={() => setShowModelsModal(false)}></button>
              </div>
              <div className="modal-body p-4 bg-light">
                <AdminIaModelsManager selectedCountry={selectedCountry} exchangeRates={exchangeRates} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
