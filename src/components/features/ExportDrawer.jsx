import { useState, useEffect, useMemo } from 'react';
import { supabase, callBackendApi } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';

const NATIVE_FIELDS = {
  leads: [
    { key: "id", nombre: "ID" },
    { key: "nombre_empresa", nombre: "Empresa" },
    { key: "nombre_contacto", nombre: "Contacto" },
    { key: "correo", nombre: "Correo Electrónico" },
    { key: "telefono", nombre: "Teléfono" },
    { key: "pais", nombre: "País" },
    { key: "estado", nombre: "Estado" },
    { key: "volumen_mensual_proyectado", nombre: "Volumen Estimado" },
    { key: "asignado_a", nombre: "Asignado A" },
    { key: "created_at", nombre: "Fecha Creación" }
  ],
  oportunidades: [
    { key: "id", nombre: "ID" },
    { key: "nombre", nombre: "Nombre Oportunidad" },
    { key: "cliente_id", nombre: "ID Cliente" },
    { key: "comercial_email", nombre: "Comercial Asignado" },
    { key: "monto_estimado_mensual", nombre: "Monto Mensual" },
    { key: "pais", nombre: "País" },
    { key: "etapa", nombre: "Etapa" },
    { key: "tipo_servicio", nombre: "Línea / Servicio" },
    { key: "created_at", nombre: "Fecha Creación" }
  ],
  clientes: [
    { key: "id", nombre: "ID" },
    { key: "nombre_empresa", nombre: "Nombre Empresa / Razón Social" },
    { key: "cuit_rut_rfc", nombre: "CUIT / RUT / RFC" },
    { key: "pais", nombre: "País" },
    { key: "estado", nombre: "Estado" },
    { key: "comercial_email", nombre: "Asesor Técnico / Comercial" },
    { key: "created_at", nombre: "Fecha Creación" }
  ]
};

