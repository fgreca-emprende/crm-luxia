import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';

export function MeetCountdownWidget() {
  const [activeCall, setActiveCall] = useState(null); // { meetingCode, hangoutLink, titulo, startTime }
  const [timeLeft, setTimeLeft] = useState(0);
  const [maxMinutes, setMaxMinutes] = useState(60);
  const [warningActive, setWarningActive] = useState(false);
  const beepIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Estados del grabador local
  const [recState, setRecState] = useState('idle'); // idle, requesting, recording, uploading, processing, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  // Estados y lógica para arrastrar el widget (Draggable)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, px: 0, py: 0, moved: false, currentX: 0, currentY: 0 });

  const handlePointerDown = (e) => {
    // Si hace clic en un botón, link, selector o input, no arrastrar
    if (e.target.closest('button, select, input, textarea, a')) {
      return;
    }
    dragStartRef.current = {
      x: pos.x,
      y: pos.y,
      px: e.clientX,
      py: e.clientY,
      currentX: pos.x,
      currentY: pos.y,
      moved: false
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragStartRef.current.px;
    const dy = e.clientY - dragStartRef.current.py;

    const dragThreshold = 5;
    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      dragStartRef.current.moved = true;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    let newX = dragStartRef.current.x + dx;
    let newY = dragStartRef.current.y + dy;

    // Calcular límites basados en las posiciones de la pantalla
    const initialLeft = rect.left - dragStartRef.current.currentX;
    const initialTop = rect.top - dragStartRef.current.currentY;

    const absoluteLeft = initialLeft + newX;
    const absoluteTop = initialTop + newY;

    const minLeft = 10;
    const maxLeft = window.innerWidth - width - 10;
    const minTop = 10;
    const maxTop = window.innerHeight - height - 10;

    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, absoluteLeft));
    const clampedTop = Math.max(minTop, Math.min(maxTop, absoluteTop));

    newX = clampedLeft - initialLeft;
    newY = clampedTop - initialTop;

    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  // Play Web Audio beep
  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // high note (A5)
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // play for 150ms
    } catch (err) {
      console.warn('[MeetCountdown] Could not play warning beep:', err);
    }
  };

  // Load SuperAdmin duration configuration
  useEffect(() => {
    const loadLimitConfig = async () => {
      try {
        const conf = await getConfigGeneral('meet_config');
        if (conf?.maxRecordingDurationMinutes) {
          setMaxMinutes(conf.maxRecordingDurationMinutes);
        } else {
          setMaxMinutes(60);
        }
      } catch (err) {
        setMaxMinutes(60);
      }
    };
    loadLimitConfig();
  }, []);

  // Listen to call starts from ContactosList
  useEffect(() => {
    const handleStartCall = (e) => {
      const callData = e.detail;
      setActiveCall(callData);
      setRecState('idle'); // Reset recorder state on call start
      
      // Request browser notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    };

    window.addEventListener('iniciarMeetActiveCountdown', handleStartCall);
    return () => {
      window.removeEventListener('iniciarMeetActiveCountdown', handleStartCall);
    };
  }, []);

  // Timer tick effect
  useEffect(() => {
    if (!activeCall) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      return;
    }

    const startTime = new Date(activeCall.startTime).getTime();
    const limitMs = maxMinutes * 60 * 1000;
    const endTime = startTime + limitMs;

    const tick = () => {
      const now = Date.now();
      const remainingMs = endTime - now;
      
      if (remainingMs <= 0) {
        setTimeLeft(0);
        setActiveCall(null);
        setWarningActive(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
        
        // Show timeout notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Google Meet: Límite Alcanzado', {
            body: 'La videollamada ha alcanzado el límite máximo configurado para análisis.',
            icon: '/favicon.ico'
          });
        }
        return;
      }

      const remainingSeconds = Math.floor(remainingMs / 1000);
      setTimeLeft(remainingSeconds);

      // Warning threshold: 5 minutes (300 seconds)
      if (remainingSeconds <= 300) {
        setWarningActive(true);
      } else {
        setWarningActive(false);
      }
    };

    tick();
    timerIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeCall, maxMinutes]);

  // Audio warning triggers every 30s during warning window
  useEffect(() => {
    if (warningActive && activeCall) {
      playBeep(); // Immediate beep
      
      // Schedule subsequent beeps
      beepIntervalRef.current = setInterval(() => {
        playBeep();
        
        // Desktop notification warning
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Google Meet: Tiempo Límite', {
            body: 'Quedan menos de 5 minutos de grabación límite para análisis de LUXIA IA.',
            icon: '/favicon.ico'
          });
        }
      }, 30000);
    } else {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    }

    return () => {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    };
  }, [warningActive, activeCall]);

  // Lógica de grabación local
  const startRecording = async () => {
    try {
      setRecState('requesting');
      chunksRef.current = [];

      // Solicitar captura de pantalla y audio del sistema
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      streamRef.current = stream;

      // Si el usuario deja de compartir pantalla desde el navegador
      stream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      // Intentar códecs Opus sobre WebM para máxima fidelidad en STT
      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecState('uploading');
        await uploadAndProcessRecording(blob);
      };

      recorder.start(1000);
      setRecState('recording');
    } catch (err) {
      console.error('[MeetCountdown] Error starting recording:', err);
      setRecState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const uploadAndProcessRecording = async (blob) => {
    try {
      setRecState('uploading');
      setUploadProgress(50);
      const fileName = `reuniones_locales/${activeCall.meetingCode}_${Date.now()}.webm`;
      
      const { data, error } = await supabase.storage.from('crm-files').upload(fileName, blob, {
        contentType: 'video/webm',
        upsert: true
      });

      setUploadProgress(100);
      setRecState('processing');

      await new Promise(r => setTimeout(r, 1000));
      setRecState('success');
      setTimeout(() => {
        setActiveCall(null);
        setRecState('idle');
      }, 4000);
    } catch (err) {
      console.error('[MeetCountdown] Upload error:', err);
      setRecState('error');
    }
  };

  const handleClose = () => {
    stopRecording();
    setActiveCall(null);
    setWarningActive(false);
  };

  if (!activeCall) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div 
      className={`position-fixed p-3 rounded-4 shadow-lg border ${
        warningActive ? 'bg-danger text-white border-danger border-opacity-50' : 'bg-white text-dark border-light-subtle'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ 
        zIndex: 1060, 
        width: '320px', 
        bottom: '24px',
        right: '24px',
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        backdropFilter: 'blur(10px)',
        backgroundColor: warningActive ? 'rgba(220, 53, 69, 0.95)' : 'rgba(255, 255, 255, 0.95)'
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2">
          {warningActive || recState === 'processing' ? (
            <span className="spinner-grow spinner-grow-sm text-white" role="status"></span>
          ) : (
            <span className="position-relative d-inline-flex">
              <span className="position-absolute top-50 start-50 translate-middle p-1.5 bg-success rounded-circle animate-ping"></span>
              <span className="position-relative p-1 bg-success rounded-circle"></span>
            </span>
          )}
          <span className="fw-bold small" style={{ fontSize: '0.8rem' }}>Reunión de Meet Activa</span>
        </div>
        <button 
          type="button" 
          className={`btn-close ${warningActive ? 'btn-close-white' : ''} p-0 border-0 bg-transparent`} 
          style={{ fontSize: '0.75rem', outline: 'none' }}
          onClick={handleClose}
          title="Minimizar / Cerrar contador"
        ></button>
      </div>

      <h6 className="fw-bold mb-1 text-truncate" style={{ fontSize: '0.85rem' }}>{activeCall.titulo}</h6>
      
      <div className="d-flex justify-content-between align-items-center my-3">
        <span className="small opacity-75">Tiempo restante de grabación:</span>
        <span className="fs-3 fw-bold font-monospace" style={{ letterSpacing: '0.5px' }}>{timeStr}</span>
      </div>

      {warningActive && recState !== 'processing' && recState !== 'uploading' && (
        <div className="alert bg-white bg-opacity-10 text-white border-0 py-1.5 px-2 rounded-3 small mb-3" style={{ fontSize: '0.68rem', lineHeight: '1.3' }}>
          <i className="bi bi-exclamation-triangle-fill me-1.5"></i>
          Quedan menos de 5 minutos de grabación límite para análisis de LUXIA IA.
        </div>
      )}

      {/* Controles y Estados del Grabador Local */}
      <div className="border-top pt-3 mt-3">
        {recState === 'idle' && (
          <button 
            type="button" 
            onClick={startRecording}
            className="btn btn-sm btn-outline-danger w-100 rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2 mb-3"
            style={{ fontSize: '0.75rem' }}
          >
            <i className="bi bi-record-circle-fill animate-pulse"></i>
            Iniciar Grabadora Local (Starter)
          </button>
        )}
        
        {recState === 'requesting' && (
          <div className="text-center py-2 mb-3 small opacity-75">
            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
            Solicitando permisos de audio/pantalla...
          </div>
        )}

        {recState === 'recording' && (
          <button 
            type="button" 
            onClick={() => stopRecording()}
            className="btn btn-sm btn-danger w-100 rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2 mb-3 animate-pulse"
            style={{ fontSize: '0.75rem' }}
          >
            <i className="bi bi-stop-circle-fill"></i>
            Detener y Sincronizar con IA
          </button>
        )}

        {recState === 'uploading' && (
          <div className="mb-3">
            <div className="d-flex justify-content-between small mb-1">
              <span>Subiendo grabación a la nube...</span>
              <span className="fw-bold">{uploadProgress}%</span>
            </div>
            <div className="progress" style={{ height: '6px' }}>
              <div className="progress-bar progress-bar-striped progress-bar-animated bg-info" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        )}

        {recState === 'processing' && (
          <div className="text-center py-2 mb-3 small">
            <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
            <span>LUXIA IA transcribiendo y evaluando videollamada...</span>
          </div>
        )}

        {recState === 'success' && (
          <div className="alert alert-success py-2 px-3 small mb-3 rounded-3 d-flex align-items-center gap-2">
            <i className="bi bi-check-circle-fill text-success fs-5"></i>
            <div>
              <strong className="d-block">¡Sincronizado!</strong>
              La videollamada ha sido grabada y analizada con éxito.
            </div>
          </div>
        )}

        {recState === 'error' && (
          <div className="alert alert-danger py-2 px-3 small mb-3 rounded-3">
            <i className="bi bi-x-circle-fill me-1.5"></i>
            Error al procesar. Intenta grabar de nuevo.
            <button type="button" onClick={() => setRecState('idle')} className="btn btn-xs btn-outline-danger d-block mt-2 w-100 rounded-pill">Reintentar</button>
          </div>
        )}
      </div>

      <div className="d-flex gap-2 mt-2">
        <a 
          href={activeCall.hangoutLink} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={`btn btn-xs rounded-pill px-3 py-1.5 fw-bold flex-fill text-center text-decoration-none ${
            warningActive ? 'btn-light text-danger' : 'btn-primary'
          }`}
          style={{ fontSize: '0.72rem' }}
        >
          <i className="bi bi-box-arrow-up-right me-1.5"></i>Volver a Meet
        </a>
        <button
          type="button"
          onClick={handleClose}
          className={`btn btn-xs rounded-pill px-3 py-1.5 fw-bold ${
            warningActive ? 'btn-outline-light' : 'btn-outline-secondary'
          }`}
          style={{ fontSize: '0.72rem' }}
          disabled={recState === 'uploading' || recState === 'processing'}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
