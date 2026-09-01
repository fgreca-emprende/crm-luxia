import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';
import { cacheManager } from '../../../lib/api';
import { DynamicFormPreview } from '../DynamicFormPreview';
import { ConfirmModal } from './ConfirmModal';

export function FieldsConfigPanel() {
  const [campos, setCampos] = useState([]);
  const [camposLoading, setCamposLoading] = useState(false);
  const [filtroSeccionId, setFiltroSeccionId] = useState('');
  const [camposFormData, setCamposFormData] = useState({ key: '', nombre: '', tipo: 'text', orden: 1, opciones: '', origenDatos: 'manual', seccionId: '', obligatorio: false, generaAlerta: false });
  const [editingCampoKey, setEditingCampoKey] = useState(null);

  const [secciones, setSecciones] = useState([]);
  const [seccionesLoading, setSeccionesLoading] = useState(false);
  const [seccionesFormData, setSeccionesFormData] = useState({ id: '', nombre: '', icono: 'bi-grid', orden: 1, entidad: 'cliente' });
  const [editingSeccionId, setEditingSeccionId] = useState(null);

  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showAlert } = useToast();

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmBtnClass: 'btn-primary',
    confirmText: 'Confirmar',
    onConfirm: null
  });

  const loadSecciones = useCallback(async () => {
    setSeccionesLoading(true);
    try {
      const { data, error } = await supabase.from('config_secciones').select('*').order('orden');
      if (error) throw error;
      
      const loaded = (data || []).map(d => ({
        id: d.id,
        nombre: d.nombre,
        icono: d.icono || 'bi-grid',
        orden: d.orden || 1,
        entidad: d.entidad || 'cliente'
      }));
      setSecciones(loaded);
      if (loaded.length > 0) {
        setSeccionesFormData(prev => ({ ...prev, orden: loaded[loaded.length - 1].orden + 1 }));
      }
    } catch (err) {
      showAlert(`Error cargando secciones: ${err.message}`, 'danger');
    } finally {
      setSeccionesLoading(false);
    }
  }, [showAlert]);

  const loadCampos = useCallback(async () => {
    setCamposLoading(true);
    try {
      const { data, error } = await supabase.from('config_campos').select('*').order('orden');
      if (error) throw error;
      
      const loaded = (data || []).map(d => ({
        id: d.id || d.key,
        key: d.key || d.id,
        nombre: d.nombre,
        tipo: d.tipo,
        orden: d.orden || 1,
        opciones: d.opciones || [],
        origenDatos: d.origen_datos || d.origenDatos || 'manual',
        seccionId: d.seccion_id || d.seccionId || '',
        obligatorio: d.obligatorio || false,
        generaAlerta: d.genera_alerta || d.generaAlerta || false
      }));
      setCampos(loaded);
      if (loaded.length > 0) {
        setCamposFormData(prev => ({ ...prev, orden: loaded[loaded.length - 1].orden + 1 }));
      }
    } catch (err) {
      showAlert(`Error cargando campos: ${err.message}`, 'danger');
    } finally {
      setCamposLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadSecciones();
    loadCampos();
  }, [loadSecciones, loadCampos]);

  const handleEditCampo = (campo) => {
    setEditingCampoKey(campo.id);
    setCamposFormData({
      key: campo.key || campo.id,
      nombre: campo.nombre || '',
      tipo: campo.tipo || 'text',
      orden: campo.orden || 1,
      opciones: campo.opciones ? campo.opciones.join(', ') : '',
      origenDatos: campo.origenDatos || 'manual',
      seccionId: campo.seccionId || '',
      obligatorio: campo.obligatorio || false,
      generaAlerta: campo.generaAlerta || false
    });
  };

  const handleCancelEditCampo = () => {
    setEditingCampoKey(null);
    setCamposFormData({
      key: '',
      nombre: '',
      tipo: 'text',
      orden: campos.length > 0 ? campos[campos.length - 1].orden + 1 : 1,
      opciones: '',
      origenDatos: 'manual',
      seccionId: '',
      obligatorio: false,
      generaAlerta: false
    });
  };

  const handleEditSeccion = (seccion) => {
    setEditingSeccionId(seccion.id);
    setSeccionesFormData({
      id: seccion.id,
      nombre: seccion.nombre || '',
      icono: seccion.icono || 'bi-grid',
      orden: seccion.orden || 1,
      entidad: seccion.entidad || 'cliente'
    });
  };

  const handleCancelEditSeccion = () => {
    setEditingSeccionId(null);
    setSeccionesFormData({
      id: '',
      nombre: '',
      icono: 'bi-grid',
      orden: secciones.length > 0 ? secciones[secciones.length - 1].orden + 1 : 1,
      entidad: 'cliente'
    });
  };

  const handleSaveCampo = async (e) => {
    e.preventDefault();
    const keyTrimmed = camposFormData.key.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]+$/.test(keyTrimmed)) {
      showAlert('La Key solo puede contener letras, números y guiones bajos.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const isSelect = camposFormData.tipo === 'select';
      const isManual = camposFormData.origenDatos === 'manual' || !camposFormData.origenDatos;

      const optionsArray = (isSelect && isManual)
        ? (Array.isArray(camposFormData.opciones) ? camposFormData.opciones : camposFormData.opciones.split(',').map(o => o.trim()).filter(o => o.length > 0))
        : [];

      const payload = {
        id: keyTrimmed,
        key: keyTrimmed,
        nombre: camposFormData.nombre.trim(),
        tipo: camposFormData.tipo,
        orden: parseInt(camposFormData.orden) || 1,
        opciones: optionsArray,
        origen_datos: isSelect ? (camposFormData.origenDatos || 'manual') : '',
        seccion_id: camposFormData.seccionId || '',
        obligatorio: camposFormData.obligatorio || false,
        genera_alerta: camposFormData.generaAlerta || false
      };

      const { error } = await supabase.from('config_campos').upsert(payload);
      if (error) throw error;

      await logSystemEvent(null, 'system_config_change', {
        tipoConfig: 'campo_dinamico',
        key: keyTrimmed,
        nombre: camposFormData.nombre.trim(),
        opcionesCount: optionsArray.length,
        origenDatos: isSelect ? (camposFormData.origenDatos || 'manual') : '',
        seccionId: camposFormData.seccionId || ''
      });

      cacheManager.data.delete('config_campos');
      showAlert('Campo dinámico guardado correctamente', 'success');
      setEditingCampoKey(null);
      setCamposFormData({ key: '', nombre: '', tipo: 'text', orden: camposFormData.orden + 1, opciones: '', origenDatos: 'manual', seccionId: '', obligatorio: false, generaAlerta: false });
      loadCampos();
    } catch (err) {
      showAlert(`Error al guardar campo: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeccion = async (e) => {
    e.preventDefault();
    const idTrimmed = seccionesFormData.id.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]+$/.test(idTrimmed)) {
      showAlert('El ID solo puede contener letras, números y guiones bajos.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: idTrimmed,
        nombre: seccionesFormData.nombre.trim(),
        icono: seccionesFormData.icono.trim() || 'bi-grid',
        orden: parseInt(seccionesFormData.orden) || 1,
        entidad: seccionesFormData.entidad || 'cliente'
      };

      const { error } = await supabase.from('config_secciones').upsert(payload);
      if (error) throw error;

      await logSystemEvent(null, 'system_config_change', {
        tipoConfig: 'seccion_campo',
        id: idTrimmed,
        nombre: seccionesFormData.nombre.trim(),
        entidad: seccionesFormData.entidad || 'cliente'
      });

      cacheManager.data.delete('config_secciones');
      showAlert('Sección guardada correctamente', 'success');
      setEditingSeccionId(null);
      setSeccionesFormData({ id: '', nombre: '', icono: 'bi-grid', orden: seccionesFormData.orden + 1, entidad: 'cliente' });
      loadSecciones();
    } catch (err) {
      showAlert(`Error al guardar sección: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = (coleccion, id, cacheKey, reloadFn) => {
    setConfirmModal({
      show: true,
      title: 'Confirmar Eliminación',
      message: `¿Estás seguro de que deseas eliminar permanentemente el registro "${id}" de la configuración? Esta acción desvinculará este parámetro dinámico y no se podrá deshacer.`,
      confirmBtnClass: 'btn-danger',
      confirmText: 'Eliminar Registro',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from(coleccion).delete().eq('id', id);
          if (error) throw error;
          cacheManager.data.delete(cacheKey);
          showAlert('Registro eliminado correctamente', 'success');
          reloadFn();
        } catch (err) {
          showAlert(`Error al eliminar: ${err.message}`, 'danger');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  return (
    <div>

      {/* === ENCABEZADO GLOBAL CON TOGGLE === */}
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          {previewMode ? (
            <>
              <h5 className="fw-bold text-dark mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <i className="bi bi-eye text-primary me-2"></i>Live Preview de Formularios
              </h5>
              <p className="text-muted small mb-0">Vista interactiva en tiempo real de cómo se verán los formularios dinámicos para los operadores.</p>
            </>
          ) : (
            <>
              <h5 className="fw-bold text-dark mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <i className="bi bi-table text-primary me-2"></i>Configuración de Campos Dinámicos
              </h5>
              <p className="text-muted small mb-0">Define las secciones y campos dinámicos para las fichas de clientes, contratos, contactos y actividades.</p>
            </>
          )}
        </div>
        <div className="btn-group shadow-sm flex-shrink-0">
          <button
            className={`btn btn-sm ${!previewMode ? 'btn-primary' : 'btn-outline-primary'} fw-bold`}
            onClick={() => setPreviewMode(false)}
          >
            <i className="bi bi-table me-2"></i>Configuración
          </button>
          <button
            className={`btn btn-sm ${previewMode ? 'btn-primary' : 'btn-outline-primary'} fw-bold`}
            onClick={() => setPreviewMode(true)}
          >
            <i className="bi bi-eye me-2"></i>Live Preview
          </button>
        </div>
      </div>

      {previewMode ? (
        /* === MODO LIVE PREVIEW: ANCHO COMPLETO === */
        <div className="row g-3 pb-4">
          <div className="col-xl-4 col-md-6">
            <DynamicFormPreview campos={campos} secciones={secciones} entidadPreview="cliente" />
          </div>
          <div className="col-xl-4 col-md-6">
            <DynamicFormPreview campos={campos} secciones={secciones} entidadPreview="contrato" />
          </div>
          <div className="col-xl-4 col-md-6">
            <DynamicFormPreview campos={campos} secciones={secciones} entidadPreview="contacto" />
          </div>
          <div className="col-xl-4 col-md-6">
            <DynamicFormPreview campos={campos} secciones={secciones} entidadPreview="crm_actividad" />
          </div>
          <div className="col-xl-4 col-md-6">
            <DynamicFormPreview campos={campos} secciones={secciones} entidadPreview="lead" />
          </div>
          <div className="col-xl-4 col-md-6">
            <DynamicFormPreview campos={campos} secciones={secciones} entidadPreview="oportunidad" />
          </div>
          <div className="col-xl-4 col-md-6">
            <DynamicFormPreview campos={campos} secciones={secciones} entidadPreview="ticket" />
          </div>
        </div>
      ) : (
        /* === MODO CONFIGURACIÓN: DOS COLUMNAS === */
        <div className="row g-4">
          <div className="col-lg-5">
            {/* === FORMULARIO DE SECCIONES === */}
            <div className="card border-0 bg-light p-4 rounded-4 shadow-sm mb-4">
              <h6 className="fw-bold mb-3 text-dark">
                <i className={`bi ${editingSeccionId ? 'bi-pencil-square' : 'bi-collection-fill'} me-2 text-primary`}></i>
                {editingSeccionId ? 'Editar Sección' : 'Nueva Sección'}
              </h6>
              <p className="small text-muted mb-4">
                Agrupa los campos dinámicos bajo bloques temáticos en la ficha del cliente o contrato.
              </p>
              
              <form onSubmit={handleSaveSeccion}>
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">ID (Slug) de la Sección</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm" 
                    placeholder="ej: datos_facturacion" 
                    required 
                    value={seccionesFormData.id} 
                    onChange={e => setSeccionesFormData({...seccionesFormData, id: e.target.value})} 
                    disabled={editingSeccionId !== null}
                  />
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-12">
                    <label className="form-label small fw-bold mb-1">Nombre Visible</label>
                    <input type="text" className="form-control form-control-sm" placeholder="ej: Datos de Facturación" required value={seccionesFormData.nombre} onChange={e => setSeccionesFormData({...seccionesFormData, nombre: e.target.value})} />
                  </div>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <label className="form-label small fw-bold mb-1">Ícono (Bi)</label>
                    <input type="text" className="form-control form-control-sm" placeholder="bi-grid" value={seccionesFormData.icono} onChange={e => setSeccionesFormData({...seccionesFormData, icono: e.target.value})} />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-bold mb-1">Orden</label>
                    <input type="number" className="form-control form-control-sm" required value={seccionesFormData.orden} onChange={e => setSeccionesFormData({...seccionesFormData, orden: parseInt(e.target.value) || 1})} />
                  </div>
                  <div className="col-4">
                    <label className="form-label small fw-bold mb-1">Entidad</label>
                    <select className="form-select form-select-sm" value={seccionesFormData.entidad} onChange={e => setSeccionesFormData({...seccionesFormData, entidad: e.target.value})}>
                      <option value="cliente">Cliente</option>
                      <option value="contrato">Contrato</option>
                      <option value="contacto">Contacto</option>
                      <option value="crm_actividad">Actividad CRM</option>
                      <option value="lead">Lead (Prospección)</option>
                      <option value="oportunidad">Oportunidad (Venta)</option>
                      <option value="ticket">Ticket (Soporte/CX)</option>
                    </select>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  {editingSeccionId && (
                    <button type="button" className="btn btn-outline-secondary btn-sm w-50 rounded-pill fw-bold" onClick={handleCancelEditSeccion} disabled={saving}>Cancelar</button>
                  )}
                  <button type="submit" className={`btn btn-primary btn-sm ${editingSeccionId ? 'w-50' : 'w-100'} rounded-pill fw-bold`} disabled={saving}>
                    {saving ? 'Guardando...' : (editingSeccionId ? 'Actualizar' : 'Crear Sección')}
                  </button>
                </div>
              </form>
            </div>

            {/* === FORMULARIO DE CAMPOS === */}
            <div className="card border-0 bg-light p-4 rounded-4 shadow-sm">
              <h6 className="fw-bold mb-3 text-dark">
                <i className={`bi ${editingCampoKey ? 'bi-pencil-square' : 'bi-plus-circle-fill'} me-2 text-primary`}></i>
                {editingCampoKey ? 'Editar Campo Dinámico' : 'Nuevo Campo Dinámico'}
              </h6>
              
              <form onSubmit={handleSaveCampo}>
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">Key Interna (ID único)</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm" 
                    placeholder="ej: software_erp" 
                    required 
                    value={camposFormData.key} 
                    onChange={e => setCamposFormData({...camposFormData, key: e.target.value})} 
                    disabled={editingCampoKey !== null}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">Nombre Visible (Etiqueta)</label>
                  <input type="text" className="form-control form-control-sm" placeholder="ej: Sistema ERP" required value={camposFormData.nombre} onChange={e => setCamposFormData({...camposFormData, nombre: e.target.value})} />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">Sección</label>
                  <select 
                    className="form-select form-select-sm" 
                    value={camposFormData.seccionId} 
                    onChange={e => setCamposFormData({...camposFormData, seccionId: e.target.value})}
                  >
                    <option value="">-- Sin Sección (Información Adicional) --</option>
                    <optgroup label="👤 Cliente">
                      {secciones.filter(s => s.entidad === 'cliente').map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="📄 Contrato">
                      {secciones.filter(s => s.entidad === 'contrato').map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="📇 Contacto">
                      {secciones.filter(s => s.entidad === 'contacto').map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="📋 Actividad CRM">
                      {secciones.filter(s => s.entidad === 'crm_actividad').map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="🎯 Lead (Prospección)">
                      {secciones.filter(s => s.entidad === 'lead').map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="📈 Oportunidad (Venta)">
                      {secciones.filter(s => s.entidad === 'oportunidad').map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold mb-1">Tipo de Dato</label>
                    <select className="form-select form-select-sm" value={camposFormData.tipo} onChange={e => setCamposFormData({...camposFormData, tipo: e.target.value})}>
                      <option value="text">Texto Corto</option>
                      <option value="number">Número</option>
                      <option value="date">Fecha</option>
                      <option value="email">Correo Electrónico (Email)</option>
                      <option value="select">Menú Desplegable</option>
                      <option value="adjunto">Archivo Adjunto</option>
                      <option value="whatsapp_phone">WhatsApp (Teléfono)</option>
                      <option value="checkbox">Casilla de Verificación (Checkbox)</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold mb-1">Orden Visual</label>
                    <input type="number" className="form-control form-control-sm" required value={camposFormData.orden} onChange={e => setCamposFormData({...camposFormData, orden: parseInt(e.target.value) || 1})} />
                  </div>
                </div>
                
                <div className="d-flex flex-wrap gap-4 mb-3 p-2 bg-light rounded border">
                  <div className="form-check">
                    <input type="checkbox" className="form-check-input" id="campoObligatorio" checked={camposFormData.obligatorio} onChange={e => setCamposFormData({...camposFormData, obligatorio: e.target.checked})} />
                    <label className="form-check-label small fw-bold" htmlFor="campoObligatorio">¿Campo Obligatorio?</label>
                  </div>
                  <div className="form-check">
                    <input type="checkbox" className="form-check-input" id="generaAlerta" checked={camposFormData.generaAlerta} onChange={e => setCamposFormData({...camposFormData, generaAlerta: e.target.checked})} />
                    <label className="form-check-label small fw-bold text-danger" htmlFor="generaAlerta">
                      <i className="bi bi-bell-fill me-1"></i>Genera Alerta de Vencimiento
                    </label>
                  </div>
                </div>

                {camposFormData.tipo === 'select' && (
                  <div className="mb-4 bg-white p-3 rounded-3 border">
                    <div className="mb-3">
                      <label className="form-label small fw-bold mb-1 text-primary">
                        <i className="bi bi-database-fill me-1"></i>Origen de Datos para el Desplegable
                      </label>
                      <select 
                        className="form-select form-select-sm" 
                        value={camposFormData.origenDatos || 'manual'} 
                        onChange={e => setCamposFormData({...camposFormData, origenDatos: e.target.value})}
                      >
                        <option value="manual">Manual (Opciones ingresadas por texto)</option>
                        <option value="config_servicios">Catálogo: Productos y Fitosanitarios (config_servicios)</option>
                        <option value="usuarios">Catálogo: Comerciales / Usuarios (usuarios)</option>
                        <option value="clientes">Catálogo: Clientes / Empresas (clientes)</option>
                      </select>
                    </div>

                    {(camposFormData.origenDatos === 'manual' || !camposFormData.origenDatos) && (
                      <div>
                        <label className="form-label small fw-bold mb-1 text-primary">
                          <i className="bi bi-list-ul me-1"></i>Opciones del Desplegable (Separadas por Comas)
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="ej: SAP, Oracle, ERP Local"
                          required
                          value={camposFormData.opciones}
                          onChange={e => setCamposFormData({...camposFormData, opciones: e.target.value})}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                <div className="d-flex gap-2">
                  {editingCampoKey && (
                    <button type="button" className="btn btn-outline-secondary btn-sm w-50 rounded-pill fw-bold" onClick={handleCancelEditCampo} disabled={saving}>Cancelar</button>
                  )}
                  <button type="submit" className={`btn btn-primary btn-sm ${editingCampoKey ? 'w-50' : 'w-100'} rounded-pill fw-bold`} disabled={saving}>
                    {saving ? 'Guardando...' : (editingCampoKey ? 'Actualizar' : 'Crear Campo')}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-7">
            <>
            {/* TABLA DE SECCIONES */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4">
                <h6 className="fw-bold mb-0 text-dark">Secciones Creadas</h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="px-4 text-muted small fw-bold border-0">ORDEN</th>
                        <th className="text-muted small fw-bold border-0">NOMBRE</th>
                        <th className="text-muted small fw-bold border-0">ENTIDAD</th>
                        <th className="text-end px-4 text-muted small fw-bold border-0">ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seccionesLoading && secciones.length === 0 ? (
                        <tr><td colSpan="4" className="text-center text-muted py-4">Cargando...</td></tr>
                      ) : (
                        secciones.map(s => (
                          <tr key={s.id}>
                            <td className="px-4"><span className="badge bg-secondary rounded-circle">{s.orden}</span></td>
                            <td className="fw-bold text-dark"><i className={`bi ${s.icono || 'bi-grid'} me-2 text-primary`}></i>{s.nombre}</td>
                            <td>
                              <span className={`badge fw-bold ${
                                s.entidad === 'contrato' ? 'bg-info bg-opacity-10 text-info border border-info' : 
                                s.entidad === 'contacto' ? 'bg-success bg-opacity-10 text-success border border-success' :
                                s.entidad === 'crm_actividad' ? 'bg-warning bg-opacity-10 text-warning border border-warning' :
                                s.entidad === 'lead' ? 'bg-success bg-opacity-10 text-success border border-success' :
                                s.entidad === 'oportunidad' ? 'bg-info bg-opacity-10 text-info border border-info' :
                                s.entidad === 'ticket' ? 'bg-warning bg-opacity-10 text-warning border border-warning' :
                                'bg-primary bg-opacity-10 text-primary border border-primary'
                              }`} style={{ fontSize: '0.65rem' }}>
                                {s.entidad === 'contrato' ? '📄 Contrato' : s.entidad === 'contacto' ? '📇 Contacto' : s.entidad === 'crm_actividad' ? '📋 Actividad CRM' : s.entidad === 'lead' ? '🎯 Lead' : s.entidad === 'oportunidad' ? '📈 Oportunidad' : s.entidad === 'ticket' ? '🎫 Ticket CX' : '👤 Cliente'}
                              </span>
                            </td>
                            <td className="px-4">
                              <div className="d-flex gap-2 justify-content-end flex-wrap">
                                <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => handleEditSeccion(s)}>Editar</button>
                                <button className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={() => handleDeleteItem('config_secciones', s.id, 'config_secciones', loadSecciones)}>Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                      {!seccionesLoading && secciones.length === 0 && (
                        <tr><td colSpan="4" className="text-center text-muted py-4">No hay secciones configuradas.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* TABLA DE CAMPOS */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h6 className="fw-bold mb-0 text-dark">Campos Dinámicos</h6>
                <select 
                  className="form-select form-select-sm rounded-pill fw-bold" 
                  style={{ width: 'auto', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}
                  value={filtroSeccionId}
                  onChange={e => setFiltroSeccionId(e.target.value)}
                >
                  <option value="">Todas las secciones</option>
                  <option value="huérfanos">Sin Sección</option>
                  <optgroup label="👤 Cliente">
                    {secciones.filter(s => s.entidad === 'cliente').map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📄 Contrato">
                    {secciones.filter(s => s.entidad === 'contrato').map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📇 Contacto">
                    {secciones.filter(s => s.entidad === 'contacto').map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📋 Actividad CRM">
                    {secciones.filter(s => s.entidad === 'crm_actividad').map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🎯 Lead (Prospección)">
                    {secciones.filter(s => s.entidad === 'lead').map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📈 Oportunidad (Venta)">
                    {secciones.filter(s => s.entidad === 'oportunidad').map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🎫 Ticket (Soporte/CX)">
                    {secciones.filter(s => s.entidad === 'ticket').map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="px-4 text-muted small fw-bold border-0">ORDEN</th>
                        <th className="text-muted small fw-bold border-0">ETIQUETA / KEY</th>
                        <th className="text-muted small fw-bold border-0">SECCIÓN</th>
                        <th className="text-end px-4 text-muted small fw-bold border-0">ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {camposLoading && campos.length === 0 ? (
                        <tr><td colSpan="4" className="text-center text-muted py-4">Cargando campos...</td></tr>
                      ) : (
                        campos.filter(c => {
                          if (!filtroSeccionId) return true;
                          if (filtroSeccionId === 'huérfanos') return !c.seccionId;
                          return c.seccionId === filtroSeccionId;
                        }).map(c => {
                          const seccion = secciones.find(s => s.id === c.seccionId);
                          return (
                            <tr key={c.id}>
                              <td className="px-4"><span className="badge bg-secondary rounded-circle">{c.orden}</span></td>
                              <td>
                                <div className="fw-bold text-dark">
                                  {c.nombre} 
                                  <span className={`badge ${c.tipo === 'select' ? 'bg-info' : c.tipo === 'adjunto' ? 'bg-secondary' : c.tipo === 'whatsapp_phone' ? 'bg-success' : c.tipo === 'checkbox' ? 'bg-warning text-dark' : 'bg-primary'} rounded-pill ms-1`}>{c.tipo}</span>
                                  {c.obligatorio && <span className="badge bg-danger bg-opacity-10 text-danger border border-danger ms-1 fw-bold" style={{fontSize: '0.6rem'}}>REQ</span>}
                                  {c.generaAlerta && <span className="badge bg-danger ms-1" title="Genera Alerta de Vencimiento"><i className="bi bi-bell-fill"></i></span>}
                                </div>
                                <code className="text-muted small">{c.id}</code>
                              </td>
                              <td>
                                {seccion ? (
                                  <span className="badge bg-light text-dark border">
                                    <i className={`bi ${seccion.icono || 'bi-grid'} me-1 text-primary`}></i> {seccion.nombre}
                                  </span>
                                ) : (
                                  <span className="badge bg-warning bg-opacity-10 text-warning border border-warning">Sin Sección</span>
                                )}
                              </td>
                              <td className="px-4">
                                <div className="d-flex gap-2 justify-content-end flex-wrap">
                                  <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => handleEditCampo(c)}>Editar</button>
                                  <button className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={() => handleDeleteItem('config_campos', c.id, 'config_campos', loadCampos)}>Eliminar</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {!camposLoading && campos.length === 0 && (
                        <tr><td colSpan="4" className="text-center text-muted py-4">No hay campos dinámicos configurados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            </>
          </div>
        </div>
      )}

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
