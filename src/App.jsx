import { useState, useEffect, lazy, Suspense, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { getConfigGeneral } from './lib/configGeneral';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DashboardKPIs } from './components/features/DashboardKPIs';
import { UserRoleProvider, useUserRole } from './contexts/UserRoleContext';
import { SpinnerPremium } from './components/ui/SpinnerPremium';
import { NetworkBanner } from './components/ui/NetworkBanner';
import { MeetCountdownWidget } from './components/ui/MeetCountdownWidget';
import { PublicFormView } from './components/features/integrations/components/PublicFormView';
import { LuxiaLogo } from './components/ui/LuxiaLogo';
import { useInactivityTimer } from './hooks/useInactivityTimer';
import { LoginView } from './components/auth/LoginView';
import { TopSuperBar } from './components/layout/TopSuperBar';
import { MobileNavSheet } from './components/layout/MobileNavSheet';

import { lazyWithRetry } from './lib/lazyWithRetry';

// Lazy loaded components with auto-retry
const ClientesTable = lazyWithRetry(() => import('./components/features/ClientesTable').then(m => ({ default: m.ClientesTable })));
const ClientGestionModal = lazyWithRetry(() => import('./components/features/ClientGestionModal').then(m => ({ default: m.ClientGestionModal })));
const AdminConfigView = lazyWithRetry(() => import('./components/features/AdminConfigView').then(m => ({ default: m.AdminConfigView })));
const ManualOperacionesModal = lazyWithRetry(() => import('./components/features/ManualOperacionesModal').then(m => ({ default: m.ManualOperacionesModal })));
const AlertasPanel = lazyWithRetry(() => import('./components/features/AlertasPanel').then(m => ({ default: m.AlertasPanel })));
const ClientCrearModal = lazyWithRetry(() => import('./components/features/ClientCrearModal').then(m => ({ default: m.ClientCrearModal })));
const UserProfileView = lazyWithRetry(() => import('./components/features/UserProfileView').then(m => ({ default: m.UserProfileView })));
const CrmTableroView = lazyWithRetry(() => import('./components/features/CrmTableroView').then(m => ({ default: m.CrmTableroView })));
const CapacitacionView = lazyWithRetry(() => import('./components/features/CapacitacionView').then(m => ({ default: m.CapacitacionView })));
const SystemHealthDashboard = lazyWithRetry(() => import('./components/features/SystemHealthDashboard').then(m => ({ default: m.SystemHealthDashboard })));
const SoporteAyudaDrawer = lazyWithRetry(() => import('./components/features/SoporteAyudaDrawer').then(m => ({ default: m.SoporteAyudaDrawer })));
const LeadsView = lazyWithRetry(() => import('./components/features/LeadsView').then(m => ({ default: m.LeadsView })));
const OportunidadesView = lazyWithRetry(() => import('./components/features/OportunidadesView').then(m => ({ default: m.OportunidadesView })));

// Vistas válidas de la app
const VALID_VIEWS = ['dashboard', 'clientes', 'tablero', 'alertas', 'perfil', 'capacitacion', 'configuracion', 'infraestructura', 'leads', 'oportunidades'];

function CRMApp() {
  const [user, setUser] = useState(null);

  // Interceptar ruta pública de formularios web-to-lead
  const path = window.location.pathname;
  if (path.startsWith('/form/')) {
    const formId = path.split('/form/')[1];
    return <PublicFormView formId={formId} />;
  }

  return (
    <UserRoleProvider user={user}>
      <CRMAppContent user={user} setUser={setUser} />
    </UserRoleProvider>
  );
}

