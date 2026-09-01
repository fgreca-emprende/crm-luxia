import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../../lib/configGeneral';
import { useToast } from '../../../ui/ToastProvider';
import { ConfirmModal } from '../../admin/ConfirmModal';

const ENTITY_STANDARD_FIELDS = {
  lead: [
    { id: 'nombreContacto', label: 'Nombre del Contacto', required: true, isCustom: false, disabled: true, type: 'text' },
    { id: 'correo', label: 'Correo Electrónico', required: true, isCustom: false, disabled: true, type: 'email' },
    { id: 'nombreEmpresa', label: 'Nombre de la Empresa', required: true, isCustom: false, disabled: true, type: 'text' },
    { id: 'telefono', label: 'WhatsApp / Teléfono', required: false, isCustom: false, type: 'tel' },
    { id: 'pais', label: 'País', required: false, isCustom: false, type: 'select' },
    { id: 'notas', label: 'Notas Comerciales / Mensaje', required: false, isCustom: false, type: 'textarea' }
  ],
  contacto: [
    { id: 'nombreContacto', label: 'Nombre del Contacto', required: true, isCustom: false, disabled: true, type: 'text' },
    { id: 'correo', label: 'Correo Electrónico', required: true, isCustom: false, disabled: true, type: 'email' },
    { id: 'nombreEmpresa', label: 'Nombre de la Empresa / Cliente Asocio', required: true, isCustom: false, disabled: true, type: 'text' },
    { id: 'telefono', label: 'WhatsApp / Teléfono', required: false, isCustom: false, type: 'tel' },
    { id: 'puesto', label: 'Puesto / Cargo', required: false, isCustom: false, type: 'text' },
    { id: 'notas', label: 'Mensaje / Observaciones', required: false, isCustom: false, type: 'textarea' }
  ],
  oportunidad: [
    { id: 'nombreEmpresa', label: 'Nombre de la Empresa / Cliente', required: true, isCustom: false, disabled: true, type: 'text' },
    { id: 'nombreContacto', label: 'Contacto de Referencia', required: true, isCustom: false, disabled: true, type: 'text' },
    { id: 'correo', label: 'Correo Electrónico', required: true, isCustom: false, disabled: true, type: 'email' },
    { id: 'telefono', label: 'Teléfono de Contacto', required: false, isCustom: false, type: 'tel' },
    { id: 'valor', label: 'Monto Estimado (USD)', required: false, isCustom: false, type: 'number' },
    { id: 'servicio', label: 'Línea Fitosanitaria / Producto Solicitado', required: false, isCustom: false, type: 'text' },
    { id: 'notas', label: 'Detalles de la Oportunidad', required: false, isCustom: false, type: 'textarea' }
  ],
  ticket: [
    { id: 'nombreContacto', label: 'Nombre del Solicitante', required: true, isCustom: false, disabled: true, type: 'text' },
    { id: 'correo', label: 'Correo Electrónico', required: true, isCustom: false, disabled: true, type: 'email' },
    { id: 'nombreEmpresa', label: 'Nombre de la Empresa / Cliente', required: true, isCustom: false, disabled: true, type: 'text' },
    { id: 'telefono', label: 'WhatsApp / Teléfono', required: false, isCustom: false, type: 'tel' },
    { id: 'categoria', label: 'Categoría de Incidencia', required: false, isCustom: false, type: 'select' },
    { id: 'prioridad', label: 'Prioridad Requerida', required: false, isCustom: false, type: 'select' },
    { id: 'notas', label: 'Descripción del Problema / Reclamo', required: true, isCustom: false, disabled: true, type: 'textarea' }
  ]
};

