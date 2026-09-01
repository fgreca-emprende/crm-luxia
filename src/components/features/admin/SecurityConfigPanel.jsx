import { useState, useEffect, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';
import { useUserRole } from '../../../contexts/UserRoleContext';

export function SecurityConfigPanel({ user }) {
  const [securityConfig, setSecurityConfig] = useState({
    habilitado: true,
    timeoutMinutos: 15,
    exportRateLimitHabilitado: true,
    exportMaxPorHora: 5,
    exportAlertaExfiltracionMaxFilas: 1000,
    exportRetentionHours: 24
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showAlert } = useToast();
  const { hasPermission } = useUserRole();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigGeneral('security_config');
      if (data) {
        setSecurityConfig({
          habilitado: data.habilitado !== undefined ? data.habilitado : true,
          timeoutMinutos: data.timeoutMinutos !== undefined ? data.timeoutMinutos : 15,
          exportRateLimitHabilitado: data.exportRateLimitHabilitado !== undefined ? data.exportRateLimitHabilitado : true,
          exportMaxPorHora: data.exportMaxPorHora !== undefined ? data.exportMaxPorHora : 5,
          exportAlertaExfiltracionMaxFilas: data.exportAlertaExfiltracionMaxFilas !== undefined ? data.exportAlertaExfiltracionMaxFilas : 1000,
          exportRetentionHours: data.exportRetentionHours !== undefined ? data.exportRetentionHours : 24
        });
      } else {
        const defaultConfig = {
          habilitado: true,
          timeoutMinutos: 15,
          exportRateLimitHabilitado: true,
          exportMaxPorHora: 5,
          exportAlertaExfiltracionMaxFilas: 1000,
          exportRetentionHours: 24
        };
        await setConfigGeneral('security_config', defaultConfig);
        setSecurityConfig(defaultConfig);
      }
    } catch (err) {
      showAlert(`Error al cargar seguridad: ${err.message}`, 'danger');
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
      await setConfigGeneral('security_config', securityConfig);
      await logSystemEvent(user, 'system_config_change', {
        tipoConfig: 'seguridad_y_exportaciones',
        habilitado: securityConfig.habilitado,
        timeoutMinutos: securityConfig.timeoutMinutos,
        exportRateLimitHabilitado: securityConfig.exportRateLimitHabilitado,
        exportMaxPorHora: securityConfig.exportMaxPorHora,
        exportAlertaExfiltracionMaxFilas: securityConfig.exportAlertaExfiltracionMaxFilas,
        exportRetentionHours: securityConfig.exportRetentionHours
      });
      showAlert('Configuración de seguridad guardada con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar seguridad: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <span className="spinner-border spinner-border-sm me-2"></span>Cargando configuraciones de seguridad...
      </div>
    );
  }

  return (
    <div className="card border-0 bg-white p-4 rounded-4 shadow-sm" style={{ border: '1px solid #eef2f6' }}>
      <div className="d-flex align-items-center gap-3 mb-2">
        <div className="rounded-circle bg-danger bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
          <i className="bi bi-shield-lock text-danger fs-5"></i>
        </div>
        <div>
          <h5 className="fw-bold text-dark mb-0">Seguridad y Políticas de Sesión</h5>
          <p className="text-muted small mb-0">Parametriza las reglas de seguridad de sesión del CRM de Luxia</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-4">
        <div className="row g-4">
          {/* Habilitar / Deshabilitar */}
          <div className="col-12">
            <div className="d-flex align-items-start gap-3">
              <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                <i className="bi bi-power text-danger fs-5"></i>
              </div>
              <div className="flex-fill">
                <label className="form-label fw-bold mb-1 text-dark small">Desconexión Automática por Inactividad</label>
                <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                  Cuando se activa, los usuarios que no presenten movimientos serán desconectados del sistema automáticamente.
                </p>
                <div className="form-check form-switch mt-2">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="switchAutomaticLogout"
                    checked={securityConfig.habilitado}
                    onChange={e => setSecurityConfig({ ...securityConfig, habilitado: e.target.checked })}
                    disabled={!hasPermission('actions', 'configurar_logout')}
                  />
                  <label className="form-check-label text-dark small" htmlFor="switchAutomaticLogout">
                    {securityConfig.habilitado ? 'Habilitado' : 'Deshabilitado'}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Tiempo Límite */}
          {securityConfig.habilitado && (
            <div className="col-md-6">
              <div className="d-flex align-items-start gap-3">
                <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                  <i className="bi bi-hourglass-split text-primary fs-5"></i>
                </div>
                <div className="flex-fill">
                  <label className="form-label fw-bold mb-1 text-dark small">Tiempo Límite de Inactividad (Minutos)</label>
                  <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                    Indica el intervalo máximo de tiempo (en minutos) permitido sin actividad antes de desconectar.
                  </p>
                  <input 
                    type="number"
                    className="form-control rounded-3"
                    min="1"
                    max="120"
                    value={securityConfig.timeoutMinutos}
                    onChange={e => setSecurityConfig({ ...securityConfig, timeoutMinutos: Math.max(1, Math.min(120, parseInt(e.target.value) || 15)) })}
                    disabled={!hasPermission('actions', 'configurar_logout')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Límites de Exportación y Exfiltración */}
          <div className="col-12 border-top pt-4 mt-4">
            <h6 className="fw-bold text-dark mb-3"><i className="bi bi-shield-exclamation text-warning me-2"></i>Control de Exfiltración y Límites de Exportación</h6>
            <div className="row g-4">
              {/* Activar / Desactivar Limitador */}
              <div className="col-12">
                <div className="d-flex align-items-start gap-3">
                  <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                    <i className="bi bi-stopwatch-fill text-warning fs-5"></i>
                  </div>
                  <div className="flex-fill">
                    <label className="form-label fw-bold mb-1 text-dark small">Limitador de Tasa para Descarga de Datos</label>
                    <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                      Restringe la cantidad máxima de archivos que un usuario comercial puede exportar en un intervalo de 1 hora para evitar descargas masivas maliciosas.
                    </p>
                    <div className="form-check form-switch mt-2">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id="switchExportRateLimit"
                        checked={securityConfig.exportRateLimitHabilitado}
                        onChange={e => setSecurityConfig({ ...securityConfig, exportRateLimitHabilitado: e.target.checked })}
                        disabled={!hasPermission('actions', 'configurar_logout')}
                      />
                      <label className="form-check-label text-dark small" htmlFor="switchExportRateLimit">
                        {securityConfig.exportRateLimitHabilitado ? 'Habilitado' : 'Deshabilitado'}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Límite por Hora */}
              {securityConfig.exportRateLimitHabilitado && (
                <div className="col-md-6">
                  <div className="d-flex align-items-start gap-3">
                    <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                      <i className="bi bi-arrow-down-up text-primary fs-5"></i>
                    </div>
                    <div className="flex-fill">
                      <label className="form-label fw-bold mb-1 text-dark small">Exportaciones Máximas por Hora (por usuario)</label>
                      <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                        Número máximo de descargas de reportes permitidas a un comercial por cada hora.
                      </p>
                      <input 
                        type="number"
                        className="form-control rounded-3"
                        min="1"
                        max="50"
                        value={securityConfig.exportMaxPorHora}
                        onChange={e => setSecurityConfig({ ...securityConfig, exportMaxPorHora: Math.max(1, Math.min(50, parseInt(e.target.value) || 5)) })}
                        disabled={!hasPermission('actions', 'configurar_logout')}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Umbral de Alerta de Exfiltración */}
              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                    <i className="bi bi-bell-fill text-danger fs-5"></i>
                  </div>
                  <div className="flex-fill">
                    <label className="form-label fw-bold mb-1 text-dark small">Umbral de Alerta por Exfiltración (Filas)</label>
                    <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                      Dispara una advertencia crítica en el sistema cuando un usuario exporte más de esta cantidad de filas en un único reporte.
                    </p>
                    <input 
                      type="number"
                      className="form-control rounded-3"
                      min="10"
                      max="10000"
                      value={securityConfig.exportAlertaExfiltracionMaxFilas}
                      onChange={e => setSecurityConfig({ ...securityConfig, exportAlertaExfiltracionMaxFilas: Math.max(10, Math.min(10000, parseInt(e.target.value) || 1000)) })}
                      disabled={!hasPermission('actions', 'configurar_logout')}
                    />
                  </div>
                </div>
              </div>

              {/* Tiempo de Retención de Reportes (GCS) */}
              <div className="col-md-6">
                <div className="d-flex align-items-start gap-3">
                  <div className="rounded-3 bg-light d-flex align-items-center justify-content-center border" style={{ width: '48px', height: '48px', minWidth: '48px' }}>
                    <i className="bi bi-clock-history text-warning fs-5"></i>
                  </div>
                  <div className="flex-fill">
                    <label className="form-label fw-bold mb-1 text-dark small">Tiempo de Retención de Reportes (Horas)</label>
                    <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                      Tiempo que los archivos temporales de exportación permanecerán almacenados antes de ser eliminados por la política de depuración.
                    </p>
                    <input 
                      type="number"
                      className="form-control rounded-3"
                      min="1"
                      max="168"
                      value={securityConfig.exportRetentionHours || 24}
                      onChange={e => setSecurityConfig({ ...securityConfig, exportRetentionHours: Math.max(1, Math.min(168, parseInt(e.target.value) || 24)) })}
                      disabled={!hasPermission('actions', 'configurar_logout')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="col-12 border-top pt-3 mt-4 d-flex justify-content-end">
            <button 
              type="submit" 
              className="btn btn-primary px-4 rounded-pill fw-bold"
              disabled={saving || !hasPermission('actions', 'configurar_logout')}
              title={!hasPermission('actions', 'configurar_logout') ? "No tienes permisos para modificar la configuración de seguridad" : ""}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>Guardando...
                </>
              ) : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