function CRMAppContent({ user, setUser }) {
  const [activeView, setActiveView] = useState(() => {
    const saved = window.sessionStorage.getItem('app-active-view');
    return (saved && VALID_VIEWS.includes(saved)) ? saved : 'dashboard';
  });
  const [selectedClient, setSelectedClient] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showSupportDrawer, setShowSupportDrawer] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const { showAlert } = useToast();
  const { role, isAdmin, isSuperAdmin, isSupervisor, isLector, loading: roleLoading, canView, getDataScope, userTeam } = useUserRole();
  const [selectedCountry, setSelectedCountry] = useState('AR');
  const [activeCountries, setActiveCountries] = useState([
    { codigo: 'AR', nombre: 'Argentina', moneda: 'ARS', activo: true },
    { codigo: 'CL', nombre: 'Chile', moneda: 'CLP', activo: true },
    { codigo: 'PE', nombre: 'Perú', moneda: 'PEN', activo: true },
    { codigo: 'CO', nombre: 'Colombia', moneda: 'COP', activo: true },
    { codigo: 'MX', nombre: 'México', moneda: 'MXN', activo: true }
  ]);
  const [permitirTodos, setPermitirTodos] = useState(true);
  const [iaPausada, setIaPausada] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [activeSystemAlerts, setActiveSystemAlerts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Cargar configuración de países de operación
  useEffect(() => {
    const loadPaises = async () => {
      try {
        const pConf = await getConfigGeneral('paises');
        if (pConf && Array.isArray(pConf.paises)) {
          const activos = pConf.paises.filter(p => p.activo);
          if (activos.length > 0) {
            setActiveCountries(activos);
            setPermitirTodos(pConf.permitirTodos ?? true);
            setSelectedCountry(prev => {
              if (prev === '' && (pConf.permitirTodos ?? true)) return prev;
              if (activos.some(p => p.codigo === prev)) return prev;
              return pConf.paisPorDefecto || activos[0].codigo;
            });
          }
        }
      } catch (err) {
        console.warn('[App] Error cargando países de operación:', err);
      }
    };
    loadPaises();

    const handlePaisesUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail.paises)) {
        const activos = e.detail.paises.filter(p => p.activo);
        if (activos.length > 0) {
          setActiveCountries(activos);
          setPermitirTodos(e.detail.permitirTodos ?? true);
          setSelectedCountry(prev => {
            if (prev === '' && (e.detail.permitirTodos ?? true)) return prev;
            if (activos.some(p => p.codigo === prev)) return prev;
            return e.detail.paisPorDefecto || activos[0].codigo;
          });
        }
      }
    };
    window.addEventListener('paises-config-updated', handlePaisesUpdate);
    return () => window.removeEventListener('paises-config-updated', handlePaisesUpdate);
  }, []);
  
  // Apple Design System: Theme Mode (auto | light | dark)
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('apple_theme_mode') || 'auto';
  });

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      if (themeMode === 'auto') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', themeMode);
      }
    };
    applyTheme();
    localStorage.setItem('apple_theme_mode', themeMode);
  }, [themeMode]);

  // Disponibilidad & Presencia de Operador (CX / Comerciales / Supervisores)
  const [estadoCx, setEstadoCx] = useState('activo');
  const [estadoPresencia, setEstadoPresencia] = useState('Conectado');

  useEffect(() => {
    if (!user) {
      setAllUsers([]);
      return;
    }
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, email, nombre, rol, equipo, pais, activo, estado_presencia, estado_cx, presencia');
        if (data && !error) setAllUsers(data);
      } catch (err) {
        console.warn('[App] Error fetching users:', err);
      }
    };
    loadUsers();
  }, [user]);

  useEffect(() => {
    const userId = user?.id || user?.uid;
    if (!userId) return;
    const fetchUserPresence = async () => {
      try {
        const { data } = await supabase.from('usuarios').select('estado_cx, estado_presencia').eq('id', userId).maybeSingle();
        if (data) {
          setEstadoCx(data.estado_cx || 'activo');
          setEstadoPresencia(data.estado_presencia || 'Conectado');
        }
      } catch (err) {
        console.warn('[App] Error fetching presence:', err);
      }
    };
    fetchUserPresence();
  }, [user]);

  const handleUpdatePresencia = async (nuevoEstado) => {
    if (!user?.uid) return;
    const mapEstado = {
      activo: { presencia: 'Conectado', cx: 'activo', std: 'disponible' },
      disponible: { presencia: 'Conectado', cx: 'activo', std: 'disponible' },
      break: { presencia: 'En Break', cx: 'break', std: 'break' },
      lunch: { presencia: 'En Break', cx: 'break', std: 'break' },
      ocupado: { presencia: 'Ocupado', cx: 'ocupado', std: 'ocupado' },
      offline: { presencia: 'Desconectado', cx: 'offline', std: 'offline' }
    };
    const target = mapEstado[nuevoEstado] || mapEstado.disponible;
    const nowIso = new Date().toISOString();

    try {
      await supabase.from('usuarios').update({
        estado_presencia: target.presencia,
        estado_cx: target.cx,
        presencia: { estado: target.std, desdeIso: nowIso, desdeMs: Date.now() },
        updated_at: nowIso
      }).eq('id', user.uid || user.id);

      setEstadoCx(target.cx);
      setEstadoPresencia(target.presencia);
      showAlert(`Estado cambiado a "${target.presencia}"`, 'success');
    } catch (err) {
      console.error('Error al actualizar disponibilidad:', err);
      showAlert('Error al actualizar estado de presencia.', 'danger');
    }
  };

  // --- Estados para ocultar/cerrar FABs ---
  const [isManualDismissed, setIsManualDismissed] = useState(false);
  const [isSupportDismissed, setIsSupportDismissed] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      setIsManualDismissed(window.sessionStorage.getItem(`dismissed_fab_manual_${user.uid}`) === 'true');
      setIsSupportDismissed(window.sessionStorage.getItem(`dismissed_fab_support_${user.uid}`) === 'true');
    } else {
      setIsManualDismissed(false);
      setIsSupportDismissed(false);
    }
  }, [user]);

  const handleDismissManual = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.uid) {
      window.sessionStorage.setItem(`dismissed_fab_manual_${user.uid}`, 'true');
      setIsManualDismissed(true);
      showAlert('Botón de Manual ocultado hasta el próximo login.', 'info');
    }
  };

  const handleDismissSupport = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.uid) {
      window.sessionStorage.setItem(`dismissed_fab_support_${user.uid}`, 'true');
      setIsSupportDismissed(true);
      showAlert('Botón de Soporte IA ocultado hasta el próximo login.', 'info');
    }
  };
  const [dismissedAlertsMap, setDismissedAlertsMap] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissed_system_alerts_map');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Alertas de sistema desde config_general
  useEffect(() => {
    if (!user) return;
    const loadSystemAlerts = async () => {
      try {
        const conf = await getConfigGeneral('alertas_sistema');
        if (conf && Array.isArray(conf.lista)) {
          setActiveSystemAlerts(conf.lista.filter(a => a.activa));
        }
      } catch (err) {
        console.warn("Error al cargar alertas del sistema:", err);
      }
    };
    loadSystemAlerts();
  }, [user]);

  const handleDismissAlert = (id, timestampVal) => {
    const updated = {
      ...dismissedAlertsMap,
      [id]: timestampVal
    };
    setDismissedAlertsMap(updated);
    localStorage.setItem('dismissed_system_alerts_map', JSON.stringify(updated));
  };

  // --- Hook Modular para Logout Automático por Inactividad (P2-9) ---
  const {
    showInactivityWarning,
    warningCountdown,
    handleResetInactivity,
    handleInactivityLogout
  } = useInactivityTimer(user, setUser, showAlert);

  // --- Estados y lógica para Botones Flotantes Arrastrables (Draggable) ---
  const dragThreshold = 5;

  const [manualPos, setManualPos] = useState({ x: 0, y: 0 });
  const manualDragStart = useRef({ x: 0, y: 0, px: 0, py: 0, moved: false, currentX: 0, currentY: 0 });

  const [supportPos, setSupportPos] = useState({ x: 0, y: 0 });
  const supportDragStart = useRef({ x: 0, y: 0, px: 0, py: 0, moved: false, currentX: 0, currentY: 0 });

  const handlePointerDown = (e, startRef, pos) => {
    startRef.current = {
      x: pos.x,
      y: pos.y,
      px: e.clientX,
      py: e.clientY,
      currentX: pos.x,
      currentY: pos.y,
      moved: false
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e, startRef, setPos) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;

    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      startRef.current.moved = true;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    let newX = startRef.current.x + dx;
    let newY = startRef.current.y + dy;

    const initialLeft = rect.left - startRef.current.currentX;
    const initialTop = rect.top - startRef.current.currentY;

    const absoluteLeft = initialLeft + newX;
    const absoluteTop = initialTop + newY;

    const minLeft = 10;
    const maxLeft = window.innerWidth - width - 10;
    const minTop = 10;
    const maxTop = window.innerHeight - height - 10;

    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, absoluteLeft));
    const clampedTop = Math.max(minTop, Math.min(maxTop, absoluteTop));

    newX = clampedLeft - initialLeft;
    newY = clampedTop - initialTop;

    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e, startRef) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleButtonClick = (e, startRef, action) => {
    if (startRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    action();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user && roleLoading) {
        setAuthTimeout(true);
        showAlert("El servicio de sesión está tardando más de lo esperado. Intenta recargar.", "warning");
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [user, roleLoading, showAlert]);

  const navigateTo = (view) => {
    window.sessionStorage.setItem('app-active-view', view);
    setActiveView(view);
    setSidebarOpen(false);
  };

  useEffect(() => {
    const restoreView = window.sessionStorage.getItem('app-restore-view');
    if (restoreView && VALID_VIEWS.includes(restoreView)) {
      setActiveView(restoreView);
      window.sessionStorage.setItem('app-active-view', restoreView);
    }
    window.sessionStorage.removeItem('app-restore-view');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ ...session.user, uid: session.user.id });
      } else {
        setUser(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const u = { ...session.user, uid: session.user.id };
        setUser(u);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [showAlert, setUser]);

  const lastUpdateRef = useRef(0);

  const updateActivity = useCallback(async () => {
    if (!user?.uid) return;
    const now = Date.now();
    if (now - lastUpdateRef.current > 3 * 60 * 1000) {
      lastUpdateRef.current = now;
      try {
        const nowIso = new Date().toISOString();
        const hoy = nowIso.split('T')[0];
        const userId = user.uid || user.id;

        await supabase.from('usuarios').update({
          updated_at: nowIso,
          estado_presencia: 'Conectado'
        }).eq('id', userId);

        // Incrementar o registrar bloque de 3 minutos en usuario_uso_diario
        const { data: currentUso } = await supabase
          .from('usuario_uso_diario')
          .select('minutos_conectado')
          .eq('user_id', userId)
          .eq('fecha', hoy)
          .maybeSingle();

        const currentMin = currentUso?.minutos_conectado || 0;
        await supabase.from('usuario_uso_diario').upsert({
          user_id: userId,
          fecha: hoy,
          minutos_conectado: currentMin + 3,
          last_active_at: nowIso
        }, { onConflict: 'user_id,fecha' });
      } catch (err) {
        console.error('Error updating activity heartbeat:', err);
      }
    }
  }, [user]);

  // Listener para interacciones físicas
  useEffect(() => {
    if (!user) return;
    updateActivity();
    const handleActivity = () => {
      updateActivity();
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [user, updateActivity]);

  useEffect(() => {
    if (!user || roleLoading) return;
    const alertasScope = getDataScope('alertas');
    if (alertasScope === 'NONE') {
      setAlertCount(0);
      return;
    }

    const loadAlertCount = async () => {
      try {
        const { count, error } = await supabase
          .from('alertas')
          .select('id', { count: 'exact', head: true })
          .eq('leida', false);

        if (!error && count !== null) {
          setAlertCount(count);
        }
      } catch (err) {
        console.warn("Error fetching alert count:", err);
      }
    };
    loadAlertCount();
  }, [user, roleLoading, getDataScope]);

  const handleNavigateToClient = async (clienteId) => {
    try {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle();
      if (data && !error) {
        setSelectedClient({
          id: data.id,
          nombreEmpresa: data.nombre_empresa,
          pais: data.pais,
          estado: data.estado,
          healthScore: data.health_score,
          contactoPrincipal: data.contacto_principal || {}
        });
        navigateTo('clientes');
      } else {
        showAlert('El cliente asociado ya no existe en el sistema.', 'warning');
      }
    } catch (err) {
      console.error('Error opening client from detail modal:', err);
      showAlert('Error abriendo cliente asociado.', 'danger');
    }
  };

  if (!user) {
    return <LoginView onLoginSuccess={(u) => setUser(u)} />;
  }

  const handleLogout = async () => {
    if (user?.uid || user?.id) {
      const uId = user.uid || user.id;
      window.sessionStorage.removeItem(`dismissed_fab_manual_${uId}`);
      window.sessionStorage.removeItem(`dismissed_fab_support_${uId}`);
    }
    try {
      if (user?.id) {
        await supabase.from('usuarios').update({ estado_presencia: 'Desconectado', updated_at: new Date().toISOString() }).eq('id', user.id);
      }
    } catch (_e) {
      // Silencioso en cierre de sesión
    }
    await supabase.auth.signOut();
    setUser(null);
    showAlert('Sesión cerrada con éxito.', 'info');
  };

  return (
    <div className="app-layout">
      <style>{`
        :root {
          --alerts-height: ${activeSystemAlerts.filter(alert => {
            const ts = alert.actualizadoEn?.toMillis ? alert.actualizadoEn.toMillis() : (alert.creadoEn?.toMillis ? alert.creadoEn.toMillis() : 1);
            return dismissedAlertsMap[alert.id] !== ts;
          }).length * 38}px;
        }
        .sidebar {
          top: var(--alerts-height) !important;
        }
        .main-content {
          margin-top: var(--alerts-height) !important;
        }
        .mobile-header {
          top: var(--alerts-height) !important;
        }
        @keyframes pulseDangerBanner {
          0% { background-color: #dc3545; }
          50% { background-color: #901c27; }
          100% { background-color: #dc3545; }
        }
        .hover-opacity-100:hover {
          opacity: 1 !important;
        }
      `}</style>
      {/* Apple Dynamic Island Floating Alert */}
      {activeSystemAlerts.filter(alert => {
        const ts = alert.actualizadoEn?.toMillis ? alert.actualizadoEn.toMillis() : (alert.creadoEn?.toMillis ? alert.creadoEn.toMillis() : 1);
        return dismissedAlertsMap[alert.id] !== ts;
      }).map((alert) => {
        const isCritica = alert.critica;
        const alertTimestamp = alert.actualizadoEn?.toMillis ? alert.actualizadoEn.toMillis() : (alert.creadoEn?.toMillis ? alert.creadoEn.toMillis() : 1);
        return (
          <div 
            key={alert.id}
            className="position-fixed top-0 start-50 translate-middle-x mt-3 px-4 py-2 text-white apple-glass"
            style={{
              zIndex: 9999,
              borderRadius: 'var(--apple-radius-pill)',
              backgroundColor: isCritica ? 'rgba(255, 59, 48, 0.92)' : (alert.tipo === 'warning' ? 'rgba(255, 149, 0, 0.92)' : 'rgba(0, 113, 227, 0.92)'),
              boxShadow: 'var(--apple-shadow-floating)',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '90vw'
            }}
          >
            <i className={`bi ${alert.tipo === 'danger' ? 'bi-exclamation-triangle-fill' : (alert.tipo === 'warning' ? 'bi-exclamation-circle-fill' : 'bi-info-circle-fill')} fs-6`}></i>
            <span className="fw-semibold">{isCritica ? 'CRÍTICO: ' : ''}{alert.mensaje}</span>
            <button 
              className="btn btn-link p-0 border-0 text-white opacity-75 hover-opacity-100 ms-2"
              onClick={() => handleDismissAlert(alert.id, alertTimestamp)}
              title="Cerrar anuncio"
            >
              <i className="bi bi-x-circle-fill fs-6"></i>
            </button>
          </div>
        );
      })}
      <NetworkBanner />

      {/* Mobile Slide-in Menu Sheet & Overlay */}
      <MobileNavSheet
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeView={activeView}
        navigateTo={navigateTo}
        canView={canView}
        alertCount={alertCount}
        handleLogout={handleLogout}
      />

      {/* Apple Command SuperBar (Floating Top Header) */}
      <TopSuperBar
        activeView={activeView}
        navigateTo={navigateTo}
        canView={canView}
        alertCount={alertCount}
        activeCountries={activeCountries}
        selectedCountry={selectedCountry}
        setSelectedCountry={setSelectedCountry}
        permitirTodos={permitirTodos}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        setShowSupportDrawer={setShowSupportDrawer}
        user={user}
        role={role}
        estadoCx={estadoCx}
        handleUpdatePresencia={handleUpdatePresencia}
        setShowManualModal={setShowManualModal}
        handleLogout={handleLogout}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Content Area */}
      <main className="main-content">


        {iaPausada && (
          <div className="alert alert-warning d-flex align-items-center shadow-sm py-2 mb-4" role="alert">
            <i className="bi bi-robot me-3 fs-4"></i>
            <div>
              <h6 className="fw-bold mb-0">LUXIA IA Pausado Temporalmente</h6>
              <span className="small">El análisis inteligente (Copiloto, Health Score, Resúmenes) está deshabilitado por límite de presupuesto. Ciertas funciones operarán en modo manual.</span>
            </div>
          </div>
        )}

        {activeView === 'dashboard' && (
          <ErrorBoundary key="dashboard">
            <DashboardKPIs selectedCountry={selectedCountry} user={user} />
          </ErrorBoundary>
        )}
        
        {activeView === 'alertas' && (
          <div className="w-100 animate__animated animate__fadeIn">
            <ErrorBoundary key="alertas">
              <Suspense fallback={<SpinnerPremium size="md" text="Cargando panel de alertas..." />}>
                <AlertasPanel onNavigateToClient={handleNavigateToClient} />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
        
        {activeView === 'clientes' && (
          <div className="w-100 animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div>
                <h2 className="mb-1 fw-bold" style={{ color: 'var(--apple-text-primary)', letterSpacing: '-0.03em' }}>
                  <i className="bi bi-people-fill text-primary me-2"></i>Gestión de Clientes
                </h2>
                <p className="mb-0 small" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.85rem' }}>
                  Seguimiento del ciclo de vida, salud de cartera y contratos.
                </p>
              </div>
              <button 
                className="btn btn-primary rounded-pill px-4 shadow-sm"
                onClick={() => setShowCrearModal(true)}
                disabled={isLector}
                title={isLector ? "Permiso denegado (Rol Lector)" : ""}
              >
                <i className="bi bi-person-plus-fill me-2"></i> Registrar Cliente Local
              </button>
            </div>
            <ErrorBoundary key="clientes">
              <Suspense fallback={<SpinnerPremium size="md" text="Cargando clientes..." />}>
                <ClientesTable 
                  key={`${refreshTrigger}_${selectedCountry}`}
                  selectedCountry={selectedCountry}
                  onGestionarClick={(cliente) => setSelectedClient(cliente)} 
                  iaPausada={iaPausada}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
         )}
        
        {activeView === 'tablero' && (
          <div className="w-100 animate__animated animate__fadeIn">
            <ErrorBoundary key="tablero">
              <Suspense fallback={<SpinnerPremium size="md" text="Cargando tablero CRM..." />}>
                <CrmTableroView selectedCountry={selectedCountry} />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {activeView === 'leads' && (
          <div className="w-100 animate__animated animate__fadeIn">
            <ErrorBoundary key="leads">
              <Suspense fallback={<SpinnerPremium size="md" text="Cargando prospección (leads)..." />}>
                {canView('leads') ? (
                  <LeadsView selectedCountry={selectedCountry} user={user} />
                ) : (
                  <div className="p-4 text-center text-muted">No tienes permisos para acceder a la sección de Prospección.</div>
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {activeView === 'oportunidades' && (
          <div className="w-100 animate__animated animate__fadeIn">
            <ErrorBoundary key="oportunidades">
              <Suspense fallback={<SpinnerPremium size="md" text="Cargando pipeline de ventas..." />}>
                {canView('oportunidades') ? (
                  <OportunidadesView selectedCountry={selectedCountry} user={user} />
                ) : (
                  <div className="p-4 text-center text-muted">No tienes permisos para acceder a la sección del Pipeline de Ventas.</div>
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {activeView === 'configuracion' && canView('configuracion') && (
          <ErrorBoundary key="configuracion">
            <Suspense fallback={<SpinnerPremium size="md" text="Cargando consola de configuración..." />}>
              <AdminConfigView user={user} selectedCountry={selectedCountry} />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeView === 'perfil' && (
          <div className="w-100 animate__animated animate__fadeIn">
            <ErrorBoundary key="perfil">
              <Suspense fallback={<SpinnerPremium size="md" text="Cargando perfil del ejecutivo..." />}>
                <UserProfileView 
                  user={user} 
                  isManualDismissed={isManualDismissed}
                  setIsManualDismissed={setIsManualDismissed}
                  isSupportDismissed={isSupportDismissed}
                  setIsSupportDismissed={setIsSupportDismissed}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {activeView === 'capacitacion' && (
          <ErrorBoundary key="capacitacion">
            <Suspense fallback={<SpinnerPremium size="md" text="Cargando centro de capacitación..." />}>
              <CapacitacionView user={user} />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeView === 'infraestructura' && canView('infraestructura') && (
          <ErrorBoundary key="infraestructura">
            <Suspense fallback={<SpinnerPremium size="md" text="Cargando centro de comando IT..." />}>
              <SystemHealthDashboard user={user} />
            </Suspense>
          </ErrorBoundary>
        )}

        <Suspense fallback={null}>
          <ClientGestionModal 
            key={selectedClient?.id || 'empty'}
            show={!!selectedClient}
            clientData={selectedClient}
            onClose={() => setSelectedClient(null)}
            onSaved={() => setRefreshTrigger(prev => prev + 1)}
            iaPausada={iaPausada}
          />
        </Suspense>

        <Suspense fallback={null}>
          <ClientCrearModal
            show={showCrearModal}
            onClose={() => setShowCrearModal(false)}
            onCreated={() => setRefreshTrigger(prev => prev + 1)}
          />
        </Suspense>

        <Suspense fallback={null}>
          <ManualOperacionesModal
            show={showManualModal}
            user={user}
            onClose={() => setShowManualModal(false)}
          />
        </Suspense>

        <Suspense fallback={null}>
          <SoporteAyudaDrawer
            show={showSupportDrawer}
            onClose={() => setShowSupportDrawer(false)}
          />
        </Suspense>

        {/* Warning Modal for Inactivity Logout */}
        {showInactivityWarning && (
          <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', zIndex: 1060 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow rounded-4 p-4 text-center" style={{ backgroundColor: 'var(--bg-main, #ffffff)' }}>
                <div className="rounded-circle bg-warning bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3 mx-auto" style={{ width: '64px', height: '64px' }}>
                  <i className="bi bi-exclamation-triangle-fill text-warning fs-2"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">¿Sigues ahí?</h4>
                <p className="text-muted small">
                  Tu sesión está a punto de expirar por inactividad debido a políticas de seguridad.
                </p>
                <h2 className="fw-bold text-danger my-3">{warningCountdown}s</h2>
                <div className="d-grid gap-2 mt-4">
                  <button onClick={handleResetInactivity} className="btn btn-primary rounded-pill py-2 fw-bold shadow-sm">
                    Continuar Sesión
                  </button>
                  <button onClick={handleInactivityLogout} className="btn btn-outline-secondary rounded-pill py-2 border-0">
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Google Meet countdown warning widget */}
        <MeetCountdownWidget />
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <CRMApp />
      </ErrorBoundary>
    </ToastProvider>
  );
}

export default App;
