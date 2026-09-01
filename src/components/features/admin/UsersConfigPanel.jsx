import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { ConfirmModal } from './ConfirmModal';
import { useUserRole } from '../../../contexts/UserRoleContext';

export function UsersConfigPanel({ currentUser, isSuperAdmin }) {
  const { showAlert } = useToast();
  const { hasPermission } = useUserRole();

  // Estados de carga de datos
  const [activeUsers, setActiveUsers] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados del modal de confirmación
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmBtnClass: 'btn-primary',
    confirmText: 'Confirmar',
    onConfirm: null
  });

  // Estados del formulario
  const [targetEmail, setTargetEmail] = useState('');
  const [targetEquipo, setTargetEquipo] = useState('Global');
  const [targetRol, setTargetRol] = useState('agente');
  const [equipos, setEquipos] = useState([]);

  // Cargar lista de equipos dinámicamente de PostgreSQL
  const loadEquipos = useCallback(async () => {
    try {
      const { data } = await supabase.from('equipos').select('*');
      let list = (data || []).map(d => ({ id: d.id, nombre: d.nombre }));
      if (list.length === 0) {
        list = [
          { id: 'Global', nombre: 'Global' },
          { id: 'CX', nombre: 'CX (Atención al Cliente)' },
          { id: 'Adquisicion', nombre: 'Adquisición (Hunting)' },
          { id: 'Retencion', nombre: 'Retención (Farming)' },
          { id: 'Operaciones', nombre: 'Operaciones' }
        ];
      }
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setEquipos(list);
    } catch (err) {
      console.warn("Error al cargar equipos en UsersConfigPanel:", err);
    }
  }, []);

  useEffect(() => {
    loadEquipos();
  }, [loadEquipos]);

  // Estados de la plantilla de correo
  const [templateSubject, setTemplateSubject] = useState('Invitación a unirse al CRM de Luxia');
  const [templateBody, setTemplateBody] = useState('Hola {{email}},\n\nHas sido invitado al CRM de Luxia como {{rol}} en el equipo {{equipo}}.\n\nPara iniciar sesión y activar tu cuenta, ingresa con tu correo corporativo.\n\nSaludos,\nEl equipo de Luxia');
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Cargar plantilla de correo
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const data = await getConfigGeneral('invitacion_operador');
        if (data) {
          if (data.subject) setTemplateSubject(data.subject);
          if (data.body) setTemplateBody(data.body);
        }
      } catch (err) {
        console.warn('Error al cargar plantilla de correo:', err);
      } finally {
        setLoadingTemplate(false);
      }
    };
    fetchTemplate();
  }, []);

  // Carga de usuarios de Supabase
  const loadUsuarios = useCallback(async () => {
    setLoadingActive(true);
    try {
      const { data, error } = await supabase.from('usuarios').select('*');
      if (error) throw error;
      
      const list = (data || []).map(u => ({
        id: u.id,
        email: u.email || '',
        nombre: u.nombre || u.email || '',
        rol: u.rol || 'agente',
        equipo: u.equipo || 'Global',
        activo: u.activo !== false,
        isPending: false
      }));
      setActiveUsers(list);
    } catch (err) {
      showAlert(`Error al cargar usuarios: ${err.message}`, 'danger');
    } finally {
      setLoadingActive(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  // Combinar usuarios en listado
  const usuariosList = useMemo(() => {
    return [...activeUsers].sort((a, b) => {
      const emailA = a.email || '';
      const emailB = b.email || '';
      return emailA.localeCompare(emailB);
    });
  }, [activeUsers]);

  const [userSearchTerm, setUserSearchTerm] = useState('');

  const filteredUsuariosList = useMemo(() => {
    if (!userSearchTerm.trim()) return usuariosList;
    const term = userSearchTerm.toLowerCase().trim();
    return usuariosList.filter(u => {
      const emailMatch = (u.email || '').toLowerCase().includes(term);
      const equipoMatch = (u.equipo || '').toLowerCase().includes(term);
      const rolMatch = (u.rol || '').toLowerCase().includes(term);
      return emailMatch || equipoMatch || rolMatch;
    });
  }, [usuariosList, userSearchTerm]);

  const loading = loadingActive;

  const getAvailableEquiposForRole = (rol) => {
    const r = (rol || '').toLowerCase();
    if (r === 'admin' || r === 'superadmin') {
      return equipos.filter(eq => eq.id === 'Global');
    }
    if (r === 'agente' || r === 'supervisor') {
      return equipos.filter(eq => eq.id === 'Adquisicion' || eq.id === 'Retencion');
    }
    if (r === 'lector' || r === 'editor') {
      return equipos.filter(eq => eq.id !== 'Adquisicion' && eq.id !== 'Retencion');
    }
    return equipos;
  };

  // Helper para compilar plantilla de correo reemplazando variables
  const compileTemplate = (template, variables) => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(placeholder, value);
    }
    return result;
  };

  // Obtener estado del correo
  const getEmailStatus = (email) => {
    return { label: 'Activo', class: 'text-success fw-bold', icon: 'bi-check-circle-fill' };
  };

  // Guardar la plantilla editada
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setSavingTemplate(true);
    try {
      await setConfigGeneral('invitacion_operador', {
        subject: templateSubject,
        body: templateBody,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || 'admin@luxia.com'
      });
      showAlert('Plantilla de invitación guardada con éxito.', 'success');
    } catch (err) {
      showAlert(`Error al guardar plantilla: ${err.message}`, 'danger');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Manejar el alta / invitación de operador
  const handleAddOperator = async (e) => {
    e.preventDefault();
    const emailLower = targetEmail.trim().toLowerCase();
    
    if (!emailLower) {
      showAlert('El correo electrónico es requerido.', 'warning');
      return;
    }
    if (!emailLower.endsWith('@luxia.com')) {
      showAlert('Solo se permiten cuentas corporativas @luxia.com.', 'warning');
      return;
    }

    const yaExisteActivo = activeUsers.some(u => u.email?.toLowerCase() === emailLower);
    if (yaExisteActivo) {
      showAlert(`El usuario ${emailLower} ya está registrado en la plataforma.`, 'warning');
      return;
    }

    setSaving(true);
    try {
      let finalEquipo = targetEquipo;
      if (targetRol === 'admin' || targetRol === 'superadmin') {
        finalEquipo = 'Global';
      } else if (targetRol === 'agente' || targetRol === 'supervisor') {
        if (targetEquipo !== 'Adquisicion' && targetEquipo !== 'Retencion') {
          showAlert('Los usuarios con rol Agente o Supervisor pertenecen a los equipos Adquisición o Retención.', 'warning');
          return;
        }
      } else if (targetRol === 'lector' || targetRol === 'editor') {
        if (targetEquipo === 'Adquisicion' || targetEquipo === 'Retencion') {
          showAlert('Los usuarios con rol Lector o Editor deben pertenecer a equipos globales u operativos.', 'warning');
          return;
        }
      }

      const { error } = await supabase.from('usuarios').upsert({
        email: emailLower,
        nombre: emailLower.split('@')[0],
        rol: targetRol,
        equipo: finalEquipo,
        activo: true
      }, { onConflict: 'email' });

      if (error) throw error;

      showAlert(`Usuario ${emailLower} registrado con éxito.`, 'success');
      setTargetEmail('');
      setTargetEquipo('Global');
      setTargetRol('agente');
      loadUsuarios();
    } catch (err) {
      showAlert(`Error al crear usuario: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Actualizar equipo de un usuario en línea
  const handleUpdateEquipo = async (user, newEquipo) => {
    if ((user.rol === 'admin' || user.rol === 'superadmin') && newEquipo !== 'Global') {
      showAlert('Los usuarios con rol Admin o SuperAdmin pertenecen únicamente al equipo Global.', 'warning');
      return;
    }
    if ((user.rol === 'agente' || user.rol === 'supervisor') && newEquipo !== 'Adquisicion' && newEquipo !== 'Retencion') {
      showAlert('Los usuarios con rol Agente o Supervisor pertenecen a los equipos Adquisición o Retención.', 'warning');
      return;
    }
    if ((user.rol === 'lector' || user.rol === 'editor') && (newEquipo === 'Adquisicion' || newEquipo === 'Retencion')) {
      showAlert('Los usuarios con rol Lector o Editor deben pertenecer a equipos globales u operativos.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ equipo: newEquipo })
        .eq(user.id ? 'id' : 'email', user.id || user.email);

      if (error) throw error;
      showAlert(`Equipo asignado a ${newEquipo} para ${user.email || user.id}`, 'success');
      loadUsuarios();
    } catch (err) {
      showAlert(`Error al actualizar equipo: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Actualizar rol de un usuario en línea
  const handleUpdateRol = async (user, newRol) => {
    if (newRol === 'superadmin' && !hasPermission('actions', 'promover_superadmin')) {
      showAlert('No tienes privilegios para asignar el rol de SuperAdmin.', 'danger');
      return;
    }
    setSaving(true);
    try {
      const updates = { rol: newRol };
      if (newRol === 'admin' || newRol === 'superadmin') {
        updates.equipo = 'Global';
      } else if (newRol === 'agente' || newRol === 'supervisor') {
        if (user.equipo !== 'Adquisicion' && user.equipo !== 'Retencion') {
          updates.equipo = 'Adquisicion';
        }
      } else if (newRol === 'lector' || newRol === 'editor') {
        if (user.equipo === 'Adquisicion' || user.equipo === 'Retencion') {
          updates.equipo = 'Global';
        }
      }
      const { error } = await supabase
        .from('usuarios')
        .update(updates)
        .eq(user.id ? 'id' : 'email', user.id || user.email);

      if (error) throw error;
      showAlert(`Rol actualizado a ${newRol} para ${user.email || user.id}${updates.equipo ? ` (Equipo fijado a ${updates.equipo})` : ''}`, 'success');
      loadUsuarios();
    } catch (err) {
      showAlert(`Error al actualizar rol: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar usuario (Revocar acceso)
  const handleDeleteUser = (user) => {
    setConfirmModal({
      show: true,
      title: 'Revocar Acceso',
      message: `¿Estás seguro de que deseas revocar y eliminar el acceso de ${user.email || user.id}?`,
      confirmBtnClass: 'btn-danger',
      confirmText: 'Revocar Acceso',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setSaving(true);
        try {
          const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq(user.id ? 'id' : 'email', user.id || user.email);

          if (error) throw error;
          showAlert(`Acceso revocado correctamente para ${user.email || user.id}`, 'success');
          loadUsuarios();
        } catch (err) {
          showAlert(`Error al revocar acceso: ${err.message}`, 'danger');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  // Funciones de formateo visual para roles
  const getRoleStyle = (rol) => {
    const r = (rol || '').toLowerCase();
    switch (r) {
      case 'superadmin':
        return {
          backgroundColor: '#fef3c7',
          color: '#d97706',
          borderColor: '#fcd34d'
        };
      case 'admin':
        return {
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderColor: '#fca5a5'
        };
      case 'supervisor':
        return {
          backgroundColor: '#f3e8ff',
          color: '#7c3aed',
          borderColor: '#d8b4fe'
        };
      case 'agente':
        return {
          backgroundColor: '#dbeafe',
          color: '#2563eb',
          borderColor: '#93c5fd'
        };
      case 'editor':
        return {
          backgroundColor: '#e0e7ff',
          color: '#4f46e5',
          borderColor: '#c7d2fe'
        };
      default: // lector
        return {
          backgroundColor: '#f1f5f9',
          color: '#475569',
          borderColor: '#cbd5e1'
        };
    }
  };

  return (
    <div className="row g-4">
      {/* Panel Izquierdo: Agregar Nuevo Operador & Plantilla de Correo */}
      <div className="col-lg-4 d-flex flex-column gap-4">
        <div className="card border-0 bg-white p-4 rounded-4 shadow-sm">
          <h5 className="fw-bold mb-3 text-dark d-flex align-items-center">
            <i className="bi bi-person-plus-fill me-2 text-primary"></i> Agregar Nuevo Operador
          </h5>
          <p className="small text-muted mb-4">
            El operador recibirá acceso inmediato al iniciar sesión con su correo corporativo si se encuentra invitado.
          </p>

          <form onSubmit={handleAddOperator}>
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted mb-1">Correo Electrónico</label>
              <input
                type="email"
                className="form-control rounded-3"
                placeholder="ej: operador@luxia.com"
                value={targetEmail}
                onChange={e => setTargetEmail(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold text-muted mb-1">Equipo de Trabajo</label>
              <select
                className="form-select rounded-3"
                value={
                  (targetRol === 'admin' || targetRol === 'superadmin') 
                    ? 'Global' 
                    : targetEquipo
                }
                onChange={e => setTargetEquipo(e.target.value)}
                disabled={saving || targetRol === 'admin' || targetRol === 'superadmin'}
              >
                {getAvailableEquiposForRole(targetRol).map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                ))}
              </select>
              {(targetRol === 'admin' || targetRol === 'superadmin') && (
                <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                  <i className="bi bi-info-circle me-1"></i> Admins y SuperAdmins pertenecen únicamente al equipo Global.
                </small>
              )}
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold text-muted mb-1">Rol de Permisos</label>
              <select
                className="form-select rounded-3"
                value={targetRol}
                onChange={e => {
                  const newRol = e.target.value;
                  setTargetRol(newRol);
                  if (newRol === 'admin' || newRol === 'superadmin') {
                    setTargetEquipo('Global');
                  } else if (newRol === 'agente' || newRol === 'supervisor') {
                    setTargetEquipo('Adquisicion');
                  } else if (newRol === 'lector' || newRol === 'editor') {
                    setTargetEquipo('Global');
                  }
                }}
                disabled={saving}
              >
                <option value="lector">Lector (Solo Lectura)</option>
                <option value="agente">Asesor Técnico Comercial</option>
                <option value="supervisor">Supervisor Comercial</option>
                <option value="editor">Editor Operativo</option>
                <option value="admin">Administrador</option>
                {hasPermission('actions', 'promover_superadmin') && <option value="superadmin">SuperAdmin</option>}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 rounded-pill py-2 fw-bold shadow-sm"
              disabled={saving || !targetEmail}
            >
              {saving ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Procesando...</>
              ) : (
                <><i className="bi bi-person-check me-2"></i> Añadir Operador</>
              )}
            </button>
          </form>
        </div>

        {/* Plantilla de Invitación por Correo */}
        <div className="card border-0 bg-white p-4 rounded-4 shadow-sm">
          <h5 className="fw-bold mb-3 text-dark d-flex align-items-center">
            <i className="bi bi-envelope-paper-fill me-2 text-primary"></i> Plantilla de Invitación
          </h5>
          <p className="small text-muted mb-4" style={{ fontSize: '0.8rem' }}>
            Configura el correo que recibirá el operador. Puedes usar: <code>{"{{email}}"}</code>, <code>{"{{rol}}"}</code>, <code>{"{{equipo}}"}</code>, <code>{"{{invitedBy}}"}</code>.
          </p>

          {loadingTemplate ? (
            <div className="text-center py-3 text-muted small">
              <div className="spinner-border spinner-border-sm text-primary me-2"></div>
              Cargando plantilla...
            </div>
          ) : (
            <form onSubmit={handleSaveTemplate}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-muted mb-1">Asunto del Correo</label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  value={templateSubject}
                  onChange={e => setTemplateSubject(e.target.value)}
                  required
                  disabled={savingTemplate}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-bold text-muted mb-1">Cuerpo del Correo</label>
                <textarea
                  className="form-control rounded-3"
                  rows="6"
                  value={templateBody}
                  onChange={e => setTemplateBody(e.target.value)}
                  required
                  disabled={savingTemplate}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-outline-primary w-100 rounded-pill py-2 fw-bold"
                disabled={savingTemplate}
              >
                {savingTemplate ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                ) : (
                  <><i className="bi bi-save me-2"></i> Guardar Plantilla</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Panel Derecho: Lista de Usuarios */}
      <div className="col-lg-8">
        <div className="card border-0 bg-white p-4 rounded-4 shadow-sm h-100 d-flex flex-column">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <h5 className="fw-bold mb-0 text-dark">Usuarios Registrados en el Sistema</h5>
              <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 fw-bold small">
                {filteredUsuariosList.length} {filteredUsuariosList.length === 1 ? 'usuario' : 'usuarios'}
              </span>
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className="input-group input-group-sm" style={{ width: '230px' }}>
                <span className="input-group-text bg-light border-end-0 rounded-start-pill text-muted">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control bg-light border-start-0 rounded-end-pill shadow-none"
                  placeholder="Buscar por email, equipo..."
                  value={userSearchTerm}
                  onChange={e => setUserSearchTerm(e.target.value)}
                  style={{ fontSize: '0.78rem' }}
                />
              </div>
              <button 
                className="btn btn-light rounded-circle shadow-sm p-2 d-flex align-items-center justify-content-center" 
                onClick={() => {
                  showAlert('Refrescando listado...', 'info');
                }}
                style={{ width: '34px', height: '34px' }}
                title="Refrescar Lista"
              >
                <i className="bi bi-arrow-clockwise text-muted"></i>
              </button>
            </div>
          </div>

          <div className="table-responsive flex-grow-1" style={{ maxHeight: '780px', minHeight: '520px', overflowY: 'auto' }}>
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr className="text-muted small fw-bold border-bottom">
                  <th className="pb-3 border-0">Email</th>
                  <th className="pb-3 border-0">Equipo</th>
                  <th className="pb-3 border-0">Rol</th>
                  <th className="pb-3 border-0">Estado Email</th>
                  <th className="pb-3 border-0 text-end">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                      Cargando operadores...
                    </td>
                  </tr>
                ) : filteredUsuariosList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      {userSearchTerm ? 'No se encontraron usuarios coincidentes con la búsqueda.' : 'No hay operadores registrados en la base de datos.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsuariosList.map(u => {
                    const styleRol = getRoleStyle(u.rol);
                    return (
                      <tr key={u.id}>
                        {/* Email y status */}
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-semibold text-dark small">{u.email || u.id}</span>
                            {u.isPending && (
                              <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 rounded-pill px-2" style={{ fontSize: '0.65rem' }}>
                                Invitado
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Dropdown Equipo */}
                        <td>
                          <select
                            className="form-select form-select-sm border shadow-none bg-light bg-opacity-25 rounded-3 fw-bold"
                            value={
                              (u.rol === 'admin' || u.rol === 'superadmin') 
                                ? 'Global' 
                                : (u.equipo || 'Global')
                            }
                            onChange={e => handleUpdateEquipo(u, e.target.value)}
                            disabled={
                              saving || 
                              u.rol === 'admin' || 
                              u.rol === 'superadmin'
                            }
                            style={{ minWidth: '130px', fontSize: '0.8rem' }}
                            title={
                              (u.rol === 'admin' || u.rol === 'superadmin') 
                                ? 'Los usuarios con rol Admin o SuperAdmin pertenecen únicamente al equipo Global.' 
                                : ''
                            }
                          >
                            {getAvailableEquiposForRole(u.rol).map(eq => (
                              <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                            ))}
                          </select>
                        </td>

                        {/* Dropdown Rol Custom Badge */}
                        <td>
                          <select
                            className="form-select form-select-sm fw-bold rounded-pill text-center px-3"
                            value={u.rol || 'lector'}
                            onChange={e => handleUpdateRol(u, e.target.value)}
                            disabled={saving}
                            style={{
                              ...styleRol,
                              minWidth: '130px',
                              fontSize: '0.8rem',
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="lector" style={{ background: '#fff', color: '#000' }}>Lector</option>
                            <option value="agente" style={{ background: '#fff', color: '#000' }}>Asesor Comercial</option>
                            <option value="supervisor" style={{ background: '#fff', color: '#000' }}>Supervisor</option>
                            <option value="editor" style={{ background: '#fff', color: '#000' }}>Editor</option>
                            <option value="admin" style={{ background: '#fff', color: '#000' }}>Admin</option>
                            {hasPermission('actions', 'promover_superadmin') && (
                              <option value="superadmin" style={{ background: '#fff', color: '#000' }}>SuperAdmin</option>
                            )}
                          </select>
                        </td>

                        {/* Estado Email */}
                        <td>
                          {(() => {
                            const status = getEmailStatus(u.email || u.id);
                            if (!status) return <span className="text-muted small">-</span>;
                            return (
                              <span 
                                className={`small d-inline-flex align-items-center gap-1 ${status.class}`} 
                                title={status.info || 'Haz clic para más detalles'}
                                style={{ cursor: status.info ? 'pointer' : 'default' }}
                                onClick={() => {
                                  if (status.info) {
                                    showAlert(status.info, status.label === 'Error' ? 'danger' : 'info');
                                  }
                                }}
                              >
                                <i className={`bi ${status.icon}`}></i>
                                {status.label}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Acción eliminar */}
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-danger border-0 rounded-circle"
                            onClick={() => handleDeleteUser(u)}
                            disabled={saving || (u.id === currentUser?.uid)}
                            title="Revocar Acceso"
                          >
                            <i className="bi bi-trash-fill fs-6"></i>
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

      {/* Modal de confirmación glassmorphic premium */}
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
