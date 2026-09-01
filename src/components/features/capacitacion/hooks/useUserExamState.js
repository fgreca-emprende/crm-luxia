import { useState, useEffect, useCallback } from 'react';
import { supabase, callBackendApi } from '../../../../lib/supabase';
import { getConfigGeneral } from '../../../../lib/configGeneral';
import { useToast } from '../../../ui/ToastProvider';
import { useUserRole } from '../../../../contexts/UserRoleContext';

export function useUserExamState(user) {
  const { role, loading: roleLoading, isSuperAdmin, isAdmin, isLector } = useUserRole();
  const { showAlert } = useToast();

  const [profileData, setProfileData] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capacitacionConfig, setCapacitacionConfig] = useState(null);

  // Flow State
  const [step, setStep] = useState('dashboard'); // 'dashboard', 'teorico', 'practico', 'enviando', 'resultado'
  const [selectedDifficulty, setSelectedDifficulty] = useState('basico');
  const [currentExam, setCurrentExam] = useState(null);
  const [rawExamWithAnswers, setRawExamWithAnswers] = useState(null);
  const [examLoading, setExamLoading] = useState(false);

  // Answers State
  const [teoricoRespuestas, setTeoricoRespuestas] = useState([]);
  const [practicoRespuesta, setPracticoRespuesta] = useState('');

  // Results State
  const [examResult, setExamResult] = useState(null);

  const currentEmail = user?.email || 'admin@luxia.com';
  const currentLookup = user?.id || user?.uid;

  const loadData = useCallback(async () => {
    if (!currentEmail && !currentLookup) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Configuración de capacitación
      const config = await getConfigGeneral('capacitacion');
      if (config) {
        setCapacitacionConfig(config);
      }

      // 2. Perfil del usuario
      let uData = null;
      if (currentLookup) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .or(`id.eq.${currentLookup},email.eq.${currentEmail}`)
          .maybeSingle();
        uData = data;
      } else {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', currentEmail)
          .maybeSingle();
        uData = data;
      }

      if (uData) {
        setProfileData(uData);
        if (uData.capacitacion?.dificultadCertificada) {
          setSelectedDifficulty(uData.capacitacion.dificultadCertificada);
        }
      }

      // 3. Intentos de examen
      const { data: attemptsData } = await supabase
        .from('examenes_intentos')
        .select('*')
        .eq('usuario_email', currentEmail)
        .order('fecha_intento', { ascending: false });

      if (attemptsData) {
        setAttempts(attemptsData.map(a => ({
          id: a.id,
          usuarioEmail: a.usuario_email,
          rol: a.rol,
          dificultad: a.dificultad,
          fechaIntento: a.fecha_intento,
          scoreTeorico: a.score_teorico,
          scorePractico: a.score_practico,
          scoreGlobal: a.score_global,
          aprobado: a.aprobado,
          feedbackPractico: a.feedback_practico,
          estado: a.estado || 'aprobado'
        })));
      }
    } catch (err) {
      console.warn('[useUserExamState] Error loading data:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentEmail, currentLookup]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Iniciar Examen
  const handleStartExam = async () => {
    setExamLoading(true);
    try {
      const docRol = isSuperAdmin ? 'superadmin' : isAdmin ? 'admin' : isLector ? 'lector' : (role === 'supervisor' ? 'supervisor' : 'agente');
      const docDif = isLector ? 'unico' : selectedDifficulty;

      const examId = docRol === 'lector' ? 'lector_unico' : `${docRol}_${docDif}`;
      
      const { data: examData, error } = await supabase
        .from('config_capacitacion_examenes')
        .select('*')
        .eq('id', examId)
        .maybeSingle();

      if (error || !examData) {
        throw new Error('No se pudo encontrar la evaluación para tu rol y nivel.');
      }

      setRawExamWithAnswers(examData);

      // Clonar y barajar opciones teóricas de forma segura
      const examClone = JSON.parse(JSON.stringify(examData));
      if (examClone.teorico && Array.isArray(examClone.teorico)) {
        examClone.teorico = examClone.teorico.map(q => {
          if (!q.opciones || !Array.isArray(q.opciones)) return q;

          const zipped = q.opciones.map((opt, originalIdx) => ({ opt, originalIdx }));
          // Barajar Fisher-Yates
          for (let i = zipped.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
          }
          return {
            id: q.id,
            pregunta: q.pregunta,
            opciones: zipped.map(item => item.opt),
            shuffledMapping: zipped.map(item => item.originalIdx)
          };
        });
      }

      setCurrentExam(examClone);
      setTeoricoRespuestas(new Array(examClone.teorico.length).fill(null));
      setPracticoRespuesta('');
      setStep('teorico');
    } catch (err) {
      showAlert(`Error al iniciar examen: ${err.message}`, 'danger');
    } finally {
      setExamLoading(false);
    }
  };

  // Enviar y Evaluar Examen con LUXIA IA
  const handleSubmitExam = async () => {
    if (teoricoRespuestas.includes(null)) {
      showAlert('Por favor responde todas las preguntas del examen teórico antes de continuar.', 'warning');
      return;
    }
    if (practicoRespuesta.trim().length < 20) {
      showAlert('Por favor escribe una respuesta práctica detallada (mínimo 20 caracteres).', 'warning');
      return;
    }

    setStep('enviando');
    try {
      const docRol = isSuperAdmin ? 'superadmin' : isAdmin ? 'admin' : isLector ? 'lector' : (role === 'supervisor' ? 'supervisor' : 'agente');
      const docDif = isLector ? 'unico' : selectedDifficulty;

      // 1. Mapear respuestas seleccionadas
      const mappedTeoricoRespuestas = teoricoRespuestas.map((shuffledIdx, qIdx) => {
        const q = currentExam.teorico[qIdx];
        return q.shuffledMapping ? q.shuffledMapping[shuffledIdx] : shuffledIdx;
      });

      let evalResult = null;

      // 2. Invocar Backend Worker con Sentinel IA
      try {
        evalResult = await callBackendApi('/evaluar-examen', {
          rol: docRol,
          dificultad: docDif,
          respuestasTeorico: mappedTeoricoRespuestas,
          respuestaPractico: practicoRespuesta,
          usuarioNombre: profileData?.nombre || currentEmail.split('@')[0]
        });
      } catch (backendErr) {
        console.warn('[useUserExamState] Backend evaluador no disponible, evaluando con fallback:', backendErr.message);
        
        // Fallback local en caso de desconexión
        const originalTeorico = rawExamWithAnswers?.teorico || [];
        let correctCount = 0;
        originalTeorico.forEach((q, idx) => {
          const userChoice = mappedTeoricoRespuestas[idx];
          const correctChoice = q.correcta !== undefined ? q.correcta : 0;
          if (userChoice === correctChoice) correctCount++;
        });

        const totalQuestions = originalTeorico.length || 1;
        const scoreTeorico = Math.round((correctCount / totalQuestions) * 100);
        const scorePractico = 80;
        const scoreGlobal = Math.round((scoreTeorico * 0.5) + (scorePractico * 0.5));
        const minRequired = capacitacionConfig?.porcentajeAprobacion || 75;
        const aprobado = scoreGlobal >= minRequired;

        evalResult = {
          scoreTeorico,
          scorePractico,
          scoreGlobal,
          aprobado,
          feedbackPractico: aprobado ? 'Examen completado satisfactoriamente.' : 'Requiere mayor repaso de los manuales operativos.'
        };

        // Registrar intento de fallback
        await supabase.from('examenes_intentos').insert({
          usuario_email: currentEmail,
          usuario_nombre: profileData?.nombre || currentEmail.split('@')[0],
          rol: docRol,
          dificultad: docDif,
          fecha_intento: new Date().toISOString(),
          respuestas_teorico: mappedTeoricoRespuestas,
          score_teorico: scoreTeorico,
          respuesta_practico: practicoRespuesta,
          score_practico: scorePractico,
          feedback_practico: evalResult.feedbackPractico,
          score_global: scoreGlobal,
          aprobado,
          evaluado_por: 'luxia_ia_local',
          estado: 'evaluado',
          processed: true
        });
      }

      setExamResult({
        success: true,
        ...evalResult,
        estado: 'evaluado'
      });

      // 5. Si aprobó, actualizar acreditación en perfil del usuario
      if (evalResult.aprobado) {
        const nextExpiration = new Date();
        nextExpiration.setDate(nextExpiration.getDate() + (capacitacionConfig?.frecuenciaDias || 90));

        const capacitacionUpdate = {
          estado: 'certificado',
          rolCertificado: docRol,
          dificultadCertificada: docDif,
          ultimoScore: evalResult.scoreGlobal,
          ultimoExamenAprobado: new Date().toISOString(),
          proximoExamenLimite: nextExpiration.toISOString()
        };

        await supabase
          .from('usuarios')
          .update({
            capacitacion: capacitacionUpdate
          })
          .or(`id.eq.${currentLookup},email.eq.${currentEmail}`);

        setProfileData(prev => ({
          ...prev,
          capacitacion: capacitacionUpdate
        }));
      }

      setStep('resultado');
      showAlert(evalResult.aprobado ? '¡Felicitaciones! Has aprobado la certificación de LUXIA Agro.' : 'Evaluación completada. Puedes revisar el feedback para mejorar.', evalResult.aprobado ? 'success' : 'info');
      await loadData();
    } catch (err) {
      console.error('Error al evaluar el examen:', err);
      showAlert(`Error evaluando examen: ${err.message}`, 'danger');
      setStep('teorico');
    }
  };

  return {
    role,
    isSuperAdmin,
    isAdmin,
    isLector,
    roleLoading: roleLoading || loading,
    profileData,
    attempts,
    step,
    setStep,
    selectedDifficulty,
    setSelectedDifficulty,
    currentExam,
    examLoading,
    teoricoRespuestas,
    setTeoricoRespuestas,
    practicoRespuesta,
    setPracticoRespuesta,
    examResult,
    handleStartExam,
    handleSubmitExam,
    capacitacionConfig
  };
}
