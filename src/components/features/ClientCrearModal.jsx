import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { DynamicFieldInput } from './DynamicFieldInput';
import { SpinnerPremium } from '../ui/SpinnerPremium';

export function ClientCrearModal({ show, onClose, onCreated }) {
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [pais, setPais] = useState('');
  const [cuit_rut_rfc, setCuitRutRfc] = useState('');
  const [industria, setIndustria] = useState('');
  const [sitioWeb, setSitioWeb] = useState('');
  const [tamanioEmpresa, setTamanioEmpresa] = useState('');
  const [parentCompanyId, setParentCompanyId] = useState('');
  const [estado, setEstado] = useState('Onboarding');
  const [faseComercial, setFaseComercial] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const { showAlert } = useToast();

  const [camposConfig, setCamposConfig] = useState([]);
  const [seccionesConfig, setSeccionesConfig] = useState([]);
  const [camposDinamicos, setCamposDinamicos] = useState({});

  useEffect(() => {
    if (!show) return;
    
    const loadConfig = async () => {
      try {
        const [camposRes, seccionesRes] = await Promise.all([
          supabase.from('config_campos').select('*').order('orden'),
          supabase.from('config_secciones').select('*').order('orden')
        ]);
        if (camposRes.data) setCamposConfig(camposRes.data);
        if (seccionesRes.data) setSeccionesConfig(seccionesRes.data);
      } catch (err) {
        console.error("Error loading config for ClientCrearModal:", err);
      }
    };
    loadConfig();
  }, [show]);

  if (!show) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nombreEmpresa.trim()) {
      showAlert('El nombre de la empresa es obligatorio', 'warning');
      return;
    }
    if (!pais) {
      showAlert('Debes seleccionar un país de operación', 'warning');
      return;
    }

    setSaving(true);
    try {
      const customId = `cli_${Date.now()}`;
      
      let finalFechaIngreso = new Date();
      if (faseComercial === 'Retención') {
        finalFechaIngreso.setFullYear(finalFechaIngreso.getFullYear() - 2);
      }

      const { data: { user } } = await supabase.auth.getUser();
      let finalComercialEmail = user?.email || 'admin@luxia.com';
      let finalFaseManual = faseComercial || null;

      const newClientData = {
        id: customId,
        nombre_empresa: nombreEmpresa.trim(),
        pais,
        cuit_rut_rfc: cuit_rut_rfc.trim() || null,
        industria: industria || null,
        sitio_web: sitioWeb.trim() || null,
        tamanio_empresa: tamanioEmpresa || null,
        parent_company_id: parentCompanyId.trim() || null,
        estado,
        observaciones: observaciones.trim(),
        fase_manual: finalFaseManual,
        comercial_email: finalComercialEmail,
        campos_dinamicos: camposDinamicos,
        fecha_ingreso: finalFechaIngreso.toISOString(),
        ultimo_cambio_estado: new Date().toISOString()
      };

      const { error: insertError } = await supabase.from('clientes').insert(newClientData);
      if (insertError) throw insertError;

      // Registrar en Bitácora / Interacciones
      await supabase.from('interacciones').insert({
        cliente_id: customId,
        tipo: 'creacion_manual',
        descripcion: `Cliente creado manualmente en plataforma. Estado inicial: "${estado}".`,
        autor: finalComercialEmail
      });

      showAlert('Cliente registrado con éxito', 'success');
      
      // Limpiar Formulario
      setNombreEmpresa('');
      setPais('');
      setCuitRutRfc('');
      setIndustria('');
      setSitioWeb('');
      setTamanioEmpresa('');
      setParentCompanyId('');
      setEstado('Onboarding');
      setFaseComercial('');
      setObservaciones('');
      setCamposDinamicos({});
      
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      showAlert(`Error al guardar cliente: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content glass-panel border-0 shadow-lg" style={{ position: 'relative' }}>
          {saving && (
            <SpinnerPremium 
              overlay={true} 
              text="Registrando nuevo cliente en la red regional..." 
            />
          )}
          <div className="modal-header border-bottom-0 pb-0">

            <h5 className="modal-title fw-bold text-dark"><i className="bi bi-person-plus-fill text-primary me-2"></i> Registrar Cliente Local</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>
          <form onSubmit={handleSave}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label small fw-bold">Nombre de la Empresa</label>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3"
                    placeholder="Ej. Innovaciones Digitales S.A."
                    value={nombreEmpresa}
                    onChange={(e) => setNombreEmpresa(e.target.value)}
                    disabled={saving}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">CUIT / RUT / RFC (Identificador Fiscal)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3"
                    placeholder="Ej. 20-12345678-9 o RUT/RFC"
                    value={cuit_rut_rfc}
                    onChange={(e) => setCuitRutRfc(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Industria / Vertical</label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={industria}
                    onChange={(e) => setIndustria(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Selecciona vertical agropecuaria...</option>
                    <option value="productor">🌾 Productor Agropecuario / Campo</option>
                    <option value="agronomia">🏪 Distribuidor / Agronomía</option>
                    <option value="cooperativa">🏢 Acopio & Cooperativa Agrícola</option>
                    <option value="semillero">🌱 Semillero & Genética Vegetal</option>
                    <option value="servicios_agro">🚜 Servicios Agronómicos & Contratista</option>
                    <option value="laboratorio">🧪 Industria / Laboratorio Fitosanitario</option>
                    <option value="otro">🏢 Otro Rubro Agroindustrial</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Sitio Web</label>
                  <input
                    type="url"
                    className="form-control form-control-sm rounded-3"
                    placeholder="Ej. https://empresa.com"
                    value={sitioWeb}
                    onChange={(e) => setSitioWeb(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Tamaño de Empresa (Headcount)</label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={tamanioEmpresa}
                    onChange={(e) => setTamanioEmpresa(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Selecciona tamaño...</option>
                    <option value="1-50">1-50 Empleados (Pequeña)</option>
                    <option value="51-200">51-200 Empleados (Mediana)</option>
                    <option value="201-500">201-500 Empleados (Grande)</option>
                    <option value="500+">500+ Empleados (Enterprise)</option>
                  </select>
                </div>
                
                <div className="col-md-6">
                  <label className="form-label small fw-bold">País de Operación</label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={pais}
                    onChange={(e) => setPais(e.target.value)}
                    disabled={saving}
                    required
                  >
                    <option value="">Selecciona un país...</option>
                    <option value="AR">🇦🇷 Argentina (AR)</option>
                    <option value="CL">🇨🇱 Chile (CL)</option>
                    <option value="CO">🇨🇴 Colombia (CO)</option>
                    <option value="PE">🇵🇪 Perú (PE)</option>
                    <option value="MX">🇲🇽 México (MX)</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Fase Comercial</label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={faseComercial}
                    onChange={(e) => setFaseComercial(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">⚙️ Automático (Negocio)</option>
                    <option value="Adquisicion">🌱 Adquisición</option>
                    <option value="Retencion">🌳 Retención</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold">Estado Inicial</label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    disabled={saving}
                  >
                    <option value="Onboarding">Onboarding</option>
                    <option value="Activo">Activo</option>
                    <option value="En Riesgo">En Riesgo</option>
                    <option value="Churn">Churn</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label small fw-bold">Observaciones / Contexto Inicial</label>
                  <textarea
                    className="form-control form-control-sm rounded-3"
                    rows="3"
                    placeholder="Escribe detalles del cliente o acuerdo inicial..."
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    disabled={saving}
                  ></textarea>
                </div>
              </div>

              {/* ===== CAMPOS DINÁMICOS POR SECCIÓN ===== */}
              {(() => {
                const seccionesCliente = seccionesConfig.filter(s => s.entidad === 'cliente').sort((a,b) => a.orden - b.orden);
                
                // Agrupar campos por sección
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
                  if (entidad === 'cliente') {
                    const sId = campo.seccionId || 'huerfanos';
                    if (!camposAgrupados[sId]) camposAgrupados[sId] = [];
                    camposAgrupados[sId].push(campo);
                  }
                });

                if (seccionesCliente.length === 0 && (!camposAgrupados['huerfanos'] || camposAgrupados['huerfanos'].length === 0)) {
                  return null;
                }

                const renderCampo = (campo) => (
                  <DynamicFieldInput 
                    key={campo.id}
                    campo={campo}
                    value={camposDinamicos[campo.key]}
                    onChange={(val) => setCamposDinamicos(prev => ({ ...prev, [campo.key]: val }))}
                    clientId="temp"
                  />
                );

                return (
                  <div className="mt-4 pt-3 border-top">
                    {seccionesCliente.map(seccion => {
                      const camposSeccion = (camposAgrupados[seccion.id] || []).sort((a,b) => a.orden - b.orden);
                      if (camposSeccion.length === 0) return null;

                      return (
                        <div key={seccion.id} className="mb-3">
                          <h6 className="fw-bold mb-3 text-dark">
                            <i className={`bi ${seccion.icono || 'bi-grid'} text-primary me-2`}></i> {seccion.nombre}
                          </h6>
                          <div className="row g-3">
                            {camposSeccion.map(renderCampo)}
                          </div>
                        </div>
                      );
                    })}

                    {(camposAgrupados['huerfanos'] || []).length > 0 && (
                      <div className="mb-3">
                        <h6 className="fw-bold mb-3 text-dark">
                          <i className="bi bi-tags-fill text-primary me-2"></i> Información Adicional
                        </h6>
                        <div className="row g-3">
                          {(camposAgrupados['huerfanos'] || []).sort((a,b) => a.orden - b.orden).map(renderCampo)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
            
            <div className="modal-footer border-top-0 pt-0">
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-sm btn-primary rounded-pill px-4 shadow-sm" disabled={saving}>
                {saving ? 'Registrando...' : 'Registrar Cliente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
