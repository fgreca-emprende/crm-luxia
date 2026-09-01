import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { ConfirmModal } from './ConfirmModal';
import { useUserRole } from '../../../contexts/UserRoleContext';

export function WhatsappConsumptionPanel({ selectedCountry }) {
  const [logsConsumo, setLogsConsumo] = useState([]);
  const [logsErrores, setLogsErrores] = useState([]);
  const { hasPermission } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState('este_mes');
  const { showAlert } = useToast();
  const [budgetConfig, setBudgetConfig] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, ARS: 900, CLP: 940, PEN: 3.7, COP: 4100, MXN: 18 });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const data = await getConfigGeneral('rates');
        if (data && data.rates) {
          setExchangeRates(data.rates);
        }
      } catch (err) {
        console.warn("Error loading exchange rates in WhatsappConsumptionPanel:", err);
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

  const renderCosto = (costInUsd, decimals = 3) => {
    if (selectedCountry) {
      const localCurr = getCountryCurrency(selectedCountry);
      const localRate = exchangeRates[localCurr] || 1.0;
      const localCost = costInUsd * localRate;
      return `${localCurr} ${localCost.toFixed(decimals === 3 ? 2 : decimals)} / USD $${costInUsd.toFixed(decimals)}`;
    }
    return `USD $${costInUsd.toFixed(decimals)}`;
  };

  const getCostoHeaderLabel = () => {
    return `COSTO (${selectedCountry ? `${getCountryCurrency(selectedCountry)} / USD` : 'USD'})`;
  };

  const loadLogsConsumo = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('logs_whatsapp_consumo')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);
      if (error) throw error;
      setLogsConsumo(data || []);
    } catch (err) {
      console.warn("Error cargando logs de WhatsApp:", err);
      showAlert(`Error cargando logs de WhatsApp: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  const loadLogsErrores = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('logs_whatsapp_errores')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      setLogsErrores(data || []);
    } catch (err) {
      console.warn("Error loading WhatsApp errors:", err);
    }
  }, []);

  const loadBudgetConfig = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const data = await getConfigGeneral('whatsapp_usage');
      if (data) {
        setBudgetConfig(data);
      }
    } catch (err) {
      console.warn("Error loading WhatsApp budget config:", err);
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  const loadMetadata = useCallback(async () => {
    try {
      const { data: usersData } = await supabase.from('usuarios').select('*');
      setUsuarios(usersData || []);

      const { data: clientsData } = await supabase.from('clientes').select('*');
      setClientes(clientsData || []);
    } catch (err) {
      console.warn("Error loading metadata:", err);
    }
  }, []);

  const handleSaveBudgetConfig = async (newConfig) => {
    setSavingConfig(true);
    try {
      const updated = { ...(budgetConfig || {}), ...newConfig };
      await setConfigGeneral('whatsapp_usage', updated);
      setBudgetConfig(updated);
      showAlert('Límite de presupuesto de WhatsApp guardado con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar: ${err.message}`, 'danger');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleReactivate = () => {
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
      }
      await setConfigGeneral('whatsapp_usage', updates);
      setBudgetConfig(updates);
      showAlert('Servicio de WhatsApp reactivado y reconfigurado', 'success');
    } catch (err) {
      showAlert(`Error al reactivar: ${err.message}`, 'danger');
    } finally {
      setSavingConfig(false);
    }
  };

  useEffect(() => {
    loadLogsConsumo();
    loadBudgetConfig();
    loadLogsErrores();
    loadMetadata();
  }, [loadLogsConsumo, loadBudgetConfig, loadLogsErrores, loadMetadata]);

  const getAggregatedData = () => {
    let totalCost = 0;
    const clientMap = {};
    const amMap = {};
    const categoryMap = {};
    const countryMap = {};

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const logsFiltrados = logsConsumo.filter(log => {
      if (filtroPeriodo === 'total') return true;
      if (!log.timestamp) return false;
      
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      
      if (filtroPeriodo === 'este_mes') {
        return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
      } else if (filtroPeriodo === 'mes_pasado') {
        let lastMonth = currentMonth - 1;
        let lastYear = currentYear;
        if (lastMonth < 0) {
          lastMonth = 11;
          lastYear -= 1;
        }
        return logDate.getMonth() === lastMonth && logDate.getFullYear() === lastYear;
      } else if (filtroPeriodo === 'este_anio') {
        return logDate.getFullYear() === currentYear;
      }
      return true;
    });

    logsFiltrados.forEach(log => {
      const cost = log.costoUsd || 0;
      totalCost += cost;

      // Group by Client
      const cId = log.clienteId || 'sin_cliente';
      const clientName = clientes.find(c => c.id === log.clienteId)?.nombreEmpresa || log.clienteId || 'Desconocido';
      if (!clientMap[cId]) {
        clientMap[cId] = { id: cId, name: clientName, cost: 0, count: 0 };
      }
      clientMap[cId].cost += cost;
      clientMap[cId].count += 1;

      // Group by AM (Commercial)
      const amEmail = log.usuarioEmail || 'Desconocido';
      const amName = usuarios.find(u => u.email === amEmail)?.nombre || amEmail;
      if (!amMap[amEmail]) {
        amMap[amEmail] = { email: amEmail, name: amName, cost: 0, count: 0 };
      }
      amMap[amEmail].cost += cost;
      amMap[amEmail].count += 1;

      // Group by Category
      const rawCategory = log.tipoConversacion || 'service';
      let catLabel = 'Servicio';
      if (rawCategory === 'marketing') catLabel = 'Marketing';
      else if (rawCategory === 'utility') catLabel = 'Utilidad / Notificaciones';
      
      if (!categoryMap[catLabel]) categoryMap[catLabel] = { name: catLabel, cost: 0, count: 0 };
      categoryMap[catLabel].cost += cost;
      categoryMap[catLabel].count += 1;

      // Group by Country
      const rawCountry = log.pais || 'Otros';
      if (!countryMap[rawCountry]) countryMap[rawCountry] = { name: rawCountry, cost: 0, count: 0 };
      countryMap[rawCountry].cost += cost;
      countryMap[rawCountry].count += 1;
    });

    const topClients = Object.values(clientMap).sort((a, b) => b.cost - a.cost).slice(0, 5);
    const topAMs = Object.values(amMap).sort((a, b) => b.cost - a.cost).slice(0, 5);
    const categoryStats = Object.values(categoryMap).sort((a, b) => b.cost - a.cost);
    const countryStats = Object.values(countryMap).sort((a, b) => b.cost - a.cost);

    return { totalCost, topClients, topAMs, categoryStats, countryStats, totalLogs: logsFiltrados.length };
  };

  const { totalCost, topClients, topAMs, categoryStats, countryStats, totalLogs } = getAggregatedData();

  return (
    <div className="row g-4 mb-4">
      <div className="col-12">
        <div className="card border-0 bg-transparent p-0">
          <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold mb-1 text-dark">
                <i className="bi bi-whatsapp me-2 text-success"></i>Dashboard de Consumo y Costo de WhatsApp
              </h5>
              <p className="small text-muted mb-0">Auditoría en tiempo real de costes de WhatsApp Business API distribuidos por país, AM y tipo de conversación.</p>
            </div>
            <div className="d-flex gap-2">
              <select 
                className="form-select form-select-sm rounded-pill fw-bold shadow-sm"
                style={{ width: 'auto', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}
                value={filtroPeriodo}
                onChange={e => setFiltroPeriodo(e.target.value)}
              >
                <option value="este_mes">Este Mes</option>
                <option value="mes_pasado">Mes Pasado</option>
                <option value="este_anio">Este Año</option>
                <option value="total">Histórico Total</option>
              </select>
              <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm" onClick={loadLogsConsumo} disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-arrow-clockwise me-1"></i>}
                Actualizar
              </button>
              <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 fw-bold align-self-center shadow-sm">
                SuperAdmin Only
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading && logsConsumo.length === 0 ? (
        <div className="col-12 text-center py-5">
          <span className="spinner-border spinner-border-sm me-2 text-primary"></span>Cargando métricas de telemetría de WhatsApp...
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="col-md-4">
            <div className="card border-0 bg-light shadow-sm rounded-4 p-4 text-center">
              <div className="text-muted small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem' }}>Costo Total Estimado</div>
              <h2 className="fw-bold text-dark mb-1" style={{ fontFamily: "'Outfit', sans-serif", fontSize: selectedCountry ? '1.3rem' : '2rem' }}>
                {renderCosto(totalCost, 3)}
              </h2>
              <p className="text-muted small mb-0" style={{ fontSize: '0.7rem' }}><i className="bi bi-info-circle me-1"></i>Precios basados en tarifas Meta</p>
            </div>
          </div>
          
          <div className="col-md-4">
            <div className="card border-0 bg-light shadow-sm rounded-4 p-4 text-center">
              <div className="text-muted small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem' }}>Conversaciones Activas</div>
              <h2 className="fw-bold text-success mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {totalLogs}
              </h2>
              <p className="text-muted small mb-0" style={{ fontSize: '0.7rem' }}><i className="bi bi-chat-left-dots-fill text-success me-1"></i>En el período filtrado</p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card border-0 bg-light shadow-sm rounded-4 p-4 text-center">
              <div className="text-muted small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.7rem' }}>Presupuesto Asignado</div>
              <h2 className="fw-bold text-primary mb-1" style={{ fontFamily: "'Outfit', sans-serif", fontSize: selectedCountry ? '1.3rem' : '2rem' }}>
                {budgetConfig?.limitMonthlyUsd ? renderCosto(budgetConfig.limitMonthlyUsd, 2) : '--'}
              </h2>
              <p className="text-muted small mb-0" style={{ fontSize: '0.7rem' }}><i className="bi bi-wallet2 me-1"></i>Límite mensual establecido</p>
            </div>
          </div>

          {/* BUDGET CONFIGURATION SECTION */}
          {budgetConfig && (
            <div className="col-12 animate__animated animate__fadeIn">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div>
                    <div className="d-flex align-items-center gap-3">
                      <h6 className="fw-bold mb-1 text-dark">
                        <i className="bi bi-wallet2 me-2 text-success"></i>Configuración de Alertas & Autoshutoff de WhatsApp
                      </h6>
                      {budgetConfig.disabledByBudget ? (
                        <span className="badge bg-danger rounded-pill px-3 py-1 fw-bold">
                          Bloqueado por Presupuesto
                        </span>
                      ) : (
                        <span className="badge bg-success rounded-pill px-3 py-1 fw-bold">
                          Servicio Activo
                        </span>
                      )}
                    </div>
                    <p className="small text-muted mb-0">Controla el coste y bloquea envíos masivos para prevenir sobrecostos operacionales.</p>
                  </div>
                  {budgetConfig.disabledByBudget && (
                    <button 
                      className="btn btn-sm btn-success rounded-pill px-4 fw-bold shadow-sm" 
                      onClick={handleReactivate}
                      disabled={!hasPermission('actions', 'configurar_presupuesto_whatsapp')}
                    >
                      Reactivar Servicio de WhatsApp
                    </button>
                  )}
                </div>

                <div className="row g-4 mt-1 border-top pt-3 align-items-center">
                  <div className="col-md-3">
                    <label className="form-label small fw-bold text-dark mb-1">Límite de Presupuesto Mensual ({selectedCountry ? `${getCountryCurrency(selectedCountry)} / USD` : 'USD'})</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">$</span>
                      <input 
                        type="number"
                        step="10"
                        className="form-control rounded-end-3"
                        value={budgetConfig.limitMonthlyUsd}
                        onChange={e => handleSaveBudgetConfig({ limitMonthlyUsd: parseFloat(e.target.value) || 100 })}
                        disabled={!hasPermission('actions', 'configurar_presupuesto_whatsapp')}
                      />
                    </div>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label small fw-bold text-dark mb-1">Umbral de Alerta Preventiva (%)</label>
                    <div className="input-group input-group-sm">
                      <input 
                        type="number"
                        className="form-control"
                        value={budgetConfig.alertThresholdPercent}
                        onChange={e => handleSaveBudgetConfig({ alertThresholdPercent: parseInt(e.target.value) || 80 })}
                        disabled={!hasPermission('actions', 'configurar_presupuesto_whatsapp')}
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label small fw-bold text-dark mb-1">Gasto Acumulado en el Mes ({selectedCountry ? `${getCountryCurrency(selectedCountry)} / USD` : 'USD'})</label>
                    <h5 className="fw-bold text-dark mt-1 mb-0" style={{ fontSize: selectedCountry ? '0.85rem' : '1.1rem' }}>
                      {renderCosto(budgetConfig.accumulatedCostUsd, 2)} 
                      <span className="small text-muted fw-normal ms-2">
                        ({((budgetConfig.accumulatedCostUsd / budgetConfig.limitMonthlyUsd) * 100).toFixed(1)}%)
                      </span>
                    </h5>
                  </div>

                  <div className="col-md-3 d-flex flex-column justify-content-center">
                    <div className="form-check form-switch ps-0 d-flex align-items-center gap-2 mb-2">
                      <label className="small text-muted fw-bold form-check-label" htmlFor="waAutoshutoffSwitch">Autoshutoff</label>
                      <input 
                        className="form-check-input ms-0" 
                        type="checkbox" 
                        id="waAutoshutoffSwitch"
                        checked={budgetConfig.autoshutoffActive || false}
                        onChange={e => handleSaveBudgetConfig({ autoshutoffActive: e.target.checked })}
                        disabled={savingConfig || !hasPermission('actions', 'configurar_presupuesto_whatsapp')}
                      />
                    </div>
                    <div className="form-check form-switch ps-0 d-flex align-items-center gap-2">
                      <label className="small text-danger fw-bold form-check-label" htmlFor="waManualPauseSwitch" title="Apagar el servicio de WhatsApp para toda la plataforma manualmente">Apagar WhatsApp</label>
                      <input 
                        className="form-check-input ms-0" 
                        type="checkbox" 
                        id="waManualPauseSwitch"
                        checked={budgetConfig.manualPause || false}
                        onChange={e => handleSaveBudgetConfig({ manualPause: e.target.checked })}
                        disabled={savingConfig || !hasPermission('actions', 'configurar_presupuesto_whatsapp')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RANKINGS AND ANALYTICS */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
              <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-building me-2 text-primary"></i>Top 5 Clientes con Mayor Costo</h6>
              {topClients.length === 0 ? (
                <div className="text-center py-4 text-muted small">Sin datos disponibles</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-borderless table-sm align-middle small mb-0">
                    <thead>
                      <tr className="border-bottom text-muted">
                        <th>Cliente</th>
                        <th className="text-center">Conversaciones</th>
                        <th className="text-end">{getCostoHeaderLabel()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClients.map((c, idx) => (
                        <tr key={c.id || `tc_${idx}`}>
                          <td className="fw-bold text-dark">{c.name}</td>
                          <td className="text-center">{c.count}</td>
                          <td className="text-end fw-bold text-dark">{renderCosto(c.cost, 3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
              <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-people me-2 text-primary"></i>Top 5 Ejecutivos Comerciales (AM)</h6>
              {topAMs.length === 0 ? (
                <div className="text-center py-4 text-muted small">Sin datos disponibles</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-borderless table-sm align-middle small mb-0">
                    <thead>
                      <tr className="border-bottom text-muted">
                        <th>Comercial</th>
                        <th className="text-center">Conversaciones</th>
                        <th className="text-end">{getCostoHeaderLabel()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAMs.map((am, idx) => (
                        <tr key={am.email || am.name || `am_${idx}`}>
                          <td className="fw-bold text-dark">{am.name}</td>
                          <td className="text-center">{am.count}</td>
                          <td className="text-end fw-bold text-dark">{renderCosto(am.cost, 3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* DISTRIBUTION BY CATEGORY AND COUNTRY */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
              <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-pie-chart me-2 text-primary"></i>Distribución por Tipo de Conversación</h6>
              {categoryStats.length === 0 ? (
                <div className="text-center py-4 text-muted small">Sin datos de categorías</div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {categoryStats.map((stat, idx) => (
                    <div key={stat.name || `cat_${idx}`} className="small">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="fw-bold text-dark">{stat.name} ({stat.count})</span>
                        <span className="fw-bold text-dark">{renderCosto(stat.cost, 3)}</span>
                      </div>
                      <div className="progress rounded-pill" style={{ height: '8px' }}>
                        <div 
                          className="progress-bar bg-success rounded-pill" 
                          role="progressbar" 
                          style={{ width: `${(stat.cost / totalCost * 100) || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-md-6">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
              <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-globe me-2 text-primary"></i>Distribución de Costos por País</h6>
              {countryStats.length === 0 ? (
                <div className="text-center py-4 text-muted small">Sin datos de países</div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {countryStats.map((stat, idx) => (
                    <div key={stat.name || `country_${idx}`} className="small">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="fw-bold text-dark">{stat.name} ({stat.count})</span>
                        <span className="fw-bold text-dark">{renderCosto(stat.cost, 3)}</span>
                      </div>
                      <div className="progress rounded-pill" style={{ height: '8px' }}>
                        <div 
                          className="progress-bar bg-primary rounded-pill" 
                          role="progressbar" 
                          style={{ width: `${(stat.cost / totalCost * 100) || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* LOGS TABLES */}
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-clock-history me-2 text-primary"></i>Registro de Tráfico de WhatsApp (Últimos 100)</h6>
              <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="table table-sm align-middle small table-hover mb-0">
                  <thead>
                    <tr className="text-muted border-bottom sticky-top bg-white">
                      <th>Fecha</th>
                      <th>Destinatario</th>
                      <th>País</th>
                      <th>Categoría</th>
                      <th>{getCostoHeaderLabel()}</th>
                      <th>Comercial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsConsumo.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-muted">Sin registros de tráfico</td>
                      </tr>
                    ) : (
                      logsConsumo.map((log, idx) => {
                        const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                        const clientName = clientes.find(c => c.id === log.clienteId)?.nombreEmpresa || log.clienteId || 'N/A';
                        return (
                          <tr key={log.id || `log_wsp_${idx}`}>
                            <td>{date.toLocaleString()}</td>
                            <td className="fw-bold">{log.destino} <span className="fw-normal text-muted">({clientName})</span></td>
                            <td>{log.pais}</td>
                            <td>
                              <span className={`badge ${
                                log.tipoConversacion === 'marketing' ? 'bg-warning bg-opacity-10 text-warning' :
                                log.tipoConversacion === 'utility' ? 'bg-primary bg-opacity-10 text-primary' :
                                'bg-success bg-opacity-10 text-success'
                              } px-2 py-1 rounded-pill`}>
                                {log.tipoConversacion}
                              </span>
                            </td>
                            <td className="fw-bold text-dark">{renderCosto(log.costoUsd || 0, 3)}</td>
                            <td className="text-muted">{log.usuarioEmail}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-danger border-opacity-10">
              <h6 className="fw-bold mb-3 text-danger"><i className="bi bi-bug me-2"></i>Historial de Errores de WhatsApp API</h6>
              <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="table table-sm align-middle small table-hover mb-0">
                  <thead>
                    <tr className="text-muted border-bottom sticky-top bg-white">
                      <th>Fecha</th>
                      <th>Destino</th>
                      <th>Mensaje de Error de Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsErrores.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center py-3 text-muted">Sin errores registrados en el sistema</td>
                      </tr>
                    ) : (
                      logsErrores.map((log, idx) => {
                        const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                        return (
                          <tr key={log.id || `log_err_${idx}`} className="table-danger table-opacity-5">
                            <td>{date.toLocaleString()}</td>
                            <td className="fw-bold text-dark">{log.destino}</td>
                            <td className="text-danger fw-semibold">{log.error}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CONFIRM MODAL FOR REACTIVATION */}
      {showReactivateConfirm && (
        <ConfirmModal
          title="Reactivar canal de WhatsApp"
          message="¿Deseas reactivar el canal de envíos automáticos de WhatsApp? Opcionalmente puedes reiniciar el acumulador de consumo de este mes a cero."
          btnText="Reactivar & Mantener Gasto"
          btnTextDanger="Reactivar & Reiniciar Gasto ($0.00)"
          onClose={() => setShowReactivateConfirm(false)}
          onConfirm={() => executeReactivate(false)}
          onConfirmDanger={() => executeReactivate(true)}
        />
      )}
    </div>
  );
}
