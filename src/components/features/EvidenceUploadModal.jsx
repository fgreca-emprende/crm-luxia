import { useState, useRef } from 'react';
import { useToast } from '../ui/ToastProvider';

export function EvidenceUploadModal({ show, onClose, onConfirm, paso, clienteId }) {
  const [activeTab, setActiveTab] = useState('link'); // 'link' o 'file'
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { showAlert } = useToast();

  if (!show) return null;

  const esObligatoria = paso?.evidenciaObligatoria;

  const handleConfirmWithoutEvidence = () => {
    if (esObligatoria) {
      showAlert('Este hito requiere evidencia de forma obligatoria.', 'warning');
      return;
    }
    onConfirm(null);
  };

  const handleUploadAndConfirm = async () => {
    if (activeTab === 'link') {
      if (!linkUrl.trim()) {
        showAlert('Por favor ingresa un enlace válido.', 'warning');
        return;
      }
      onConfirm({ tipo: 'link', url: linkUrl.trim(), nombre: 'Enlace Adjunto' });
    } else {
      if (!file) {
        showAlert('Por favor selecciona un archivo.', 'warning');
        return;
      }

      // Validar tamaño (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        showAlert('El archivo excede el límite de 10 MB.', 'warning');
        return;
      }

      setIsUploading(true);
      try {
        const fileUrl = URL.createObjectURL(file);
        onConfirm({ tipo: 'archivo', url: fileUrl, nombre: file.name });
        setIsUploading(false);
      } catch (err) {
        console.error(err);
        showAlert('Error inesperado al procesar la evidencia.', 'danger');
        setIsUploading(false);
      }
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 rounded-4 shadow">
            <div className="modal-header border-bottom-0 pt-4 pb-0 px-4">
              <h5 className="modal-title fw-bold text-dark d-flex align-items-center">
                <i className="bi bi-shield-check text-primary me-2"></i>Verificar Hito
              </h5>
              <button type="button" className="btn-close" onClick={onClose} disabled={isUploading}></button>
            </div>
            
            <div className="modal-body px-4 pt-3 pb-4">
              <p className="small text-muted mb-4">
                Estás marcando como completado: <strong>{paso?.titulo}</strong>.
                {esObligatoria 
                  ? <span className="text-danger fw-bold ms-1">Requiere evidencia obligatoria.</span>
                  : <span className="ms-1">Puedes adjuntar evidencia de respaldo (opcional).</span>
                }
              </p>

              {/* Tabs */}
              <ul className="nav nav-pills nav-fill mb-4 gap-2">
                <li className="nav-item">
                  <button 
                    className={`nav-link rounded-pill py-2 small fw-bold ${activeTab === 'link' ? 'active' : 'bg-light text-muted'}`}
                    onClick={() => setActiveTab('link')}
                    disabled={isUploading}
                  >
                    <i className="bi bi-link-45deg me-1"></i>Pegar Enlace
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link rounded-pill py-2 small fw-bold ${activeTab === 'file' ? 'active' : 'bg-light text-muted'}`}
                    onClick={() => setActiveTab('file')}
                    disabled={isUploading}
                  >
                    <i className="bi bi-cloud-arrow-up me-1"></i>Subir Archivo
                  </button>
                </li>
              </ul>

              {/* Tab Content */}
              {activeTab === 'link' && (
                <div className="mb-3">
                  <label className="form-label small fw-bold">URL de la evidencia (Google Drive, Jira, etc.)</label>
                  <input 
                    type="url" 
                    className="form-control bg-light" 
                    placeholder="https://..." 
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    disabled={isUploading}
                  />
                </div>
              )}

              {activeTab === 'file' && (
                <div className="mb-3">
                  <label className="form-label small fw-bold">Archivo de respaldo (PDF, DOCX, JPG, PNG)</label>
                  <input 
                    type="file" 
                    className="form-control bg-light" 
                    ref={fileInputRef}
                    onChange={e => setFile(e.target.files[0])}
                    disabled={isUploading}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <div className="form-text small">Máximo 10 MB.</div>

                  {isUploading && (
                    <div className="mt-3">
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="fw-bold text-primary">Subiendo...</span>
                        <span className="fw-bold">{uploadProgress}%</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div 
                          className="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                          role="progressbar" 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="modal-footer border-top-0 px-4 pb-4">
              {!esObligatoria && (
                <button 
                  className="btn btn-outline-secondary rounded-pill px-4 me-auto" 
                  onClick={handleConfirmWithoutEvidence}
                  disabled={isUploading}
                >
                  Omitir Evidencia
                </button>
              )}
              <button 
                className="btn btn-primary rounded-pill px-4 fw-bold" 
                onClick={handleUploadAndConfirm}
                disabled={isUploading || (activeTab === 'link' && !linkUrl) || (activeTab === 'file' && !file)}
              >
                <i className="bi bi-check2-circle me-1"></i>
                {isUploading ? 'Procesando...' : 'Confirmar Hito'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
