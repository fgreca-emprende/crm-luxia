import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logSystemEvent } from '../../lib/telemetry';
import { LuxiaLogo } from '../ui/LuxiaLogo';
import { useToast } from '../ui/ToastProvider';

export function LoginView({ onLoginSuccess }) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const { showAlert } = useToast();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    try {
      const email = loginEmail.trim().toLowerCase();
      const password = loginPassword.trim();

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (data?.user) {
        const nowIso = new Date().toISOString();
        const hoy = nowIso.split('T')[0];

        // 1. Actualizar metadata de presencia y último login del usuario
        try {
          const { data: currentProfile } = await supabase
            .from('usuarios')
            .select('presencia')
            .eq('id', data.user.id)
            .maybeSingle();

          const prevPresencia = currentProfile?.presencia || {};
          await supabase.from('usuarios').update({
            presencia: {
              ...prevPresencia,
              estado: 'disponible',
              desdeIso: nowIso,
              ultimo_login: nowIso
            },
            estado_presencia: 'Conectado',
            updated_at: nowIso
          }).eq('id', data.user.id);

          // 2. Registrar en usuario_uso_diario
          await supabase.from('usuario_uso_diario').upsert({
            user_id: data.user.id,
            fecha: hoy,
            minutos_conectado: 1,
            last_active_at: nowIso
          }, { onConflict: 'user_id,fecha' });

          // 3. Registrar evento de telemetría / auditoría
          await logSystemEvent(data.user, 'login', { metodo: 'password' });
        } catch (postLoginErr) {
          console.warn('[Login Telemetry] Error registrando login:', postLoginErr);
        }

        onLoginSuccess({ ...data.user, uid: data.user.id });
        showAlert(`Bienvenido ${data.user.email}`, 'success');
      }
    } catch (err) {
      console.error('[Login Error]', err);
      showAlert('Credenciales inválidas o cuenta inexistente.', 'danger');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleOAuthLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      showAlert(err.message || 'Error iniciando sesión con Google.', 'danger');
    }
  };

  return (
    <div className="container mt-5">
      <div 
        className="text-center mt-4 card-premium mx-auto shadow-lg p-4 p-md-5 rounded-4" 
        style={{ 
          maxWidth: '460px',
          border: '1px solid var(--apple-border)',
          boxShadow: 'var(--apple-shadow-floating)'
        }}
      >
        <div className="mb-3 d-flex justify-content-center">
          <LuxiaLogo height={42} showSubtitle={true} subtitle="ENTERPRISE CRM" />
        </div>
        <p className="small mb-4" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.82rem', lineHeight: '1.45' }}>
          Innovación y sustentabilidad al servicio de tus cultivos · Plataforma de Gestión B2B
        </p>

        <form onSubmit={handleLogin} className="text-start">
          {/* Correo Corporativo Input */}
          <div className="mb-3">
            <label className="form-label small fw-semibold" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.8rem' }}>
              Correo Corporativo
            </label>
            <div className="apple-input-group">
              <span className="apple-input-icon-lead">
                <i className="bi bi-envelope"></i>
              </span>
              <input 
                type="email" 
                className="apple-input-field" 
                placeholder="nombre@luxia.com"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Contraseña Input con Toggle Ver/Ocultar */}
          <div className="mb-4">
            <label className="form-label small fw-semibold" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.8rem' }}>
              Contraseña
            </label>
            <div className="apple-input-group">
              <span className="apple-input-icon-lead">
                <i className="bi bi-key"></i>
              </span>
              <input 
                type={showPassword ? "text" : "password"} 
                className="apple-input-field" 
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className="apple-input-btn-action" 
                onClick={() => setShowPassword(prev => !prev)}
                tabIndex={-1}
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Botón Ingresar */}
          <button 
            type="submit" 
            className="apple-btn apple-btn-primary w-100 py-2.5 fw-bold mb-3" 
            style={{ borderRadius: 'var(--apple-radius-sm)', fontSize: '0.92rem' }}
            disabled={loginLoading}
          >
            {loginLoading ? (
              <span><span className="spinner-border spinner-border-sm me-2"></span>Iniciando sesión...</span>
            ) : (
              <span><i className="bi bi-box-arrow-in-right me-2"></i> Ingresar al Sistema</span>
            )}
          </button>

          {/* Botón Google OAuth */}
          <button 
            type="button" 
            className="apple-btn apple-btn-secondary w-100 py-2.5 mb-4" 
            style={{ borderRadius: 'var(--apple-radius-sm)', fontSize: '0.9rem' }}
            onClick={handleGoogleOAuthLogin}
          >
            <i className="bi bi-google me-2"></i> Continuar con Google
          </button>
        </form>

        {/* DEMO BUTTONS — Solo visibles en entorno dev local */}
        {import.meta.env.DEV && (
          <div className="border-top pt-3 text-start" style={{ borderColor: 'var(--apple-border)' }}>
            <span className="small fw-semibold d-block mb-2" style={{ color: 'var(--apple-text-tertiary)', fontSize: '0.74rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              <i className="bi bi-person-badge me-1"></i> Accesos Rápidos (Solo Dev):
            </span>
            <div className="d-flex gap-2 flex-wrap">
              <button 
                type="button"
                className="apple-btn apple-btn-secondary py-1 px-3"
                style={{ fontSize: '0.78rem', borderRadius: 'var(--apple-radius-pill)' }}
                onClick={() => { setLoginEmail('admin@luxia.com'); setLoginPassword('luxia2026'); }}
              >
                👑 SuperAdmin
              </button>
              <button 
                type="button"
                className="apple-btn apple-btn-secondary py-1 px-3"
                style={{ fontSize: '0.78rem', borderRadius: 'var(--apple-radius-pill)' }}
                onClick={() => { setLoginEmail('supervisor@luxia.com'); setLoginPassword('luxia2026'); }}
              >
                👔 Supervisor
              </button>
              <button 
                type="button"
                className="apple-btn apple-btn-secondary py-1 px-3"
                style={{ fontSize: '0.78rem', borderRadius: 'var(--apple-radius-pill)' }}
                onClick={() => { setLoginEmail('agente@luxia.com'); setLoginPassword('luxia2026'); }}
              >
                💼 Agente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

