import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastProvider';
import { logSystemEvent } from '../../lib/telemetry';
import { useUserRole } from '../../contexts/UserRoleContext';

const ENTITY_CONFIGS = {
  leads: {
    title: 'Leads / Prospectos Comerciales',
    icon: 'bi-funnel',
    collectionName: 'leads',
    standardFields: [
      { key: 'nombreEmpresa', label: 'Nombre de la Empresa', required: true },
      { key: 'nombreContacto', label: 'Nombre del Contacto', required: false },
      { key: 'correo', label: 'Correo Electrónico', required: true, isEmail: true },
      { key: 'telefono', label: 'WhatsApp / Teléfono', required: false },
      { key: 'pais', label: 'País (AR)', required: false },
      { key: 'origen', label: 'Canal de Origen (web/referido/outbound)', required: false },
      { key: 'notas', label: 'Notas Comerciales', required: false }
    ],
    sampleRows: [
      {
        'Nombre de la Empresa': 'Agropecuaria Los Ombúes S.A.',
        'Nombre del Contacto': 'Carlos Mendoza (Ing. Agrónomo)',
        'Correo Electrónico': 'carlos.mendoza@losombues.com.ar',
        'WhatsApp / Teléfono': '+5491145678900',
        'País (AR)': 'AR',
        'Canal de Origen': 'web_inbound',
        'Notas Comerciales': 'Interesados en cotización de herbicidas y fungicidas para campaña 2026/27 (1500 has)'
      },
      {
        'Nombre de la Empresa': 'Distribuidora Agronómica del Centro S.R.L.',
        'Nombre del Contacto': 'Ana Gómez',
        'Correo Electrónico': 'ana.gomez@agronomicadelcentro.com.ar',
        'WhatsApp / Teléfono': '+5491134567890',
        'País (AR)': 'AR',
        'Canal de Origen': 'referido',
        'Notas Comerciales': 'Distribuidor regional solicita lista de precios y condiciones comerciales para insecticidas'
      }
    ]
  },
  oportunidades: {
    title: 'Oportunidades / Pipeline de Ventas',
    icon: 'bi-briefcase',
    collectionName: 'oportunidades',
    standardFields: [
      { key: 'nombre', label: 'Nombre de la Oportunidad', required: true },
      { key: 'clienteNombre', label: 'Nombre de la Empresa / Cliente', required: true },
      { key: 'comercialEmail', label: 'Comercial Asignado (Email)', required: true, isEmail: true },
      { key: 'montoEstimadoMensual', label: 'Monto Estimado (USD o ARS)', required: false, isNumber: true },
      { key: 'fechaEstimadaCierre', label: 'Fecha Cierre (YYYY-MM-DD)', required: false },
      { key: 'pais', label: 'País (AR)', required: false },
      { key: 'etapa', label: 'Etapa (diagnostico/propuesta/negociacion)', required: false },
      { key: 'tipoServicio', label: 'Línea Fitosanitaria', required: false },
      { key: 'notas', label: 'Notas de la Oportunidad', required: false }
    ],
    sampleRows: [
      {
        'Nombre de la Oportunidad': 'Provisión Herbicidas & Fungicidas - Campaña 2026/27',
        'Nombre de la Empresa / Cliente': 'Agropecuaria Los Ombúes S.A.',
        'Comercial Asignado (Email)': 'ejecutivo@luxia.com',
        'Monto Estimado (USD o ARS)': '45000',
        'Fecha Cierre (YYYY-MM-DD)': '2026-09-30',
        'País (AR)': 'AR',
        'Etapa (diagnostico/propuesta/negociacion)': 'propuesta',
        'Línea Fitosanitaria': 'Herbicidas / Fungicidas',
        'Notas de la Oportunidad': 'Reunión técnica de validación de dosis agendada'
      }
    ]
  },
  clientes: {
    title: 'Clientes / Cartera Activa',
    icon: 'bi-building',
    collectionName: 'clientes',
    standardFields: [
      { key: 'nombreEmpresa', label: 'Nombre de la Empresa', required: true },
      { key: 'razonSocial', label: 'Razón Social', required: false },
      { key: 'ruc', label: 'CUIT / Tax ID', required: false },
      { key: 'comercialEmail', label: 'Comercial Asignado (Email)', required: true, isEmail: true },
      { key: 'pais', label: 'País (AR)', required: false },
      { key: 'estado', label: 'Estado (activo/onboarding)', required: false },
      { key: 'notas', label: 'Notas Operativas', required: false }
    ],
    sampleRows: [
      {
        'Nombre de la Empresa': 'Cooperativa Agrícola Ganadera Pampeana',
        'Razón Social': 'Cooperativa Agrícola Ganadera Pampeana Ltda.',
        'CUIT / Tax ID': '30-71234567-8',
        'Comercial Asignado (Email)': 'am.luxia@luxia.com',
        'País (AR)': 'AR',
        'Estado (activo/onboarding)': 'activo',
        'Notas Operativas': 'Cliente estratégico de alta prioridad con 12 sucursales'
      }
    ]
  }
};

