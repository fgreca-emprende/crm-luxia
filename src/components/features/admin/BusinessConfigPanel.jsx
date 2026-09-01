import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';
import { ConfirmModal } from './ConfirmModal';

const DEFAULT_PAISES = [
  { codigo: 'AR', nombre: 'Argentina', moneda: 'ARS', activo: true },
  { codigo: 'CL', nombre: 'Chile', moneda: 'CLP', activo: true },
  { codigo: 'PE', nombre: 'Perú', moneda: 'PEN', activo: true },
  { codigo: 'CO', nombre: 'Colombia', moneda: 'COP', activo: true },
  { codigo: 'MX', nombre: 'México', moneda: 'MXN', activo: true }
];

function pruneRatesForCountries(currentRates, paisesList) {
  if (!currentRates || !currentRates.rates) return currentRates;
  const activeCurrencies = new Set(
    (paisesList || [])
      .filter(p => p.activo && p.moneda)
      .map(p => p.moneda.trim().toUpperCase())
  );
  
  const prunedRates = { USD: 1.0 };
  Object.entries(currentRates.rates).forEach(([curr, val]) => {
    const upper = curr.toUpperCase();
    if (upper === 'USD' || activeCurrencies.has(upper)) {
      prunedRates[upper] = typeof val === 'number' ? val : 1.0;
    }
  });

  return {
    ...currentRates,
    rates: prunedRates
  };
}

