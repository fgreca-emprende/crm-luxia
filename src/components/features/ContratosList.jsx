import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useContratos } from '../../hooks/useContratos';
import { useToast } from '../ui/ToastProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { ContratosTable } from './contratos/components/ContratosTable';
import { ContratoCrearModal } from './contratos/components/ContratoCrearModal';
import { ContratoDetalleModal } from './contratos/components/ContratoDetalleModal';
import { getConfigGeneral } from '../../lib/configGeneral';

export function ContratosList({ clienteId, clientePais, iaPausada }) {
  const { contratos, loading, refresh } = useContratos(clienteId);
  const [negocios, setNegocios] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingContrato, setEditingContrato] = useState(null);
  const [viewingContrato, setViewingContrato] = useState(null);
  const { showAlert } = useToast();
  const { isLector, isAdmin, isSuperAdmin, hasPermission, userTeam, getDataScope, user } = useUserRole();
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, ARS: 1250, CLP: 940, PEN: 3.7, COP: 4100, MXN: 18 });
  const [openHistoryMap, setOpenHistoryMap] = useState({});

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const conf = await getConfigGeneral('rates');
        if (conf && conf.rates) {
          setExchangeRates(conf.rates);
        }
      } catch (err) {
        console.warn("Error loading exchange rates in ContratosList:", err.message);
      }
    };
    fetchRates();
  }, []);

  const [usuarios, setUsuarios] = useState([]);
  const [serviciosConfig, setServiciosConfig] = useState([]);
  const [camposConfig, setCamposConfig] = useState([]);
  const [seccionesConfig, setSeccionesConfig] = useState([]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [usersRes, servRes, camposRes, secRes, opsRes] = await Promise.all([
          supabase.from('usuarios').select('*'),
          supabase.from('config_servicios').select('*'),
          supabase.from('config_campos').select('*').order('orden'),
          supabase.from('config_secciones').select('*').order('orden'),
          clienteId ? supabase.from('oportunidades').select('*').eq('cliente_id', clienteId) : Promise.resolve({ data: [] })
        ]);

        if (usersRes.data) setUsuarios(usersRes.data);
        if (servRes.data) setServiciosConfig(servRes.data);
        if (camposRes.data) setCamposConfig(camposRes.data);
        if (secRes.data) setSeccionesConfig(secRes.data);
        if (opsRes.data) {
          const mapped = opsRes.data.map(o => ({
            id: o.id,
            clienteId: o.cliente_id,
            nombre: o.nombre,
            etapa: o.etapa,
            montoEstimadoMensual: Number(o.monto_estimado_mensual) || 0,
            comercialEmail: o.comercial_email,
            pais: o.pais,
            tipoPipeline: o.tipo_pipeline,
            tipoServicio: o.tipo_servicio,
            camposDinamicos: o.campos_dinamicos || {}
          }));
          setNegocios(mapped);
        }
      } catch (err) {
        console.error('Error fetching metadata in ContratosList:', err);
      }
    };
    loadMeta();
  }, [clienteId]);

  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);
  const oportunidadesScope = getDataScope('oportunidades');

  // Agrupar Contratos por Negocio (Oportunidad)
  const businessGroups = useCallback(() => {
    const groups = {};

    // Filtrar negocios por scope
    let filteredNeg = negocios;
    if (oportunidadesScope !== 'ALL') {
      if (oportunidadesScope === 'NONE') {
        filteredNeg = [];
      } else {
        filteredNeg = negocios.filter(op => {
          const isSelf = op.comercialEmail && op.comercialEmail.toLowerCase().trim() === user?.email?.toLowerCase().trim();
          if (oportunidadesScope === 'OWN') {
            return isSelf;
          }
          if (oportunidadesScope === 'TEAM') {
            if (isSelf) return true;
            const asignadoUser = usuarios.find(u => u.email?.toLowerCase().trim() === op.comercialEmail?.toLowerCase().trim());
            return asignadoUser && normalizarEquipo(asignadoUser.equipo) === normalizedTeam;
          }
          return false;
        });
      }
    }

    filteredNeg.forEach(op => {
      groups[op.id] = {
        negocioId: op.id,
        nombre: op.nombre || 'Negocio Principal',
        tipoServicio: op.tipoServicio || 'default',
        comercialEmail: op.comercialEmail || '',
        pais: op.pais || clientePais || 'AR',
        etapa: op.etapa || 'ganado',
        contratoVigente: null,
        contratosHistoricos: []
      };
    });

    const contractsPerGroup = {};

    contratos.forEach(c => {
      let targetGroupKey = c.oportunidadId;
      if (!targetGroupKey || !groups[targetGroupKey]) {
        const fallbackKey = `orphan_${c.tipoServicio || 'general'}`;
        if (!groups[fallbackKey]) {
          groups[fallbackKey] = {
            negocioId: fallbackKey,
            nombre: `Línea de Servicio: ${(c.tipoServicio || 'General').toUpperCase()}`,
            tipoServicio: c.tipoServicio || 'general',
            comercialEmail: c.comercialEmail || '',
            pais: c.pais || clientePais || 'AR',
            etapa: 'vigente',
            contratoVigente: null,
            contratosHistoricos: []
          };
        }
        targetGroupKey = fallbackKey;
      }

      if (!contractsPerGroup[targetGroupKey]) {
        contractsPerGroup[targetGroupKey] = [];
      }
      contractsPerGroup[targetGroupKey].push(c);
    });

    Object.keys(contractsPerGroup).forEach(groupKey => {
      const groupContracts = contractsPerGroup[groupKey];

      groupContracts.sort((a, b) => {
        const aVig = a.esContratoVigente === true ? 1 : 0;
        const bVig = b.esContratoVigente === true ? 1 : 0;
        if (aVig !== bVig) return bVig - aVig;

        const aVer = Number(a.versionContrato) || 1;
        const bVer = Number(b.versionContrato) || 1;
        if (aVer !== bVer) return bVer - aVer;

        const aDate = new Date(a.fechaInicio || 0).getTime();
        const bDate = new Date(b.fechaInicio || 0).getTime();
        return bDate - aDate;
      });

      const targetGroup = groups[groupKey];
      if (targetGroup && groupContracts.length > 0) {
        targetGroup.contratoVigente = { ...groupContracts[0], esContratoVigente: true };
        targetGroup.contratosHistoricos = groupContracts.slice(1).map(c => ({
          ...c,
          esContratoVigente: false
        }));
      }
    });

    return Object.values(groups);
  }, [negocios, contratos, clientePais, oportunidadesScope, usuarios, normalizedTeam, user]);

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmBtnClass: 'btn-danger',
    confirmText: 'Confirmar',
    onConfirm: null
  });

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: 'Confirmar Eliminación',
      message: '¿Estás seguro de que deseas eliminar permanentemente este contrato? Esta acción desvinculará este documento y no se podrá deshacer.',
      confirmBtnClass: 'btn-danger',
      confirmText: 'Eliminar Contrato',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('contratos').delete().eq('id', id);
          if (error) throw error;
          showAlert('Contrato eliminado correctamente', 'success');
          if (refresh) refresh();
        } catch (err) {
          showAlert(`Error al eliminar contrato: ${err.message}`, 'danger');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleEdit = (c) => {
    setEditingContrato(c);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingContrato(null);
  };

  const handleTriggerIA = async (contratoId) => {
    try {
      await supabase.from('contratos').update({
        _trigger_ia: true,
        _triggered_by: user?.email || 'admin@luxia.com'
      }).eq('id', contratoId);
      showAlert('Análisis de contrato iniciado...', 'info');
      if (refresh) refresh();
    } catch (err) {
      showAlert(`Error al disparar IA: ${err.message}`, 'danger');
    }
  };

  const toggleHistory = (negocioId) => {
    setOpenHistoryMap(prev => ({ ...prev, [negocioId]: !prev[negocioId] }));
  };

  const renderedGroups = businessGroups();

  return (
    <div className="mt-2">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h6 className="mb-0 fw-bold text-dark d-flex align-items-center">
            <i className="bi bi-briefcase-fill text-primary me-2"></i>Negocios y Contratos Reguladores
          </h6>
          <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
            Cada línea de negocio agrupa su contrato vigente actual e historial de versiones y adendas.
          </span>
        </div>
        <button 
          className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold" 
          onClick={showForm ? handleCancelForm : () => {
            setEditingContrato(null);
            setShowForm(true);
          }}
          disabled={!hasPermission('actions', 'crear_contrato')}
          title={!hasPermission('actions', 'crear_contrato') ? "No tienes permisos para crear contratos" : ""}
        >
          {showForm ? 'Cancelar' : '+ Registrar Nuevo Negocio y Contrato'}
        </button>
      </div>

      <ContratoCrearModal
        key={editingContrato ? `edit-${editingContrato.id}` : 'new'}
        show={showForm}
        onClose={handleCancelForm}
        clienteId={clienteId}
        clientePais={clientePais}
        iaPausada={iaPausada}
        editingContrato={editingContrato}
        serviciosConfig={serviciosConfig}
        seccionesConfig={seccionesConfig}
        camposConfig={camposConfig}
        exchangeRates={exchangeRates}
        negocios={negocios}
      />

      {loading ? (
        <div className="text-center small text-muted py-4">Cargando negocios y contratos...</div>
      ) : renderedGroups.length === 0 ? (
        <div className="text-center py-5 bg-light rounded-3 text-muted small border border-dashed">
          <i className="bi bi-briefcase fs-2 text-secondary d-block mb-2"></i>
          Aún no hay negocios ni contratos registrados para este cliente.
        </div>
      ) : (
        <div className="d-flex flex-column gap-4">
          {renderedGroups.map((group) => {
            const hasHistory = group.contratosHistoricos.length > 0;
            const isHistoryOpen = !!openHistoryMap[group.negocioId];

            return (
              <div key={group.negocioId} className="card border-0 shadow-xs rounded-4 bg-white border">
                {/* Cabecera del Negocio */}
                <div className="card-header bg-light bg-opacity-50 border-bottom p-3 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-3">
                      <i className="bi bi-building-check fs-5"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0">{group.nombre}</h6>
                      <span className="small text-muted" style={{ fontSize: '0.73rem' }}>
                        País: <strong>{group.pais}</strong> {group.comercialEmail && `• Comercial: ${group.comercialEmail}`}
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-1 fw-bold">
                      ${group.montoEstimadoMensual.toLocaleString()} / mes
                    </span>
                    <button 
                      className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => {
                        setEditingContrato({ oportunidadId: group.negocioId, clienteId, pais: group.pais });
                        setShowForm(true);
                      }}
                      disabled={!hasPermission('actions', 'adicionar_adenda_renovacion')}
                      title={!hasPermission('actions', 'adicionar_adenda_renovacion') ? "Sin permisos para agregar adendas/renovaciones (Falta adicionar_adenda_renovacion)" : "Agregar Adenda o Renovación a esta línea de negocio"}
                    >
                      + Adenda / Renovación
                    </button>
                  </div>
                </div>

                {/* Cuerpo: Contrato Vigente */}
                <div className="card-body p-3">
                  <div className="small fw-bold text-muted text-uppercase mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                    Contrato Regulador Vigente
                  </div>

                  {group.contratoVigente ? (
                    <ContratosTable
                      contratos={[group.contratoVigente]}
                      iaPausada={iaPausada}
                      isAdmin={isAdmin}
                      isSuperAdmin={isSuperAdmin}
                      hasPermission={hasPermission}
                      handleTriggerIA={handleTriggerIA}
                      handleEdit={handleEdit}
                      handleDelete={handleDelete}
                      onViewDetail={setViewingContrato}
                      camposConfig={camposConfig}
                      exchangeRates={exchangeRates}
                      clientePais={clientePais}
                      isHistorico={false}
                    />
                  ) : (
                    <div className="alert alert-warning py-2 px-3 small rounded-3 mb-0 d-flex justify-content-between align-items-center">
                      <span><i className="bi bi-exclamation-triangle me-2"></i>Este negocio no posee un contrato vigente registrado.</span>
                      <button 
                        className="btn btn-sm btn-warning rounded-pill px-3 fw-bold"
                        onClick={() => {
                          setEditingContrato({ oportunidadId: group.negocioId, clienteId, pais: group.pais });
                          setShowForm(true);
                        }}
                        disabled={!hasPermission('actions', 'crear_contrato')}
                        title={!hasPermission('actions', 'crear_contrato') ? "Sin permisos para registrar contratos (Falta crear_contrato)" : ""}
                      >
                        + Asociar Contrato
                      </button>
                    </div>
                  )}

                  {/* Acordeón de Histórico de Versiones y Adendas */}
                  {hasHistory && (
                    <div className="mt-3 border-top pt-3">
                      <button 
                        type="button"
                        className="btn btn-sm btn-link text-decoration-none text-muted p-0 d-flex align-items-center gap-2 fw-semibold"
                        onClick={() => toggleHistory(group.negocioId)}
                        style={{ fontSize: '0.8rem' }}
                      >
                        <i className={`bi bi-chevron-${isHistoryOpen ? 'down' : 'right'} fs-6`}></i>
                        <span>📜 Ver Historial de Versiones y Adendas anteriores ({group.contratosHistoricos.length})</span>
                      </button>
                      
                      {isHistoryOpen && (
                        <div className="mt-3">
                          <ContratosTable
                            contratos={group.contratosHistoricos}
                            iaPausada={iaPausada}
                            isAdmin={isAdmin}
                            isSuperAdmin={isSuperAdmin}
                            hasPermission={hasPermission}
                            handleTriggerIA={handleTriggerIA}
                            handleEdit={handleEdit}
                            handleDelete={handleDelete}
                            onViewDetail={setViewingContrato}
                            camposConfig={camposConfig}
                            exchangeRates={exchangeRates}
                            clientePais={clientePais}
                            isHistorico={true}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* === VISOR DE EXPEDIENTE CONTRACTUAL EN SOLO LECTURA === */}
      <ContratoDetalleModal
        show={!!viewingContrato}
        onClose={() => setViewingContrato(null)}
        contrato={viewingContrato}
        camposConfig={camposConfig}
        exchangeRates={exchangeRates}
        clientePais={clientePais}
      />

      {/* === MODAL DE CONFIRMACIÓN GLASSMORPHIC PREMIUM === */}
      {confirmModal.show && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '420px' }}>
            <div className="modal-content glass-panel border border-white border-opacity-10 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-body p-4 text-center">
                <div className="p-3 rounded-circle d-inline-flex mb-3 shadow-xs bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
                  <i className="bi bi-exclamation-triangle-fill fs-3"></i>
                </div>
                <h6 className="fw-bold text-dark mb-2">{confirmModal.title}</h6>
                <p className="small text-muted mb-0" style={{ lineHeight: '1.5' }}>
                  {confirmModal.message}
                </p>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-2 d-flex gap-2">
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold flex-grow-1" 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm ${confirmModal.confirmBtnClass} rounded-pill px-3 fw-bold flex-grow-1 shadow-sm`} 
                  onClick={confirmModal.onConfirm}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
