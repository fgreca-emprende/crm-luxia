import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';
import { dbTracker } from '../../../lib/api';

export function ObservabilityConfigPanel({ user }) {
  const [uptimeConfig, setUptimeConfig] = useState({ frecuenciaEscaneo: 5, ventanaMetricasGcp: 1 });
  const [deleteLogs, setDeleteLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingUptime, setSavingUptime] = useState(false);
  const [stats, setStats] = useState({ reads: 0, writes: 0 });
  const { showAlert } = useToast();

  useEffect(() => {
    const fetchAuditLogs = async () => {
      setLoadingLogs(true);
      try {
        const { data, error } = await supabase
          .from('logs_sistema')
          .select('*')
          .in('accion', ['delete_lead', 'delete_oportunidad', 'delete_client_cascade', 'delete_ticket'])
          .order('timestamp', { ascending: false })
          .limit(50);
        if (error) throw error;
        setDeleteLogs(data || []);
      } catch (err) {
        console.warn("Error loading audit logs:", err);
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    setStats(dbTracker.getStats());
    const handleUpdate = () => {
      setStats(dbTracker.getStats());
    };
    window.addEventListener('firestore-stats-updated', handleUpdate);
    return () => {
      window.removeEventListener('firestore-stats-updated', handleUpdate);
    };
  }, []);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigGeneral('uptime_config');
      if (data) {
        setUptimeConfig(data);
      } else {
        const defaultUptimeConfig = { frecuenciaEscaneo: 5, ventanaMetricasGcp: 1 };
        await setConfigGeneral('uptime_config', defaultUptimeConfig);
        setUptimeConfig(defaultUptimeConfig);
      }
    } catch (err) {
      showAlert(`Error cargando configuración: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleSaveUptime = async (e) => {
    e.preventDefault();
    setSavingUptime(true);
    try {
      await setConfigGeneral('uptime_config', uptimeConfig);
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'uptime_observabilidad',
        frecuenciaEscaneo: uptimeConfig.frecuenciaEscaneo,
        ventanaMetricasGcp: uptimeConfig.ventanaMetricasGcp
      });
      showAlert('Configuración de Monitoreo e Infraestructura IT guardada con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar: ${err.message}`, 'danger');
    } finally {
      setSavingUptime(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <span className="spinner-border spinner-border-sm me-2"></span>Cargando configuraciones de observabilidad...
      </div>
    );
  }

  return (
    <div className="card border-0 bg-white p-4 rounded-4 shadow-sm" style={{ border: '1px solid #eef2f6' }}>
      <div className="d-flex align-items-center gap-3 mb-2">
        <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
          <i className="bi bi-sliders text-primary fs-5"></i>
        </div>
        <div>
          <h5 className="fw-bold text-dark mb-0">Monitoreo e Infraestructura IT</h5>
          <p className="text-muted small mb-0">Ajusta la frecuencia del cron y la ventana de consultas a Google Cloud Monitoring</p>
        </div>
      </div>

      <form onSubmit={handleSaveUptime} className="mt-4">
        <div className="row g-4">
          {/* Frecuencia de Escaneo */}
          <div className="col-md-6">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-clock text-success fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small">Frecuencia de Escaneo de Uptime</label>
                <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                  Controla qué tan seguido se mide el estado de los servicios críticos (Firestore, Auth y Hosting).
                </p>
                <select 
                  className="form-select rounded-3"
                  value={uptimeConfig.frecuenciaEscaneo}
                  onChange={e => setUptimeConfig({ ...uptimeConfig, frecuenciaEscaneo: parseInt(e.target.value) || 5 })}
                >
                  <option value="5">Cada 5 Minutos (Recomendado)</option>
                  <option value="10">Cada 10 Minutos</option>
                  <option value="15">Cada 15 Minutos</option>
                  <option value="30">Cada 30 Minutos</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ventana para Métricas GCP */}
          <div className="col-md-6">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-activity text-primary fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small">Ventana para Métricas GCP</label>
                <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                  Determina el rango histórico analizado para las gráficas de rendimiento (throughput, latencia y errores).
                </p>
                <select 
                  className="form-select rounded-3"
                  value={uptimeConfig.ventanaMetricasGcp}
                  onChange={e => setUptimeConfig({ ...uptimeConfig, ventanaMetricasGcp: parseInt(e.target.value) || 1 })}
                >
                  <option value="1">Última 1 Hora (Predeterminado)</option>
                  <option value="3">Últimas 3 Horas</option>
                  <option value="6">Últimas 6 Horas</option>
                  <option value="12">Últimas 12 Horas</option>
                  <option value="24">Últimas 24 Horas</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <hr className="my-4" style={{ borderColor: '#f1f5f9' }} />

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div className="text-warning small fw-bold d-flex align-items-center gap-2" style={{ fontSize: '0.8rem' }}>
            <i className="bi bi-shield-exclamation fs-5"></i>
            Los cambios impactan dinámicamente en el cron y en los dashboards de métricas.
          </div>
          <button type="submit" className="btn btn-dark rounded-pill px-4 fw-bold shadow-sm" disabled={savingUptime}>
            {savingUptime ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </form>

      <div className="mt-5 pt-4 border-top" style={{ borderColor: '#f1f5f9' }}>
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
            <i className="bi bi-database text-success fs-5"></i>
          </div>
          <div>
            <h5 className="fw-bold text-dark mb-0">Consumo de Base de Datos en Tiempo Real</h5>
            <p className="text-muted small mb-0">Auditoría local del consumo de Firestore para este navegador</p>
          </div>
        </div>

        <div className="row g-3">
          {/* Lecturas */}
          <div className="col-sm-6">
            <div className="p-3.5 rounded-4 border bg-light bg-opacity-30 d-flex align-items-center gap-3 shadow-xs">
              <div className="rounded-3 bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-database-fill-down text-primary fs-4"></i>
              </div>
              <div>
                <span className="text-muted small d-block">Documentos Leídos</span>
                <span className="fs-3 fw-bold text-dark font-monospace">
                  {stats.reads.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Escrituras */}
          <div className="col-sm-6">
            <div className="p-3.5 rounded-4 border bg-light bg-opacity-30 d-flex align-items-center gap-3 shadow-xs">
              <div className="rounded-3 bg-success bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-database-fill-up text-success fs-4"></i>
              </div>
              <div>
                <span className="text-muted small d-block">Documentos Escritos</span>
                <span className="fs-3 fw-bold text-dark font-monospace">
                  {stats.writes.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end mt-3">
          <button 
            type="button" 
            className="btn btn-xs btn-outline-secondary rounded-pill px-3 fw-bold"
            style={{ fontSize: '0.7rem' }}
            onClick={() => {
              dbTracker.reset();
              showAlert('Contador de consumo restablecido con éxito', 'success');
            }}
          >
            <i className="bi bi-trash3 me-1"></i> Restablecer Contador
          </button>
        </div>
      </div>

      {/* Registro de Auditoría de Eliminaciones */}
      <div className="card border-0 bg-white p-4 rounded-4 shadow-sm mt-4" style={{ border: '1px solid #eef2f6' }}>
        <div className="d-flex align-items-center gap-3 mb-3">
          <div className="rounded-circle bg-danger bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
            <i className="bi bi-shield-fill-exclamation text-danger fs-5"></i>
          </div>
          <div>
            <h5 className="fw-bold text-dark mb-0">Auditoría de Acciones Destructivas</h5>
            <p className="text-muted small mb-0">Registro histórico de eliminación de Leads, Oportunidades, Clientes y Contratos</p>
          </div>
        </div>

        {loadingLogs ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm me-2"></span>Cargando registro de auditoría...
          </div>
        ) : deleteLogs.length === 0 ? (
          <div className="text-center py-4 text-muted small bg-light rounded-4">
            No se han registrado eventos de eliminación en el sistema.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ fontSize: '0.75rem' }}>Fecha/Hora</th>
                  <th style={{ fontSize: '0.75rem' }}>Usuario</th>
                  <th style={{ fontSize: '0.75rem' }}>Acción</th>
                  <th style={{ fontSize: '0.75rem' }}>Detalles / Motivo</th>
                </tr>
              </thead>
              <tbody>
                {deleteLogs.map((log) => {
                  const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                  const formatAction = (act) => {
                    switch (act) {
                      case 'delete_lead': return <span className="badge bg-warning text-dark rounded-pill">Eliminar Lead</span>;
                      case 'delete_oportunidad': return <span className="badge bg-primary rounded-pill">Eliminar Oportunidad</span>;
                      case 'delete_client_cascade': return <span className="badge bg-danger rounded-pill">Eliminar Cliente (Cascada)</span>;
                      case 'delete_ticket': return <span className="badge bg-secondary rounded-pill">Eliminar Ticket</span>;
                      default: return act;
                    }
                  };
                  const renderDetails = (l) => {
                    const m = l.metadata || {};
                    const motiveStr = m.motivo ? ` | MOTIVO: "${m.motivo}"` : ' | MOTIVO: No especificado';
                    if (l.accion === 'delete_lead') {
                      return `Lead ID: ${m.leadId || ''} | Empresa: ${m.leadEmpresa || ''}${motiveStr}`;
                    } else if (l.accion === 'delete_oportunidad') {
                      return `Oportunidad ID: ${m.oportunidadId || ''} | Nombre: ${m.oportunidadNombre || ''}${motiveStr}`;
                    } else if (l.accion === 'delete_client_cascade') {
                      return `Cliente ID: ${m.clienteId || ''} | Nombre: ${m.clienteNombre || ''} (Borrados: ${m.stats?.contratos || 0} contratos, ${m.stats?.contactos || 0} contactos)${motiveStr}`;
                    } else if (l.accion === 'delete_ticket') {
                      return `Ticket ID: ${m.ticketId || ''} | Título: ${m.titulo || ''}${motiveStr}`;
                    }
                    return JSON.stringify(m);
                  };
                  return (
                    <tr key={log.id}>
                      <td className="small text-muted font-monospace">{date.toLocaleString()}</td>
                      <td className="small text-dark fw-bold">{log.usuarioEmail}</td>
                      <td>{formatAction(log.accion)}</td>
                      <td className="small text-muted">{renderDetails(log)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
