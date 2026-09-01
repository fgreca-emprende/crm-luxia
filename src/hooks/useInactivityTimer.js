import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getConfigGeneral } from '../lib/configGeneral';

export function useInactivityTimer(user, setUser, showAlert) {
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(30);
  const [securityConfig, setSecurityConfig] = useState({ habilitado: false, timeoutMinutos: 15 });
  const inactivityTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    if (!user || !securityConfig.habilitado) return;

    const timeoutMs = (securityConfig.timeoutMinutos * 60 * 1000) - (30 * 1000);
    
    inactivityTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
      setWarningCountdown(30);
      
      let secondsLeft = 30;
      countdownIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        setWarningCountdown(secondsLeft);
        if (secondsLeft <= 0) {
          clearInterval(countdownIntervalRef.current);
          if (user?.uid) {
            window.sessionStorage.removeItem(`dismissed_fab_manual_${user.uid}`);
            window.sessionStorage.removeItem(`dismissed_fab_support_${user.uid}`);
          }
          supabase.auth.signOut().then(() => {
            setUser(null);
            showAlert('Tu sesión ha expirado por inactividad por motivos de seguridad.', 'warning');
          });
          setShowInactivityWarning(false);
        }
      }, 1000);
    }, Math.max(0, timeoutMs));
  }, [user, securityConfig, showAlert, setUser]);

  const handleResetInactivity = () => {
    setShowInactivityWarning(false);
    setWarningCountdown(30);
    resetTimer();
  };

  const handleInactivityLogout = async () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setShowInactivityWarning(false);
    if (user?.uid || user?.id) {
      const uId = user.uid || user.id;
      window.sessionStorage.removeItem(`dismissed_fab_manual_${uId}`);
      window.sessionStorage.removeItem(`dismissed_fab_support_${uId}`);
    }
    await supabase.auth.signOut();
    setUser(null);
    showAlert('Sesión cerrada correctamente.', 'success');
  };

  useEffect(() => {
    if (!user) {
      setSecurityConfig({ habilitado: false, timeoutMinutos: 15 });
      setShowInactivityWarning(false);
      return;
    }

    const loadSecurityConfig = async () => {
      try {
        const conf = await getConfigGeneral('security_config');
        if (conf) {
          setSecurityConfig(conf);
        } else {
          setSecurityConfig({ habilitado: true, timeoutMinutos: 30 });
        }
      } catch {
        setSecurityConfig({ habilitado: true, timeoutMinutos: 30 });
      }
    };
    loadSecurityConfig();
  }, [user]);

  useEffect(() => {
    if (!user || !securityConfig.habilitado) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    resetTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => {
      setShowInactivityWarning(prev => {
        if (!prev) {
          resetTimer();
        }
        return prev;
      });
    };

    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, securityConfig, resetTimer]);

  return {
    showInactivityWarning,
    warningCountdown,
    handleResetInactivity,
    handleInactivityLogout
  };
}
