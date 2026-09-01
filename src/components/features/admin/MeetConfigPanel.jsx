import { useState, useEffect, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';

export function MeetConfigPanel({ user }) {
  const [meetConfig, setMeetConfig] = useState({
    maxRecordingDurationMinutes: 60,
    aiProcessingThresholdMinutes: 45,
    storageStrategy: 'drive_embed',
    autoDeleteDriveAfterDays: 90,
    autoDeleteHabilitado: true,
    autoCreateTasks: true,
    templateEmailAsunto: 'Confirmación de Reunión: {titulo}',
    templateEmailCuerpo: 'Hola {nombreContacto},\n\nTe confirmo nuestra videollamada programada para el {fechaHora}.\n\nPara unirte, haz clic en el siguiente enlace de Google Meet:\n{hangoutLink}\n\nQuedo a tu disposición.\nSaludos.'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showAlert } = useToast();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigGeneral('meet_config');
      if (data) {
        setMeetConfig({
          maxRecordingDurationMinutes: 60,
          aiProcessingThresholdMinutes: 45,
          storageStrategy: 'drive_embed',
          autoDeleteDriveAfterDays: 90,
          autoDeleteHabilitado: true,
          autoCreateTasks: true,
          templateEmailAsunto: 'Confirmación de Reunión: {titulo}',
          templateEmailCuerpo: 'Hola {nombreContacto},\n\nTe confirmo nuestra videollamada programada para el {fechaHora}.\n\nPara unirte, haz clic en el siguiente enlace de Google Meet:\n{hangoutLink}\n\nQuedo a tu disposición.\nSaludos.',
          ...data
        });
      } else {
        const defaultConfig = {
          maxRecordingDurationMinutes: 60,
          aiProcessingThresholdMinutes: 45,
          storageStrategy: 'drive_embed',
          autoDeleteDriveAfterDays: 90,
          autoDeleteHabilitado: true,
          autoCreateTasks: true,
          templateEmailAsunto: 'Confirmación de Reunión: {titulo}',
          templateEmailCuerpo: 'Hola {nombreContacto},\n\nTe confirmo nuestra videollamada programada para el {fechaHora}.\n\nPara unirte, haz clic en el siguiente enlace de Google Meet:\n{hangoutLink}\n\nQuedo a tu disposición.\nSaludos.'
        };
        await setConfigGeneral('meet_config', defaultConfig);
        setMeetConfig(defaultConfig);
      }
    } catch (err) {
      showAlert(`Error al cargar políticas Meet: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setConfigGeneral('meet_config', meetConfig);
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'google_meet_politicas',
        maxRecordingDurationMinutes: meetConfig.maxRecordingDurationMinutes,
        storageStrategy: meetConfig.storageStrategy,
        autoDeleteDriveAfterDays: meetConfig.autoDeleteDriveAfterDays,
        autoDeleteHabilitado: meetConfig.autoDeleteHabilitado,
        autoCreateTasks: meetConfig.autoCreateTasks
      });
      showAlert('Políticas de Google Meet guardadas con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar políticas Meet: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <span className="spinner-border spinner-border-sm me-2 text-primary"></span>Cargando políticas de Google Meet...
      </div>
    );
  }

  return (
    <div className="card border-0 bg-white p-4 rounded-4 shadow-sm" style={{ border: '1px solid #eef2f6' }}>
      <div className="d-flex align-items-center gap-3 mb-2">
        <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
          <i className="bi bi-camera-video text-primary fs-5"></i>
        </div>
        <div>
          <h5 className="fw-bold text-dark mb-0">Políticas de Google Meet y Gobernanza</h5>
          <p className="text-muted small mb-0">Configura los límites de grabación, costos de IA y políticas de purga en Drive</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-4">
        <div className="row g-4">
          {/* Límite de Grabación */}
          <div className="col-md-6">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-clock-history text-primary fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small" htmlFor="maxDuration">Duración Máxima de Grabación (Minutos)</label>
                <p className="text-muted mb-2" style={{ fontSize: '0.72rem', lineHeight: '1.2' }}>
                  Tiempo límite de grabación a procesar por LUXIA IA. Las grabaciones que superen este tiempo serán truncadas o no se descargarán los archivos multimedia.
                </p>
                <input 
                  type="number" 
                  className="form-control form-control-sm rounded-3 text-dark fw-bold border" 
                  id="maxDuration" 
                  value={meetConfig.maxRecordingDurationMinutes} 
                  onChange={e => setMeetConfig({ ...meetConfig, maxRecordingDurationMinutes: parseInt(e.target.value) || 0 })}
                  min="5"
                  max="480"
                  required
                />
              </div>
            </div>
          </div>

          {/* Umbral de procesamiento de LUXIA IA */}
          <div className="col-md-6">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-robot text-success fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small" htmlFor="aiThreshold">Límite de Análisis IA (Minutos)</label>
                <p className="text-muted mb-2" style={{ fontSize: '0.72rem', lineHeight: '1.2' }}>
                  Límite máximo de transcripción de llamada que procesará LUXIA IA con Gemini para optimizar el consumo de tokens.
                </p>
                <input 
                  type="number" 
                  className="form-control form-control-sm rounded-3 text-dark fw-bold border" 
                  id="aiThreshold" 
                  value={meetConfig.aiProcessingThresholdMinutes} 
                  onChange={e => setMeetConfig({ ...meetConfig, aiProcessingThresholdMinutes: parseInt(e.target.value) || 0 })}
                  min="5"
                  max="240"
                  required
                />
              </div>
            </div>
          </div>

          <hr className="my-4 border-light-subtle" />

          {/* Estrategia de Almacenamiento */}
          <div className="col-md-6">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-database text-warning fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small" htmlFor="storageStrategy">Estrategia de Almacenamiento</label>
                <p className="text-muted mb-2" style={{ fontSize: '0.72rem', lineHeight: '1.2' }}>
                  <strong>Drive Embed (Costo Cero):</strong> No descarga archivos multimedia al hosting del CRM y reproduce vía iframe. Recomendado.
                </p>
                <select 
                  className="form-select form-select-sm rounded-3 text-dark fw-bold border" 
                  id="storageStrategy"
                  value={meetConfig.storageStrategy}
                  onChange={e => setMeetConfig({ ...meetConfig, storageStrategy: e.target.value })}
                >
                  <option value="drive_embed">Drive Embed (Costo Cero en Hosting)</option>
                  <option value="storage_mirror">Cloud Storage Mirror (Duplicar en CRM)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Auto Tareas */}
          <div className="col-md-6">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-check2-square text-info fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small">Despacho Automático de Tareas</label>
                <p className="text-muted mb-2" style={{ fontSize: '0.72rem', lineHeight: '1.2' }}>
                  Cuando LUXIA IA detecta accionables en la llamada, crear tareas automáticamente asignadas en el módulo del CRM.
                </p>
                <div className="form-check form-switch mt-1">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="switchAutoTasks"
                    checked={meetConfig.autoCreateTasks}
                    onChange={e => setMeetConfig({ ...meetConfig, autoCreateTasks: e.target.checked })}
                  />
                  <label className="form-check-label text-dark small" htmlFor="switchAutoTasks">
                    {meetConfig.autoCreateTasks ? 'Habilitado' : 'Deshabilitado'}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <hr className="my-4 border-light-subtle" />

          {/* Purga Automática en Drive */}
          <div className="col-12">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-trash3 text-danger fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small">Purga Automática de Archivos Pesados en Google Drive</label>
                <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                  Elimina automáticamente el archivo de video (.mp4) de Google Drive una vez transcurrido el tiempo seleccionado, previniendo saturación de almacenamiento corporativo. La transcripción de texto y el resumen en el CRM permanecerán guardados de forma indefinida.
                </p>
                
                <div className="d-flex align-items-center gap-4 flex-wrap mt-2">
                  <div className="form-check form-switch">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="switchAutoDelete"
                      checked={meetConfig.autoDeleteHabilitado}
                      onChange={e => setMeetConfig({ ...meetConfig, autoDeleteHabilitado: e.target.checked })}
                    />
                    <label className="form-check-label text-dark small" htmlFor="switchAutoDelete">
                      Purga automática activa
                    </label>
                  </div>

                  {meetConfig.autoDeleteHabilitado && (
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-dark small">Purgar a los</span>
                      <input 
                        type="number" 
                        className="form-control form-control-sm rounded-3 text-dark fw-bold border text-center" 
                        style={{ width: '80px' }}
                        value={meetConfig.autoDeleteDriveAfterDays} 
                        onChange={e => setMeetConfig({ ...meetConfig, autoDeleteDriveAfterDays: parseInt(e.target.value) || 0 })}
                        min="1"
                        max="365"
                        required
                      />
                      <span className="text-dark small">días de antiguedad.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <hr className="my-4 border-light-subtle" />

          {/* Plantilla de Email */}
          <div className="col-12 animate-fade-in">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-envelope-paper-fill text-primary fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small">Plantilla de Correo de Invitación Personalizado (Enviado vía Gmail)</label>
                <p className="text-muted mb-3" style={{ fontSize: '0.75rem' }}>
                  Define el asunto y cuerpo del correo electrónico de invitación que se enviará automáticamente al contacto de forma nativa desde la cuenta de Gmail del comercial una vez agendada la videollamada.
                </p>

                <div className="mb-3">
                  <label className="form-label fw-bold text-dark small" htmlFor="emailAsunto">Asunto del Correo</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm rounded-3 border text-dark" 
                    id="emailAsunto" 
                    value={meetConfig.templateEmailAsunto || ''} 
                    onChange={e => setMeetConfig({ ...meetConfig, templateEmailAsunto: e.target.value })}
                    required
                  />
                </div>

                <div className="mb-2">
                  <label className="form-label fw-bold text-dark small" htmlFor="emailCuerpo">Cuerpo del Correo</label>
                  <textarea 
                    className="form-control form-control-sm rounded-3 border text-dark font-monospace" 
                    id="emailCuerpo" 
                    rows="6"
                    style={{ fontSize: '0.8rem' }}
                    value={meetConfig.templateEmailCuerpo || ''} 
                    onChange={e => setMeetConfig({ ...meetConfig, templateEmailCuerpo: e.target.value })}
                    required
                  />
                </div>

                <div className="p-3 bg-light border rounded-3 small mt-2">
                  <strong className="d-block mb-1 text-muted" style={{ fontSize: '0.7rem' }}>Cheatsheet de Variables Disponibles:</strong>
                  <div className="d-flex flex-wrap gap-2">
                    <span className="badge bg-white text-dark border font-monospace">{"{titulo}"}</span>
                    <span className="badge bg-white text-dark border font-monospace">{"{nombreContacto}"}</span>
                    <span className="badge bg-white text-dark border font-monospace">{"{fechaHora}"}</span>
                    <span className="badge bg-white text-dark border font-monospace">{"{hangoutLink}"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-end mt-4 pt-3 border-top">
          <button 
            type="submit" 
            className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Guardando...
              </>
            ) : (
              'Guardar Políticas de Meet'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
