import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useUserRole } from '../../../contexts/UserRoleContext';
import { useToast } from '../../ui/ToastProvider';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

export function AgentPresenceMonitor({ 
  targetTeam = 'CX', 
  selectedCountry = '', 
  title = 'Monitor de Presencia & Disponibilidad del Turno',
  icon = 'bi-headset',
  showRoutingStatus = true 
}) {
  const { canView, hasPermission, user } = useUserRole();
  const { showAlert } = useToast();
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState(null);

  // Carga de usuarios desde Supabase
  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('usuarios').select('*');
      if (error) throw error;

      const list = (data || []).map(u => {
        const email = (u.email || u.id || '').toLowerCase().trim();
        return {
          uid: u.id,
          id: u.id,
          email,
          nombre: u.nombre && !u.nombre.includes('@') ? u.nombre : email,
          rol: u.rol || 'agente',
          equipo: u.equipo || 'Global',
          pais: u.pais || 'PE',
          activo: u.activo !== false,
          estadoPresencia: u.estado_presencia || 'Conectado',
          estadoCx: u.estado_cx || 'activo',
          presencia: u.presencia || { estado: 'disponible' },
          lastActiveAt: u.updated_at || u.presencia?.desdeIso || null
        };
      }).filter(u => u.email && u.email.includes('@'));

      setUsersList(list);
    } catch (err) {
      console.error('[AgentPresenceMonitor] Error al cargar usuarios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    const interval = setInterval(loadUsers, 30000);
    return () => clearInterval(interval);
  }, [loadUsers]);

  // Helper para determinar el estado efectivo en vivo contemplando inactividad (>15m)
  const getEffectivePresence = (agent) => {
    const lastActiveMs = agent.lastActiveAt ? new Date(agent.lastActiveAt).getTime() : 0;
    const isStale = !lastActiveMs || (Date.now() - lastActiveMs > INACTIVITY_TIMEOUT_MS);

    const stLower = (agent.estadoPresencia || '').toLowerCase();
    const cxLower = (agent.estadoCx || '').toLowerCase();
    const pLower = (agent.presencia?.estado || '').toLowerCase();

    if (stLower === 'en break' || cxLower === 'break' || cxLower === 'lunch' || pLower === 'break') {
      return { key: 'break', isStale, label: '☕ En Break' };
    }
    if (stLower === 'ocupado' || cxLower === 'ocupado' || pLower === 'ocupado') {
      return isStale 
        ? { key: 'offline', isStale: true, label: '⚪ Desconectado' } 
        : { key: 'ocupado', isStale: false, label: '🔴 Ocupado' };
    }
    if (stLower === 'desconectado' || cxLower === 'offline' || pLower === 'offline' || isStale) {
      return { key: 'offline', isStale: true, label: '⚪ Desconectado' };
    }
    return { key: 'disponible', isStale: false, label: '🟢 Conectado' };
  };

  const userEmail = user?.email;

  // Filtrar usuarios por equipo y país seleccionados
  const filteredAgents = useMemo(() => {
    const isRestrictedAgent = !canView('monitoreo_presencia') && userEmail;

    return usersList.filter(u => {
      if (!u.activo) return false;

      if (isRestrictedAgent && u.email !== userEmail.toLowerCase().trim()) {
        return false;
      }

      if (selectedCountry && selectedCountry !== 'ALL' && selectedCountry !== '') {
        if (u.pais?.toUpperCase() !== selectedCountry.toUpperCase()) return false;
      }

      const teamLower = (u.equipo || '').toLowerCase().trim();
      const roleLower = (u.rol || '').toLowerCase().trim();

      if (targetTeam === 'Adquisicion') {
        const isAdqTeam = teamLower.includes('adquisicion') || teamLower.includes('hunting') || teamLower === 'ventas';
        const isCommRole = roleLower === 'agente' || roleLower === 'supervisor' || roleLower === 'admin' || roleLower === 'editor';
        return (isAdqTeam || teamLower === 'global') && isCommRole;
      } else if (targetTeam === 'Retencion') {
        const isRetTeam = teamLower.includes('retencion') || teamLower.includes('farming') || teamLower.includes('cuenta');
        const isCommRole = roleLower === 'agente' || roleLower === 'supervisor' || roleLower === 'admin' || roleLower === 'editor';
        return (isRetTeam || teamLower === 'global') && isCommRole;
      }

      return true;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [usersList, targetTeam, selectedCountry, canView, userEmail]);

  // Contadores de presencia usando getEffectivePresence
  const presenceCounts = useMemo(() => {
    let conectados = 0;
    let enBreak = 0;
    let ocupados = 0;
    let desconectados = 0;

    filteredAgents.forEach(a => {
      const eff = getEffectivePresence(a);
      if (eff.key === 'break') enBreak++;
      else if (eff.key === 'ocupado') ocupados++;
      else if (eff.key === 'offline') desconectados++;
      else conectados++;
    });

    return { conectados, enBreak, ocupados, desconectados, total: filteredAgents.length };
  }, [filteredAgents]);

  // Helper para calcular tiempo desde última actividad
  const getTimeInStatus = (lastActiveAt) => {
    if (!lastActiveAt) return 'Sin actividad';
    const timeMs = new Date(lastActiveAt).getTime();
    if (isNaN(timeMs)) return 'Sin actividad';

    const diffMin = Math.floor((Date.now() - timeMs) / 60000);
    if (diffMin < 1) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const hrs = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hrs < 24) return `Hace ${hrs}h ${mins}m`;
    const dias = Math.floor(hrs / 24);
    return `Hace ${dias}d (${hrs}h)`;
  };

  // Cambio de estado de un agente por el Supervisor
  const handleSupervisorChangeStatus = async (agentUid, agentName, newStatus) => {
    const isAllowed = hasPermission('actions', 'editar_estado_presencia');
    if (!isAllowed) {
      showAlert('Solo los supervisores o administradores pueden ajustar el estado de los agentes.', 'warning');
      return;
    }

    setUpdatingUid(agentUid);
    const mapStatus = {
      disponible: { presencia: 'Conectado', cx: 'activo', std: 'disponible' },
      break: { presencia: 'En Break', cx: 'break', std: 'break' },
      ocupado: { presencia: 'Ocupado', cx: 'ocupado', std: 'ocupado' },
      offline: { presencia: 'Desconectado', cx: 'offline', std: 'offline' }
    };
    const target = mapStatus[newStatus] || mapStatus.disponible;
    const nowIso = new Date().toISOString();

    try {
      await supabase.from('usuarios').update({
        estado_presencia: target.presencia,
        estado_cx: target.cx,
        presencia: { estado: target.std, desdeIso: nowIso, desdeMs: Date.now() },
        updated_at: nowIso
      }).eq('id', agentUid);

      showAlert(`Estado de ${agentName} cambiado a "${target.presencia}".`, 'success');
      loadUsers();
    } catch (err) {
      console.error('[AgentPresenceMonitor] Error actualizando estado:', err);
      showAlert('Error al actualizar el estado del agente.', 'danger');
    } finally {
      setUpdatingUid(null);
    }
  };

  // Helper para generar estilo de select / badge con alto contraste sin recorte de texto
  const getSelectStyle = (key) => {
    switch (key) {
      case 'disponible':
        return {
          backgroundColor: '#198754',
          color: '#ffffff',
          fontWeight: '700',
          border: '1.5px solid #146c43'
        };
      case 'break':
        return {
          backgroundColor: '#ffc107',
          color: '#000000',
          fontWeight: '700',
          border: '1.5px solid #ffcd39'
        };
      case 'ocupado':
        return {
          backgroundColor: '#dc3545',
          color: '#ffffff',
          fontWeight: '700',
          border: '1.5px solid #b02a37'
        };
      case 'offline':
      default:
        return {
          backgroundColor: '#495057',
          color: '#ffffff',
          fontWeight: '700',
          border: '1.5px solid #343a40'
        };
    }
  };

  return (
    <div className="card-premium p-4 mb-4 border-start border-primary border-4 shadow-sm bg-white">
      {/* Header con Título y Contadores Resumen */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <div className="p-2.5 rounded-circle bg-primary bg-opacity-10 text-primary">
            <i className={`bi ${icon} fs-5`}></i>
          </div>
          <div>
            <h6 className="fw-bold text-dark mb-0 font-outfit">{title}</h6>
            <span className="text-muted extra-small">Monitoreo reactivo con timeout automático de inactividad (15 min)</span>
          </div>
        </div>

        {/* Badges de Contadores */}
        <div className="d-flex align-items-center gap-1.5 flex-wrap">
          <span className="badge rounded-pill bg-success text-white px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.75rem' }}>
            <span className="rounded-circle d-inline-block bg-white me-1.5" style={{ width: '7px', height: '7px' }}></span>
            {presenceCounts.conectados} Disponibles
          </span>
          <span className="badge rounded-pill bg-warning text-dark px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.75rem' }}>
            <i className="bi bi-cup-hot-fill text-dark me-1"></i>
            {presenceCounts.enBreak} En Break
          </span>
          <span className="badge rounded-pill bg-danger text-white px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.75rem' }}>
            <span className="rounded-circle d-inline-block bg-white me-1.5" style={{ width: '7px', height: '7px' }}></span>
            {presenceCounts.ocupados} Ocupados
          </span>
          <span className="badge rounded-pill bg-secondary text-white px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.75rem' }}>
            <span className="rounded-circle d-inline-block bg-white me-1.5" style={{ width: '7px', height: '7px' }}></span>
            {presenceCounts.desconectados} Desconectados / Inactivos
          </span>
        </div>
      </div>

      {/* Tabla de Agentes y Estados */}
      {loading ? (
        <div className="p-4 text-center text-muted small">
          <span className="spinner-border spinner-border-sm me-2 text-primary" role="status"></span>
          Cargando disponibilidad del equipo en tiempo real...
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="p-3 text-center text-muted small">
          No hay colaboradores registrados para este equipo en el filtro actual.
        </div>
      ) : (
        <div className="table-responsive" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
            <thead className="table-light text-uppercase text-muted extra-small">
              <tr>
                <th style={{ width: '30%' }}>Colaborador / Agente</th>
                <th style={{ width: '18%' }}>Equipo & País</th>
                <th style={{ width: '22%' }}>Estado de Presencia</th>
                <th style={{ width: '15%' }}>Última Actividad</th>
                {showRoutingStatus && <th style={{ width: '15%' }} className="text-end">Ruteo Inbound</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map(a => {
                const eff = getEffectivePresence(a);
                const canEditThisAgent = hasPermission('actions', 'editar_estado_presencia') && updatingUid !== a.uid;

                return (
                  <tr key={a.uid}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="avatar-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center rounded-circle" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
                          {a.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="fw-bold text-dark text-truncate">{a.nombre}</div>
                          <div className="text-muted extra-small text-truncate">{a.email}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge bg-light text-dark border me-1 font-monospace" style={{ fontSize: '0.65rem' }}>{a.pais}</span>
                      <span className="text-muted small">{a.equipo}</span>
                    </td>

                    <td>
                      {canEditThisAgent ? (
                        <select
                          className="form-select form-select-sm rounded-3 fw-bold shadow-sm"
                          style={{ 
                            fontSize: '0.78rem', 
                            paddingTop: '5px',
                            paddingBottom: '5px',
                            paddingLeft: '10px',
                            paddingRight: '26px',
                            minWidth: '150px', 
                            lineHeight: '1.2',
                            cursor: 'pointer',
                            ...getSelectStyle(eff.key) 
                          }}
                          value={eff.key}
                          onChange={(e) => handleSupervisorChangeStatus(a.uid, a.nombre, e.target.value)}
                        >
                          <option value="disponible" style={{ backgroundColor: '#212529', color: '#ffffff' }}>🟢 Conectado</option>
                          <option value="break" style={{ backgroundColor: '#212529', color: '#ffffff' }}>☕ En Break</option>
                          <option value="ocupado" style={{ backgroundColor: '#212529', color: '#ffffff' }}>🔴 Ocupado</option>
                          <option value="offline" style={{ backgroundColor: '#212529', color: '#ffffff' }}>⚪ Desconectado</option>
                        </select>
                      ) : (
                        <span 
                          className="badge rounded-3 border px-2.5 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5" 
                          style={{ fontSize: '0.75rem', lineHeight: '1.2', whiteSpace: 'nowrap', ...getSelectStyle(eff.key) }}
                        >
                          {eff.label}
                        </span>
                      )}
                    </td>

                    <td>
                      <span className={`small ${eff.isStale ? 'text-danger fw-bold' : 'text-muted'}`}>
                        {getTimeInStatus(a.lastActiveAt)}
                        {eff.isStale && <i className="bi bi-clock-history ms-1 text-danger" title="Inactivo más de 15 minutos"></i>}
                      </span>
                    </td>

                    {showRoutingStatus && (
                      <td className="text-end">
                        {!eff.isStale && (eff.key === 'disponible' || eff.key === 'ocupado') ? (
                          <span className="badge bg-success bg-opacity-10 text-success rounded-pill extra-small fw-bold px-2 py-1 border border-success border-opacity-25">
                            <i className="bi bi-check-circle-fill me-1"></i> Elegible
                          </span>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-10 text-secondary rounded-pill extra-small fw-bold px-2 py-1 border border-secondary border-opacity-25">
                            <i className="bi bi-slash-circle me-1"></i> Pausado (Inactivo)
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
