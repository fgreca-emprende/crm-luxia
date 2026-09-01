import { useState, useEffect, useCallback } from 'react';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { SpinnerPremium } from '../../ui/SpinnerPremium';
import { ConfirmModal } from './ConfirmModal';
import { useUserRole } from '../../../contexts/UserRoleContext';

export function SystemAlertsConfigPanel() {
  const { showAlert } = useToast();
  const { userEmail } = useUserRole();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState('info');
  const [activa, setActiva] = useState(true);
  const [critica, setCritica] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmBtnClass: 'btn-danger',
    confirmText: 'Eliminar',
    onConfirm: null
  });

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigGeneral('alertas_sistema');
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn("Error cargando alertas de sistema:", error);
      showAlert("Error al cargar alertas del sistema", "danger");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mensaje.trim()) {
      showAlert("El mensaje de la alerta no puede estar vacío", "warning");
      return;
    }

    setSaving(true);
    try {
      let updated = [];
      if (editingId) {
        // Actualizar alerta existente
        updated = alerts.map(a => a.id === editingId ? {
          ...a,
          mensaje: mensaje.trim(),
          tipo,
          activa,
          critica,
          actualizadoEn: new Date().toISOString()
        } : a);
        await setConfigGeneral('alertas_sistema', updated);
        setAlerts(updated);
        showAlert("Alerta del sistema actualizada exitosamente", "success");
      } else {
        // Crear nueva alerta
        const newAlert = {
          id: 'alt_' + Date.now(),
          mensaje: mensaje.trim(),
          tipo,
          activa,
          critica,
          creadoEn: new Date().toISOString(),
          creadoPor: userEmail || 'admin@luxia.com'
        };
        updated = [newAlert, ...alerts];
        await setConfigGeneral('alertas_sistema', updated);
        setAlerts(updated);
        showAlert("Nueva alerta del sistema creada exitosamente", "success");
      }
      resetForm();
    } catch (err) {
      showAlert("Error al guardar la alerta del sistema: " + err.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (alert) => {
    setEditingId(alert.id);
    setMensaje(alert.mensaje);
    setTipo(alert.tipo);
    setActiva(alert.activa);
    setCritica(alert.critica);
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Eliminar Alerta de Sistema',
      message: '¿Estás seguro de que deseas eliminar permanentemente esta alerta de sistema? Esta acción no se puede deshacer.',
      confirmBtnClass: 'btn-danger',
      confirmText: 'Eliminar',
      onConfirm: async () => {
        try {
          const updated = alerts.filter(a => a.id !== id);
          await setConfigGeneral('alertas_sistema', updated);
          setAlerts(updated);
          showAlert("Alerta de sistema eliminada", "success");
        } catch (err) {
          showAlert("Error al eliminar alerta: " + err.message, "danger");
        } finally {
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleToggleActive = async (alert) => {
    try {
      const updated = alerts.map(a => a.id === alert.id ? { ...a, activa: !a.activa } : a);
      await setConfigGeneral('alertas_sistema', updated);
      setAlerts(updated);
      showAlert(`Alerta ${!alert.activa ? 'activada' : 'desactivada'}`, "success");
    } catch (err) {
      showAlert("Error al cambiar estado de la alerta: " + err.message, "danger");
    }
  };

  const handleToggleCritical = async (alert) => {
    try {
      const updated = alerts.map(a => a.id === alert.id ? { ...a, critica: !a.critica } : a);
      await setConfigGeneral('alertas_sistema', updated);
      setAlerts(updated);
      showAlert(`Criticidad ${!alert.critica ? 'habilitada' : 'deshabilitada'}`, "success");
    } catch (err) {
      showAlert("Error al cambiar criticidad: " + err.message, "danger");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setMensaje('');
    setTipo('info');
    setActiva(true);
    setCritica(false);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <SpinnerPremium size="md" text="Cargando alertas del sistema..." />
      </div>
    );
  }

  return (
    <div className="row g-4 animate__animated animate__fadeIn">
      {/* Formulario de Alerta */}
      <div className="col-lg-5">
        <div className="card border-0 bg-white shadow-sm rounded-4">
          <div className="card-body p-4">
            <h5 className="fw-bold text-dark mb-3">
              <i className="bi bi-pencil-square text-primary me-2"></i>
              {editingId ? 'Editar Alerta' : 'Nueva Alerta de Sistema'}
            </h5>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small fw-bold mb-1">Mensaje de la Alerta</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Ej: Mantenimiento programado hoy a las 23:00 COT. El sistema no estará disponible por 30 minutos."
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  disabled={saving}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold mb-1">Nivel de Criticidad / Estilo</label>
                <select
                  className="form-select"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  disabled={saving}
                >
                  <option value="info">Info (Celeste / Informativo)</option>
                  <option value="warning">Advertencia (Amarillo / Preventivo)</option>
                  <option value="danger">Peligro (Rojo / Crítico)</option>
                </select>
              </div>

              <div className="row g-2 mb-4">
                <div className="col-6">
                  <div className="form-check form-switch p-3 bg-light rounded-3 border">
                    <input
                      className="form-check-input ms-0 me-2 cursor-pointer"
                      type="checkbox"
                      id="alertActivaSwitch"
                      checked={activa}
                      onChange={(e) => setActiva(e.target.checked)}
                      disabled={saving}
                    />
                    <label className="form-check-label small fw-bold text-dark cursor-pointer" htmlFor="alertActivaSwitch">
                      Activa
                    </label>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-check form-switch p-3 bg-light rounded-3 border">
                    <input
                      className="form-check-input ms-0 me-2 cursor-pointer"
                      type="checkbox"
                      id="alertCriticaSwitch"
                      checked={critica}
                      onChange={(e) => setCritica(e.target.checked)}
                      disabled={saving}
                    />
                    <label className="form-check-label small fw-bold text-dark cursor-pointer" htmlFor="alertCriticaSwitch">
                      Banner Crítico
                    </label>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
                  disabled={saving}
                >
                  {saving && <span className="spinner-border spinner-border-sm" />}
                  <span>{editingId ? 'Actualizar Alerta' : 'Publicar Alerta'}</span>
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-pill px-3"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Lista de Alertas */}
      <div className="col-lg-7">
        <div className="card border-0 bg-white shadow-sm rounded-4 h-100">
          <div className="card-body p-4 d-flex flex-column">
            <h5 className="fw-bold text-dark mb-4">
              <i className="bi bi-list-stars text-secondary me-2"></i>Historial de Alertas
            </h5>
            <div className="overflow-auto flex-grow-1" style={{ maxHeight: '420px' }}>
              {alerts.length === 0 ? (
                <div className="text-center text-muted small py-5">No hay alertas de sistema configuradas.</div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-4 border d-flex justify-content-between align-items-start gap-3 transition-all ${
                        alert.activa
                          ? alert.tipo === 'danger'
                            ? 'bg-danger bg-opacity-10 border-danger border-opacity-25'
                            : alert.tipo === 'warning'
                            ? 'bg-warning bg-opacity-10 border-warning border-opacity-25'
                            : 'bg-info bg-opacity-10 border-info border-opacity-25'
                          : 'bg-light border-light text-muted'
                      }`}
                    >
                      <div className="text-start flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`badge rounded-pill fw-bold text-uppercase small ${
                            alert.tipo === 'danger' ? 'bg-danger text-white' : alert.tipo === 'warning' ? 'bg-warning text-dark' : 'bg-info text-white'
                          }`}>
                            {alert.tipo}
                          </span>
                          {alert.critica && (
                            <span className="badge rounded-pill bg-dark text-white fw-bold small animate-pulse">
                              <i className="bi bi-exclamation-triangle me-1"></i>Crítica
                            </span>
                          )}
                          <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                            {alert.creadoEn?.toDate ? alert.creadoEn.toDate().toLocaleString('es-ES') : ''}
                          </span>
                        </div>
                        <p className="mb-0 text-dark small" style={{ whiteSpace: 'pre-line' }}>{alert.mensaje}</p>
                      </div>

                      <div className="d-flex align-items-center gap-1">
                        <button
                          className={`btn btn-xs rounded-pill px-2.5 fw-bold ${alert.activa ? 'btn-success' : 'btn-outline-secondary'}`}
                          style={{ fontSize: '0.7rem' }}
                          onClick={() => handleToggleActive(alert)}
                          title="Habilitar/Deshabilitar Alerta"
                        >
                          {alert.activa ? 'Activa' : 'Inactiva'}
                        </button>
                        <button
                          className="btn btn-xs btn-outline-primary rounded-circle p-1 d-flex align-items-center justify-content-center"
                          style={{ width: '26px', height: '26px' }}
                          onClick={() => handleEdit(alert)}
                          title="Editar"
                        >
                          <i className="bi bi-pencil-fill" style={{ fontSize: '0.75rem' }}></i>
                        </button>
                        <button
                          className="btn btn-xs btn-outline-danger rounded-circle p-1 d-flex align-items-center justify-content-center"
                          style={{ width: '26px', height: '26px' }}
                          onClick={() => handleDelete(alert.id)}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash-fill" style={{ fontSize: '0.75rem' }}></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
