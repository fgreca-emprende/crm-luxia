import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';
import { cacheManager } from '../../../lib/api';
import { ConfirmModal } from './ConfirmModal';

const DEFAULT_SERVICES = [
  { id: 'herbicidas', nombre: 'Herbicidas', descripcion: 'Control superior de malezas, alta persistencia y formulaciones fitosanitarias de última generación.' },
  { id: 'fungicidas', nombre: 'Fungicidas', descripcion: 'Prevención y control integral de enfermedades en cultivos desde la siembra hasta la cosecha.' },
  { id: 'insecticidas', nombre: 'Insecticidas', descripcion: 'Protección frente a plagas agrícolas con foco en sustentabilidad y alta eficacia en campo.' },
  { id: 'tratamiento_semillas', nombre: 'Tratamiento de Semillas', descripcion: 'Tecnología para protección radicular, estimulación de germinación y sanidad de plántulas.' },
];

export function ServicesConfigPanel() {
  const [servicios, setServicios] = useState([]);
  const [serviciosLoading, setServiciosLoading] = useState(false);
  const [serviciosFormData, setServiciosFormData] = useState({ id: '', nombre: '', descripcion: '' });

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

  const loadServicios = useCallback(async () => {
    setServiciosLoading(true);
    try {
      const { data, error } = await supabase.from('config_servicios').select('*');
      if (error) throw error;
      
      if (data && data.length > 0) {
        setServicios(data);
      } else {
        // Sembrar por defecto
        for (const s of DEFAULT_SERVICES) {
          await supabase.from('config_servicios').upsert(s);
        }
        setServicios(DEFAULT_SERVICES);
      }
    } catch (err) {
      showAlert(`Error cargando servicios: ${err.message}`, 'danger');
    } finally {
      setServiciosLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadServicios();
  }, [loadServicios]);

  const handleSaveServicio = async (e) => {
    e.preventDefault();
    const idTrimmed = serviciosFormData.id.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]+$/.test(idTrimmed)) {
      showAlert('El ID solo puede contener letras, números y guiones bajos.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: idTrimmed,
        nombre: serviciosFormData.nombre.trim(),
        descripcion: serviciosFormData.descripcion.trim()
      };
      const { error } = await supabase.from('config_servicios').upsert(payload);
      if (error) throw error;

      await logSystemEvent(null, 'system_config_change', {
        tipoConfig: 'servicio_contrato',
        id: idTrimmed,
        nombre: serviciosFormData.nombre.trim()
      });

      cacheManager.data.delete('config_servicios');
      showAlert('Servicio de contrato guardado correctamente', 'success');
      setServiciosFormData({ id: '', nombre: '', descripcion: '' });
      loadServicios();
    } catch (err) {
      showAlert(`Error al guardar servicio: ${err.message}`, 'danger');
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
          const { error } = await supabase.from('config_servicios').delete().eq('id', id);
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

  const handleBootstrapServicios = () => {
    setConfirmModal({
      show: true,
      title: 'Poblar Catálogo de Servicios',
      message: '¿Deseas poblar la base de datos con los 4 servicios de contratos logísticos por defecto de Luxia?',
      confirmBtnClass: 'btn-primary',
      confirmText: 'Poblar Servicios',
      onConfirm: async () => {
        setSaving(true);
        try {
          for (const service of DEFAULT_SERVICES) {
            await supabase.from('config_servicios').upsert(service);
          }
          cacheManager.data.delete('config_servicios');
          showAlert('Catálogo de servicios poblado exitosamente', 'success');
          loadServicios();
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
            <h6 className="fw-bold mb-0 text-dark"><i className="bi bi-plus-circle-fill me-2 text-primary"></i>Nueva Línea / Producto</h6>
            <button className="btn btn-xs btn-outline-primary rounded-pill small fw-bold px-2 py-0.5" style={{ fontSize: '0.70rem' }} onClick={handleBootstrapServicios}>
              🚀 Cargar Predeterminados
            </button>
          </div>
          <p className="small text-muted mb-4">Administra el catálogo oficial de familias fitosanitarias y productos de Luxia Agro disponibles para oportunidades y acuerdos comerciales.</p>
          
          <form onSubmit={handleSaveServicio}>
            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">ID del Producto (Slug único)</label>
              <input type="text" className="form-control" placeholder="ej: bioestimulantes" required value={serviciosFormData.id} onChange={e => setServiciosFormData({...serviciosFormData, id: e.target.value})} />
              <div className="form-text" style={{fontSize: '0.75rem'}}>Solo minúsculas y guiones bajos (ej: coadyuvantes_agricolas).</div>
            </div>
            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Nombre Comercial de la Línea / Producto</label>
              <input type="text" className="form-control" placeholder="ej: Bioestimulantes & Nutrición Vegetal" required value={serviciosFormData.nombre} onChange={e => setServiciosFormData({...serviciosFormData, nombre: e.target.value})} />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-bold mb-1">Descripción Técnica / Comercial</label>
              <textarea className="form-control" rows="3" placeholder="ej: Formulación de última generación para vigor radicular, resistencia a estrés hídrico y mayor rendimiento..." required value={serviciosFormData.descripcion} onChange={e => setServiciosFormData({...serviciosFormData, descripcion: e.target.value})}></textarea>
            </div>
            <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear Producto'}
            </button>
          </form>
        </div>
      </div>

      <div className="col-lg-7">
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4">
            <h6 className="fw-bold mb-0 text-dark">Líneas Fitosanitarias y Productos Disponibles</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="px-4 text-muted small fw-bold border-0">LÍNEA / PRODUCTO</th>
                    <th className="text-muted small fw-bold border-0">KEY ID</th>
                    <th className="text-muted small fw-bold border-0">DESCRIPCIÓN</th>
                    <th className="text-end px-4 text-muted small fw-bold border-0">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosLoading && servicios.length === 0 ? (
                    <tr><td colSpan="4" className="text-center text-muted py-4">Cargando catálogo...</td></tr>
                  ) : (
                    servicios.map(s => (
                      <tr key={s.id}>
                        <td className="px-4 fw-bold text-dark">{s.nombre}</td>
                        <td><code className="bg-light px-2 py-1 rounded text-primary">{s.id}</code></td>
                        <td className="small text-muted text-truncate" style={{ maxWidth: '220px' }} title={s.descripcion}>{s.descripcion}</td>
                        <td className="text-end px-4">
                          <button className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={() => handleDeleteItem('config_servicios', s.id, 'config_servicios', loadServicios)}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                  {!serviciosLoading && servicios.length === 0 && (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">
                        No hay productos configurados aún.<br />
                        <button className="btn btn-sm btn-link mt-2 fw-bold text-primary" onClick={handleBootstrapServicios}>Poblar con catálogo oficial de Luxia Agro</button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