export function BusinessConfigPanel({ user, mode }) {
  const [businessConfig, setBusinessConfig] = useState({ mesesParaRetencion: 3 });
  const [ratesConfig, setRatesConfig] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [newTeamId, setNewTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingEquipos, setSavingEquipos] = useState(false);
  const [syncingRates, setSyncingRates] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const { showAlert } = useToast();

  const [paisesConfig, setPaisesConfig] = useState({
    paises: DEFAULT_PAISES,
    permitirTodos: true,
    paisPorDefecto: 'AR'
  });
  const [savingPaises, setSavingPaises] = useState(false);
  const [newPaisCodigo, setNewPaisCodigo] = useState('');
  const [newPaisNombre, setNewPaisNombre] = useState('');
  const [newPaisMoneda, setNewPaisMoneda] = useState('');
  const [tierConfig, setTierConfig] = useState({ tier1UsdMin: 10000, tier2UsdMin: 2000 });
  const [savingTiers, setSavingTiers] = useState(false);

  const syncExchangeRates = async (customPaises = null) => {
    setSyncingRates(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) {
        throw new Error('No se pudo conectar con el servidor de tasas de cambio.');
      }
      const data = await response.json();
      if (data && data.result === 'success' && data.rates) {
        const targetPaises = customPaises || paisesConfig.paises || DEFAULT_PAISES;
        const activeCurrencies = new Set(
          targetPaises
            .filter(p => p.activo && p.moneda)
            .map(p => p.moneda.trim().toUpperCase())
        );

        const newRates = { USD: 1.0 };
        activeCurrencies.forEach(curr => {
          if (curr !== 'USD') {
            newRates[curr] = data.rates[curr] || 1.0;
          }
        });

        const ratesData = {
          rates: newRates,
          lastUpdated: new Date().toISOString()
        };
        
        await setConfigGeneral('rates', ratesData);
        setRatesConfig(ratesData);
        showAlert('Tasas de cambio sincronizadas exclusivamente para los países habilitados.', 'success');
        return ratesData;
      } else {
        throw new Error('Respuesta inválida del servidor de tasas de cambio.');
      }
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Error al sincronizar tasas de cambio.', 'danger');
      return null;
    } finally {
      setSyncingRates(false);
    }
  };

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const bConf = await getConfigGeneral('business');
      if (bConf) {
        setBusinessConfig(bConf);
      } else {
        const defaultConfig = { mesesParaRetencion: 3 };
        await setConfigGeneral('business', defaultConfig);
        setBusinessConfig(defaultConfig);
      }

      // Load Tier Thresholds Config
      const tConf = await getConfigGeneral('tier_config');
      if (tConf) {
        setTierConfig(tConf);
      } else {
        const defaultTier = { tier1UsdMin: 10000, tier2UsdMin: 2000 };
        await setConfigGeneral('tier_config', defaultTier);
        setTierConfig(defaultTier);
      }

      // 1. Load Operation Countries Config first
      let currentPaises = DEFAULT_PAISES;
      const pConf = await getConfigGeneral('paises');
      if (pConf && pConf.paises && Array.isArray(pConf.paises)) {
        setPaisesConfig(pConf);
        currentPaises = pConf.paises;
      } else {
        const initPaises = {
          paises: DEFAULT_PAISES,
          permitirTodos: true,
          paisPorDefecto: 'AR'
        };
        await setConfigGeneral('paises', initPaises);
        setPaisesConfig(initPaises);
      }

      // 2. Load rates config and prune against active countries
      const rConf = await getConfigGeneral('rates');
      if (rConf && rConf.rates) {
        const pruned = pruneRatesForCountries(rConf, currentPaises);
        setRatesConfig(pruned);
      } else {
        try {
          const response = await fetch('https://open.er-api.com/v6/latest/USD');
          if (response.ok) {
            const data = await response.json();
            if (data?.rates) {
              const activeCurrencies = new Set(
                currentPaises
                  .filter(p => p.activo && p.moneda)
                  .map(p => p.moneda.trim().toUpperCase())
              );
              const newRates = { USD: 1.0 };
              activeCurrencies.forEach(curr => {
                if (curr !== 'USD') newRates[curr] = data.rates[curr] || 1.0;
              });
              const ratesData = { rates: newRates, lastUpdated: new Date().toISOString() };
              await setConfigGeneral('rates', ratesData);
              setRatesConfig(ratesData);
            }
          }
        } catch (rErr) {
          console.warn('[BusinessConfigPanel] Error fetching initial rates:', rErr);
        }
      }

      // Load teams config from PostgreSQL
      const { data: eqData } = await supabase.from('equipos').select('*');
      let listEquipos = (eqData || []).map(d => ({
        id: d.id,
        nombre: d.nombre,
        participaGamificacion: d.participa_gamificacion || false
      }));

      if (listEquipos.length === 0) {
        const defaultEquipos = [
          { id: 'Global', nombre: 'Global', participaGamificacion: false },
          { id: 'CX', nombre: 'CX (Atención al Cliente)', participaGamificacion: true },
          { id: 'Adquisicion', nombre: 'Adquisición (Hunting)', participaGamificacion: true },
          { id: 'Retencion', nombre: 'Retención (Farming)', participaGamificacion: true },
          { id: 'Operaciones', nombre: 'Operaciones', participaGamificacion: false }
        ];

        for (const eq of defaultEquipos) {
          await supabase.from('equipos').upsert({ id: eq.id, nombre: eq.nombre });
        }
        listEquipos = defaultEquipos;
      }
      // Sort alphabetically by name
      listEquipos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setEquipos(listEquipos);
    } catch (err) {
      showAlert(`Error cargando configuración: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    setSavingBusiness(true);
    try {
      await setConfigGeneral('business', businessConfig);
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'business',
        mesesParaRetencion: businessConfig.mesesParaRetencion
      });
      showAlert('Configuración de Negocio guardada con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar negocio: ${err.message}`, 'danger');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleSaveTiers = async (e) => {
    e.preventDefault();
    setSavingTiers(true);
    try {
      await setConfigGeneral('tier_config', {
        tier1UsdMin: Number(tierConfig.tier1UsdMin) || 10000,
        tier2UsdMin: Number(tierConfig.tier2UsdMin) || 2000,
        updatedAt: new Date().toISOString()
      });
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'tier_config',
        tier1UsdMin: tierConfig.tier1UsdMin,
        tier2UsdMin: tierConfig.tier2UsdMin
      });
      showAlert('Parámetros de Tiers de Cuentas guardados con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar tiers: ${err.message}`, 'danger');
    } finally {
      setSavingTiers(false);
    }
  };

  const handleTogglePais = (codigo) => {
    setPaisesConfig(prev => {
      const updated = prev.paises.map(p => p.codigo === codigo ? { ...p, activo: !p.activo } : p);
      setRatesConfig(currRates => pruneRatesForCountries(currRates, updated));
      return { ...prev, paises: updated };
    });
  };

  const handleAddPais = () => {
    const code = newPaisCodigo.trim().toUpperCase();
    const name = newPaisNombre.trim();
    const curr = newPaisMoneda.trim().toUpperCase() || 'USD';
    if (!code || code.length < 2) {
      showAlert('El código de país debe tener al menos 2 letras (ej. UY, BR, ES).', 'warning');
      return;
    }
    if (!name) {
      showAlert('El nombre del país es obligatorio.', 'warning');
      return;
    }
    if (paisesConfig.paises.some(p => p.codigo === code)) {
      showAlert('Ya existe un país con ese código.', 'warning');
      return;
    }
    const nuevo = { codigo: code, nombre: name, moneda: curr, activo: true };
    const updatedPaises = [...paisesConfig.paises, nuevo];
    setPaisesConfig(prev => ({
      ...prev,
      paises: updatedPaises
    }));
    setNewPaisCodigo('');
    setNewPaisNombre('');
    setNewPaisMoneda('');
    
    // Si la moneda no es USD y no está en tasas, sincronizarla automáticamente
    if (curr !== 'USD') {
      syncExchangeRates(updatedPaises);
    }
  };

  const handleDeletePais = (codigo) => {
    setPaisesConfig(prev => {
      const updated = prev.paises.filter(p => p.codigo !== codigo);
      setRatesConfig(currRates => pruneRatesForCountries(currRates, updated));
      return { ...prev, paises: updated };
    });
  };

  const handleSavePaises = async () => {
    setSavingPaises(true);
    try {
      const prunedRates = pruneRatesForCountries(ratesConfig, paisesConfig.paises);
      await setConfigGeneral('paises', {
        ...paisesConfig,
        updatedAt: new Date().toISOString()
      });
      if (prunedRates) {
        await setConfigGeneral('rates', prunedRates);
        setRatesConfig(prunedRates);
      }
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'paises',
        totalPaises: paisesConfig.paises.length,
        activos: paisesConfig.paises.filter(p => p.activo).map(p => p.codigo)
      });
      showAlert('Países de operación y tasas de cambio guardados con éxito.', 'success');
      window.dispatchEvent(new CustomEvent('paises-config-updated', { detail: paisesConfig }));
    } catch (err) {
      showAlert(`Error al guardar países: ${err.message}`, 'danger');
    } finally {
      setSavingPaises(false);
    }
  };

  const handleSaveEquipos = async () => {
    setSavingEquipos(true);
    try {
      for (const eq of equipos) {
        if (!eq.nombre.trim()) {
          throw new Error('Todos los equipos deben tener un nombre válido.');
        }
        await supabase.from('equipos').upsert({
          id: eq.id,
          nombre: eq.nombre
        });
      }
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'equipos',
        totalEquipos: equipos.length
      });
      showAlert('Configuración de Equipos guardada con éxito.', 'success');
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Error al guardar equipos.', 'danger');
    } finally {
      setSavingEquipos(false);
    }
  };

  const handleToggleGamificacion = (id) => {
    setEquipos(prev => prev.map(eq => eq.id === id ? { ...eq, participaGamificacion: !eq.participaGamificacion } : eq));
  };

  const handleRenameTeam = (id, newName) => {
    setEquipos(prev => prev.map(eq => eq.id === id ? { ...eq, nombre: newName } : eq));
  };

  const handleDeleteTeam = (id) => {
    if (['Global', 'CX', 'Adquisicion', 'Retencion'].includes(id)) {
      showAlert('Los equipos principales (Global, CX, Adquisición y Retención) están protegidos y no pueden eliminarse.', 'warning');
      return;
    }
    setTeamToDelete(id);
    setShowConfirmModal(true);
  };

  const executeDeleteTeam = async () => {
    if (!teamToDelete) return;
    if (['Global', 'CX', 'Adquisicion', 'Retencion'].includes(teamToDelete)) {
      showAlert('Los equipos principales están protegidos contra el borrado.', 'danger');
      setShowConfirmModal(false);
      setTeamToDelete(null);
      return;
    }
    try {
      await supabase.from('equipos').delete().eq('id', teamToDelete);
      setEquipos(prev => prev.filter(eq => eq.id !== teamToDelete));
      showAlert(`Equipo ${teamToDelete} eliminado con éxito.`, 'success');
    } catch (err) {
      showAlert('Error al eliminar equipo.', 'danger');
    } finally {
      setShowConfirmModal(false);
      setTeamToDelete(null);
    }
  };

  const handleAddTeam = () => {
    const cleanId = newTeamId.replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!cleanId || !newTeamName.trim()) {
      showAlert('El código ID y el nombre son requeridos.', 'warning');
      return;
    }
    if (equipos.some(eq => eq.id.toLowerCase() === cleanId.toLowerCase())) {
      showAlert('Ya existe un equipo con ese código ID.', 'warning');
      return;
    }
    const newTeam = {
      id: cleanId,
      nombre: newTeamName.trim(),
      participaGamificacion: false
    };
    setEquipos(prev => [...prev, newTeam].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setNewTeamId('');
    setNewTeamName('');
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <span className="spinner-border spinner-border-sm me-2"></span>Cargando configuraciones...
      </div>
    );
  }

  return (
    <div className="row g-4 mb-4">
      {/* CARD 1: CONFIGURACIÓN DE NEGOCIO */}
      {(!mode || mode === 'negocio') && (
        <div className="col-lg-6">
          <div className="card border-0 bg-light p-4 rounded-4 shadow-sm h-100">
            <h5 className="fw-bold mb-3 text-dark">
              <i className="bi bi-briefcase me-2 text-primary"></i>Configuración de Negocio
            </h5>
            <p className="small text-muted mb-4">
              Parámetros comerciales que afectan las métricas de ciclo de vida del cliente (Hunting vs Farming).
            </p>
            <form onSubmit={handleSaveBusiness}>
              <div className="mb-4">
                <label className="form-label fw-bold mb-1">Meses para Retención (Farming)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  min="1" 
                  required 
                  value={businessConfig.mesesParaRetencion}
                  onChange={e => setBusinessConfig({ mesesParaRetencion: parseInt(e.target.value) || 3 })}
                />
                <div className="form-text" style={{ fontSize: '0.8rem' }}>
                  Cantidad de meses desde la fecha de ingreso para que un cliente deje de ser "Adquisición" y pase a "Retención".
                </div>
              </div>
              <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold" disabled={savingBusiness}>
                {savingBusiness ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CARD 2: TASAS DE CAMBIO EN TIEMPO REAL */}
      {(!mode || mode === 'negocio') && (
        <div className="col-lg-6">
          <div className="card border-0 bg-light p-4 rounded-4 shadow-sm h-100 d-flex flex-column justify-content-between">
            <div>
              <h5 className="fw-bold mb-3 text-dark">
                <i className="bi bi-currency-exchange me-2 text-success"></i>Tasas de Cambio a USD (Países Habilitados)
              </h5>
              <p className="small text-muted mb-4">
                Conversión oficial en tiempo real sincronizada exclusivamente para las monedas de los países activos más la divisa base USD.
              </p>
              
              {ratesConfig && ratesConfig.rates ? (
                <div className="bg-white p-3 rounded-4 border border-light shadow-sm mb-4">
                  <div className="row g-2 text-center">
                    {Object.entries(ratesConfig.rates)
                      .filter(([currency]) => {
                        const activeCurrencies = new Set(
                          (paisesConfig?.paises || [])
                            .filter(p => p.activo && p.moneda && p.moneda.trim().toUpperCase() !== 'USD')
                            .map(p => p.moneda.trim().toUpperCase())
                        );
                        return currency !== 'USD' && activeCurrencies.has(currency.toUpperCase());
                      })
                      .map(([currency, value]) => {
                        const countryCodes = (paisesConfig?.paises || [])
                          .filter(p => p.activo && p.moneda && p.moneda.toUpperCase() === currency.toUpperCase())
                          .map(p => p.codigo)
                          .join(', ');
                        return (
                          <div key={currency} className="col-4 mb-2">
                            <div className="p-2 bg-light rounded-3">
                              <div className="fw-bold small text-muted d-flex align-items-center justify-content-center gap-1">
                                <span>{currency}</span>
                                {countryCodes && (
                                  <span className="badge bg-primary-subtle text-primary" style={{ fontSize: '0.62rem', padding: '2px 5px' }}>
                                    {countryCodes}
                                  </span>
                                )}
                              </div>
                              <div className="fw-bold text-dark mt-1" style={{ fontSize: '1.05rem' }}>
                                {typeof value === 'number' ? value.toFixed(2) : value}
                              </div>
                              <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                                1 USD = {typeof value === 'number' ? value.toFixed(2) : value}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    <div className="col-4 mb-2">
                      <div className="p-2 bg-success bg-opacity-10 text-success rounded-3 border border-success border-opacity-10">
                        <div className="fw-bold small">Base USD</div>
                        <div className="fw-bold mt-1" style={{ fontSize: '1.05rem' }}>1.00</div>
                        <div style={{ fontSize: '0.68rem' }}>Moneda Principal</div>
                      </div>
                    </div>
                  </div>
                  
                  {ratesConfig.lastUpdated && (
                    <div className="text-center mt-2 text-muted" style={{ fontSize: '0.72rem' }}>
                      <i className="bi bi-clock-history me-1"></i>
                      Última sincronización: {new Date(ratesConfig.lastUpdated).toLocaleString('es-ES')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted small">
                  No hay tasas sincronizadas en la base de datos.
                </div>
              )}
            </div>
            
            <button 
              type="button" 
              className="btn btn-success rounded-pill px-4 py-2 fw-bold shadow-sm"
              onClick={() => syncExchangeRates(paisesConfig.paises)}
              disabled={syncingRates}
            >
              {syncingRates ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Sincronizando...</>
              ) : (
                <><i className="bi bi-arrow-repeat me-2"></i>Sincronizar Tasas de Países Activos</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* CARD CONFIGURACIÓN DE TIERS DE CUENTAS */}
      {(!mode || mode === 'negocio') && (
        <div className="col-lg-12">
          <div className="card border-0 bg-light p-4 rounded-4 shadow-sm">
            <h5 className="fw-bold mb-2 text-dark">
              <i className="bi bi-diagram-3-fill me-2 text-warning"></i>Parametrización de Tiers de Cuentas Corporativas
            </h5>
            <p className="small text-muted mb-4">
              Define los umbrales de facturación mensual proyectada (en USD) para clasificar automáticamente las cuentas en Tier 1 (VIP / Key Account), Tier 2 (Mid-Market) y Tier 3 (Standard).
            </p>
            <form onSubmit={handleSaveTiers}>
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label fw-bold mb-1">Monto Mínimo Mensual para Tier 1 (VIP) [USD]</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input 
                      type="number" 
                      className="form-control" 
                      min="0" 
                      required 
                      value={tierConfig.tier1UsdMin}
                      onChange={e => setTierConfig(prev => ({ ...prev, tier1UsdMin: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="form-text text-muted" style={{ fontSize: '0.78rem' }}>
                    Cuentas con facturación contratada &ge; a este monto serán clasificadas automáticamente como Tier 1.
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold mb-1">Monto Mínimo Mensual para Tier 2 (Mid-Market) [USD]</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input 
                      type="number" 
                      className="form-control" 
                      min="0" 
                      required 
                      value={tierConfig.tier2UsdMin}
                      onChange={e => setTierConfig(prev => ({ ...prev, tier2UsdMin: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="form-text text-muted" style={{ fontSize: '0.78rem' }}>
                    Cuentas entre este monto y el umbral de Tier 1 serán Tier 2. Cuentas menores serán Tier 3 (Standard).
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-warning rounded-pill px-4 fw-bold text-dark" disabled={savingTiers}>
                {savingTiers ? 'Guardando...' : 'Guardar Umbrales de Tiers'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CARD: PAÍSES DE OPERACIÓN Y TERRITORIOS */}
      {(!mode || mode === 'negocio') && (
        <div className="col-12">
          <div className="card border-0 bg-light p-4 rounded-4 shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-bold mb-1 text-dark">
                  <i className="bi bi-globe-americas me-2 text-primary"></i>Países de Operación y Territorios Activos
                </h5>
                <p className="small text-muted mb-0">
                  Configura en qué países opera la empresa. Los países activos aparecerán en el selector del menú superior, formularios de alta de leads/clientes y filtros de cartera.
                </p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-4 border border-light shadow-sm mb-4">
              <div className="row g-3 mb-3 pb-3 border-bottom align-items-center">
                <div className="col-md-6">
                  <label className="form-label fw-bold mb-1 small">País por Defecto al Crear Registros</label>
                  <select
                    className="form-select form-select-sm rounded-pill"
                    value={paisesConfig.paisPorDefecto || 'AR'}
                    onChange={e => setPaisesConfig(prev => ({ ...prev, paisPorDefecto: e.target.value }))}
                  >
                    {paisesConfig.paises.filter(p => p.activo).map(p => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.nombre} ({p.codigo}) - Moneda: {p.moneda}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold mb-1 small">Opción "Ver Todos los Países" en el Menú Superior</label>
                  <div className="form-check form-switch mt-1">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="permitirTodosCheck"
                      checked={paisesConfig.permitirTodos ?? true}
                      onChange={e => setPaisesConfig(prev => ({ ...prev, permitirTodos: e.target.checked }))}
                    />
                    <label className="form-check-label small text-dark fw-semibold" htmlFor="permitirTodosCheck">
                      Habilitar botón "🌍 Todos" para vista regional unificada
                    </label>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                  <thead className="table-light text-muted">
                    <tr>
                      <th className="fw-bold border-0 rounded-start">Código ISO</th>
                      <th className="fw-bold border-0">Nombre del País</th>
                      <th className="fw-bold border-0">Moneda Local</th>
                      <th className="fw-bold border-0 text-center">Estado Operativo</th>
                      <th className="fw-bold border-0 text-end rounded-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paisesConfig.paises.map((pais) => (
                      <tr key={pais.codigo}>
                        <td>
                          <span className="badge bg-primary-subtle text-primary fw-bold font-monospace px-2.5 py-1">
                            {pais.codigo}
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm border-0 border-bottom bg-transparent"
                            style={{ maxWidth: '220px' }}
                            value={pais.nombre}
                            onChange={e => {
                              const val = e.target.value;
                              setPaisesConfig(prev => ({
                                ...prev,
                                paises: prev.paises.map(p => p.codigo === pais.codigo ? { ...p, nombre: val } : p)
                              }));
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm border-0 border-bottom bg-transparent text-uppercase font-monospace"
                            style={{ maxWidth: '100px' }}
                            value={pais.moneda}
                            onChange={e => {
                              const val = e.target.value.toUpperCase();
                              setPaisesConfig(prev => ({
                                ...prev,
                                paises: prev.paises.map(p => p.codigo === pais.codigo ? { ...p, moneda: val } : p)
                              }));
                            }}
                          />
                        </td>
                        <td className="text-center">
                          <div className="form-check form-switch d-inline-block">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={pais.activo}
                              onChange={() => handleTogglePais(pais.codigo)}
                              title={pais.activo ? 'Operación activa' : 'Operación inactiva'}
                            />
                          </div>
                          <span className={`small ms-1 fw-semibold ${pais.activo ? 'text-success' : 'text-muted'}`}>
                            {pais.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-danger p-0"
                            onClick={() => handleDeletePais(pais.codigo)}
                            title="Eliminar país"
                          >
                            <i className="bi bi-trash fs-6"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Formulario para añadir país */}
              <div className="mt-3 pt-3 border-top d-flex gap-2 align-items-end flex-wrap">
                <div>
                  <label className="form-label small text-muted mb-1">Código (ej. UY, BR, ES)</label>
                  <input
                    type="text"
                    maxLength={3}
                    className="form-control form-control-sm text-uppercase font-monospace"
                    style={{ width: '90px' }}
                    placeholder="UY"
                    value={newPaisCodigo}
                    onChange={e => setNewPaisCodigo(e.target.value)}
                  />
                </div>
                <div className="flex-grow-1" style={{ minWidth: '180px' }}>
                  <label className="form-label small text-muted mb-1">Nombre del País</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Uruguay"
                    value={newPaisNombre}
                    onChange={e => setNewPaisNombre(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label small text-muted mb-1">Moneda (ej. UYU)</label>
                  <input
                    type="text"
                    maxLength={4}
                    className="form-control form-control-sm text-uppercase font-monospace"
                    style={{ width: '90px' }}
                    placeholder="UYU"
                    value={newPaisMoneda}
                    onChange={e => setNewPaisMoneda(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary rounded-pill px-3"
                  onClick={handleAddPais}
                >
                  <i className="bi bi-plus-lg me-1"></i> Añadir País
                </button>
              </div>
            </div>

            <div className="d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
                onClick={handleSavePaises}
                disabled={savingPaises}
              >
                {savingPaises ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                ) : (
                  <><i className="bi bi-check2-circle me-2"></i>Guardar Países de Operación</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* CARD 3: CONFIGURACIÓN DE EQUIPOS Y GAMIFICACIÓN */}
      {(!mode || mode === 'equipos') && (
        <div className="col-12">
          <div className="card border-0 bg-light p-4 rounded-4 shadow-sm">
            <h5 className="fw-bold mb-3 text-dark">
              <i className="bi bi-people me-2 text-primary"></i>Configuración de Equipos y Gamificación
            </h5>
            <p className="small text-muted mb-4">
              Administra la estructura de equipos de la empresa y define qué equipos participan activamente en las dinámicas y leaderboards de gamificación del CRM.
            </p>
            
            <div className="table-responsive bg-white p-3 rounded-4 border border-light shadow-sm mb-4">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                <thead className="table-light text-muted">
                  <tr>
                    <th className="fw-bold border-0 rounded-start">Código ID</th>
                    <th className="fw-bold border-0">Nombre de la Pestaña / Equipo</th>
                    <th className="fw-bold border-0 text-center">Participa en Gamificación</th>
                    <th className="fw-bold border-0 text-end rounded-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {equipos.map((eq) => (
                    <tr key={eq.id}>
                      <td className="font-monospace fw-bold text-secondary">{eq.id}</td>
                      <td>
                        <input 
                          type="text" 
                          className="form-control form-control-sm border-0 border-bottom bg-transparent"
                          style={{ maxWidth: '250px' }}
                          value={eq.nombre}
                          onChange={e => handleRenameTeam(eq.id, e.target.value)}
                        />
                      </td>
                      <td className="text-center">
                        <div className="form-check form-switch d-inline-block">
                          <input 
                            className="form-check-input" 
                            type="checkbox" 
                            role="switch"
                            checked={eq.participaGamificacion}
                            onChange={() => handleToggleGamificacion(eq.id)}
                          />
                        </div>
                      </td>
                      <td className="text-end">
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-danger border-0 rounded-pill"
                          onClick={() => handleDeleteTeam(eq.id)}
                          disabled={['Global', 'CX', 'Adquisicion', 'Retencion'].includes(eq.id)}
                          title={['Global', 'CX', 'Adquisicion', 'Retencion'].includes(eq.id) ? "Equipo Protegido (No se puede eliminar)" : "Eliminar Equipo"}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row g-3 align-items-end mb-4 bg-white p-3 rounded-4 border border-light shadow-sm">
              <div className="col-md-4">
                <label className="form-label small fw-bold text-muted mb-1">Código ID (Sin espacios ni especiales)</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  placeholder="Ej. Operaciones"
                  value={newTeamId}
                  onChange={e => setNewTeamId(e.target.value)}
                />
              </div>
              <div className="col-md-5">
                <label className="form-label small fw-bold text-muted mb-1">Nombre del Equipo</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  placeholder="Ej. Operaciones & Servicios"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <button 
                  type="button" 
                  className="btn btn-outline-primary btn-sm rounded-pill w-100 fw-bold"
                  onClick={handleAddTeam}
                >
                  <i className="bi bi-plus-lg me-1"></i> Agregar a la Lista
                </button>
              </div>
            </div>

            <div className="text-end">
              <button 
                type="button" 
                className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
                onClick={handleSaveEquipos}
                disabled={savingEquipos}
              >
                {savingEquipos ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                ) : (
                  <><i className="bi bi-save me-2"></i>Guardar Todos los Equipos</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <ConfirmModal
          show={showConfirmModal}
          title="Eliminar Equipo"
          message={`¿Estás seguro de eliminar el equipo "${teamToDelete}"? Esto no eliminará a los usuarios asociados, pero perderán su equipo de trabajo.`}
          confirmBtnClass="btn-danger"
          confirmText="Eliminar"
          onConfirm={executeDeleteTeam}
          onClose={() => {
            setShowConfirmModal(false);
            setTeamToDelete(null);
          }}
        />
      )}
    </div>
  );
}