export function WebFormsManager() {
  const { showAlert } = useToast();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [camposConfig, setCamposConfig] = useState([]);
  const [seccionesConfig, setSeccionesConfig] = useState([]);

  // Form State for Create/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingFormId, setEditingFormId] = useState(null);
  const [formNombre, setFormNombre] = useState('');
  const [formPaisDefault, setFormPaisDefault] = useState('select'); // 'select' o 'MX', 'PE', 'CO', 'CL', 'AR'
  const [formOrigen, setFormOrigen] = useState('web_inbound');
  const [formActivo, setFormActivo] = useState(true);
  const [formTipoEntidadTarget, setFormTipoEntidadTarget] = useState('lead');
  const [includedFields, setIncludedFields] = useState([]); // Array of { id, label, required, isCustom, disabled, type, opciones }

  // Action states
  const [confirmDeleteFormId, setConfirmDeleteFormId] = useState(null);
  const [copiedFormId, setCopiedFormId] = useState(null);
  const [copiedIframeId, setCopiedIframeId] = useState(null);

  // Load sections and custom fields configuration and forms list
  const loadData = useCallback(async () => {
    try {
      // 1. Fetch custom sections
      const { data: secData } = await supabase
        .from('config_secciones')
        .select('*')
        .order('orden', { ascending: true });
      if (secData) setSeccionesConfig(secData);

      // 2. Fetch custom fields
      const { data: camposData } = await supabase
        .from('config_campos')
        .select('*')
        .order('orden', { ascending: true });
      if (camposData) setCamposConfig(camposData);

      // 3. Fetch web forms
      const formsData = await getConfigGeneral('crm_formularios_web');
      setForms(Array.isArray(formsData) ? formsData : []);
    } catch (err) {
      console.warn('Error cargando datos de formularios web:', err);
      showAlert('Error al cargar la lista de formularios web.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map of sectionId to entity
  const seccionesMap = seccionesConfig.reduce((acc, sec) => {
    acc[sec.id] = sec.entidad;
    return acc;
  }, {});

  // Helper: get standard fields for current target entity
  const getStandardFieldsForEntity = (targetEntity) => {
    return ENTITY_STANDARD_FIELDS[targetEntity] || ENTITY_STANDARD_FIELDS['lead'];
  };

  // Helper: get custom fields applicable to target entity
  const getCustomFieldsForEntity = (targetEntity) => {
    return camposConfig.filter(c => {
      const fieldEntity = c.entidad || seccionesMap[c.seccionId];
      return !fieldEntity || fieldEntity === targetEntity || fieldEntity === 'all';
    });
  };

  // Build current included fields list when creating or editing
  const buildIncludedFields = (targetEntity, existingSavedFields = null) => {
    const stdFields = getStandardFieldsForEntity(targetEntity);
    const customFields = getCustomFieldsForEntity(targetEntity);

    if (existingSavedFields && existingSavedFields.length > 0) {
      const list = [];
      existingSavedFields.forEach(saved => {
        const stdMatch = stdFields.find(f => f.id === saved.id);
        const customMatch = customFields.find(c => c.id === saved.id);

        if (stdMatch) {
          list.push({
            id: stdMatch.id,
            label: saved.label || stdMatch.label,
            required: saved.required !== undefined ? saved.required : stdMatch.required,
            isCustom: false,
            disabled: !!stdMatch.disabled,
            type: stdMatch.type,
            opciones: stdMatch.opciones || null
          });
        } else if (customMatch) {
          list.push({
            id: customMatch.id,
            label: saved.label || customMatch.nombre,
            required: saved.required !== undefined ? saved.required : false,
            isCustom: true,
            disabled: false,
            type: customMatch.tipo || 'text',
            opciones: customMatch.opciones || null
          });
        } else {
          // Backward compatibility for custom field created outside or standard
          list.push({
            id: saved.id,
            label: saved.label || saved.id,
            required: !!saved.required,
            isCustom: !!saved.isCustom,
            disabled: false,
            type: 'text',
            opciones: null
          });
        }
      });

      // Ensure mandatory fields for target entity are present
      stdFields.forEach(std => {
        if (std.disabled && !list.some(f => f.id === std.id)) {
          list.unshift({
            id: std.id,
            label: std.label,
            required: true,
            isCustom: false,
            disabled: true,
            type: std.type
          });
        }
      });

      return list;
    } else {
      // Default creation: include all mandatory standard fields
      return stdFields.filter(f => f.disabled).map(std => ({
        id: std.id,
        label: std.label,
        required: true,
        isCustom: false,
        disabled: true,
        type: std.type
      }));
    }
  };

  const handleOpenCreate = () => {
    const defaultTarget = 'lead';
    setEditingFormId(null);
    setFormNombre('');
    setFormPaisDefault('select');
    setFormOrigen('web_inbound');
    setFormActivo(true);
    setFormTipoEntidadTarget(defaultTarget);
    setIncludedFields(buildIncludedFields(defaultTarget));
    setShowModal(true);
  };

  const handleOpenEdit = (form) => {
    const target = form.tipoEntidadTarget || 'lead';
    setEditingFormId(form.id);
    setFormNombre(form.nombre || '');
    setFormPaisDefault(form.paisDefault || 'select');
    setFormOrigen(form.origen || 'web_inbound');
    setFormActivo(form.activo !== false);
    setFormTipoEntidadTarget(target);
    setIncludedFields(buildIncludedFields(target, form.campos));
    setShowModal(true);
  };

  // Switch Target Entity in Modal
  const handleEntityTargetChange = (newTarget) => {
    setFormTipoEntidadTarget(newTarget);
    setIncludedFields(prev => buildIncludedFields(newTarget, prev));
  };

  // Add field from Available Pool to Included
  const handleAddFieldToForm = (fieldObj) => {
    setIncludedFields(prev => [
      ...prev,
      {
        id: fieldObj.id,
        label: fieldObj.label || fieldObj.nombre,
        required: !!fieldObj.required,
        isCustom: !!fieldObj.isCustom,
        disabled: false,
        type: fieldObj.type || fieldObj.tipo || 'text',
        opciones: fieldObj.opciones || null
      }
    ]);
  };

  // Remove field from Included back to Available Pool
  const handleRemoveFieldFromForm = (fieldId) => {
    setIncludedFields(prev => prev.filter(f => f.id !== fieldId || f.disabled));
  };

  // Toggle Required
  const handleFieldRequiredToggle = (fieldId) => {
    setIncludedFields(prev => prev.map(f => {
      if (f.id === fieldId && !f.disabled) {
        return { ...f, required: !f.required };
      }
      return f;
    }));
  };

  // Update Field Label
  const handleFieldLabelChange = (fieldId, newLabel) => {
    setIncludedFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        return { ...f, label: newLabel };
      }
      return f;
    }));
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      showAlert('El nombre del formulario es obligatorio.', 'warning');
      return;
    }

    try {
      const fieldsList = includedFields.map(f => ({
        id: f.id,
        label: f.label.trim(),
        required: f.required,
        isCustom: f.isCustom
      }));

      const docId = editingFormId || ('form_' + Date.now());

      const payload = {
        id: docId,
        nombre: formNombre.trim(),
        paisDefault: formPaisDefault,
        origen: formOrigen.trim() || 'web_inbound',
        activo: formActivo,
        tipoEntidadTarget: formTipoEntidadTarget,
        campos: fieldsList,
        updatedAt: new Date().toISOString()
      };

      if (!editingFormId) {
        payload.creadoEn = new Date().toISOString();
      }

      const currentForms = (await getConfigGeneral('crm_formularios_web')) || [];
      let updated = [];
      if (editingFormId) {
        updated = currentForms.map(f => f.id === editingFormId ? { ...f, ...payload } : f);
      } else {
        updated = [payload, ...currentForms];
      }

      await setConfigGeneral('crm_formularios_web', updated);
      setForms(updated);

      showAlert(editingFormId ? 'Formulario actualizado con éxito.' : 'Formulario creado con éxito.', 'success');
      setShowModal(false);
    } catch (err) {
      console.warn('Error saving web form:', err);
      showAlert('Error al guardar el formulario.', 'danger');
    }
  };

  const handleDeleteForm = async () => {
    if (!confirmDeleteFormId) return;
    try {
      const currentForms = (await getConfigGeneral('crm_formularios_web')) || [];
      const updated = currentForms.filter(f => f.id !== confirmDeleteFormId);
      await setConfigGeneral('crm_formularios_web', updated);
      setForms(updated);
      showAlert('Formulario eliminado con éxito.', 'success');
      setConfirmDeleteFormId(null);
    } catch (err) {
      console.warn('Error deleting web form:', err);
      showAlert('Error al eliminar el formulario.', 'danger');
    }
  };

  const copyToClipboard = (text, type, formId) => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedFormId(formId);
      setTimeout(() => setCopiedFormId(null), 2000);
    } else {
      setCopiedIframeId(formId);
      setTimeout(() => setCopiedIframeId(null), 2000);
    }
    showAlert('Copiado al portapapeles con éxito', 'success');
  };

  // Compute available pool fields for current entity target
  const stdFields = getStandardFieldsForEntity(formTipoEntidadTarget);
  const customFields = getCustomFieldsForEntity(formTipoEntidadTarget);
  const includedIdsSet = new Set(includedFields.map(f => f.id));

  const availableStandardFields = stdFields.filter(f => !includedIdsSet.has(f.id));
  const availableCustomFields = customFields.filter(c => !includedIdsSet.has(c.id));

  const getTypeBadge = (type) => {
    switch (type) {
      case 'select': return <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>Select</span>;
      case 'checkbox': return <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>Checkbox</span>;
      case 'date': return <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>Fecha</span>;
      case 'number': return <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>Número</span>;
      case 'textarea': return <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>Multilínea</span>;
      case 'email': return <span className="badge bg-purple-subtle text-purple border border-purple-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>Email</span>;
      case 'tel': return <span className="badge bg-dark-subtle text-dark border border-dark-subtle rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>Teléfono</span>;
      default: return <span className="badge bg-light text-dark border rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>Texto</span>;
    }
  };

  const host = window.location.origin;

  return (
    <div className="card border-0 bg-white shadow-sm rounded-4 w-100">
      <div className="card-body p-4 p-xl-5">
        
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-light rounded p-2 border">
              <i className="bi bi-window-sidebar fs-3 text-dark"></i>
            </div>
            <div>
              <h5 className="fw-bold mb-0 text-dark">Constructor de Formularios Inbound</h5>
              <span className="small text-muted">Diseña formularios web de contacto y genera prospectos automáticamente</span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-dark rounded-pill fw-bold px-4"
            onClick={handleOpenCreate}
          >
            <i className="bi bi-plus-lg me-2"></i>Nuevo Formulario
          </button>
        </div>

        <p className="small text-muted mb-4">
          Crea formularios interactivos no-code listos para insertar en tu sitio web. Al completarse, los prospectos o solicitudes se crean en Firestore, se rutearán Round-Robin automáticamente a un comercial y se calificarán por LUXIA IA.
        </p>

        {/* List of Forms */}
        {loading ? (
          <div className="text-center py-5">
            <span className="spinner-border spinner-border-sm text-dark" role="status" aria-hidden="true"></span>
            <span className="ms-2 text-muted small">Cargando formularios...</span>
          </div>
        ) : forms.length === 0 ? (
          <div className="text-muted small text-center py-5 bg-light rounded border border-dashed px-3">
            <i className="bi bi-folder-x fs-1 d-block mb-2 text-secondary"></i>
            No hay formularios web creados aún. Haz clic en "Nuevo Formulario" para comenzar.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle border rounded-3 overflow-hidden">
              <thead className="table-light">
                <tr style={{ fontSize: '0.8rem' }}>
                  <th className="px-3">Nombre Interno</th>
                  <th>Entidad Destino</th>
                  <th>País Origen</th>
                  <th>Canal Origen</th>
                  <th>Estado</th>
                  <th>Insertar Código / Enlaces</th>
                  <th className="text-end px-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {forms.map(form => {
                  const formUrl = `${host}/form/${form.id}`;
                  const iframeCode = `<iframe src="${formUrl}" width="100%" height="600px" frameborder="0"></iframe>`;
                  
                  return (
                    <tr key={form.id} style={{ fontSize: '0.85rem' }}>
                      <td className="px-3">
                        <strong className="text-dark d-block">{form.nombre}</strong>
                        <span className="small text-muted font-monospace">{form.campos?.length || 0} campos configurados</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1">
                          {form.tipoEntidadTarget === 'lead' && '👤 Lead / Prospecto'}
                          {form.tipoEntidadTarget === 'contacto' && '👥 Contacto Cliente'}
                          {form.tipoEntidadTarget === 'oportunidad' && '💼 Oportunidad'}
                          {form.tipoEntidadTarget === 'ticket' && '🎫 Ticket de Soporte'}
                          {!form.tipoEntidadTarget && '👤 Lead / Prospecto'}
                        </span>
                      </td>
                      <td>
                        {form.paisDefault === 'select' ? (
                          <span className="badge bg-secondary rounded-pill">Dinámico (Filtro)</span>
                        ) : (
                          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2">
                            {form.paisDefault}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="font-monospace text-muted small">{form.origen || 'web_inbound'}</span>
                      </td>
                      <td>
                        {form.activo !== false ? (
                          <span className="badge bg-success-subtle text-success border border-success rounded-pill">
                            <i className="bi bi-check-circle-fill me-1"></i>Activo
                          </span>
                        ) : (
                          <span className="badge bg-danger-subtle text-danger border border-danger rounded-pill">
                            <i className="bi bi-x-circle-fill me-1"></i>Inactivo
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-dark rounded-pill px-2 py-0.5 d-flex align-items-center gap-1"
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => copyToClipboard(formUrl, 'link', form.id)}
                          >
                            <i className={`bi ${copiedFormId === form.id ? 'bi-check-lg text-success' : 'bi-link-45deg'}`}></i>
                            {copiedFormId === form.id ? '¡URL Copiada!' : 'Copiar URL'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary rounded-pill px-2 py-0.5 d-flex align-items-center gap-1"
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => copyToClipboard(iframeCode, 'iframe', form.id)}
                          >
                            <i className={`bi ${copiedIframeId === form.id ? 'bi-check-lg text-success' : 'bi-code-slash'}`}></i>
                            {copiedIframeId === form.id ? '¡iFrame Copiado!' : 'Copiar iFrame'}
                          </button>

                          <a
                            href={formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-light border rounded-circle p-1 d-flex align-items-center justify-content-center ms-1"
                            title="Probar Formulario Público"
                            style={{ width: '26px', height: '26px' }}
                          >
                            <i className="bi bi-box-arrow-up-right text-dark" style={{ fontSize: '0.72rem' }}></i>
                          </a>
                        </div>
                      </td>
                      <td className="text-end px-3">
                        <div className="d-flex justify-content-end align-items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary border-0 rounded-circle p-1.5"
                            onClick={() => handleOpenEdit(form)}
                            title="Editar Formulario"
                          >
                            <i className="bi bi-pencil-fill"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger border-0 rounded-circle p-1.5"
                            onClick={() => setConfirmDeleteFormId(form.id)}
                            title="Eliminar Formulario"
                          >
                            <i className="bi bi-trash3-fill"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Create / Edit Web Form */}
        {showModal && (
          <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                
                {/* Header */}
                <div className="modal-header bg-transparent border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-sliders fs-4 text-primary"></i>
                    <h5 className="modal-title fw-bold text-dark mb-0">
                      {editingFormId ? 'Editar Formulario Inbound' : 'Nuevo Formulario Inbound'}
                    </h5>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>

                <form onSubmit={handleSaveForm} className="d-flex flex-column h-100 mb-0">
                  <div className="modal-body p-0">
                    <div className="row g-0 h-100">
                      
                      {/* COLUMNA IZQUIERDA: CONFIGURACION Y SELECCION DE CAMPOS */}
                      <div className="col-lg-6 p-4 p-xl-4 border-end bg-white overflow-y-auto" style={{ maxHeight: '70vh' }}>
                        
                        {/* 1. Configuración Básica */}
                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-3" style={{ fontSize: '0.9rem' }}>1. Configuración Básica</h6>
                        
                        <div className="row g-3 mb-4">
                          <div className="col-md-6">
                            <label className="form-label small fw-bold text-dark mb-1">Entidad Destino <span className="text-danger">*</span></label>
                            <select 
                              className="form-select form-select-sm rounded-3 fw-bold border-primary"
                              value={formTipoEntidadTarget}
                              onChange={(e) => handleEntityTargetChange(e.target.value)}
                            >
                              <option value="lead">👤 Registrar como Lead / Prospecto</option>
                              <option value="contacto">👥 Asociar como Contacto a un Cliente</option>
                              <option value="oportunidad">💼 Registrar como Oportunidad en Cliente</option>
                              <option value="ticket">🎫 Registrar como Ticket de Soporte / CX</option>
                            </select>
                            <div className="form-text text-muted" style={{ fontSize: '0.7rem' }}>Filtra los campos disponibles según este objeto.</div>
                          </div>

                          <div className="col-md-6">
                            <label className="form-label small fw-bold text-dark mb-1">Nombre del Formulario</label>
                            <input 
                              type="text" 
                              className="form-control form-control-sm rounded-3" 
                              required
                              placeholder="Ej. Landing Page Contacto MX"
                              value={formNombre}
                              onChange={(e) => setFormNombre(e.target.value)}
                            />
                            <div className="form-text text-muted" style={{ fontSize: '0.7rem' }}>Solo visible para administradores.</div>
                          </div>

                          <div className="col-md-6">
                            <label className="form-label small fw-bold text-dark mb-1">País por Defecto</label>
                            <select 
                              className="form-select form-select-sm rounded-3"
                              value={formPaisDefault}
                              onChange={(e) => setFormPaisDefault(e.target.value)}
                            >
                              <option value="select">Seleccionar en el formulario (dinámico)</option>
                              <option value="PE">Perú (PE)</option>
                              <option value="MX">México (MX)</option>
                              <option value="CO">Colombia (CO)</option>
                              <option value="CL">Chile (CL)</option>
                              <option value="AR">Argentina (AR)</option>
                            </select>
                            <div className="form-text text-muted" style={{ fontSize: '0.7rem' }}>Si escoges uno fijo, el selector se oculta en la web.</div>
                          </div>

                          <div className="col-md-6">
                            <label className="form-label small fw-bold text-dark mb-1">Canal de Origen</label>
                            <input 
                              type="text" 
                              className="form-control form-control-sm rounded-3" 
                              placeholder="Ej. web_inbound, fb_ads"
                              value={formOrigen}
                              onChange={(e) => setFormOrigen(e.target.value)}
                            />
                            <div className="form-text text-muted" style={{ fontSize: '0.7rem' }}>Tag asignado a la solicitud.</div>
                          </div>

                          <div className="col-12">
                            <div className="form-check form-switch w-100 p-2.5 bg-light rounded border border-light-subtle d-flex align-items-center justify-content-between">
                              <label className="form-check-label small fw-bold text-dark cursor-pointer mb-0" htmlFor="formActivo">Habilitar Formulario Público</label>
                              <input 
                                className="form-check-input cursor-pointer" 
                                type="checkbox" 
                                id="formActivo"
                                checked={formActivo}
                                onChange={(e) => setFormActivo(e.target.checked)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2. CAMPOS DISPONIBLES (Pool filtrado por entidad que se remueven al agregarse) */}
                        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                          <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-box-arrow-in-down me-1.5 text-primary"></i>Campos Disponibles para {formTipoEntidadTarget.toUpperCase()}
                          </h6>
                          <span className="badge bg-secondary rounded-pill" style={{ fontSize: '0.68rem' }}>
                            {availableStandardFields.length + availableCustomFields.length} disponibles
                          </span>
                        </div>
                        <p className="small text-muted mb-2" style={{ fontSize: '0.73rem' }}>
                          Haz clic en <strong>+ Agregar</strong> para incluir un campo. Al agregarlo, se quitará de esta lista.
                        </p>

                        <div className="bg-light p-2.5 rounded-3 border mb-4" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                          {availableStandardFields.length === 0 && availableCustomFields.length === 0 ? (
                            <div className="text-center text-muted py-3 small">
                              <i className="bi bi-check-all fs-5 d-block text-success mb-1"></i>
                              Todos los campos disponibles han sido agregados al formulario.
                            </div>
                          ) : (
                            <div className="d-flex flex-column gap-1.5">
                              {/* Campos Estándar Disponibles */}
                              {availableStandardFields.map(f => (
                                <div key={f.id} className="d-flex align-items-center justify-content-between p-2 rounded bg-white border border-light-subtle shadow-2xs">
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="small fw-bold text-dark">{f.label}</span>
                                    {getTypeBadge(f.type)}
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline-primary rounded-pill px-2.5 py-0.5 fw-bold"
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={() => handleAddFieldToForm({ ...f, isCustom: false })}
                                  >
                                    <i className="bi bi-plus-lg me-1"></i>Agregar
                                  </button>
                                </div>
                              ))}

                              {/* Campos Dinámicos Disponibles */}
                              {availableCustomFields.map(c => (
                                <div key={c.id} className="d-flex align-items-center justify-content-between p-2 rounded bg-white border border-light-subtle shadow-2xs">
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="small fw-bold text-dark">{c.nombre}</span>
                                    <span className="badge bg-warning text-dark rounded-pill px-1.5" style={{ fontSize: '0.62rem' }}>Personalizado</span>
                                    {getTypeBadge(c.tipo)}
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-outline-primary rounded-pill px-2.5 py-0.5 fw-bold"
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={() => handleAddFieldToForm({ id: c.id, label: c.nombre, isCustom: true, type: c.tipo, opciones: c.opciones })}
                                  >
                                    <i className="bi bi-plus-lg me-1"></i>Agregar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. CAMPOS INCLUIDOS EN EL FORMULARIO (Permite personalizar etiqueta, obligatoriedad y quitar) */}
                        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                          <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.9rem' }}>
                            <i className="bi bi-check2-square me-1.5 text-success"></i>Campos Incluidos en el Formulario
                          </h6>
                          <span className="badge bg-dark rounded-pill" style={{ fontSize: '0.68rem' }}>
                            {includedFields.length} en uso
                          </span>
                        </div>
                        <p className="small text-muted mb-2" style={{ fontSize: '0.73rem' }}>
                          Personaliza el nombre visible para el cliente y marca los obligatorios.
                        </p>

                        <div className="d-flex flex-column gap-2 mb-3">
                          {includedFields.map((field) => {
                            const customMeta = field.isCustom ? camposConfig.find(c => c.id === field.id) : null;
                            return (
                              <div key={field.id} className="d-flex align-items-center gap-2 p-2.5 rounded-3 border bg-white shadow-2xs">
                                <div className="flex-grow-1 min-w-0">
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <input 
                                      type="text"
                                      className="form-control form-control-sm border-0 border-bottom bg-light fw-bold py-0.5 px-2 text-dark"
                                      value={field.label}
                                      onChange={(e) => handleFieldLabelChange(field.id, e.target.value)}
                                      style={{ fontSize: '0.8rem' }}
                                    />
                                    {getTypeBadge(field.type || customMeta?.tipo)}
                                  </div>
                                  <span className="small text-muted font-monospace d-block px-1" style={{ fontSize: '0.65rem' }}>
                                    ID: {field.id} {field.isCustom && <span className="badge bg-warning text-dark px-1 ms-1">Personalizado</span>}
                                  </span>
                                </div>

                                {/* Required Switch */}
                                <div className="form-check form-switch m-0" style={{ fontSize: '0.72rem' }}>
                                  <input 
                                    className="form-check-input cursor-pointer" 
                                    type="checkbox" 
                                    checked={field.required}
                                    disabled={field.disabled}
                                    onChange={() => handleFieldRequiredToggle(field.id)}
                                    id={`check_req_${field.id}`}
                                  />
                                  <label className="form-check-label fw-bold text-dark" htmlFor={`check_req_${field.id}`}>Req.</label>
                                </div>

                                {/* Remove Button */}
                                {!field.disabled ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger border-0 rounded-circle p-1"
                                    onClick={() => handleRemoveFieldFromForm(field.id)}
                                    title="Quitar del formulario (devuelve a disponibles)"
                                  >
                                    <i className="bi bi-trash3"></i>
                                  </button>
                                ) : (
                                  <span className="badge bg-light text-muted border px-1.5 py-1" title="Obligatorio de sistema" style={{ fontSize: '0.62rem' }}>
                                    Fijo
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                      </div>

                      {/* COLUMNA DERECHA: LIVE PREVIEW PREMIUM REAL */}
                      <div className="col-lg-6 p-4 bg-light d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '500px' }}>
                        <div className="w-100 text-center mb-3">
                          <span className="badge bg-dark rounded-pill px-3 py-1.5 fw-bold shadow-sm" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                            <i className="bi bi-eye-fill me-1.5 text-info"></i>PREVISUALIZACIÓN EN VIVO (LIVE PREVIEW)
                          </span>
                          <p className="small text-muted mb-0 mt-1" style={{ fontSize: '0.7rem' }}>Así es exactamente como tus clientes verán el formulario web.</p>
                        </div>

                        {/* Mock Frame de Formulario */}
                        <div className="card border-0 shadow-lg rounded-4 w-100 bg-white overflow-hidden animate__animated animate__fadeIn" style={{ maxWidth: '440px' }}>
                          <div style={{ height: '4px', backgroundColor: '#212529' }}></div>
                          <div className="card-body p-4 text-start">
                            <h5 className="fw-bold text-dark mb-1">{formNombre.trim() || 'Formulario de Contacto'}</h5>
                            <p className="text-muted mb-3" style={{ fontSize: '0.75rem' }}>Por favor, completa tus datos para procesar la solicitud.</p>

                            <div className="d-flex flex-column gap-2.5">
                              {includedFields.map(field => {
                                // Omitir el selector de país si el país está fijo
                                if (field.id === 'pais' && formPaisDefault !== 'select') return null;

                                const customMeta = field.isCustom ? camposConfig.find(c => c.id === field.id) : null;
                                const fieldType = field.type || customMeta?.tipo || 'text';

                                return (
                                  <div key={field.id} className="mb-1 animate__animated animate__fadeInUp" style={{ animationDuration: '0.2s' }}>
                                    
                                    {fieldType === 'checkbox' ? (
                                      <div className="form-check my-1">
                                        <input className="form-check-input cursor-pointer" type="checkbox" disabled />
                                        <label className="form-check-label small fw-bold text-dark cursor-pointer">
                                          {field.label} {field.required && <span className="text-danger">*</span>}
                                        </label>
                                      </div>
                                    ) : (
                                      <>
                                        <label className="form-label small fw-bold text-dark mb-1">
                                          {field.label} {field.required && <span className="text-danger">*</span>}
                                        </label>
                                        
                                        {field.id === 'notas' || fieldType === 'textarea' ? (
                                          <textarea 
                                            className="form-control form-control-sm rounded-3" 
                                            rows="2" 
                                            placeholder={`Ingresa aquí tu ${field.label.toLowerCase()}...`}
                                            disabled
                                          />
                                        ) : field.id === 'pais' || fieldType === 'select' ? (
                                          <select className="form-select form-select-sm rounded-3" disabled>
                                            <option value="">Selecciona una opción...</option>
                                            {field.id === 'pais' ? (
                                              <>
                                                <option>Perú</option>
                                                <option>México</option>
                                                <option>Colombia</option>
                                                <option>Chile</option>
                                                <option>Argentina</option>
                                              </>
                                            ) : (
                                              (customMeta?.opciones || field.opciones || []).map(o => (
                                                <option key={typeof o === 'string' ? o : o.value}>
                                                  {typeof o === 'string' ? o : o.label}
                                                </option>
                                              ))
                                            )}
                                          </select>
                                        ) : fieldType === 'date' ? (
                                          <input type="date" className="form-control form-control-sm rounded-3" disabled />
                                        ) : fieldType === 'number' ? (
                                          <input type="number" className="form-control form-control-sm rounded-3" placeholder="0" disabled />
                                        ) : (
                                          <input 
                                            type={fieldType === 'email' ? 'email' : fieldType === 'tel' ? 'tel' : 'text'} 
                                            className="form-control form-control-sm rounded-3" 
                                            placeholder={`Ingresa tu ${field.label.toLowerCase()}`}
                                            disabled 
                                          />
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <button type="button" className="btn btn-dark rounded-pill w-100 py-2 mt-3 fw-bold shadow-sm disabled" style={{ fontSize: '0.8rem' }}>
                              <i className="bi bi-send-fill me-1.5"></i>Enviar Solicitud
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer bg-light border-top-0 px-4 py-3">
                    <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-semibold" onClick={() => setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm">Guardar Cambios</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteFormId && (
          <ConfirmModal
            show={!!confirmDeleteFormId}
            title="¿Eliminar Formulario Web?"
            message="Esta acción es irreversible y cualquier iFrame insertado con este ID dejará de cargar los campos correctamente."
            onConfirm={handleDeleteForm}
            onCancel={() => setConfirmDeleteFormId(null)}
          />
        )}

      </div>
    </div>
  );
}
