import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../ui/ToastProvider';
import { useUserRole } from '../../../../contexts/UserRoleContext';
import { DynamicFieldInput } from '../../DynamicFieldInput';

export function ContratoCrearModal({
  show,
  onClose,
  clienteId,
  clientePais,
  iaPausada,
  editingContrato,
  serviciosConfig,
  seccionesConfig,
  camposConfig,
  exchangeRates,
  negocios = []
}) {
  const { showAlert } = useToast();
  const { user } = useUserRole();
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessResult, setAccessResult] = useState(null);

  const [selectedNegocioId, setSelectedNegocioId] = useState('');
  const [nuevoNegocioNombre, setNuevoNegocioNombre] = useState('');
  const [tipoDocumentoLegal, setTipoDocumentoLegal] = useState('inicial');
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipoServicio: '',
    fechaInicio: '',
    fechaVencimiento: '',
    renovacionAutomatica: false,
    alertaRenovacion: 30,
    responsableRenovacion: user?.email || '',
    estadoRenovacion: 'Pendiente',
    notas: '',
    monto: '',
    moneda: 'USD',
    pais: clientePais || '',
    driveLink: '',
    origenVenta: 'Adquisición (Hunting)',
    esUnUpsell: false,
    volumenMensualProyectado: '',
    requiereIntegracion: false,
    modeloFacturacion: 'Recurrente',
    fechaCierre: '',
    dealId: '',
    frecuenciaFacturacion: 'mensual',
    condicionesPago: 'net_30',
    volumenMinimoGarantizado: '',
    periodoPreavisoDias: 30,
    penalizacionSLA: false
  });

  const [comercialEmail, setComercialEmail] = useState('');

  // Fetch client details
  useEffect(() => {
    if (!clienteId) return;
    const fetchClient = async () => {
      try {
        const { data } = await supabase.from('clientes').select('comercial_email').eq('id', clienteId).maybeSingle();
        if (data) {
          setComercialEmail(data.comercial_email || '');
        }
      } catch (err) {
        console.error("Error fetching client for contract modal:", err);
      }
    };
    fetchClient();
  }, [clienteId]);

  const [editAdjuntos, setEditAdjuntos] = useState([]);
  const [camposDinamicos, setCamposDinamicos] = useState({});

  useEffect(() => {
    const safeFormatDate = (val) => {
      if (!val) return '';
      if (typeof val.toDate === 'function') {
        try { return val.toDate().toISOString().split('T')[0]; } catch (e) { return ''; }
      }
      if (val instanceof Date) {
        try { return val.toISOString().split('T')[0]; } catch (e) { return ''; }
      }
      if (typeof val === 'string') {
        return val.split('T')[0];
      }
      return '';
    };

    if (editingContrato) {
      setEditAdjuntos(editingContrato.adjuntos || []);
      const newFormData = {
        nombre: editingContrato.nombre || '',
        tipoServicio: editingContrato.tipoServicio || '',
        fechaInicio: safeFormatDate(editingContrato.fechaInicio),
        fechaVencimiento: safeFormatDate(editingContrato.fechaVencimiento),
        renovacionAutomatica: editingContrato.renovacionAutomatica || false,
        alertaRenovacion: editingContrato.alertaRenovacion || 30,
        responsableRenovacion: editingContrato.responsableRenovacion || comercialEmail || user?.email || '',
        estadoRenovacion: editingContrato.estadoRenovacion || 'Pendiente',
        notas: editingContrato.notes || editingContrato.notas || '',
        monto: editingContrato.monto || '',
        moneda: editingContrato.moneda || 'USD',
        pais: editingContrato.pais || clientePais || '',
        driveLink: editingContrato.driveLink || '',
        origenVenta: editingContrato.origenVenta || 'Adquisición (Hunting)',
        esUnUpsell: editingContrato.esUnUpsell || false,
        volumenMensualProyectado: editingContrato.volumenMensualProyectado || '',
        requiereIntegracion: editingContrato.requiereIntegracion || false,
        modeloFacturacion: editingContrato.modeloFacturacion || 'Recurrente',
        fechaCierre: safeFormatDate(editingContrato.fechaCierre),
        dealId: editingContrato.dealId || '',
        frecuenciaFacturacion: editingContrato.frecuenciaFacturacion || 'mensual',
        condicionesPago: editingContrato.condicionesPago || 'net_30',
        volumenMinimoGarantizado: editingContrato.volumenMinimoGarantizado || '',
        periodoPreavisoDias: editingContrato.periodoPreavisoDias || 30,
        penalizacionSLA: editingContrato.penalizacionSLA === true
      };
      setFormData(newFormData);
      setCamposDinamicos(editingContrato.camposDinamicos || {});

      if (editingContrato.oportunidadId) {
        setSelectedNegocioId(editingContrato.oportunidadId);
      } else if (negocios.length > 0) {
        setSelectedNegocioId(negocios[0].id);
      } else {
        setSelectedNegocioId('_new');
      }

      setTipoDocumentoLegal(
        editingContrato.tipoDocumentoLegal ||
        (editingContrato.esAdenda ? 'adenda' : (editingContrato.versionContrato > 1 ? 'renovacion' : 'inicial'))
      );
      setNuevoNegocioNombre('');
    } else {
      setEditAdjuntos([]);
      setFormData({
        nombre: '',
        tipoServicio: serviciosConfig && serviciosConfig.length > 0 ? serviciosConfig[0].nombre : 'Distribución Regional',
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        renovacionAutomatica: false,
        alertaRenovacion: 30,
        responsableRenovacion: comercialEmail || user?.email || '',
        estadoRenovacion: 'Pendiente',
        notas: '',
        monto: '',
        moneda: 'USD',
        pais: clientePais || '',
        driveLink: '',
        origenVenta: 'Adquisición (Hunting)',
        esUnUpsell: false,
        volumenMensualProyectado: '',
        requiereIntegracion: false,
        modeloFacturacion: 'Recurrente',
        fechaCierre: '',
        dealId: '',
        frecuenciaFacturacion: 'mensual',
        condicionesPago: 'net_30',
        volumenMinimoGarantizado: '',
        periodoPreavisoDias: 30,
        penalizacionSLA: false
      });
      setCamposDinamicos({});

      if (negocios.length > 0) {
        setSelectedNegocioId(negocios[0].id);
      } else {
        setSelectedNegocioId('_new');
      }
      setTipoDocumentoLegal('inicial');
    }
    setSelectedFile(null);
  }, [editingContrato, clientePais, show, comercialEmail, negocios, user, serviciosConfig]);

  // Debounced Drive link test
  useEffect(() => {
    const link = formData.driveLink;
    if (!link || !link.trim().startsWith('http')) {
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
  }, [formData.driveLink]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let adjuntos = [];
      
      if (selectedFile) {
        adjuntos.push({
          nombre: selectedFile.name,
          url: URL.createObjectURL(selectedFile)
        });
      }

      const fechaVencimientoObj = formData.fechaVencimiento ? new Date(formData.fechaVencimiento).toISOString() : null;
      let estadoSLAInicial = 'Vigente';
      
      if (fechaVencimientoObj) {
        const ahora = new Date();
        const diffTime = new Date(fechaVencimientoObj).getTime() - ahora.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) estadoSLAInicial = 'Vencido (Rojo)';
        else if (diffDays <= 30) estadoSLAInicial = 'Próximo a Vencer (Naranja)';
      }

      const currency = formData.moneda || 'USD';
      const contratoMonto = parseFloat(formData.monto) || 0;

      // 1. Resolver Negocio Destino (Oportunidad)
      let targetBusinessId = selectedNegocioId;
      if (selectedNegocioId === '_new') {
        const nombreNegocio = (nuevoNegocioNombre || formData.nombre || 'Nueva Línea de Negocio').trim();
        const { data: newOp } = await supabase.from('oportunidades').insert({
          cliente_id: clienteId,
          nombre: nombreNegocio,
          etapa: 'ganado',
          monto_estimado_mensual: contratoMonto,
          probabilidad: 100,
          pais: formData.pais || clientePais || 'AR',
          tipo_pipeline: 'adquisicion',
          tipo_servicio: formData.tipoServicio || 'default',
          comercial_email: formData.responsableRenovacion || user?.email || 'admin@luxia.com'
        }).select().single();

        if (newOp) targetBusinessId = newOp.id;
      }

      const payload = {
        cliente_id: clienteId,
        oportunidad_id: targetBusinessId,
        nombre: formData.nombre || `Contrato: ${formData.tipoServicio}`,
        tipo_servicio: formData.tipoServicio,
        fecha_inicio: formData.fechaInicio ? new Date(formData.fechaInicio).toISOString() : new Date().toISOString(),
        fecha_vencimiento: fechaVencimientoObj,
        estado_sla: estadoSLAInicial,
        monto: contratoMonto,
        moneda: currency,
        drive_link: formData.driveLink || null,
        volumen_minimo_garantizado: parseFloat(formData.volumenMinimoGarantizado) || null,
        es_contrato_vigente: true,
        version_contrato: 1,
        estado_contrato: tipoDocumentoLegal === 'adenda' ? 'adenda' : 'vigente',
        adjuntos: [...editAdjuntos, ...adjuntos],
        campos_dinamicos: camposDinamicos,
        updated_at: new Date().toISOString()
      };

      if (editingContrato) {
        const { error } = await supabase.from('contratos').update(payload).eq('id', editingContrato.id);
        if (error) throw error;
        showAlert('Contrato actualizado correctamente', 'success');
      } else {
        const { error } = await supabase.from('contratos').insert(payload);
        if (error) throw error;
        showAlert('Contrato agregado correctamente al Negocio', 'success');
      }

      onClose();
    } catch (err) {
      console.error(err);
      showAlert(`Error al guardar contrato: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const seccionesContrato = seccionesConfig.filter(s => s.entidad === 'contrato').sort((a,b) => a.orden - b.orden);

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
    if (entidad === 'contrato') {
      const sId = campo.seccionId || 'huerfanos';
      if (!camposAgrupados[sId]) camposAgrupados[sId] = [];
      camposAgrupados[sId].push(campo);
    }
  });

  const renderCampo = (campo) => (
    <DynamicFieldInput 
      key={campo.id}
      campo={campo}
      value={camposDinamicos[campo.key]}
      onChange={(val) => setCamposDinamicos(prev => ({ ...prev, [campo.key]: val }))}
      clientId={clienteId}
    />
  );

  return (
    <div 
      className="modal fade show d-block" 
      tabIndex="-1" 
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1065 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          
          {/* MODAL HEADER */}
          <div className="modal-header bg-white border-bottom p-3 px-4 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 rounded-3 bg-primary bg-opacity-10 text-primary">
                <i className="bi bi-file-earmark-text fs-5"></i>
              </div>
              <div>
                <h6 className="modal-title fw-bold text-dark mb-0">
                  {editingContrato ? `✏️ Editando Contrato: ${editingContrato.nombre || editingContrato.tipoServicio || 'Sin Nombre'}` : '➕ Registrar Nuevo Contrato / Adenda'}
                </h6>
                <span className="small text-muted" style={{ fontSize: '0.78rem' }}>
                  {editingContrato ? 'Modifica los parámetros operativos o contractuales de la versión actual' : 'Asigna una línea de negocio regulada y configura los parámetros contractuales'}
                </span>
              </div>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={saving}
            ></button>
          </div>

          {/* MODAL BODY */}
          <div className="modal-body p-4 bg-light" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            <form id="contratoForm" onSubmit={handleSave} className="row g-3">
              {/* SECTOR 0: ESTRUCTURA ENTERPRISE (NEGOCIO ➔ CONTRATO) */}
              <div className="col-12 mb-2">
            <div className="p-3 rounded-4 bg-white border border-primary border-opacity-25 shadow-xs">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <label className="form-label small fw-bold mb-0 text-primary d-flex align-items-center">
                  <i className="bi bi-building-check me-2 fs-6"></i> Negocio / Línea de Servicio Regulada
                </label>
                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2 py-1" style={{ fontSize: '0.7rem' }}>
                  Jerarquía (Cliente ➔ Negocio ➔ Contratos)
                </span>
              </div>

              <div className="row g-2">
                <div className="col-md-7">
                  <label className="form-label extra-small text-muted mb-1" style={{ fontSize: '0.75rem' }}>Negocio Destino</label>
                  <select 
                    className="form-select form-select-sm fw-bold border-primary"
                    value={selectedNegocioId}
                    onChange={e => setSelectedNegocioId(e.target.value)}
                    disabled={!!editingContrato}
                  >
                    {negocios.map(n => (
                      <option key={n.id} value={n.id}>💼 {n.nombre || 'Negocio Corporativo'} ({n.pais || 'LatAm'})</option>
                    ))}
                    <option value="_new">➕ Crear Nuevo Negocio / Línea de Servicio...</option>
                  </select>
                </div>

                <div className="col-md-5">
                  <label className="form-label extra-small text-muted mb-1" style={{ fontSize: '0.75rem' }}>Tipo de Documento Legal</label>
                  <select
                    className="form-select form-select-sm fw-bold border-secondary"
                    value={tipoDocumentoLegal}
                    onChange={e => setTipoDocumentoLegal(e.target.value)}
                  >
                    <option value="inicial">📄 Contrato Inicial (v1 - Vigente)</option>
                    <option value="adenda">📎 Adenda / Anexo de Modificación</option>
                    <option value="renovacion">🔄 Renovación de Contrato (Reemplaza Vigente)</option>
                  </select>
                </div>

                {selectedNegocioId === '_new' && (
                  <div className="col-12 mt-2">
                    <label className="form-label small fw-bold mb-1 text-dark">Nombre de la Nueva Línea de Negocio</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm border-success fw-bold" 
                      placeholder="Ej. Distribución Express Lima o Fulfillment B2B Callao"
                      required={selectedNegocioId === '_new'}
                      value={nuevoNegocioNombre}
                      onChange={e => setNuevoNegocioNombre(e.target.value)}
                    />
                  </div>
                )}

                {selectedNegocioId !== '_new' && tipoDocumentoLegal === 'inicial' && (
                  <div className="col-12 mt-2">
                    <div className="alert alert-info py-2 px-3 mb-0 rounded-3 border-info border-opacity-25" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-info-circle-fill me-2 text-info"></i>
                      <strong>Gestión de Contratos:</strong> Si este contrato extiende o actualiza la operación de este negocio, selecciona <strong>Renovación</strong> (reemplazará al contrato anterior como vigente) o <strong>Adenda</strong>. Si es para un servicio totalmente distinto, selecciona <strong>➕ Crear Nuevo Negocio</strong>.
                    </div>
                  </div>
                )}

                {selectedNegocioId !== '_new' && tipoDocumentoLegal === 'renovacion' && (
                  <div className="col-12 mt-2">
                    <div className="alert alert-success py-2 px-3 mb-0 rounded-3 border-success border-opacity-25" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-arrow-repeat me-2 text-success"></i>
                      <strong>Reemplazo Automático de Contrato:</strong> Al guardar, este documento asumirá como el nuevo <strong>Contrato Regulador Vigente</strong> de esta línea de negocio y moverá la versión anterior al <strong>Historial de Versiones</strong>.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-12 mb-3">
            <label className="form-label small fw-bold mb-1">Nombre del Contrato</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Ej. MX - Eurocotton - M&P"
              required
              value={formData.nombre} 
              onChange={e => setFormData({...formData, nombre: e.target.value})}
            />
          </div>
          <div className="col-md-12">
            <label className="form-label small fw-bold mb-1">Servicio / Tipo</label>
            <select 
              className="form-select" 
              required 
              value={formData.tipoServicio} 
              onChange={e => setFormData({...formData, tipoServicio: e.target.value})}
            >
              <option value="">-- Selecciona un Servicio --</option>
              {(serviciosConfig.length > 0 ? serviciosConfig : [
                { id: 'saas_enterprise_core', nombre: 'SaaS Enterprise Core' },
                { id: 'servicios_profesionales', nombre: 'Servicios Profesionales / Consultoría' },
                { id: 'infraestructura_plataforma', nombre: 'Infraestructura & Plataforma Cloud' },
                { id: 'soporte_sla_premium', nombre: 'Soporte & SLA Premium 24/7' }
              ]).map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
              {formData.tipoServicio && !serviciosConfig.some(s => s.nombre === formData.tipoServicio) && (
                <option value={formData.tipoServicio}>{formData.tipoServicio} (Histórico)</option>
              )}
            </select>
          </div>
          
          <div className="col-md-6 mb-3">
            <label className="form-label small">Fecha Inicio</label>
            <input type="date" className="form-control form-control-sm" value={formData.fechaInicio} onChange={e => setFormData({...formData, fechaInicio: e.target.value})} />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label small">Fecha Vencimiento (Fin)</label>
            <input type="date" className="form-control form-control-sm" value={formData.fechaVencimiento} onChange={e => setFormData({...formData, fechaVencimiento: e.target.value})} />
          </div>

          <div className="col-12 mt-3 mb-2">
            <h6 className="fw-bold mb-3 text-dark border-bottom pb-2"><i className="bi bi-briefcase text-primary me-2"></i> Datos Comerciales (Core)</h6>
          </div>
          
          <div className="col-md-3 mb-3">
            <label className="form-label small">Origen Venta</label>
            <select className="form-select form-select-sm" value={formData.origenVenta} onChange={e => setFormData({...formData, origenVenta: e.target.value})}>
              <option value="Adquisición (Hunting)">Adquisición (Hunting)</option>
              <option value="Upsell / Expansión (Farming)">Upsell / Expansión (Farming)</option>
            </select>
          </div>
          <div className="col-md-3 mb-3">
            <label className="form-label small">Facturación</label>
            <select className="form-select form-select-sm" value={formData.modeloFacturacion} onChange={e => setFormData({...formData, modeloFacturacion: e.target.value})}>
              <option value="Recurrente">Recurrente</option>
              <option value="One-Time">One-Time (Única vez)</option>
            </select>
          </div>
          <div className="col-md-3 mb-3 d-flex align-items-end">
            <div className="form-check form-switch mb-1">
              <input className="form-check-input" type="checkbox" id="esUnUpsellCheck" checked={formData.esUnUpsell} onChange={e => setFormData({...formData, esUnUpsell: e.target.checked})} />
              <label className="form-check-label small" htmlFor="esUnUpsellCheck">Es Upsell</label>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <label className="form-label small">Superficie / Volumen Proyectado</label>
            <input type="number" className="form-control form-control-sm" placeholder="Ej. 1000 (Has / Lts)" value={formData.volumenMensualProyectado} onChange={e => setFormData({...formData, volumenMensualProyectado: e.target.value})} />
          </div>
          <div className="col-md-3 mb-3">
            <label className="form-label small">País de Operación</label>
            <select className="form-select form-select-sm" value={formData.pais} onChange={e => setFormData({...formData, pais: e.target.value})}>
              <option value="">🌐 Regional</option>
              <option value="AR">🇦🇷 Argentina (AR)</option>
              <option value="CL">🇨🇱 Chile (CL)</option>
              <option value="CO">🇨🇴 Colombia (CO)</option>
              <option value="PE">🇵🇪 Perú (PE)</option>
              <option value="MX">🇲🇽 México (MX)</option>
            </select>
          </div>
          <div className="col-md-3 mb-3">
            <label className="form-label small">Fecha de Cierre</label>
            <input type="date" className="form-control form-control-sm" value={formData.fechaCierre} onChange={e => setFormData({...formData, fechaCierre: e.target.value})} />
          </div>
          <div className="col-md-3 mb-3 d-flex align-items-end">
            <div className="form-check form-switch mb-1">
              <input className="form-check-input" type="checkbox" id="reqIntegracionCheck" checked={formData.requiereIntegracion} onChange={e => setFormData({...formData, requiereIntegracion: e.target.checked})} />
              <label className="form-check-label small" htmlFor="reqIntegracionCheck">Requiere Integración</label>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <label className="form-label small text-muted">Deal ID (Referencia)</label>
            <input type="text" className="form-control form-control-sm text-muted bg-light" value={formData.dealId} onChange={e => setFormData({...formData, dealId: e.target.value})} placeholder="Ej. 12345" />
          </div>

          <div className="col-12 mt-3 mb-2">
            <h6 className="fw-bold mb-3 text-dark border-bottom pb-2"><i className="bi bi-file-earmark-text text-primary me-2"></i> Condiciones Financieras y Cláusulas Legales</h6>
          </div>

          <div className="col-md-3 mb-3">
            <label className="form-label small fw-bold">Frecuencia Cobro</label>
            <select className="form-select form-select-sm" value={formData.frecuenciaFacturacion} onChange={e => setFormData({...formData, frecuenciaFacturacion: e.target.value})}>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
              <option value="prepagado">Prepagado</option>
            </select>
          </div>

          <div className="col-md-3 mb-3">
            <label className="form-label small fw-bold">Plazo de Pago (Condiciones)</label>
            <select className="form-select form-select-sm" value={formData.condicionesPago} onChange={e => setFormData({...formData, condicionesPago: e.target.value})}>
              <option value="contado">Contado / Inmediato</option>
              <option value="net_30">Net 30 días</option>
              <option value="net_60">Net 60 días</option>
              <option value="net_90">Net 90 días</option>
            </select>
          </div>

          <div className="col-md-3 mb-3">
            <label className="form-label small fw-bold">Mínimo Garantizado (Muestras)</label>
            <input type="number" className="form-control form-control-sm" placeholder="Ej. 500 envíos/mes" value={formData.volumenMinimoGarantizado} onChange={e => setFormData({...formData, volumenMinimoGarantizado: e.target.value})} />
          </div>

          <div className="col-md-3 mb-3">
            <label className="form-label small fw-bold">Días Preaviso Cancelación</label>
            <input type="number" className="form-control form-control-sm" value={formData.periodoPreavisoDias} onChange={e => setFormData({...formData, periodoPreavisoDias: e.target.value})} />
          </div>

          <div className="col-md-12 mb-3">
            <div className="form-check form-switch bg-light p-2.5 rounded-3 border">
              <input className="form-check-input ms-0 me-2" type="checkbox" id="penalizacionSlaCheck" checked={formData.penalizacionSLA} onChange={e => setFormData({...formData, penalizacionSLA: e.target.checked})} />
              <label className="form-check-label small fw-bold text-dark" htmlFor="penalizacionSlaCheck">
                Contempla Penalidades o Descuentos Legales por Incumplimiento de SLA Logístico
              </label>
            </div>
          </div>

          <div className="col-12 mt-3 mb-2">
            <h6 className="fw-bold mb-3 text-dark border-bottom pb-2"><i className="bi bi-arrow-repeat text-primary me-2"></i> Renovación y Alertas</h6>
          </div>
          
          <div className="col-md-6">
            <label className="form-label small fw-bold mb-1">Monto del Contrato</label>
            <input 
              type="number" 
              step="0.01" 
              className="form-control" 
              required 
              value={formData.monto} 
              onChange={e => setFormData({...formData, monto: e.target.value})} 
              placeholder="ej: 2500"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-bold mb-1">Moneda de Facturación</label>
            <select 
              className="form-select" 
              value={formData.moneda} 
              onChange={e => setFormData({...formData, moneda: e.target.value})}
            >
              <option value="USD">USD - Dólares Estadounidenses</option>
              {clientePais === 'PE' && <option value="PEN">PEN - Soles Peruanos</option>}
              {clientePais === 'CL' && (
                <>
                  <option value="CLP">CLP - Pesos Chilenos</option>
                  <option value="UF">UF - Unidades de Fomento</option>
                </>
              )}
              {clientePais === 'CO' && <option value="COP">COP - Pesos Colombianos</option>}
              {clientePais === 'AR' && <option value="ARS">ARS - Pesos Argentinos</option>}
              {clientePais === 'MX' && <option value="MXN">MXN - Pesos Mexicanos</option>}
              {!clientePais && (
                <>
                  <option value="PEN">PEN - Soles Peruanos</option>
                  <option value="CLP">CLP - Pesos Chilenos</option>
                  <option value="COP">COP - Pesos Colombianos</option>
                  <option value="ARS">ARS - Pesos Argentinos</option>
                  <option value="MXN">MXN - Pesos Mexicanos</option>
                </>
              )}
            </select>
          </div>
          
          <div className="col-md-6">
            <label className="form-label small fw-bold mb-1">Estado de Renovación</label>
            <select className="form-select" value={formData.estadoRenovacion} onChange={e => setFormData({...formData, estadoRenovacion: e.target.value})}>
              <option value="Pendiente">Pendiente</option>
              <option value="En Negociación">En Negociación</option>
              <option value="Renovado">Renovado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <div className="col-md-6 d-flex align-items-center">
            <div className="form-check mt-3">
              <input type="checkbox" className="form-check-input" id="renovacionAutCheck" checked={formData.renovacionAutomatica} onChange={e => setFormData({...formData, renovacionAutomatica: e.target.checked})} />
              <label className="form-check-label small fw-bold" htmlFor="renovacionAutCheck">Renovación Automática</label>
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-bold mb-1">Antelación de Alerta (Días)</label>
            <select className="form-select" value={formData.alertaRenovacion} onChange={e => setFormData({...formData, alertaRenovacion: e.target.value})}>
              <option value="30">30 Días antes</option>
              <option value="60">60 Días antes</option>
              <option value="90">90 Días antes</option>
            </select>
          </div>
          <div className="col-md-12">
            <label className="form-label small fw-bold mb-1">Notas de Gestión/Renovación</label>
            <textarea className="form-control" rows="2" value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} placeholder="Ej: Negociando condiciones del SLA para el nuevo período."></textarea>
          </div>
          
          <div className="col-md-12">
            {editingContrato && editAdjuntos.length > 0 && (
              <div className="mb-3 p-3 bg-light rounded border">
                <label className="form-label small fw-bold mb-2">Archivos Adjuntos Actuales</label>
                <div className="d-flex flex-wrap gap-2">
                  {editAdjuntos.map((adj, idx) => (
                    <div key={idx} className="badge bg-light text-dark border p-2 d-flex align-items-center">
                      <i className="bi bi-file-earmark-pdf text-danger me-2"></i>
                      <a href={adj.url} target="_blank" rel="noopener noreferrer" className="text-decoration-none text-dark me-3">
                        {adj.nombre}
                      </a>
                      <button 
                        type="button" 
                        className="btn-close" 
                        style={{fontSize: '0.60rem'}}
                        onClick={() => setEditAdjuntos(editAdjuntos.filter((_, i) => i !== idx))}
                        title="Eliminar archivo"
                      ></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <label className="form-label small fw-bold mb-1">
              {editingContrato ? 'Subir nuevo archivo (se añadirá a los actuales)' : 'Adjuntar Documento (Opcional)'}
            </label>
            <input 
              type="file" 
              className="form-control mb-3" 
              onChange={e => setSelectedFile(e.target.files[0])}
              accept=".pdf,.doc,.docx,.jpg,.png" 
            />
            <div className="form-text small text-muted mb-3">Formatos soportados: PDF, Word, Imágenes. Máximo 10MB.</div>

            <label className="form-label small fw-bold mb-1">Enlace a Google Drive / Carpeta Compartida (Opcional)</label>
            <div className="input-group mb-1">
              <span className="input-group-text bg-light text-primary border-end-0"><i className="bi bi-google"></i></span>
              <input 
                type="url" 
                className="form-control border-start-0" 
                placeholder="https://drive.google.com/..." 
                value={formData.driveLink} 
                onChange={e => setFormData({...formData, driveLink: e.target.value})} 
              />
            </div>
            <div className="form-text small text-muted">Ingresa el enlace a la carpeta o archivo en Google Drive.</div>

            {checkingAccess && (
               <div className="mt-2 text-start">
                 <div className="text-muted small d-flex align-items-center gap-2 animate-pulse" style={{ fontSize: '0.72rem' }}>
                   <span className="spinner-border spinner-border-sm" role="status" style={{ width: '12px', height: '12px' }}></span>
                   Verificando permisos y accesibilidad del enlace en segundo plano...
                 </div>
               </div>
             )}

             {accessResult && !checkingAccess && (
               <div className="mt-2 text-start animate-fade-in">
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

          {seccionesContrato.length > 0 || (camposAgrupados['huerfanos'] && camposAgrupados['huerfanos'].length > 0) ? (
            <div className="col-12 mt-2 pt-3 border-top">
              {seccionesContrato.map(seccion => {
                const camposSeccion = (camposAgrupados[seccion.id] || []).sort((a,b) => a.orden - b.orden);
                if (camposSeccion.length === 0) return null;

                return (
                  <div key={seccion.id} className="mb-4">
                    <h6 className="fw-bold mb-3 text-dark"><i className={`bi ${seccion.icono || 'bi-grid'} text-primary me-2`}></i> {seccion.nombre}</h6>
                    <div className="row g-3">
                      {camposSeccion.map(renderCampo)}
                    </div>
                  </div>
                );
              })}

              {(camposAgrupados['huerfanos'] || []).length > 0 && (
                <div className="mb-4">
                  <h6 className="fw-bold mb-3 text-dark"><i className="bi bi-tags-fill text-primary me-2"></i> Información Adicional del Contrato</h6>
                  <div className="row g-3">
                    {(camposAgrupados['huerfanos'] || []).sort((a,b) => a.orden - b.orden).map(renderCampo)}
                  </div>
                </div>
              )}
            </div>
          ) : null}

            </form>
          </div>

          {/* MODAL FOOTER */}
          <div className="modal-footer bg-white border-top p-3 d-flex justify-content-end gap-2">
            <button 
              type="button" 
              className="btn btn-outline-secondary rounded-pill px-4 fw-bold" 
              onClick={onClose} 
              disabled={saving}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              form="contratoForm"
              className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" 
              disabled={saving}
            >
              {saving ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Guardando y Subiendo...</>
              ) : (
                editingContrato ? 'Actualizar Contrato' : 'Guardar y Registrar Contrato'
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
