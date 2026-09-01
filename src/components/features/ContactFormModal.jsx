import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';

export function ContactFormModal({ show, onClose, leadId = null, clienteId = null, oportunidadId = null, contactoId = null, onSaved }) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cargo, setCargo] = useState('');
  const [referidoPorNombre, setReferidoPorNombre] = useState('');
  const [referidoPorEmail, setReferidoPorEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [rolDecision, setRolDecision] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [recibirInformacion, setRecibirInformacion] = useState(true);
  
  // Campos dinámicos
  const [dynamicFields, setDynamicFields] = useState([]);
  const [dynamicValues, setDynamicValues] = useState({});
  const [fieldsLoading, setFieldsLoading] = useState(false);

  // Validaciones y estados
  const [loading, setLoading] = useState(false);
  const [emailCheckWarning, setEmailCheckWarning] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const { showAlert } = useToast();

  // Reset del formulario al abrir/cerrar o cambiar de contacto
  useEffect(() => {
    if (!show) return;
    let active = true;

    const initForm = async () => {
      setNombre('');
      setCorreo('');
      setTelefono('');
      setCargo('');
      setLinkedin('');
      setRolDecision('');
      setDepartamento('');
      setReferidoPorNombre('');
      setReferidoPorEmail('');
      setRecibirInformacion(true);
      setDynamicValues({});
      setEmailCheckWarning(false);

      setFieldsLoading(true);
      try {
        const { data: seccData } = await supabase.from('config_secciones').select('id').eq('entidad', 'contacto');
        if (!active) return;
        const seccionIds = (seccData || []).map(s => s.id);

        if (seccionIds.length > 0) {
          const { data: camposData } = await supabase.from('config_campos').select('*').in('seccion_id', seccionIds).order('orden', { ascending: true });
          if (!active) return;
          setDynamicFields(camposData || []);
        } else {
          setDynamicFields([]);
        }

        if (contactoId) {
          setLoading(true);
          const { data: contactData } = await supabase.from('contactos').select('*').eq('id', contactoId).maybeSingle();
          if (!active) return;
          if (contactData) {
            setNombre(contactData.nombre || '');
            setCorreo(contactData.email || contactData.correo || '');
            setTelefono(contactData.telefono || '');
            setCargo(contactData.cargo || '');
            setLinkedin(contactData.linkedin || '');
            setRolDecision(contactData.rol_decision || '');
            setDepartamento(contactData.departamento || '');
            setReferidoPorNombre(contactData.referido_por_nombre || '');
            setReferidoPorEmail(contactData.referido_por_email || '');
            setRecibirInformacion(contactData.recibir_informacion !== false);
            setDynamicValues(contactData.campos_dinamicos || {});
          }
        }
      } catch (err) {
        if (active) {
          console.error("[ContactFormModal] Error al inicializar formulario:", err);
        }
      } finally {
        setFieldsLoading(false);
        setLoading(false);
      }
    };

    initForm();

    return () => {
      active = false;
    };
  }, [show, contactoId]);

  // Validar si el email ya existe en la colección de contactos
  useEffect(() => {
    if (!correo || !show || contactoId) {
      setEmailCheckWarning(false);
      return;
    }

    const checkEmailDup = async () => {
      setCheckingEmail(true);
      try {
        const { data } = await supabase.from('contactos').select('id').eq('email', correo.trim().toLowerCase()).limit(1);
        if (data && data.length > 0) {
          setEmailCheckWarning(true);
        } else {
          setEmailCheckWarning(false);
        }
      } catch (err) {
        console.warn("[ContactFormModal] Error comprobando duplicidad de email:", err);
      } finally {
        setCheckingEmail(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      checkEmailDup();
    }, 600);

    return () => clearTimeout(delayDebounce);
  }, [correo, show, contactoId]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      showAlert('Por favor, ingresa el nombre del contacto.', 'danger');
      return;
    }

    const refEmail = referidoPorEmail.trim();
    if (refEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(refEmail)) {
        showAlert('El formato de correo de la referencia no es válido.', 'warning');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        email: correo.trim().toLowerCase(),
        telefono: telefono.trim(),
        cargo: cargo.trim(),
        linkedin: linkedin.trim() || null,
        rol_decision: rolDecision || null,
        departamento: departamento || null,
        referido_por_nombre: referidoPorNombre.trim() || null,
        referido_por_email: refEmail.toLowerCase() || null,
        recibir_informacion: recibirInformacion,
        campos_dinamicos: dynamicValues
      };

      if (contactoId) {
        await supabase.from('contactos').update(payload).eq('id', contactoId);
        showAlert('Contacto actualizado correctamente.', 'success');
      } else {
        payload.lead_id = leadId || null;
        payload.cliente_id = clienteId || null;
        payload.oportunidad_id = oportunidadId || null;

        await supabase.from('contactos').insert(payload);
        showAlert('Contacto creado correctamente.', 'success');
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error("[ContactFormModal] Error al guardar contacto:", err);
      showAlert('No se pudo guardar el contacto. Revisa tu conexión.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleDynamicChange = (key, val) => {
    setDynamicValues({
      ...dynamicValues,
      [key]: val
    });
  };

  return (
    <div 
      className="modal show d-block" 
      tabIndex="-1" 
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 1200 }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="modal-header border-bottom p-3 px-4 bg-white d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                <i className="bi bi-person-plus-fill fs-5"></i>
              </div>
              <div>
                <h6 className="modal-title fw-bold text-dark mb-0">
                  {contactoId ? '✏️ Editar Contacto' : '👤 Nuevo Contacto'}
                </h6>
                <span className="small text-muted" style={{ fontSize: '0.78rem' }}>
                  {contactoId ? 'Actualiza los datos del contacto y rol comercial' : 'Registra un contacto clave asociado a esta cuenta'}
                </span>
              </div>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose} 
              disabled={loading}
            ></button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
              
              {/* Nombre */}
              <div className="mb-3">
                <label className="form-label text-dark small fw-bold mb-1">Nombre Completo <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  placeholder="Ej. Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Cargo */}
              <div className="mb-3">
                <label className="form-label text-dark small fw-bold mb-1">Cargo / Rol Comercial</label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  placeholder="Ej. Director de Compras"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Correo */}
              <div className="mb-3">
                <label className="form-label text-dark small fw-bold mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  className={`form-control rounded-3 ${emailCheckWarning ? 'is-invalid' : ''}`}
                  placeholder="Ej. juan.perez@empresa.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  disabled={loading}
                />
                {emailCheckWarning && (
                  <div className="invalid-feedback d-block mt-1 small" style={{ fontSize: '0.72rem' }}>
                    <i className="bi bi-exclamation-triangle-fill me-1"></i> Este correo ya se encuentra registrado para otro contacto en el CRM.
                  </div>
                )}
                {checkingEmail && (
                  <div className="form-text text-muted small mt-1">
                    <span className="spinner-border spinner-border-sm me-1" style={{ width: '12px', height: '12px' }}></span>
                    Validando correo...
                  </div>
                )}
              </div>

              {/* Teléfono */}
              <div className="mb-3">
                <label className="form-label text-dark small fw-bold mb-1">Teléfono</label>
                <input
                  type="tel"
                  className="form-control rounded-3"
                  placeholder="Ej. +51 987 654 321"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Perfil de LinkedIn */}
              <div className="mb-3">
                <label className="form-label text-dark small fw-bold mb-1 d-flex align-items-center gap-1">
                  <i className="bi bi-linkedin text-primary"></i> Perfil de LinkedIn
                </label>
                <input
                  type="url"
                  className="form-control rounded-3"
                  placeholder="Ej. https://www.linkedin.com/in/juanperez"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Rol de Decisión y Área */}
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label text-dark small fw-bold mb-1">Rol en Decisión de Compra</label>
                  <select
                    className="form-select rounded-3"
                    value={rolDecision}
                    onChange={(e) => setRolDecision(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Selecciona rol...</option>
                    <option value="decision_maker">👑 Toma de Decisión (Decision Maker)</option>
                    <option value="economic_buyer">💰 Comprador Económico</option>
                    <option value="champion">⭐ Promotor / Sponsor (Champion)</option>
                    <option value="technical_evaluator">⚙️ Evaluador Técnico (TI/Ops)</option>
                    <option value="end_user">👤 Usuario Final</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label text-dark small fw-bold mb-1">Área / Departamento</label>
                  <select
                    className="form-select rounded-3"
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Selecciona área...</option>
                    <option value="direccion">👔 Dirección General / C-Level</option>
                    <option value="comercial">📈 Comercial & Ventas</option>
                    <option value="operaciones">⚙️ Operaciones</option>
                    <option value="compras">🛍️ Compras & Abastecimiento</option>
                    <option value="ti">💻 Tecnología & Sistemas</option>
                    <option value="cx">🎧 Servicio al Cliente (CX)</option>
                    <option value="finanzas">💵 Finanzas & Administración</option>
                    <option value="otro">🏢 Otro Área</option>
                  </select>
                </div>
              </div>

              {/* Referencia Luxia (Nombre y Email) */}
              <div className="row g-2 mb-3 pt-2 border-top">
                <div className="col-12">
                  <span className="text-muted small fw-bold" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Referencia Interna</span>
                </div>
                <div className="col-6">
                  <label className="form-label text-dark small fw-bold mb-1">Referido por (Nombre)</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    placeholder="Ej. Juan Pérez"
                    value={referidoPorNombre}
                    onChange={(e) => setReferidoPorNombre(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label text-dark small fw-bold mb-1">Referido por (Email)</label>
                  <input
                    type="email"
                    className="form-control rounded-3"
                    placeholder="Ej. jperez@luxia.com"
                    value={referidoPorEmail}
                    onChange={(e) => setReferidoPorEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Consentimiento para Recibir Información */}
              <div className="mb-3 p-3 bg-light rounded-3 border">
                <div className="form-check form-switch d-flex align-items-center justify-content-between p-0">
                  <div className="me-3">
                    <label className="form-check-label text-dark small fw-bold d-block" htmlFor="recibirInformacionSwitch">
                      ¿Desea recibir información de Luxia?
                    </label>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      Autoriza el envío de información comercial y novedades en el futuro.
                    </span>
                  </div>
                  <input
                    className="form-check-input ms-0"
                    type="checkbox"
                    role="switch"
                    id="recibirInformacionSwitch"
                    checked={recibirInformacion}
                    onChange={(e) => setRecibirInformacion(e.target.checked)}
                    disabled={loading}
                    style={{ width: '2.5rem', height: '1.25rem' }}
                  />
                </div>
              </div>

              {/* Campos Dinámicos */}
              {fieldsLoading ? (
                <div className="text-center py-3 text-muted small">
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Cargando campos personalizados...
                </div>
              ) : (
                dynamicFields.length > 0 && (
                  <div className="border-top pt-3 mt-3">
                    <h6 className="fw-bold text-dark mb-3 small" style={{ fontSize: '0.75rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      Campos Personalizados
                    </h6>
                    <div className="row g-3">
                      {dynamicFields.map((field) => (
                        <div className="col-12" key={field.id}>
                          <label className="form-label text-muted small fw-bold mb-1">{field.nombre}</label>
                          {field.tipo === 'select' ? (
                            <select
                              className="form-select rounded-3"
                              value={dynamicValues[field.key] || ''}
                              onChange={(e) => handleDynamicChange(field.key, e.target.value)}
                              disabled={loading}
                            >
                              <option value="">Seleccionar...</option>
                              {field.opciones?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.tipo === 'boolean' ? (
                            <div className="form-check form-switch mt-1">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                checked={dynamicValues[field.key] === true}
                                onChange={(e) => handleDynamicChange(field.key, e.target.checked)}
                                disabled={loading}
                              />
                            </div>
                          ) : (
                            <input
                              type={field.tipo === 'number' ? 'number' : 'text'}
                              className="form-control rounded-3"
                              value={dynamicValues[field.key] || ''}
                              onChange={(e) => handleDynamicChange(field.key, e.target.value)}
                              disabled={loading}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

            </div>

            {/* Footer */}
            <div className="modal-footer border-top p-3 d-flex justify-content-end gap-2 bg-light">
              <button
                type="button"
                className="btn btn-outline-secondary rounded-pill px-4 fw-bold"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary rounded-pill px-4 text-white fw-bold d-flex align-items-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    Guardar Contacto
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
