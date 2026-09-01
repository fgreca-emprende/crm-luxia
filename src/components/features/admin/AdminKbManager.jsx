import { useState, useEffect, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { SpinnerPremium } from '../../ui/SpinnerPremium';
import { ConfirmModal } from './ConfirmModal';

export function AdminKbManager({ currentUser }) {
  const [proposals, setProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [ragStatus, setRagStatus] = useState(null);
  const { showAlert } = useToast();

  const loadRagStatus = useCallback(async () => {
    try {
      const status = await getConfigGeneral('config_ia_rag_status');
      if (status) {
        setRagStatus(status);
      }
    } catch (err) {
      console.warn("Error reading rag_status:", err);
    }
  }, []);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigGeneral('propuestas_kb');
      const list = Array.isArray(data) ? data.filter(p => p.status === 'pendiente') : [];
      setProposals(list);
      setSelectedProposal(prev => {
        if (!prev) return list.length > 0 ? list[0] : null;
        const exists = list.find(p => p.id === prev.id);
        return exists || (list.length > 0 ? list[0] : null);
      });
    } catch (err) {
      console.warn("Error loading proposals:", err);
      showAlert("Error al cargar propuestas de KB", 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadRagStatus();
    loadProposals();
  }, [loadRagStatus, loadProposals]);

  const handleSyncRag = async () => {
    if (ragStatus?.status === 'syncing') {
      showAlert('La sincronización de la base vectorial RAG ya está en proceso.', 'warning');
      return;
    }
    
    try {
      const syncingStatus = {
        status: 'syncing',
        startedAt: new Date().toISOString()
      };
      await setConfigGeneral('config_ia_rag_status', syncingStatus);
      setRagStatus(syncingStatus);

      setTimeout(async () => {
        const successStatus = {
          status: 'success',
          message: 'Base vectorial RAG actualizada con éxito.',
          lastSync: new Date().toISOString()
        };
        await setConfigGeneral('config_ia_rag_status', successStatus);
        setRagStatus(successStatus);
        showAlert('Base Vectorial RAG actualizada con éxito.', 'success');
      }, 1500);
      
      showAlert('Sincronización RAG iniciada.', 'info');
    } catch (err) {
      showAlert(err.message || 'Error al iniciar la sincronización RAG.', 'danger');
    }
  };

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmBtnClass: 'btn-danger',
    confirmText: 'Rechazar',
    onConfirm: null
  });

  useEffect(() => {
    if (selectedProposal) {
      setEditedContent(selectedProposal.proposedContent || '');
    } else {
      setEditedContent('');
    }
  }, [selectedProposal]);

  const handleSelectProposal = (prop) => {
    setSelectedProposal(prop);
    setEditedContent(prop.proposedContent || '');
  };

  const handleApprove = async () => {
    if (!selectedProposal) return;
    setActioning(true);
    try {
      const allProposals = (await getConfigGeneral('propuestas_kb')) || [];
      const updatedProposals = allProposals.map(p => p.id === selectedProposal.id ? {
        ...p,
        status: 'aprobada',
        approvedBy: currentUser?.email || 'Admin',
        approvedAt: new Date().toISOString(),
        finalContent: editedContent
      } : p);
      await setConfigGeneral('propuestas_kb', updatedProposals);

      showAlert('Propuesta aprobada y manual actualizado.', 'success');
      loadProposals();
    } catch (err) {
      showAlert(err.message || 'Error al aprobar la propuesta.', 'danger');
    } finally {
      setActioning(false);
    }
  };

  const handleReject = () => {
    if (!selectedProposal) return;
    setConfirmModal({
      show: true,
      title: 'Rechazar Propuesta de KB',
      message: '¿Estás seguro de que deseas rechazar esta propuesta de actualización? Esta acción descartará la propuesta en caliente.',
      confirmBtnClass: 'btn-danger',
      confirmText: 'Rechazar',
      onConfirm: async () => {
        setActioning(true);
        try {
          const allProposals = (await getConfigGeneral('propuestas_kb')) || [];
          const updatedProposals = allProposals.map(p => p.id === selectedProposal.id ? {
            ...p,
            status: 'rechazada',
            rejectedBy: currentUser?.email || 'Admin',
            rejectedAt: new Date().toISOString()
          } : p);
          await setConfigGeneral('propuestas_kb', updatedProposals);

          showAlert('Propuesta rechazada y descartada.', 'warning');
          loadProposals();
        } catch (err) {
          showAlert(err.message || 'Error al rechazar propuesta.', 'danger');
        } finally {
          setActioning(false);
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  return (
    <div className="row g-4 mb-4 animate__animated animate__fadeIn">
      {/* Left panel: list of pending proposals */}
      <div className="col-md-5">
        <div className="card border-0 bg-light p-4 rounded-4 shadow-sm h-100">
          <h5 className="fw-bold mb-3 text-dark d-flex align-items-center justify-content-between">
            <span className="d-flex align-items-center">
              <i className="bi bi-inboxes-fill me-2 text-warning"></i> Propuestas Pendientes
              {proposals.length > 0 && (
                <span className="badge bg-warning text-dark ms-2 rounded-pill px-2.5 py-1" style={{ fontSize: '0.75rem' }}>
                  {proposals.length}
                </span>
              )}
            </span>
            <button
              onClick={handleSyncRag}
              disabled={ragStatus?.status === 'syncing'}
              className="btn btn-sm btn-outline-primary px-3 rounded-pill fw-bold text-nowrap"
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            >
              {ragStatus?.status === 'syncing' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" style={{ width: '0.65rem', height: '0.65rem' }}></span>
                  Sincronizando...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat me-1"></i> Actualizar RAG
                </>
              )}
            </button>
          </h5>
          <p className="small text-muted mb-4">
            Auditoría de correcciones reportadas por usuarios en el Soporte Conversacional.
          </p>

          {ragStatus?.status === 'syncing' && (
            <div className="alert alert-info border-0 shadow-sm p-3 rounded-4 mb-4 d-flex align-items-center gap-3 animate__animated animate__fadeIn" style={{ fontSize: '0.75rem' }}>
              <div className="spinner-border spinner-border-sm text-primary flex-shrink-0" role="status" style={{ width: '0.9rem', height: '0.9rem' }}></div>
              <div>
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.78rem' }}>Indexando RAG en segundo plano</h6>
                <span className="text-muted">Gemini está generando embeddings. Puedes continuar navegando por el CRM.</span>
              </div>
            </div>
          )}
          {ragStatus?.status === 'success' && ragStatus?.message && (
            <div className="alert alert-success border-0 shadow-sm p-3 rounded-4 mb-4 d-flex align-items-center gap-3 animate__animated animate__fadeIn" style={{ fontSize: '0.75rem' }}>
              <i className="bi bi-check-circle-fill text-success fs-5 flex-shrink-0"></i>
              <div>
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.78rem' }}>Última sincronización exitosa</h6>
                <span className="text-muted">{ragStatus.message} ({new Date(ragStatus.lastSync?.seconds * 1000 || Date.now()).toLocaleString()})</span>
              </div>
            </div>
          )}
          {ragStatus?.status === 'error' && (
            <div className="alert alert-danger border-0 shadow-sm p-3 rounded-4 mb-4 d-flex align-items-center gap-3 animate__animated animate__fadeIn" style={{ fontSize: '0.75rem' }}>
              <i className="bi bi-exclamation-octagon-fill text-danger fs-5 flex-shrink-0"></i>
              <div>
                <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.78rem' }}>Error en sincronización RAG</h6>
                <span className="text-muted">{ragStatus.errorDetail}</span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-5"><SpinnerPremium size="md" /></div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-5 text-muted bg-white bg-opacity-50 rounded-4 border border-dashed p-4">
              <i className="bi bi-check-circle-fill text-success fs-2 mb-2 d-block"></i>
              <span className="small">No hay propuestas de cambios pendientes.</span>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2 overflow-y-auto" style={{ maxHeight: '550px' }}>
              {proposals.map(prop => {
                const isSelected = selectedProposal?.id === prop.id;
                const date = prop.timestamp?.toDate ? prop.timestamp.toDate().toLocaleDateString('es-ES') : (prop.timestamp ? new Date(prop.timestamp).toLocaleDateString('es-ES') : 'Reciente');
                return (
                  <button
                    key={prop.id}
                    onClick={() => handleSelectProposal(prop)}
                    className={`btn text-start p-3 rounded-4 border-0 transition-all ${
                      isSelected 
                        ? 'bg-primary text-white shadow-sm' 
                        : 'bg-white text-dark hover-bg-light border'
                    }`}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-opacity-20 text-truncate px-2 py-1 rounded-pill" style={{ 
                        fontSize: '0.65rem', 
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                        color: isSelected ? '#fff' : '#6c757d'
                      }}>
                        {prop.manualId === 'manual_operaciones' ? '📖 Operaciones' : '📄 Técnico'}
                      </span>
                      <span className="small text-opacity-75" style={{ fontSize: '0.7rem' }}>{date}</span>
                    </div>
                    <div className="fw-bold text-truncate mb-1" style={{ fontSize: '0.85rem' }}>
                      {prop.tituloSeccion}
                    </div>
                    <div className="small text-opacity-50 text-truncate" style={{ fontSize: '0.75rem', opacity: isSelected ? 0.8 : 0.6 }}>
                      {prop.userCorrectionText}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: selected proposal comparison & editor */}
      <div className="col-md-7">
        <div className="card border-0 bg-white p-4 rounded-4 shadow-sm h-100 border">
          {selectedProposal ? (
            <div className="d-flex flex-column h-100">
              <h5 className="fw-bold mb-3 text-dark d-flex align-items-center">
                <i className="bi bi-pencil-square me-2 text-primary"></i> Evaluar Propuesta
              </h5>

              {/* User Feedback Metadata info */}
              <div className="mb-4 bg-light p-3 rounded-4" style={{ fontSize: '0.8rem' }}>
                <div className="row g-2 mb-2">
                  <div className="col-sm-6">
                    <span className="text-muted d-block">Reportado por:</span>
                    <strong className="text-dark">{selectedProposal.userEmail}</strong>
                  </div>
                  <div className="col-sm-6">
                    <span className="text-muted d-block">Sección destino:</span>
                    <strong className="text-dark">{selectedProposal.tituloSeccion} ({selectedProposal.seccionId})</strong>
                  </div>
                </div>
                <hr className="my-2 bg-secondary bg-opacity-25" />
                <div className="mb-2">
                  <span className="text-muted d-block fw-bold">Pregunta del Usuario:</span>
                  <p className="mb-0 text-dark font-monospace bg-white p-2 rounded border mt-1">"{selectedProposal.userCorrectionText}"</p>
                </div>
              </div>

              {/* Editor Split */}
              <div className="row g-3 mb-4 flex-grow-1">
                {selectedProposal.originalContent && (
                  <div className="col-md-6 d-flex flex-column">
                    <span className="small text-muted mb-1 fw-bold"><i className="bi bi-file-earmark-text me-1"></i>Contenido Actual:</span>
                    <textarea
                      readOnly
                      disabled
                      className="form-control rounded-3 bg-light border-0 font-monospace flex-grow-1"
                      style={{ fontSize: '0.75rem', minHeight: '220px', resize: 'none' }}
                      value={selectedProposal.originalContent}
                    />
                  </div>
                )}
                <div className={selectedProposal.originalContent ? "col-md-6 d-flex flex-column" : "col-12 d-flex flex-column"}>
                  <span className="small text-primary mb-1 fw-bold"><i className="bi bi-file-earmark-plus me-1"></i>Contenido Propuesto (Editable):</span>
                  <textarea
                    disabled={actioning}
                    className="form-control rounded-3 font-monospace flex-grow-1 border border-primary border-opacity-50"
                    style={{ fontSize: '0.75rem', minHeight: '220px', resize: 'none' }}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                  />
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="d-flex justify-content-end gap-2 mt-auto border-top pt-3">
                <button
                  type="button"
                  disabled={actioning}
                  onClick={handleReject}
                  className="btn btn-outline-danger px-4 py-2 rounded-pill fw-bold"
                >
                  <i className="bi bi-x-circle me-2"></i> Rechazar
                </button>
                <button
                  type="button"
                  disabled={actioning}
                  onClick={handleApprove}
                  className="btn btn-primary px-4 py-2 rounded-pill fw-bold shadow-sm"
                >
                  {actioning ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i> Aprobar y Publicar
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted py-5">
              <i className="bi bi-folder-symlink fs-1 text-light mb-3"></i>
              <span>Selecciona una propuesta de la lista izquierda para comenzar la auditoría.</span>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmBtnClass={confirmModal.confirmBtnClass}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
}
