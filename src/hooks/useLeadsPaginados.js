import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';
import { useUserRole } from '../contexts/UserRoleContext';

export function mapLeadFromDB(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    nombreEmpresa: raw.nombre_empresa || raw.nombreEmpresa || '',
    nombreContacto: raw.nombre_contacto || raw.nombreContacto || '',
    correo: raw.correo || raw.email || '',
    email: raw.correo || raw.email || '',
    telefono: raw.telefono || '',
    pais: raw.pais || 'AR',
    cuit_rut_rfc: raw.cuit_rut_rfc || '',
    industria: raw.industria || '',
    sitioWeb: raw.sitio_web || raw.sitioWeb || '',
    volumenMensualProyectado: raw.volumen_mensual_proyectado || raw.volumenMensualProyectado || '',
    stackTecnologicoActual: raw.stack_tecnologico_actual || raw.stackTecnologicoActual || '',
    utmSource: raw.utm_source || raw.utmSource || '',
    utmMedium: raw.utm_medium || raw.utmMedium || '',
    utmCampaign: raw.utm_campaign || raw.utmCampaign || '',
    origen: raw.origen || 'web',
    estado: raw.estado || 'nuevo',
    subEstadoContacto: raw.sub_estado_contacto || raw.subEstadoContacto || '',
    motivoDescalificacion: raw.motivo_descalificacion || raw.motivoDescalificacion || '',
    scoreCalculado: raw.score_calculado ?? raw.scoreCalculado ?? 0,
    calificacionIA: raw.calificacion_ia || raw.calificacionIA || null,
    asignadoA: raw.asignado_a || raw.asignadoA || '',
    asignadoId: raw.asignado_id || raw.asignadoId || '',
    notas: raw.notas || '',
    camposDinamicos: raw.campos_dinamicos || raw.camposDinamicos || {},
    createdAt: raw.created_at || raw.createdAt,
    updatedAt: raw.updated_at || raw.updatedAt,
    ...raw
  };
}

export function mapLeadToDB(lead) {
  const dbObj = {
    nombre_empresa: lead.nombreEmpresa || lead.nombre_empresa,
    nombre_contacto: lead.nombreContacto || lead.nombre_contacto,
    correo: lead.correo || lead.email || lead.correo,
    telefono: lead.telefono,
    pais: lead.pais || 'AR',
    cuit_rut_rfc: lead.cuit_rut_rfc,
    industria: lead.industria,
    sitio_web: lead.sitioWeb || lead.sitio_web,
    volumen_mensual_proyectado: lead.volumenMensualProyectado || lead.volumen_mensual_proyectado,
    stack_tecnologico_actual: lead.stackTecnologicoActual || lead.stack_tecnologico_actual,
    utm_source: lead.utmSource || lead.utm_source,
    utm_medium: lead.utmMedium || lead.utm_medium,
    utm_campaign: lead.utmCampaign || lead.utm_campaign,
    origen: lead.origen || 'web',
    estado: lead.estado || 'nuevo',
    sub_estado_contacto: lead.subEstadoContacto || lead.sub_estado_contacto,
    motivo_descalificacion: lead.motivoDescalificacion || lead.motivo_descalificacion,
    score_calculado: lead.scoreCalculado ?? lead.score_calculado ?? 0,
    calificacion_ia: lead.calificacionIA || lead.calificacion_ia,
    asignado_a: lead.asignadoA || lead.asignado_a,
    asignado_id: lead.asignadoId || lead.asignado_id,
    notas: lead.notas,
    campos_dinamicos: lead.camposDinamicos || lead.campos_dinamicos || {}
  };
  if (lead.id) dbObj.id = lead.id;
  return dbObj;
}

export function useLeadsPaginados(pageSize = 25, selectedCountry = '', searchTerm = '') {
  const [leads, setLeads] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const { showAlert } = useToast();
  const { loading: roleLoading } = useUserRole();

  const loadLeads = useCallback(async (isNextPage = false, isRefresh = false) => {
    if (loading || roleLoading) return;
    if (!hasMore && isNextPage && !isRefresh) return;

    setError(null);
    setLoading(true);
    try {
      const targetPage = isRefresh ? 0 : (isNextPage ? page + 1 : 0);
      const from = targetPage * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' });

      if (selectedCountry) {
        query = query.eq('pais', selectedCountry);
      }

      if (searchTerm && searchTerm.trim()) {
        const cleanTerm = searchTerm.replace(/[%_,()"'\\/]/g, '').trim();
        if (cleanTerm) {
          const term = `%${cleanTerm}%`;
          query = query.or(`nombre_empresa.ilike.${term},nombre_contacto.ilike.${term},correo.ilike.${term}`);
        }
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error: queryError } = await query;
      if (queryError) throw queryError;

      const loadedLeads = (data || []).map(mapLeadFromDB);

      if (isNextPage && !isRefresh) {
        setLeads(prev => [...prev, ...loadedLeads]);
      } else {
        setLeads(loadedLeads);
      }

      setPage(targetPage);
      if (count !== null) {
        setHasMore(to + 1 < count);
      } else {
        setHasMore((data || []).length === pageSize);
      }
    } catch (err) {
      console.error("Error loading leads from Supabase:", err);
      setError(err.message);
      showAlert(`Error cargando leads: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [loading, roleLoading, hasMore, page, pageSize, selectedCountry, searchTerm, showAlert]);

  useEffect(() => {
    let active = true;
    if (!roleLoading) {
      const timer = setTimeout(() => {
        if (active) {
          loadLeads(false, true);
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [roleLoading, selectedCountry, searchTerm]);

  const refresh = useCallback(() => loadLeads(false, true), [loadLeads]);

  return { leads, loading, hasMore, loadLeads, refresh, error, isInitializing: roleLoading };
}
