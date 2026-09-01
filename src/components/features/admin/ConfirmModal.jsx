export function ConfirmModal({ 
  show, 
  title, 
  message, 
  confirmBtnClass = 'btn-primary', 
  confirmText = 'Confirmar', 
  secondaryConfirmText,
  onSecondaryConfirm,
  onConfirm, 
  onClose 
}) {
  if (!show) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1100 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '420px' }}>
        <div className="modal-content glass-panel border border-white border-opacity-10 shadow-lg rounded-4 overflow-hidden">
          <div className="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-center">
            <h5 className="modal-title fw-bold text-dark d-flex align-items-center" style={{ fontFamily: "'Outfit', sans-serif" }}>
              <i className="bi bi-exclamation-triangle-fill text-warning me-2 fs-5"></i> {title}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body px-4 py-3">
            <p className="small text-muted mb-0" style={{ lineHeight: '1.5' }}>
              {message}
            </p>
          </div>
          <div className="modal-footer border-0 px-4 pb-4 pt-2 d-flex gap-2">
            <button 
              type="button" 
              className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold flex-grow-1" 
              onClick={onClose}
            >
              Cancelar
            </button>
            {secondaryConfirmText && onSecondaryConfirm && (
              <button 
                type="button" 
                className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold flex-grow-1 shadow-sm" 
                onClick={onSecondaryConfirm}
              >
                {secondaryConfirmText}
              </button>
            )}
            <button 
              type="button" 
              className={`btn btn-sm ${confirmBtnClass} rounded-pill px-3 fw-bold flex-grow-1 shadow-sm`} 
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
