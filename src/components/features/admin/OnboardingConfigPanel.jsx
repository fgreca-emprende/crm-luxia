import { useState, useEffect, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';
import { cacheManager } from '../../../lib/api';
import { ConfirmModal } from './ConfirmModal';

const DEFAULT_ONBOARDING_TASKS = [
  { id: 'acuerdo_comercial_legajo', titulo: 'Acuerdo Comercial y Legajo Impositivo Aprobado', orden: 1, paises: ['Global'], servicios: ['Global'] },
  { id: 'relevamiento_agronomico_lotes', titulo: 'Relevamiento Agronómico y Plan de Campaña', orden: 2, paises: ['Global'], servicios: ['Global'] },
  { id: 'asesoramiento_tecnico_manejo', titulo: 'Asesoramiento Técnico y Calibración de Dosis', orden: 3, paises: ['Global'], servicios: ['Global'] },
  { id: 'coordinacion_logistica_destino', titulo: 'Coordinación Logística y Depósito de Destino', orden: 4, paises: ['Global'], servicios: ['Global'] },
  { id: 'primer_despacho_entrega', titulo: 'Primer Despacho y Entrega en Establecimiento', orden: 5, paises: ['Global'], servicios: ['Global'] },
  { id: 'monitoreo_campo_30_dias', titulo: 'Monitoreo a Campo y Evaluación de Eficacia (30 días)', orden: 6, paises: ['Global'], servicios: ['Global'] },
];

const PAISES_OPTIONS = [
  { id: 'Global', label: '🌍 Global / Todos' },
  { id: 'PE', label: 'PE - Perú' },
  { id: 'MX', label: 'MX - México' },
  { id: 'CL', label: 'CL - Chile' },
  { id: 'CO', label: 'CO - Colombia' },
  { id: 'AR', label: 'AR - Argentina' }
];

const SERVICIOS_OPTIONS = [
  { id: 'Global', label: '🌐 Global / Todas las Líneas' },
  { id: 'herbicidas', label: '🌾 Herbicidas' },
  { id: 'fungicidas', label: '🛡️ Fungicidas' },
  { id: 'insecticidas', label: '🦗 Insecticidas' },
  { id: 'tratamiento_semillas', label: '🌱 Tratamiento de Semillas' },
  { id: 'bioestimulantes', label: '🌿 Bioestimulantes & Especialidades' }
];

export function OnboardingConfigPanel() {
  const [onboardingTasks, setOnboardingTasks] = useState([]);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingFormData, setOnboardingFormData] = useState({ 
    id: '', 
    titulo: '', 
    orden: 1, 
    evidenciaObligatoria: false, 
    paises: ['Global'], 
    servicios: ['Global'] 
  });
  const [editingOnboardingId, setEditingOnboardingId] = useState(null);

  const [saving, setSaving] = useState(false);
  const { showAlert } = useToast();

  const [templateSubject, setTemplateSubject] = useState('Asignación de Hito de Onboarding - LUXIA® Agro');
  const [templateBody, setTemplateBody] = useState('Hola {{email}},\n\nHas sido asignado como responsable del hito agronómico/operativo "{{hito}}" para la cuenta "{{cliente}}".\n\nPor favor, ingresa a LUXIA CRM para completar la tarea, cargar la evidencia correspondiente (remito, acta técnica o constancia) y asegurar la activación del cliente.\n\nSaludos,\nEquipo Comercial & Operaciones - LUXIA® Agro');
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const data = await getConfigGeneral('onboarding_responsable');
        if (data) {
          if (data.subject) setTemplateSubject(data.subject);
          if (data.body) setTemplateBody(data.body);
        }
      } catch (err) {
        console.warn('Error al cargar plantilla de correo de onboarding:', err);
      } finally {
        setLoadingTemplate(false);
      }
    };
    fetchTemplate();
  }, []);

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setSavingTemplate(true);
    try {
      await setConfigGeneral('onboarding_responsable', {
        subject: templateSubject.trim(),
        body: templateBody.trim(),
        updatedAt: new Date().toISOString()
      });
      showAlert('Plantilla de correo de onboarding guardada con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar plantilla: ${err.message}`, 'danger');
    } finally {
      setSavingTemplate(false);
    }
  };

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmBtnClass: 'btn-primary',
    confirmText: 'Confirmar',
    onConfirm: null
  });

  const loadOnboardingTasks = useCallback(async () => {
    setOnboardingLoading(true);
    try {
      const data = await getConfigGeneral('onboarding_tasks');
      if (Array.isArray(data) && data.length > 0) {
        setOnboardingTasks(data);
        setOnboardingFormData(prev => ({ ...prev, orden: data[data.length - 1].orden + 1 }));
      } else {
        await setConfigGeneral('onboarding_tasks', DEFAULT_ONBOARDING_TASKS);
        setOnboardingTasks(DEFAULT_ONBOARDING_TASKS);
        setOnboardingFormData(prev => ({ ...prev, orden: DEFAULT_ONBOARDING_TASKS.length + 1 }));
      }
    } catch (err) {
      showAlert(`Error cargando onboarding: ${err.message}`, 'danger');
    } finally {
      setOnboardingLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadOnboardingTasks();
  }, [loadOnboardingTasks]);

  const handleEditOnboarding = (task) => {
    setEditingOnboardingId(task.id);
    setOnboardingFormData({
      id: task.id,
      titulo: task.titulo || '',
      orden: task.orden || 1,
      evidenciaObligatoria: task.evidenciaObligatoria || false,
      paises: task.paises || ['Global'],
      servicios: task.servicios || ['Global']
    });
  };

  const handleCancelEditOnboarding = () => {
    setEditingOnboardingId(null);
    setOnboardingFormData({ 
      id: '', 
      titulo: '', 
      orden: onboardingTasks.length > 0 ? onboardingTasks[onboardingTasks.length - 1].orden + 1 : 1, 
      evidenciaObligatoria: false,
      paises: ['Global'],
      servicios: ['Global']
    });
  };

  const handleTogglePais = (code) => {
    setOnboardingFormData(prev => {
      let current = prev.paises || [];
      if (code === 'Global') {
        return { ...prev, paises: ['Global'] };
      } else {
        let next = current.filter(x => x !== 'Global');
        if (next.includes(code)) {
          next = next.filter(x => x !== code);
          if (next.length === 0) next = ['Global'];
        } else {
          next.push(code);
        }
        return { ...prev, paises: next };
      }
    });
  };

  const handleToggleServicio = (code) => {
    setOnboardingFormData(prev => {
      let current = prev.servicios || [];
      if (code === 'Global') {
        return { ...prev, servicios: ['Global'] };
      } else {
        let next = current.filter(x => x !== 'Global');
        if (next.includes(code)) {
          next = next.filter(x => x !== code);
          if (next.length === 0) next = ['Global'];
        } else {
          next.push(code);
        }
        return { ...prev, servicios: next };
      }
    });
  };

  const handleSaveOnboarding = async (e) => {
    e.preventDefault();
    const idTrimmed = onboardingFormData.id.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]+$/.test(idTrimmed)) {
      showAlert('El ID solo puede contener letras, números y guiones bajos.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const newTask = {
        id: idTrimmed,
        titulo: onboardingFormData.titulo.trim(),
        orden: parseInt(onboardingFormData.orden) || 1,
        evidenciaObligatoria: onboardingFormData.evidenciaObligatoria || false,
        paises: onboardingFormData.paises || ['Global'],
        servicios: onboardingFormData.servicios || ['Global']
      };

      const existingIndex = onboardingTasks.findIndex(t => t.id === idTrimmed);
      let updated = [];
      if (existingIndex >= 0) {
        updated = onboardingTasks.map((t, idx) => idx === existingIndex ? newTask : t);
      } else {
        updated = [...onboardingTasks, newTask];
      }
      updated.sort((a, b) => (a.orden || 0) - (b.orden || 0));

      await setConfigGeneral('onboarding_tasks', updated);
      await logSystemEvent(null, 'system_config_change', {
        tipoConfig: 'hito_onboarding',
        id: idTrimmed,
        titulo: onboardingFormData.titulo.trim()
      });

      cacheManager.data.delete('config_onboarding');
      showAlert('Hito de Onboarding guardado correctamente', 'success');
      setEditingOnboardingId(null);
      setOnboardingFormData({ 
        id: '', 
        titulo: '', 
        orden: updated.length + 1, 
        evidenciaObligatoria: false,
        paises: ['Global'],
        servicios: ['Global']
      });
      loadOnboardingTasks();
    } catch (err) {
      showAlert(`Error al guardar: ${err.message}`, 'danger');
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
          const updated = onboardingTasks.filter(t => t.id !== id);
          await setConfigGeneral('onboarding_tasks', updated);
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

  const handleBootstrapOnboarding = () => {
    setConfirmModal({
      show: true,
      title: 'Poblar Checklist de Onboarding',
      message: '¿Deseas poblar la base de datos con las 6 actividades operativas clave estándar de Luxia para Go-Live?',
      confirmBtnClass: 'btn-primary',
      confirmText: 'Poblar Actividades',
      onConfirm: async () => {
        setSaving(true);
        try {
          await setConfigGeneral('onboarding_tasks', DEFAULT_ONBOARDING_TASKS);
          cacheManager.data.delete('config_onboarding');
          showAlert('Checklist de onboarding poblado exitosamente', 'success');
          loadOnboardingTasks();
        } catch (err) {
          showAlert(`Error al poblar: ${err.message}`, 'danger');
        } finally {
          setSaving(false);
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <div className="card border-0 bg-light p-4 rounded-4 shadow-sm">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold mb-0 text-dark"><i className="bi bi-plus-circle-fill me-2 text-primary"></i>Nueva Actividad</h6>
            <button className="btn btn-xs btn-outline-primary rounded-pill small fw-bold px-2 py-0.5" style={{ fontSize: '0.70rem' }} onClick={handleBootstrapOnboarding}>
              🚀 Cargar Predeterminados
            </button>
          </div>
          <p className="small text-muted mb-4">Añade hitos operativos dinámicos que se inyectarán en la barra de progreso de los nuevos clientes según país y servicio.</p>
          
          <form onSubmit={handleSaveOnboarding}>
            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Slug / ID del Paso (único)</label>
              <input type="text" className="form-control" placeholder="ej: verificacion_seguro" required value={onboardingFormData.id} onChange={e => setOnboardingFormData({...onboardingFormData, id: e.target.value})} disabled={editingOnboardingId !== null} />
              <div className="form-text" style={{fontSize: '0.75rem'}}>Solo minúsculas y guiones bajos (ej: firma_contrato).</div>
            </div>
            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Título de la Actividad (Visible)</label>
              <input type="text" className="form-control" placeholder="ej: Verificación de seguro de carga" required value={onboardingFormData.titulo} onChange={e => setOnboardingFormData({...onboardingFormData, titulo: e.target.value})} />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Países Destino</label>
              <div className="p-2.5 border rounded bg-white" style={{maxHeight: '120px', overflowY: 'auto'}}>
                {PAISES_OPTIONS.map(p => {
                  const isChecked = (onboardingFormData.paises || []).includes(p.id);
                  return (
                    <div className="form-check my-1" key={p.id}>
                      <input 
                        type="checkbox" 
                        className="form-check-input" 
                        id={`pais-${p.id}`}
                        checked={isChecked}
                        onChange={() => handleTogglePais(p.id)}
                      />
                      <label className="form-check-label small" htmlFor={`pais-${p.id}`}>
                        {p.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Líneas Fitosanitarias Aplicables</label>
              <div className="p-2.5 border rounded bg-white" style={{maxHeight: '120px', overflowY: 'auto'}}>
                {SERVICIOS_OPTIONS.map(s => {
                  const isChecked = (onboardingFormData.servicios || []).includes(s.id);
                  return (
                    <div className="form-check my-1" key={s.id}>
                      <input 
                        type="checkbox" 
                        className="form-check-input" 
                        id={`servicio-${s.id}`}
                        checked={isChecked}
                        onChange={() => handleToggleServicio(s.id)}
                      />
                      <label className="form-check-label small" htmlFor={`servicio-${s.id}`}>
                        {s.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="row g-2 mb-4">
              <div className="col-6">
                <label className="form-label small fw-bold mb-1">Orden de Secuencia</label>
                <input type="number" className="form-control" required value={onboardingFormData.orden} onChange={e => setOnboardingFormData({...onboardingFormData, orden: parseInt(e.target.value) || 1})} />
                <div className="form-text" style={{fontSize: '0.75rem'}}>Determina la jerarquía y posición en el checklist.</div>
              </div>
              <div className="col-6 d-flex align-items-center mt-4">
                <div className="form-check">
                  <input type="checkbox" className="form-check-input" id="evidenciaObligatoria" checked={onboardingFormData.evidenciaObligatoria} onChange={e => setOnboardingFormData({...onboardingFormData, evidenciaObligatoria: e.target.checked})} />
                  <label className="form-check-label small fw-bold" htmlFor="evidenciaObligatoria">¿Evidencia Obligatoria?</label>
                </div>
              </div>
            </div>
            
            <div className="d-flex gap-2">
              {editingOnboardingId && (
                <button type="button" className="btn btn-outline-secondary rounded-pill fw-bold px-4" onClick={handleCancelEditOnboarding} disabled={saving}>
                  Cancelar
                </button>
              )}
              <button type="submit" className="btn btn-primary flex-grow-1 rounded-pill fw-bold" disabled={saving}>
                {saving ? 'Guardando...' : (editingOnboardingId ? 'Guardar Cambios' : 'Crear Hito Operativo')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="col-lg-7">
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4">
            <h6 className="fw-bold mb-0 text-dark">Actividades Operativas Configuradas</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="px-4 text-muted small fw-bold border-0">ORDEN</th>
                    <th className="text-muted small fw-bold border-0">KEY ID</th>
                    <th className="text-muted small fw-bold border-0">ACTIVIDAD</th>
                    <th className="text-end px-4 text-muted small fw-bold border-0">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {onboardingLoading && onboardingTasks.length === 0 ? (
                    <tr><td colSpan="4" className="text-center text-muted py-4">Cargando actividades...</td></tr>
                  ) : (
                    onboardingTasks.map(o => (
                      <tr key={o.id}>
                        <td className="px-4"><span className="badge bg-primary rounded-circle">{o.orden}</span></td>
                        <td><code className="bg-light px-2 py-1 rounded text-primary">{o.id}</code></td>
                        <td>
                          <span className="fw-bold text-dark me-2">{o.titulo}</span>
                          <div className="d-flex flex-wrap gap-1 mt-1.5">
                            {o.evidenciaObligatoria && (
                              <span className="badge bg-warning bg-opacity-10 text-warning border border-warning" style={{ fontSize: '0.62rem' }}>
                                <i className="bi bi-paperclip me-1"></i>Evidencia Req.
                              </span>
                            )}
                            {(o.paises || ['Global']).map(p => (
                              <span key={p} className={`badge ${p === 'Global' ? 'bg-secondary text-secondary' : 'bg-success text-success'} bg-opacity-10 border border-${p === 'Global' ? 'secondary' : 'success'}`} style={{ fontSize: '0.62rem' }}>
                                <i className="bi bi-globe me-1"></i>{p}
                              </span>
                            ))}
                            {(o.servicios || ['Global']).map(s => {
                              const label = s === 'Global' ? 'Global' : (SERVICIOS_OPTIONS.find(so => so.id === s)?.label || s);
                              return (
                                <span key={s} className={`badge ${s === 'Global' ? 'bg-secondary text-secondary' : 'bg-primary text-primary'} bg-opacity-10 border border-${s === 'Global' ? 'secondary' : 'primary'}`} style={{ fontSize: '0.62rem' }}>
                                  <i className="bi bi-tag me-1"></i>{label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="text-end px-4">
                          <div className="d-flex gap-2 justify-content-end flex-wrap">
                            <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => handleEditOnboarding(o)}>
                              Editar
                            </button>
                            <button className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={() => handleDeleteItem('config_onboarding', o.id, 'config_onboarding', loadOnboardingTasks)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {!onboardingLoading && onboardingTasks.length === 0 && (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">
                        No hay hitos de onboarding configurados aún.<br />
                        <button className="btn btn-sm btn-link mt-2 fw-bold text-primary" onClick={handleBootstrapOnboarding}>Poblar con tareas predeterminadas de Luxia</button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Plantilla de Correo de Asignación */}
      <div className="col-12 mt-4">
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4">
            <h6 className="fw-bold mb-0 text-dark">
              <i className="bi bi-envelope-paper-fill me-2 text-warning"></i> Plantilla de Notificación por Correo
            </h6>
            <p className="text-muted small mb-0">Define el asunto y el cuerpo del correo que se enviará automáticamente al asignar un responsable a un hito de onboarding.</p>
          </div>
          <div className="card-body px-4 pb-4">
            {loadingTemplate ? (
              <div className="text-center py-3 text-muted small">Cargando plantilla de correo...</div>
            ) : (
              <form onSubmit={handleSaveTemplate}>
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">Asunto del Correo</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    required
                    value={templateSubject}
                    onChange={e => setTemplateSubject(e.target.value)}
                    placeholder="Asignación de Responsabilidad - Onboarding Luxia"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold mb-1">Cuerpo del Correo</label>
                  <textarea
                    className="form-control rounded-3 font-monospace"
                    rows="6"
                    required
                    value={templateBody}
                    onChange={e => setTemplateBody(e.target.value)}
                    placeholder="Hola {{email}}..."
                    style={{ fontSize: '0.85rem' }}
                  />
                  <div className="form-text" style={{ fontSize: '0.75rem' }}>
                    Variables disponibles: 
                    <code className="bg-light px-1 mx-1 border rounded text-danger">{"{{email}}"}</code> (Correo del responsable), 
                    <code className="bg-light px-1 mx-1 border rounded text-danger">{"{{hito}}"}</code> (Nombre de la actividad), 
                    <code className="bg-light px-1 mx-1 border rounded text-danger">{"{{cliente}}"}</code> (Nombre de la empresa/cliente).
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-warning text-white rounded-pill px-4 fw-bold shadow-sm"
                  disabled={savingTemplate}
                >
                  {savingTemplate ? 'Guardando...' : 'Guardar Plantilla'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

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
