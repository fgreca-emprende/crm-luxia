import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { ConfirmModal } from './admin/ConfirmModal';

export function ClienteTimeline({ clienteId, leadId, oportunidadId, iaPausada }) {
  const [interacciones, setInteracciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevaNota, setNuevaNota] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Filtros
  const [timeFilter, setTimeFilter] = useState('todo'); // '7d', '30d', 'mes', 'todo'
  const [eventTypeFilter, setEventTypeFilter] = useState('todos');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { showAlert } = useToast();
  const { isAdmin, isLector, user } = useUserRole();

  const loadMore = () => {
    // Interacciones cargadas por bloque
    setHasMore(false);
  };

  const handleToggleCrmSubtask = async (activityId, subtaskId, currentStatus) => {
    setInteracciones(prev => prev.map(item => {
      if (item.id === activityId && Array.isArray(item.tareas)) {
        return {
          ...item,
          tareas: item.tareas.map(t => t.id === subtaskId ? { ...t, completada: !currentStatus } : t)
        };
      }
      return item;
    }));
  };
  const [deleteConfirmState, setDeleteConfirmState] = useState({
    show: false,
    interactionId: null
  });

  const handleDeleteNota = (id) => {
    setDeleteConfirmState({
      show: true,
      interactionId: id
    });
  };

  const executeDeleteNota = async () => {
    const id = deleteConfirmState.interactionId;
    if (!id) return;
    
    setSaving(true);
    setDeleteConfirmState({ show: false, interactionId: null });
    try {
      const { error } = await supabase.from('interacciones').delete().eq('id', id);
      if (error) throw error;
      setInteracciones(prev => prev.filter(i => i.id !== id));
      showAlert('Nota eliminada de la bitácora', 'success');
    } catch (error) {
      console.error("Error al eliminar nota:", error);
      showAlert(`Error al eliminar: ${error.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const loadInteracciones = useCallback(async () => {
    if (!clienteId && !leadId && !oportunidadId) {
      setInteracciones([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase.from('interacciones').select('*');

      if (clienteId) query = query.eq('cliente_id', clienteId);
      else if (leadId) query = query.eq('lead_id', leadId);
      else if (oportunidadId) query = query.eq('oportunidad_id', oportunidadId);

      if (eventTypeFilter !== 'todos') {
        query = query.eq('tipo', eventTypeFilter);
      }

      if (timeFilter !== 'todo') {
        const now = new Date();
        let startDate = new Date();
        if (timeFilter === '7d') startDate.setDate(now.getDate() - 7);
        else if (timeFilter === '30d') startDate.setDate(now.getDate() - 30);
        else if (timeFilter === 'mes') startDate.setDate(1);
        query = query.gte('timestamp', startDate.toISOString());
      }

      query = query.order('timestamp', { ascending: false }).limit(50);

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map(d => ({
        id: d.id,
        tipo: d.tipo,
        descripcion: d.descripcion,
        autor: d.autor,
        timestamp: d.timestamp,
        clienteId: d.cliente_id,
        leadId: d.lead_id,
        oportunidadId: d.oportunidad_id,
        ...d
      }));

      setInteracciones(mapped);
    } catch (err) {
      console.error("Error cargando interacciones:", err);
      showAlert(`Error cargando bitácora: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [clienteId, leadId, oportunidadId, eventTypeFilter, timeFilter, showAlert]);

  useEffect(() => {
    loadInteracciones();
  }, [loadInteracciones]);

  const uniqueInteracciones = interacciones;

  const handleAddNota = async (e) => {
    e.preventDefault();
    if (!nuevaNota.trim()) return;

    setSaving(true);
    try {
      const targetDoc = {
        cliente_id: clienteId || null,
        lead_id: leadId || null,
        oportunidad_id: oportunidadId || null,
        tipo: 'nota_manual',
        descripcion: nuevaNota.trim(),
        autor: user?.email || 'admin@luxia.com'
      };

      const { data, error } = await supabase.from('interacciones').insert(targetDoc).select();
      if (error) throw error;

      if (data && data[0]) {
        setInteracciones(prev => [data[0], ...prev]);
      }

      setNuevaNota('');
      showAlert('Nota añadida a la bitácora', 'success');
    } catch (error) {
      console.error("Error al guardar nota manual:", error);
      showAlert(`Error al guardar: ${error.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary spinner-border-sm" role="status"></div>
        <div className="text-muted small mt-2">Cargando bitácora cronológica...</div>
      </div>
    );
  }

  return (
    <div className="timeline-container mt-2">
      {iaPausada && (
        <div className="alert alert-warning py-2.5 px-3 rounded-4 mb-3 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center gap-2" style={{ fontSize: '0.72rem' }}>
          <i className="bi bi-robot fs-5 text-warning animate-pulse"></i>
          <div className="text-start">
            <strong>LUXIA IA Detenido:</strong> Las auditorías automáticas y el análisis de salud están temporalmente suspendidos por el administrador corporativo.
          </div>
        </div>
      )}
      {/* Formulario de Nueva Nota */}
      <div className="card bg-light border-0 shadow-sm mb-4 rounded-4">
        <div className="card-body p-3">
          <h6 className="fw-bold text-dark mb-2">
            <i className="bi bi-chat-right-quote-fill text-primary me-2"></i>Registrar Nota en Bitácora
          </h6>
          <form onSubmit={handleAddNota}>
            <div className="mb-2">
              <textarea 
                className="form-control form-control-sm" 
                rows="2" 
                placeholder="Escribe detalles de reuniones, llamadas o compromisos operativos acordados con el cliente..."
                value={nuevaNota}
                onChange={e => setNuevaNota(e.target.value)}
                required
                disabled={saving}
              ></textarea>
            </div>
            <div className="text-end">
              <button 
                type="submit" 
                className="btn btn-sm btn-primary rounded-pill px-3 fw-bold shadow-sm"
                disabled={saving || !nuevaNota.trim() || isLector}
                title={isLector ? "Permiso denegado (Rol Lector)" : ""}
              >
                {saving ? 'Guardando...' : 'Guardar Nota'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Cabecera, Filtros y Feed Cronológico */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h6 className="fw-bold text-dark mb-0"><i className="bi bi-clock-history me-2 text-secondary"></i>Historial del Ciclo de Vida</h6>
        
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Pill Buttons para Fechas */}
          <div className="btn-group bg-light rounded-pill p-1 shadow-sm border" role="group">
            <button 
              type="button" 
              className={`btn btn-sm rounded-pill px-3 py-1 fw-bold ${timeFilter === 'todo' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => setTimeFilter('todo')}
            >
              Todo
            </button>
            <button 
              type="button" 
              className={`btn btn-sm rounded-pill px-3 py-1 fw-bold ${timeFilter === '30d' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => setTimeFilter('30d')}
            >
              30d
            </button>
            <button 
              type="button" 
              className={`btn btn-sm rounded-pill px-3 py-1 fw-bold ${timeFilter === '7d' ? 'btn-primary text-white' : 'btn-light text-muted'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => setTimeFilter('7d')}
            >
              7d
            </button>
          </div>

          {/* Dropdown para Tipo de Evento */}
          <select 
            className="form-select form-select-sm bg-white border rounded-pill shadow-sm text-dark fw-bold" 
            style={{ width: '160px', fontSize: '0.75rem', cursor: 'pointer' }}
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
          >
            <option value="todos">Todos los eventos</option>
            <option value="nota_manual">Notas Manuales</option>
            <option value="cambio_estado">Cambios de Estado</option>
            <option value="email">Mail</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="alerta_resuelta">Alertas Resueltas</option>
            <option value="analisis_ia">Análisis IA</option>
            <option value="contrato_actualizado">Contratos</option>
            <option value="cambio_comercial">Cambio Comercial</option>
            <option value="actividad_crm">Actividades CRM (Tablero)</option>
          </select>
        </div>
      </div>
      
      {uniqueInteracciones.length === 0 ? (
        <div className="text-center py-4 text-muted bg-light rounded-4 small border">
          No hay eventos registrados bajo estos filtros.
        </div>
      ) : (
        <div className="position-relative ps-4 border-start border-2 border-secondary border-opacity-10 d-flex flex-column gap-3" style={{ marginLeft: '10px' }}>
          {uniqueInteracciones.map(item => {
            let iconClass = 'bi-chat-left-text text-primary';
            let borderStyle = 'border-primary';
            let iconStyle = {};

            if (item.tipo === 'cambio_estado') {
              iconClass = 'bi-arrow-left-right text-warning';
              borderStyle = 'border-warning';
            } else if (item.tipo === 'analisis_ia') {
              iconClass = 'bi-robot text-success';
              borderStyle = 'border-success';
            } else if (item.tipo === 'contrato_actualizado') {
              iconClass = 'bi-file-earmark-check text-info';
              borderStyle = 'border-info';
            } else if (item.tipo === 'onboarding_paso') {
              iconClass = 'bi-patch-check text-primary';
              borderStyle = 'border-primary';
            } else if (item.tipo === 'alerta_resuelta') {
              iconClass = 'bi-shield-check text-success';
              borderStyle = 'border-success';
            } else if (item.tipo === 'cambio_comercial') {
              iconClass = 'bi-person-gear text-dark';
              borderStyle = 'border-dark';
            } else if (item.tipo === 'email') {
              iconClass = 'bi-envelope text-info';
              borderStyle = 'border-info';
            } else if (item.tipo === 'grabacion_meet') {
              iconClass = 'bi-camera-video-fill text-danger';
              borderStyle = 'border-danger';
            } else if (item.tipo === 'actividad_crm') {
              iconClass = 'bi-kanban-fill';
              borderStyle = 'border-indigo';
              iconStyle = { color: '#6610f2' };
            }

            const fechaText = item.timestamp
              ? item.timestamp.toDate
                ? item.timestamp.toDate().toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : new Date(item.timestamp).toLocaleString()
              : 'Reciente';

            return (
              <div key={item.id} className="position-relative">
                {/* Círculo indicador flotante en la línea */}
                <div 
                  className={`position-absolute rounded-circle d-flex align-items-center justify-content-center bg-white border border-2 ${borderStyle} shadow-sm`}
                  style={{
                    left: '-32px',
                    top: '2px',
                    width: '24px',
                    height: '24px',
                    zIndex: 2
                  }}
                >
                  <i className={`bi ${iconClass.split(' ')[0]} small`} style={{ fontSize: '0.75rem', ...iconStyle }}></i>
                </div>

                {/* Tarjeta de Contenido adaptativa */}
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-light bg-opacity-30">
                  <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                    <span className="small text-muted" style={{ fontSize: '0.70rem' }}>
                      <i className="bi bi-person-circle me-1"></i> {item.autor}
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-light text-dark border small fw-normal">
                        <i className="bi bi-clock me-1"></i> {fechaText}
                      </span>
                      {item.tipo === 'nota_manual' && (item.autor === user?.email || isAdmin) && (
                        <button
                           type="button"
                           className="btn btn-link text-danger p-0 border-0 d-flex align-items-center"
                           onClick={() => handleDeleteNota(item.id)}
                           title={isLector ? "Permiso denegado (Rol Lector)" : "Eliminar esta nota de la bitácora"}
                           disabled={saving || isLector}
                        >
                           <i className="bi bi-trash fs-6"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  {item.aiStatus === 'no_analizado' && (
                    <div className="mb-2">
                      <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill px-2 py-1" style={{ fontSize: '0.65rem' }}>
                        <i className="bi bi-robot me-1"></i>No Analizado por LUXIA IA
                      </span>
                    </div>
                  )}
                  {item.tipo === 'grabacion_meet' ? (
                    <MeetTimelineCard item={item} isLector={isLector} />
                  ) : item.tipo === 'actividad_crm' ? (
                    <CrmActivityTimelineCard item={item} onToggleSubtask={handleToggleCrmSubtask} />
                  ) : (
                    <p className="small mb-0 text-dark" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                      {item.descripcion}
                    </p>
                  )}
                  {item.adjuntos && item.adjuntos.length > 0 && (
                    <div className="mt-2 pt-2 border-top border-light-subtle d-flex flex-wrap gap-2">
                      {item.adjuntos.map((adj, idx) => (
                        <a 
                          key={idx} 
                          href={adj.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-xs btn-outline-primary rounded-pill d-inline-flex align-items-center gap-1 py-1 px-2 text-decoration-none shadow-sm bg-white"
                          style={{ fontSize: '0.68rem', transition: 'all 0.2s ease-in-out' }}
                        >
                          <i className="bi bi-paperclip"></i>
                          <span>{adj.nombre || `Adjunto ${idx + 1}`}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {hasMore && (
            <div className="text-center mt-3 pt-2">
              <button 
                type="button" 
                className="btn btn-xs btn-outline-secondary rounded-pill px-4 fw-bold shadow-sm"
                style={{ fontSize: '0.72rem' }}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Cargando...' : 'Cargar más interacciones'}
              </button>
            </div>
          )}
        </div>
      )}
      <ConfirmModal
        show={deleteConfirmState.show}
        title="Confirmar Eliminación"
        message="¿Estás seguro de que deseas eliminar esta nota de la bitácora? Esta acción no se puede deshacer y reactivará el análisis de salud del cliente."
        confirmBtnClass="btn-danger"
        confirmText="Eliminar Nota"
        onConfirm={executeDeleteNota}
        onClose={() => setDeleteConfirmState({ show: false, interactionId: null })}
      />
    </div>
  );
}

function MeetTimelineCard({ item, isLector }) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [showVideo, setShowVideo] = useState(false);

  const details = item.detalles || {};
  const analysis = details.luxia_iaAnalysis || {};
  const health = analysis.healthScore || {};
  const entries = details.dialogEntries || [];

  useEffect(() => {
    if (details.tasks || details.tareas) {
      setTasks(details.tasks || details.tareas || []);
    }
  }, [details]);

  const handleToggleTask = (taskId, currentVal) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completada: !currentVal } : t));
  };

  const filteredEntries = entries.filter(e => 
    e.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.speaker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="meet-card mt-2">
      {/* Video Player */}
      {details.driveFileId ? (
        showVideo ? (
          <div className="ratio ratio-16x9 rounded-4 overflow-hidden mb-3 border shadow-sm animate-fade-in" style={{ maxHeight: '280px', minHeight: '180px' }}>
            <iframe 
              src={`https://drive.google.com/file/d/${details.driveFileId}/preview`} 
              allow="autoplay" 
              className="w-100 h-100" 
              title="Google Meet Recording"
              style={{ border: 'none' }}
            ></iframe>
          </div>
        ) : (
          <div 
            className="ratio ratio-16x9 rounded-4 overflow-hidden mb-3 border shadow-sm bg-dark d-flex align-items-center justify-content-center text-white cursor-pointer position-relative hover-opacity animate-fade-in" 
            style={{ maxHeight: '280px', minHeight: '180px' }}
            onClick={() => setShowVideo(true)}
          >
            <div className="text-center p-4 my-auto">
              <i className="bi bi-play-circle-fill text-primary display-4 d-block mb-2 animate-pulse"></i>
              <span className="fw-bold fs-6">Ver Grabación de Meet</span>
              <p className="text-white-50 small mb-0 mt-1" style={{ fontSize: '0.7rem' }}>Haz clic para cargar el reproductor de Google Drive</p>
            </div>
          </div>
        )
      ) : details.estadoGrabacion === 'purgado_drive' ? (
        <div className="alert alert-secondary py-3 px-3 rounded-4 mb-3 border text-center small bg-light animate-fade-in">
          <i className="bi bi-trash3 text-muted fs-4 d-block mb-1"></i>
          <span className="fw-bold text-dark d-block">Video Purgado Automáticamente</span>
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>El archivo multimedia fue eliminado de Drive para ahorrar espacio. La transcripción y el resumen permanecen guardados.</span>
        </div>
      ) : (
        <div className="alert alert-light py-3 px-3 rounded-4 mb-3 border text-center small">
          <i className="bi bi-camera-video-off text-muted fs-4 d-block mb-1"></i>
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>Archivo de video no disponible o en procesamiento.</span>
        </div>
      )}

      {/* Badges */}
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3 animate-fade-in">
        <span className={`badge rounded-pill px-2.5 py-1 small border ${
          health.sentimiento === 'POSITIVO' ? 'bg-success bg-opacity-10 text-success border-success border-opacity-25' :
          health.sentimiento === 'NEGATIVO' ? 'bg-danger bg-opacity-10 text-danger border-danger border-opacity-25' :
          'bg-warning bg-opacity-10 text-warning border-warning border-opacity-25'
        }`}>
          <i className="bi bi-emoji-smile me-1.5"></i>
          Sentimiento: {health.sentimiento || 'NEUTRAL'}
        </span>
        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2.5 py-1 small">
          <i className="bi bi-heart-pulse me-1.5"></i>
          Score de Relación: {health.score || 70}/100
        </span>
      </div>

      {/* Tabs Menu */}
      <ul className="nav nav-pills gap-1 bg-light p-1 rounded-3 mb-3 border shadow-xs" style={{ width: 'fit-content' }}>
        <li className="nav-item">
          <button 
            type="button"
            className={`btn btn-xs rounded-pill px-3 py-1 fw-bold border-0 ${activeTab === 'resumen' ? 'btn-primary text-white shadow-xs' : 'text-muted bg-transparent'}`}
            style={{ fontSize: '0.7rem' }}
            onClick={() => setActiveTab('resumen')}
          >
            <i className="bi bi-list-ul me-1"></i>Resumen IA
          </button>
        </li>
        <li className="nav-item">
          <button 
            type="button"
            className={`btn btn-xs rounded-pill px-3 py-1 fw-bold border-0 ${activeTab === 'tareas' ? 'btn-primary text-white shadow-xs' : 'text-muted bg-transparent'}`}
            style={{ fontSize: '0.7rem' }}
            onClick={() => setActiveTab('tareas')}
          >
            <i className="bi bi-check2-square me-1"></i>Accionables ({tasks.length})
          </button>
        </li>
        <li className="nav-item">
          <button 
            type="button"
            className={`btn btn-xs rounded-pill px-3 py-1 fw-bold border-0 ${activeTab === 'transcripcion' ? 'btn-primary text-white shadow-xs' : 'text-muted bg-transparent'}`}
            style={{ fontSize: '0.7rem' }}
            onClick={() => setActiveTab('transcripcion')}
          >
            <i className="bi bi-body-text me-1"></i>Transcripción
          </button>
        </li>
      </ul>

      {/* Tabs Content */}
      <div className="tab-content border-top pt-2 mt-1">
        {activeTab === 'resumen' && (
          <div className="text-dark small animate-fade-in" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
            {analysis.resumen}
          </div>
        )}

        {activeTab === 'tareas' && (
          <div className="d-flex flex-column gap-2 animate-fade-in">
            {tasks.length === 0 ? (
              <span className="text-muted small py-2">No se registraron accionables o tareas en esta reunión.</span>
            ) : (
              tasks.map(t => (
                <div key={t.id} className="form-check d-flex align-items-center gap-2 ps-0 border-bottom border-light pb-2 mb-1">
                  <input 
                    className="form-check-input mt-0.5 cursor-pointer" 
                    type="checkbox" 
                    id={`task-${t.id}`}
                    checked={t.completada} 
                    onChange={() => handleToggleTask(t.id, t.completada)} 
                    disabled={isLector}
                  />
                  <label className={`form-check-label small cursor-pointer flex-fill mb-0 ${t.completada ? 'text-decoration-line-through text-muted' : 'text-dark'}`} htmlFor={`task-${t.id}`}>
                    {t.descripcion} <span className="text-muted" style={{ fontSize: '0.65rem' }}>(Asignado a: {t.asignadoA})</span>
                  </label>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'transcripcion' && (
          <div className="animate-fade-in">
            <div className="input-group input-group-sm mb-3 shadow-xs rounded-3 overflow-hidden">
              <span className="input-group-text bg-white border"><i className="bi bi-search text-muted"></i></span>
              <input 
                type="text" 
                className="form-control border" 
                placeholder="Buscar en la transcripción..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="d-flex flex-column gap-2 overflow-auto ps-1" style={{ maxHeight: '200px' }}>
              {filteredEntries.length === 0 ? (
                <span className="text-muted small text-center py-3">No hay entradas coincidentes.</span>
              ) : (
                filteredEntries.map((entry, idx) => (
                  <div key={idx} className="p-2 rounded-3 bg-light bg-opacity-50 small border-start border-3 border-secondary">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="fw-bold text-dark" style={{ fontSize: '0.72rem' }}>
                        <i className="bi bi-person-circle text-muted me-1.5"></i>
                        {entry.speaker}
                      </span>
                      <span className="text-muted font-monospace" style={{ fontSize: '0.65rem' }}>
                        {entry.offsetSeconds !== undefined ? `${Math.floor(entry.offsetSeconds / 60)}:${String(entry.offsetSeconds % 60).padStart(2, '0')}` : '00:00'}
                      </span>
                    </div>
                    <p className="mb-0 text-muted" style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                      {entry.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CrmActivityTimelineCard({ item, onToggleSubtask }) {
  const [showTasks, setShowTasks] = useState(true);

  const completedTasks = item.tareas.filter(t => t.completada).length;
  const totalTasks = item.tareas.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const fechaVencimiento = item.fechaFin
    ? item.fechaFin.toDate
      ? item.fechaFin.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      : new Date(item.fechaFin).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="crm-activity-card mt-1">
      <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <span className="fw-bold text-dark fs-6">{item.titulo}</span>
        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2 py-0.5 small" style={{ fontSize: '0.68rem' }}>
          Tablero CRM: {item.estado ? item.estado.charAt(0).toUpperCase() + item.estado.slice(1) : 'Pendiente'}
        </span>
        {fechaVencimiento && (
          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-2 py-0.5 small" style={{ fontSize: '0.68rem' }}>
            <i className="bi bi-calendar-event me-1"></i>Vence: {fechaVencimiento}
          </span>
        )}
      </div>

      {item.descripcion && (
        <p className="small text-muted mb-3" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
          {item.descripcion}
        </p>
      )}

      {totalTasks > 0 && (
        <div className="bg-white p-2.5 rounded-3 border border-light-subtle shadow-xs mb-2">
          <div className="d-flex justify-content-between align-items-center mb-1.5 cursor-pointer" onClick={() => setShowTasks(!showTasks)}>
            <span className="small fw-bold text-dark d-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
              <i className={`bi ${showTasks ? 'bi-chevron-down' : 'bi-chevron-right'} text-muted`}></i>
              Checklist de Tareas ({completedTasks}/{totalTasks})
            </span>
            <span className="small text-muted font-monospace" style={{ fontSize: '0.68rem' }}>{progressPercent}%</span>
          </div>

          <div className="progress mb-2" style={{ height: '4px' }}>
            <div 
              className={`progress-bar ${progressPercent === 100 ? 'bg-success' : 'bg-primary'}`}
              role="progressbar" 
              style={{ width: `${progressPercent}%` }}
              aria-valuenow={progressPercent} 
              aria-valuemin="0" 
              aria-valuemax="100"
            ></div>
          </div>

          {showTasks && (
            <div className="d-flex flex-column gap-1.5 mt-2 ps-1">
              {item.tareas.map(t => (
                <div key={t.id} className="form-check d-flex align-items-center gap-2 ps-0 border-bottom border-light pb-1.5 mb-0" style={{ minHeight: 'auto' }}>
                  <input 
                    className="form-check-input mt-0.5 cursor-pointer" 
                    type="checkbox" 
                    id={`subtask-${t.id}`}
                    checked={t.completada} 
                    onChange={() => onToggleSubtask(item.id, t.id, t.completada)} 
                  />
                  <label className={`form-check-label small cursor-pointer flex-fill mb-0 ${t.completada ? 'text-decoration-line-through text-muted' : 'text-dark'}`} htmlFor={`subtask-${t.id}`} style={{ fontSize: '0.72rem' }}>
                    {t.titulo}
                    {t.responsableEmail && (
                      <span className="text-muted ms-1.5" style={{ fontSize: '0.65rem' }}>({t.responsableEmail})</span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {item.responsableEmail && (
        <div className="text-end">
          <span className="small text-muted" style={{ fontSize: '0.65rem' }}>
            <i className="bi bi-person-fill-check me-1"></i>Responsable: {item.responsableEmail}
          </span>
        </div>
      )}
    </div>
  );
}
