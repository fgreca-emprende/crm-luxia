import { ContactQuickActions } from './ContactQuickActions';
import { useUserRole } from '../../contexts/UserRoleContext';

// Función para generar un color HSL único y agradable según el nombre del contacto
function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  // Mantener saturación en 55-65% y luminosidad en 40-50% para colores pastel oscuros/elegantes
  return `hsl(${h}, 60%, 45%)`;
}

// Obtener iniciales del nombre
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ContactCard({ contacto, onEdit, onDelete }) {
  if (!contacto) return null;

  const { isLector: isLectorRole, role } = useUserRole();
  const isLector = isLectorRole || role === 'editor';
  const initials = getInitials(contacto.nombre);
  const avatarColor = getAvatarColor(contacto.nombre);

  return (
    <div className="contact-card p-3 rounded-4 bg-white border border-secondary border-opacity-10 contact-card-container transition-all hover-shadow">
      <div className="contact-info-section min-w-0">
        {/* Avatar */}
        <div 
          className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs shrink-0"
          style={{ 
            width: '40px', 
            height: '40px', 
            backgroundColor: avatarColor,
            fontFamily: "'Outfit', sans-serif",
            fontSize: '0.85rem',
            letterSpacing: '0.5px'
          }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-grow-1">
          <h6 className="fw-bold text-dark mb-0.5 text-truncate" style={{ fontSize: '0.84rem', fontFamily: "'Outfit', sans-serif" }}>
            {contacto.nombre}
          </h6>
          {(contacto.cargo || contacto.puesto) && (
            <span className="text-muted d-block text-truncate mb-1" style={{ fontSize: '0.7rem', fontWeight: '500' }}>
              {contacto.cargo || contacto.puesto}
            </span>
          )}
          <div className="d-flex flex-column gap-0.5">
            {(contacto.correo || contacto.email) && (
              <span className="text-muted text-truncate d-flex align-items-center gap-1.5" style={{ fontSize: '0.66rem' }}>
                <i className="bi bi-envelope text-secondary text-opacity-50"></i>
                {contacto.correo || contacto.email}
              </span>
            )}
            {contacto.telefono && (
              <span className="text-muted text-truncate d-flex align-items-center gap-1.5" style={{ fontSize: '0.66rem' }}>
                <i className="bi bi-telephone text-secondary text-opacity-50"></i>
                {contacto.telefono}
              </span>
            )}
            {(contacto.linkedin || contacto.linkedinUrl) && (
              <a 
                href={(contacto.linkedin || contacto.linkedinUrl).startsWith('http') ? (contacto.linkedin || contacto.linkedinUrl) : `https://${contacto.linkedin || contacto.linkedinUrl}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary text-decoration-none text-truncate d-flex align-items-center gap-1.5 fw-semibold" 
                style={{ fontSize: '0.66rem' }}
                title="Ver perfil de LinkedIn"
              >
                <i className="bi bi-linkedin text-primary"></i>
                LinkedIn
              </a>
            )}
            {contacto.rolDecision && (
              <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 mt-1 align-self-start" style={{ fontSize: '0.62rem' }}>
                {contacto.rolDecision === 'decision_maker' && '👑 Decision Maker'}
                {contacto.rolDecision === 'economic_buyer' && '💰 Comprador Económico'}
                {contacto.rolDecision === 'champion' && '⭐ Champion'}
                {contacto.rolDecision === 'technical_evaluator' && '⚙️ Evaluador Técnico'}
                {contacto.rolDecision === 'end_user' && '👤 Usuario Final'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Botones de acción rápida */}
      <div className="contact-actions-section d-flex align-items-center">
        {!isLector && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(contacto)}
            className="btn btn-icon btn-outline-secondary d-flex align-items-center justify-content-center border-opacity-75 transition-transform me-1.5"
            style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              padding: 0,
              fontSize: '0.8rem' 
            }}
            title="Editar contacto"
          >
            <i className="bi bi-pencil-fill text-muted"></i>
          </button>
        )}
        {!isLector && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(contacto.id)}
            className="btn btn-icon btn-outline-danger d-flex align-items-center justify-content-center border-opacity-75 transition-transform me-1.5"
            style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              padding: 0,
              fontSize: '0.8rem' 
            }}
            title="Eliminar contacto"
          >
            <i className="bi bi-trash-fill"></i>
          </button>
        )}
        <ContactQuickActions contacto={contacto} />
      </div>

      {/* Badges de Referencia y Consentimiento */}
      <div className="w-100 mt-2 pt-2 border-top d-flex flex-wrap gap-1.5 align-items-center">
        {(contacto.referidoPorNombre || contacto.referidoPorEmail) && (
          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-20 d-flex align-items-center gap-1 py-1.5 px-2.5 rounded-pill" style={{ fontSize: '0.66rem' }}>
            <i className="bi bi-person-badge-fill text-primary"></i>
            Referido: {contacto.referidoPorNombre || ''} {contacto.referidoPorEmail ? `(${contacto.referidoPorEmail})` : ''}
          </span>
        )}
        <span className={`badge ${contacto.recibirInformacion !== false ? 'bg-success bg-opacity-10 text-success border-success border-opacity-20' : 'bg-danger bg-opacity-10 text-danger border-danger border-opacity-20'} border d-flex align-items-center gap-1 py-1.5 px-2.5 rounded-pill`} style={{ fontSize: '0.66rem' }}>
          <i className={contacto.recibirInformacion !== false ? 'bi bi-check-circle-fill' : 'bi bi-x-circle-fill'}></i>
          {contacto.recibirInformacion !== false ? 'Recibe Info' : 'No Recibe Info'}
        </span>
      </div>

      <style>{`
        .contact-card-container {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .contact-info-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1 1 180px; /* Base flexible, cae si mide menos de 180px */
        }
        .contact-actions-section {
          margin-left: auto;
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .hover-shadow {
          transition: all 0.25s ease-in-out;
        }
        .hover-shadow:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
          border-color: rgba(13, 110, 253, 0.15) !important;
        }
        .shrink-0 {
          flex-shrink: 0;
        }
        .mb-0.5 {
          margin-bottom: 0.125rem;
        }
        .gap-0.5 {
          gap: 0.125rem;
        }
      `}</style>
    </div>
  );
}
