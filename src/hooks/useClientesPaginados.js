import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUserRole } from '../contexts/UserRoleContext';
import { useToast } from '../components/ui/ToastProvider';

export function mapClienteFromDB(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    nombreEmpresa: raw.nombre_empresa || raw.nombreEmpresa || '',
    cuit_rut_rfc: raw.cuit_rut_rfc || '',
    industria: raw.industria || '',
    sitioWeb: raw.sitio_web || raw.sitioWeb || '',
    tamanioEmpresa: raw.tamanio_empresa || raw.tamanioEmpresa || '',
    tierCuenta: raw.tier_cuenta || raw.tierCuenta || 'Tier 3',
    tierOverride: raw.tier_override ?? raw.tierOverride ?? false,
    parentCompanyId: raw.parent_company_id || raw.parentCompanyId || null,
    estado: raw.estado || 'Ingresado',
    faseManual: raw.fase_manual || raw.faseManual || null,
    pais: raw.pais || 'AR',
    comercialEmail: raw.comercial_email || raw.comercialEmail || '',
    comercialId: raw.comercial_id || raw.comercialId || '',
    observaciones: raw.observaciones || '',
    healthScore: raw.health_score || raw.healthScore || { riesgo: 'Green', analisis: 'Sin evaluar' },
    camposDinamicos: raw.campos_dinamicos || raw.camposDinamicos || {},
    fechaIngreso: raw.fecha_ingreso || raw.fechaIngreso || raw.created_at,
    ultimoCambioEstado: raw.ultimo_cambio_estado || raw.ultimoCambioEstado || raw.updated_at,
    createdAt: raw.created_at || raw.createdAt,
    updatedAt: raw.updated_at || raw.updatedAt,
    ...raw
  };
}

export function mapClienteToDB(client) {
  const dbObj = {
    id: client.id,
    nombre_empresa: client.nombreEmpresa || client.nombre_empresa,
    cuit_rut_rfc: client.cuit_rut_rfc,
    industria: client.industria,
    sitio_web: client.sitioWeb || client.sitio_web,
    tamanio_empresa: client.tamanioEmpresa || client.tamanio_empresa,
    tier_cuenta: client.tierCuenta || client.tier_cuenta || 'Tier 3',
    tier_override: client.tierOverride ?? client.tier_override ?? false,
    parent_company_id: client.parentCompanyId || client.parent_company_id || null,
    estado: client.estado || 'Ingresado',
    fase_manual: client.faseManual || client.fase_manual,
    pais: client.pais || 'AR',
    comercial_email: client.comercialEmail || client.comercial_email,
    comercial_id: client.comercialId || client.comercial_id,
    observaciones: client.observaciones,
    health_score: client.healthScore || client.health_score || { riesgo: 'Green', analisis: 'Sin evaluar' },
    campos_dinamicos: client.camposDinamicos || client.campos_dinamicos || {}
  };
  return dbObj;
}

export function useClientesPaginados(pageSize = 25, selectedCountry = '', searchTerm = '', teamEmails = []) {
  const [clientes, setClientes] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const { showAlert } = useToast();
  const { isAdmin, user, loading: roleLoading, getDataScope } = useUserRole();
  const clientScope = getDataScope ? getDataScope('clientes') : 'OWN';
  const teamEmailsKey = (teamEmails || []).join(',');

  const loadClientes = useCallback(async (isNextPage = false, isRefresh = false) => {
    if (loading || roleLoading) return;
    if (clientScope === 'TEAM' && (!teamEmails || teamEmails.length === 0)) return;
    if (!hasMore && isNextPage && !isRefresh) return;

    setError(null);
    setLoading(true);
    try {
      const targetPage = isRefresh ? 0 : (isNextPage ? page + 1 : 0);
      const from = targetPage * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('clientes')
        .select('*', { count: 'exact' });

      if (clientScope === 'TEAM' && teamEmails && teamEmails.length > 0) {
        query = query.in('comercial_email', teamEmails);
      } else if (clientScope === 'OWN' && user?.email && !isAdmin) {
        query = query.eq('comercial_email', user.email);
      }

      if (selectedCountry) {
        query = query.eq('pais', selectedCountry);
      }

      if (searchTerm && searchTerm.trim()) {
        const cleanTerm = searchTerm.replace(/[%_,()"'\\/]/g, '').trim();
        if (cleanTerm) {
          const term = `%${cleanTerm}%`;
          query = query.or(`nombre_empresa.ilike.${term},cuit_rut_rfc.ilike.${term},sitio_web.ilike.${term}`);
        }
      }

      query = query.order('updated_at', { ascending: false }).range(from, to);

      const { data, count, error: queryError } = await query;
      if (queryError) throw queryError;

      const loadedClientes = (data || []).map(mapClienteFromDB);

      if (isNextPage && !isRefresh) {
        setClientes(prev => [...prev, ...loadedClientes]);
      } else {
        setClientes(loadedClientes);
      }

      setPage(targetPage);
      if (count !== null) {
        setHasMore(to + 1 < count);
      } else {
        setHasMore((data || []).length === pageSize);
      }
    } catch (err) {
      console.error("Error loading clientes from Supabase:", err);
      setError(err.message);
      showAlert(`Error cargando clientes: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [loading, roleLoading, clientScope, teamEmails, hasMore, page, pageSize, user, isAdmin, selectedCountry, searchTerm, showAlert]);

  useEffect(() => {
    let active = true;
    if (!roleLoading) {
      const timer = setTimeout(() => {
        if (active) {
          loadClientes(false, true);
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [roleLoading, selectedCountry, searchTerm, teamEmailsKey]);

  const refresh = useCallback(() => loadClientes(false, true), [loadClientes]);

  return { clientes, loading, hasMore, loadClientes, refresh, error, isInitializing: roleLoading };
}
