import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../lib/configGeneral';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { DynamicFieldInput } from './DynamicFieldInput';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { formatDateTime } from '../../utils/dateUtils';

export function CrmCardDetailModal({ show, onClose, activityData, onSaved, initialStatus = 'todo' }) {
  const { showAlert } = useToast();
  const { isLector, hasPermission, user } = useUserRole();
  const [saving, setSaving] = useState(false);

  // Form State
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState(initialStatus);
  const [clienteId, setClienteId] = useState('');
  const [responsableEmail, setResponsableEmail] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [alertaDiasPrevios, setAlertaDiasPrevios] = useState(3);
  
  // Attachments & Tasks
  const [adjuntos, setAdjuntos] = useState([]);
  const [newAdjuntoNombre, setNewAdjuntoNombre] = useState('');
  const [newAdjuntoUrl, setNewAdjuntoUrl] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessResult, setAccessResult] = useState(null);
  
  const [tareas, setTareas] = useState([]);
  
  // Inline Task Edit state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskTitulo, setTaskTitulo] = useState('');
  const [taskDescripcion, setTaskDescripcion] = useState('');
  const [taskResponsable, setTaskResponsable] = useState('');
  const [taskFechaFin, setTaskFechaFin] = useState('');
  const [taskAlertaDias, setTaskAlertaDias] = useState(2);
  const [taskAdjuntoNombre, setTaskAdjuntoNombre] = useState('');
  const [taskAdjuntoUrl, setTaskAdjuntoUrl] = useState('');

  // Custom Fields state
  const [camposConfig, setCamposConfig] = useState([]);
  const [seccionesConfig, setSeccionesConfig] = useState([]);
  const [camposDinamicos, setCamposDinamicos] = useState({});

  // Dropdown lists
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    if (clienteId) {
      supabase.from('clientes').select('id, nombre_empresa').eq('id', clienteId).maybeSingle().then(res => {
        if (res.data) {
          setClientSearch(res.data.nombre_empresa);
        } else {
          setClientSearch('');
        }
      }).catch(err => {
        console.error("Error fetching client details in modal:", err);
        setClientSearch('');
      });
    } else {
      setClientSearch('');
    }
  }, [clienteId]);

  useEffect(() => {
    if (!clientSearch.trim()) {
      setClientes([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setLoadingClients(true);
      try {
        const term = clientSearch.trim();
        const { data } = await supabase
          .from('clientes')
          .select('id, nombre_empresa, pais')
          .ilike('nombre_empresa', `%${term}%`)
          .limit(20);

        if (data) {
          const mapped = data.map(c => ({ id: c.id, nombreEmpresa: c.nombre_empresa, pais: c.pais }));
          setClientes(mapped);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingClients(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [clientSearch]);

  useEffect(() => {
    if (!show) return;

    const loadMeta = async () => {
      try {
        const [usersRes, camposRes, secRes] = await Promise.all([
          supabase.from('usuarios').select('*'),
          supabase.from('config_campos').select('*').order('orden'),
          supabase.from('config_secciones').select('*').order('orden')
        ]);

        if (usersRes.data) {
          const temp = {};
          usersRes.data.forEach(u => {
            const email = (u.email || u.id || '').toLowerCase().trim();
            if (!email || !email.includes('@')) return;
            temp[email] = {
              email: email,
              nombre: u.nombre || email,
              equipo: u.equipo || ''
            };
          });
          setUsuarios(Object.values(temp));
        }

        if (camposRes.data) setCamposConfig(camposRes.data);
        if (secRes.data) setSeccionesConfig(secRes.data);
      } catch (err) {
        console.warn("Error loading modal metadata:", err);
      }
    };

    loadMeta();

    if (activityData) {
      setTitulo(activityData.titulo || '');
      setDescripcion(activityData.descripcion || '');
      setEstado(activityData.estado || 'todo');
      setClienteId(activityData.clienteId || '');
      setResponsableEmail(activityData.responsableEmail || '');
      
      if (activityData.fechaFin) {
        const date = activityData.fechaFin.toDate ? activityData.fechaFin.toDate() : new Date(activityData.fechaFin);
        setFechaFin(date.toISOString().split('T')[0]);
      } else {
        setFechaFin('');
      }

      setAlertaDiasPrevios(activityData.alertaConfig?.diasPrevios || 3);
      setAdjuntos(activityData.adjuntos || []);
      setTareas(activityData.tareas || []);
      setCamposDinamicos(activityData.camposDinamicos || {});
    } else {
      setTitulo('');
      setDescripcion('');
      setEstado(initialStatus);
      setClienteId('');
      setResponsableEmail(user?.email || 'admin@luxia.com');
      setFechaFin('');
      setAlertaDiasPrevios(3);
      setAdjuntos([]);
      setTareas([]);
      setCamposDinamicos({});
    }
  }, [show, activityData, initialStatus, user]);

  // Verificar acceso de URL de adjunto con debounce
  useEffect(() => {
    if (!newAdjuntoUrl.trim() || !newAdjuntoUrl.startsWith('http')) {
      setAccessResult(null);
      setCheckingAccess(false);
      return;
    }

    setCheckingAccess(true);
    const timer = setTimeout(() => {
      setAccessResult({ accessible: true });
      setCheckingAccess(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [newAdjuntoUrl]);

  if (!show) return null;

  // Manual Attachments helper functions
  const handleAddAdjunto = (e) => {
    e.preventDefault();
    if (!newAdjuntoNombre.trim() || !newAdjuntoUrl.trim()) {
      showAlert('Ingresa un nombre y un enlace válido.', 'warning');
      return;
    }
    setAdjuntos(prev => [...prev, {
      nombre: newAdjuntoNombre.trim(),
      url: newAdjuntoUrl.trim(),
      tipo: 'link'
    }]);
    setNewAdjuntoNombre('');
    setNewAdjuntoUrl('');
    setAccessResult(null);
  };

  const handleRemoveAdjunto = (idx) => {
    setAdjuntos(prev => prev.filter((_, i) => i !== idx));
  };

  // Checklist Tasks helper functions
  const handleOpenTaskForm = (task = null) => {
    if (task) {
      setEditingTaskId(task.id);
      setTaskTitulo(task.titulo);
      setTaskDescripcion(task.descripcion || '');
      setTaskResponsable(task.responsableEmail || '');
      if (task.fechaFin) {
        const date = task.fechaFin.toDate ? task.fechaFin.toDate() : new Date(task.fechaFin);
        setTaskFechaFin(date.toISOString().split('T')[0]);
      } else {
        setTaskFechaFin('');
      }
      setTaskAlertaDias(task.alertaConfig?.diasPrevios || 2);
      if (task.adjuntos && task.adjuntos.length > 0) {
        setTaskAdjuntoNombre(task.adjuntos[0].nombre || '');
        setTaskAdjuntoUrl(task.adjuntos[0].url || '');
      } else {
        setTaskAdjuntoNombre('');
        setTaskAdjuntoUrl('');
      }
    } else {
      setEditingTaskId(null);
      setTaskTitulo('');
      setTaskDescripcion('');
      setTaskResponsable(responsableEmail || user?.email || '');
      setTaskFechaFin('');
      setTaskAlertaDias(2);
      setTaskAdjuntoNombre('');
      setTaskAdjuntoUrl('');
    }
    setShowTaskForm(true);
  };

  const handleSaveTask = (e) => {
    e.preventDefault();
    if (!taskTitulo.trim()) {
      showAlert('El título de la tarea es obligatorio.', 'warning');
      return;
    }

    const tAdjuntos = [];
    if (taskAdjuntoNombre.trim() && taskAdjuntoUrl.trim()) {
      tAdjuntos.push({
        nombre: taskAdjuntoNombre.trim(),
        url: taskAdjuntoUrl.trim(),
        tipo: 'link'
      });
    }

    let fFinObj = null;
    if (taskFechaFin) {
      fFinObj = new Date(taskFechaFin + 'T23:59:59').toISOString();
    }

    if (editingTaskId) {
      setTareas(prev => prev.map(t => t.id === editingTaskId ? {
        ...t,
        titulo: taskTitulo.trim(),
        descripcion: taskDescripcion.trim(),
        responsableEmail: taskResponsable,
        fechaFin: fFinObj,
        alertaConfig: { diasPrevios: parseInt(taskAlertaDias) || 2, alertaGenerada: false },
        adjuntos: tAdjuntos
      } : t));
    } else {
      setTareas(prev => [...prev, {
        id: `t_${Date.now()}`,
        titulo: taskTitulo.trim(),
        descripcion: taskDescripcion.trim(),
        completada: false,
        responsableEmail: taskResponsable,
        fechaFin: fFinObj,
        alertaConfig: { diasPrevios: parseInt(taskAlertaDias) || 2, alertaGenerada: false },
        adjuntos: tAdjuntos
      }]);
    }

    setShowTaskForm(false);
    setEditingTaskId(null);
  };

  const handleToggleTask = (taskId, val) => {
    setTareas(prev => prev.map(t => t.id === taskId ? { ...t, completada: val } : t));
  };

  const handleRemoveTask = (taskId) => {
    setTareas(prev => prev.filter(t => t.id !== taskId));
  };

  // Submit main form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo.trim() || !clienteId) {
      showAlert('El título y el cliente son obligatorios.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const clientObj = clientes.find(c => c.id === clienteId);
      const nombreEmpresa = clientObj ? clientObj.nombreEmpresa : 'Cliente Asociado';
      const pais = clientObj ? clientObj.pais : '';

      let fFinObj = null;
      if (fechaFin) {
        fFinObj = new Date(fechaFin + 'T23:59:59').toISOString();
      }

      const payload = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        estado,
        clienteId,
        nombreEmpresa,
        pais,
        responsableEmail,
        fechaFin: fFinObj,
        alertaConfig: {
          diasPrevios: parseInt(alertaDiasPrevios) || 3,
          alertaGenerada: false
        },
        adjuntos,
        tareas,
        camposDinamicos,
        updatedAt: new Date().toISOString()
      };

      const currentList = (await getConfigGeneral('actividades_crm')) || [];
      let newList;

      if (activityData) {
        newList = currentList.map(a => a.id === activityData.id ? { ...a, ...payload } : a);
        showAlert('Actividad CRM actualizada correctamente', 'success');
      } else {
        const newAct = {
          id: `act_${Date.now()}`,
          ...payload,
          creadaEn: new Date().toISOString(),
          creadaPor: user?.email || 'admin@luxia.com'
        };
        newList = [newAct, ...currentList];
        showAlert('Actividad CRM creada con éxito', 'success');
      }

      await setConfigGeneral('actividades_crm', newList);

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      showAlert(`Error al guardar actividad: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          
          {saving && (
            <SpinnerPremium overlay={true} text="Guardando actividad en el tablero..." />
          )}

          <div className="modal-header">
            <h5 className="modal-title d-flex align-items-center">
              <i className="bi bi-kanban text-primary me-2 fs-5"></i>
              {activityData ? 'Editar Actividad CRM' : 'Nueva Actividad CRM'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>

          <div className="modal-body px-4 py-3">
              <form onSubmit={handleSubmit}>
                <div className="row g-3 mb-4">
                  {/* Título de Actividad */}
                  <div className="col-12">
                    <label className="form-label small fw-bold">Título de la Actividad</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ej. Revisión y renovación de anexo contractual" 
                      required 
                      value={titulo}
                      onChange={e => setTitulo(e.target.value)}
                      disabled={isLector}
                    />
                  </div>

                  {/* Descripción */}
                  <div className="col-12">
                    <label className="form-label small fw-bold">Descripción / Detalles</label>
                    <textarea 
                      className="form-control" 
                      rows="3" 
                      placeholder="Ingresa los objetivos o detalles específicos de esta actividad de CRM..."
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      disabled={isLector}
                    ></textarea>
                  </div>

                  {/* Cliente Asociado */}
                  <div className="col-md-6 position-relative">
                    <label className="form-label small fw-bold">Cliente B2B</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      required 
                      placeholder="Buscar y asociar empresa..." 
                      value={clientSearch}
                      onChange={e => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                        if (!e.target.value) {
                          setClienteId('');
                        }
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                      disabled={isLector}
                    />
                    {showClientDropdown && (
                      <div className="dropdown-menu show w-100 position-absolute border-secondary-subtle" style={{ maxHeight: '180px', overflowY: 'auto', zIndex: 1050 }}>
                        {loadingClients && (
                          <div className="dropdown-item disabled text-muted small"><span className="spinner-border spinner-border-sm me-2"></span>Buscando...</div>
                        )}
                        {clientes.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className="dropdown-item text-start small"
                            onClick={() => {
                              setClienteId(c.id);
                              setClientSearch(c.nombreEmpresa);
                              setShowClientDropdown(false);
                            }}
                          >
                            {c.nombreEmpresa} ({c.pais || 'Regional'})
                          </button>
                        ))}
                        {!loadingClients && clientes.length === 0 && (
                          <div className="dropdown-item disabled text-muted small">Escribe para buscar cliente</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Responsable de la Tarjeta */}
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Responsable Principal</label>
                    <select 
                      className="form-select"
                      required
                      value={responsableEmail}
                      onChange={e => setResponsableEmail(e.target.value)}
                      disabled={isLector}
                    >
                      <option value="">Selecciona responsable...</option>
                      {usuarios
                        .filter(u => u.equipo === 'Adquisicion' || u.equipo === 'Retencion')
                        .map(u => (
                          <option key={u.email} value={u.email}>{u.nombre} ({u.equipo === 'Adquisicion' ? 'Adquisición' : 'Retención'})</option>
                        ))}
                    </select>
                  </div>

                  {/* Estado del Tablero */}
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Estado en Tablero</label>
                    <select 
                      className="form-select" 
                      value={estado} 
                      onChange={e => setEstado(e.target.value)}
                      disabled={isLector}
                    >
                      <option value="backlog">📦 Backlog</option>
                      <option value="todo">📋 Por Hacer</option>
                      <option value="in_progress">⚙️ En Proceso</option>
                      <option value="in_review">👀 En Revisión</option>
                      <option value="done">✅ Completado</option>
                    </select>
                  </div>

                  {/* Fecha de Vencimiento */}
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Fecha de Fin (Vencimiento)</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={fechaFin}
                      onChange={e => setFechaFin(e.target.value)}
                      disabled={isLector}
                    />
                  </div>

                  {/* Regla de Alerta */}
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Alerta Preventiva (Días)</label>
                    <select 
                      className="form-select" 
                      value={alertaDiasPrevios} 
                      onChange={e => setAlertaDiasPrevios(parseInt(e.target.value))}
                      disabled={isLector}
                    >
                      <option value="1">1 día antes</option>
                      <option value="2">2 días antes</option>
                      <option value="3">3 días antes</option>
                      <option value="5">5 días antes</option>
                      <option value="7">1 semana antes</option>
                    </select>
                  </div>
                </div>

                {/* --- SECCIÓN: CAMPOS DINÁMICOS CONFIGURADOS --- */}
                {(() => {
                  const seccionesActividad = seccionesConfig.filter(s => s.entidad === 'crm_actividad').sort((a,b) => a.orden - b.orden);
                  
                  const getEntidadDeCampo = (campo) => {
                    if (campo.seccionId) {
                      const sec = seccionesConfig.find(s => s.id === campo.seccionId);
                      if (sec) return sec.entidad;
                    }
                    return campo.entidad || 'cliente';
                  };

                  const camposAgrupados = {};
                  camposConfig.forEach(campo => {
                    const entidad = getEntidadDeCampo(campo);
                    if (entidad === 'crm_actividad') {
                      const sId = campo.seccionId || 'huerfanos';
                      if (!camposAgrupados[sId]) camposAgrupados[sId] = [];
                      camposAgrupados[sId].push(campo);
                    }
                  });

                  if (seccionesActividad.length === 0 && (!camposAgrupados['huerfanos'] || camposAgrupados['huerfanos'].length === 0)) {
                    return null;
                  }

                  const renderCampo = (campo) => (
                    <DynamicFieldInput 
                      key={campo.id}
                      campo={campo}
                      value={camposDinamicos[campo.key]}
                      onChange={(val) => setCamposDinamicos(prev => ({ ...prev, [campo.key]: val }))}
                      clientId={clienteId || 'temp'}
                    />
                  );

                  return (
                    <div className="border-top pt-4 mb-4">
                      <h6 className="fw-bold mb-3 text-secondary"><i className="bi bi-gear-wide-connected me-2"></i>Atributos Personalizados de Actividad</h6>
                      <div className="row g-3">
                        {seccionesActividad.map(seccion => {
                          const camposSeccion = (camposAgrupados[seccion.id] || []).sort((a,b) => a.orden - b.orden);
                          if (camposSeccion.length === 0) return null;

                          return (
                            <div key={seccion.id} className="col-12 mb-3">
                              <span className="small text-muted fw-bold d-block mb-2 text-uppercase" style={{ fontSize: '0.7rem' }}>
                                <i className={`bi ${seccion.icono || 'bi-grid'} me-1`}></i> {seccion.nombre}
                              </span>
                              <div className="row g-3">
                                {camposSeccion.map(renderCampo)}
                              </div>
                            </div>
                          );
                        })}

                        {(camposAgrupados['huerfanos'] || []).length > 0 && (
                          <div className="col-12">
                            <div className="row g-3">
                              {(camposAgrupados['huerfanos'] || []).sort((a,b) => a.orden - b.orden).map(renderCampo)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* --- SECCIÓN: DOCUMENTOS ADJUNTOS / GOOGLE DRIVE --- */}
                <div className="border-top pt-4 mb-4">
                  <h6 className="fw-bold mb-3 text-secondary d-flex align-items-center">
                    <i className="bi bi-link-45deg fs-5 text-primary me-2"></i>
                    Enlaces y Documentos Adjuntos (Google Drive / Soporte)
                  </h6>
                  
                  {adjuntos.length === 0 ? (
                    <p className="small text-muted mb-3 italic">No se registran enlaces cargados aún en esta actividad.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2 mb-3">
                      {adjuntos.map((adj, idx) => (
                        <div key={idx} className="d-flex justify-content-between align-items-center bg-light p-2 rounded-3 border">
                          <a href={adj.url} target="_blank" rel="noopener noreferrer" className="small fw-bold text-primary text-truncate d-flex align-items-center" style={{ maxWidth: '80%' }}>
                            <i className="bi bi-file-earmark-text-fill me-2 fs-6"></i>
                            {adj.nombre}
                          </a>
                          {!isLector && (
                            <button type="button" className="btn btn-sm btn-link text-danger p-0 border-0" onClick={() => handleRemoveAdjunto(idx)}>
                              <i className="bi bi-trash-fill"></i>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Adjunto Form */}
                  <div className="row g-2 bg-light p-3 rounded-4 border">
                    <div className="col-md-4">
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="Nombre (Ej. Carpeta del Contrato)" 
                        value={newAdjuntoNombre}
                        onChange={e => setNewAdjuntoNombre(e.target.value)}
                        disabled={isLector}
                      />
                    </div>
                    <div className="col-md-6">
                      <input 
                        type="url" 
                        className="form-control form-control-sm" 
                        placeholder="Pegar Enlace (https://drive.google.com/...)" 
                        value={newAdjuntoUrl}
                        onChange={e => setNewAdjuntoUrl(e.target.value)}
                        disabled={isLector}
                      />
                    </div>
                    <div className="col-md-2">
                      <button type="button" className="btn btn-outline-primary btn-sm w-100 rounded-pill fw-bold" onClick={handleAddAdjunto} disabled={isLector}>
                        <i className="bi bi-plus-circle me-1"></i> Adjuntar
                      </button>
                    </div>

                    {checkingAccess && (
                      <div className="col-12 mt-2 text-start">
                        <div className="text-muted small d-flex align-items-center gap-2 animate-pulse" style={{ fontSize: '0.72rem' }}>
                          <span className="spinner-border spinner-border-sm" role="status" style={{ width: '12px', height: '12px' }}></span>
                          Verificando permisos y accesibilidad del enlace en segundo plano...
                        </div>
                      </div>
                    )}

                    {accessResult && !checkingAccess && (
                      <div className="col-12 mt-2 text-start animate-fade-in">
                        <div className={`alert py-2 px-3 rounded-3 mb-0 border d-flex align-items-center gap-2 ${
                          accessResult.accessible 
                            ? 'alert-success bg-success bg-opacity-10 text-success border-success border-opacity-25' 
                            : 'alert-warning bg-warning bg-opacity-10 text-warning border-warning border-opacity-25'
                        }`} style={{ fontSize: '0.72rem' }}>
                          <i className={`bi ${accessResult.accessible ? 'bi-shield-check-fill text-success' : 'bi-exclamation-triangle-fill text-warning'} fs-6`}></i>
                          <div className="flex-fill">
                            <span className="fw-bold">{accessResult.accessible ? 'Acceso Verificado' : 'Advertencia de Privacidad'}:</span>{' '}
                            {accessResult.message}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* --- SECCIÓN: CHECKLIST DE TAREAS --- */}
                <div className="border-top pt-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0 text-secondary d-flex align-items-center">
                      <i className="bi bi-check2-square fs-5 text-primary me-2"></i>
                      Checklist de Tareas ({tareas.filter(t => t.completada).length}/{tareas.length})
                    </h6>
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm rounded-pill fw-bold" 
                      onClick={() => handleOpenTaskForm(null)}
                      disabled={isLector || !hasPermission('actions', 'operar_tarea_crm')}
                      title={!hasPermission('actions', 'operar_tarea_crm') ? "Sin permisos para agregar tareas (Falta operar_tarea_crm)" : ""}
                    >
                      <i className="bi bi-plus-lg me-1"></i> Agregar Tarea
                    </button>
                  </div>

                  {/* Progreso de la checklist */}
                  {tareas.length > 0 && (
                    <div className="progress mb-3" style={{ height: '8px', backgroundColor: '#e2e8f0' }}>
                      <div 
                        className="progress-bar bg-success" 
                        role="progressbar" 
                        style={{ width: `${Math.round((tareas.filter(t => t.completada).length / tareas.length) * 100)}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Lista de tareas */}
                  <div className="d-flex flex-column gap-2.5 mb-4">
                    {tareas.length === 0 ? (
                      <p className="small text-muted mb-0 italic">No hay tareas cargadas. Agrega al menos una para dar seguimiento en el checklist.</p>
                    ) : (
                      tareas.map(t => {
                        const dateStr = t.fechaFin
                          ? (t.fechaFin.toDate ? t.fechaFin.toDate() : new Date(t.fechaFin)).toLocaleDateString('es-ES')
                          : 'Sin fecha';
                        return (
                          <div key={t.id} className="card p-3 shadow-xs border bg-light">
                            <div className="d-flex justify-content-between align-items-start gap-2">
                              <div className="d-flex align-items-start gap-2.5 flex-grow-1" style={{ minWidth: 0 }}>
                                <input 
                                  type="checkbox" 
                                  className="form-check-input mt-1 flex-shrink-0"
                                  checked={t.completada}
                                  disabled={isLector || !hasPermission('actions', 'operar_tarea_crm')}
                                  onChange={e => handleToggleTask(t.id, e.target.checked)}
                                />
                                <div style={{ minWidth: 0 }}>
                                  <span className={`fw-bold text-dark small d-block ${t.completada ? 'text-decoration-line-through text-muted' : ''}`}>
                                    {t.titulo}
                                  </span>
                                  {t.descripcion && (
                                    <span className="text-muted d-block small mb-1.5" style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                      {t.descripcion}
                                    </span>
                                  )}
                                  <div className="d-flex gap-3 align-items-center flex-wrap" style={{ fontSize: '0.7rem' }}>
                                    <span className="text-muted">
                                      <i className="bi bi-person me-1"></i>{t.responsableEmail}
                                    </span>
                                    <span className="text-muted">
                                      <i className="bi bi-calendar-check me-1"></i>Vence: {dateStr}
                                    </span>
                                    {t.adjuntos?.[0] && (
                                      <a href={t.adjuntos[0].url} target="_blank" rel="noopener noreferrer" className="fw-bold text-primary">
                                        <i className="bi bi-link-45deg me-0.5"></i>Drive
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {hasPermission('actions', 'operar_tarea_crm') && (
                                <div className="d-flex gap-1.5 flex-shrink-0">
                                  <button type="button" className="btn btn-sm btn-link text-primary p-0 border-0" onClick={() => handleOpenTaskForm(t)}>
                                    <i className="bi bi-pencil-fill"></i>
                                  </button>
                                  <button type="button" className="btn btn-sm btn-link text-danger p-0 border-0" onClick={() => handleRemoveTask(t.id)}>
                                    <i className="bi bi-trash-fill"></i>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Modal / Formulario Inline de Tareas */}
                  {showTaskForm && (
                    <div className="bg-light p-3 rounded-4 border border-primary border-opacity-25 mt-2">
                      <h6 className="fw-bold mb-3 text-primary" style={{ fontSize: '0.85rem' }}>
                        {editingTaskId ? '📝 Editar Tarea del Checklist' : '➕ Nueva Tarea del Checklist'}
                      </h6>
                      <div className="row g-2.5">
                        <div className="col-12">
                          <label className="form-label small fw-bold mb-0.5" style={{ fontSize: '0.72rem' }}>Título de Tarea</label>
                          <input 
                            type="text" 
                            className="form-control form-control-sm" 
                            placeholder="Ej. Revisar anexo de precios logísticos" 
                            required 
                            value={taskTitulo}
                            onChange={e => setTaskTitulo(e.target.value)}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-bold mb-0.5" style={{ fontSize: '0.72rem' }}>Descripción</label>
                          <textarea 
                            className="form-control form-control-sm" 
                            rows="2" 
                            placeholder="Detalla qué acciones específicas comprende esta tarea..." 
                            value={taskDescripcion}
                            onChange={e => setTaskDescripcion(e.target.value)}
                          ></textarea>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold mb-0.5" style={{ fontSize: '0.72rem' }}>Asignado</label>
                          <select 
                            className="form-select form-select-sm"
                            value={taskResponsable}
                            onChange={e => setTaskResponsable(e.target.value)}
                          >
                            <option value="">Selecciona asignado...</option>
                            {usuarios
                              .filter(u => u.equipo === 'Adquisicion' || u.equipo === 'Retencion')
                              .map(u => (
                                <option key={u.email} value={u.email}>{u.nombre} ({u.equipo === 'Adquisicion' ? 'Adquisición' : 'Retención'})</option>
                              ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small fw-bold mb-0.5" style={{ fontSize: '0.72rem' }}>Vence</label>
                          <input 
                            type="date" 
                            className="form-control form-control-sm" 
                            value={taskFechaFin}
                            onChange={e => setTaskFechaFin(e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small fw-bold mb-0.5" style={{ fontSize: '0.72rem' }}>Alerta (Días)</label>
                          <select 
                            className="form-select form-select-sm"
                            value={taskAlertaDias}
                            onChange={e => setTaskAlertaDias(parseInt(e.target.value))}
                          >
                            <option value="1">1 día antes</option>
                            <option value="2">2 días antes</option>
                            <option value="3">3 días antes</option>
                            <option value="5">5 días antes</option>
                          </select>
                        </div>

                        {/* Task Drive Attachment */}
                        <div className="col-md-5">
                          <label className="form-label small fw-bold mb-0.5" style={{ fontSize: '0.72rem' }}>Nombre del Adjunto (Opcional)</label>
                          <input 
                            type="text" 
                            className="form-control form-control-sm" 
                            placeholder="Ej. Borrador de Tarifas" 
                            value={taskAdjuntoNombre}
                            onChange={e => setTaskAdjuntoNombre(e.target.value)}
                          />
                        </div>
                        <div className="col-md-7">
                          <label className="form-label small fw-bold mb-0.5" style={{ fontSize: '0.72rem' }}>Enlace de Drive (Opcional)</label>
                          <input 
                            type="url" 
                            className="form-control form-control-sm" 
                            placeholder="Pegar https://drive.google.com/..." 
                            value={taskAdjuntoUrl}
                            onChange={e => setTaskAdjuntoUrl(e.target.value)}
                          />
                        </div>

                        <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                          <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill fw-bold" onClick={() => setShowTaskForm(false)}>
                            Cancelar
                          </button>
                          <button type="button" className="btn btn-primary btn-sm rounded-pill fw-bold" onClick={handleSaveTask}>
                            {editingTaskId ? 'Actualizar Tarea' : 'Agregar al Checklist'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {activityData && (
                  <div className="col-12 mt-4 pt-2 border-top d-flex justify-content-between text-muted" style={{ fontSize: '0.75rem' }}>
                    <span><i className="bi bi-calendar-plus me-1"></i>Creado por {activityData.creadaPor || 'sistema'} el {formatDateTime(activityData.creadaEn)}</span>
                    <span><i className="bi bi-calendar-check me-1"></i>Última Act.: {formatDateTime(activityData.updatedAt || activityData.creadaEn)}</span>
                  </div>
                )}

                {/* Footer Buttons hidden inside form, handled by modal footer */}
                <button type="submit" id="main-submit-btn" className="d-none"></button>
              </form>
            </div>

            <div className="modal-footer px-4 py-3">
              <button 
                type="button" 
                className="btn btn-outline-secondary rounded-pill px-4 fw-bold" 
                onClick={onClose}
                disabled={saving}
              >
                Cerrar
              </button>
              <button 
                type="button" 
                className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" 
                onClick={() => document.getElementById('main-submit-btn').click()}
                disabled={saving || !titulo.trim() || !clienteId || isLector}
                title={isLector ? "Permiso denegado (Rol Lector)" : ""}
              >
                {saving ? 'Guardando...' : (activityData ? 'Guardar Cambios' : 'Crear Actividad')}
              </button>
            </div>

          </div>
        </div>
      </div>
  );
}
