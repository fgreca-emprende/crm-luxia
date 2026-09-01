/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';

export function PermissionsConfigPanel({ user }) {
  const DEFAULT_MATRIX = {
    views: {
      dashboard: ['lector', 'agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      clientes: ['lector', 'agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      tablero: ['lector', 'agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      leads: ['lector', 'agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      oportunidades: ['lector', 'agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      alertas: ['agente', 'supervisor', 'admin', 'superadmin'],
      perfil: ['lector', 'agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      capacitacion: ['lector', 'agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      configuracion: ['admin', 'superadmin'],
      seguridad: ['superadmin'],
      luxia_ia: ['superadmin'],
      modelos_ia: ['superadmin'],
      consumo_ia: ['superadmin'],
      consumo_whatsapp: ['superadmin'],
      infraestructura: ['superadmin'],
      meet: ['superadmin'],
      alertas_sistema: ['superadmin'],
      dashboard_adopcion: ['lector', 'agente', 'supervisor', 'admin', 'superadmin'],
      monitoreo_presencia: ['agente', 'supervisor', 'admin', 'superadmin'],
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
    },
    actions: {
      registrar_cliente_local: ['supervisor', 'admin', 'superadmin'],
      editar_cliente: ['supervisor', 'admin', 'superadmin'],
      disparar_ia: ['agente', 'supervisor', 'admin', 'superadmin'],
      crear_contrato: ['supervisor', 'admin', 'superadmin'],
      editar_contrato: ['supervisor', 'admin', 'superadmin'],
      eliminar_contrato: ['superadmin'],
      configurar_logout: ['superadmin'],
      configurar_luxia_ia: ['superadmin'],
      configurar_modelos_ia: ['superadmin'],
      configurar_presupuesto_whatsapp: ['superadmin'],
      rendir_examen: ['lector', 'agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      forzar_sincronizacion_infra: ['superadmin'],
      crear_lead: ['agente', 'supervisor', 'admin', 'superadmin'],
      editar_lead: ['agente', 'supervisor', 'admin', 'superadmin'],
      calificar_lead: ['agente', 'supervisor', 'admin', 'superadmin'],
      crear_oportunidad: ['supervisor', 'admin', 'superadmin'],
      editar_oportunidad: ['agente', 'supervisor', 'admin', 'superadmin'],
      eliminar_lead: ['superadmin'],
      eliminar_oportunidad: ['superadmin'],
      eliminar_cliente: ['superadmin'],
      asignar_lead_manual: ['supervisor', 'admin', 'superadmin'],
      agendar_meet: ['agente', 'supervisor', 'admin', 'superadmin'],
      exportar_leads: ['supervisor', 'admin', 'superadmin'],
      exportar_oportunidades: ['supervisor', 'admin', 'superadmin'],
      exportar_clientes: ['supervisor', 'admin', 'superadmin'],
      alta_masiva_registros: ['supervisor', 'admin', 'superadmin'],
      crear_formulario_web: ['admin', 'superadmin'],
      asignar_responsable_comercial: ['admin', 'superadmin'],
      forzar_fase_comercial: ['admin', 'superadmin'],
      editar_estado_presencia: ['supervisor', 'admin', 'superadmin'],
      promover_superadmin: ['superadmin'],
      configurar_copiloto: ['agente', 'supervisor', 'admin', 'superadmin'],
      adicionar_adenda_renovacion: ['supervisor', 'admin', 'superadmin'],
      operar_tarea_crm: ['agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      operar_onboarding_checklist: ['agente', 'supervisor', 'admin', 'superadmin', 'editor'],
      enviar_mensajes_whatsapp: ['agente', 'supervisor', 'admin', 'superadmin', 'editor']
    },
    scopes: {
      leads: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'NONE' },
      oportunidades: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'ALL' },
      clientes: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'ALL' },
      tablero: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'OWN' },
      alertas: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'ALL' },
      capacitacion: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'OWN' },
      consumo_ia: { superadmin: 'ALL', admin: 'ALL', supervisor: 'TEAM', agente: 'OWN', lector: 'ALL', editor: 'NONE' }
    }
  };

  const toTitleCase = (str) => {
    return (str || '')
      .split('_')
      .join(' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const getFriendlyViewLabel = (v) => {
    const labels = {
      dashboard: { title: 'Acceso: Dashboard Global', desc: 'Permite acceder y visualizar el panel principal e indicadores de control globales.' },
      clientes: { title: 'Acceso: Clientes de Cartera', desc: 'Permite acceder y visualizar la lista y fichas de datos de clientes corporativos.' },
      tablero: { title: 'Acceso: Tablero Onboarding', desc: 'Permite acceder y visualizar el tablero de hitos y el proceso de activación.' },
      leads: { title: 'Acceso: Prospección (Leads)', desc: 'Permite acceder y visualizar el listado y bandeja de leads calificados.' },
      oportunidades: { title: 'Acceso: Pipeline de Ventas', desc: 'Permite acceder y visualizar el tablero Kanban de oportunidades comerciales.' },
      alertas: { title: 'Acceso: Alertas de Riesgo', desc: 'Permite acceder y visualizar las notificaciones y alarmas emitidas por LUXIA IA.' },
      perfil: { title: 'Acceso: Mi Perfil', desc: 'Permite acceder y visualizar los datos personales, vinculación de Gmail y telemetría de uso.' },
      capacitacion: { title: 'Acceso: Capacitación', desc: 'Permite acceder a la sección de capacitación, rendir exámenes y auditar el historial.' },
      configuracion: { title: 'Acceso: Configuración CRM', desc: 'Permite acceder al panel de administración y configuración general del sistema.' },
      seguridad: { title: 'Acceso: Políticas de Seguridad', desc: 'Permite acceder a la pestaña de políticas de seguridad, timeouts y cierre de sesiones.' },
      luxia_ia: { title: 'Acceso: LUXIA IA (Calibración)', desc: 'Permite acceder en modo lectura a la calibración de prompts, temperatura e ICP de LUXIA IA.' },
      modelos_ia: { title: 'Acceso: Catálogo de Modelos IA', desc: 'Permite acceder a la pestaña de visualización de modelos de IA habilitados en el sistema.' },
      consumo_ia: { title: 'Acceso: Presupuesto y Consumo IA', desc: 'Permite acceder a la pestaña de auditoría de costos acumulados y consumo de tokens de IA.' },
      consumo_whatsapp: { title: 'Acceso: Presupuesto WhatsApp', desc: 'Permite acceder a la pestaña de control del presupuesto, buffer y logs de consumo de WhatsApp.' },
      infraestructura: { title: 'Acceso: Infraestructura', desc: 'Permite acceder al panel de monitorización de métricas del servidor, estado técnico y logs.' },
      meet: { title: 'Acceso: Políticas de Google Meet', desc: 'Permite acceder a la pestaña de límites de grabación y reglas de procesamiento de Google Meet.' },
      alertas_sistema: { title: 'Acceso: Alertas de Sistema', desc: 'Permite acceder a la pestaña de monitorización de alarmas técnicas de la plataforma.' },
      dashboard_adopcion: { title: 'Acceso: Panel de Adopción', desc: 'Permite acceder y visualizar métricas y telemetría de adopción del CRM por usuario.' },
      monitoreo_presencia: { title: 'Acceso: Monitor de Presencia', desc: 'Permite acceder al panel de disponibilidad de los asesores en tiempo real.' },
      referencia_tecnica: { title: 'Acceso: Manual de Referencia Técnica', desc: 'Permite acceder a la documentación técnica del CRM para desarrolladores.' },
      configuracion_pipeline: { title: 'Ajuste: Gobernanza Pipeline', desc: 'Permite acceder a la pestaña de etapas, transiciones y motivos de pérdida del pipeline.' },
      configuracion_onboarding: { title: 'Ajuste: Hitos de Onboarding', desc: 'Permite acceder a la pestaña de hitos obligatorios del proceso de onboarding.' },
      configuracion_servicios: { title: 'Ajuste: Catálogo de Productos', desc: 'Permite acceder a la pestaña de catálogo de líneas y soluciones fitosanitarias.' },
      configuracion_negocio: { title: 'Ajuste: Parámetros de Negocio', desc: 'Permite acceder a la pestaña de límites de Tiers comerciales y tasas de cambio.' },
      configuracion_usuarios: { title: 'Ajuste: Usuarios & Roles', desc: 'Permite acceder a la pestaña de invitaciones, roles y asignación de equipos de usuarios.' },
      configuracion_equipos: { title: 'Ajuste: Estructura de Equipos', desc: 'Permite acceder a la pestaña de creación, edición y jerarquía organizativa de equipos.' },
      configuracion_capacitacion: { title: 'Ajuste: Capacitación y Exámenes', desc: 'Permite acceder a la pestaña de edición de preguntas de examen, umbrales y respuestas prácticas.' },
      configuracion_metrics_studio: { title: 'Ajuste: Metrics Studio', desc: 'Permite acceder a la pestaña de creación de KPIs y métricas personalizadas.' },
      configuracion_integraciones: { title: 'Ajuste: Integraciones', desc: 'Permite acceder a la pestaña de administración de webhooks y API Keys externas.' }
    };
    return labels[v] || { title: toTitleCase(v), desc: `Permite ver la pantalla de ${toTitleCase(v).toLowerCase()}.` };
  };

  const getFriendlyActionLabel = (a) => {
    const labels = {
      registrar_cliente_local: { title: 'Operar: Registrar Cliente Local', desc: 'Permite crear nuevos clientes corporativos directamente en la base activa.' },
      editar_cliente: { title: 'Operar: Editar Datos de Cliente', desc: 'Permite modificar la información de las fichas de clientes corporativos existentes.' },
      disparar_ia: { title: 'Operar: Disparar LUXIA IA', desc: 'Permite gatillar análisis y auditorías de IA de salud del cliente de forma manual.' },
      crear_contrato: { title: 'Operar: Crear Acuerdo Comercial', desc: 'Permite registrar nuevos contratos y acuerdos de suministro fitosanitario.' },
      editar_contrato: { title: 'Operar: Editar Contratos', desc: 'Permite modificar importes, productos y renovar acuerdos comerciales.' },
      eliminar_contrato: { title: 'Operar: Eliminar Contrato', desc: 'Permite borrar registros de contratos y sus adendas del sistema.' },
      configurar_logout: { title: 'Configurar: Timeout de Sesión', desc: 'Permite modificar el tiempo límite de inactividad de sesión de usuarios.' },
      configurar_luxia_ia: { title: 'Configurar: LUXIA IA Prompts', desc: 'Permite modificar, guardar y versionar los prompts de sistema, temperatura e ICP de LUXIA IA.' },
      configurar_modelos_ia: { title: 'Configurar: Catálogo de Modelos', desc: 'Permite dar de alta, editar y desactivar los modelos de lenguaje habilitados en el catálogo de IA.' },
      configurar_presupuesto_whatsapp: { title: 'Configurar: Presupuesto WhatsApp', desc: 'Permite ajustar el límite global de gastos mensuales y el buffer de envío de la API de WhatsApp.' },
      rendir_examen: { title: 'Operar: Rendir Examen', desc: 'Permite completar y enviar evaluaciones teóricas/prácticas en la sección de capacitación.' },
      forzar_sincronizacion_infra: { title: 'Configurar: Forzar Sincronización', desc: 'Permite ejecutar barridos de mantenimiento y cron-jobs manuales del servidor.' },
      crear_lead: { title: 'Operar: Crear Prospecto (Lead)', desc: 'Permite dar de alta nuevos prospectos de forma manual en la sección de prospección.' },
      editar_lead: { title: 'Operar: Editar Prospecto', desc: 'Permite actualizar datos comerciales, de contacto e interacciones del lead.' },
      calificar_lead: { title: 'Operar: Calificar y Convertir Lead', desc: 'Permite convertir prospectos calificados a clientes corporativos activos en la cartera.' },
      crear_oportunidad: { title: 'Operar: Crear Oportunidad', desc: 'Permite registrar nuevos negocios comerciales en el pipeline de ventas.' },
      editar_oportunidad: { title: 'Operar: Editar Oportunidad', desc: 'Permite cambiar de etapa, editar montos y actualizar estados comerciales de oportunidades.' },
      eliminar_lead: { title: 'Operar: Eliminar Prospecto (Lead)', desc: 'Permiso destructivo para borrar registros de leads del sistema.' },
      eliminar_oportunidad: { title: 'Operar: Eliminar Oportunidad', desc: 'Permiso destructivo para borrar oportunidades comerciales del pipeline.' },
      eliminar_cliente: { title: 'Operar: Eliminar Cliente', desc: 'Permiso destructivo para borrar clientes corporativos de la cartera activa.' },
      asignar_lead_manual: { title: 'Operar: Asignar Comercial a Lead', desc: 'Permite seleccionar y reasignar el comercial responsable de una cuenta o lead.' },
      agendar_meet: { title: 'Operar: Agendar Google Meet', desc: 'Permite programar, iniciar y vincular videollamadas con contactos de clientes.' },
      exportar_leads: { title: 'Operar: Exportar Prospectos (Leads)', desc: 'Permite descargar el listado de leads calificados en formato CSV.' },
      exportar_oportunidades: { title: 'Operar: Exportar Oportunidades', desc: 'Permite descargar los negocios comerciales del Kanban de ventas en formato CSV.' },
      exportar_clientes: { title: 'Operar: Exportar Clientes', desc: 'Permite descargar la base de datos de clientes corporativos activos en formato CSV.' },
      alta_masiva_registros: { title: 'Operar: Carga Masiva de Registros', desc: 'Permite realizar importaciones por lote (CSV/Excel) de leads, clientes y oportunidades.' },
      crear_formulario_web: { title: 'Configurar: Formularios Web Inbound', desc: 'Permite crear y diseñar formularios de captación de leads en el sitio web.' },
      asignar_responsable_comercial: { title: 'Operar: Asignar Responsable Comercial', desc: 'Permite modificar el Account Manager asignado al cliente desde su ficha de gestión.' },
      forzar_fase_comercial: { title: 'Operar: Forzar Fase Comercial', desc: 'Permite omitir validaciones automáticas y saltar etapas del pipeline.' },
      editar_estado_presencia: { title: 'Operar: Cambiar Estado de Presencia', desc: 'Permite modificar el estado de conexión de otros operadores en el monitor.' },
      promover_superadmin: { title: 'Operar: Promover a SuperAdmin', desc: 'Permite otorgar el rol SuperAdmin a otros usuarios de la plataforma.' },
      configurar_copiloto: { title: 'Configurar: Copiloto de IA', desc: 'Permite encender, apagar y ajustar el buffer del análisis en vivo del Copiloto.' },
      adicionar_adenda_renovacion: { title: 'Operar: Adicionar Adendas', desc: 'Permite anexar adendas de prórroga y ampliación al listado de contratos.' },
      operar_tarea_crm: { title: 'Operar: Tareas del Tablero', desc: 'Permite crear, marcar y eliminar tareas operativas en la checklist del tablero Kanban.' },
      operar_onboarding_checklist: { title: 'Operar: Hitos de Onboarding', desc: 'Permite tildar y marcar como cumplidos los hitos del checklist de activación.' },
      enviar_mensajes_whatsapp: { title: 'Operar: Enviar Mensajes WhatsApp', desc: 'Permite chatear, enviar archivos adjuntos y lanzar plantillas comerciales aprobadas de WhatsApp.' }
    };
    return labels[a] || { title: toTitleCase(a), desc: `Permiso operativo para ${toTitleCase(a).toLowerCase()}.` };
  };

  const getFriendlyScopeLabel = (s) => {
    const labels = {
      leads: { title: 'Ámbito de Leads (Prospectos)', desc: 'Controla el alcance de visibilidad de prospectos.' },
      oportunidades: { title: 'Ámbito de Oportunidades', desc: 'Gobernanza del pipeline de ventas (Kanban y Contratos).' },
      clientes: { title: 'Ámbito de Clientes', desc: 'Alcance de visibilidad de la cartera corporativa.' },
      tablero: { title: 'Ámbito de Tablero Onboarding', desc: 'Acceso a las tarjetas de onboarding.' },
      alertas: { title: 'Ámbito de Alertas de Riesgo', desc: 'Visibilidad de alertas de LUXIA IA.' },
      capacitacion: { title: 'Ámbito de Capacitaciones', desc: 'Alcance de corrección y visualización de exámenes.' },
      consumo_ia: { title: 'Ámbito de Consumo de IA', desc: 'Visibilidad de logs e historial de costes de IA.' }
    };
    return labels[s] || { title: toTitleCase(s), desc: `Alcance para ${toTitleCase(s).toLowerCase()}.` };
  };

  const CONFIGURATION_KEYS = [
    'configurar_logout',
    'configurar_luxia_ia',
    'configurar_modelos_ia',
    'configurar_presupuesto_whatsapp',
    'forzar_sincronizacion_infra',
    'crear_formulario_web',
    'administrar_macros',
    'administrar_helpcenter',
    'administrar_automatizaciones',
    'configurar_sla_cx',
    'configurar_copiloto'
  ];

  const [permisosMatrix, setPermisosMatrix] = useState(DEFAULT_MATRIX);
  const [permisosLoading, setPermisosLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showAlert } = useToast();

  const loadPermisosMatrix = useCallback(async () => {
    setPermisosLoading(true);
    try {
      const data = await getConfigGeneral('rol_matrix');
      if (data) {
        setPermisosMatrix({
          views: { ...DEFAULT_MATRIX.views, ...(data.views || {}) },
          actions: { ...DEFAULT_MATRIX.actions, ...(data.actions || {}) },
          scopes: { ...DEFAULT_MATRIX.scopes, ...(data.scopes || {}) }
        });
      } else {
        await setConfigGeneral('rol_matrix', DEFAULT_MATRIX);
        setPermisosMatrix(DEFAULT_MATRIX);
      }
    } catch (err) {
      showAlert(`Error al cargar permisos: ${err.message}`, 'danger');
    } finally {
      setPermisosLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadPermisosMatrix();
  }, [loadPermisosMatrix]);

  const handleSavePermisos = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setConfigGeneral('rol_matrix', permisosMatrix);
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'matriz_permisos'
      });
      showAlert('Matriz de Permisos actualizada con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar permisos: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm('¿Estás seguro de que deseas restablecer toda la matriz de permisos a los valores por defecto de fábrica?')) return;
    setSaving(true);
    try {
      await setConfigGeneral('rol_matrix', DEFAULT_MATRIX);
      setPermisosMatrix(DEFAULT_MATRIX);
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'matriz_permisos_reset'
      });
      showAlert('Matriz de Permisos restablecida a los valores por defecto de fábrica.', 'success');
    } catch (err) {
      showAlert(`Error al restablecer permisos: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermiso = (type, key, roleName) => {
    if (roleName === 'superadmin') return;
    setPermisosMatrix(prev => {
      const currentRoles = prev[type]?.[key] || [];
      const updatedRoles = currentRoles.includes(roleName)
        ? currentRoles.filter(r => r !== roleName)
        : [...currentRoles, roleName];
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [key]: updatedRoles
        }
      };
    });
  };

  const handleScopeChange = (entity, roleName, value) => {
    if (roleName === 'superadmin' || roleName === 'admin') return;
    setPermisosMatrix(prev => {
      const currentEntityScopes = prev.scopes?.[entity] || {};
      return {
        ...prev,
        scopes: {
          ...prev.scopes,
          [entity]: {
            ...currentEntityScopes,
            [roleName]: value
          }
        }
      };
    });
  };

  return (
    <div className="card border-0 bg-light p-4 rounded-4 shadow-sm mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0 text-dark"><i className="bi bi-shield-check me-2 text-primary"></i>Matriz de Permisos Dinámica</h5>
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 fw-bold">SuperAdmin Only</span>
      </div>
      <p className="small text-muted mb-4">
        Administra de forma visual e inmediata qué módulos, funcionalidades y ámbitos de datos están disponibles para cada rol del sistema.
      </p>
      {permisosLoading ? (
        <div className="text-center py-5"><span className="spinner-border spinner-border-sm me-2 text-primary"></span>Cargando matriz de permisos...</div>
      ) : (
        <form onSubmit={handleSavePermisos}>
          <div className="table-responsive rounded-4 shadow-sm border mb-4" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--apple-surface-elevated)', borderBottom: '1px solid var(--apple-border)' }}>
                  <th className="px-4 py-3 small fw-bold" style={{ color: 'var(--apple-text-secondary)' }}>MÓDULO / ACCIÓN / ÁMBITO</th>
                  <th className="text-center small fw-bold" style={{ width: '110px', color: 'var(--apple-text-secondary)' }}>LECTOR</th>
                  <th className="text-center small fw-bold" style={{ width: '120px', color: 'var(--apple-text-secondary)' }}>ASESOR COM.</th>
                  <th className="text-center small fw-bold" style={{ width: '120px', color: 'var(--apple-text-secondary)' }}>SUPERV. COM.</th>
                  <th className="text-center small fw-bold" style={{ width: '110px', color: 'var(--apple-text-secondary)' }}>EDITOR</th>
                  <th className="text-center small fw-bold" style={{ width: '110px', color: 'var(--apple-text-secondary)' }}>ADMIN</th>
                  <th className="text-center small fw-bold" style={{ width: '110px', color: 'var(--apple-text-secondary)' }}>SUPERADMIN</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: 'var(--apple-surface-elevated)' }}>
                  <td colSpan="7" className="fw-bold text-primary small px-4 py-2">VISTAS PRINCIPALES (ACCESO)</td>
                </tr>
                {Object.keys(permisosMatrix.views || {}).map(v => {
                  const lbl = getFriendlyViewLabel(v);
                  return (
                    <tr key={v} style={{ borderColor: 'var(--apple-border)' }}>
                      <td className="px-4">
                        <div className="fw-bold small" style={{ color: 'var(--apple-text-primary)' }}>{lbl.title}</div>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>{lbl.desc}</span>
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.views[v]?.includes('lector')}
                          onChange={() => handleTogglePermiso('views', v, 'lector')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.views[v]?.includes('agente')}
                          onChange={() => handleTogglePermiso('views', v, 'agente')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.views[v]?.includes('supervisor')}
                          onChange={() => handleTogglePermiso('views', v, 'supervisor')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.views[v]?.includes('editor')}
                          onChange={() => handleTogglePermiso('views', v, 'editor')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.views[v]?.includes('admin')}
                          onChange={() => handleTogglePermiso('views', v, 'admin')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked
                          disabled
                        />
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--apple-surface-elevated)' }}>
                  <td colSpan="7" className="fw-bold text-primary small px-4 py-2">CONFIGURACIONES DE SISTEMA (SISTEMA & ADMIN)</td>
                </tr>
                {Object.keys(permisosMatrix.actions || {}).filter(a => CONFIGURATION_KEYS.includes(a)).map(a => {
                  const lbl = getFriendlyActionLabel(a);
                  return (
                    <tr key={a} style={{ borderColor: 'var(--apple-border)' }}>
                      <td className="px-4">
                        <div className="fw-bold small" style={{ color: 'var(--apple-text-primary)' }}>{lbl.title}</div>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>{lbl.desc}</span>
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('lector')}
                          onChange={() => handleTogglePermiso('actions', a, 'lector')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('agente')}
                          onChange={() => handleTogglePermiso('actions', a, 'agente')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('supervisor')}
                          onChange={() => handleTogglePermiso('actions', a, 'supervisor')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('editor')}
                          onChange={() => handleTogglePermiso('actions', a, 'editor')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('admin')}
                          onChange={() => handleTogglePermiso('actions', a, 'admin')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked
                          disabled
                        />
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--apple-surface-elevated)' }}>
                  <td colSpan="7" className="fw-bold text-primary small px-4 py-2">ACCIONES & OPERACIONES DE USUARIOS (OPERATIVO)</td>
                </tr>
                {Object.keys(permisosMatrix.actions || {}).filter(a => !CONFIGURATION_KEYS.includes(a)).map(a => {
                  const lbl = getFriendlyActionLabel(a);
                  return (
                    <tr key={a} style={{ borderColor: 'var(--apple-border)' }}>
                      <td className="px-4">
                        <div className="fw-bold small" style={{ color: 'var(--apple-text-primary)' }}>{lbl.title}</div>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>{lbl.desc}</span>
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('lector')}
                          onChange={() => handleTogglePermiso('actions', a, 'lector')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('agente')}
                          onChange={() => handleTogglePermiso('actions', a, 'agente')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('supervisor')}
                          onChange={() => handleTogglePermiso('actions', a, 'supervisor')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('editor')}
                          onChange={() => handleTogglePermiso('actions', a, 'editor')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input border-secondary"
                          checked={permisosMatrix.actions[a]?.includes('admin')}
                          onChange={() => handleTogglePermiso('actions', a, 'admin')}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked
                          disabled
                        />
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--apple-surface-elevated)' }}>
                  <td colSpan="7" className="fw-bold text-primary small px-4 py-2">ÁMBITOS DE VISIBILIDAD DE DATOS (DATA SCOPES)</td>
                </tr>
                {Object.keys(permisosMatrix.scopes || {}).map(s => {
                  const lbl = getFriendlyScopeLabel(s);
                  return (
                    <tr key={s} style={{ borderColor: 'var(--apple-border)' }}>
                      <td className="px-4">
                        <div className="fw-bold small" style={{ color: 'var(--apple-text-primary)' }}>{lbl.title}</div>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>{lbl.desc}</span>
                      </td>
                      {['lector', 'agente', 'supervisor', 'editor', 'admin', 'superadmin'].map(r => {
                        const isStaticAll = r === 'admin' || r === 'superadmin';
                        const val = isStaticAll ? 'ALL' : (permisosMatrix.scopes[s]?.[r] || 'ALL');
                        return (
                          <td key={r} className="text-center px-1">
                            <select
                              className="form-select form-select-sm border text-center"
                              style={{ 
                                fontSize: '0.72rem', 
                                height: 'auto', 
                                paddingTop: '2px', 
                                paddingBottom: '2px', 
                                width: '96px', 
                                display: 'inline-block',
                                background: 'var(--apple-surface-card)',
                                color: 'var(--apple-text-primary)',
                                borderColor: 'var(--apple-border)'
                              }}
                              value={val}
                              disabled={isStaticAll}
                              onChange={(e) => handleScopeChange(s, r, e.target.value)}
                            >
                              <option value="ALL">ALL</option>
                              <option value="TEAM">TEAM</option>
                              <option value="OWN">OWN</option>
                              <option value="NONE">NONE</option>
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-end gap-3 mt-4">
            <button 
              type="button" 
              className="btn btn-outline-danger rounded-pill px-4" 
              onClick={handleResetToDefaults}
              disabled={saving}
            >
              Valores por Defecto
            </button>
            <button 
              type="button" 
              className="btn btn-outline-secondary rounded-pill px-4" 
              onClick={loadPermisosMatrix}
              disabled={saving}
            >
              Restablecer
            </button>
            <button 
              type="submit" 
              className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
