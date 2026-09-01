import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import { CrmCardDetailModal } from './CrmCardDetailModal';
import { useUserRole } from '../../contexts/UserRoleContext';
import { SpinnerPremium } from '../ui/SpinnerPremium';

export function CrmTableroView({ selectedCountry }) {
  const { isLector, role, userTeam, loading: roleLoading, getDataScope, user } = useUserRole();
  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);
  const tableroScope = getDataScope('tablero');
  const isRestricted = tableroScope !== 'ALL';
  const { showAlert } = useToast();
  const [activeTab, setActiveTab] = useState('board'); // 'board' o 'dashboard'
  
  // Data State
  const [actividades, setActividades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const usuariosRef = useRef([]);

  useEffect(() => {
    usuariosRef.current = usuarios;
  }, [usuarios]);
  const [alertasCount, setAlertasCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResponsable, setFilterResponsable] = useState('');

  // Modal State
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [initialStatusForNew, setInitialStatusForNew] = useState('todo');

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const [acts, usersRes] = await Promise.all([
        getConfigGeneral('actividades_crm'),
        supabase.from('usuarios').select('*')
      ]);

      if (acts && Array.isArray(acts)) {
        setActividades(acts);
      } else {
        setActividades([]);
      }

      if (usersRes.data) {
        const temp = {};
        usersRes.data.forEach(u => {
          const email = (u.email || u.id || '').toLowerCase().trim();
          if (!email || !email.includes('@')) return;
          temp[email] = {
            email: email,
            nombre: u.nombre || email,
            equipo: u.equipo || ''
          };
        });
        setUsuarios(Object.values(temp));
      }
    } catch (err) {
      console.error("Error cargando actividades del tablero:", err);
      showAlert('Error al cargar actividades del tablero.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Drag and Drop handlers
  const handleDragStart = (e, cardId) => {
    if (isLector) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', cardId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (isLector) return;
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    const card = actividades.find(a => a.id === cardId);
    if (!card || card.estado === targetStatus) return;

    const updated = actividades.map(a => a.id === cardId ? { ...a, estado: targetStatus, updatedAt: new Date().toISOString() } : a);
    setActividades(updated);
    try {
      await setConfigGeneral('actividades_crm', updated);
      showAlert(`Actividad movida a ${getStatusLabel(targetStatus)}`, 'success');
    } catch (err) {
      console.error("Error actualizando actividad:", err);
      showAlert('Error al mover la actividad.', 'danger');
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'backlog': return '📦 Backlog';
      case 'todo': return '📋 Por Hacer';
      case 'in_progress': return '⚙️ En Proceso';
      case 'in_review': return '👀 En Revisión';
      case 'done': return '✅ Completado';
      default: return status;
    }
  };

  const openCreateModal = (status) => {
    setInitialStatusForNew(status);
    setSelectedActivity(null);
    setShowDetailModal(true);
  };

  const openEditModal = (activity) => {
    setSelectedActivity(activity);
    setShowDetailModal(true);
  };

  // Filter logic (combines search + user filter + country filter from sidebar)
  const filteredActivities = actividades.filter(act => {
    // 1. Regional country filter
    if (selectedCountry && act.pais !== selectedCountry) return false;

    // Restricción de equipo y rol
    if (tableroScope !== 'ALL') {
      const isSelf = act.responsableEmail && act.responsableEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim();
      const isUnassigned = !act.responsableEmail;
      if (tableroScope === 'OWN') {
        if (!isSelf && !isUnassigned) return false;
      } else if (tableroScope === 'TEAM') {
        if (!isSelf && !isUnassigned) {
          const asignadoUser = usuarios.find(u => u.email?.toLowerCase().trim() === act.responsableEmail?.toLowerCase().trim());
          if (!asignadoUser || normalizarEquipo(asignadoUser.equipo) !== normalizedTeam) return false;
        }
      } else {
        return false; // NONE
      }
    }

    // 2. Search query (title or client)
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      const matchTitle = act.titulo?.toLowerCase().includes(queryLower);
      const matchClient = act.nombreEmpresa?.toLowerCase().includes(queryLower);
      if (!matchTitle && !matchClient) return false;
    }

    // 3. User assignee filter
    if (filterResponsable && act.responsableEmail !== filterResponsable) return false;

    return true;
  });

  // Render Card Badge for Due Date (Semaforo)
  const renderDueBadge = (fechaFin, isCompleted) => {
    if (!fechaFin) return null;
    const date = fechaFin.toDate ? fechaFin.toDate() : new Date(fechaFin);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (isCompleted) {
      return (
        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 small fw-bold">
          <i className="bi bi-calendar-check-fill me-1"></i>
          {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
      );
    }

    if (diffDays <= 0) {
      return (
        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1 small fw-bold" title="Actividad vencida">
          <i className="bi bi-calendar-x-fill me-1 animate-pulse"></i>
          Vencido ({Math.abs(diffDays)}d)
        </span>
      );
    } else if (diffDays <= 3) {
      return (
        <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1 small fw-bold" title="Vence pronto">
          <i className="bi bi-calendar-event-fill me-1"></i>
          Próximo ({diffDays}d)
        </span>
      );
    } else {
      return (
        <span className="badge bg-light text-muted border px-2 py-1 small">
          <i className="bi bi-calendar-event me-1"></i>
          {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
      );
    }
  };

  // --- DASHBOARD CALCULATIONS ---
  const kpis = useMemo(() => {
    const total = filteredActivities.length;
    const active = filteredActivities.filter(a => a.estado !== 'done').length;
    const completed = filteredActivities.filter(a => a.estado === 'done').length;
    
    let pendingTasks = 0;
    filteredActivities.forEach(a => {
      if (a.tareas) {
        pendingTasks += a.tareas.filter(t => !t.completada).length;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      active,
      pendingTasks,
      completed,
      completionRate,
      total
    };
  }, [filteredActivities]);

  // States count
  const stateCounts = useMemo(() => {
    const counts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0 };
    filteredActivities.forEach(a => {
      if (counts[a.estado] !== undefined) counts[a.estado]++;
    });
    return counts;
  }, [filteredActivities]);

  // Workload by user
  const workload = useMemo(() => {
    const map = {};
    filteredActivities.forEach(a => {
      if (a.estado === 'done') return;
      const uEmail = a.responsableEmail || 'Sin Asignar';
      if (!map[uEmail]) map[uEmail] = { email: uEmail, activities: 0, tasks: 0 };
      map[uEmail].activities++;
      
      if (a.tareas) {
        a.tareas.forEach(t => {
          if (!t.completada) {
            const taskUser = t.responsableEmail || uEmail;
            if (!map[taskUser]) map[taskUser] = { email: taskUser, activities: 0, tasks: 0 };
            map[taskUser].tasks++;
          }
        });
      }
    });
    
    let list = Object.values(map);
    if (role === 'agente') {
      const selfEmail = user?.email?.toLowerCase().trim();
      list = list.filter(item => item.email.toLowerCase().trim() === selfEmail);
    }
    
    return list.sort((a, b) => (b.activities + b.tasks) - (a.activities + a.tasks));
  }, [filteredActivities, role, user]);

  // Upcoming Deadlines
  const upcomingDeadlines = useMemo(() => {
    const list = [];
    
    filteredActivities.forEach(a => {
      if (a.estado !== 'done' && a.fechaFin) {
        const dDate = a.fechaFin.toDate ? a.fechaFin.toDate() : new Date(a.fechaFin);
        if (!isNaN(dDate.getTime())) {
          list.push({
            id: a.id,
            activityId: a.id,
            tipo: 'Actividad',
            titulo: a.titulo,
            empresa: a.nombreEmpresa,
            pais: a.pais,
            responsable: a.responsableEmail,
            fecha: dDate,
            rawActivity: a
          });
        }
      }
      
      if (a.tareas) {
        a.tareas.forEach(t => {
          if (!t.completada && t.fechaFin) {
            const dDate = t.fechaFin.toDate ? t.fechaFin.toDate() : new Date(t.fechaFin);
            if (!isNaN(dDate.getTime())) {
              list.push({
                id: `${a.id}_${t.id}`,
                activityId: a.id,
                tipo: 'Tarea',
                titulo: `${t.titulo} (en "${a.titulo}")`,
                empresa: a.nombreEmpresa,
                pais: a.pais,
                responsable: t.responsableEmail || a.responsableEmail,
                fecha: dDate,
                rawActivity: a
              });
            }
          }
        });
      }
    });
    
    let result = list;
    if (role === 'agente') {
      const selfEmail = user?.email?.toLowerCase().trim();
      result = result.filter(item => item.responsable?.toLowerCase().trim() === selfEmail);
    }
    
    return result
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      .slice(0, 6);
  }, [filteredActivities, role, user]);

  const overdueCount = useMemo(() => {
    const now = Date.now();
    return upcomingDeadlines.filter(d => d.fecha.getTime() < now).length;
  }, [upcomingDeadlines]);

  const nearDueCount = useMemo(() => {
    const now = Date.now();
    return upcomingDeadlines.filter(d => d.fecha.getTime() >= now && (d.fecha.getTime() - now) <= 7 * 86400000).length;
  }, [upcomingDeadlines]);

  const totalAlerts = overdueCount + nearDueCount;

  if (loading) {
    return (
      <div className="py-5 text-center">
        <SpinnerPremium size="lg" text="Cargando tablero CRM..." />
      </div>
    );
  }

  return (
    <div className="container-fluid p-0 animate__animated animate__fadeIn">
      
      {/* Header View Switcher */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <div className="kpi-icon-badge kpi-icon-purple" style={{ width: '34px', height: '34px' }}>
              <i className="bi bi-kanban fs-5"></i>
            </div>
            <h2 className="mb-0 fw-bold" style={{ color: 'var(--apple-text-primary)', letterSpacing: '-0.03em' }}>
              Tablero de Actividades CRM
            </h2>
            {selectedCountry && (
              <span className="apple-glass px-2.5 py-1 rounded-pill small fw-semibold d-inline-flex align-items-center gap-1.5 ms-2" style={{ fontSize: '0.75rem', color: 'var(--apple-text-secondary)' }}>
                <span className="bullet-active"></span> {selectedCountry}
              </span>
            )}
          </div>
          <p className="mb-0 small" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.85rem' }}>
            Hitos de cuentas, tareas críticas y anexos de contratos bajo metodología ágil.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button 
            className="btn btn-sm btn-primary rounded-pill px-3 py-1.5 fw-bold shadow-sm d-flex align-items-center gap-1.5"
            onClick={() => openCreateModal('todo')}
            disabled={isLector}
            style={{ fontSize: '0.82rem' }}
          >
            <i className="bi bi-plus-lg"></i>
            <span>Nueva Actividad</span>
          </button>
          
          {/* Apple Tabs Navigation */}
          <div className="apple-segmented-control">
            <button
              type="button"
              className={`apple-segmented-item ${activeTab === 'board' ? 'active' : ''}`}
              onClick={() => setActiveTab('board')}
            >
              <i className="bi bi-kanban"></i>
              <span>Tablero</span>
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <i className="bi bi-pie-chart"></i>
              <span>Dashboard</span>
              {totalAlerts > 0 && (
                <span className="badge bg-danger rounded-pill ms-1" style={{ fontSize: '0.62rem' }}>{totalAlerts}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- TAB 1: TABLERO KANBAN --- */}
      {activeTab === 'board' && (
        <>
          {/* Filter Bar */}
          <div className="filter-bar-premium mb-4">
            <div className="filter-search-wrapper" style={{ flex: 2 }}>
              <i className="bi bi-search filter-search-icon"></i>
              <input 
                type="text" 
                className="filter-search-input" 
                placeholder="Buscar por actividad o cliente B2B..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="filter-search-clear" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda">
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>

            <div className="filter-select-wrapper" style={{ minWidth: '220px' }}>
              <i className="bi bi-person filter-select-icon"></i>
              <select 
                className="filter-select"
                value={filterResponsable}
                onChange={e => setFilterResponsable(e.target.value)}
              >
                <option value="">Todos los Responsables</option>
                {usuarios
                  .filter(u => {
                    const normU = normalizarEquipo(u.equipo);
                    const belongsToTeam = normU === 'adquisicion' || normU === 'retencion';
                    if (isRestricted) {
                      if (tableroScope === 'OWN') {
                        return u.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim();
                      }
                      return normU === normalizedTeam;
                    }
                    return belongsToTeam;
                  })
                  .map(u => (
                    <option key={u.email} value={u.email}>{u.nombre} ({normalizarEquipo(u.equipo) === 'adquisicion' ? 'Adquisición' : 'Retención'})</option>
                  ))}
              </select>
            </div>

            <div className="d-flex gap-2 ms-md-auto align-items-center">
              {(searchQuery || filterResponsable) && (
                <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => { setSearchQuery(''); setFilterResponsable(''); }}>
                  Limpiar Filtros
                </button>
              )}
            </div>
          </div>

          {/* Kanban Board columns scrollable */}
          <div className="d-flex gap-3 overflow-auto pb-4 scrollbar-hidden" style={{ minHeight: '650px', WebkitOverflowScrolling: 'touch' }}>
            
            {/* COLUMN BUILDER */}
            {['backlog', 'todo', 'in_progress', 'in_review', 'done'].map((status) => {
              const colActs = filteredActivities.filter(a => a.estado === status);
              const columnBorderColor = {
                backlog: 'var(--apple-gray-2)',
                todo: 'var(--apple-indigo)',
                in_progress: 'var(--apple-blue)',
                in_review: 'var(--apple-orange)',
                done: 'var(--apple-green)'
              }[status] || 'var(--apple-blue)';

              return (
                <div 
                  key={status}
                  className="flex-shrink-0"
                  style={{ width: '290px' }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  <div className="glass-kanban-col h-100 d-flex flex-column">
                    {/* Column Header */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="fw-bold small text-uppercase d-flex align-items-center gap-1.5" style={{ fontSize: '0.76rem', letterSpacing: '0.4px', color: 'var(--apple-text-primary)' }}>
                        {getStatusLabel(status)}
                        <span className="badge rounded-pill" style={{ fontSize: '0.65rem', backgroundColor: 'var(--apple-surface-subtle)', color: 'var(--apple-text-secondary)', border: '1px solid var(--apple-border-subtle)' }}>
                          {colActs.length}
                        </span>
                      </span>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-link text-muted p-0 border-0 fs-5 lh-1" 
                        onClick={() => openCreateModal(status)}
                        disabled={isLector}
                        title="Agregar actividad a esta columna"
                      >
                        <i className="bi bi-plus-circle-fill text-primary opacity-75"></i>
                      </button>
                    </div>

                    {/* Draggable Cards area */}
                    <div className="d-flex flex-column gap-2 flex-grow-1 overflow-y-auto scrollbar-hidden" style={{ maxHeight: '560px' }}>
                      {colActs.length === 0 ? (
                        <div 
                          className="d-flex flex-column align-items-center justify-content-center border border-dashed rounded-4 p-4 text-center text-muted"
                          style={{ minHeight: '120px', fontSize: '0.75rem', borderColor: 'var(--apple-border)' }}
                        >
                          <i className="bi bi-plus-square text-muted opacity-50 fs-4 mb-1"></i>
                          <span>Arrastra una actividad aquí</span>
                        </div>
                      ) : (
                        colActs.map((act) => {
                          const doneTasks = act.tareas ? act.tareas.filter(t => t.completada).length : 0;
                          const totalTasks = act.tareas ? act.tareas.length : 0;
                          
                          return (
                            <div 
                              key={act.id}
                              className="apple-card p-3 transition-all cursor-grab"
                              draggable={!isLector}
                              onDragStart={(e) => handleDragStart(e, act.id)}
                              onClick={() => openEditModal(act)}
                              style={{ 
                                borderLeft: `4px solid ${columnBorderColor}`,
                                cursor: isLector ? 'default' : 'grab'
                              }}
                            >
                              {/* Empresa badge & Assignee */}
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="apple-badge apple-badge-blue" style={{ fontSize: '0.65rem' }}>
                                  {act.pais ? `${act.pais} · ` : ''}{act.nombreEmpresa || 'Cliente General'}
                                </span>
                                <span 
                                  className="rounded-circle d-flex align-items-center justify-content-center fw-bold" 
                                  style={{ 
                                    width: '22px', 
                                    height: '22px', 
                                    fontSize: '0.62rem', 
                                    background: 'var(--apple-surface-subtle)', 
                                    color: 'var(--apple-text-primary)',
                                    border: '1px solid var(--apple-border)' 
                                  }} 
                                  title={act.responsableEmail}
                                >
                                  {act.responsableEmail ? act.responsableEmail.slice(0, 2).toUpperCase() : 'AM'}
                                </span>
                              </div>

                              {/* Title */}
                              <h6 className="fw-bold small mb-2 text-truncate-2" style={{ lineHeight: '1.35', color: 'var(--apple-text-primary)' }}>
                                {act.titulo}
                              </h6>

                              {/* Checklist & Attachments counts */}
                              <div className="d-flex align-items-center justify-content-between mt-2.5 pt-2 border-top" style={{ borderColor: 'var(--apple-border-subtle)' }}>
                                <div className="d-flex gap-2 align-items-center" style={{ fontSize: '0.7rem', color: 'var(--apple-text-secondary)' }}>
                                  {totalTasks > 0 && (
                                    <span className={`d-flex align-items-center gap-1 ${doneTasks === totalTasks ? "text-success fw-bold" : ""}`}>
                                      <i className="bi bi-check2-square"></i>
                                      {doneTasks}/{totalTasks}
                                    </span>
                                  )}
                                  {act.adjuntos && act.adjuntos.length > 0 && (
                                    <span className="d-flex align-items-center gap-1">
                                      <i className="bi bi-paperclip"></i>
                                      {act.adjuntos.length}
                                    </span>
                                  )}
                                </div>
                                {renderDueBadge(act.fechaFin, act.estado === 'done')}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                  </div>
                </div>
              );
            })}

          </div>
        </>
      )}

      {/* --- TAB 2: DASHBOARD CRM --- */}
      {activeTab === 'dashboard' && (
        <div className="row g-4">
          
          {/* 1. KPIs Row */}
          <div className="col-12">
            <div className="row g-3">
              {/* Card 1: Active Activities */}
              <div className="col-md-3 col-6">
                <div className="kpi-card-ambient kpi-glow-blue h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Actividades Activas</span>
                      <div className="kpi-icon-badge kpi-icon-blue"><i className="bi bi-kanban"></i></div>
                    </div>
                    <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-text-primary)', letterSpacing: '-0.02em' }}>{kpis.active}</h3>
                  </div>
                  <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>En curso o revisión</p>
                </div>
              </div>

              {/* Card 2: Pending Checklist Tasks */}
              <div className="col-md-3 col-6">
                <div className="kpi-card-ambient kpi-glow-orange h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Tareas Pendientes</span>
                      <div className="kpi-icon-badge kpi-icon-orange"><i className="bi bi-check2-square"></i></div>
                    </div>
                    <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-orange)', letterSpacing: '-0.02em' }}>{kpis.pendingTasks}</h3>
                  </div>
                  <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Items de checklist sin marcar</p>
                </div>
              </div>

              {/* Card 3: Non-read CRM Alerts */}
              <div className="col-md-3 col-6">
                <div className="kpi-card-ambient kpi-glow-red h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Alertas de Tablero</span>
                      <div className="kpi-icon-badge kpi-icon-red"><i className="bi bi-bell-fill"></i></div>
                    </div>
                    <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-red)', letterSpacing: '-0.02em' }}>{totalAlerts}</h3>
                  </div>
                  <p className="small fw-semibold mb-0 mt-2" style={{ fontSize: '0.72rem', color: totalAlerts > 0 ? 'var(--apple-red)' : 'var(--apple-text-secondary)' }}>
                    {overdueCount > 0 ? `${overdueCount} vencidas` : (nearDueCount > 0 ? `${nearDueCount} próximas a vencer` : 'Sin alertas críticas')}
                  </p>
                </div>
              </div>

              {/* Card 4: Completion rate */}
              <div className="col-md-3 col-6">
                <div className="kpi-card-ambient kpi-glow-green h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Tasa de Eficiencia</span>
                      <div className="kpi-icon-badge kpi-icon-green"><i className="bi bi-graph-up-arrow"></i></div>
                    </div>
                    <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-green)', letterSpacing: '-0.02em' }}>{kpis.completionRate}%</h3>
                  </div>
                  <div className="progress mt-2" style={{ height: '6px', backgroundColor: 'var(--apple-surface-subtle)', borderRadius: 'var(--apple-radius-pill)' }}>
                    <div className="progress-bar" role="progressbar" style={{ width: `${kpis.completionRate}%`, backgroundColor: 'var(--apple-green)', borderRadius: 'var(--apple-radius-pill)' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Left Column: Distribution & workload */}
          <div className="col-lg-6 col-12 d-flex flex-column gap-4">
            
            {/* Status Distribution */}
            <div className="apple-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0" style={{ color: 'var(--apple-text-primary)' }}>
                  <i className="bi bi-pie-chart text-primary me-2"></i>Distribución de Actividades por Estado
                </h6>
                <span className="small fw-semibold" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.75rem' }}>
                  Total: {kpis.total}
                </span>
              </div>

              <div className="d-flex flex-column gap-3 mt-3">
                {[
                  { id: 'backlog', color: 'var(--apple-gray-2)' },
                  { id: 'todo', color: 'var(--apple-indigo)' },
                  { id: 'in_progress', color: 'var(--apple-blue)' },
                  { id: 'in_review', color: 'var(--apple-orange)' },
                  { id: 'done', color: 'var(--apple-green)' }
                ].map(({ id: status, color }) => {
                  const count = stateCounts[status] || 0;
                  const total = kpis.total;
                  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                  
                  return (
                    <div key={status} className="small">
                      <div className="d-flex justify-content-between mb-1.5">
                        <span className="fw-semibold" style={{ color: 'var(--apple-text-secondary)' }}>{getStatusLabel(status)}</span>
                        <span className="fw-bold" style={{ color: 'var(--apple-text-primary)' }}>{count} ({percent}%)</span>
                      </div>
                      <div className="progress" style={{ height: '7px', backgroundColor: 'var(--apple-surface-subtle)', borderRadius: 'var(--apple-radius-pill)' }}>
                        <div className="progress-bar" role="progressbar" style={{ width: `${percent}%`, backgroundColor: color, borderRadius: 'var(--apple-radius-pill)' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workload by User */}
            <div className="apple-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0" style={{ color: 'var(--apple-text-primary)' }}>
                  <i className="bi bi-people text-primary me-2"></i>Carga de Trabajo por Responsable
                </h6>
                <span className="small fw-semibold" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.75rem' }}>
                  {workload.length} miembros activos
                </span>
              </div>

              {workload.length === 0 ? (
                <div className="text-center py-4">
                  <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2" style={{ width: '44px', height: '44px', background: 'var(--apple-surface-subtle)', color: 'var(--apple-text-secondary)' }}>
                    <i className="bi bi-person-check fs-4"></i>
                  </div>
                  <p className="small mb-0" style={{ color: 'var(--apple-text-secondary)' }}>No hay trabajo activo asignado bajo el alcance actual.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ color: 'var(--apple-text-primary)' }}>
                    <thead>
                      <tr>
                        <th className="small text-muted border-0" style={{ fontSize: '0.72rem' }}>RESPONSABLE</th>
                        <th className="small text-muted border-0 text-center" style={{ fontSize: '0.72rem' }}>ACTIVIDADES</th>
                        <th className="small text-muted border-0 text-center" style={{ fontSize: '0.72rem' }}>TAREAS</th>
                        <th className="small text-muted border-0 text-center" style={{ fontSize: '0.72rem' }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workload.map((item, idx) => (
                        <tr key={idx}>
                          <td className="small fw-semibold">
                            <div className="d-flex align-items-center gap-2">
                              <span className="rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '22px', height: '22px', fontSize: '0.62rem', background: 'var(--apple-surface-subtle)', color: 'var(--apple-text-primary)', border: '1px solid var(--apple-border)' }}>
                                {item.email.slice(0, 2).toUpperCase()}
                              </span>
                              <span>{item.email}</span>
                            </div>
                          </td>
                          <td className="small text-center"><span className="apple-badge apple-badge-blue">{item.activities}</span></td>
                          <td className="small text-center"><span className="apple-badge apple-badge-orange">{item.tasks}</span></td>
                          <td className="small text-center fw-bold">{item.activities + item.tasks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 3. Right Column: Upcoming Deadlines */}
          <div className="col-lg-6 col-12">
            <div className="apple-card p-4 h-100 d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0" style={{ color: 'var(--apple-text-primary)' }}>
                  <i className="bi bi-clock-history text-danger me-2"></i>Próximos Vencimientos Críticos
                </h6>
                <span className="small fw-semibold" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.75rem' }}>
                  Próximos 7 días
                </span>
              </div>

              {upcomingDeadlines.length === 0 ? (
                <div className="d-flex flex-column align-items-center justify-content-center py-5 my-auto text-center">
                  <div className="rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px', background: 'var(--apple-green-light)', color: 'var(--apple-green)' }}>
                    <i className="bi bi-shield-check fs-2"></i>
                  </div>
                  <h6 className="fw-bold mb-1" style={{ color: 'var(--apple-text-primary)' }}>Todo al día</h6>
                  <p className="small mb-3" style={{ color: 'var(--apple-text-secondary)', maxWidth: '320px' }}>
                    No hay actividades ni tareas con vencimientos críticos en los próximos 7 días.
                  </p>
                  <button 
                    className="btn btn-sm btn-outline-primary rounded-pill px-3"
                    onClick={() => openCreateModal('todo')}
                    disabled={isLector}
                  >
                    <i className="bi bi-calendar-plus me-1"></i> Programar Actividad
                  </button>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2.5 mt-2 flex-grow-1 overflow-y-auto">
                  {upcomingDeadlines.map((item, idx) => {
                    const daysRemaining = Math.ceil((item.fecha.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysRemaining <= 0;
                    
                    return (
                      <div 
                        key={idx} 
                        className="apple-card p-3 transition-all cursor-pointer"
                        onClick={() => openEditModal(item.rawActivity)}
                        style={{ 
                          borderLeft: `4px solid ${isOverdue ? 'var(--apple-red)' : 'var(--apple-orange)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-1.5 flex-wrap gap-2">
                          <span className={item.tipo === 'Actividad' ? 'apple-badge apple-badge-blue' : 'apple-badge apple-badge-purple'} style={{ fontSize: '0.65rem' }}>
                            {item.tipo}
                          </span>
                          <span className="apple-badge-glow" style={{ fontSize: '0.72rem', background: isOverdue ? 'var(--apple-red-light)' : 'var(--apple-orange-light)', color: isOverdue ? 'var(--apple-red)' : 'var(--apple-orange)' }}>
                            <span className="pulse-dot" style={{ backgroundColor: isOverdue ? 'var(--apple-red)' : 'var(--apple-orange)' }}></span>
                            {isOverdue ? `Vencido hace ${Math.abs(daysRemaining)} días` : `Vence en ${daysRemaining} días`}
                          </span>
                        </div>
                        <h6 className="fw-bold small mb-2" style={{ color: 'var(--apple-text-primary)' }}>{item.titulo}</h6>
                        <div className="d-flex justify-content-between align-items-center text-muted small" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>
                          <span className="d-flex align-items-center gap-1"><i className="bi bi-building"></i>{item.empresa || 'General'}</span>
                          <span className="d-flex align-items-center gap-1"><i className="bi bi-person"></i>{item.responsable || 'Sin Asignar'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Card Detail Modal */}
      {showDetailModal && (
        <CrmCardDetailModal
          show={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          activityData={selectedActivity}
          initialStatus={initialStatusForNew}
          onSaved={() => {
            loadActivities();
          }}
        />
      )}

    </div>
  );
}
