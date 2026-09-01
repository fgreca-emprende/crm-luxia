import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../lib/configGeneral';
import { useToast } from '../components/ui/ToastProvider';

export function useOnboarding(clienteId) {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(!!clienteId);
  const { showAlert } = useToast();

  const fetchChecklist = useCallback(async () => {
    if (!clienteId) {
      setChecklist(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const defaultTasks = [
        { id: 'acuerdo_comercial_legajo', titulo: 'Acuerdo Comercial y Legajo Impositivo Aprobado', completado: false, fechaCompletado: null },
        { id: 'relevamiento_agronomico_lotes', titulo: 'Relevamiento Agronómico y Plan de Campaña', completado: false, fechaCompletado: null },
        { id: 'asesoramiento_tecnico_manejo', titulo: 'Asesoramiento Técnico y Calibración de Dosis', completado: false, fechaCompletado: null },
        { id: 'coordinacion_logistica_destino', titulo: 'Coordinación Logística y Depósito de Destino', completado: false, fechaCompletado: null },
        { id: 'primer_despacho_entrega', titulo: 'Primer Despacho y Entrega en Establecimiento', completado: false, fechaCompletado: null },
        { id: 'monitoreo_campo_30_dias', titulo: 'Monitoreo a Campo y Evaluación de Eficacia (30 días)', completado: false, fechaCompletado: null }
      ];

      const saved = await getConfigGeneral(`onboarding_${clienteId}`);
      if (saved && saved.pasos) {
        setChecklist(saved);
      } else {
        const initial = {
          clienteId,
          pasos: defaultTasks,
          porcentajeCompletado: 0,
          creadoEn: new Date().toISOString()
        };
        await setConfigGeneral(`onboarding_${clienteId}`, initial);
        setChecklist(initial);
      }
    } catch (err) {
      console.error("Error al cargar onboarding checklist:", err);
      showAlert("Error al cargar checklist de onboarding", "danger");
    } finally {
      setLoading(false);
    }
  }, [clienteId, showAlert]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const togglePaso = async (pasoId, evidencia = null) => {
    if (!checklist) return;

    try {
      const nuevosPasos = (checklist.pasos || []).map(paso => {
        if (paso.id === pasoId) {
          const nuevoEstado = !paso.completado;
          return {
            ...paso,
            completado: nuevoEstado,
            completadoPor: nuevoEstado ? 'admin@luxia.com' : '',
            fechaCompletado: nuevoEstado ? new Date().toISOString() : null,
            evidencia: nuevoEstado && evidencia ? evidencia : (nuevoEstado ? paso.evidencia || null : null)
          };
        }
        return paso;
      });

      const completados = nuevosPasos.filter(p => p.completado).length;
      const nuevoPorcentaje = Math.round((completados / nuevosPasos.length) * 100);

      const updated = {
        ...checklist,
        pasos: nuevosPasos,
        porcentajeCompletado: nuevoPorcentaje,
        updatedAt: new Date().toISOString()
      };

      await setConfigGeneral(`onboarding_${clienteId}`, updated);
      setChecklist(updated);

      showAlert(
        nuevoPorcentaje === 100 
          ? "🎉 ¡Onboarding completado al 100%!" 
          : "Paso de onboarding actualizado", 
        "success"
      );
    } catch (err) {
      console.error("Error al actualizar paso:", err);
      showAlert(`Error al guardar cambio: ${err.message}`, 'danger');
    }
  };

  const asignarResponsable = async (pasoId, email) => {
    if (!checklist) return;
    const emailLower = email ? email.trim().toLowerCase() : '';

    try {
      const nuevosPasos = (checklist.pasos || []).map(p => {
        if (p.id === pasoId) {
          return {
            ...p,
            responsableEmail: emailLower || null
          };
        }
        return p;
      });

      const updated = {
        ...checklist,
        pasos: nuevosPasos,
        updatedAt: new Date().toISOString()
      };

      await setConfigGeneral(`onboarding_${clienteId}`, updated);
      setChecklist(updated);

      showAlert(
        emailLower 
          ? `Responsable asignado a ${emailLower}.` 
          : 'Responsable removido con éxito.', 
        'success'
      );
    } catch (err) {
      console.error("Error al asignar responsable:", err);
      showAlert(`Error al guardar responsable: ${err.message}`, 'danger');
    }
  };

  return { checklist, loading, togglePaso, asignarResponsable, refresh: fetchChecklist };
}