export function BulkImportModal({ show, onClose, initialEntity = 'leads', user, onImportCompleted }) {
  const { showAlert } = useToast();
  const { userTeam, getDataScope } = useUserRole();
  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);

  const [usuarios, setUsuarios] = useState([]);
  useEffect(() => {
    if (!show) return;
    const loadUsuarios = async () => {
      try {
        const { data, error } = await supabase.from('usuarios').select('*');
        if (error) throw error;
        setUsuarios(data || []);
      } catch (err) {
        console.error('Error fetching usuarios in BulkImportModal:', err);
      }
    };
    loadUsuarios();
  }, [show]);

  const [selectedEntity, setSelectedEntity] = useState(initialEntity);
  const [camposConfig, setCamposConfig] = useState([]);
  const [seccionesConfig, setSeccionesConfig] = useState([]);

  // File & Parsing state
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [validatedData, setValidatedData] = useState([]);
  const [parsingErrors, setParsingErrors] = useState([]);
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'importing' | 'complete'

  // Progress state
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);

  useEffect(() => {
    if (initialEntity && ENTITY_CONFIGS[initialEntity]) {
      setSelectedEntity(initialEntity);
    }
  }, [initialEntity]);

  // Reset state when entity or modal changes
  const resetForm = () => {
    setFile(null);
    setParsedRows([]);
    setValidatedData([]);
    setParsingErrors([]);
    setStep('upload');
    setProgress(0);
    setProcessedCount(0);
    setSuccessCount(0);
    setFailureCount(0);
  };

  // Load custom fields configuration
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: secData } = await supabase.from('config_secciones').select('*').order('orden');
        setSeccionesConfig(secData || []);

        const { data: camposData } = await supabase.from('config_campos').select('*').order('orden');
        setCamposConfig(camposData || []);
      } catch (err) {
        console.error('Error cargando campos dinámicos para plantilla:', err);
      }
    };

    if (show) {
      fetchMetadata();
    }
  }, [show]);

  const seccionesMap = seccionesConfig.reduce((acc, sec) => {
    acc[sec.id] = sec.entidad;
    return acc;
  }, {});

  // Get custom dynamic fields matching current entity
  const getCustomFieldsForEntity = (entity) => {
    const entityTargetMap = {
      leads: 'lead',
      oportunidades: 'oportunidad',
      clientes: 'cliente'
    };
    const target = entityTargetMap[entity] || 'lead';
    return camposConfig.filter(c => {
      const fieldEntity = c.entidad || seccionesMap[c.seccionId];
      return !fieldEntity || fieldEntity === target || fieldEntity === 'all';
    });
  };

  // Generate and Download Template CSV (Standard Fields + Dynamic Custom Fields)
  const handleDownloadTemplate = () => {
    const config = ENTITY_CONFIGS[selectedEntity];
    const customFields = getCustomFieldsForEntity(selectedEntity);

    // Build headers array
    const headers = [
      ...config.standardFields.map(f => f.label),
      ...customFields.map(c => `${c.nombre} (Dinámico)`)
    ];

    // Build sample rows
    const rows = (config.sampleRows || []).map(sample => {
      const row = [];
      config.standardFields.forEach(f => {
        row.push(sample[f.label] || '');
      });
      customFields.forEach(c => {
        row.push(c.tipo === 'select' ? (c.opciones?.[0] || 'Opción 1') : c.tipo === 'number' ? '100' : 'Ejemplo');
      });
      return row;
    });

    // Format CSV string with BOM for Excel UTF-8
    const csvContent = '\uFEFF' + [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `plantilla_alta_masiva_${selectedEntity}.csv`;
    link.click();

    showAlert('Plantilla CSV descargada con éxito. Puedes abrirla directamente en Excel.', 'success');
  };

  // Simple Robust CSV Parser
  const parseCSVText = (text) => {
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], data: [] };

    // Auto-detect delimiter (comma or semicolon)
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const dataRows = lines.slice(1).map(line => parseLine(line));

    return { headers: rawHeaders, data: dataRows };
  };

  const processFile = (uploadedFile) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const { headers, data } = parseCSVText(text);

        if (headers.length === 0 || data.length === 0) {
          showAlert('El archivo seleccionado está vacío o no contiene datos válidos.', 'warning');
          return;
        }

        validateAndParseRows(headers, data);
      } catch (err) {
        console.error('Error al leer archivo CSV:', err);
        showAlert('Error al procesar el archivo CSV.', 'danger');
      }
    };

    reader.readAsText(uploadedFile, 'UTF-8');
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    processFile(uploadedFile);
  };

  // Drag and Drop Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      processFile(droppedFile);
    }
  };

  // Validate parsed rows against schema
  const validateAndParseRows = (headers, dataRows) => {
    const config = ENTITY_CONFIGS[selectedEntity];
    const customFields = getCustomFieldsForEntity(selectedEntity);

    // Normalizar cabeceras recibidas
    const headerMap = {};
    headers.forEach((h, index) => {
      const cleanHeader = h.toLowerCase().trim().replace(' (dinámico)', '');
      headerMap[cleanHeader] = index;
    });

    const validRows = [];
    const errors = [];

    dataRows.forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 2; // +1 por base-1, +1 por cabecera
      const itemData = {
        standard: {},
        camposDinamicos: {}
      };
      const rowErrors = [];

      // Validar campos estándar
      config.standardFields.forEach(field => {
        const headerLabel = field.label.toLowerCase().trim();
        const colIndex = headerMap[headerLabel];
        const val = colIndex !== undefined && row[colIndex] ? row[colIndex].trim() : '';

        if (field.required && !val) {
          rowErrors.push(`Falta el campo obligatorio: "${field.label}"`);
        } else if (field.isEmail && val && !val.includes('@')) {
          rowErrors.push(`Correo electrónico inválido: "${val}"`);
        } else {
          itemData.standard[field.key] = val;
        }
      });

      // Mapear campos dinámicos
      customFields.forEach(custom => {
        const headerLabel = custom.nombre.toLowerCase().trim();
        const colIndex = headerMap[headerLabel];
        if (colIndex !== undefined && row[colIndex] !== undefined) {
          let val = row[colIndex].trim();
          if (custom.tipo === 'number' && val) val = Number(val) || 0;
          if (custom.tipo === 'checkbox') val = ['si', 'sí', 'true', '1'].includes(val.toLowerCase());
          itemData.camposDinamicos[custom.id] = val;
        }
      });

      if (rowErrors.length > 0) {
        errors.push({ rowNumber, errors: rowErrors });
      } else {
        validRows.push({ rowNumber, data: itemData, raw: row });
      }
    });

    setValidatedData(validRows);
    setParsingErrors(errors);
    setStep('preview');
  };

  const handleExecuteImport = async () => {
    if (validatedData.length === 0) {
      showAlert('No hay registros válidos para importar.', 'warning');
      return;
    }

    setStep('importing');
    setProgress(0);
    setProcessedCount(0);
    setSuccessCount(0);
    setFailureCount(0);

    const total = validatedData.length;
    const entityScope = getDataScope(selectedEntity);
    let success = 0;
    let failure = 0;

    for (let i = 0; i < total; i++) {
      const item = validatedData[i];
      try {
        const std = item.data.standard;
        const dyn = item.data.camposDinamicos || {};

        if (entityScope === 'NONE') {
          throw new Error('No tienes permiso para importar registros en esta entidad.');
        }

        if (selectedEntity === 'leads') {
          const docPayload = {
            nombre_empresa: std.nombreEmpresa,
            nombre_contacto: std.nombreContacto || '',
            correo: std.correo || '',
            telefono: std.telefono || '',
            pais: std.pais ? std.pais.substring(0, 2).toUpperCase() : 'AR',
            estado: std.estado || 'nuevo',
            origen: std.origen || 'web_inbound',
            volumen_mensual_proyectado: Number(std.volumenMensualProyectado || std.montoEstimado) || 0,
            asignado_a: entityScope === 'OWN' ? user?.email : (std.asignadoA || user?.email),
            notas: std.notas || '',
            campos_dinamicos: dyn
          };

          const { data: newLead, error } = await supabase.from('leads').insert(docPayload).select().single();
          if (error) throw error;

          if (std.correo || std.nombreContacto) {
            await supabase.from('contactos').insert({
              lead_id: newLead.id,
              nombre: std.nombreContacto || 'Contacto Lead',
              email: std.correo || '',
              telefono: std.telefono || '',
              puesto: 'Contacto Principal (Alta Masiva)'
            });
          }
        } else if (selectedEntity === 'clientes') {
          const clienteId = 'client_' + (window.crypto?.randomUUID ? window.crypto.randomUUID().split('-')[0] : Date.now().toString(36));
          const docPayload = {
            id: clienteId,
            nombre_empresa: std.nombreEmpresa,
            cuit_rut_rfc: std.ruc || std.cuit || '',
            pais: std.pais ? std.pais.substring(0, 2).toUpperCase() : 'AR',
            estado: std.estado || 'Ingresado',
            comercial_email: entityScope === 'OWN' ? user?.email : (std.comercialEmail || user?.email),
            health_score: { score: 100, riesgo: 'Green', analisis: 'Cliente importado vía Bulk Import' },
            observaciones: std.notas || '',
            campos_dinamicos: dyn
          };

          const { error } = await supabase.from('clientes').insert(docPayload);
          if (error) throw error;

          if (std.contactoNombre || std.nombreContacto || std.correo) {
            await supabase.from('contactos').insert({
              cliente_id: clienteId,
              nombre: std.contactoNombre || std.nombreContacto || 'Contacto Principal',
              email: std.contactoEmail || std.correo || '',
              telefono: std.contactoTelefono || std.telefono || '',
              puesto: 'Contacto Principal (Alta Masiva)'
            });
          }
        } else if (selectedEntity === 'oportunidades') {
          // Resolver o crear cliente_id
          let resolvedClienteId = null;
          const clienteNombreBuscado = (std.clienteNombre || std.nombreEmpresa || '').trim();
          
          if (clienteNombreBuscado) {
            const { data: existingClients } = await supabase
              .from('clientes')
              .select('id')
              .ilike('nombre_empresa', clienteNombreBuscado)
              .limit(1);

            if (existingClients && existingClients.length > 0) {
              resolvedClienteId = existingClients[0].id;
            } else {
              resolvedClienteId = 'client_' + Math.random().toString(36).substring(2, 10);
              await supabase.from('clientes').insert({
                id: resolvedClienteId,
                nombre_empresa: clienteNombreBuscado,
                pais: std.pais ? std.pais.substring(0, 2).toUpperCase() : 'AR',
                comercial_email: entityScope === 'OWN' ? user?.email : (std.comercialEmail || user?.email),
                estado: 'Ingresado'
              });
            }
          }

          if (!resolvedClienteId) {
            throw new Error('No se pudo asociar la oportunidad a un cliente válido.');
          }

          const docPayload = {
            nombre: std.nombre || 'Oportunidad Comercial',
            cliente_id: resolvedClienteId,
            comercial_email: entityScope === 'OWN' ? user?.email : (std.comercialEmail || user?.email),
            monto_estimado_mensual: Number(std.montoEstimadoMensual || std.monto) || 0,
            fecha_estimada_cierre: std.fechaEstimadaCierre || null,
            pais: std.pais ? std.pais.substring(0, 2).toUpperCase() : 'AR',
            etapa: std.etapa || 'diagnostico',
            tipo_pipeline: 'adquisicion',
            tipo_servicio: std.tipoServicio || 'default',
            campos_dinamicos: dyn
          };

          const { error } = await supabase.from('oportunidades').insert(docPayload);
          if (error) throw error;
        }

        success++;
      } catch (err) {
        console.error(`Error importando fila ${item.rowNumber}:`, err);
        failure++;
      }

      const currentProcessed = i + 1;
      setProcessedCount(currentProcessed);
      setSuccessCount(success);
      setFailureCount(failure);
      setProgress(Math.round((currentProcessed / total) * 100));
    }

    if (onImportCompleted) onImportCompleted();
    setStep('complete');
  };

  if (!show) return null;

  const currentConfig = ENTITY_CONFIGS[selectedEntity];

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <style>{`
        .premium-card-btn {
          background: var(--apple-surface-elevated, #ffffff);
          border: 1px solid var(--apple-border, #dee2e6);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 14px;
          position: relative;
          overflow: hidden;
          color: var(--apple-text-primary, #212529);
          text-align: left;
        }
        .premium-card-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          border-color: var(--apple-blue, #0d6efd);
        }
        .premium-card-btn.active {
          background: var(--apple-surface-elevated, #ffffff);
          border: 2px solid var(--apple-blue, #0d6efd) !important;
          color: var(--apple-text-primary, #212529) !important;
          box-shadow: 0 4px 18px rgba(13, 110, 253, 0.2);
        }
        .premium-card-btn .icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: var(--apple-surface-card, #f8f9fa);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          color: var(--apple-text-secondary, #6c757d);
        }
        .premium-card-btn.active .icon-wrapper {
          background: rgba(13, 110, 253, 0.15);
          color: var(--apple-blue, #0d6efd) !important;
        }
        .premium-template-card {
          background: var(--apple-surface-elevated, #ffffff);
          border: 1px solid var(--apple-border, rgba(13, 110, 253, 0.15)) !important;
          border-radius: 14px;
        }
        .premium-drop-zone {
          border: 2px dashed var(--apple-border, #cbd5e1);
          background: var(--apple-surface-elevated, #f8fafc);
          transition: all 0.3s ease;
          border-radius: 16px;
        }
        .premium-drop-zone.drag-active {
          border-color: var(--apple-blue, #0d6efd);
          background: rgba(13, 110, 253, 0.06);
          box-shadow: 0 10px 25px -5px rgba(13, 110, 253, 0.15);
        }
        .premium-drop-zone:hover {
          border-color: var(--apple-blue, #0d6efd);
          background: var(--apple-surface-elevated, #ffffff);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
        }
        .premium-btn-gradient {
          background: var(--apple-blue, #0d6efd);
          color: white;
          border: none;
          transition: all 0.2s ease;
        }
        .premium-btn-gradient:hover {
          background: #0b5ed7;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(13, 110, 253, 0.25);
          color: white;
        }
        .hover-scale {
          transition: all 0.2s ease;
        }
        .hover-scale:hover {
          transform: scale(1.02);
        }
      `}</style>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden" style={{ background: 'var(--apple-surface-card)', borderColor: 'var(--apple-border)' }}>
          
          {/* Modal Header */}
          <div className="modal-header bg-transparent border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <i className={`bi ${currentConfig.icon} fs-4`} style={{ color: 'var(--apple-blue)' }}></i>
              <h5 className="modal-title fw-bold mb-0" style={{ color: 'var(--apple-text-primary)' }}>Alta Masiva de {currentConfig.title}</h5>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4" style={{ background: 'var(--apple-surface-card)' }}>
            
            {/* Step 1: Upload and Template Download */}
            {step === 'upload' && (
              <div>
                {/* Entity Selector */}
                <div className="mb-4">
                  <label className="form-label small fw-bold mb-2" style={{ color: 'var(--apple-text-primary)' }}>Selecciona el objeto a cargar:</label>
                  <div className="row g-3">
                    {Object.keys(ENTITY_CONFIGS).map((key) => {
                      const cfg = ENTITY_CONFIGS[key];
                      const isSelected = selectedEntity === key;
                      return (
                        <div key={key} className="col-4">
                          <button
                            type="button"
                            className={`premium-card-btn w-100 p-3 d-flex flex-column gap-2 ${isSelected ? 'active' : ''}`}
                            onClick={() => { setSelectedEntity(key); resetForm(); }}
                          >
                            <div className="icon-wrapper">
                              <i className={`bi ${cfg.icon} fs-4`} style={{ color: isSelected ? 'var(--apple-blue)' : 'var(--apple-text-secondary)' }}></i>
                            </div>
                            <div>
                              <span className="fw-bold d-block" style={{ fontSize: '0.88rem', color: 'var(--apple-text-primary)' }}>{cfg.title.split('/')[0]}</span>
                              <span className="d-block text-muted" style={{ fontSize: '0.68rem' }}>
                                Importación Masiva
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Download Template Card */}
                <div className="card premium-template-card p-4 mb-4">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '46px', height: '46px' }}>
                        <i className="bi bi-file-earmark-spreadsheet fs-4"></i>
                      </div>
                      <div>
                        <strong className="d-block" style={{ fontSize: '0.92rem', color: 'var(--apple-text-primary)' }}>Plantilla Dinámica Oficial CSV / Excel</strong>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Incluye columnas nativas + {getCustomFieldsForEntity(selectedEntity).length} campos dinámicos activos
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm premium-btn-gradient rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm"
                      onClick={handleDownloadTemplate}
                    >
                      <i className="bi bi-download"></i>Descargar Plantilla
                    </button>
                  </div>
                </div>

                {/* File Upload Drop Area */}
                <div 
                  className={`premium-drop-zone p-5 text-center cursor-pointer ${dragActive ? 'drag-active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="mb-3 d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle" style={{ width: '64px', height: '64px' }}>
                    <i className="bi bi-cloud-arrow-up fs-2"></i>
                  </div>
                  <h5 className="fw-bold mb-1" style={{ fontSize: '1rem', color: 'var(--apple-text-primary)' }}>Selecciona o arrastra tu archivo CSV</h5>
                  <p className="small text-muted mb-4 mx-auto" style={{ maxWidth: '420px', fontSize: '0.8rem' }}>
                    Formatos soportados: .csv codificado en UTF-8 o delimitado por comas / punto y coma.
                  </p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    className="d-none"
                    id="bulk-file-input"
                  />
                  <label htmlFor="bulk-file-input" className="btn btn-primary rounded-pill px-4 py-2.5 fw-bold shadow-sm cursor-pointer hover-scale">
                    <i className="bi bi-folder-check me-2"></i>Examinar Archivo
                  </label>
                </div>
              </div>
            )}

            {/* Step 2: Validation Preview */}
            {step === 'preview' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3 p-3 rounded-3 border" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                  <div>
                    <strong className="d-block" style={{ color: 'var(--apple-text-primary)' }}>Resumen de Pre-Validación</strong>
                    <span className="small text-muted">Archivo: {file?.name}</span>
                  </div>
                  <div className="d-flex gap-2">
                    <span className="badge bg-success-subtle text-success border border-success rounded-pill px-3 py-1.5">
                      <i className="bi bi-check-circle-fill me-1"></i>{validatedData.length} Válidos
                    </span>
                    {parsingErrors.length > 0 && (
                      <span className="badge bg-danger-subtle text-danger border border-danger rounded-pill px-3 py-1.5">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>{parsingErrors.length} Con Errores
                      </span>
                    )}
                  </div>
                </div>

                {/* Parsing Errors Listing */}
                {parsingErrors.length > 0 && (
                  <div className="alert alert-danger p-3 rounded-3 mb-3 border-0 bg-danger-subtle text-danger-emphasis" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                    <strong className="d-block mb-1 small"><i className="bi bi-x-circle me-1"></i>Las siguientes filas contienen errores y serán omitidas:</strong>
                    <ul className="mb-0 ps-3 small" style={{ fontSize: '0.75rem' }}>
                      {parsingErrors.map((err, idx) => (
                        <li key={idx}>
                          <strong>Fila {err.rowNumber}:</strong> {err.errors.join(' | ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Valid Data Preview Table */}
                <h6 className="fw-bold mb-2" style={{ fontSize: '0.85rem', color: 'var(--apple-text-primary)' }}>Previsualización de Registros a Importar:</h6>
                <div className="table-responsive border rounded-3 mb-3" style={{ maxHeight: '250px', background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
                  <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.75rem' }}>
                    <thead style={{ borderBottomColor: 'var(--apple-border)' }}>
                      <tr>
                        <th className="bg-transparent" style={{ color: 'var(--apple-text-secondary)' }}># Fila</th>
                        {currentConfig.standardFields.slice(0, 4).map(f => (
                          <th key={f.key} className="bg-transparent" style={{ color: 'var(--apple-text-secondary)' }}>{f.label}</th>
                        ))}
                        <th className="bg-transparent" style={{ color: 'var(--apple-text-secondary)' }}>Campos Dinámicos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validatedData.slice(0, 10).map((row, idx) => (
                        <tr key={idx} style={{ borderBottomColor: 'var(--apple-border)' }}>
                          <td className="fw-bold font-monospace bg-transparent" style={{ color: 'var(--apple-text-primary)' }}>#{row.rowNumber}</td>
                          {currentConfig.standardFields.slice(0, 4).map(f => (
                            <td key={f.key} className="bg-transparent" style={{ color: 'var(--apple-text-primary)' }}>{row.data.standard[f.key] || '-'}</td>
                          ))}
                          <td className="bg-transparent">
                            <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill">
                              {Object.keys(row.data.camposDinamicos || {}).length} dinámicos
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {validatedData.length > 10 && (
                  <div className="text-center text-muted small mb-3">
                    ... y {validatedData.length - 10} registros válidos adicionales listos para procesar.
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Progress Bar */}
            {step === 'importing' && (
              <div className="text-center py-4">
                <div className="mb-3">
                  <span className="spinner-border spinner-border-lg text-primary" role="status" aria-hidden="true"></span>
                </div>
                <h5 className="fw-bold mb-1" style={{ color: 'var(--apple-text-primary)' }}>Importando registros a la base de datos...</h5>
                <p className="small text-muted mb-3">Por favor no cierres esta ventana mientras procesamos la carga masiva.</p>

                <div className="progress rounded-pill mb-3" style={{ height: '16px', background: 'var(--apple-surface-elevated)' }}>
                  <div 
                    className="progress-bar progress-bar-striped progress-bar-animated bg-success fw-bold" 
                    role="progressbar" 
                    style={{ width: `${progress}%`, fontSize: '0.7rem' }}
                  >
                    {progress}%
                  </div>
                </div>

                <div className="d-flex justify-content-center gap-4 small fw-bold">
                  <span style={{ color: 'var(--apple-text-primary)' }}>Procesados: {processedCount} / {validatedData.length}</span>
                  <span className="text-success"><i className="bi bi-check-circle me-1"></i>Exitosos: {successCount}</span>
                  <span className="text-danger"><i className="bi bi-x-circle me-1"></i>Fallidos: {failureCount}</span>
                </div>
              </div>
            )}

            {/* Step 4: Completion Summary */}
            {step === 'complete' && (
              <div className="text-center py-4">
                <div className="mb-3 text-success animate__animated animate__zoomIn">
                  <i className="bi bi-check-circle-fill" style={{ fontSize: '4.5rem' }}></i>
                </div>
                <h4 className="fw-bold mb-2" style={{ color: 'var(--apple-text-primary)' }}>¡Alta Masiva Completada!</h4>
                <p className="text-muted small mb-4">
                  Se procesaron exitosamente <strong>{successCount}</strong> registros de {currentConfig.title}.
                  {failureCount > 0 && <span className="text-danger d-block mt-1"> Se registraron {failureCount} fallos durante la ingestión.</span>}
                </p>

                <button type="button" className="btn btn-primary rounded-pill px-5 py-2.5 fw-bold shadow-sm" onClick={() => { resetForm(); onClose(); }}>
                  Aceptar y Cerrar
                </button>
              </div>
            )}

          </div>

          {/* Modal Footer */}
          {step !== 'importing' && step !== 'complete' && (
            <div className="modal-footer border-top-0 px-4 py-3" style={{ background: 'var(--apple-surface-elevated)', borderColor: 'var(--apple-border)' }}>
              <button type="button" className="btn btn-outline-secondary rounded-pill px-4 fw-semibold" onClick={() => { resetForm(); onClose(); }}>
                Cancelar
              </button>

              {step === 'preview' && (
                <button
                  type="button"
                  className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-1.5"
                  onClick={handleExecuteImport}
                  disabled={validatedData.length === 0}
                >
                  <i className="bi bi-cloud-arrow-up-fill"></i>Confirmar e Importar {validatedData.length} Registros
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
