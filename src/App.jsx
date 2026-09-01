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
  const [openDropdown, setOpenDropdown] = useState(null);
  const superbarRef = useRef(null);
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
  
  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (superbarRef.current && !superbarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        const { data, error } = await supabase.from('usuarios').select('*');
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

  // --- Estados y Refs para Logout Automático (Inactividad) ---
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(30);
  const [securityConfig, setSecurityConfig] = useState({ habilitado: false, timeoutMinutos: 15 });
  const inactivityTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    if (!user || !securityConfig.habilitado) return;

    const timeoutMs = (securityConfig.timeoutMinutos * 60 * 1000) - (30 * 1000);
    
    inactivityTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
      setWarningCountdown(30);
      
      let secondsLeft = 30;
      countdownIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        setWarningCountdown(secondsLeft);
        if (secondsLeft <= 0) {
          clearInterval(countdownIntervalRef.current);
          if (user?.uid) {
            window.sessionStorage.removeItem(`dismissed_fab_manual_${user.uid}`);
            window.sessionStorage.removeItem(`dismissed_fab_support_${user.uid}`);
          }
          supabase.auth.signOut().then(() => {
            setUser(null);
            showAlert('Tu sesión ha expirado por inactividad por motivos de seguridad.', 'warning');
          });
          setShowInactivityWarning(false);
        }
      }, 1000);
    }, Math.max(0, timeoutMs));
  }, [user, securityConfig, showAlert, setUser]);

  const handleResetInactivity = () => {
    setShowInactivityWarning(false);
    setWarningCountdown(30);
    resetTimer();
  };

  const handleInactivityLogout = async () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setShowInactivityWarning(false);
    if (user?.uid || user?.id) {
      const uId = user.uid || user.id;
      window.sessionStorage.removeItem(`dismissed_fab_manual_${uId}`);
      window.sessionStorage.removeItem(`dismissed_fab_support_${uId}`);
    }
    await supabase.auth.signOut();
    setUser(null);
    showAlert('Sesión cerrada correctamente.', 'success');
  };

  useEffect(() => {
    if (!user) {
      setSecurityConfig({ habilitado: false, timeoutMinutos: 15 });
      setShowInactivityWarning(false);
      return;
    }

    const loadSecurityConfig = async () => {
      try {
        const conf = await getConfigGeneral('security_config');
        if (conf) {
          setSecurityConfig(conf);
        } else {
          setSecurityConfig({ habilitado: true, timeoutMinutos: 30 });
        }
      } catch (err) {
        setSecurityConfig({ habilitado: true, timeoutMinutos: 30 });
      }
    };
    loadSecurityConfig();
  }, [user]);

  useEffect(() => {
    if (!user || !securityConfig.habilitado) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    resetTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      setShowInactivityWarning(prev => {
        if (!prev) {
          resetTimer();
        }
        return prev;
      });
    };

    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, securityConfig, resetTimer]);

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
    setOpenDropdown(null);
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
        await supabase.from('usuarios').update({
          updated_at: new Date().toISOString(),
          estado_presencia: 'Conectado'
        }).eq('id', user.uid || user.id);
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

  const [loginEmail, setLoginEmail] = useState('admin@luxia.com');
  const [loginPassword, setLoginPassword] = useState('luxia2026');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    try {
      const email = loginEmail.trim().toLowerCase();
      const password = loginPassword.trim();

      // 1. Intentar inicio de sesión
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Si el usuario no existe aún en Supabase Auth, registrarlo automáticamente
        if (error.message.includes('Invalid login credentials') || error.message.includes('User not found')) {
          const roleFromEmail = email.includes('admin') ? 'superadmin' : (email.includes('supervisor') ? 'supervisor' : 'agente');
          const nameFromEmail = email.split('@')[0];

          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                rol: roleFromEmail,
                nombre: nameFromEmail,
                equipo: 'Global',
                pais: 'PE'
              }
            }
          });

          if (signUpErr) throw signUpErr;

          if (signUpData?.user) {
            // Asegurar creación en la tabla public.usuarios
            await supabase.from('usuarios').upsert({
              id: signUpData.user.id,
              email,
              nombre: nameFromEmail,
              rol: roleFromEmail,
              equipo: 'Global',
              pais: 'PE',
              activo: true
            }, { onConflict: 'id' });

            setUser({ ...signUpData.user, uid: signUpData.user.id });
            showAlert(`Bienvenido ${email}. Cuenta creada y conectada como ${roleFromEmail}.`, 'success');
            return;
          }
        }
        throw error;
      }

      if (data?.user) {
        setUser({ ...data.user, uid: data.user.id });
        showAlert(`Bienvenido ${data.user.email}`, 'success');
      }
    } catch (err) {
      console.error('[Login Error]', err);
      showAlert(err.message || 'Error al iniciar sesión.', 'danger');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleOAuthLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      showAlert(err.message || 'Error iniciando sesión con Google.', 'danger');
    }
  };

  if (!user) {
    return (
      <div className="container mt-5">
        <div className="text-center mt-4 card-premium mx-auto shadow-lg p-4 p-md-5 rounded-4" style={{maxWidth: '480px'}}>
          <div className="mb-3 d-flex justify-content-center">
            <LuxiaLogo height={42} showSubtitle={true} subtitle="ENTERPRISE CRM" />
          </div>
          <p className="small mb-4" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.82rem', lineHeight: '1.4' }}>
            Innovación y sustentabilidad al servicio de tus cultivos · Plataforma de Gestión B2B
          </p>

          <form onSubmit={handleLogin} className="text-start">
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted">Correo Corporativo</label>
              <div className="input-group">
                <span className="input-group-text bg-transparent border-end-0"><i className="bi bi-envelope"></i></span>
                <input 
                  type="email" 
                  className="form-control border-start-0" 
                  placeholder="admin@luxia.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label small fw-bold text-muted">Contraseña</label>
              <div className="input-group">
                <span className="input-group-text bg-transparent border-end-0"><i className="bi bi-key"></i></span>
                <input 
                  type="password" 
                  className="form-control border-start-0" 
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-100 py-2 fw-bold shadow-sm rounded-3 mb-3" disabled={loginLoading}>
              {loginLoading ? (
                <span><span className="spinner-border spinner-border-sm me-2"></span>Iniciando sesión...</span>
              ) : (
                <span><i className="bi bi-box-arrow-in-right me-2"></i> Ingresar al Sistema</span>
              )}
            </button>

            <button type="button" className="btn btn-outline-secondary w-100 py-2 rounded-3 mb-4" onClick={handleGoogleOAuthLogin}>
              <i className="bi bi-google me-2"></i> Continuar con Google
            </button>
          </form>

          <div className="border-top pt-3 text-start">
            <span className="small text-muted fw-bold d-block mb-2"><i className="bi bi-person-badge me-1"></i> Accesos Rápidos de Prueba:</span>
            <div className="d-flex gap-2 flex-wrap">
              <button 
                type="button"
                className="btn btn-sm btn-outline-primary rounded-pill px-3"
                onClick={() => { setLoginEmail('admin@luxia.com'); setLoginPassword('luxia2026'); }}
              >
                👑 SuperAdmin
              </button>
              <button 
                type="button"
                className="btn btn-sm btn-outline-success rounded-pill px-3"
                onClick={() => { setLoginEmail('supervisor@luxia.com'); setLoginPassword('luxia2026'); }}
              >
                👔 Supervisor
              </button>
              <button 
                type="button"
                className="btn btn-sm btn-outline-info rounded-pill px-3"
                onClick={() => { setLoginEmail('agente@luxia.com'); setLoginPassword('luxia2026'); }}
              >
                💼 Agente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
      <div 
        className={`mobile-sheet-overlay ${sidebarOpen ? 'show' : ''}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>

      <aside className={`mobile-nav-sheet ${sidebarOpen ? 'open' : ''}`}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => { navigateTo('dashboard'); setSidebarOpen(false); }}>
            <LuxiaLogo height={24} showSubtitle={true} subtitle="CRM" />
          </div>
          <button className="btn btn-link text-muted p-0 border-0" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
            <i className="bi bi-x-lg fs-5"></i>
          </button>
        </div>

        <div className="d-flex flex-column gap-1 overflow-y-auto flex-grow-1">
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigateTo('dashboard')}
          >
            <i className="bi bi-grid-1x2-fill me-2" style={{ color: 'var(--apple-blue)' }}></i>
            <span>Inteligencia</span>
          </button>

          {(canView('leads') || canView('oportunidades')) && (
            <div className="text-uppercase text-muted fw-bold mt-3 mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.06em' }}>Comercial</div>
          )}
          {canView('leads') && (
            <button 
              type="button" 
              className={`apple-dropdown-item py-2 ${activeView === 'leads' ? 'active' : ''}`}
              onClick={() => navigateTo('leads')}
            >
              <i className="bi bi-person-plus-fill me-2" style={{ color: 'var(--apple-green)' }}></i>
              <span>Prospección (Leads)</span>
            </button>
          )}
          {canView('oportunidades') && (
            <button 
              type="button" 
              className={`apple-dropdown-item py-2 ${activeView === 'oportunidades' ? 'active' : ''}`}
              onClick={() => navigateTo('oportunidades')}
            >
              <i className="bi bi-bar-chart-steps me-2" style={{ color: 'var(--apple-teal)' }}></i>
              <span>Pipeline de Ventas</span>
            </button>
          )}

          <div className="text-uppercase text-muted fw-bold mt-3 mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.06em' }}>Operaciones</div>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'clientes' ? 'active' : ''}`}
            onClick={() => navigateTo('clientes')}
          >
            <i className="bi bi-people-fill me-2" style={{ color: 'var(--apple-indigo)' }}></i>
            <span>Gestión de Clientes</span>
          </button>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'tablero' ? 'active' : ''}`}
            onClick={() => navigateTo('tablero')}
          >
            <i className="bi bi-kanban-fill me-2" style={{ color: 'var(--apple-purple)' }}></i>
            <span>Tablero CRM</span>
          </button>



          <div className="text-uppercase text-muted fw-bold mt-3 mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.06em' }}>Sistema</div>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'alertas' ? 'active' : ''}`}
            onClick={() => navigateTo('alertas')}
          >
            <i className="bi bi-bell-fill me-2" style={{ color: 'var(--apple-red)' }}></i>
            <span>Alertas de Riesgo</span>
            {alertCount > 0 && <span className="badge rounded-pill bg-danger ms-auto">{alertCount}</span>}
          </button>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'perfil' ? 'active' : ''}`}
            onClick={() => navigateTo('perfil')}
          >
            <i className="bi bi-person-circle me-2" style={{ color: 'var(--apple-text-secondary)' }}></i>
            <span>Mi Perfil</span>
          </button>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'capacitacion' ? 'active' : ''}`}
            onClick={() => navigateTo('capacitacion')}
          >
            <i className="bi bi-mortarboard-fill me-2" style={{ color: 'var(--apple-purple)' }}></i>
            <span>Auto Capacitación</span>
          </button>
          {canView('configuracion') && (
            <button 
              type="button" 
              className={`apple-dropdown-item py-2 ${activeView === 'configuracion' ? 'active' : ''}`}
              onClick={() => navigateTo('configuracion')}
            >
              <i className="bi bi-gear-fill me-2" style={{ color: 'var(--apple-text-secondary)' }}></i>
              <span>Configuración</span>
            </button>
          )}
          {canView('infraestructura') && (
            <button 
              type="button" 
              className={`apple-dropdown-item py-2 ${activeView === 'infraestructura' ? 'active' : ''}`}
              onClick={() => navigateTo('infraestructura')}
            >
              <i className="bi bi-server me-2" style={{ color: 'var(--apple-red)' }}></i>
              <span>Observabilidad</span>
            </button>
          )}
        </div>

        <div className="border-top pt-3 mt-auto">
          <button 
            className="apple-btn apple-btn-danger w-100 py-1.5" 
            style={{ fontSize: '0.8rem' }}
            onClick={async () => {
              if (user?.uid || user?.id) {
                const uId = user.uid || user.id;
                window.sessionStorage.removeItem(`dismissed_fab_manual_${uId}`);
                window.sessionStorage.removeItem(`dismissed_fab_support_${uId}`);
              }
              try {
                if (user?.id) {
                  await supabase.from('usuarios').update({ estado_presencia: 'Desconectado', updated_at: new Date().toISOString() }).eq('id', user.id);
                }
              } catch (e) {}
              await supabase.auth.signOut();
              setUser(null);
              showAlert('Sesión cerrada con éxito.', 'info');
            }}
          >
            <i className="bi bi-box-arrow-right"></i>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Apple Command SuperBar (Floating Top Header) */}
      <header className="apple-superbar" ref={superbarRef}>
        {/* Brand & Identity */}
        <div className="apple-superbar-brand cursor-pointer" onClick={() => navigateTo('dashboard')} title="Ir a Inteligencia / Dashboard">
          <LuxiaLogo height={26} showSubtitle={true} subtitle="CRM" />
        </div>

        {/* Central Navigation Pills (Desktop) */}
        <nav className="apple-superbar-nav d-none d-lg-flex">
          {/* Inteligencia */}
          <button
            type="button"
            className={`apple-nav-item ${activeView === 'dashboard' ? 'active-primary' : ''}`}
            onClick={() => navigateTo('dashboard')}
          >
            <i className="bi bi-grid-1x2-fill"></i>
            <span>Inteligencia</span>
          </button>

          {/* Comercial (Leads & Pipeline) */}
          {(canView('leads') || canView('oportunidades')) && (
            <div className="position-relative">
              <button
                type="button"
                className={`apple-nav-item ${['leads', 'oportunidades'].includes(activeView) ? 'active' : ''}`}
                onClick={() => setOpenDropdown(openDropdown === 'comercial' ? null : 'comercial')}
              >
                <i className="bi bi-briefcase-fill" style={{ color: 'var(--apple-green)' }}></i>
                <span>Comercial</span>
                <i className={`bi bi-chevron-${openDropdown === 'comercial' ? 'up' : 'down'} ms-1`} style={{ fontSize: '0.65rem' }}></i>
              </button>
              {openDropdown === 'comercial' && (
                <div className="apple-nav-dropdown-menu">
                  {canView('leads') && (
                    <button
                      type="button"
                      className={`apple-dropdown-item ${activeView === 'leads' ? 'active' : ''}`}
                      onClick={() => navigateTo('leads')}
                    >
                      <i className="bi bi-person-plus-fill" style={{ color: 'var(--apple-green)' }}></i>
                      <div>
                        <div>Prospección (Leads)</div>
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>Entrada y scoring territorial</span>
                      </div>
                    </button>
                  )}
                  {canView('oportunidades') && (
                    <button
                      type="button"
                      className={`apple-dropdown-item ${activeView === 'oportunidades' ? 'active' : ''}`}
                      onClick={() => navigateTo('oportunidades')}
                    >
                      <i className="bi bi-bar-chart-steps" style={{ color: 'var(--apple-teal)' }}></i>
                      <div>
                        <div>Pipeline de Ventas</div>
                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>Oportunidades y contratos</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Operaciones (Clientes & Tablero CLM) */}
          <div className="position-relative">
            <button
              type="button"
              className={`apple-nav-item ${['clientes', 'tablero'].includes(activeView) ? 'active' : ''}`}
              onClick={() => setOpenDropdown(openDropdown === 'operaciones' ? null : 'operaciones')}
            >
              <i className="bi bi-layers-fill" style={{ color: 'var(--apple-indigo)' }}></i>
              <span>Operaciones</span>
              <i className={`bi bi-chevron-${openDropdown === 'operaciones' ? 'up' : 'down'} ms-1`} style={{ fontSize: '0.65rem' }}></i>
            </button>
            {openDropdown === 'operaciones' && (
              <div className="apple-nav-dropdown-menu">
                <button
                  type="button"
                  className={`apple-dropdown-item ${activeView === 'clientes' ? 'active' : ''}`}
                  onClick={() => navigateTo('clientes')}
                >
                  <i className="bi bi-people-fill" style={{ color: 'var(--apple-indigo)' }}></i>
                  <div>
                    <div>Gestión de Clientes</div>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>Ficha 360°, SLA y contratos</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`apple-dropdown-item ${activeView === 'tablero' ? 'active' : ''}`}
                  onClick={() => navigateTo('tablero')}
                >
                  <i className="bi bi-kanban-fill" style={{ color: 'var(--apple-purple)' }}></i>
                  <div>
                    <div>Tablero CRM</div>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>Kanban de cuentas y onboarding</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Alertas */}
          <button
            type="button"
            className={`apple-nav-item ${activeView === 'alertas' ? 'active' : ''}`}
            onClick={() => navigateTo('alertas')}
          >
            <i className="bi bi-bell-fill" style={{ color: 'var(--apple-red)' }}></i>
            <span>Alertas</span>
            {alertCount > 0 && (
              <span className="badge rounded-pill bg-danger ms-1" style={{ fontSize: '0.65rem' }}>{alertCount}</span>
            )}
          </button>
        </nav>

        {/* Right Actions Cluster */}
        <div className="apple-superbar-actions">
          {/* Country Selector */}
          {activeCountries.length > 1 && (
            <div className="apple-segmented-control d-none d-sm-inline-flex">
              {permitirTodos && (
                <button
                  type="button"
                  className={`apple-segmented-item ${selectedCountry === '' ? 'active' : ''}`}
                  onClick={() => setSelectedCountry('')}
                  style={{ padding: '3px 7px', fontSize: '0.74rem' }}
                  title="Ver todos los países"
                >
                  <span className="fw-bold">🌍 Todos</span>
                </button>
              )}
              {activeCountries.map(c => (
                <button
                  key={c.codigo}
                  type="button"
                  className={`apple-segmented-item ${selectedCountry === c.codigo ? 'active' : ''}`}
                  onClick={() => setSelectedCountry(c.codigo)}
                  style={{ padding: '3px 7px', fontSize: '0.74rem' }}
                  title={`${c.nombre} (${c.moneda})`}
                >
                  <span className="fw-bold">{c.codigo}</span>
                </button>
              ))}
            </div>
          )}

          {/* Theme Mode Switcher */}
          <div className="apple-segmented-control d-none d-sm-inline-flex">
            <button
              type="button"
              className={`apple-segmented-item ${themeMode === 'auto' ? 'active' : ''}`}
              onClick={() => setThemeMode('auto')}
              title="Tema Automático"
              style={{ padding: '3px 7px', fontSize: '0.74rem' }}
            >
              <i className="bi bi-circle-half"></i>
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${themeMode === 'light' ? 'active' : ''}`}
              onClick={() => setThemeMode('light')}
              title="Modo Claro"
              style={{ padding: '3px 7px', fontSize: '0.74rem' }}
            >
              <i className="bi bi-sun-fill" style={{ color: themeMode === 'light' ? 'var(--apple-orange)' : 'inherit' }}></i>
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${themeMode === 'dark' ? 'active' : ''}`}
              onClick={() => setThemeMode('dark')}
              title="Modo Oscuro"
              style={{ padding: '3px 7px', fontSize: '0.74rem' }}
            >
              <i className="bi bi-moon-stars-fill" style={{ color: themeMode === 'dark' ? 'var(--apple-blue)' : 'inherit' }}></i>
            </button>
          </div>

          {/* Soporte IA Button (1-Click Action) */}
          <button
            type="button"
            className="apple-card p-1.5 px-3 d-none d-md-flex align-items-center gap-1.5 border cursor-pointer text-decoration-none"
            style={{ borderRadius: 'var(--apple-radius-pill)', background: 'var(--apple-surface-elevated)', fontSize: '0.78rem' }}
            onClick={() => setShowSupportDrawer(true)}
            title="Asistente de Soporte IA"
          >
            <i className="bi bi-stars" style={{ color: 'var(--apple-purple)' }}></i>
            <span className="fw-semibold" style={{ color: 'var(--apple-text-secondary)' }}>Soporte IA</span>
          </button>

          {/* User Profile & Presence Menu */}
          <div className="position-relative">
            <button
              type="button"
              className="apple-card p-1.5 d-flex align-items-center gap-2 border cursor-pointer"
              style={{ borderRadius: 'var(--apple-radius-pill)', background: 'var(--apple-surface-elevated)' }}
              onClick={() => setOpenDropdown(openDropdown === 'userMenu' ? null : 'userMenu')}
            >
              <div 
                className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" 
                style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, var(--apple-blue), var(--apple-indigo))', fontSize: '0.75rem' }}
              >
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className={`presence-beacon ${estadoCx === 'activo' ? 'active' : estadoCx === 'break' ? 'break' : estadoCx === 'ocupado' ? 'busy' : 'offline'}`}></span>
              <i className={`bi bi-chevron-${openDropdown === 'userMenu' ? 'up' : 'down'} text-muted me-1`} style={{ fontSize: '0.65rem' }}></i>
            </button>

            {openDropdown === 'userMenu' && (
              <div className="apple-nav-dropdown-menu shadow-lg" style={{ right: 0, left: 'auto', transform: 'none', minWidth: '240px' }}>
                <div className="px-3 py-2 border-bottom">
                  <div className="fw-bold text-dark text-truncate small">{user?.email}</div>
                  <div className="text-muted text-capitalize" style={{ fontSize: '0.7rem' }}>Rol: {role || 'Agente'}</div>
                </div>

                <div className="px-2 py-1.5">
                  <label className="text-uppercase text-muted fw-bold px-2 mb-1 d-block" style={{ fontSize: '0.65rem' }}>Presencia de Operador</label>
                  <select
                    className="form-select form-select-sm rounded-pill"
                    style={{ fontSize: '0.76rem' }}
                    value={estadoCx}
                    onChange={e => {
                      handleUpdatePresencia(e.target.value);
                    }}
                  >
                    <option value="activo">🟢 Disponible</option>
                    <option value="break">☕ En Break</option>
                    <option value="ocupado">🔴 Ocupado</option>
                    <option value="offline">⚪ Desconectado</option>
                  </select>
                </div>

                <div className="border-top my-1"></div>

                {/* Sección Cuenta */}
                <button
                  type="button"
                  className={`apple-dropdown-item ${activeView === 'perfil' ? 'active' : ''}`}
                  onClick={() => navigateTo('perfil')}
                >
                  <i className="bi bi-person-circle"></i>
                  <span>Mi Perfil</span>
                </button>

                <div className="border-top my-1"></div>
                <div className="text-uppercase text-muted fw-bold px-3 py-1" style={{ fontSize: '0.64rem', letterSpacing: '0.04em' }}>Recursos & Ayuda</div>

                <button
                  type="button"
                  className="apple-dropdown-item"
                  onClick={() => {
                    setOpenDropdown(null);
                    setShowManualModal(true);
                  }}
                >
                  <i className="bi bi-journal-text text-primary"></i>
                  <span>Manual de Operaciones</span>
                </button>

                <button
                  type="button"
                  className={`apple-dropdown-item ${activeView === 'capacitacion' ? 'active' : ''}`}
                  onClick={() => navigateTo('capacitacion')}
                >
                  <i className="bi bi-mortarboard-fill" style={{ color: 'var(--apple-purple)' }}></i>
                  <span>Auto Capacitación</span>
                </button>

                {(canView('configuracion') || canView('infraestructura')) && (
                  <>
                    <div className="border-top my-1"></div>
                    <div className="text-uppercase text-muted fw-bold px-3 py-1" style={{ fontSize: '0.64rem', letterSpacing: '0.04em' }}>Administración</div>
                    {canView('configuracion') && (
                      <button
                        type="button"
                        className={`apple-dropdown-item ${activeView === 'configuracion' ? 'active' : ''}`}
                        onClick={() => navigateTo('configuracion')}
                      >
                        <i className="bi bi-gear-fill"></i>
                        <span>Configuración</span>
                      </button>
                    )}
                    {canView('infraestructura') && (
                      <button
                        type="button"
                        className={`apple-dropdown-item ${activeView === 'infraestructura' ? 'active' : ''}`}
                        onClick={() => navigateTo('infraestructura')}
                      >
                        <i className="bi bi-server" style={{ color: 'var(--apple-red)' }}></i>
                        <span>Observabilidad</span>
                      </button>
                    )}
                  </>
                )}

                <div className="border-top my-1"></div>

                <button
                  type="button"
                  className="apple-dropdown-item text-danger"
                  onClick={async () => {
                    if (user?.uid || user?.id) {
                      const uId = user.uid || user.id;
                      window.sessionStorage.removeItem(`dismissed_fab_manual_${uId}`);
                      window.sessionStorage.removeItem(`dismissed_fab_support_${uId}`);
                    }
                    try {
                      if (user?.id) {
                        await supabase.from('usuarios').update({ estado_presencia: 'Desconectado', updated_at: new Date().toISOString() }).eq('id', user.id);
                      }
                    } catch (e) {}
                    await supabase.auth.signOut();
                    setUser(null);
                    showAlert('Sesión cerrada con éxito.', 'info');
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <button 
            className="btn btn-link text-dark d-lg-none p-1 border-0" 
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <i className="bi bi-list fs-4"></i>
          </button>
        </div>
      </header>

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
