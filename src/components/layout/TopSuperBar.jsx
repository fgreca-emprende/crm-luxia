import { useState, useRef, useEffect } from 'react';
import { LuxiaLogo } from '../ui/LuxiaLogo';

export function TopSuperBar({
  activeView,
  navigateTo,
  canView,
  alertCount,
  activeCountries,
  selectedCountry,
  setSelectedCountry,
  permitirTodos,
  themeMode,
  setThemeMode,
  setShowSupportDrawer,
  user,
  role,
  estadoCx,
  handleUpdatePresencia,
  setShowManualModal,
  handleLogout,
  setSidebarOpen
}) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const superbarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (superbarRef.current && !superbarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
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
                    onClick={() => { navigateTo('leads'); setOpenDropdown(null); }}
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
                    onClick={() => { navigateTo('oportunidades'); setOpenDropdown(null); }}
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
                onClick={() => { navigateTo('clientes'); setOpenDropdown(null); }}
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
                onClick={() => { navigateTo('tablero'); setOpenDropdown(null); }}
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
                onClick={() => { navigateTo('perfil'); setOpenDropdown(null); }}
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
                onClick={() => { navigateTo('capacitacion'); setOpenDropdown(null); }}
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
                      onClick={() => { navigateTo('configuracion'); setOpenDropdown(null); }}
                    >
                      <i className="bi bi-gear-fill"></i>
                      <span>Configuración</span>
                    </button>
                  )}
                  {canView('infraestructura') && (
                    <button
                      type="button"
                      className={`apple-dropdown-item ${activeView === 'infraestructura' ? 'active' : ''}`}
                      onClick={() => { navigateTo('infraestructura'); setOpenDropdown(null); }}
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
                onClick={() => {
                  setOpenDropdown(null);
                  handleLogout();
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
  );
}
