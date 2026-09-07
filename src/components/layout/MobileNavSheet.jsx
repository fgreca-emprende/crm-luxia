import { LuxiaLogo } from '../ui/LuxiaLogo';

export function MobileNavSheet({
  sidebarOpen,
  setSidebarOpen,
  activeView,
  navigateTo,
  canView,
  alertCount,
  handleLogout
}) {
  return (
    <>
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
            onClick={() => { navigateTo('dashboard'); setSidebarOpen(false); }}
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
              onClick={() => { navigateTo('leads'); setSidebarOpen(false); }}
            >
              <i className="bi bi-person-plus-fill me-2" style={{ color: 'var(--apple-green)' }}></i>
              <span>Prospección (Leads)</span>
            </button>
          )}
          {canView('oportunidades') && (
            <button 
              type="button" 
              className={`apple-dropdown-item py-2 ${activeView === 'oportunidades' ? 'active' : ''}`}
              onClick={() => { navigateTo('oportunidades'); setSidebarOpen(false); }}
            >
              <i className="bi bi-bar-chart-steps me-2" style={{ color: 'var(--apple-teal)' }}></i>
              <span>Pipeline de Ventas</span>
            </button>
          )}

          <div className="text-uppercase text-muted fw-bold mt-3 mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.06em' }}>Operaciones</div>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'clientes' ? 'active' : ''}`}
            onClick={() => { navigateTo('clientes'); setSidebarOpen(false); }}
          >
            <i className="bi bi-people-fill me-2" style={{ color: 'var(--apple-indigo)' }}></i>
            <span>Gestión de Clientes</span>
          </button>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'tablero' ? 'active' : ''}`}
            onClick={() => { navigateTo('tablero'); setSidebarOpen(false); }}
          >
            <i className="bi bi-kanban-fill me-2" style={{ color: 'var(--apple-purple)' }}></i>
            <span>Tablero CRM</span>
          </button>

          <div className="text-uppercase text-muted fw-bold mt-3 mb-1" style={{ fontSize: '0.68rem', letterSpacing: '0.06em' }}>Sistema</div>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'alertas' ? 'active' : ''}`}
            onClick={() => { navigateTo('alertas'); setSidebarOpen(false); }}
          >
            <i className="bi bi-bell-fill me-2" style={{ color: 'var(--apple-red)' }}></i>
            <span>Alertas de Riesgo</span>
            {alertCount > 0 && <span className="badge rounded-pill bg-danger ms-auto">{alertCount}</span>}
          </button>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'perfil' ? 'active' : ''}`}
            onClick={() => { navigateTo('perfil'); setSidebarOpen(false); }}
          >
            <i className="bi bi-person-circle me-2" style={{ color: 'var(--apple-text-secondary)' }}></i>
            <span>Mi Perfil</span>
          </button>
          <button 
            type="button" 
            className={`apple-dropdown-item py-2 ${activeView === 'capacitacion' ? 'active' : ''}`}
            onClick={() => { navigateTo('capacitacion'); setSidebarOpen(false); }}
          >
            <i className="bi bi-mortarboard-fill me-2" style={{ color: 'var(--apple-purple)' }}></i>
            <span>Auto Capacitación</span>
          </button>
          {canView('configuracion') && (
            <button 
              type="button" 
              className={`apple-dropdown-item py-2 ${activeView === 'configuracion' ? 'active' : ''}`}
              onClick={() => { navigateTo('configuracion'); setSidebarOpen(false); }}
            >
              <i className="bi bi-gear-fill me-2" style={{ color: 'var(--apple-text-secondary)' }}></i>
              <span>Configuración</span>
            </button>
          )}
          {canView('infraestructura') && (
            <button 
              type="button" 
              className={`apple-dropdown-item py-2 ${activeView === 'infraestructura' ? 'active' : ''}`}
              onClick={() => { navigateTo('infraestructura'); setSidebarOpen(false); }}
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
            onClick={() => {
              setSidebarOpen(false);
              handleLogout();
            }}
          >
            <i className="bi bi-box-arrow-right"></i>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
