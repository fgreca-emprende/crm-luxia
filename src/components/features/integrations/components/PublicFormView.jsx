import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { getConfigGeneral } from '../../../../lib/configGeneral';
import { SpinnerPremium } from '../../../ui/SpinnerPremium';
import { LuxiaLogo } from '../../../ui/LuxiaLogo';

export function PublicFormView({ formId }) {
  const [formConfig, setFormConfig] = useState(null);
  const [camposConfig, setCamposConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form inputs state
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const loadFormAndFields = async () => {
      if (!formId) {
        setError('ID de formulario no especificado.');
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch form configuration
        const forms = (await getConfigGeneral('crm_formularios_web')) || [];
        const config = forms.find(f => f.id === formId);
        if (!config) {
          setError('El formulario especificado no existe.');
          setLoading(false);
          return;
        }

        if (config.activo === false) {
          setError('Este formulario se encuentra actualmente inactivo.');
          setLoading(false);
          return;
        }

        setFormConfig(config);

        // Initialize form fields state
        const initialData = {};
        if (config.paisDefault && config.paisDefault !== 'select') {
          initialData['pais'] = config.paisDefault;
        }
        setFormData(initialData);

        // 2. Fetch custom fields metadata to match types & options
        const { data: fields } = await supabase
          .from('config_campos')
          .select('*')
          .order('orden', { ascending: true });
        setCamposConfig(fields || []);

      } catch (err) {
        console.warn('Error loading form configuration:', err);
        setError('Error al cargar la configuración del formulario.');
      } finally {
        setLoading(false);
      }
    };

    loadFormAndFields();
  }, [formId]);

  const handleInputChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Validate mandatory fields
      const missing = [];
      formConfig.campos.forEach(field => {
        if (field.required && !formData[field.id]?.toString().trim()) {
          missing.push(field.label);
        }
      });

      if (missing.length > 0) {
        throw new Error(`Los siguientes campos son obligatorios: ${missing.join(', ')}`);
      }

      // Validar nombreEmpresa si la entidad destino no es un Lead (necesitamos asociarlo a un cliente)
      if (formConfig.tipoEntidadTarget && formConfig.tipoEntidadTarget !== 'lead') {
        if (!formData['nombreEmpresa']?.toString().trim()) {
          throw new Error('El campo "Nombre de la Empresa" es requerido para asociar tu solicitud.');
        }
      }

      // Extraer parámetros UTM de la URL del navegador automáticamente
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source') || urlParams.get('source') || null;
      const utmMedium = urlParams.get('utm_medium') || urlParams.get('medium') || null;
      const utmCampaign = urlParams.get('utm_campaign') || urlParams.get('campaign') || null;

      // Structure request payload
      // Separar campos estándar de campos dinámicos
      const standardKeys = [
        'nombreContacto', 'correo', 'telefono', 'nombreEmpresa', 'pais', 'notas',
        'cuit_rut_rfc', 'industria', 'sitioWeb', 'volumenMensualProyectado', 'stackTecnologicoActual'
      ];
      const payload = {
        formId: formId,
        origen: formConfig.origen || 'web_inbound',
        utmSource,
        utmMedium,
        utmCampaign,
        camposDinamicos: {}
      };

      Object.keys(formData).forEach(key => {
        if (standardKeys.includes(key)) {
          payload[key] = formData[key];
        } else {
          payload.camposDinamicos[key] = formData[key];
        }
      });

      // Si el país es fijo, asegurarnos de enviarlo
      if (formConfig.paisDefault && formConfig.paisDefault !== 'select') {
        payload['pais'] = formConfig.paisDefault;
      }

       // Send to public endpoint
      const targetEndpoint = formConfig.tipoEntidadTarget === 'ticket' ? 'web-to-ticket' : 'web-to-lead';
      const response = await fetch(`/api/public/${targetEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ocurrió un error inesperado al enviar el formulario.');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting form:', err);
      setErrorMessage(err.message || 'Error al enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <SpinnerPremium size="md" text="Cargando formulario..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
        <div className="card border-0 shadow rounded-4 p-4 text-center" style={{ maxWidth: '400px' }}>
          <div className="text-danger mb-3">
            <i className="bi bi-exclamation-triangle fs-1"></i>
          </div>
          <h5 className="fw-bold text-dark">Formulario no disponible</h5>
          <p className="small text-muted mb-0">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3 p-md-4">
      <div className="card border-0 shadow-lg rounded-4 overflow-hidden w-100" style={{ maxWidth: '600px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
        
        {/* Decorative Top Accent */}
        <div className="w-100" style={{ height: '5px', background: 'linear-gradient(90deg, #961f80, #c432a8)' }}></div>

        <div className="card-body p-4 p-md-5">
          {submitted ? (
            <div className="text-center py-4">
              <div className="mb-4 text-success animate__animated animate__zoomIn">
                <i className="bi bi-check-circle-fill" style={{ fontSize: '4.5rem', color: '#961f80' }}></i>
              </div>
              <h3 className="fw-bold text-dark mb-2">¡Muchas Gracias!</h3>
              <p className="text-muted small">Tu consulta ha sido registrada con éxito en LUXIA® Agro. Un representante comercial o asesor técnico se pondrá en contacto contigo a la brevedad.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4 text-center">
                <LuxiaLogo height={42} showBadge={true} badgeText="Agro" />
              </div>
              <h4 className="fw-bold text-dark mb-1">{formConfig.nombre}</h4>
              <p className="small text-muted mb-4">Por favor, completa los siguientes datos para procesar tu solicitud fitosanitaria o comercial.</p>

              {errorMessage && (
                <div className="alert alert-danger bg-danger-subtle text-danger-emphasis border-0 rounded-3 p-3 mb-4 d-flex align-items-start gap-2.5">
                  <i className="bi bi-exclamation-octagon-fill fs-5 mt-0.5"></i>
                  <span className="small">{errorMessage}</span>
                </div>
              )}

              <div className="d-flex flex-column gap-3 mb-4">
                {formConfig.tipoEntidadTarget && formConfig.tipoEntidadTarget !== 'lead' && !formConfig.campos.some(f => f.id === 'nombreEmpresa') && (
                  <div>
                    <label className="form-label small fw-bold text-dark">
                      Nombre de la Empresa / Cliente <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      required
                      value={formData['nombreEmpresa'] || ''}
                      onChange={(e) => handleInputChange('nombreEmpresa', e.target.value)}
                      placeholder="Ingresa el nombre exacto de la organización"
                    />
                  </div>
                )}
                {formConfig.campos.map(field => {
                  // If it's the country field but country is fixed, skip rendering
                  if (field.id === 'pais' && formConfig.paisDefault !== 'select') {
                    return null;
                  }

                  const isRequired = !!field.required;
                  const customMeta = field.isCustom ? camposConfig.find(c => c.id === field.id) : null;
                  const labelNode = (
                    <label className="form-label small fw-bold text-dark">
                      {field.label} {isRequired && <span className="text-danger">*</span>}
                    </label>
                  );

                  // 1. Textarea fields
                  if (field.id === 'notas' || customMeta?.tipo === 'textarea') {
                    return (
                      <div key={field.id}>
                        {labelNode}
                        <textarea
                          className="form-control rounded-3"
                          rows="3"
                          required={isRequired}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          placeholder={`Escribe aquí tu ${field.label.toLowerCase()}...`}
                        />
                      </div>
                    );
                  }

                  // 2. Select/Dropdown fields
                  if (field.id === 'pais' || customMeta?.tipo === 'select') {
                    const options = field.id === 'pais'
                      ? [
                          { val: 'PE', label: 'Perú' },
                          { val: 'MX', label: 'México' },
                          { val: 'CO', label: 'Colombia' },
                          { val: 'CL', label: 'Chile' },
                          { val: 'AR', label: 'Argentina' }
                        ]
                      : (customMeta?.opciones || []).map(o => typeof o === 'string' ? { val: o, label: o } : { val: o.value, label: o.label });

                    return (
                      <div key={field.id}>
                        {labelNode}
                        <select
                          className="form-select rounded-3"
                          required={isRequired}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                        >
                          <option value="">Selecciona una opción...</option>
                          {options.map(o => (
                            <option key={o.val} value={o.val}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  // 3. Number fields
                  if (customMeta?.tipo === 'number') {
                    return (
                      <div key={field.id}>
                        {labelNode}
                        <input
                          type="number"
                          className="form-control rounded-3"
                          required={isRequired}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                        />
                      </div>
                    );
                  }

                  // 4. Date fields
                  if (customMeta?.tipo === 'date') {
                    return (
                      <div key={field.id}>
                        {labelNode}
                        <input
                          type="date"
                          className="form-control rounded-3"
                          required={isRequired}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                        />
                      </div>
                    );
                  }

                  // 5. Checkbox (Booleano) fields
                  if (customMeta?.tipo === 'checkbox') {
                    return (
                      <div key={field.id} className="form-check my-2">
                        <input
                          type="checkbox"
                          className="form-check-input rounded-2 cursor-pointer"
                          id={`public_check_${field.id}`}
                          checked={!!formData[field.id]}
                          onChange={(e) => handleInputChange(field.id, e.target.checked)}
                        />
                        <label className="form-check-label small fw-bold text-dark cursor-pointer" htmlFor={`public_check_${field.id}`}>
                          {field.label} {isRequired && <span className="text-danger">*</span>}
                        </label>
                      </div>
                    );
                  }

                  // 6. Default Text / Email / Phone / URL input fields
                  let type = 'text';
                  if (field.id === 'correo') type = 'email';
                  if (field.id === 'telefono') type = 'tel';
                  if (customMeta?.tipo === 'url') type = 'url';


                  return (
                    <div key={field.id}>
                      {labelNode}
                      <input
                        type={type}
                        className="form-control rounded-3"
                        required={isRequired}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-dark w-100 rounded-pill py-2.5 fw-bold shadow-sm"
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Enviando solicitud...
                  </>
                ) : (
                  'Enviar Solicitud'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
