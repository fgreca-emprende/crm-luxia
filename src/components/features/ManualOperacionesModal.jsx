import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getConfigGeneral } from '../../lib/configGeneral';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { useUserRole } from '../../contexts/UserRoleContext';
import { MANUAL_OPERACIONES_MD } from '../../docs/manual_operaciones';
import { MANUAL_TECNICO_MD } from '../../docs/manual_tecnico';

export function ManualOperacionesModal({ show, onClose, user }) {
  const { role, isAdmin, hasPermission } = useUserRole();
  const hasTechPermission = hasPermission('views', 'referencia_tecnica') || hasPermission('referencia_tecnica');
  const [activeDoc, setActiveDoc] = useState('operaciones');
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    setActiveDoc('operaciones');
    onClose();
  };

  useEffect(() => {
    if (!show) return;

    const fetchManual = async () => {
      setLoading(true);
      setError(null);
      try {
        const manualKey = activeDoc === 'tecnico' ? 'manual_tecnico' : 'manual_operaciones';
        const conf = await getConfigGeneral(manualKey);
        
        if (conf && conf.contenido) {
          setMarkdown(conf.contenido);
        } else {
          setMarkdown(activeDoc === 'tecnico' ? MANUAL_TECNICO_MD : MANUAL_OPERACIONES_MD);
        }
      } catch (err) {
        // Fallback a los manuales empaquetados
        setMarkdown(activeDoc === 'tecnico' ? MANUAL_TECNICO_MD : MANUAL_OPERACIONES_MD);
      } finally {
        setLoading(false);
      }
    };

    fetchManual();
  }, [show, activeDoc, role, isAdmin]);

  const handleDownloadMD = () => {
    const filename = activeDoc === 'tecnico' ? 'Referencia_Tecnica_LUXIA_Agro.md' : 'Manual_Operaciones_LUXIA_Agro.md';
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!show) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-md-down">
        <div className="modal-content border-0 shadow-lg rounded-4" style={{ background: 'var(--apple-surface-elevated, #ffffff)', borderColor: 'var(--apple-border)' }}>
          <div className="modal-header border-bottom-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-start">
            <div>
              <h4 className="modal-title fw-bold mb-1" style={{ color: 'var(--apple-text-primary)' }}>
                <i className="bi bi-journal-text text-primary me-2"></i> Ayuda y Documentación CRM
              </h4>
              <p className="text-muted small mb-0">LUXIA® Agro · Base de Conocimiento y Guías Oficiales del Sistema</p>
            </div>
            <button type="button" className="btn-close" onClick={handleClose} aria-label="Cerrar"></button>
          </div>

          <div className="px-4 pt-3">
            {hasTechPermission && (
              <div className="d-flex gap-2 p-1 rounded-pill" style={{ width: 'fit-content', background: 'var(--apple-surface-subtle, rgba(0,0,0,0.05))', border: '1px solid var(--apple-border)' }}>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill px-3 py-1.5 fw-bold border-0 transition-all ${activeDoc === 'operaciones' ? 'btn-primary text-white shadow-sm' : 'text-muted bg-transparent'}`}
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => setActiveDoc('operaciones')}
                >
                  📖 Manual de Operaciones Agro
                </button>
                <button
                  type="button"
                  className={`btn btn-xs rounded-pill px-3 py-1.5 fw-bold border-0 transition-all ${activeDoc === 'tecnico' ? 'btn-primary text-white shadow-sm' : 'text-muted bg-transparent'}`}
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => setActiveDoc('tecnico')}
                >
                  ⚙️ Referencia Técnica de Arquitectura
                </button>
              </div>
            )}
          </div>

          <div className="modal-body px-4 pb-4 markdown-container pt-3">
            {loading ? (
              <div className="py-5 text-center">
                <SpinnerPremium size="md" text="Cargando documentación..." />
              </div>
            ) : error ? (
              <div className="alert alert-danger my-3" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
              </div>
            ) : (
              <div className="markdown-body small mt-2" style={{ lineHeight: '1.65', color: 'var(--apple-text-primary)' }}>
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </div>
            )}
          </div>

          <div className="modal-footer border-top-0 pt-0 px-4 pb-4 d-flex justify-content-between">
            <button 
              type="button"
              onClick={handleDownloadMD}
              className="btn btn-outline-primary rounded-pill px-4 shadow-sm"
              style={{ fontSize: '0.82rem' }}
            >
              <i className="bi bi-download me-2"></i> Descargar Documento (MD)
            </button>
            <button type="button" className="btn btn-secondary rounded-pill px-4" style={{ fontSize: '0.82rem' }} onClick={handleClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
