import React, { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral } from '../../../lib/configGeneral';
import { useUserRole } from '../../../contexts/UserRoleContext';

export function UserAdoptionPanel({ user }) {
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [timeFilter, setTimeFilter] = useState('24h');
  const [feedUserFilter, setFeedUserFilter] = useState('');
  const [feedDateFilter, setFeedDateFilter] = useState('');
  const [adoptionStats, setAdoptionStats] = useState({
    usuariosActivos: 0,
    totalConsultasIA: 0,
    alertasResueltas: 0,
    logsTotales: 0
  });
  const [usoDiarioLogs, setUsoDiarioLogs] = useState([]);
  const [loadingUso, setLoadingUso] = useState(true);
  const [activeMinDate, setActiveMinDate] = useState(new Date());
  const [activeMaxDate, setActiveMaxDate] = useState(null);

  const { canView, loading: roleLoading } = useUserRole();
  const hasFullAccess = canView('dashboard_adopcion');

  const adoptionChartRef = useRef(null);
  const adoptionInstance = useRef(null);
  const [themeToggle, setThemeToggle] = useState(0);

  // Monitor prefers-color-scheme media query to redraw charts when OS theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setThemeToggle(prev => prev + 1);
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const now = new Date();
  const startOfCurrentMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), []);
  const startOfPreviousMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0), []);
  const endOfPreviousMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999), []);

  const currentMonthLabel = useMemo(() => {
    const name = startOfCurrentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [startOfCurrentMonth]);

  const previousMonthLabel = useMemo(() => {
    const name = startOfPreviousMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [startOfPreviousMonth]);

  useEffect(() => {
    if (roleLoading) return;
    setLogsLoading(true);
    
    let dateThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let currentMin = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let currentMax = null;

    if (timeFilter === '48h') {
      dateThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
      currentMin = new Date(Date.now() - 48 * 60 * 60 * 1000);
    } else if (timeFilter === '7d') {
      dateThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      currentMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeFilter === 'mes_actual') {
      dateThreshold = startOfCurrentMonth;
      currentMin = startOfCurrentMonth;
    } else if (timeFilter === 'mes_anterior') {
      dateThreshold = startOfPreviousMonth;
      currentMin = startOfPreviousMonth;
      currentMax = endOfPreviousMonth;
    }

    setActiveMinDate(currentMin);
    setActiveMaxDate(currentMax);

    const minQueryDate = dateThreshold < startOfPreviousMonth ? dateThreshold : startOfPreviousMonth;

    const fetchLogs = async () => {
      try {
        let query = supabase
          .from('logs_sistema')
          .select('*')
          .gte('timestamp', minQueryDate.toISOString())
          .order('timestamp', { ascending: false })
          .limit(500);

        if (!hasFullAccess && user?.email) {
          query = query.eq('usuario_email', user.email);
        }

        const { data, error } = await query;
        if (error) throw error;
        const loadedLogs = (data || []).map(d => ({
          id: d.id,
          timestamp: d.timestamp,
          usuarioEmail: d.usuario_email || d.usuarioEmail,
          usuarioNombre: d.usuario_nombre || d.usuarioNombre,
          accion: d.accion,
          detalles: d.detalles,
          ip: d.ip,
          ...d
        }));
        setLogs(loadedLogs);
      } catch (err) {
        console.warn("Error al cargar logs de telemetría:", err);
      } finally {
        setLogsLoading(false);
      }
    };

    fetchLogs();
  }, [timeFilter, hasFullAccess, roleLoading, user, startOfCurrentMonth, startOfPreviousMonth]);

  // Consultar acumuladores de minutos de conexión de todos los usuarios
  useEffect(() => {
    if (roleLoading) return;
    setLoadingUso(true);
    const fetchUso = async () => {
      try {
        const data = await getConfigGeneral('uso_diario');
        setUsoDiarioLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("Error consultando uso diario:", err);
      } finally {
        setLoadingUso(false);
      }
    };
    fetchUso();
  }, [timeFilter, roleLoading]);

  useEffect(() => {
    if (roleLoading) return;
    const fetchUsers = async () => {
      try {
        const { data } = await supabase.from('usuarios').select('*');
        const temp = {};
        (data || []).forEach(u => {
          const email = (u.email || u.id || '').toLowerCase().trim();
          if (!email || !email.includes('@')) return;
          const currentName = u.nombre || '';
          const hasRealName = currentName && !currentName.includes('@');
          if (!temp[email] || (!temp[email].hasRealName && hasRealName)) {
            temp[email] = {
              id: u.id,
              ...u,
              email: email,
              nombre: u.nombre || email,
              hasRealName: !!hasRealName
            };
          }
        });
        setUsuarios(Object.values(temp));
      } catch (err) {
        console.warn("Error consultando usuarios:", err);
      }
    };
    fetchUsers();
  }, [roleLoading]);

  // Filtrado de logs según el filtro activo (24h, 48h, 7d, mes_actual, mes_anterior)
  const activeLogs = useMemo(() => {
    return logs.filter(log => {
      const dateObj = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      if (dateObj < activeMinDate) return false;
      if (activeMaxDate && dateObj > activeMaxDate) return false;
      return true;
    });
  }, [logs, activeMinDate, activeMaxDate]);

  // Filtrado de minutos de conexión según el filtro activo
  const activeUsoLogs = useMemo(() => {
    return usoDiarioLogs.filter(log => {
      const dateObj = new Date(log.lastActiveAt);
      if (dateObj < activeMinDate) return false;
      if (activeMaxDate && dateObj > activeMaxDate) return false;
      return true;
    });
  }, [usoDiarioLogs, activeMinDate, activeMaxDate]);

  const combinedUsers = useMemo(() => {
    const userMap = {};
    if (usuarios && usuarios.length > 0) {
      usuarios.forEach(c => {
        userMap[c.email] = {
          email: c.email,
          uid: c.id || c.uid || null,
          nombre: c.nombre || c.email,
          count: 0,
          lastLoginAt: c.lastLoginAt || c.activatedAt || null
        };
      });
    }


    if (activeLogs && activeLogs.length > 0) {
      activeLogs.forEach(log => {
        const email = (log.usuarioEmail || '').trim();
        if (!email || email === 'Desconocido' || !email.includes('@')) return;
        if (!userMap[email]) {
          userMap[email] = {
            email: email,
            nombre: log.usuarioNombre || email,
            count: 0,
            lastLoginAt: null
          };
        }
        userMap[email].count += 1;
      });
    }

    return Object.values(userMap).sort((a, b) => b.count - a.count);
  }, [activeLogs, usuarios]);

  // Cómputo de adoptionStats para la vista activa
  const currentAdoptionStats = useMemo(() => {
    const distinctUsers = new Set();
    let countIA = 0;
    let countAlerts = 0;

    activeLogs.forEach(log => {
      if (log.usuarioEmail) distinctUsers.add(log.usuarioEmail);
      if (log.accion === 'trigger_ia') countIA++;
      if (log.accion === 'resolve_alert') countAlerts++;
    });

    return {
      usuariosActivos: distinctUsers.size,
      totalConsultasIA: countIA,
      alertasResueltas: countAlerts,
      logsTotales: activeLogs.length
    };
  }, [activeLogs]);

  // Cómputo de Comparativo Mensual (MoM: Mes Actual vs Mes Anterior)
  const momStats = useMemo(() => {
    const currLogs = logs.filter(l => {
      const d = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
      return d >= startOfCurrentMonth;
    });

    const prevLogs = logs.filter(l => {
      const d = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
      return d >= startOfPreviousMonth && d <= endOfPreviousMonth;
    });

    const currUso = usoDiarioLogs.filter(l => new Date(l.lastActiveAt) >= startOfCurrentMonth);
    const prevUso = usoDiarioLogs.filter(l => {
      const d = new Date(l.lastActiveAt);
      return d >= startOfPreviousMonth && d <= endOfPreviousMonth;
    });

    const currUsers = new Set(currLogs.map(l => l.usuarioEmail).filter(Boolean)).size;
    const prevUsers = new Set(prevLogs.map(l => l.usuarioEmail).filter(Boolean)).size;

    const currIA = currLogs.filter(l => l.accion === 'trigger_ia').length;
    const prevIA = prevLogs.filter(l => l.accion === 'trigger_ia').length;

    const currAlerts = currLogs.filter(l => l.accion === 'resolve_alert').length;
    const prevAlerts = prevLogs.filter(l => l.accion === 'resolve_alert').length;

    const currHours = (currUso.reduce((acc, l) => acc + (l.minutosConectado || 0), 0) / 60).toFixed(1);
    const prevHours = (prevUso.reduce((acc, l) => acc + (l.minutosConectado || 0), 0) / 60).toFixed(1);

    const calcVar = (pVal, cVal) => {
      const p = parseFloat(pVal) || 0;
      const c = parseFloat(cVal) || 0;
      if (p === 0) return c > 0 ? '+100%' : '0%';
      const diff = ((c - p) / p) * 100;
      return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    };

    return {
      current: { users: currUsers, ia: currIA, alerts: currAlerts, hours: currHours, logs: currLogs.length },
      previous: { users: prevUsers, ia: prevIA, alerts: prevAlerts, hours: prevHours, logs: prevLogs.length },
      var: {
        usersPct: calcVar(prevUsers, currUsers),
        iaPct: calcVar(prevIA, currIA),
        alertsPct: calcVar(prevAlerts, currAlerts),
        hoursPct: calcVar(prevHours, currHours)
      }
    };
  }, [logs, usoDiarioLogs, startOfCurrentMonth, startOfPreviousMonth, endOfPreviousMonth]);

  // Cómputo de estadísticas de conexión
  const connectionStats = useMemo(() => {
    const totalMinutes = activeUsoLogs.reduce((acc, log) => acc + (log.minutosConectado || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    const distinctUsoUsers = new Set(activeUsoLogs.map(log => log.userEmail));
    const numUsers = distinctUsoUsers.size || 1;

    let numDays = 1;
    if (timeFilter === '48h') numDays = 2;
    else if (timeFilter === '7d') numDays = 7;
    else if (timeFilter === 'mes_actual' || timeFilter === 'mes_anterior') numDays = 30;

    const avgHoursPerDay = (totalMinutes / 60 / numUsers / numDays).toFixed(1);

    return {
      totalHours,
      avgHoursPerDay
    };
  }, [activeUsoLogs, timeFilter]);

  useEffect(() => {
    if (logsLoading || logs.length === 0 || typeof window.Chart === 'undefined') return;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDark ? '#94a3b8' : '#6c757d';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(108, 117, 125, 0.1)';

    const dailyCounts = {};
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = daysOfWeek[d.getDay()];
      dailyCounts[dayName] = 0;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    logs.forEach(log => {
      if (log.timestamp) {
        const dateObj = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        if (dateObj < sevenDaysAgo) return;
        const dayName = daysOfWeek[dateObj.getDay()];
        if (dailyCounts[dayName] !== undefined) {
          dailyCounts[dayName]++;
        }
      }
    });

    const labels = Object.keys(dailyCounts);
    const data = Object.values(dailyCounts);

    if (adoptionChartRef.current) {
      if (adoptionInstance.current) adoptionInstance.current.destroy();
      const ctx = adoptionChartRef.current.getContext('2d');
      
      adoptionInstance.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Interacciones del Sistema',
            data: data,
            backgroundColor: '#0d6efd',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 5 }
            },
            x: { grid: { display: false }, ticks: { color: textColor } }
          }
        }
      });
    }

    return () => {
      if (adoptionInstance.current) adoptionInstance.current.destroy();
    };
  }, [logs, logsLoading, themeToggle]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <span className="small text-muted fw-bold">
          <i className="bi bi-funnel text-primary me-1"></i> Rango de Telemetría:
        </span>
        <div className="btn-group btn-group-sm bg-light p-1 rounded-pill shadow-xs" role="group">
          <button 
            type="button" 
            className={`btn rounded-pill border-0 px-3 py-1 fw-bold small ${timeFilter === '24h' ? 'btn-primary text-white shadow-sm' : 'text-muted'}`}
            style={{ fontSize: '0.72rem' }}
            onClick={() => setTimeFilter('24h')}
          >
            Últimas 24h
          </button>
          <button 
            type="button" 
            className={`btn rounded-pill border-0 px-3 py-1 fw-bold small ${timeFilter === '48h' ? 'btn-primary text-white shadow-sm' : 'text-muted'}`}
            style={{ fontSize: '0.72rem' }}
            onClick={() => setTimeFilter('48h')}
          >
            Últimas 48h
          </button>
          <button 
            type="button" 
            className={`btn rounded-pill border-0 px-3 py-1 fw-bold small ${timeFilter === '7d' ? 'btn-primary text-white shadow-sm' : 'text-muted'}`}
            style={{ fontSize: '0.72rem' }}
            onClick={() => setTimeFilter('7d')}
          >
            Última Semana
          </button>
          <button 
            type="button" 
            className={`btn rounded-pill border-0 px-3 py-1 fw-bold small ${timeFilter === 'mes_actual' ? 'btn-primary text-white shadow-sm' : 'text-muted'}`}
            style={{ fontSize: '0.72rem' }}
            onClick={() => setTimeFilter('mes_actual')}
          >
            📅 Mes Actual ({currentMonthLabel})
          </button>
          <button 
            type="button" 
            className={`btn rounded-pill border-0 px-3 py-1 fw-bold small ${timeFilter === 'mes_anterior' ? 'btn-primary text-white shadow-sm' : 'text-muted'}`}
            style={{ fontSize: '0.72rem' }}
            onClick={() => setTimeFilter('mes_anterior')}
          >
            ⏮️ Mes Anterior ({previousMonthLabel})
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3 col-lg">
          <div className="card-premium p-3 d-flex flex-column justify-content-between border-start border-primary border-4">
            <div>
              <h6 className="text-muted small text-uppercase fw-bold mb-1" style={{ fontSize: '0.68rem' }}>Usuarios Activos (WAU)</h6>
              <h3 className="fw-bold text-primary mb-0 mt-1" style={{ fontSize: '1.8rem' }}>
                {logsLoading ? <span className="spinner-border spinner-border-sm"></span> : currentAdoptionStats.usuariosActivos}
              </h3>
            </div>
            <p className="text-muted small mb-0 mt-2" style={{ fontSize: '0.7rem' }}>Operadores activos</p>
          </div>
        </div>

        <div className="col-6 col-md-3 col-lg">
          <div className="card-premium p-3 d-flex flex-column justify-content-between border-start border-success border-4">
            <div>
              <h6 className="text-muted small text-uppercase fw-bold mb-1" style={{ fontSize: '0.68rem' }}>Consultas a LUXIA IA</h6>
              <h3 className="fw-bold text-success mb-0 mt-1" style={{ fontSize: '1.8rem' }}>
                {logsLoading ? <span className="spinner-border spinner-border-sm"></span> : currentAdoptionStats.totalConsultasIA}
              </h3>
            </div>
            <p className="text-muted small mb-0 mt-2" style={{ fontSize: '0.7rem' }}>Análisis e interacciones</p>
          </div>
        </div>

        <div className="col-6 col-md-3 col-lg">
          <div className="card-premium p-3 d-flex flex-column justify-content-between border-start border-warning border-4">
            <div>
              <h6 className="text-muted small text-uppercase fw-bold mb-1" style={{ fontSize: '0.68rem' }}>Alertas Resueltas</h6>
              <h3 className="fw-bold text-warning mb-0 mt-1" style={{ fontSize: '1.8rem' }}>
                {logsLoading ? <span className="spinner-border spinner-border-sm"></span> : currentAdoptionStats.alertasResueltas}
              </h3>
            </div>
            <p className="text-muted small mb-0 mt-2" style={{ fontSize: '0.7rem' }}>Riesgos mitigados</p>
          </div>
        </div>

        <div className="col-6 col-md-3 col-lg">
          <div className="card-premium p-3 d-flex flex-column justify-content-between border-start border-secondary border-4">
            <div>
              <h6 className="text-muted small text-uppercase fw-bold mb-1" style={{ fontSize: '0.68rem' }}>Acciones Totales</h6>
              <h3 className="fw-bold text-secondary mb-0 mt-1" style={{ fontSize: '1.8rem' }}>
                {logsLoading ? <span className="spinner-border spinner-border-sm"></span> : currentAdoptionStats.logsTotales}
              </h3>
            </div>
            <p className="text-muted small mb-0 mt-2" style={{ fontSize: '0.7rem' }}>Eventos registrados</p>
          </div>
        </div>

        <div className="col-6 col-md-3 col-lg">
          <div className="card-premium p-3 d-flex flex-column justify-content-between border-start border-info border-4">
            <div>
              <h6 className="text-muted small text-uppercase fw-bold mb-1" style={{ fontSize: '0.68rem' }}>Tiempo Activo Total</h6>
              <h3 className="fw-bold text-info mb-0 mt-1" style={{ fontSize: '1.8rem' }}>
                {loadingUso ? <span className="spinner-border spinner-border-sm"></span> : `${connectionStats.totalHours} h`}
              </h3>
            </div>
            <p className="text-muted small mb-0 mt-2" style={{ fontSize: '0.7rem' }}>Conexión acumulada</p>
          </div>
        </div>

        <div className="col-6 col-md-3 col-lg">
          <div className="card-premium p-3 d-flex flex-column justify-content-between border-start border-primary border-4" style={{ borderLeftColor: '#6366f1 !important' }}>
            <div>
              <h6 className="text-muted small text-uppercase fw-bold mb-1" style={{ fontSize: '0.68rem' }}>Promedio Diario</h6>
              <h3 className="fw-bold text-primary mb-0 mt-1" style={{ fontSize: '1.8rem' }}>
                {loadingUso ? <span className="spinner-border spinner-border-sm"></span> : `${connectionStats.avgHoursPerDay} h/día`}
              </h3>
            </div>
            <p className="text-muted small mb-0 mt-2" style={{ fontSize: '0.7rem' }}>Promedio por operador</p>
          </div>
        </div>
      </div>

      {/* Widget Comparativo Mensual (MoM: Mes Actual vs Mes Anterior) */}
      <div className="card-premium p-4 mb-4 border-0 shadow-sm bg-white rounded-4">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h6 className="fw-bold text-dark mb-1">
              <i className="bi bi-arrow-left-right text-primary me-2"></i>Comparativo Mensual de Adopción e Impacto (MoM)
            </h6>
            <span className="small text-muted">
              Estadísticas comparativas entre <strong>{currentMonthLabel}</strong> y <strong>{previousMonthLabel}</strong>
            </span>
          </div>
          <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 fw-bold" style={{ fontSize: '0.75rem' }}>
            {currentMonthLabel} vs {previousMonthLabel}
          </span>
        </div>

        <div className="row g-3">
          {/* Usuarios Activos MoM */}
          <div className="col-12 col-md-6 col-lg-3">
            <div className="p-3 rounded-4 bg-light border">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-bold text-muted">Usuarios Activos</span>
                <span className={`badge ${momStats.var.usersPct.startsWith('+') ? 'bg-success' : 'bg-danger'} rounded-pill`}>
                  {momStats.var.usersPct}
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-baseline">
                <div>
                  <span className="small text-muted me-1" style={{ fontSize: '0.72rem' }}>{currentMonthLabel}:</span>
                  <span className="fs-5 fw-bold text-dark">{momStats.current.users}</span>
                </div>
                <div>
                  <span className="small text-muted me-1" style={{ fontSize: '0.72rem' }}>{previousMonthLabel}:</span>
                  <span className="small fw-bold text-secondary">{momStats.previous.users}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Consultas IA MoM */}
          <div className="col-12 col-md-6 col-lg-3">
            <div className="p-3 rounded-4 bg-light border">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-bold text-muted">Consultas LUXIA IA</span>
                <span className={`badge ${momStats.var.iaPct.startsWith('+') ? 'bg-success' : 'bg-danger'} rounded-pill`}>
                  {momStats.var.iaPct}
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-baseline">
                <div>
                  <span className="small text-muted me-1" style={{ fontSize: '0.72rem' }}>{currentMonthLabel}:</span>
                  <span className="fs-5 fw-bold text-success">{momStats.current.ia}</span>
                </div>
                <div>
                  <span className="small text-muted me-1" style={{ fontSize: '0.72rem' }}>{previousMonthLabel}:</span>
                  <span className="small fw-bold text-secondary">{momStats.previous.ia}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alertas Resueltas MoM */}
          <div className="col-12 col-md-6 col-lg-3">
            <div className="p-3 rounded-4 bg-light border">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-bold text-muted">Alertas Resueltas</span>
                <span className={`badge ${momStats.var.alertsPct.startsWith('+') ? 'bg-success' : 'bg-danger'} rounded-pill`}>
                  {momStats.var.alertsPct}
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-baseline">
                <div>
                  <span className="small text-muted me-1" style={{ fontSize: '0.72rem' }}>{currentMonthLabel}:</span>
                  <span className="fs-5 fw-bold text-warning">{momStats.current.alerts}</span>
                </div>
                <div>
                  <span className="small text-muted me-1" style={{ fontSize: '0.72rem' }}>{previousMonthLabel}:</span>
                  <span className="small fw-bold text-secondary">{momStats.previous.alerts}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tiempo Conexión MoM */}
          <div className="col-12 col-md-6 col-lg-3">
            <div className="p-3 rounded-4 bg-light border">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-bold text-muted">Tiempo Activo Total</span>
                <span className={`badge ${momStats.var.hoursPct.startsWith('+') ? 'bg-success' : 'bg-danger'} rounded-pill`}>
                  {momStats.var.hoursPct}
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-baseline">
                <div>
                  <span className="small text-muted me-1" style={{ fontSize: '0.72rem' }}>{currentMonthLabel}:</span>
                  <span className="fs-5 fw-bold text-info">{momStats.current.hours} h</span>
                </div>
                <div>
                  <span className="small text-muted me-1" style={{ fontSize: '0.72rem' }}>{previousMonthLabel}:</span>
                  <span className="small fw-bold text-secondary">{momStats.previous.hours} h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card-premium h-100 p-4 d-flex flex-column">
            <h6 className="fw-bold text-dark mb-3">
              <i className="bi bi-bar-chart-line text-primary me-2"></i>Interacciones Diarias del Sistema
            </h6>
            <div className="flex-grow-1 position-relative" style={{ minHeight: '280px', height: '280px' }}>
              {logsLoading ? (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                  <div className="spinner-border spinner-border-sm me-2"></div> Cargando historial de uso...
                </div>
              ) : (
                <canvas ref={adoptionChartRef}></canvas>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card-premium h-100 p-4 d-flex flex-column" style={{ maxHeight: '380px' }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <h6 className="fw-bold text-dark mb-0">
                <i className="bi bi-clock-history text-secondary me-2"></i>Actividad en Vivo
              </h6>
              <div className="d-flex gap-2">
                <input
                  type="date"
                  className="form-control form-control-sm border-0 bg-light rounded-pill shadow-xs text-muted fw-bold"
                  style={{ fontSize: '0.75rem', width: '120px' }}
                  value={feedDateFilter}
                  onChange={(e) => setFeedDateFilter(e.target.value)}
                />
                <select 
                  className="form-select form-select-sm border-0 bg-light rounded-pill shadow-xs text-muted fw-bold"
                  style={{ fontSize: '0.75rem', width: '140px' }}
                  value={feedUserFilter}
                  onChange={(e) => setFeedUserFilter(e.target.value)}
                >
                  <option value="">Todos los usuarios</option>
                  {combinedUsers.filter(u => u.count > 0).map(u => (
                    <option key={u.email} value={u.email}>{u.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-grow-1 overflow-auto pe-1" style={{ fontSize: '0.8rem' }}>
              {logsLoading ? (
                <div className="text-center text-muted py-4">Cargando eventos de telemetría...</div>
              ) : (() => {
                const filteredLogs = logs.filter(log => {
                  if (feedUserFilter && log.usuarioEmail !== feedUserFilter) return false;
                  if (feedDateFilter) {
                    const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                    const logDateStr = new Date(logDate.getTime() - logDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                    if (logDateStr !== feedDateFilter) return false;
                  }
                  return true;
                });

                if (filteredLogs.length === 0) {
                  return <div className="text-center text-muted py-4">No hay interacciones que coincidan con los filtros.</div>;
                }

                return filteredLogs.map(log => {
                  const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                  
                  let actionDesc;
                  let actionBadgeColor = 'bg-secondary';
                  
                  if (log.accion === 'trigger_ia') {
                    actionDesc = `analizó la salud de un cliente con LUXIA IA`;
                    actionBadgeColor = 'bg-success';
                  } else if (log.accion === 'resolve_alert') {
                    actionDesc = `resolvió una alerta de riesgo`;
                    actionBadgeColor = 'bg-warning text-dark';
                  } else if (log.accion === 'update_client_status') {
                    actionDesc = `actualizó el estado de un cliente`;
                    actionBadgeColor = 'bg-primary';
                  } else if (log.accion === 'add_interaction') {
                    actionDesc = `registró una nota en bitácora`;
                    actionBadgeColor = 'bg-info';
                  } else if (log.accion === 'update_contract') {
                    actionDesc = `actualizó condiciones de contrato`;
                    actionBadgeColor = 'bg-dark bg-opacity-75';
                  } else if (log.accion === 'complete_exam') {
                    actionDesc = `completó capacitación`;
                    actionBadgeColor = 'bg-info text-dark';
                  } else {
                    actionDesc = `registró la acción "${log.accion || 'desconocida'}"`;
                  }

                  return (
                    <div key={log.id} className="d-flex align-items-start border-bottom py-2 gap-2">
                      <span className={`badge ${actionBadgeColor} rounded-pill font-monospace`} style={{ fontSize: '0.62rem', paddingTop: '0.25em' }}>
                        {(log.accion || 'ACCION').replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <div className="text-muted flex-grow-1" style={{ fontSize: '0.78rem' }}>
                        <strong>{log.usuarioNombre}</strong> {actionDesc}
                      </div>
                      <span className="text-muted font-monospace small" style={{ fontSize: '0.7rem' }}>{timeStr}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <div className="card-premium p-4 d-flex flex-column">
            <h6 className="fw-bold text-dark mb-3">
              <i className="bi bi-people-fill text-primary me-2"></i>Directorio de Usuarios y Actividad
            </h6>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                <thead className="table-light text-muted">
                  <tr>
                    <th className="fw-bold border-0 rounded-start">Usuario</th>
                    <th className="fw-bold border-0 text-center">Último Login</th>
                    <th className="fw-bold border-0 text-center">Tiempo Activo</th>
                    <th className="fw-bold border-0 text-end rounded-end">Acciones (Período)</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedUsers.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center text-muted py-4">No hay datos de usuarios registrados.</td>
                    </tr>
                  ) : (
                    combinedUsers.map((u) => {
                      const lastLoginStr = u.lastLoginAt 
                        ? new Date(u.lastLoginAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                        : 'Nunca';
                        
                      return (
                        <tr key={u.email}>
                          <td className="fw-bold text-dark">
                            <div className="d-flex align-items-center gap-2">
                              <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                {u.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-dark fw-bold">{u.nombre}</div>
                                <div className="text-muted small" style={{ fontSize: '0.7rem' }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-center text-muted">
                            {u.lastLoginAt ? (
                              <><i className="bi bi-clock me-1"></i> {lastLoginStr}</>
                            ) : (
                              <span className="badge bg-light text-muted">Nunca</span>
                            )}
                          </td>
                          <td className="text-center fw-bold text-info">
                            {(() => {
                              const userMinutes = activeUsoLogs
                                .filter(log => {
                                  const logUser = (log.userEmail || '').toLowerCase().trim();
                                  const userEmail = (u.email || '').toLowerCase().trim();
                                  const userUid = (u.uid || '').toLowerCase().trim();
                                  return logUser === userEmail || (userUid && logUser === userUid);
                                })
                                .reduce((acc, log) => acc + (log.minutosConectado || 0), 0);
                              return `${(userMinutes / 60).toFixed(1)} h`;
                            })()}
                          </td>
                          <td className="text-end fw-bold text-primary">{u.count}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
