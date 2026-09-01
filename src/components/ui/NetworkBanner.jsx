import React, { useState, useEffect } from 'react';

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const handleBackendError = () => setBackendDown(true);
    const handleBackendRecover = () => setBackendDown(false);
    
    window.addEventListener('backend-unavailable', handleBackendError);
    window.addEventListener('backend-recovered', handleBackendRecover);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('backend-unavailable', handleBackendError);
      window.removeEventListener('backend-recovered', handleBackendRecover);
    };
  }, []);

  if (!isOffline && !backendDown) return null;

  return (
    <div className="bg-danger text-white text-center py-2 px-3 fw-bold sticky-top" style={{ zIndex: 9999, fontSize: '0.9rem' }}>
      <i className="bi bi-wifi-off me-2"></i>
      {isOffline 
        ? "No tienes conexión a Internet. Estás navegando en modo offline." 
        : "Problemas de conexión con el servidor de base de datos. La aplicación está en modo de solo lectura."}
    </div>
  );
}
