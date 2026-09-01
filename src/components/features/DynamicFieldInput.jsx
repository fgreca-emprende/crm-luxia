import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';

export function DynamicFieldInput({ campo, value, onChange, clientId }) {
  const { showAlert } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [emailError, setEmailError] = useState('');
  const fileInputRef = useRef(null);
  const { isLector } = useUserRole();
  const [catalogoData, setCatalogoData] = useState([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);

  // Cargar catálogo dinámico si el origen de datos está configurado
  useEffect(() => {
    if (campo.tipo === 'select' && campo.origenDatos && campo.origenDatos !== 'manual') {
      setLoadingCatalogo(true);
      const loadCatalog = async () => {
        try {
          if (campo.origenDatos === 'usuarios') {
            const { data } = await supabase.from('usuarios').select('id, email, nombre').order('nombre');
            const list = (data || []).map(d => ({
              value: d.email || d.id,
              label: d.nombre ? `${d.nombre} (${d.email})` : d.email
            }));
            setCatalogoData(list);
          } else if (campo.origenDatos === 'clientes') {
            const { data } = await supabase.from('clientes').select('id, nombre_empresa').order('nombre_empresa');
            const list = (data || []).map(d => ({
              value: d.id,
              label: d.nombre_empresa || d.id
            }));
            setCatalogoData(list);
          } else if (campo.origenDatos === 'config_servicios') {
            const { data, error } = await supabase.from('config_servicios').select('id, nombre, descripcion').order('nombre');
            if (data && data.length > 0) {
              setCatalogoData(data.map(s => ({ value: s.id, label: s.nombre || s.id })));
            } else {
              // Fallback a config_general si la tabla aún no fue poblada
              const { data: generalData } = await supabase.from('config_general').select('valor').eq('id', 'servicios_catalog').maybeSingle();
              if (generalData?.valor && Array.isArray(generalData.valor)) {
                setCatalogoData(generalData.valor.map(s => ({ value: s.id, label: s.nombre || s.id })));
              }
            }
          } else {
            const { data } = await supabase.from('config_general').select('valor').eq('id', 'servicios_catalog').maybeSingle();
            if (data?.valor && Array.isArray(data.valor)) {
              setCatalogoData(data.valor.map(s => ({ value: s.id, label: s.nombre || s.id })));
            }
          }
        } catch (err) {
          console.warn("Error loading catalogo data:", err);
        } finally {
          setLoadingCatalogo(false);
        }
      };
      loadCatalog();
    }
  }, [campo.tipo, campo.origenDatos]);

  // Normalizar el valor a un objeto si el campo genera alerta o es adjunto
  const isComplex = campo.tipo === 'adjunto' || campo.generaAlerta;
  const safeValue = isComplex ? (typeof value === 'object' && value !== null ? value : { valor: value || '', url: '', nombreArchivo: '', fechaVencimiento: '' }) : (value || '');

  // Validar formato de email en tiempo real
  useEffect(() => {
    if (campo.tipo === 'email') {
      const val = isComplex ? safeValue.valor : safeValue;
      if (!val) {
        setEmailError('');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) {
          setEmailError('Formato de correo electrónico inválido');
        } else {
          setEmailError('');
        }
      }
    } else {
      setEmailError('');
    }
  }, [value, campo.tipo, isComplex, safeValue]);

  const handleChangeComplejo = (field, val) => {
    onChange({ ...safeValue, [field]: val });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showAlert('El archivo excede el límite de 10 MB.', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${campo.key}.${fileExt}`;
      const filePath = `campos_dinamicos/${clientId || 'temp'}/${fileName}`;

      const { data, error } = await supabase.storage.from('crm-files').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

      let downloadURL = '';
      if (!error && data) {
        const { data: pubData } = supabase.storage.from('crm-files').getPublicUrl(filePath);
        downloadURL = pubData?.publicUrl || '';
      } else {
        downloadURL = URL.createObjectURL(file);
      }

      handleChangeComplejo('url', downloadURL);
      handleChangeComplejo('nombreArchivo', file.name);
      setIsUploading(false);
      showAlert('Archivo adjuntado correctamente.', 'success');
    } catch (err) {
      console.error(err);
      showAlert('Error al subir el archivo.', 'danger');
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    handleChangeComplejo('url', '');
    handleChangeComplejo('nombreArchivo', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderBaseInput = () => {
    if (campo.tipo === 'select') {
      const isDynamic = campo.origenDatos && campo.origenDatos !== 'manual';
      const optionsToRender = isDynamic
        ? catalogoData
        : (campo.opciones || []).map(opt => ({ value: opt, label: opt }));

      return (
        <div className="position-relative">
          <select 
            className="form-select form-select-sm" 
            value={isComplex ? safeValue.valor : safeValue} 
            onChange={e => isComplex ? handleChangeComplejo('valor', e.target.value) : onChange(e.target.value)}
            required={campo.obligatorio && !isComplex}
            disabled={isLector || (isDynamic && loadingCatalogo)}
          >
            <option value="">
              {isDynamic && loadingCatalogo ? 'Cargando opciones...' : '-- Seleccione una opción --'}
            </option>
            {optionsToRender.map((opt, idx) => (
              <option key={idx} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {isDynamic && loadingCatalogo && (
            <div className="spinner-border spinner-border-sm text-primary position-absolute end-0 top-50 translate-middle-y me-5" style={{ width: '0.8rem', height: '0.8rem' }} role="status"></div>
          )}
        </div>
      );
    } else if (campo.tipo === 'adjunto') {
      return (
        <div>
          {safeValue.url ? (
            <div className="d-flex align-items-center bg-light border rounded p-2 small">
              <i className="bi bi-file-earmark-check text-success me-2 fs-5"></i>
              <div className="flex-grow-1 text-truncate">
                <a href={safeValue.url} target="_blank" rel="noreferrer" className="text-decoration-none fw-bold">
                  {safeValue.nombreArchivo || 'Archivo adjunto'}
                </a>
              </div>
              <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={clearFile} title="Eliminar archivo" disabled={isLector}>
                <i className="bi bi-trash"></i>
              </button>
            </div>
          ) : (
            <div>
              <div 
                className="d-flex align-items-center justify-content-center bg-light border border-dashed rounded p-2 text-center" 
                style={{ cursor: isUploading || isLector ? 'not-allowed' : 'pointer', minHeight: '60px' }} 
                onClick={() => { if (!isUploading && !isLector) fileInputRef.current?.click(); }}
              >
                 <i className="bi bi-cloud-arrow-up text-primary fs-4 me-2"></i>
                 <span className="text-muted small fw-bold">Seleccionar archivo...</span>
                 <input 
                  type="file" 
                  className="d-none"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={isUploading || isLector}
                  required={campo.obligatorio && !safeValue.url}
                 />
              </div>
              {isUploading && (
                <div className="progress mt-2" style={{ height: '4px' }}>
                  <div className="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    } else if (campo.tipo === 'checkbox') {
      const activeValue = isComplex ? (safeValue.valor === true || safeValue.valor === 'true') : (value === true || value === 'true');
      return (
        <div className="form-check mt-1">
          <input 
            type="checkbox"
            className="form-check-input"
            id={`chk_${campo.key}`}
            checked={activeValue}
            onChange={e => {
              const val = e.target.checked;
              isComplex ? handleChangeComplejo('valor', val) : onChange(val);
            }}
            disabled={isLector}
          />
          <label className="form-check-label small text-muted" htmlFor={`chk_${campo.key}`}>
            {activeValue ? 'Habilitado / Sí' : 'Deshabilitado / No'}
          </label>
        </div>
      );
    } else {
      const isEmail = campo.tipo === 'email';
      const isWhatsapp = campo.tipo === 'whatsapp_phone';
      
      const sanitizeWhatsAppNumber = (num) => {
        if (!num) return '';
        return num.replace(/[\s\-\+\(\)]/g, '');
      };

      const handleWhatsAppClick = () => {
        const val = isComplex ? safeValue.valor : safeValue;
        const cleanNum = sanitizeWhatsAppNumber(val);
        if (cleanNum) {
          window.dispatchEvent(new CustomEvent('navigateToWhatsAppChat', { 
            detail: { telefono: val, name: campo.nombre } 
          }));
        }
      };

      return (
        <div>
          {isWhatsapp ? (
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-success text-white" title="WhatsApp">
                <i className="bi bi-whatsapp"></i>
              </span>
              <input 
                type="tel"
                className="form-control"
                value={isComplex ? safeValue.valor : safeValue}
                onChange={e => isComplex ? handleChangeComplejo('valor', e.target.value) : onChange(e.target.value)}
                placeholder={`Ingrese ${campo.nombre.toLowerCase()}... (ej: +5491112345678)`}
                required={campo.obligatorio && (!isComplex ? true : false)}
                disabled={isLector}
              />
              <button 
                className="btn btn-outline-success fw-bold" 
                type="button"
                onClick={handleWhatsAppClick}
                disabled={!sanitizeWhatsAppNumber(isComplex ? safeValue.valor : safeValue)}
              >
                Abrir Chat
              </button>
            </div>
          ) : (
            <>
              {isEmail ? (
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-danger text-white" title="Gmail">
                    <i className="bi bi-envelope-fill"></i>
                  </span>
                  <input 
                    type="email"
                    className={`form-control ${emailError ? 'is-invalid' : ''}`}
                    value={isComplex ? safeValue.valor : safeValue}
                    onChange={e => isComplex ? handleChangeComplejo('valor', e.target.value) : onChange(e.target.value)}
                    placeholder={`Ingrese ${campo.nombre ? campo.nombre.toLowerCase() : ''}...`}
                    required={campo.obligatorio && (!isComplex ? true : false)}
                    disabled={isLector}
                  />
                  <button 
                    className="btn btn-outline-danger fw-bold" 
                    type="button"
                    onClick={() => {
                      const val = isComplex ? safeValue.valor : safeValue;
                      if (val && !emailError) {
                        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${val}`, '_blank');
                      }
                    }}
                    disabled={!(!emailError && (isComplex ? safeValue.valor : safeValue))}
                  >
                    Redactar Email
                  </button>
                </div>
              ) : (
                <input 
                  type={campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : 'text'}
                  className={`form-control form-control-sm`}
                  value={isComplex ? safeValue.valor : safeValue}
                  onChange={e => isComplex ? handleChangeComplejo('valor', e.target.value) : onChange(e.target.value)}
                  placeholder={`Ingrese ${campo.nombre ? campo.nombre.toLowerCase() : ''}...`}
                  required={campo.obligatorio && (!isComplex || campo.tipo === 'adjunto' ? false : true)}
                  disabled={isLector}
                />
              )}
              {isEmail && emailError && (
                <div className="invalid-feedback d-block" style={{ fontSize: '0.75rem' }}>
                  {emailError}
                </div>
              )}
            </>
          )}
        </div>
      );
    }
  };

  return (
    <div className="col-md-6 mb-3">
      <label className="form-label small fw-bold mb-1">
        {campo.nombre} {campo.obligatorio && <span className="text-danger">*</span>}
        {campo.generaAlerta && <i className="bi bi-bell-fill text-danger ms-2" title="Genera alerta de vencimiento"></i>}
      </label>
      
      {renderBaseInput()}

      {campo.generaAlerta && (
        <div className="mt-2 bg-light border border-danger border-opacity-25 rounded p-2">
          <label className="form-label mb-1" style={{ fontSize: '0.70rem' }}>
            <i className="bi bi-calendar-event text-danger me-1"></i>Fecha de Vencimiento / Renovación
          </label>
          <input 
            type="date" 
            className="form-control form-control-sm border-danger border-opacity-50"
            value={safeValue.fechaVencimiento || ''}
            onChange={e => handleChangeComplejo('fechaVencimiento', e.target.value)}
            required={campo.generaAlerta && (safeValue.valor || safeValue.url)} 
            disabled={isLector}
          />
          <div className="form-text mt-1" style={{ fontSize: '0.65rem' }}>
            El sistema generará alertas automáticas antes de esta fecha.
          </div>
        </div>
      )}
    </div>
  );
}
