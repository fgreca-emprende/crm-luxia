import { useState, useEffect, useRef, useMemo } from 'react';
import { useClientesPaginados } from '../../hooks/useClientesPaginados';
import { supabase } from '../../lib/supabase';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { useUserRole } from '../../contexts/UserRoleContext';
import { ExportDrawer } from './ExportDrawer';
import { BulkImportModal } from './BulkImportModal';
import { useVirtualWindow } from '../../hooks/useVirtualWindow';
import { AgentPresenceMonitor } from './dashboard/AgentPresenceMonitor';
import { formatDateTime } from '../../utils/dateUtils';
import { getConfigGeneral } from '../../lib/configGeneral';


const ESTADOS_LIFECYCLE = [
  'Onboarding',
  'Activo',
  'En Riesgo',
  'Churn',
];

const HEALTH_OPTIONS = [
  { value: 'Green',  label: '🟢 Urgencia Baja',  badge: 'bg-success' },
  { value: 'Yellow', label: '🟡 Urgencia Media', badge: 'bg-warning text-dark' },
  { value: 'Red',    label: '🔴 Urgencia Alta',  badge: 'bg-danger' },
];

export function ClientesTable({ onGestionarClick, selectedCountry, iaPausada }) {
  const { isSuperAdmin, isAdmin, isSupervisor, hasPermission, role, userTeam, getDataScope, user } = useUserRole();
  const canImportData = hasPermission('actions', 'alta_masiva_registros') || hasPermission('alta_masiva_registros');

  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);
  const clientScope = getDataScope('clientes');
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showPresenceMonitor, setShowPresenceMonitor] = useState(false);
  const [mesesParaRetencion, setMesesParaRetencion] = useState(3);

  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    const loadUsuarios = async () => {
      try {
        const { data, error } = await supabase.from('usuarios').select('*');
        if (error) throw error;
        setUsuarios(data || []);
      } catch (err) {
        console.error('Error fetching usuarios in ClientesTable:', err);
      }
    };
    loadUsuarios();
  }, []);

  const teamEmails = useMemo(() => {
    if (!usuarios || usuarios.length === 0 || !userTeam) return [];
    return usuarios
      .filter(u => normalizarEquipo(u.equipo) === normalizedTeam)
      .map(u => (u.email || '').toLowerCase().trim())
      .filter(Boolean);
  }, [usuarios, normalizedTeam, userTeam]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');   // controlled input
  const [searchTerm, setSearchTerm]   = useState('');   // debounced value
  const [filterEstado, setFilterEstado] = useState('');
  const [filterHealth, setFilterHealth] = useState('');
  const [filterFecha, setFilterFecha] = useState('');

  const { clientes, loading, hasMore, loadClientes, refresh, error, isInitializing } =
    useClientesPaginados(25, selectedCountry, searchTerm, teamEmails);

  // Debounce search 300 ms
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Lazy scroll luxia_ia ───────────────────────────────────────────────────
  const scrollObserverRef = useRef(null);

  useEffect(() => {
    const el = scrollObserverRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Guard: solo carga más si ya hay datos (evita duplicar la primera página en el mount)
        if (entries[0].isIntersecting && hasMore && !loading && clientes.length > 0) {
          loadClientes(true);
        }
      },
      { rootMargin: '150px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadClientes, clientes.length]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filteredClientes = useMemo(() => {
    let result = clientes;
    if (clientScope !== 'ALL') {
      result = result.filter(c => {
        if (clientScope === 'OWN') {
          return c.comercialEmail && c.comercialEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim();
        } else if (clientScope === 'TEAM') {
          const clientEmail = (c.comercialEmail || '').toLowerCase().trim();
          const clientFase = normalizarEquipo(c.faseComercial);
          const isSelf = clientEmail === user?.email?.toLowerCase().trim();
          const isTeamMember = teamEmails.includes(clientEmail);
          return isSelf || isTeamMember || clientFase === normalizedTeam;
        }
        return false; // NONE
      });
    }
    if (filterEstado) {
      result = result.filter(c => c.estado === filterEstado);
    }
    if (filterHealth) {
      result = result.filter(c => c.healthScore?.riesgo === filterHealth);
    }
    if (filterFecha) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      result = result.filter(c => {
        if (!c.fechaIngreso) return false;
        const fDate = c.fechaIngreso.toDate ? c.fechaIngreso.toDate() : new Date(c.fechaIngreso);
        const diffTime = now.getTime() - fDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (filterFecha === 'hoy') {
          const entryDate = new Date(fDate.getFullYear(), fDate.getMonth(), fDate.getDate());
          return entryDate.getTime() === today.getTime();
        }
        if (filterFecha === 'semana') {
          return diffDays <= 7;
        }
        if (filterFecha === 'mes') {
          return diffDays <= 30;
        }
        return true;
      });
    }
    return result;
  }, [clientes, filterEstado, filterHealth, filterFecha, role, normalizedTeam, clientScope]);

  const hasActiveFilters = !!(searchTerm || filterEstado || filterHealth || filterFecha);
  const activeFilterCount = [searchTerm, filterEstado, filterHealth, filterFecha].filter(Boolean).length;

  const clearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setFilterEstado('');
    setFilterHealth('');
    setFilterFecha('');
  };

  // ── Virtualization ──────────────────────────────────────────────────────────
  const { visibleItems: visibleClientesTable, paddingTop: tablePaddingTop, paddingBottom: tablePaddingBottom } =
    useVirtualWindow(filteredClientes, 55, 10);

  // ── Business config ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await getConfigGeneral('business');
        if (data) setMesesParaRetencion(data.mesesParaRetencion || 3);
      } catch (err) {
        console.warn('Error fetching business config:', err.message);
      }
    };
    loadConfig();
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderPhaseBadge = (cliente) => {
    const now = new Date();
    const fi = cliente.fechaIngreso
      ? (cliente.fechaIngreso.toDate ? cliente.fechaIngreso.toDate() : new Date(cliente.fechaIngreso))
      : now;
    const diffMonths =
      (now.getFullYear() - fi.getFullYear()) * 12 + now.getMonth() - fi.getMonth();
    const isRetencion = cliente.faseManual
      ? cliente.faseManual === 'Retencion'
      : diffMonths > mesesParaRetencion;

    return isRetencion ? (
      <span
        className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-1 ms-2"
        style={{ fontSize: '0.65rem' }}
        title={`Retención${cliente.faseManual ? ' (Manual)' : ' (Automática)'}`}
      >
        <i className="bi bi-diagram-3 me-1" />Retención{cliente.faseManual ? ' (M)' : ''}
      </span>
    ) : (
      <span
        className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2 py-1 ms-2"
        style={{ fontSize: '0.65rem' }}
        title={`Adquisición${cliente.faseManual ? ' (Manual)' : ' (Automática)'}`}
      >
        <i className="bi bi-tree me-1" />Adquisición{cliente.faseManual ? ' (M)' : ''}
      </span>
    );
  };

  const renderHealthBadge = (riesgo) => {
    let badge = <span className="badge bg-secondary status-badge">N/A</span>;
    if (riesgo === 'Green')  badge = <span className="badge bg-success status-badge">Urgencia Baja</span>;
    if (riesgo === 'Yellow') badge = <span className="badge bg-warning text-dark status-badge">Urgencia Media</span>;
    if (riesgo === 'Red')    badge = <span className="badge bg-danger status-badge">Urgencia Alta</span>;

    if (iaPausada && riesgo) {
      return (
        <div className="d-flex flex-column align-items-center gap-1">
          {badge}
          <span className="badge bg-light text-muted border px-1" style={{fontSize: '0.6rem'}} title="Health Score Congelado: No Analizado por LUXIA IA">
            <i className="bi bi-snow me-1 text-info"></i>No Analizado
          </span>
        </div>
      );
    }
    return badge;
  };

  const renderCountryBadge = (pais) => {
    const map = { AR: '🇦🇷', CL: '🇨🇱', CO: '🇨🇴', PE: '🇵🇪', MX: '🇲🇽' };
    const flag = map[pais];
    return flag ? (
      <span className="badge bg-light text-dark border px-2 py-1 rounded-pill fw-bold">
        <span className="me-1">{flag}</span>{pais}
      </span>
    ) : (
      <span className="badge bg-light text-muted border px-2 py-1 rounded-pill fw-normal">
        <span className="me-1">🌐</span>REG
      </span>
    );
  };

  const handleForceRefresh = () => {
    refresh();
  };

  // ── Shared footer element ──────────────────────────────────────────────────
  const renderFooter = () => (
    <>
      {/* LUXIA IA — lazy scroll trigger */}
      <div ref={scrollObserverRef} style={{ height: 1 }} aria-hidden="true" />

      {/* Loading more indicator */}
      {loading && clientes.length > 0 && (
        <div className="text-center py-4">
          <SpinnerPremium size="sm" text="Cargando más clientes..." />
        </div>
      )}

      {/* End of list */}
      {!hasMore && clientes.length > 0 && (
        <div className="text-center py-3 text-muted small">
          <i className="bi bi-check-circle me-1 text-success" />
          {hasActiveFilters
            ? `${filteredClientes.length} resultado${filteredClientes.length !== 1 ? 's' : ''} encontrado${filteredClientes.length !== 1 ? 's' : ''}`
            : `Todos los clientes cargados (${clientes.length})`}
        </div>
      )}
    </>
  );

  // ── No results (filtered) ──────────────────────────────────────────────────
  const renderNoFilterResults = () => (
    <div className="text-center py-5">
      <i className="bi bi-funnel fs-2 d-block mb-2 opacity-25" />
      <p className="text-muted mb-1 fw-bold">Sin resultados</p>
      <p className="text-muted small mb-3">
        Ningún cliente coincide con los filtros aplicados.
      </p>
      <button className="btn btn-sm btn-outline-secondary rounded-pill px-4" onClick={clearFilters}>
        <i className="bi bi-x-circle me-1" />Limpiar filtros
      </button>
    </div>
  );

  const [activeMainTab, setActiveMainTab] = useState('cartera'); // 'cartera' o 'dashboard'

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Top Bar con Selector de Modo (Metodologia Tablero CRM) ────────────── */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-building text-primary fs-5"></i>
          <h5 className="fw-bold mb-0 text-dark" style={{ fontFamily: "'Outfit', sans-serif" }}>Gestión de Cartera & Retención</h5>
        </div>

        <div className="apple-segmented-control" style={{ padding: '3px' }}>
          <button
            type="button"
            className={`apple-segmented-item ${activeMainTab === 'cartera' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('cartera')}
          >
            <i className="bi bi-table"></i>
            <span>Cartera de Clientes</span>
          </button>
          <button
            type="button"
            className={`apple-segmented-item ${activeMainTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('dashboard')}
          >
            <i className="bi bi-graph-up"></i>
            <span>Dashboard Cartera & Retención</span>
          </button>
        </div>
      </div>

      {activeMainTab === 'dashboard' ? (
        <div className="glass-panel p-4 rounded-4 border bg-white shadow-sm mb-4">
          <h5 className="fw-bold mb-3 text-dark">Dashboard Operativo de Cartera, Retención y Churn</h5>
          
          {/* KPI Grid for Retención */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="kpi-card-ambient kpi-glow-blue h-100 d-flex flex-column justify-content-between">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Clientes Activos</span>
                  <div className="kpi-icon-badge kpi-icon-blue"><i className="bi bi-people-fill"></i></div>
                </div>
                <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-text-primary)', letterSpacing: '-0.02em' }}>
                  {filteredClientes.length}
                </h3>
                <span className="small mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Cuentas corporativas</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card-ambient kpi-glow-red h-100 d-flex flex-column justify-content-between">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Riesgo Churn</span>
                  <div className="kpi-icon-badge kpi-icon-red"><i className="bi bi-exclamation-triangle-fill"></i></div>
                </div>
                <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-red)', letterSpacing: '-0.02em' }}>
                  {filteredClientes.filter(c => c.healthScore?.riesgo === 'Red' || c.healthScore?.riesgo === 'Yellow').length}
                </h3>
                <span className="small fw-semibold mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-red)' }}>Requieren atención preventiva</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card-ambient kpi-glow-orange h-100 d-flex flex-column justify-content-between">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>En Onboarding</span>
                  <div className="kpi-icon-badge kpi-icon-orange"><i className="bi bi-hourglass-split"></i></div>
                </div>
                <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-orange)', letterSpacing: '-0.02em' }}>
                  {filteredClientes.filter(c => c.estadoLifecycle === 'Onboarding').length}
                </h3>
                <span className="small mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Implementación en curso</span>
              </div>
            </div>
            <div className="col-md-3">
              <div className="kpi-card-ambient kpi-glow-green h-100 d-flex flex-column justify-content-between">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Saludables (Green)</span>
                  <div className="kpi-icon-badge kpi-icon-green"><i className="bi bi-shield-check"></i></div>
                </div>
                <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-green)', letterSpacing: '-0.02em' }}>
                  {filteredClientes.filter(c => c.healthScore?.riesgo === 'Green').length}
                </h3>
                <span className="small mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Bajo riesgo de fuga</span>
              </div>
            </div>
          </div>

          {/* Alerta Destacada de Clientes en Riesgo Alto (Red Churn Risk) */}
          {(() => {
            const redClients = filteredClientes.filter(c => c.healthScore?.riesgo === 'Red');
            if (redClients.length === 0) return null;
            return (
              <div className="alert alert-danger p-3 rounded-4 mb-4 border border-danger border-opacity-25 bg-danger bg-opacity-10 shadow-sm">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
                  <h6 className="fw-bold text-danger mb-0">Alerta de Churn Inminente: {redClients.length} Cuentas en Salud Crítica (Rojo)</h6>
                </div>
                <div className="row g-2">
                  {redClients.slice(0, 4).map(c => (
                    <div className="col-md-3" key={c.id}>
                      <div className="p-2 bg-white rounded-3 border border-danger border-opacity-50 shadow-sm">
                        <span className="fw-bold text-dark d-block text-truncate small">{c.nombreEmpresa || c.razonSocial}</span>
                        <span className="text-muted extra-small d-block" style={{ fontSize: '0.72rem' }}>AM: {c.comercialEmail || 'Sin Asignar'}</span>
                        <button className="btn btn-xs btn-outline-danger w-100 mt-1 fw-bold rounded-pill" onClick={() => onGestionarClick(c)}>
                          Atender Cuenta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Breakdown Charts */}
          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <div className="p-3 border rounded-4 bg-light h-100">
                <h6 className="fw-bold text-dark mb-3">Distribución por Nivel de Salud (Health Score)</h6>
                {[
                  { key: 'Green', label: '🟢 Saludable (Verde)', color: 'bg-success' },
                  { key: 'Yellow', label: '🟡 Riesgo Medio (Amarillo)', color: 'bg-warning' },
                  { key: 'Red', label: '🔴 Riesgo Alto (Rojo)', color: 'bg-danger' }
                ].map(item => {
                  const count = filteredClientes.filter(c => (c.healthScore?.riesgo || 'Green') === item.key).length;
                  const pct = filteredClientes.length > 0 ? Math.round((count / filteredClientes.length) * 100) : 0;
                  return (
                    <div key={item.key} className="mb-3">
                      <div className="d-flex justify-content-between small fw-bold mb-1">
                        <span>{item.label}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className={`progress-bar ${item.color}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="col-md-6">
              <div className="p-3 border rounded-4 bg-light h-100">
                <h6 className="fw-bold text-dark mb-3">Distribución por Estado de Ciclo de Vida</h6>
                {ESTADOS_LIFECYCLE.map(st => {
                  const count = filteredClientes.filter(c => (c.estadoLifecycle || 'Activo') === st).length;
                  const pct = filteredClientes.length > 0 ? Math.round((count / filteredClientes.length) * 100) : 0;
                  return (
                    <div key={st} className="mb-3">
                      <div className="d-flex justify-content-between small fw-bold mb-1">
                        <span>{st}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div className="progress-bar bg-primary" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Monitor de Presencia Comercial de Gestores de Cartera & Retención (Farming) */}
          <AgentPresenceMonitor 
            targetTeam="Retencion" 
            selectedCountry={selectedCountry} 
            title="Monitor de Presencia & Disponibilidad - Gestores de Cartera (Farming)" 
            icon="bi-building-gear"
            showRoutingStatus={true}
          />

          {/* Tabla Operativa de Balanceo por Account Manager (AM) */}

          {(() => {
            const amWorkloadMap = {};
            filteredClientes.forEach(cli => {
              const rawEmail = (cli.comercialEmail || 'sin_asignar').toLowerCase().trim();
              const isUnassigned = !cli.comercialEmail || rawEmail === 'sin_asignar' || rawEmail === 'sin asignar';
              const ownerKey = isUnassigned ? 'sin_asignar' : rawEmail;

              if (!amWorkloadMap[ownerKey]) {
                const uObj = usuarios.find(u => (u.email || '').toLowerCase().trim() === ownerKey);
                amWorkloadMap[ownerKey] = {
                  email: isUnassigned ? 'sin_asignar' : ownerKey,
                  nombre: isUnassigned ? '🔓 Sin Account Manager' : (uObj?.nombre || ownerKey),
                  isUnassigned,
                  total: 0,
                  green: 0,
                  yellow: 0,
                  red: 0
                };
              }

              amWorkloadMap[ownerKey].total++;
              const r = cli.healthScore?.riesgo || 'Green';
              if (r === 'Green') amWorkloadMap[ownerKey].green++;
              else if (r === 'Yellow') amWorkloadMap[ownerKey].yellow++;
              else if (r === 'Red') amWorkloadMap[ownerKey].red++;
            });

            const amWorkloadList = Object.values(amWorkloadMap).sort((a, b) => b.total - a.total);

            return (
              <div className="row g-4">
                <div className="col-12">
                  <div className="p-4 border rounded-4 bg-white shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                      <h6 className="fw-bold text-dark mb-0">
                        <i className="bi bi-people-fill text-primary me-2"></i>
                        Balanceo de Cartera & Riesgo por Account Manager (AM)
                      </h6>
                      <span className="badge bg-light text-muted border rounded-pill px-3 py-1 small">
                        {amWorkloadList.length} ejecutivos con cartera
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ fontSize: '0.75rem' }}>Account Manager (AM)</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-center">Cuentas Totales</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-center">🟢 Saludables</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-center">🟡 Riesgo Medio</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-center">🔴 Riesgo Alto (Churn)</th>
                            <th style={{ fontSize: '0.75rem' }} className="text-end">Estado Cartera</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amWorkloadList.map((item, idx) => (
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
                                <span className={`badge rounded-pill ${item.green > 0 ? 'bg-success' : 'bg-light text-muted'}`}>
                                  {item.green}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge rounded-pill ${item.yellow > 0 ? 'bg-warning text-dark' : 'bg-light text-muted'}`}>
                                  {item.yellow}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge rounded-pill ${item.red > 0 ? 'bg-danger' : 'bg-light text-muted'}`}>
                                  {item.red}
                                </span>
                              </td>
                              <td className="text-end">
                                {item.isUnassigned ? (
                                  <span className="badge bg-danger rounded-pill px-3 py-1">⚠️ Asignación Pendiente</span>
                                ) : (
                                  <span className={`badge rounded-pill px-3 py-1 ${
                                    item.red > 0 ? 'bg-danger' : item.yellow > 2 ? 'bg-warning text-dark' : 'bg-success'
                                  }`}>
                                    {item.red > 0 ? 'Riesgo Crítico' : item.yellow > 2 ? 'Atención' : 'Saludable'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <>
          {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
          <div className="filter-bar-premium mb-3">
        {/* Search Input */}
        <div className="filter-search-wrapper">
          <i className="bi bi-search filter-search-icon" />
          <input
            id="clientes-search"
            type="text"
            className="filter-search-input"
            placeholder="Buscar por nombre de empresa..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            autoComplete="off"
          />
          {searchInput && (
            <button
              className="filter-search-clear"
              onClick={() => { setSearchInput(''); setSearchTerm(''); }}
              aria-label="Limpiar búsqueda"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>

        {/* Estado filter */}
        <div className="filter-select-wrapper">
          <i className="bi bi-diagram-3 filter-select-icon" />
          <select
            id="filter-estado"
            className="filter-select"
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_LIFECYCLE.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {/* Health filter */}
        <div className="filter-select-wrapper">
          <i className="bi bi-heart-pulse filter-select-icon" />
          <select
            id="filter-health"
            className="filter-select"
            value={filterHealth}
            onChange={e => setFilterHealth(e.target.value)}
          >
            <option value="">Todos los health</option>
            {HEALTH_OPTIONS.map(h => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="filter-select-wrapper">
          <i className="bi bi-calendar-event filter-select-icon" />
          <select
            id="filter-fecha"
            className="filter-select"
            value={filterFecha}
            onChange={e => setFilterFecha(e.target.value)}
          >
            <option value="">Todas las fechas</option>
            <option value="hoy">📅 Ingreso: Hoy</option>
            <option value="semana">📅 Ingreso: Últimos 7 Días</option>
            <option value="mes">📅 Ingreso: Últimos 30 Días</option>
          </select>
        </div>

        {/* Export button */}
        {hasPermission('actions', 'exportar_clientes') && (
          <button
            className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold d-flex align-items-center gap-1 shadow-sm"
            onClick={() => setShowExportDrawer(true)}
            title="Exportar clientes"
            style={{ marginRight: '8px' }}
          >
            <i className="bi bi-download" />
            Exportar
          </button>
        )}

        {canImportData && (
          <button
            className="btn btn-sm btn-outline-info text-info rounded-pill px-3 fw-bold d-flex align-items-center gap-1 shadow-sm"
            onClick={() => setShowBulkImportModal(true)}
            title="Carga masiva de clientes"
            style={{ marginRight: '8px' }}
          >
            <i className="bi bi-file-earmark-arrow-up" />
            Carga Masiva
          </button>
        )}




        {/* Refresh button */}
        <button
          className="btn btn-sm btn-outline-secondary rounded-pill ms-auto px-3 fw-bold d-flex align-items-center gap-1 shadow-sm"
          onClick={handleForceRefresh}
          title="Forzar recarga de clientes"
        >
          <i className="bi bi-arrow-clockwise" />
          Refrescar
        </button>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            className="btn btn-sm btn-outline-danger rounded-pill px-3 filter-clear-btn"
            onClick={clearFilters}
            title="Limpiar todos los filtros"
          >
            <i className="bi bi-x-circle me-1" />Limpiar
          </button>
        )}
      </div>



      {/* ── Active filters summary ──────────────────────────────────────────── */}
      {(hasActiveFilters || clientes.length > 0) && !isInitializing && (
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap" style={{ fontSize: '0.78rem' }}>
          {hasActiveFilters && (
            <>
              <span className="badge bg-primary bg-opacity-15 text-primary rounded-pill px-3 py-1 fw-bold">
                <i className="bi bi-funnel-fill me-1" />
                {activeFilterCount} filtro{activeFilterCount !== 1 ? 's' : ''} activo{activeFilterCount !== 1 ? 's' : ''}
              </span>
              <span className="text-muted">·</span>
            </>
          )}
          <span className="text-muted">
            Mostrando <strong className="text-dark">{filteredClientes.length}</strong>
            {hasActiveFilters && <> de <strong className="text-dark">{clientes.length}</strong> cargados</>}
            {hasMore && !hasActiveFilters && <span className="text-muted"> (más disponibles)</span>}
          </span>
          {searchTerm && (
            <span className="badge bg-light border text-dark rounded-pill px-2 py-1">
              <i className="bi bi-search me-1 text-primary" />"{searchTerm}"
            </span>
          )}
          {filterEstado && (
            <span className="badge bg-light border text-dark rounded-pill px-2 py-1">
              <i className="bi bi-diagram-3 me-1 text-primary" />{filterEstado}
            </span>
          )}
          {filterHealth && (
            <span className={`badge rounded-pill px-2 py-1 ${HEALTH_OPTIONS.find(h => h.value === filterHealth)?.badge}`}>
              {filterHealth}
            </span>
          )}
          {filterFecha && (
            <span className="badge bg-light border text-dark rounded-pill px-2 py-1">
              <i className="bi bi-calendar-event me-1 text-primary" />
              {filterFecha === 'hoy' ? 'Ingreso: Hoy' : filterFecha === 'semana' ? 'Ingreso: Últimos 7 Días' : 'Ingreso: Últimos 30 Días'}
            </span>
          )}
        </div>
      )}

      {/* ── Desktop Table ───────────────────────────────────────────────────── */}
      <div className="table-responsive-premium rounded shadow-sm d-none d-md-block" style={{ position: 'relative' }}>
        <table className="table table-premium w-100 mb-0">
          <thead className="table-light">
            <tr>
              <th>Empresa</th>
              <th>País</th>
              <th>Estado</th>
              <th>Riesgo (IA)</th>
              <th>Última Evaluación</th>
              <th>Última Actualización</th>
              <th className="text-end">Acción</th>
            </tr>
          </thead>
          <tbody>
            {/* Data rows */}
            {tablePaddingTop > 0 && <tr style={{ height: tablePaddingTop }}><td colSpan="7" /></tr>}
            {visibleClientesTable.map(cliente => (
              <tr key={cliente.id}>
                <td>
                  <div className="fw-bold text-dark d-flex align-items-center flex-wrap">
                    {cliente.nombreEmpresa}
                    {renderPhaseBadge(cliente)}
                  </div>
                </td>
                <td>{renderCountryBadge(cliente.pais)}</td>
                <td>
                  <span className="badge bg-light text-dark border px-2 py-1 rounded-pill">
                    {cliente.estado}
                  </span>
                </td>
                <td>{renderHealthBadge(cliente.healthScore?.riesgo)}</td>
                <td className="small text-muted">
                  {cliente.healthScore?.ultimaEvaluacion?.toDate
                    ? cliente.healthScore.ultimaEvaluacion.toDate().toLocaleDateString()
                    : 'N/A'}
                </td>
                <td className="small text-muted">
                  {formatDateTime(cliente.updatedAt || cliente.ultimoCambioEstado || cliente.createdAt || cliente.fechaIngreso)}
                </td>
                <td className="text-end">
                  <button
                    className="btn btn-sm btn-outline-primary rounded-pill px-3"
                    onClick={() => onGestionarClick(cliente)}
                  >
                    Gestionar
                  </button>
                </td>
              </tr>
            ))}
            {tablePaddingBottom > 0 && <tr style={{ height: tablePaddingBottom }}><td colSpan="7" /></tr>}

            {/* Skeleton loader (initial load) */}
            {(loading || isInitializing) && clientes.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="skeleton-row">
                  <td><div className="skeleton-line" style={{ width: `${60 + (i % 3) * 15}%` }} /></td>
                  <td><div className="skeleton-line" style={{ width: 40 }} /></td>
                  <td><div className="skeleton-line" style={{ width: 80 }} /></td>
                  <td><div className="skeleton-line" style={{ width: 60 }} /></td>
                  <td><div className="skeleton-line" style={{ width: 70 }} /></td>
                  <td className="text-end"><div className="skeleton-line ms-auto" style={{ width: 80 }} /></td>
                </tr>
              ))
            )}

            {/* Error state */}
            {error && clientes.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-5 text-danger">
                  <div className="d-flex align-items-center justify-content-center gap-2">
                    <i className="bi bi-exclamation-octagon fs-5" />
                    <span>{error}</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state — no data at all */}
            {clientes.length === 0 && !loading && !isInitializing && !error && (
              <tr>
                <td colSpan="6" className="text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-2 d-block mb-2 opacity-50" />
                  No hay clientes registrados.
                </td>
              </tr>
            )}

            {/* No filter results */}
            {filteredClientes.length === 0 && clientes.length > 0 && !loading && (
              <tr>
                <td colSpan="6">{renderNoFilterResults()}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ────────────────────────────────────────────────────── */}
      <div className="d-block d-md-none mt-3">
        {/* Skeleton loader */}
        {(loading || isInitializing) && clientes.length === 0 && (
          <div className="py-5">
            <SpinnerPremium size="md" text="Cargando cartera de clientes..." />
          </div>
        )}

        {/* Error state */}
        {error && clientes.length === 0 && (
          <div className="text-center py-5 text-danger">
            <i className="bi bi-exclamation-octagon fs-4 d-block mb-2" />
            <span className="small fw-bold">{error}</span>
          </div>
        )}

        {/* No filter results */}
        {filteredClientes.length === 0 && clientes.length > 0 && !loading && (
          renderNoFilterResults()
        )}

        {/* Client cards */}
        {filteredClientes.map(cliente => {
          const HSColor = cliente.healthScore?.riesgo || 'N/A';
          let borderClass = 'border-start border-4 border-secondary';
          if (HSColor === 'Green')  borderClass = 'border-start border-4 border-success';
          if (HSColor === 'Yellow') borderClass = 'border-start border-4 border-warning';
          if (HSColor === 'Red')    borderClass = 'border-start border-4 border-danger';

          return (
            <div
              key={cliente.id}
              className={`card-premium mb-3 p-3 glass-panel ${borderClass} shadow-sm`}
              style={{ backgroundColor: 'var(--bg-sidebar)' }}
            >
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h6 className="fw-bold text-dark mb-1 d-flex align-items-center flex-wrap gap-1" style={{ fontSize: '1rem' }}>
                    {cliente.nombreEmpresa}
                    {renderPhaseBadge(cliente)}
                  </h6>
                  <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                    Última eval: {cliente.healthScore?.ultimaEvaluacion?.toDate
                      ? cliente.healthScore.ultimaEvaluacion.toDate().toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div>{renderCountryBadge(cliente.pais)}</div>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-secondary border-opacity-10">
                <div className="d-flex gap-2 align-items-center">
                  <span className="badge bg-light text-dark border px-2 py-1 rounded-pill" style={{ fontSize: '0.7rem' }}>
                    {cliente.estado}
                  </span>
                  {renderHealthBadge(cliente.healthScore?.riesgo)}
                </div>
                <button
                  className="btn btn-sm btn-primary rounded-pill px-3 shadow-sm"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => onGestionarClick(cliente)}
                >
                  Gestionar
                </button>
              </div>
            </div>
          );
        })}

        {/* Empty state — no data */}
        {clientes.length === 0 && !loading && !isInitializing && !error && (
          <div className="text-center py-4 text-muted small">No hay clientes registrados.</div>
        )}
      </div>

      {/* ── Lazy scroll footer (both views) ────────────────────────────────── */}
      {renderFooter()}
      </>
      )}

      <ExportDrawer 
        show={showExportDrawer} 
        onClose={() => setShowExportDrawer(false)} 
        defaultEntity="clientes" 
      />

      <BulkImportModal
        show={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        initialEntity="clientes"
        user={user}
      />
    </>
  );
}

