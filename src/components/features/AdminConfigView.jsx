import { useState, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';
import { useUserRole } from '../../contexts/UserRoleContext';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { lazyWithRetry } from '../../lib/lazyWithRetry';

// Lazy loaded panels to reduce initial bundle size for mobile-first users
const IntegrationsManager = lazyWithRetry(() => import('./IntegrationsManager').then(m => ({ default: m.IntegrationsManager })));
const FieldsConfigPanel = lazyWithRetry(() => import('./admin/FieldsConfigPanel').then(m => ({ default: m.FieldsConfigPanel })));
const PipelineConfigPanel = lazyWithRetry(() => import('./admin/PipelineConfigPanel').then(m => ({ default: m.PipelineConfigPanel })));
const OnboardingConfigPanel = lazyWithRetry(() => import('./admin/OnboardingConfigPanel').then(m => ({ default: m.OnboardingConfigPanel })));
const ServicesConfigPanel = lazyWithRetry(() => import('./admin/ServicesConfigPanel').then(m => ({ default: m.ServicesConfigPanel })));
const UsersConfigPanel = lazyWithRetry(() => import('./admin/UsersConfigPanel').then(m => ({ default: m.UsersConfigPanel })));
const BusinessConfigPanel = lazyWithRetry(() => import('./admin/BusinessConfigPanel').then(m => ({ default: m.BusinessConfigPanel })));
const ObservabilityConfigPanel = lazyWithRetry(() => import('./admin/ObservabilityConfigPanel').then(m => ({ default: m.ObservabilityConfigPanel })));
const PermissionsConfigPanel = lazyWithRetry(() => import('./admin/PermissionsConfigPanel').then(m => ({ default: m.PermissionsConfigPanel })));
const LuxiaIaConfigPanel = lazyWithRetry(() => import('./admin/LuxiaIaConfigPanel').then(m => ({ default: m.LuxiaIaConfigPanel })));
const IaConsumptionPanel = lazyWithRetry(() => import('./admin/IaConsumptionPanel').then(m => ({ default: m.IaConsumptionPanel })));
const MetricsStudio = lazyWithRetry(() => import('./admin/MetricsStudio').then(m => ({ default: m.MetricsStudio })));
const CapacitacionConfigPanel = lazyWithRetry(() => import('./admin/CapacitacionConfigPanel').then(m => ({ default: m.CapacitacionConfigPanel })));
const SecurityConfigPanel = lazyWithRetry(() => import('./admin/SecurityConfigPanel').then(m => ({ default: m.SecurityConfigPanel })));
const WhatsappConsumptionPanel = lazyWithRetry(() => import('./admin/WhatsappConsumptionPanel').then(m => ({ default: m.WhatsappConsumptionPanel })));
const MeetConfigPanel = lazyWithRetry(() => import('./admin/MeetConfigPanel').then(m => ({ default: m.MeetConfigPanel })));
const SystemAlertsConfigPanel = lazyWithRetry(() => import('./admin/SystemAlertsConfigPanel').then(m => ({ default: m.SystemAlertsConfigPanel })));
const AdminIaModelsManager = lazyWithRetry(() => import('./admin/AdminIaModelsManager').then(m => ({ default: m.AdminIaModelsManager })));
const BulkImportModal = lazyWithRetry(() => import('./BulkImportModal').then(m => ({ default: m.BulkImportModal })));

export function AdminConfigView({ user, selectedCountry }) {
  const currentUser = user;
  const { isSuperAdmin, hasPermission, loading: roleLoading } = useUserRole();
  
  const [activeTab, setActiveTab] = useState('comercial'); // Main tabs
  const [activeSubTab, setActiveSubTab] = useState('pipeline'); // Sub tabs
  const [equipos, setEquipos] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkEntity, setBulkEntity] = useState('leads');

  // Cargar lista de equipos
  useEffect(() => {
    const loadEquipos = async () => {
      try {
        const conf = await getConfigGeneral('equipos');
        if (conf && Array.isArray(conf.lista)) {
          setEquipos(conf.lista);
        } else {
          setEquipos([
            { id: 'Global', nombre: 'Global' },
            { id: 'Adquisicion', nombre: 'Adquisición' },
            { id: 'Retencion', nombre: 'Retención' }
          ]);
        }
      } catch (err) {
        console.warn("Error al cargar equipos en AdminConfigView:", err);
      }
    };
    loadEquipos();
  }, []);

  // Definición estructural de la Configuración Administrativa
  const TABS_CONFIG = useMemo(() => [
    {
      id: 'comercial',
      label: 'Comercial y Ventas',
      icon: 'bi-briefcase-fill',
      subTabs: [
        { id: 'pipeline', label: 'Gobernanza Pipeline', icon: 'bi-shield-check', permission: { category: 'views', key: 'configuracion_pipeline' } },
        { id: 'onboarding', label: 'Hitos de Onboarding', icon: 'bi-patch-check', permission: { category: 'views', key: 'configuracion_onboarding' } },
        { id: 'servicios', label: 'Servicios de Contratos', icon: 'bi-file-earmark-check', permission: { category: 'views', key: 'configuracion_servicios' } },
        { id: 'negocio', label: 'Parámetros de Negocio', icon: 'bi-sliders2', permission: { category: 'views', key: 'configuracion_negocio' } }
      ]
    },
    {
      id: 'organizacion',
      label: 'Organización y Personas',
      icon: 'bi-people-fill',
      subTabs: [
        { id: 'usuarios', label: 'Usuarios & Roles', icon: 'bi-shield-lock', permission: { category: 'views', key: 'configuracion_usuarios' } },
        { id: 'equipos', label: 'Estructura de Equipos', icon: 'bi-diagram-3', permission: { category: 'views', key: 'configuracion_equipos' } },
        { id: 'capacitacion', label: 'Capacitación', icon: 'bi-mortarboard-fill', permission: { category: 'views', key: 'configuracion_capacitacion' } }
      ]
    },
    {
      id: 'tecnologia',
      label: 'Tecnología y Datos',
      icon: 'bi-cpu-fill',
      subTabs: [
        { id: 'campos', label: 'Campos Dinámicos', icon: 'bi-layout-text-sidebar-reverse', permission: { category: 'views', key: 'configuracion' } },
        { id: 'alta_masiva', label: 'Alta Masiva de Datos', icon: 'bi-file-earmark-arrow-up-fill', permission: { category: 'views', key: 'configuracion' } },
        { id: 'metrics_studio', label: 'Metrics Studio', icon: 'bi-magic', permission: { category: 'views', key: 'configuracion_metrics_studio' } },
        { id: 'integraciones', label: 'Integraciones', icon: 'bi-plug-fill', permission: { category: 'views', key: 'configuracion_integraciones' } }
      ]
    },
    {
      id: 'seguridad',
      label: 'Seguridad y Privilegios',
      icon: 'bi-shield-fill-check',
      subTabs: [
        { id: 'permisos', label: 'Matriz de Permisos', icon: 'bi-grid-3x3-gap-fill', permission: { category: 'views', key: 'permisos' } },
        { id: 'seguridad', label: 'Políticas de Seguridad', icon: 'bi-key-fill', permission: { category: 'views', key: 'seguridad' } },
        { id: 'meet', label: 'Políticas de Google Meet', icon: 'bi-camera-video-fill', permission: { category: 'views', key: 'meet' } }
      ]
    },
    {
      id: 'inteligencia',
      label: 'Inteligencia y Monitoreo',
      icon: 'bi-eye-fill',
      subTabs: [
        { id: 'luxia_ia', label: 'LUXIA IA', icon: 'bi-cpu', permission: { category: 'views', key: 'luxia_ia' } },
        { id: 'modelos_ia', label: 'Catálogo de Modelos IA', icon: 'bi-robot', permission: { category: 'views', key: 'modelos_ia' } },
        { id: 'consumo_ia', label: 'Consumo de IA', icon: 'bi-bar-chart-line-fill', permission: { category: 'views', key: 'consumo_ia' } },
        { id: 'consumo_whatsapp', label: 'Consumo WhatsApp', icon: 'bi-whatsapp', permission: { category: 'views', key: 'consumo_whatsapp' } },
        { id: 'observabilidad', label: 'Observabilidad (Logs)', icon: 'bi-activity', permission: { category: 'views', key: 'infraestructura' } },
        { id: 'alertas_sistema', label: 'Alertas de Sistema', icon: 'bi-bell-fill', permission: { category: 'views', key: 'alertas_sistema' } }
      ]
    }
  ], []);

  // Validaciones RBAC
  const canShowSubTab = useCallback((subTabObj) => {
    if (subTabObj.superAdminOnly) {
      return isSuperAdmin;
    }
    if (subTabObj.permission) {
      return hasPermission(subTabObj.permission.category, subTabObj.permission.key);
    }
    return true;
  }, [isSuperAdmin, hasPermission]);

  const canShowMainTab = useCallback((mainTabObj) => {
    return mainTabObj.subTabs.some(sub => canShowSubTab(sub));
  }, [canShowSubTab]);

  // Autoseleccionar primera pestaña disponible solo si la actual no es visible
  useEffect(() => {
    if (!roleLoading) {
      const currentMain = TABS_CONFIG.find(t => t.id === activeTab);
      if (!currentMain || !canShowMainTab(currentMain)) {
        const firstVisibleMain = TABS_CONFIG.find(t => canShowMainTab(t));
        if (firstVisibleMain) {
          const firstVisibleSub = firstVisibleMain.subTabs.find(sub => canShowSubTab(sub));
          if (firstVisibleSub) {
            setActiveTab(firstVisibleMain.id);
            setActiveSubTab(firstVisibleSub.id);
          }
        }
      }
    }
  }, [roleLoading, canShowMainTab, canShowSubTab, TABS_CONFIG, activeTab]);

  const handleSelectMainTab = (mainTabId) => {
    const mainTabObj = TABS_CONFIG.find(t => t.id === mainTabId);
    if (mainTabObj) {
      const firstVisibleSub = mainTabObj.subTabs.find(sub => canShowSubTab(sub));
      if (firstVisibleSub) {
        setActiveTab(mainTabId);
        setActiveSubTab(firstVisibleSub.id);
      }
    }
  };

  if (roleLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <SpinnerPremium size="md" text="Cargando consola de seguridad..." />
      </div>
    );
  }

  return (
    <div className="animate__animated animate__fadeIn">
      <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-2">
        <h4 className="fw-bold text-dark mb-0" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <i className="bi bi-sliders text-primary me-2"></i>Consola de Configuración Administrativa
        </h4>
        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-3 py-2 fw-bold small">
          Acceso Administrador (RBAC)
        </span>
      </div>
      <p className="text-muted small mb-4">Administración global del CRM y parametrización de procesos operativos de Luxia.</p>

      {/* Pestañas Principales (Main Tabs) */}
      <div className="apple-segmented-control mb-3" style={{ padding: '4px' }}>
        {TABS_CONFIG.filter(canShowMainTab).map(main => (
          <button 
            key={main.id}
            type="button"
            className={`apple-segmented-item ${activeTab === main.id ? 'active' : ''}`}
            onClick={() => handleSelectMainTab(main.id)}
          >
            <i className={`bi ${main.icon}`}></i>
            <span>{main.label}</span>
          </button>
        ))}
      </div>

      {/* Sub-Pestañas Secundarias (Sub Tabs) */}
      {(() => {
        const currentMainTab = TABS_CONFIG.find(t => t.id === activeTab);
        const visibleSubTabs = currentMainTab ? currentMainTab.subTabs.filter(canShowSubTab) : [];
        
        if (visibleSubTabs.length <= 1) return null;
        
        return (
          <div className="apple-toolbar-island mb-4 d-flex align-items-center flex-wrap gap-2">
            <span className="small text-muted fw-bold ps-1 me-2 border-end pe-3 text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Secciones:</span>
            <div className="apple-segmented-control">
              {visibleSubTabs.map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  className={`apple-segmented-item ${activeSubTab === sub.id ? 'active' : ''}`}
                  onClick={() => setActiveSubTab(sub.id)}
                >
                  <i className={`bi ${sub.icon}`}></i>
                  <span>{sub.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="mt-3">
        <Suspense fallback={
          <div className="d-flex justify-content-center p-5">
            <SpinnerPremium size="md" text="Cargando configuración..." />
          </div>
        }>
          {activeSubTab === 'pipeline' && <PipelineConfigPanel />}
          {activeSubTab === 'onboarding' && <OnboardingConfigPanel />}
          {activeSubTab === 'servicios' && <ServicesConfigPanel />}
          {activeSubTab === 'negocio' && <BusinessConfigPanel user={currentUser} mode="negocio" />}
          

          
          {activeSubTab === 'usuarios' && <UsersConfigPanel currentUser={currentUser} isSuperAdmin={isSuperAdmin} />}
          {activeSubTab === 'equipos' && <BusinessConfigPanel user={currentUser} mode="equipos" />}
          {activeSubTab === 'capacitacion' && <CapacitacionConfigPanel />}
          
          {activeSubTab === 'campos' && <FieldsConfigPanel />}
          {activeSubTab === 'alta_masiva' && (
            <div className="card border-0 bg-white p-4 rounded-4 shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="fw-bold mb-1 text-dark"><i className="bi bi-file-earmark-arrow-up-fill me-2 text-primary"></i>Gestor de Alta Masiva de Datos</h5>
                  <p className="small text-muted mb-0">Carga masivamente Leads, Oportunidades y Clientes mediante plantillas dinámicas CSV / Excel que integran automáticamente tus campos dinámicos.</p>
                </div>
              </div>
              <div className="row g-3 mt-2">
                <div className="col-md-4">
                  <div className="card p-4 border rounded-4 text-center bg-light shadow-sm">
                    <i className="bi bi-person-badge text-success fs-1 mb-2"></i>
                    <h6 className="fw-bold text-dark">Alta Masiva de Leads</h6>
                    <p className="small text-muted mb-3">Carga prospectos con ruteo territorial Round-Robin automático por país.</p>
                    <button type="button" className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" onClick={() => { setBulkEntity('leads'); setShowBulkModal(true); }}>
                      <i className="bi bi-cloud-arrow-up me-1"></i>Cargar Leads
                    </button>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card p-4 border rounded-4 text-center bg-light shadow-sm">
                    <i className="bi bi-briefcase text-primary fs-1 mb-2"></i>
                    <h6 className="fw-bold text-dark">Alta Masiva de Oportunidades</h6>
                    <p className="small text-muted mb-3">Carga oportunidades asociadas a clientes en etapas del pipeline.</p>
                    <button type="button" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" onClick={() => { setBulkEntity('oportunidades'); setShowBulkModal(true); }}>
                      <i className="bi bi-cloud-arrow-up me-1"></i>Cargar Oportunidades
                    </button>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card p-4 border rounded-4 text-center bg-light shadow-sm">
                    <i className="bi bi-building text-info fs-1 mb-2"></i>
                    <h6 className="fw-bold text-dark">Alta Masiva de Clientes</h6>
                    <p className="small text-muted mb-3">Carga cuentas corporativas con inicialización automática de Health Score.</p>
                    <button type="button" className="btn btn-info text-white rounded-pill px-4 fw-bold shadow-sm" onClick={() => { setBulkEntity('clientes'); setShowBulkModal(true); }}>
                      <i className="bi bi-cloud-arrow-up me-1"></i>Cargar Clientes
                    </button>
                  </div>
                </div>
              </div>
              <BulkImportModal show={showBulkModal} onClose={() => setShowBulkModal(false)} initialEntity={bulkEntity} user={currentUser} />
            </div>
          )}
          {activeSubTab === 'metrics_studio' && <MetricsStudio user={currentUser} />}

          {activeSubTab === 'integraciones' && <IntegrationsManager />}
          
          {activeSubTab === 'permisos' && <PermissionsConfigPanel user={currentUser} />}
          {activeSubTab === 'seguridad' && <SecurityConfigPanel user={currentUser} />}
          {activeSubTab === 'meet' && <MeetConfigPanel user={currentUser} />}
          
          {activeSubTab === 'luxia_ia' && <LuxiaIaConfigPanel currentUser={currentUser} />}
          {activeSubTab === 'modelos_ia' && <AdminIaModelsManager selectedCountry={selectedCountry} />}
          {activeSubTab === 'consumo_ia' && <IaConsumptionPanel selectedCountry={selectedCountry} />}
          {activeSubTab === 'consumo_whatsapp' && <WhatsappConsumptionPanel user={currentUser} selectedCountry={selectedCountry} />}
          {activeSubTab === 'observabilidad' && <ObservabilityConfigPanel user={currentUser} />}
          {activeSubTab === 'alertas_sistema' && <SystemAlertsConfigPanel />}
        </Suspense>
      </div>
    </div>
  );
}
