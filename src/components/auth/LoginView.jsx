import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LuxiaLogo } from '../ui/LuxiaLogo';
import { useToast } from '../ui/ToastProvider';

export function LoginView({ onLoginSuccess }) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
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
      <div className="text-center mt-4 card-premium mx-auto shadow-lg p-4 p-md-5 rounded-4" style={{ maxWidth: '480px' }}>
        <div className="mb-3 d-flex justify-content-center">
          <LuxiaLogo height={42} showSubtitle={true} subtitle="ENTERPRISE CRM" />
        </div>
        <p className="small mb-4" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.82rem', lineHeight: '1.4' }}>
          Innovación y sustentabilidad al servicio de tus cultivos · Plataforma de Gestión B2B
        </p>

        <form onSubmit={handleLogin} className="text-start">
          <div className="mb-3">
            <label className="form-label small fw-bold text-muted">Correo Corporativo</label>
            <div className="input-group">
              <span className="input-group-text bg-transparent border-end-0"><i className="bi bi-envelope"></i></span>
              <input 
                type="email" 
                className="form-control border-start-0" 
                placeholder="admin@luxia.com"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label small fw-bold text-muted">Contraseña</label>
            <div className="input-group">
              <span className="input-group-text bg-transparent border-end-0"><i className="bi bi-key"></i></span>
              <input 
                type="password" 
                className="form-control border-start-0" 
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-100 py-2 fw-bold shadow-sm rounded-3 mb-3" disabled={loginLoading}>
            {loginLoading ? (
              <span><span className="spinner-border spinner-border-sm me-2"></span>Iniciando sesión...</span>
            ) : (
              <span><i className="bi bi-box-arrow-in-right me-2"></i> Ingresar al Sistema</span>
            )}
          </button>

          <button type="button" className="btn btn-outline-secondary w-100 py-2 rounded-3 mb-4" onClick={handleGoogleOAuthLogin}>
            <i className="bi bi-google me-2"></i> Continuar con Google
          </button>
        </form>

        {/* DEMO BUTTONS — Solo visibles en entorno dev local */}
        {import.meta.env.DEV && (
          <div className="border-top pt-3 text-start">
            <span className="small text-muted fw-bold d-block mb-2"><i className="bi bi-person-badge me-1"></i> Accesos Rápidos (Solo Dev):</span>
            <div className="d-flex gap-2 flex-wrap">
              <button 
                type="button"
                className="btn btn-sm btn-outline-primary rounded-pill px-3"
                onClick={() => { setLoginEmail('admin@luxia.com'); setLoginPassword('luxia2026'); }}
              >
                👑 SuperAdmin
              </button>
              <button 
                type="button"
                className="btn btn-sm btn-outline-success rounded-pill px-3"
                onClick={() => { setLoginEmail('supervisor@luxia.com'); setLoginPassword('luxia2026'); }}
              >
                👔 Supervisor
              </button>
              <button 
                type="button"
                className="btn btn-sm btn-outline-info rounded-pill px-3"
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
