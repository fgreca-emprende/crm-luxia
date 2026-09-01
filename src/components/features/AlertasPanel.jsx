import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { SpinnerPremium } from '../ui/SpinnerPremium';

export function AlertasPanel({ onNavigateToClient }) {
  const { isAdmin, isLector, role, userTeam, profile, loading: roleLoading, getDataScope } = useUserRole();
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState('todas'); // 'todas', 'alta', 'media'
  
  const { showAlert } = useToast();
  const [resolveModal, setResolveModal] = useState({
    show: false,
    alerta: null,
    resolutionNote: ''
  });

  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);
  const alertasScope = getDataScope('alertas');

  const [usuarios, setUsuarios] = useState([]);
  useEffect(() => {
    const loadUsuarios = async () => {
      try {
        const { data } = await supabase.from('usuarios').select('*');
        if (data) setUsuarios(data);
      } catch (err) {
        console.warn('Error fetching usuarios in AlertasPanel:', err);
      }
    };
    loadUsuarios();
  }, []);

  const currentEmail = profile?.email || 'admin@luxia.com';

  const filterAlertsByScope = useCallback((data) => {
    if (alertasScope === 'ALL') return true;
    if (alertasScope === 'NONE') return false;
    
    if (data.tipo === 'sistema_ia' && role !== 'admin' && role !== 'superadmin') return false;

    const comercialEmail = data.comercialEmail || data.comercial_email || '';
    const isSelf = comercialEmail.toLowerCase().trim() === currentEmail.toLowerCase().trim();
    if (alertasScope === 'OWN') {
      return isSelf || comercialEmail === 'SYSTEM' || !comercialEmail;
    }
    if (alertasScope === 'TEAM') {
      if (isSelf || comercialEmail === 'SYSTEM' || !comercialEmail) return true;
      const asignadoUser = usuarios.find(u => u.email?.toLowerCase().trim() === comercialEmail.toLowerCase().trim());
      return asignadoUser && normalizarEquipo(asignadoUser.equipo) === normalizedTeam;
    }
    return true;
  }, [alertasScope, role, currentEmail, usuarios, normalizedTeam]);

  const loadAlertas = useCallback(async () => {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('alertas')
        .select('*')
        .eq('leida', false)
        .order('creada_en', { ascending: false });

      if (urgencyFilter !== 'todas') {
        queryBuilder = queryBuilder.eq('urgency', urgencyFilter);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      const normalized = (data || []).map(a => ({
        id: a.id,
        clienteId: a.cliente_id || a.clienteId,
        nombreEmpresa: a.nombre_empresa || a.nombreEmpresa || 'Empresa Sin Nombre',
        tipo: a.tipo,
        urgency: a.urgency || 'media',
        mensaje: a.mensaje,
        accionRecomendada: a.accion_recomendada || a.accionRecomendada,
        leida: a.leida,
        comercialEmail: a.comercial_email || a.comercialEmail,
        creadaEn: a.creada_en || a.creadaEn
      })).filter(filterAlertsByScope);

      // Orden secundario para priorizar altas si es 'todas'
      if (urgencyFilter === 'todas') {
        normalized.sort((a, b) => {
          const urgA = a.urgency === 'alta' ? 2 : a.urgency === 'media' ? 1 : 0;
          const urgB = b.urgency === 'alta' ? 2 : b.urgency === 'media' ? 1 : 0;
          return urgB - urgA;
        });
      }

      setAlertas(normalized);
    } catch (err) {
      console.error("Error loading alertas in AlertasPanel:", err);
      showAlert('No se pudieron cargar las alertas desde el servidor.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [urgencyFilter, filterAlertsByScope, showAlert]);

  useEffect(() => {
    loadAlertas();
  }, [loadAlertas]);

  const handleMarkAsRead = async (alerta) => {
    try {
      const { error } = await supabase
        .from('alertas')
        .update({ leida: true })
        .eq('id', alerta.id);

      if (error) throw error;

      const isSystemAlert = alerta.tipo === 'sistema_ia' || 
                            (alerta.clienteId && alerta.clienteId.startsWith('SYSTEM_'));

      if (!isSystemAlert && alerta.clienteId) {
        const noteText = `[Alerta Leída - Urgencia ${alerta.urgency?.toUpperCase() || 'MEDIA'}] ${alerta.mensaje}`;
        await supabase.from('interacciones').insert({
          cliente_id: alerta.clienteId,
          tipo: 'alerta_resuelta',
          descripcion: noteText,
          autor: currentEmail,
          created_at: new Date().toISOString()
        });
      }

      setAlertas(prev => prev.filter(a => a.id !== alerta.id));
      showAlert(isSystemAlert ? 'Alerta descartada.' : 'Alerta marcada como leída.', 'success');
    } catch (error) {
      console.error("Error al marcar alerta como leída:", error);
      showAlert(`Error al descartar alerta: ${error.message}`, 'danger');
    }
  };

  const handleOpenResolveModal = (alerta) => {
    setResolveModal({
      show: true,
      alerta: alerta,
      resolutionNote: ''
    });
  };

  const handleResolveAlert = async (e) => {
    e.preventDefault();
    const { alerta, resolutionNote } = resolveModal;
    if (!alerta || !resolutionNote.trim()) return;

    try {
      // 1. Marcar alerta como leída en Supabase
      const { error } = await supabase
        .from('alertas')
        .update({ leida: true })
        .eq('id', alerta.id);

      if (error) throw error;

      // 2. Registrar en la bitácora (interacciones)
      const labelMapping = {
        churn_detectado: 'Riesgo Churn',
        contrato_por_vencer: 'Vencimiento Contrato',
        lead_estancado: 'Lead Estancado',
        cierre_vencido: 'Cierre Vencido',
        oportunidad_estancada: 'Negocio Estancado'
      };
      const typeLabel = labelMapping[alerta.tipo] || 'Alerta General';
      const noteText = `[Alerta Resuelta - ${typeLabel}] ${resolutionNote.trim()}`;
      
      const intDoc = {
        tipo: 'alerta_resuelta',
        descripcion: noteText,
        autor: currentEmail,
        created_at: new Date().toISOString()
      };
      if (alerta.clienteId) intDoc.cliente_id = alerta.clienteId;

      await supabase.from('interacciones').insert(intDoc);

      setAlertas(prev => prev.filter(a => a.id !== alerta.id));
      setResolveModal({ show: false, alerta: null, resolutionNote: '' });
      showAlert('Alerta resuelta y nota registrada en la bitácora', 'success');
    } catch (error) {
      console.error("Error al resolver alerta:", error);
      showAlert(`Error al resolver alerta: ${error.message}`, 'danger');
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="py-5">
        <SpinnerPremium size="md" text="Cargando alertas críticas..." />
      </div>
    );
  }

  return (
    <div className="container-fluid p-0">
      {/* Cabecera y Semáforo de Criticidad */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold text-dark" style={{ letterSpacing: '-0.02em' }}>
            <i className="bi bi-bell text-danger me-2"></i>Alertas de Riesgo
          </h2>
          <p className="text-muted mb-0 small">Eventos críticos de contratos, SLA y deserción que requieren tu atención inmediata.</p>
        </div>
        
        <div className="apple-segmented-control" style={{ padding: '3px' }}>
          <button
            type="button"
            className={`apple-segmented-item ${urgencyFilter === 'todas' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('todas')}
          >
            <span>Todas</span>
          </button>
          <button
            type="button"
            className={`apple-segmented-item ${urgencyFilter === 'alta' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('alta')}
          >
            <span className="dot-indicator" style={{ width: '6px', height: '6px', backgroundColor: 'var(--apple-red)' }}></span>
            <span>Alta</span>
          </button>
          <button
            type="button"
            className={`apple-segmented-item ${urgencyFilter === 'media' ? 'active' : ''}`}
            onClick={() => setUrgencyFilter('media')}
          >
            <span className="dot-indicator" style={{ width: '6px', height: '6px', backgroundColor: 'var(--apple-orange)' }}></span>
            <span>Media</span>
          </button>
        </div>
      </div>

      {alertas.length === 0 ? (
        <div className="apple-card text-center py-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '300px' }}>
          <div className="rounded-circle d-flex align-items-center justify-content-center mb-3 shadow-sm" style={{ width: '64px', height: '64px', backgroundColor: 'var(--apple-green-light)', color: 'var(--apple-green)' }}>
            <i className="bi bi-shield-check fs-2"></i>
          </div>
          <h5 className="fw-bold text-dark mb-1">¡Todo en orden!</h5>
          <p className="text-muted small mb-0 px-5">No existen alertas pendientes bajo este filtro. Tus contratos y clientes se encuentran estables.</p>
        </div>
      ) : (
        <div className="row g-3">
          {alertas.map(alerta => {
            const isSystem = alerta.tipo === 'sistema_ia' || 
                             (alerta.clienteId && alerta.clienteId.startsWith('SYSTEM_'));
            const isHigh = alerta.urgency === 'alta';
            const isMedium = alerta.urgency === 'media';
            
            const glowClass = isHigh ? 'kpi-glow-red' : isMedium ? 'kpi-glow-orange' : 'kpi-glow-blue';

            const icon = isSystem
              ? 'bi-hdd-network text-dark'
              : alerta.tipo === 'churn_detectado' 
              ? 'bi-graph-down-arrow text-danger' 
              : alerta.tipo === 'contrato_por_vencer' 
                ? 'bi-file-earmark-break text-warning' 
                : alerta.tipo === 'lead_estancado'
                  ? 'bi-person-x-fill text-warning'
                  : alerta.tipo === 'cierre_vencido'
                    ? 'bi-calendar-x-fill text-danger'
                    : alerta.tipo === 'oportunidad_estancada'
                      ? 'bi-hourglass-split text-info'
                      : 'bi-exclamation-triangle text-info';

            const fechaStr = alerta.creadaEn
              ? new Date(alerta.creadaEn).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'Reciente';

            return (
              <div key={alerta.id} className="col-12">
                <div className={`apple-card ${glowClass} p-4 transition-all`}>
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                    <div className="d-flex align-items-center gap-3">
                      {/* Icono del tipo de alerta */}
                      <div className="rounded-circle bg-light d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                        <i className={`bi ${icon} fs-5`}></i>
                      </div>
                      <div>
                        <h6 className="fw-bold text-dark mb-0">{alerta.nombreEmpresa}</h6>
                         <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-clock me-1"></i>{fechaStr} · {
                            alerta.tipo === 'sistema_ia' ? 'Infraestructura IA' : 
                            alerta.tipo === 'churn_detectado' ? 'Riesgo Churn (IA)' : 
                            alerta.tipo === 'lead_estancado' ? 'Prospección Estancada' : 
                            alerta.tipo === 'cierre_vencido' ? 'Cierre Vencido' : 
                            alerta.tipo === 'oportunidad_estancada' ? 'Negocio Estancado' : 
                            'Renovación de Contrato'
                          }
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className={`apple-badge ${isHigh ? 'apple-badge-red' : isMedium ? 'apple-badge-orange' : 'apple-badge-blue'}`}>
                        {isHigh ? 'Urgencia Alta' : isMedium ? 'Urgencia Media' : 'Informativa'}
                      </span>
                    </div>
                  </div>

                  {/* Cuerpo del Mensaje */}
                  <div className="small mb-3 mt-2 p-3 rounded-3" style={{ backgroundColor: 'var(--apple-surface-subtle)', color: 'var(--apple-text-primary)' }}>
                    {alerta.mensaje}
                  </div>

                  {/* Acción Recomendada */}
                  {alerta.accionRecomendada && (
                    <div className="bg-success bg-opacity-5 p-3 rounded-3 border border-success border-opacity-10 mb-3">
                      <div className="fw-bold text-success small mb-1">
                        <i className="bi bi-patch-check-fill me-2"></i>Acción Operativa Sugerida:
                      </div>
                      <p className="small mb-0 text-dark opacity-90">{alerta.accionRecomendada}</p>
                    </div>
                  )}

                  {/* Botonera Interactiva */}
                  <div className="d-flex justify-content-end gap-2">
                    {!isSystem && alerta.clienteId && (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                        onClick={() => onNavigateToClient && onNavigateToClient(alerta.clienteId)}
                      >
                        <i className="bi bi-arrow-right-circle me-1"></i> Ir al Cliente
                      </button>
                    )}
                     {isSystem ? (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold shadow-sm"
                        onClick={() => handleMarkAsRead(alerta)}
                        disabled={isLector}
                        title={isLector ? "Permiso denegado (Rol Lector)" : ""}
                      >
                        <i className="bi bi-check2 me-1"></i> Entendido
                      </button>
                    ) : alerta.urgency === 'baja' ? (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-success rounded-pill px-3 fw-bold shadow-sm"
                        onClick={() => handleMarkAsRead(alerta)}
                        disabled={isLector}
                        title={isLector ? "Permiso denegado (Rol Lector)" : ""}
                      >
                        <i className="bi bi-eye me-1"></i> Marcar como Leída
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-success rounded-pill px-3 fw-bold shadow-sm"
                        onClick={() => handleOpenResolveModal(alerta)}
                        disabled={isLector}
                        title={isLector ? "Permiso denegado (Rol Lector)" : ""}
                      >
                        <i className="bi bi-check-circle me-1"></i> Resolver Alerta
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* === MODAL DE RESOLUCIÓN DE ALERTA PREMIUM === */}
      {resolveModal.show && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered modal-fullscreen-sm-down" style={{ maxWidth: '500px' }}>
            <div className="modal-content glass-panel border border-white border-opacity-10 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  <i className="bi bi-shield-check text-success me-2 fs-4"></i> Resolver Alerta
                </h5>
                <button type="button" className="btn-close" onClick={() => setResolveModal({ show: false, alerta: null, resolutionNote: '' })}></button>
              </div>
              <form onSubmit={handleResolveAlert}>
                <div className="modal-body px-4 py-3">
                  <div className="mb-3">
                    <span className="text-muted small d-block mb-1 fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>CLIENTE</span>
                    <div className="fw-bold text-dark">{resolveModal.alerta?.nombreEmpresa}</div>
                  </div>
                  
                  <div className="mb-3">
                    <span className="text-muted small d-block mb-1 fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>DETALLE DE LA ALERTA</span>
                    <div className="small text-muted bg-light p-2.5 rounded-3 border-start border-3 border-warning" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                      {resolveModal.alerta?.mensaje}
                    </div>
                  </div>

                  <div className="mb-0">
                    <label htmlFor="resolutionNote" className="text-muted small fw-bold mb-1.5 d-block" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                      NOTA DE RESOLUCIÓN (SE AGREGARÁ A LA BITÁCORA)
                    </label>
                    <textarea
                      id="resolutionNote"
                      className="form-control form-control-sm"
                      rows="3"
                      placeholder="Explica qué acciones se tomaron para mitigar el riesgo o resolver el inconveniente..."
                      value={resolveModal.resolutionNote}
                      onChange={(e) => setResolveModal(prev => ({ ...prev, resolutionNote: e.target.value }))}
                      required
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer border-0 px-4 pb-4 pt-2 d-flex gap-2">
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold flex-grow-1" 
                    onClick={() => setResolveModal({ show: false, alerta: null, resolutionNote: '' })}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-sm btn-success rounded-pill px-3 fw-bold flex-grow-1 shadow-sm"
                    disabled={!resolveModal.resolutionNote.trim()}
                  >
                    Resolver y Registrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
