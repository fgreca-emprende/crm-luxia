import { useState, useEffect } from 'react';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useUserRole } from '../../contexts/UserRoleContext';
import { supabase } from '../../lib/supabase';
import { EvidenceUploadModal } from './EvidenceUploadModal';
import { useToast } from '../ui/ToastProvider';

export function OnboardingChecklist({ clienteId }) {
  const { checklist, loading, togglePaso, asignarResponsable } = useOnboarding(clienteId);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPaso, setSelectedPaso] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [usersList, setUsersList] = useState([]);
  const { isLector, hasPermission } = useUserRole();
  const canOperate = hasPermission('actions', 'operar_onboarding_checklist') || hasPermission('operar_onboarding_checklist');
  const isChecklistDisabled = isLector || !canOperate;
  const { showAlert } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await supabase.from('usuarios').select('*');
        if (data) {
          const emails = [];
          data.forEach(u => {
            const isActivo = u.estado_invitacion !== 'pendiente' && u.activo !== false;
            if (u.email && isActivo) emails.push(u.email.toLowerCase().trim());
          });
          setUsersList([...new Set(emails)]);
        }
      } catch (err) {
        console.error("Error loading users for suggestions:", err);
      }
    };
    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <span className="text-muted small mt-2">Cargando checklist de onboarding...</span>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="text-center text-muted py-4">
        No se pudo cargar ni inicializar el checklist de onboarding.
      </div>
    );
  }

  const { pasos = [], porcentajeCompletado = 0 } = checklist;

  return (
    <div className="onboarding-container p-1">
      {/* Encabezado e Inteligencia de Progreso */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="fw-bold mb-0 text-dark">Checklist de Activación Operativa</h6>
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 fw-bold">
          {porcentajeCompletado}% Completado
        </span>
      </div>

      {/* Progress Bar Premium */}
      <div className="progress mb-4 rounded-pill shadow-sm" style={{ height: '12px', backgroundColor: '#f0f0f0' }}>
        <div 
          className="progress-bar progress-bar-striped progress-bar-animated bg-gradient-primary" 
          role="progressbar" 
          style={{ 
            width: `${porcentajeCompletado}%`,
            background: 'var(--luxia-brand-gradient, linear-gradient(90deg, #961f80 0%, #b82ca0 100%))',
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          aria-valuenow={porcentajeCompletado} 
          aria-valuemin="0" 
          aria-valuemax="100"
        ></div>
      </div>

      {/* Listado de Pasos */}
      <div className="d-flex flex-column gap-3">
        {pasos.map((paso, idx) => {
          const dateStr = paso.fechaCompletado
            ? paso.fechaCompletado.toDate
              ? paso.fechaCompletado.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : new Date(paso.fechaCompletado).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '';

          const FALLBACK_TITULOS = {
            acuerdo_comercial_legajo: 'Acuerdo Comercial y Legajo Impositivo Aprobado',
            relevamiento_agronomico_lotes: 'Relevamiento Agronómico y Plan de Campaña',
            asesoramiento_tecnico_manejo: 'Asesoramiento Técnico y Calibración de Dosis',
            coordinacion_logistica_destino: 'Coordinación Logística y Depósito de Destino',
            primera_entrega_suministro: 'Primer Despacho y Entrega en Establecimiento',
            monitoreo_campo_30_dias: 'Monitoreo a Campo y Evaluación de Eficacia (30 días)',
            // Fallbacks legacy
            firma_contrato: 'Acuerdo Comercial y Legajo Impositivo Aprobado',
            acceso_plataforma: 'Relevamiento Agronómico y Plan de Campaña',
            integracion_api: 'Asesoramiento Técnico y Calibración de Dosis',
            capacitacion_operativa: 'Coordinación Logística y Depósito de Destino',
            primera_operacion: 'Primer Despacho y Entrega en Establecimiento',
            revision_30_dias: 'Monitoreo a Campo y Evaluación de Eficacia (30 días)'
          };

          const tituloPaso = paso.titulo || FALLBACK_TITULOS[paso.id] || 'Paso de Onboarding';

          return (
            <div 
              key={paso.id} 
              className={`card border shadow-sm rounded-4 p-3 transition-all ${
                paso.completado 
                  ? 'border-start border-success border-4' 
                  : 'border-start border-secondary border-4'
              }`}
              style={{
                transition: 'all 0.3s ease',
                backgroundColor: paso.completado ? 'rgba(25, 135, 84, 0.12)' : 'var(--apple-surface-elevated)',
                borderColor: 'var(--apple-border)'
              }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-start gap-3 flex-grow-1">
                  {/* Icono de número o check */}
                  <div 
                    className={`rounded-circle d-flex align-items-center justify-content-center fs-5 shadow-sm`}
                    style={{
                      width: '36px',
                      height: '36px',
                      minWidth: '36px',
                      backgroundColor: paso.completado ? '#198754' : 'var(--apple-surface-card)',
                      color: paso.completado ? '#ffffff' : 'var(--apple-text-primary)',
                      border: '1px solid var(--apple-border)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {paso.completado ? (
                      <i className="bi bi-check-lg fw-bold"></i>
                    ) : (
                      <span className="small fw-bold">{idx + 1}</span>
                    )}
                  </div>

                  {/* Detalle del paso */}
                  <div className="flex-grow-1">
                    <div 
                      className={`fw-bold mb-1 ${paso.completado ? 'text-decoration-line-through opacity-75' : ''}`}
                      style={{ color: paso.completado ? '#10b981' : 'var(--apple-text-primary)' }}
                    >
                      {tituloPaso}
                    </div>
                    {paso.completado ? (
                      <div className="d-flex flex-wrap gap-2 align-items-center mt-1">
                        <span className="small text-muted d-flex align-items-center">
                          <i className="bi bi-person-circle me-1"></i> {paso.completadoPor}
                        </span>
                        <span className="badge border small fw-normal" style={{ background: 'var(--apple-surface-card)', color: 'var(--apple-text-primary)', borderColor: 'var(--apple-border)' }}>
                          <i className="bi bi-clock me-1"></i> {dateStr}
                        </span>
                        {paso.evidencia && (
                          <a 
                            href={paso.evidencia.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="badge bg-primary bg-opacity-10 text-primary border border-primary text-decoration-none small fw-bold"
                          >
                            <i className={paso.evidencia.tipo === 'archivo' ? "bi bi-file-earmark-arrow-down-fill me-1" : "bi bi-link-45deg me-1"}></i>
                            {paso.evidencia.nombre}
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="small text-muted">Pendiente de verificación</div>
                    )}

                    {/* Responsable */}
                    <div className="d-flex align-items-center gap-2 mt-1.5 pt-1.5 border-top border-secondary border-opacity-10">
                      <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                        <i className="bi bi-person-fill text-muted me-1"></i>Responsable:
                      </span>
                      {paso.responsableEmail ? (
                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 small fw-bold" style={{ fontSize: '0.68rem' }}>
                          {paso.responsableEmail}
                        </span>
                      ) : (
                        <span className="text-muted small" style={{ fontSize: '0.7rem', fontStyle: 'italic' }}>Sin asignar</span>
                      )}
                      {!isChecklistDisabled && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-primary fw-bold text-decoration-none ms-1 animate-fade-in"
                          style={{ fontSize: '0.72rem' }}
                          onClick={() => {
                            setSelectedPaso(paso);
                            setAssignEmail(paso.responsableEmail || '');
                            setShowAssignModal(true);
                          }}
                        >
                          <i className="bi bi-pencil-square"></i> {paso.responsableEmail ? 'Cambiar' : 'Asignar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botón de acción */}
                <div className="ms-3">
                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-3 fw-bold shadow-sm transition-all ${
                      paso.completado 
                        ? 'btn-outline-success bg-white hover-success' 
                        : 'btn-primary'
                    }`}
                    onClick={() => {
                      if (paso.completado) {
                        togglePaso(paso.id);
                      } else {
                        setSelectedPaso(paso);
                        setModalVisible(true);
                      }
                    }}
                    disabled={isChecklistDisabled}
                    title={isChecklistDisabled ? "Permiso denegado" : ""}
                  >
                    {paso.completado ? 'Reabrir' : 'Verificar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <EvidenceUploadModal 
        show={modalVisible}
        onClose={() => setModalVisible(false)}
        paso={selectedPaso}
        clienteId={clienteId}
        onConfirm={(evidencia) => {
          togglePaso(selectedPaso?.id, evidencia);
          setModalVisible(false);
          setSelectedPaso(null);
        }}
      />

      {/* Modal de Asignación de Responsable */}
      {showAssignModal && selectedPaso && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 p-3 text-start" style={{ backgroundColor: 'var(--bg-main, #ffffff)' }}>
              <div className="modal-header border-bottom-0 pb-0 pt-3 px-3 d-flex justify-content-between align-items-center">
                <h5 className="fw-bold mb-0 text-dark">Asignar Responsable</h5>
                <button type="button" className="btn-close" onClick={() => setShowAssignModal(false)}></button>
              </div>
              <div className="modal-body px-3 py-3">
                <p className="text-muted small mb-3">
                  Ingresa el correo corporativo del responsable de este hito. Se le enviará un correo de notificación automáticamente.
                </p>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark mb-1">Correo del Responsable</label>
                  <input 
                    type="email" 
                    list="luxia-users-list"
                    className="form-control rounded-3" 
                    placeholder="nombre@luxia.com"
                    value={assignEmail}
                    onChange={e => setAssignEmail(e.target.value)}
                  />
                  <datalist id="luxia-users-list">
                    {usersList.map(u => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="modal-footer border-top-0 pt-0 px-3 pb-3 d-flex justify-content-between">
                <button 
                  type="button" 
                  className="btn btn-outline-danger rounded-pill px-3"
                  onClick={() => {
                    asignarResponsable(selectedPaso.id, '');
                    setShowAssignModal(false);
                  }}
                  disabled={!selectedPaso.responsableEmail}
                >
                  Quitar Responsable
                </button>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-secondary rounded-pill px-3" onClick={() => setShowAssignModal(false)}>
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
                    onClick={() => {
                      const trimmed = assignEmail.trim();
                      if (trimmed && !trimmed.toLowerCase().endsWith('@luxia.com')) {
                        showAlert('Solo se permiten correos corporativos @luxia.com.', 'warning');
                        return;
                      }
                      asignarResponsable(selectedPaso.id, trimmed);
                      setShowAssignModal(false);
                    }}
                  >
                    Asignar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
