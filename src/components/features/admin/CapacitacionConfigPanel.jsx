import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { SpinnerPremium } from '../../ui/SpinnerPremium';
import { useUserRole } from '../../../contexts/UserRoleContext';

export function CapacitacionConfigPanel() {
  const { role, userTeam, profile, getDataScope } = useUserRole();
  const [activeSubTab, setActiveSubTab] = useState('general'); // 'general', 'preguntas', 'correccion', 'dashboard'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showAlert } = useToast();

  useEffect(() => {
    if (role && role === 'supervisor' && activeSubTab === 'general') {
      setActiveSubTab('dashboard');
    }
  }, [role, activeSubTab]);

  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  const normalizedTeam = normalizarEquipo(userTeam);
  const capacitacionScope = getDataScope('capacitacion');

  const [usuarios, setUsuarios] = useState([]);
  const loadUsuarios = useCallback(async () => {
    try {
      const { data } = await supabase.from('usuarios').select('*');
      if (data) setUsuarios(data);
    } catch (err) {
      console.warn('Error fetching usuarios in CapacitacionConfigPanel:', err);
    }
  }, []);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  // 1. Configuración General State
  const [config, setConfig] = useState({
    frecuenciaDias: 90,
    porcentajeAprobacion: 80,
    pesoTeorico: 50,
    pesoPractico: 50,
    aiGradingEnabled: true
  });

  // 2. Preguntas State
  const [selectedRol, setSelectedRol] = useState('agente');
  const [selectedDificultad, setSelectedDificultad] = useState('basico');
  const [examQuestions, setExamQuestions] = useState(null);

  // 3. Calificaciones State
  const [pendingAttempts, setPendingAttempts] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [manualGrade, setManualGrade] = useState({ score: 80, feedback: '' });

  // Load General Config
  const loadGeneralConfig = useCallback(async () => {
    setLoading(true);
    try {
      const conf = await getConfigGeneral('capacitacion');
      if (conf) {
        setConfig(conf);
      } else {
        const defaults = {
          frecuenciaDias: 90,
          porcentajeAprobacion: 80,
          pesoTeorico: 50,
          pesoPractico: 50,
          aiGradingEnabled: true
        };
        await setConfigGeneral('capacitacion', defaults);
        setConfig(defaults);
      }
    } catch (err) {
      showAlert('Error al cargar configuración general de capacitación.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  // Load Exam Questions
  const loadExamQuestions = useCallback(async (rol, dificultad) => {
    setLoading(true);
    try {
      const docId = rol === 'lector' ? 'lector_unico' : `${rol}_${dificultad}`;
      const { data, error } = await supabase
        .from('config_capacitacion_examenes')
        .select('*')
        .eq('id', docId)
        .maybeSingle();

      if (data && !error) {
        setExamQuestions(data);
      } else {
        setExamQuestions({
          rol,
          dificultad: rol === 'lector' ? 'unico' : dificultad,
          teorico: Array.from({ length: 10 }, (_, i) => ({
            id: `q${i + 1}`,
            pregunta: `Pregunta ${i + 1}`,
            opciones: ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'],
            correcta: 0
          })),
          practico: {
            id: 'p1',
            pregunta: 'Escribe aquí la consigna práctica...',
            criteriosEvaluacion: ['Criterio 1']
          }
        });
      }
    } catch (err) {
      showAlert('Error al cargar preguntas de examen.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  // Load Pending Attempts
  const loadPendingAttempts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('examenes_intentos')
        .select('*')
        .eq('estado', 'pendiente');

      const currentEmail = profile?.email || 'admin@luxia.com';
      const list = [];
      (data || []).forEach(attemptData => {
        const item = {
          id: attemptData.id,
          usuarioEmail: attemptData.usuario_email || attemptData.usuarioEmail,
          usuarioNombre: attemptData.usuario_nombre || attemptData.usuarioNombre,
          rol: attemptData.rol,
          dificultad: attemptData.dificultad,
          fechaIntento: attemptData.fecha_intento || attemptData.fechaIntento,
          scoreTeorico: attemptData.score_teorico || attemptData.scoreTeorico,
          scorePractico: attemptData.score_practico || attemptData.scorePractico,
          scoreGlobal: attemptData.score_global || attemptData.scoreGlobal,
          aprobado: attemptData.aprobado,
          respuestaPractico: attemptData.respuesta_practico || attemptData.respuestaPractico,
          feedbackPractico: attemptData.feedback_practico || attemptData.feedbackPractico,
          estado: attemptData.estado
        };

        if (capacitacionScope === 'ALL') {
          list.push(item);
        } else if (capacitacionScope === 'OWN') {
          if (item.usuarioEmail?.toLowerCase().trim() === currentEmail.toLowerCase().trim()) {
            list.push(item);
          }
        } else if (capacitacionScope === 'TEAM') {
          if (item.usuarioEmail?.toLowerCase().trim() === currentEmail.toLowerCase().trim()) {
            list.push(item);
          } else {
            const userObj = usuarios.find(u => u.email?.toLowerCase().trim() === item.usuarioEmail?.toLowerCase().trim());
            if (userObj && normalizarEquipo(userObj.equipo) === normalizedTeam) {
              list.push(item);
            }
          }
        }
      });
      setPendingAttempts(list);
    } catch (err) {
      showAlert('Error al cargar exámenes pendientes de corrección.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [showAlert, capacitacionScope, usuarios, normalizedTeam, profile]);

  // Load All Attempts for dashboard
  const [allAttempts, setAllAttempts] = useState([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  const loadAllAttempts = useCallback(async () => {
    setAttemptsLoading(true);
    try {
      const { data } = await supabase
        .from('examenes_intentos')
        .select('*')
        .order('fecha_intento', { ascending: false });

      const list = (data || []).map(d => ({
        id: d.id,
        usuarioEmail: d.usuario_email || d.usuarioEmail,
        usuarioNombre: d.usuario_nombre || d.usuarioNombre,
        rol: d.rol,
        dificultad: d.dificultad,
        fechaIntento: d.fecha_intento || d.fechaIntento,
        scoreTeorico: d.score_teorico || d.scoreTeorico,
        scorePractico: d.score_practico || d.scorePractico,
        scoreGlobal: d.score_global || d.scoreGlobal,
        aprobado: d.aprobado,
        estado: d.estado
      }));
      setAllAttempts(list);
    } catch (err) {
      console.warn('Error loading attempts:', err);
      showAlert('Error al cargar resultados de exámenes.', 'danger');
    } finally {
      setAttemptsLoading(false);
    }
  }, [showAlert]);

  // Dashboard Filters State
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');

  // Compute status and highest score for each user
  const userCertifications = useMemo(() => {
    return usuarios.map(u => {
      const userEmail = u.email?.toLowerCase().trim();
      const userAttempts = allAttempts.filter(att => att.usuarioEmail?.toLowerCase().trim() === userEmail);
      
      const sortedAttempts = [...userAttempts].sort((a, b) => {
        const tA = a.fechaIntento?.toDate ? a.fechaIntento.toDate().getTime() : new Date(a.fechaIntento).getTime();
        const tB = b.fechaIntento?.toDate ? b.fechaIntento.toDate().getTime() : new Date(b.fechaIntento).getTime();
        return tB - tA;
      });
      
      const lastAttempt = sortedAttempts[0] || null;
      
      let maxScoreGlobal = 0;
      let maxScoreTeorico = 0;
      userAttempts.forEach(att => {
        if (att.scoreGlobal && att.scoreGlobal > maxScoreGlobal) maxScoreGlobal = att.scoreGlobal;
        if (att.scoreTeorico && att.scoreTeorico > maxScoreTeorico) maxScoreTeorico = att.scoreTeorico;
      });
      
      const hasApproved = userAttempts.some(att => att.aprobado === true);
      const hasPending = userAttempts.some(att => att.estado === 'pendiente');
      
      let status = 'no_rendido';
      let statusLabel = 'No Rendido';
      let statusColor = 'secondary';
      let displayScore = '-';
      
      if (hasApproved) {
        status = 'aprobado';
        statusLabel = 'Certificado';
        statusColor = 'success';
        displayScore = `${maxScoreGlobal}%`;
      } else if (hasPending) {
        status = 'pendiente';
        statusLabel = 'Pendiente Corrección';
        statusColor = 'warning';
        displayScore = `${maxScoreTeorico}% (Teórico)`;
      } else if (userAttempts.length > 0) {
        status = 'reprobado';
        statusLabel = 'Reprobado';
        statusColor = 'danger';
        displayScore = `${maxScoreGlobal}%`;
      }
      
      return {
        ...u,
        status,
        statusLabel,
        statusColor,
        displayScore,
        lastAttemptDate: lastAttempt ? (lastAttempt.fechaIntento?.toDate ? lastAttempt.fechaIntento.toDate() : new Date(lastAttempt.fechaIntento)) : null,
        attemptsCount: userAttempts.length,
        highestScore: hasApproved ? maxScoreGlobal : maxScoreTeorico
      };
    });
  }, [usuarios, allAttempts]);

  const filteredCertifications = useMemo(() => {
    return userCertifications.filter(uc => {
      if (capacitacionScope === 'TEAM') {
        if (normalizarEquipo(uc.equipo) !== normalizedTeam) return false;
      }
      
      if (capacitacionScope === 'ALL' && teamFilter !== 'ALL') {
        if (normalizarEquipo(uc.equipo) !== normalizarEquipo(teamFilter)) return false;
      }
      
      if (statusFilter !== 'ALL' && uc.status !== statusFilter) return false;
      
      if (searchText.trim() !== '') {
        const term = searchText.toLowerCase().trim();
        const nameMatch = uc.nombre?.toLowerCase().includes(term);
        const emailMatch = uc.email?.toLowerCase().includes(term);
        if (!nameMatch && !emailMatch) return false;
      }
      
      return true;
    });
  }, [userCertifications, capacitacionScope, normalizedTeam, teamFilter, statusFilter, searchText]);

  const metrics = useMemo(() => {
    const scopeUsers = userCertifications.filter(uc => {
      if (capacitacionScope === 'TEAM') {
        return normalizarEquipo(uc.equipo) === normalizedTeam;
      }
      if (capacitacionScope === 'ALL' && teamFilter !== 'ALL') {
        return normalizarEquipo(uc.equipo) === normalizarEquipo(teamFilter);
      }
      return true;
    });
    
    const total = scopeUsers.length;
    const certified = scopeUsers.filter(uc => uc.status === 'aprobado').length;
    const pending = scopeUsers.filter(uc => uc.status === 'pendiente').length;
    
    const attemptedUsers = scopeUsers.filter(uc => uc.status !== 'no_rendido');
    const sumScores = attemptedUsers.reduce((sum, uc) => sum + uc.highestScore, 0);
    const avgScore = attemptedUsers.length > 0 ? Math.round(sumScores / attemptedUsers.length) : 0;
    
    const rate = total > 0 ? Math.round((certified / total) * 100) : 0;
    
    return {
      total,
      certified,
      pending,
      avgScore,
      rate
    };
  }, [userCertifications, capacitacionScope, normalizedTeam, teamFilter]);

  // Trigger loading based on active tab
  useEffect(() => {
    if (activeSubTab === 'general') {
      loadGeneralConfig();
    } else if (activeSubTab === 'preguntas') {
      loadExamQuestions(selectedRol, selectedDificultad);
    } else if (activeSubTab === 'correccion') {
      loadPendingAttempts();
    } else if (activeSubTab === 'dashboard') {
      loadAllAttempts();
    }
  }, [activeSubTab, selectedRol, selectedDificultad, loadGeneralConfig, loadExamQuestions, loadPendingAttempts, loadAllAttempts]);

  // Save General Config
  const handleSaveGeneralConfig = async (e) => {
    e.preventDefault();
    if (config.pesoTeorico + config.pesoPractico !== 100) {
      showAlert('La suma del peso teórico y práctico debe ser exactamente 100%.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await setConfigGeneral('capacitacion', config);
      showAlert('Configuración guardada exitosamente.', 'success');
    } catch (err) {
      showAlert(`Error al guardar configuración: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Save Exam Questions
  const handleSaveExamQuestions = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docId = selectedRol === 'lector' ? 'lector_unico' : `${selectedRol}_${selectedDificultad}`;
      
      const dataToSave = {
        id: docId,
        rol: selectedRol,
        dificultad: selectedRol === 'lector' ? 'unico' : selectedDificultad,
        titulo: `Examen ${selectedRol.toUpperCase()} - Nivel ${selectedDificultad.toUpperCase()}`,
        teorico: examQuestions.teorico || [],
        practico: examQuestions.practico || {},
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('config_capacitacion_examenes')
        .upsert(dataToSave);

      if (error) throw error;
      showAlert('Examen actualizado con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar examen: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Submit Manual Grade
  const handleSaveManualGrade = async (e) => {
    e.preventDefault();
    if (!selectedAttempt) return;
    setSaving(true);
    try {
      // Calcular score global con la config general actual
      const globalScore = Math.round(
        ((selectedAttempt.scoreTeorico * config.pesoTeorico) + (parseInt(manualGrade.score) * config.pesoPractico)) / 100
      );
      const aprobado = globalScore >= config.porcentajeAprobacion;

      const { error } = await supabase
        .from('examenes_intentos')
        .update({
          score_practico: parseInt(manualGrade.score),
          feedback_practico: manualGrade.feedback,
          score_global: globalScore,
          aprobado: aprobado,
          estado: 'evaluado',
          evaluado_por: 'manual_admin'
        })
        .eq('id', selectedAttempt.id);

      if (error) throw error;

      showAlert('Examen evaluado exitosamente. Se actualizará la certificación del usuario.', 'success');
      setSelectedAttempt(null);
      setManualGrade({ score: 80, feedback: '' });
      loadPendingAttempts();
    } catch (err) {
      showAlert(`Error al calificar intento: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 bg-transparent">
      {/* Sub Tabs */}
      <div className="d-flex border-bottom pb-2 mb-4 overflow-auto">
        {(role === 'admin' || role === 'superadmin') && (
          <>
            <button 
              className={`btn btn-sm rounded-pill px-3 me-2 fw-bold ${activeSubTab === 'general' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveSubTab('general')}
            >
              <i className="bi bi-sliders me-1"></i>Configuración General
            </button>
            <button 
              className={`btn btn-sm rounded-pill px-3 me-2 fw-bold ${activeSubTab === 'preguntas' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveSubTab('preguntas')}
            >
              <i className="bi bi-journal-text me-1"></i>Gestión de Preguntas
            </button>
          </>
        )}
        <button 
          className={`btn btn-sm rounded-pill px-3 me-2 fw-bold ${activeSubTab === 'dashboard' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveSubTab('dashboard')}
        >
          <i className="bi bi-bar-chart-line me-1"></i>Rendimiento de Exámenes
        </button>
        <button 
          className={`btn btn-sm rounded-pill px-3 me-2 fw-bold position-relative ${activeSubTab === 'correccion' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveSubTab('correccion')}
        >
          <i className="bi bi-patch-check me-1"></i>Bandeja de Corrección
          {pendingAttempts.length > 0 && (
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
              {pendingAttempts.length}
            </span>
          )}
        </button>
      </div>

      {(loading || attemptsLoading) && !saving ? (
        <div className="text-center py-5">
          <SpinnerPremium size="md" text="Cargando datos..." />
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* TAB 1: CONFIG GENERAL */}
          {activeSubTab === 'general' && (
            <div className="row g-4">
              <div className="col-lg-6">
                <div className="card border-0 bg-light p-4 rounded-4 shadow-sm">
                  <h5 className="fw-bold mb-3 text-dark">
                    <i className="bi bi-gear me-2 text-primary"></i>Configuración de Evaluaciones
                  </h5>
                  <form onSubmit={handleSaveGeneralConfig}>
                    <div className="mb-3">
                      <label className="form-label small fw-bold mb-1">Frecuencia de Recertificación (Días)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        min="10"
                        required 
                        value={config.frecuenciaDias}
                        onChange={e => setConfig({...config, frecuenciaDias: parseInt(e.target.value) || 90})}
                      />
                      <div className="form-text small">Cada cuánto tiempo el usuario debe rendir el examen para mantener su estado.</div>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label small fw-bold mb-1">Porcentaje Mínimo para Aprobar (%)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        min="1"
                        max="100"
                        required 
                        value={config.porcentajeAprobacion}
                        onChange={e => setConfig({...config, porcentajeAprobacion: parseInt(e.target.value) || 80})}
                      />
                    </div>

                    <div className="row g-3 mb-4">
                      <div className="col-6">
                        <label className="form-label small fw-bold mb-1">Peso Examen Teórico (%)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          min="0"
                          max="100"
                          required 
                          value={config.pesoTeorico}
                          onChange={e => setConfig({...config, pesoTeorico: parseInt(e.target.value) || 0})}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-bold mb-1">Peso Examen Práctico (%)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          min="0"
                          max="100"
                          required 
                          value={config.pesoPractico}
                          onChange={e => setConfig({...config, pesoPractico: parseInt(e.target.value) || 0})}
                        />
                      </div>
                      <div className="col-12 mt-1">
                        <div className={`form-text small ${config.pesoTeorico + config.pesoPractico === 100 ? 'text-success fw-bold' : 'text-danger'}`}>
                          Suma de pesos: {config.pesoTeorico + config.pesoPractico}% (Debe ser exactamente 100%)
                        </div>
                      </div>
                    </div>

                    <div className="form-check form-switch mb-4 p-3 bg-white rounded-3 border shadow-xs">
                      <input 
                        className="form-check-input ms-0 me-2" 
                        type="checkbox" 
                        id="aiGradingEnabled" 
                        checked={config.aiGradingEnabled}
                        onChange={e => setConfig({...config, aiGradingEnabled: e.target.checked})}
                      />
                      <label className="form-check-label fw-bold text-dark" htmlFor="aiGradingEnabled">
                        Habilitar calificación por LUXIA IA
                      </label>
                      <div className="form-text small mt-1">Si se desactiva (o si la IA se cae/agota presupuesto), las respuestas prácticas serán derivadas a la bandeja de calificación manual.</div>
                    </div>

                    <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" disabled={saving || config.pesoTeorico + config.pesoPractico !== 100}>
                      {saving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GESTION DE PREGUNTAS */}
          {activeSubTab === 'preguntas' && examQuestions && (
            <div className="row g-4">
              <div className="col-lg-8">
                <div className="card border-0 bg-light p-4 rounded-4 shadow-sm">
                  <h5 className="fw-bold mb-4 text-dark"><i className="bi bi-file-earmark-ruled me-2 text-primary"></i>Configurador de Examen</h5>
                  
                  {/* Selectores de Perfil */}
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold mb-1 text-dark">Perfil / Rol del Sistema</label>
                      <select 
                        className="form-select" 
                        value={selectedRol}
                        onChange={e => {
                          setSelectedRol(e.target.value);
                          if (e.target.value === 'lector') setSelectedDificultad('unico');
                        }}
                      >
                        <option value="lector">Lector (Solo Lectura)</option>
                        <option value="agente">Asesor Técnico Comercial</option>
                        <option value="supervisor">Supervisor Comercial</option>
                        <option value="admin">Administrador</option>
                        <option value="superadmin">SuperAdmin</option>
                      </select>
                    </div>
                    {selectedRol !== 'lector' && (
                      <div className="col-md-6">
                        <label className="form-label small fw-bold mb-1 text-dark">Nivel de Dificultad</label>
                        <select 
                          className="form-select" 
                          value={selectedDificultad}
                          onChange={e => setSelectedDificultad(e.target.value)}
                        >
                          <option value="basico">Básico</option>
                          <option value="avanzado">Avanzado</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSaveExamQuestions}>
                    <h6 className="fw-bold text-primary mb-3 pb-1 border-bottom"><i className="bi bi-list-check me-2"></i>Evaluación Teórica (Preguntas Opción Múltiple)</h6>
                    
                    {examQuestions.teorico?.map((q, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-3 border mb-3 shadow-xs">
                        <div className="mb-2">
                          <label className="form-label small fw-bold mb-1 text-dark">Pregunta #{idx + 1}</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            required 
                            value={q.pregunta}
                            onChange={e => {
                              const newTeorico = [...examQuestions.teorico];
                              newTeorico[idx].pregunta = e.target.value;
                              setExamQuestions({...examQuestions, teorico: newTeorico});
                            }}
                          />
                        </div>
                        <div className="row g-2 mb-2">
                          {q.opciones.map((opt, oIdx) => (
                            <div key={oIdx} className="col-md-6">
                              <label className="small text-muted mb-0.5">Opción {oIdx + 1}</label>
                              <input 
                                type="text" 
                                className="form-control form-control-sm" 
                                required 
                                value={opt}
                                onChange={e => {
                                  const newTeorico = [...examQuestions.teorico];
                                  newTeorico[idx].opciones[oIdx] = e.target.value;
                                  setExamQuestions({...examQuestions, teorico: newTeorico});
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="form-label small fw-bold mb-1 text-dark">Opción Correcta</label>
                          <select 
                            className="form-select form-select-sm"
                            value={q.correcta}
                            onChange={e => {
                              const newTeorico = [...examQuestions.teorico];
                              newTeorico[idx].correcta = parseInt(e.target.value);
                              setExamQuestions({...examQuestions, teorico: newTeorico});
                            }}
                          >
                            <option value="0">Opción 1</option>
                            <option value="1">Opción 2</option>
                            <option value="2">Opción 3</option>
                            <option value="3">Opción 4</option>
                          </select>
                        </div>
                      </div>
                    ))}

                    <h6 className="fw-bold text-primary mt-4 mb-3 pb-1 border-bottom"><i className="bi bi-journal-code me-2"></i>Evaluación Práctica (Consigna Abierta)</h6>
                    <div className="p-3 bg-white rounded-3 border mb-4 shadow-xs">
                      <div className="mb-3">
                        <label className="form-label small fw-bold mb-1 text-dark">Consigna Práctica (Instrucciones)</label>
                        <textarea 
                          className="form-control" 
                          rows="4" 
                          required 
                          value={examQuestions.practico?.pregunta || ''}
                          onChange={e => setExamQuestions({
                            ...examQuestions,
                            practico: { ...examQuestions.practico, pregunta: e.target.value }
                          })}
                        ></textarea>
                      </div>
                      <div>
                        <label className="form-label small fw-bold mb-1 text-dark">Criterios de Evaluación (separados por coma)</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Criterio 1, Criterio 2..."
                          value={(examQuestions.practico?.criteriosEvaluacion || []).join(', ')}
                          onChange={e => setExamQuestions({
                            ...examQuestions,
                            practico: { 
                              ...examQuestions.practico, 
                              criteriosEvaluacion: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                            }
                          })}
                        />
                        <div className="form-text small">LUXIA IA los utilizará para ponderar la calificación práctica de la respuesta.</div>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar Examen'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BANDEJA DE CORRECCION */}
          {activeSubTab === 'correccion' && (
            <div className="row g-4">
              <div className="col-12">
                {selectedAttempt ? (
                  /* Formulario de Calificación Manual */
                  <div className="card border-0 bg-light p-4 rounded-4 shadow-sm animate-fade-in" style={{ maxWidth: '700px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold mb-0 text-dark">
                        <i className="bi bi-pencil-square text-primary me-2"></i>Calificar Examen Práctico
                      </h5>
                      <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setSelectedAttempt(null)}>
                        Volver
                      </button>
                    </div>

                    <div className="p-3 bg-white border rounded-3 mb-4 text-dark small">
                      <div><strong>Usuario:</strong> {selectedAttempt.usuarioNombre} ({selectedAttempt.usuarioEmail})</div>
                      <div><strong>Rol Evaluado:</strong> <span className="text-uppercase fw-bold">{selectedAttempt.rol}</span></div>
                      <div><strong>Dificultad:</strong> <span className="text-uppercase fw-bold">{selectedAttempt.dificultad}</span></div>
                      <div><strong>Nota Teórica Obtenida:</strong> <span className="badge bg-primary fs-6">{selectedAttempt.scoreTeorico}%</span></div>
                    </div>

                    <form onSubmit={handleSaveManualGrade}>
                      <div className="mb-3">
                        <label className="form-label small fw-bold mb-1 text-dark">Consigna Práctica Exigida</label>
                        <div className="p-3 bg-white rounded border small text-muted text-wrap font-monospace">
                          ¿Cómo evaluarías y mitigarías el riesgo de Churn en un cliente regional?
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold mb-1 text-dark">Respuesta Escrita del Usuario</label>
                        <div className="p-3 bg-white rounded border small text-dark text-wrap whitespace-pre-wrap font-monospace" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {selectedAttempt.respuestaPractico}
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-bold mb-1 text-dark">Nota del Examen Práctico (0-100)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          min="0" 
                          max="100" 
                          required 
                          value={manualGrade.score}
                          onChange={e => setManualGrade({ ...manualGrade, score: parseInt(e.target.value) || 0 })}
                        />
                      </div>

                      <div className="mb-4">
                        <label className="form-label small fw-bold mb-1 text-dark">Feedback Constructivo (Markdown Soportado)</label>
                        <textarea 
                          className="form-control" 
                          rows="5" 
                          required 
                          placeholder="Escribe aquí las observaciones, aciertos y aspectos a mejorar para el usuario..."
                          value={manualGrade.feedback}
                          onChange={e => setManualGrade({ ...manualGrade, feedback: e.target.value })}
                        ></textarea>
                      </div>

                      <button type="submit" className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" disabled={saving}>
                        {saving ? 'Guardando Calificación...' : 'Aprobar / Calificar Examen'}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Listado de Exámenes Pendientes */
                  <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                    <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
                      <h6 className="fw-bold mb-0 text-dark">Exámenes Prácticos Pendientes de Calificación</h6>
                      <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={loadPendingAttempts}>
                        <i className="bi bi-arrow-clockwise"></i>
                      </button>
                    </div>
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                          <thead className="table-light text-muted">
                            <tr>
                              <th className="px-4 fw-bold border-0">Usuario</th>
                              <th className="fw-bold border-0">Rol/Dificultad</th>
                              <th className="fw-bold border-0 text-center">Teórico</th>
                              <th className="fw-bold border-0 text-center">Fecha Envío</th>
                              <th className="fw-bold border-0 text-end px-4">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingAttempts.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="text-center text-muted py-4">No hay exámenes pendientes de calificación manual.</td>
                              </tr>
                            ) : (
                              pendingAttempts.map(attempt => {
                                const dateStr = attempt.fechaIntento?.toDate 
                                  ? attempt.fechaIntento.toDate().toLocaleString('es-ES') 
                                  : new Date(attempt.fechaIntento).toLocaleString();
                                return (
                                  <tr key={attempt.id}>
                                    <td className="px-4">
                                      <div className="text-dark fw-bold">{attempt.usuarioNombre}</div>
                                      <div className="text-muted small" style={{ fontSize: '0.72rem' }}>{attempt.usuarioEmail}</div>
                                    </td>
                                    <td>
                                      <span className="badge bg-secondary bg-opacity-10 text-secondary border rounded-pill px-3 py-1 font-monospace text-uppercase" style={{ fontSize: '0.7rem' }}>
                                        {attempt.rol} - {attempt.dificultad}
                                      </span>
                                    </td>
                                    <td className="text-center fw-bold text-dark">{attempt.scoreTeorico}%</td>
                                    <td className="text-center text-muted font-monospace">{dateStr}</td>
                                    <td className="text-end px-4">
                                      <button 
                                        className="btn btn-sm btn-primary rounded-pill px-3" 
                                        onClick={() => {
                                          setSelectedAttempt(attempt);
                                          setManualGrade({ score: 80, feedback: '' });
                                        }}
                                      >
                                        <i className="bi bi-pencil-square me-1"></i>Calificar
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: RENDIMIENTO DE EXÁMENES (DASHBOARD) */}
          {activeSubTab === 'dashboard' && (
            <div className="animate-fade-in text-dark">
              {/* KPI Cards Row */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-3">
                  <div className="card border-0 bg-light p-3 rounded-4 shadow-sm h-100 transition-all hover-translate">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-bold">Tasa de Aprobación</span>
                      <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-1"><i className="bi bi-percent"></i></span>
                    </div>
                    <h3 className="fw-bold mb-1 text-dark">{metrics.rate}%</h3>
                    <div className="progress mt-2" style={{ height: '6px' }}>
                      <div className="progress-bar bg-success" role="progressbar" style={{ width: `${metrics.rate}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-3">
                  <div className="card border-0 bg-light p-3 rounded-4 shadow-sm h-100 transition-all hover-translate">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-bold">Certificados</span>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-1"><i className="bi bi-shield-check"></i></span>
                    </div>
                    <h3 className="fw-bold mb-1 text-success">{metrics.certified} <span className="fs-6 text-muted fw-normal">/ {metrics.total} agentes</span></h3>
                    <span className="text-muted small" style={{ fontSize: '0.72rem' }}>Han aprobado al menos un examen.</span>
                  </div>
                </div>

                <div className="col-12 col-md-3">
                  <div className="card border-0 bg-light p-3 rounded-4 shadow-sm h-100 transition-all hover-translate">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-bold">Promedio de Nota</span>
                      <span className="badge bg-info bg-opacity-10 text-info rounded-pill px-2 py-1"><i className="bi bi-award-fill"></i></span>
                    </div>
                    <h3 className="fw-bold mb-1 text-dark">{metrics.avgScore}%</h3>
                    <span className="text-muted small" style={{ fontSize: '0.72rem' }}>Puntuación máxima promedio de los evaluados.</span>
                  </div>
                </div>

                <div className="col-12 col-md-3">
                  <div className="card border-0 bg-light p-3 rounded-4 shadow-sm h-100 transition-all hover-translate">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-bold">Pendientes de Corrección</span>
                      <span className="badge bg-warning bg-opacity-10 text-warning rounded-pill px-2 py-1"><i className="bi bi-clock-history"></i></span>
                    </div>
                    <h3 className="fw-bold mb-1 text-warning">{metrics.pending}</h3>
                    <span className="text-muted small" style={{ fontSize: '0.72rem' }}>Requieren revisión manual de la consigna práctica.</span>
                  </div>
                </div>
              </div>

              {/* Filters Block */}
              <div className="card border-0 bg-light p-4 rounded-4 shadow-sm mb-4">
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold mb-1 text-dark">Buscar Agente</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted"></i></span>
                      <input 
                        type="text" 
                        className="form-control border-start-0" 
                        placeholder="Nombre o correo..." 
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold mb-1 text-dark">Filtrar por Estado</label>
                    <select 
                      className="form-select form-select-sm"
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">Todos los Estados</option>
                      <option value="aprobado">Certificados</option>
                      <option value="pendiente">Pendientes de Corrección</option>
                      <option value="reprobado">Reprobados</option>
                      <option value="no_rendido">No Rendidos</option>
                    </select>
                  </div>

                  {capacitacionScope === 'ALL' && (
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-bold mb-1 text-dark">Filtrar por Equipo</label>
                      <select 
                        className="form-select form-select-sm"
                        value={teamFilter}
                        onChange={e => setTeamFilter(e.target.value)}
                      >
                        <option value="ALL">Todos los Equipos</option>
                        {Array.from(new Set(usuarios.map(u => u.equipo).filter(Boolean))).map(team => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* User List Table */}
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div className="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
                  <h6 className="fw-bold mb-0 text-dark">Detalle de Avance del Personal</h6>
                  <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={() => { loadAllAttempts(); loadUsuarios(); }}>
                    <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
                  </button>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                      <thead className="table-light text-muted">
                        <tr>
                          <th className="px-4 fw-bold border-0">Colaborador</th>
                          <th className="fw-bold border-0">Equipo</th>
                          <th className="fw-bold border-0">Estado Certificación</th>
                          <th className="fw-bold border-0 text-center">Nota Máxima</th>
                          <th className="fw-bold border-0 text-center">Último Examen</th>
                          <th className="fw-bold border-0 text-center">Intentos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCertifications.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center text-muted py-4">No se encontraron colaboradores para este filtro.</td>
                          </tr>
                        ) : (
                          filteredCertifications.map(uc => {
                            const dateStr = uc.lastAttemptDate
                              ? uc.lastAttemptDate.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : '-';
                            return (
                              <tr key={uc.email}>
                                <td className="px-4">
                                  <div className="d-flex align-items-center">
                                    <div className="rounded-circle bg-light d-flex align-items-center justify-content-center text-primary fw-bold" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                      {uc.nombre ? uc.nombre.charAt(0).toUpperCase() : uc.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="ms-3">
                                      <div className="text-dark fw-bold">{uc.nombre || uc.email}</div>
                                      <div className="text-muted small" style={{ fontSize: '0.72rem' }}>{uc.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: '0.7rem' }}>
                                    {uc.equipo || 'Sin Asignar'}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge bg-${uc.statusColor} bg-opacity-10 text-${uc.statusColor} border rounded-pill px-3 py-1`} style={{ fontSize: '0.7rem' }}>
                                    {uc.statusLabel}
                                  </span>
                                </td>
                                <td className="text-center fw-bold text-dark">{uc.displayScore}</td>
                                <td className="text-center text-muted font-monospace">{dateStr}</td>
                                <td className="text-center text-dark fw-semibold">{uc.attemptsCount}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
