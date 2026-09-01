import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook reactivo para consultar y suscribirse a cambios de tablas en Supabase Realtime (PostgreSQL CDC)
 * @param {object} options
 * @param {string} options.table - Nombre de la tabla ('clientes', 'leads', 'tickets', etc.)
 * @param {object} [options.filter] - Filtro estático de igualdad { columna: valor }
 * @param {object} [options.orderBy] - Ordenamiento { column: 'created_at', ascending: false }
 * @param {number} [options.limit] - Límite de registros a recuperar
 */
export function useSupabaseCollection({ table, filter = null, orderBy = { column: 'created_at', ascending: false }, limit = null }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Cargar datos iniciales
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        let query = supabase.from(table).select('*');

        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              query = query.eq(key, value);
            }
          });
        }

        if (orderBy?.column) {
          query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
        }

        if (limit) {
          query = query.limit(limit);
        }

        const { data: initialRows, error: fetchErr } = await query;

        if (fetchErr) throw fetchErr;

        if (isMounted) {
          setData(initialRows || []);
          setError(null);
        }
      } catch (err) {
        console.error(`[useSupabaseCollection] Error cargando tabla ${table}:`, err);
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialData();

    // 2. Suscripción en tiempo real a cambios de PostgreSQL (INSERT, UPDATE, DELETE)
    const channelName = `realtime_${table}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          if (!isMounted) return;

          if (payload.eventType === 'INSERT') {
            setData((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) => prev.map((item) => (item.id === payload.new.id ? payload.new : item)));
          } else if (payload.eventType === 'DELETE') {
            setData((prev) => prev.filter((item) => item.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [table, JSON.stringify(filter), JSON.stringify(orderBy), limit]);

  return { data, loading, error, setData };
}