export function ExportDrawer({ show, onClose, defaultEntity = 'leads' }) {
  const { hasPermission } = useUserRole();
  const [entity, setEntity] = useState(defaultEntity);

  const canExportLeads = hasPermission('entities', 'leads_exportar');
  const canExportOps = hasPermission('entities', 'oportunidades_exportar');
  const canExportClients = hasPermission('entities', 'clientes_exportar');

  useEffect(() => {
    if (!show) return;
    if (entity === 'leads' && !canExportLeads) {
      if (canExportOps) setEntity('oportunidades');
      else if (canExportClients) setEntity('clientes');
    } else if (entity === 'oportunidades' && !canExportOps) {
      if (canExportLeads) setEntity('leads');
      else if (canExportClients) setEntity('clientes');
    } else if (entity === 'clientes' && !canExportClients) {
      if (canExportOps) setEntity('oportunidades');
      else if (canExportLeads) setEntity('leads');
    }
  }, [show, canExportLeads, canExportOps, canExportClients, entity]);

  const [datePreset, setDatePreset] = useState('mes');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState('csv');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  const { showAlert } = useToast();

  useEffect(() => {
    if (!show) return;
    const nativeList = NATIVE_FIELDS[entity] || [];
    setAvailableFields(nativeList);
    setSelectedFields(nativeList.map(f => f.key));
  }, [show, entity]);

  useEffect(() => {
    if (!show) {
      setSuccessData(null);
    }
  }, [show]);

  if (!show) return null;

  const handleCopyLink = async () => {
    if (!successData?.downloadUrl) return;
    try {
      await navigator.clipboard.writeText(successData.downloadUrl);
      setCopied(true);
      showAlert('Enlace de descarga copiado al portapapeles.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showAlert('No se pudo copiar el enlace.', 'danger');
    }
  };

  const handleExport = async (e) => {
    e.preventDefault();
    if (selectedFields.length === 0) {
      showAlert('Por favor, selecciona al menos una columna para incluir en el reporte.', 'danger');
      return;
    }

    setSuccessData(null);
    setLoading(true);
    setProgress(20);

    try {
      // [P1-6 FIX] Llamar al endpoint backend protegido con auditoría inmutable
      let rows = [];
      try {
        const response = await callBackendApi('/exportar-datos', {
          entidad: entity,
          filtros: {
            datePreset,
            startDate: datePreset === 'custom' ? startDate : undefined,
            endDate: datePreset === 'custom' ? endDate : undefined
          }
        });
        rows = response.data || [];
      } catch (backendErr) {
        console.warn('[ExportDrawer] Fallback a query directa:', backendErr.message);
        const { data, error } = await supabase.from(entity).select('*');
        if (error) throw error;
        rows = data || [];
      }

      setProgress(75);

      // Generar CSV en memoria con columnas seleccionadas
      const headers = selectedFields.map(key => {
        const field = availableFields.find(f => f.key === key);
        return field ? `"${field.nombre}"` : `"${key}"`;
      }).join(',');

      const csvRows = rows.map(r => {
        return selectedFields.map(key => {
          const val = r[key] !== undefined && r[key] !== null ? String(r[key]).replace(/"/g, '""') : '';
          return `"${val}"`;
        }).join(',');
      });

      const csvContent = '\uFEFF' + [headers, ...csvRows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);

      setSuccessData({ downloadUrl, rowCount: rows.length, isAlert: false });
      setProgress(100);

      // Trigger automatic download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${entity}_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAlert(`Exportación completada con éxito. Se descargaron ${rows.length} registros auditados.`, 'success');
    } catch (err) {
      console.error('Error al exportar los datos:', err);
      showAlert(err.message || 'No se pudo generar la exportación de datos.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div 
        className="export-drawer-overlay position-fixed top-0 start-0 w-100 h-100"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1100,
          transition: 'opacity 0.3s ease'
        }}
        onClick={() => { setSuccessData(null); onClose(); }}
      >
        <div 
          className="export-drawer glass-panel position-absolute top-0 end-0 h-100 bg-white"
          style={{
            width: '100%',
            maxWidth: '460px',
            boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden',
            transition: 'transform 0.3s ease-out',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="p-3 px-4 border-bottom d-flex justify-content-between align-items-center bg-white">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 rounded-3 bg-success bg-opacity-10 text-success">
                <i className="bi bi-check-lg fs-5"></i>
              </div>
              <div>
                <h6 className="fw-bold mb-0 text-dark">¡Exportación Exitosa!</h6>
                <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Tu reporte está listo para descargar</span>
              </div>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => { setSuccessData(null); onClose(); }} 
              aria-label="Close"
            ></button>
          </div>

          {/* Contenido */}
          <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center p-4 text-center">
            <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center mb-4" style={{ width: '80px', height: '80px' }}>
              <i className="bi bi-file-earmark-arrow-down-fill text-success fs-1"></i>
            </div>
            <h5 className="fw-bold text-dark mb-2">Archivo Generado</h5>
            <p className="text-muted small px-3 mb-4">
              Se han extraído con éxito <strong className="text-dark">{successData.rowCount} registros</strong> de la sección de <strong className="text-dark" style={{ textTransform: 'capitalize' }}>{entity === 'oportunidades' ? 'pipeline' : entity}</strong>.
            </p>

            {successData.isAlert && (
              <div className="alert alert-warning border border-warning border-opacity-25 rounded-4 p-3 mb-4 text-start small d-flex gap-2">
                <i className="bi bi-shield-fill-exclamation fs-4 text-warning"></i>
                <div>
                  <strong className="d-block mb-0.5">Alerta de Seguridad</strong>
                  Se superó el umbral de registros configurado para exfiltración de datos. La descarga ha sido registrada en la auditoría de seguridad.
                </div>
              </div>
            )}

            <div className="d-flex flex-column gap-2 w-100 px-4">
              <a
                href={successData.downloadUrl}
                download={`${entity}_export.${format === 'excel' ? 'xlsx' : 'csv'}`}
                className="btn btn-success text-white rounded-pill py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
              >
                <i className="bi bi-download"></i>
                Descargar Archivo
              </a>
              <button
                type="button"
                className="btn btn-outline-primary rounded-pill py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
                onClick={handleCopyLink}
              >
                <i className={`bi ${copied ? 'bi-check-lg text-success' : 'bi-link-45deg'}`}></i>
                {copied ? '¡Copiado!' : 'Copiar Enlace'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary rounded-pill py-2 fw-bold"
                onClick={() => { setSuccessData(null); onClose(); }}
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="export-drawer-overlay position-fixed top-0 start-0 w-100 h-100"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1100,
        transition: 'opacity 0.3s ease'
      }}
      onClick={onClose}
    >
      <div 
        className="export-drawer glass-panel position-absolute top-0 end-0 h-100 bg-white"
        style={{
          width: '100%',
          maxWidth: '460px',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          transition: 'transform 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-3 px-4 border-bottom d-flex justify-content-between align-items-center bg-white">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
              <i className="bi bi-download fs-5"></i>
            </div>
            <div>
              <h6 className="fw-bold mb-0 text-dark">Exportar Datos Comerciales</h6>
              <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Configura los filtros de extracción</span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close" 
            onClick={onClose} 
            aria-label="Close"
            disabled={loading}
          ></button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleExport} className="flex-grow-1 d-flex flex-column justify-content-between p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          <div className="d-flex flex-column gap-4">
            
            {/* Selector de Entidad */}
            <div>
              <label className="form-label fw-bold text-dark small mb-2">1. Selecciona la Información a Exportar</label>
              <div className="d-flex flex-column gap-2">
                {canExportLeads && (
                  <button
                    type="button"
                    className={`btn text-start p-3 rounded-4 border d-flex align-items-center justify-content-between transition ${entity === 'leads' ? 'border-primary bg-primary bg-opacity-10 text-primary' : 'border-secondary border-opacity-10 bg-light text-muted'}`}
                    onClick={() => setEntity('leads')}
                    disabled={loading}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <i className="bi bi-person-plus-fill fs-4"></i>
                      <div>
                        <span className="fw-bold d-block text-dark small">Prospectos (Leads)</span>
                        <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Información de la bandeja de prospección.</span>
                      </div>
                    </div>
                    {entity === 'leads' && <i className="bi bi-check-circle-fill text-primary"></i>}
                  </button>
                )}

                {canExportOps && (
                  <button
                    type="button"
                    className={`btn text-start p-3 rounded-4 border d-flex align-items-center justify-content-between transition ${entity === 'oportunidades' ? 'border-primary bg-primary bg-opacity-10 text-primary' : 'border-secondary border-opacity-10 bg-light text-muted'}`}
                    onClick={() => setEntity('oportunidades')}
                    disabled={loading}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <i className="bi bi-bar-chart-steps fs-4"></i>
                      <div>
                        <span className="fw-bold d-block text-dark small">Pipeline de Ventas</span>
                        <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Tablero Kanban y estados comerciales de negocios.</span>
                      </div>
                    </div>
                    {entity === 'oportunidades' && <i className="bi bi-check-circle-fill text-primary"></i>}
                  </button>
                )}

                {canExportClients && (
                  <button
                    type="button"
                    className={`btn text-start p-3 rounded-4 border d-flex align-items-center justify-content-between transition ${entity === 'clientes' ? 'border-primary bg-primary bg-opacity-10 text-primary' : 'border-secondary border-opacity-10 bg-light text-muted'}`}
                    onClick={() => setEntity('clientes')}
                    disabled={loading}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <i className="bi bi-briefcase-fill fs-4"></i>
                      <div>
                        <span className="fw-bold d-block text-dark small">Gestión de Clientes</span>
                        <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Clientes en cartera activa y KPIs asociados.</span>
                      </div>
                    </div>
                    {entity === 'clientes' && <i className="bi bi-check-circle-fill text-primary"></i>}
                  </button>
                )}

              </div>
            </div>

            {/* Selector de Rango de Fecha */}
            <div>
              <label className="form-label fw-bold text-dark small mb-2">2. Filtro Temporal</label>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {['hoy', 'semana', 'mes', 'trimestre', 'personalizado'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`btn rounded-pill btn-xs py-1.5 px-3 border transition ${datePreset === preset ? 'bg-primary border-primary text-white shadow-xs' : 'bg-white text-muted border-secondary border-opacity-20'}`}
                    style={{ fontSize: '0.72rem', fontWeight: '700' }}
                    onClick={() => setDatePreset(preset)}
                    disabled={loading}
                  >
                    {preset === 'trimestre' ? '90 días' : preset === 'semana' ? '7 días' : preset === 'mes' ? '30 días' : preset === 'hoy' ? 'Hoy' : 'Personalizado'}
                  </button>
                ))}
              </div>

              {datePreset === 'personalizado' && (
                <div className="border p-3 rounded-4 bg-light d-flex flex-column gap-2">
                  <div>
                    <label className="form-label text-muted small fw-bold mb-1">Fecha Inicio</label>
                    <input
                      type="date"
                      className="form-control form-control-sm rounded-3"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="form-label text-muted small fw-bold mb-1">Fecha Fin</label>
                    <input
                      type="date"
                      className="form-control form-control-sm rounded-3"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Selector de Formato */}
            <div>
              <label className="form-label fw-bold text-dark small mb-2">3. Formato de Archivo</label>
              <div className="d-flex gap-3">
                <label className="flex-fill cursor-pointer">
                  <input
                    type="radio"
                    name="formatRadio"
                    value="excel"
                    checked={format === 'excel'}
                    onChange={() => setFormat('excel')}
                    className="d-none"
                    disabled={loading}
                  />
                  <div className={`text-center p-3 rounded-4 border transition ${format === 'excel' ? 'border-primary bg-primary bg-opacity-10 text-primary' : 'border-secondary border-opacity-10 bg-white text-muted'}`}>
                    <i className="bi bi-file-earmark-excel-fill fs-3 mb-1 d-block"></i>
                    <span className="fw-bold small d-block">Microsoft Excel</span>
                    <span className="small text-muted" style={{ fontSize: '0.68rem' }}>Formato .xlsx nativo</span>
                  </div>
                </label>

                <label className="flex-fill cursor-pointer">
                  <input
                    type="radio"
                    name="formatRadio"
                    value="csv"
                    checked={format === 'csv'}
                    onChange={() => setFormat('csv')}
                    className="d-none"
                    disabled={loading}
                  />
                  <div className={`text-center p-3 rounded-4 border transition ${format === 'csv' ? 'border-primary bg-primary bg-opacity-10 text-primary' : 'border-secondary border-opacity-10 bg-white text-muted'}`}>
                    <i className="bi bi-filetype-csv fs-3 mb-1 d-block"></i>
                    <span className="fw-bold small d-block">CSV Separado por comas</span>
                    <span className="small text-muted" style={{ fontSize: '0.68rem' }}>Codificación UTF-8 + BOM</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Selección Avanzada de Columnas / Conceptos */}
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label fw-bold text-dark small mb-0">4. Selección de Columnas (Conceptos)</label>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-link p-0 text-primary small fw-bold text-decoration-none"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => setSelectedFields(availableFields.map(f => f.key))}
                    disabled={loading}
                  >
                    Seleccionar Todos
                  </button>
                  <span className="text-muted" style={{ fontSize: '0.72rem' }}>|</span>
                  <button
                    type="button"
                    className="btn btn-link p-0 text-danger small fw-bold text-decoration-none"
                    style={{ fontSize: '0.72rem' }}
                    onClick={() => setSelectedFields([])}
                    disabled={loading}
                  >
                    Limpiar Selección
                  </button>
                </div>
              </div>

              {fieldsLoading ? (
                <div className="text-center py-4 border rounded-4 bg-light text-muted small">
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Cargando estructura de columnas...
                </div>
              ) : (
                <div className="border rounded-4 p-3 bg-light" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <div className="row g-2">
                    {availableFields.map((field) => {
                      const isChecked = selectedFields.includes(field.key);
                      return (
                        <div className="col-6" key={field.key}>
                          <label className="d-flex align-items-start gap-2 cursor-pointer p-2 rounded-3 bg-white border shadow-xs hover-shadow transition-all w-100 h-100 mb-0">
                            <input
                              type="checkbox"
                              className="form-check-input mt-1"
                              style={{ cursor: 'pointer' }}
                              checked={isChecked}
                              disabled={loading}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFields([...selectedFields, field.key]);
                                } else {
                                  setSelectedFields(selectedFields.filter(k => k !== field.key));
                                }
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <span className="fw-bold text-dark d-block text-truncate" style={{ fontSize: '0.72rem', letterSpacing: '-0.1px' }} title={field.nombre}>
                                {field.nombre}
                              </span>
                              <span className={`badge ${field.isDynamic ? 'bg-info bg-opacity-10 text-info border border-info border-opacity-25' : 'bg-secondary bg-opacity-10 text-muted border border-secondary border-opacity-10'} px-1.5 py-0.5`} style={{ fontSize: '0.58rem', fontWeight: '800' }}>
                                {field.isDynamic ? 'Dinámico' : 'Nativo'}
                              </span>
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="form-text text-muted small mt-1.5">
                <i className="bi bi-info-circle me-1"></i> Se incluirán únicamente las <strong>{selectedFields.length} columnas</strong> marcadas en el archivo resultante.
              </div>
            </div>

          </div>

          {/* Botones y carga */}
          <div className="border-top pt-4 mt-4 d-flex flex-column gap-3">
            {loading && (
              <div className="w-100">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small text-muted fw-bold">Generando archivo de exportación...</span>
                  <span className="small text-primary fw-bold">{progress}%</span>
                </div>
                <div className="progress rounded-pill shadow-sm" style={{ height: '8px' }}>
                  <div 
                    className="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
                    role="progressbar" 
                    style={{ width: `${progress}%` }}
                    aria-valuenow={progress} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>
            )}
            
            <div className="d-flex gap-2 justify-content-end">
              <button
                type="button"
                className="btn btn-outline-secondary rounded-pill px-4 fw-bold"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary rounded-pill px-4 text-white fw-bold d-flex align-items-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    Exportando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-download"></i>
                    Exportar
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        .cursor-pointer {
          cursor: pointer;
        }
        .transition {
          transition: all 0.25s ease-in-out;
        }
      `}</style>
    </div>
  );
}
