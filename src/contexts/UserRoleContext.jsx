import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const UserRoleContext = createContext(null);

export function UserRoleProvider({ user, children }) {
  const [role, setRole] = useState('lector');
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(!!user?.email);
  const [userTeam, setUserTeam] = useState('Global');
  const [userCountry, setUserCountry] = useState('AR');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user || !user.email) {
        setRole('lector');
        setUserTeam('Global');
        setUserCountry('AR');
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Consultar el perfil del usuario desde PostgreSQL en Supabase
        const { data: uData, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (uData && !error) {
          const val = uData.rol?.toLowerCase();
          if (['superadmin', 'admin', 'supervisor', 'agente', 'lector', 'editor'].includes(val)) {
            setRole(val);
          } else {
            setRole('lector');
          }
          setUserTeam(uData.equipo || 'Global');
          setUserCountry(uData.pais || 'AR');
          setProfile(uData);
        } else {
          // Fallback al rol del metadata del token si aún no existe la fila
          const metaRole = user.user_metadata?.rol || user.app_metadata?.rol || 'lector';
          setRole(metaRole);
          setUserTeam(user.user_metadata?.equipo || 'Global');
          setUserCountry(user.user_metadata?.pais || 'AR');
        }
      } catch (err) {
        console.error('[UserRoleContext] Error resolviendo rol/permisos en Supabase:', err);
        setRole('lector');
        setUserTeam('Global');
        setUserCountry('AR');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  // Suscribirse a la matriz de permisos de PostgreSQL en tiempo real
  useEffect(() => {
    if (!user) {
      setMatrix(null);
      return;
    }

    const fetchPermissions = async () => {
      const { data } = await supabase
        .from('config_permisos')
        .select('*')
        .eq('id', 'rol_matrix')
        .maybeSingle();
      if (data) {
        setMatrix(data);
      }
    };

    fetchPermissions();

    const channel = supabase
      .channel('realtime_permissions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'config_permisos', filter: 'id=eq.rol_matrix' },
        (payload) => {
          if (payload.new) setMatrix(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const DEFAULT_ACTIONS = {
    alta_masiva_registros: ['supervisor', 'admin', 'superadmin'],
    exportar_leads: ['supervisor', 'admin', 'superadmin'],
    exportar_oportunidades: ['supervisor', 'admin', 'superadmin'],
    exportar_clientes: ['supervisor', 'admin', 'superadmin'],
    crear_lead: ['agente', 'supervisor', 'admin', 'superadmin'],
    editar_lead: ['agente', 'supervisor', 'admin', 'superadmin'],
    crear_oportunidad: ['supervisor', 'admin', 'superadmin'],
    editar_oportunidad: ['agente', 'supervisor', 'admin', 'superadmin'],
    crear_contrato: ['supervisor', 'admin', 'superadmin'],
    editar_contrato: ['supervisor', 'admin', 'superadmin'],
    registrar_cliente_local: ['supervisor', 'admin', 'superadmin'],
    editar_cliente: ['supervisor', 'admin', 'superadmin'],
    eliminar_lead: ['superadmin'],
    eliminar_oportunidad: ['superadmin'],
    eliminar_cliente: ['superadmin'],
    asignar_responsable_comercial: ['admin', 'superadmin'],
    forzar_fase_comercial: ['admin', 'superadmin'],
    editar_estado_presencia: ['supervisor', 'admin', 'superadmin'],
    promover_superadmin: ['superadmin'],
    configurar_copiloto: ['agente', 'supervisor', 'admin', 'superadmin'],
    adicionar_adenda_renovacion: ['supervisor', 'admin', 'superadmin'],
    operar_tarea_crm: ['agente', 'supervisor', 'admin', 'superadmin', 'editor'],
    operar_onboarding_checklist: ['agente', 'supervisor', 'admin', 'superadmin', 'editor'],
    enviar_mensajes_whatsapp: ['agente', 'supervisor', 'admin', 'superadmin', 'editor'],
    disparar_ia: ['agente', 'supervisor', 'admin', 'superadmin'],
    eliminar_contrato: ['superadmin'],
    configurar_logout: ['superadmin'],
    configurar_luxia_ia: ['superadmin'],
    configurar_modelos_ia: ['superadmin'],
    configurar_presupuesto_whatsapp: ['superadmin'],
    rendir_examen: ['lector', 'agente', 'supervisor', 'admin', 'superadmin'],
    forzar_sincronizacion_infra: ['superadmin'],
    calificar_lead: ['agente', 'supervisor', 'admin', 'superadmin'],
    asignar_lead_manual: ['supervisor', 'admin', 'superadmin'],
    agendar_meet: ['agente', 'supervisor', 'admin', 'superadmin'],
    crear_formulario_web: ['admin', 'superadmin'],
    referencia_tecnica: ['superadmin', 'admin'],
    configuracion_pipeline: ['superadmin', 'admin'],
    configuracion_onboarding: ['superadmin', 'admin'],
    configuracion_servicios: ['superadmin', 'admin'],
    configuracion_negocio: ['superadmin', 'admin', 'lector'],
    configuracion_usuarios: ['superadmin', 'admin'],
    configuracion_equipos: ['superadmin', 'admin'],
    configuracion_capacitacion: ['superadmin', 'admin'],
    configuracion_metrics_studio: ['superadmin', 'admin'],
    configuracion_integraciones: ['superadmin', 'admin']
  };

  const DEFAULT_SCOPES = {
    leads: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'OWN', editor: 'ALL' },
    oportunidades: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'OWN', editor: 'ALL' },
    clientes: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'OWN', editor: 'ALL' },
    tablero: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'OWN', editor: 'OWN' },
    alertas: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'OWN', editor: 'ALL' },
    capacitacion: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'OWN', editor: 'OWN' },
    consumo_ia: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'OWN', editor: 'NONE' }
  };

  const hasPermission = useCallback((typeOrActionKey, maybeActionKey) => {
    if (role === 'superadmin') return true;
    
    let type = typeOrActionKey;
    let key = maybeActionKey;
    if (maybeActionKey === undefined) {
      type = 'actions';
      key = typeOrActionKey;
    }

    if (!matrix) {
      const fallback = DEFAULT_ACTIONS[key] || ['supervisor', 'admin', 'superadmin'];
      return fallback.includes(role);
    }
    
    const allowed = matrix[type]?.[key];
    if (allowed !== undefined) {
      return allowed.includes(role);
    }

    const fallback = DEFAULT_ACTIONS[key] || ['supervisor', 'admin', 'superadmin'];
    return fallback.includes(role);
  }, [role, matrix]);

  const normalizarEquipo = useCallback((teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }, []);

  const getDataScope = useCallback((entityKey) => {
    if (role === 'superadmin' || role === 'admin') return 'ALL';

    if (entityKey === 'leads' && (role === 'agente' || role === 'supervisor') && normalizarEquipo(userTeam) === 'retencion') {
      return 'NONE';
    }

    const entityScopes = matrix?.scopes?.[entityKey];
    if (entityScopes && entityScopes[role] !== undefined) {
      return entityScopes[role];
    }

    const fallbackScopes = DEFAULT_SCOPES[entityKey] || {};
    return fallbackScopes[role] !== undefined ? fallbackScopes[role] : 'ALL';
  }, [role, userTeam, matrix, normalizarEquipo]);

  const canView = useCallback((viewKey) => {
    if (role === 'superadmin') return true;
    
    if (['leads', 'oportunidades', 'clientes', 'tablero'].includes(viewKey)) {
      const scope = getDataScope(viewKey);
      if (scope === 'NONE') return false;
    }

    if (!matrix) {
      if (['seguridad', 'luxia_ia', 'consumo_ia', 'consumo_whatsapp', 'infraestructura', 'permisos'].includes(viewKey)) {
        return false;
      }
      return true;
    }
    const allowed = matrix.views?.[viewKey] || [];
    return allowed.includes(role);
  }, [role, matrix, getDataScope]);

  const value = useMemo(() => ({
    role,
    profile,
    loading,
    userTeam,
    equipo: userTeam,
    userCountry,
    pais: userCountry,
    isSuperAdmin: role === 'superadmin',
    isAdmin: role === 'admin' || role === 'superadmin',
    isSupervisor: role === 'supervisor' || role === 'admin' || role === 'superadmin',
    isAgent: ['agente', 'supervisor', 'admin', 'superadmin', 'editor'].includes(role),
    isLector: role === 'lector',
    hasPermission,
    canView,
    getDataScope
  }), [role, profile, loading, userTeam, userCountry, hasPermission, canView, getDataScope]);

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (!context) {
    return {
      role: 'lector',
      loading: false,
      userCountry: 'AR',
      pais: 'AR',
      isSuperAdmin: false,
      isAdmin: false,
      isSupervisor: false,
      isAgent: false,
      isLector: true,
      hasPermission: () => false,
      canView: () => false,
      getDataScope: () => 'ALL'
    };
  }
  return context;
}
