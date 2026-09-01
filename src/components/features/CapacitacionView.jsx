import React from 'react';
import { SpinnerPremium } from '../ui/SpinnerPremium';
import { useUserExamState } from './capacitacion/hooks/useUserExamState';
import { ExamDashboard } from './capacitacion/components/ExamDashboard';
import { ExamRoom } from './capacitacion/components/ExamRoom';
import { ExamResultPanel } from './capacitacion/components/ExamResultPanel';

export function CapacitacionView({ user }) {
  const {
    role,
    isSuperAdmin,
    isAdmin,
    isLector,
    roleLoading,
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
  } = useUserExamState(user);

  if (roleLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <SpinnerPremium size="md" text="Cargando módulo de capacitación..." />
      </div>
    );
  }

  return (
    <div className="container-fluid py-2 animate-fade-in">
      {/* HEADER DE LA SECCIÓN */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="mb-1 fw-bold text-dark" style={{ fontFamily: "'Outfit', sans-serif" }}>
            <i className="bi bi-mortarboard-fill text-primary me-2"></i>Consola de Auto-Capacitación
          </h2>
          <p className="text-muted mb-0 small">Mejora tus habilidades operativas de la plataforma y mantén tu certificación activa.</p>
        </div>
      </div>

      {capacitacionConfig && capacitacionConfig.habilitado === false && (
        <div className="alert alert-warning py-3 px-4 rounded-4 mb-4 border border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning d-flex align-items-center gap-3">
          <i className="bi bi-exclamation-triangle-fill fs-4 text-warning"></i>
          <div className="text-start">
            <h6 className="fw-bold mb-1">Módulo de Capacitación Suspendido</h6>
            <p className="mb-0 small text-muted-opacity">La administración de Luxia ha desactivado globalmente las capacitaciones obligatorias. Puedes leer el manual, pero el inicio de exámenes y correcciones está deshabilitado temporalmente.</p>
          </div>
        </div>
      )}

      {/* STEP 1: DASHBOARD PRINCIPAL */}
      {step === 'dashboard' && (
        <ExamDashboard
          profileData={profileData}
          selectedDifficulty={selectedDifficulty}
          setSelectedDifficulty={setSelectedDifficulty}
          isLector={isLector}
          handleStartExam={handleStartExam}
          examLoading={examLoading}
          attempts={attempts}
          capacitacionHabilitada={capacitacionConfig?.habilitado !== false}
        />
      )}

      {/* STEP 2 & 3: EXAM ROOM (TEORICO O PRACTICO) */}
      {(step === 'teorico' || step === 'practico') && currentExam && (
        <ExamRoom
          step={step}
          setStep={setStep}
          currentExam={currentExam}
          teoricoRespuestas={teoricoRespuestas}
          setTeoricoRespuestas={setTeoricoRespuestas}
          practicoRespuesta={practicoRespuesta}
          setPracticoRespuesta={setPracticoRespuesta}
          handleSubmitExam={handleSubmitExam}
        />
      )}

      {/* STEP 4: ENVIANDO / EVALUANDO */}
      {step === 'enviando' && (
        <div className="row justify-content-center py-5">
          <div className="col-md-6 text-center">
            <SpinnerPremium size="lg" text="LUXIA IA está evaluando tus respuestas y generando feedback de desarrollo..." />
            <p className="text-muted small mt-3">Por favor no cierres la pestaña, esto tomará unos segundos.</p>
          </div>
        </div>
      )}

      {/* STEP 5: RESULTADO */}
      {step === 'resultado' && examResult && (
        <ExamResultPanel
          examResult={examResult}
          setStep={setStep}
        />
      )}
    </div>
  );
}
