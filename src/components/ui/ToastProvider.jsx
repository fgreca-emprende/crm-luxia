/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const showAlert = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setAlerts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    }, 5000);
  }, []);

  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'success':
        return <i className="bi bi-check-circle-fill text-success fs-4"></i>;
      case 'danger':
      case 'error':
        return <i className="bi bi-exclamation-triangle-fill text-danger fs-4"></i>;
      case 'warning':
        return <i className="bi bi-exclamation-circle-fill text-warning fs-4"></i>;
      case 'info':
        return <i className="bi bi-info-circle-fill text-primary fs-4"></i>;
      default:
        return <i className="bi bi-bell-fill text-secondary fs-4"></i>;
    }
  };

  const getAlertTitle = (type) => {
    switch (type) {
      case 'success':
        return '¡Éxito!';
      case 'danger':
      case 'error':
        return 'Ups, algo salió mal';
      case 'warning':
        return 'Atención';
      case 'info':
        return 'Información';
      default:
        return 'Aviso del Sistema';
    }
  };

  return (
    <ToastContext.Provider value={{ showAlert }}>
      {children}
      <div className="toast-container-premium">
        {alerts.map(alert => (
          <div 
            key={alert.id} 
            className={`toast-premium toast-${alert.type === 'error' ? 'danger' : alert.type}`}
            role="alert"
          >
            <div className="d-flex align-items-center justify-content-center pt-1">
              {getAlertIcon(alert.type)}
            </div>
            <div className="toast-premium-content">
              <div className="toast-premium-title">{getAlertTitle(alert.type)}</div>
              <p className="toast-premium-message">{alert.message}</p>
            </div>
            <button 
              type="button" 
              className="toast-premium-close" 
              onClick={() => removeAlert(alert.id)}
              aria-label="Cerrar"
            >
              <i className="bi bi-x-lg fs-6"></i>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
