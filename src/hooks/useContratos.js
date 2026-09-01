import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';

export function useContratos(clienteId) {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(!!clienteId);
  const { showAlert } = useToast();

  const fetchContratos = useCallback(async () => {
    if (!clienteId) {
      setContratos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contratos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('fecha_inicio', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(d => ({
        id: d.id,
        clienteId: d.cliente_id,
        oportunidadId: d.oportunidad_id,
        tipoServicio: d.tipo_servicio,
        fechaInicio: d.fecha_inicio,
        fechaVencimiento: d.fecha_vencimiento,
        monto: Number(d.monto) || 0,
        moneda: d.moneda,
        volumenMensualProyectado: d.volumen_minimo_garantizado,
        esContratoVigente: d.es_contrato_vigente,
        versionContrato: d.version_contrato,
        estadoContrato: d.estado_contrato,
        estadoSLA: d.estado_sla,
        adjuntos: d.adjuntos || [],
        driveLink: d.drive_link,
        nombre: d.nombre,
        camposDinamicos: d.campos_dinamicos || {},
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));

      setContratos(mapped);
    } catch (err) {
      console.error("Error cargando contratos:", err);
      showAlert(`Error al cargar contratos: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [clienteId, showAlert]);

  useEffect(() => {
    fetchContratos();
  }, [fetchContratos]);

  return { contratos, loading, refresh: fetchContratos };
}
