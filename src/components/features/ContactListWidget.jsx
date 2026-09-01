import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ContactCard } from './ContactCard';
import { ContactFormModal } from './ContactFormModal';
import { ConfirmModal } from './admin/ConfirmModal';
import { useUserRole } from '../../contexts/UserRoleContext';

export function ContactListWidget({ leadId = null, clienteId = null, oportunidadId = null, contactosPrecargados = null }) {
  const { isLector: isLectorRole, role } = useUserRole();
  const isLector = isLectorRole || role === 'editor';
  const [contactos, setContactos] = useState([]);
  const [companyContactos, setCompanyContactos] = useState([]); // Específico para oportunidades
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContactoId, setEditingContactoId] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmBtnClass: 'btn-danger',
    confirmText: 'Confirmar',
    onConfirm: null
  });

  const loadContactos = useCallback(async () => {
    if (contactosPrecargados) {
      setLoading(true);
      if (leadId) {
        setContactos(contactosPrecargados.filter(c => c.leadId === leadId || c.lead_id === leadId));
      } else if (clienteId && !oportunidadId) {
        setContactos(contactosPrecargados.filter(c => c.clienteId === clienteId || c.cliente_id === clienteId));
      } else if (oportunidadId) {
        setContactos(contactosPrecargados.filter(c => c.oportunidadId === oportunidadId || c.oportunidad_id === oportunidadId));
        if (clienteId) {
          setCompanyContactos(contactosPrecargados.filter(c => (c.clienteId === clienteId || c.cliente_id === clienteId) && c.oportunidadId !== oportunidadId && c.oportunidad_id !== oportunidadId));
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase.from('contactos').select('*');
      if (leadId) query = query.eq('lead_id', leadId);
      else if (clienteId && !oportunidadId) query = query.eq('cliente_id', clienteId);
      else if (oportunidadId) query = query.eq('oportunidad_id', oportunidadId);
      else {
        setContactos([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;

      const list = (data || []).map(d => ({
        id: d.id,
        nombre: d.nombre,
        email: d.email,
        telefono: d.telefono,
        cargo: d.cargo,
        esPrincipal: d.es_principal,
        clienteId: d.cliente_id,
        leadId: d.lead_id,
        oportunidadId: d.oportunidad_id
      }));

      setContactos(list);

      if (oportunidadId && clienteId) {
        const { data: cData } = await supabase.from('contactos').select('*').eq('cliente_id', clienteId);
        const compList = (cData || [])
          .filter(d => d.oportunidad_id !== oportunidadId)
          .map(d => ({
            id: d.id,
            nombre: d.nombre,
            email: d.email,
            telefono: d.telefono,
            cargo: d.cargo,
            esPrincipal: d.es_principal,
            clienteId: d.cliente_id
          }));
        setCompanyContactos(compList);
      }
    } catch (err) {
      console.error("[ContactListWidget] Error cargando contactos:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, clienteId, oportunidadId, contactosPrecargados]);

  useEffect(() => {
    loadContactos();
  }, [loadContactos]);

  const handleDeleteContacto = (contactoId) => {
    setConfirmModal({
      show: true,
      title: 'Eliminar Contacto',
      message: '¿Estás seguro de que deseas eliminar este contacto? Esta acción eliminará permanentemente el registro de la base de datos.',
      confirmBtnClass: 'btn-danger',
      confirmText: 'Eliminar Contacto',
      onConfirm: async () => {
        try {
          await supabase.from('contactos').delete().eq('id', contactoId);
          loadContactos();
        } catch (err) {
          console.error("[ContactListWidget] Error al eliminar contacto:", err);
        } finally {
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  return (
    <div className="contact-list-widget d-flex flex-column gap-3">
      {/* Cabecera y botón de añadir */}
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.9rem' }}>
          <i className="bi bi-people-fill text-primary"></i>
          Contactos Asociados
        </h6>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm rounded-pill py-1 px-3 d-flex align-items-center gap-1.5 fw-bold"
          style={{ fontSize: '0.72rem' }}
          onClick={() => setShowAddModal(true)}
          disabled={isLector}
          title={isLector ? "Sin permisos para agregar contactos" : "Nuevo Contacto"}
        >
          <i className="bi bi-person-plus-fill"></i>
          Nuevo Contacto
        </button>
      </div>

      {/* Cargando */}
      {loading ? (
        <div className="text-center py-4 text-muted small">
          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
          Cargando contactos...
        </div>
      ) : (
        <div className="d-flex flex-column gap-2.5">
          
          {/* Si no hay ningún contacto en absoluto */}
          {contactos.length === 0 && companyContactos.length === 0 && (
            <div className="text-center py-4 border border-dashed rounded-4 bg-light text-muted small px-3">
              <i className="bi bi-people mb-1 d-block fs-4 text-secondary text-opacity-40"></i>
              No hay contactos registrados para este elemento.
            </div>
          )}

          {/* Listar contactos primarios / directos */}
          {oportunidadId && contactos.length > 0 && (
            <div className="small text-muted fw-bold mb-1" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Contactos de la Negociación ({contactos.length})
            </div>
          )}

          {contactos.map((contact) => (
            <ContactCard 
              key={contact.id} 
              contacto={contact} 
              onEdit={(c) => {
                setEditingContactoId(c.id);
                setShowAddModal(true);
              }}
              onDelete={handleDeleteContacto}
            />
          ))}

          {/* Listar otros contactos de la empresa (sólo en Pipeline de Oportunidades) */}
          {oportunidadId && companyContactos.length > 0 && (
            <div className="mt-2.5">
              <div className="small text-muted fw-bold mb-2" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Otros Contactos de la Empresa ({companyContactos.length})
              </div>
              <div className="d-flex flex-column gap-2.5">
                {companyContactos.map((contact) => (
                  <ContactCard 
                    key={contact.id} 
                    contacto={contact} 
                    onEdit={(c) => {
                      setEditingContactoId(c.id);
                      setShowAddModal(true);
                    }}
                    onDelete={handleDeleteContacto}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Modal de formulario */}
      <ContactFormModal
        show={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingContactoId(null);
        }}
        leadId={leadId}
        clienteId={clienteId}
        oportunidadId={oportunidadId}
        contactoId={editingContactoId}
        onSaved={() => setEditingContactoId(null)}
      />

      {/* Modal de Confirmación Glassmorphic Premium */}
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
