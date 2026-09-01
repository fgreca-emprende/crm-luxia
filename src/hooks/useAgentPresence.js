import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook para gestión de presencia y disponibilidad de agentes mediante Supabase Presence
 * @param {object} currentUser - Objeto del usuario autenticado
 */
export function useAgentPresence(currentUser) {
  const [onlineAgents, setOnlineAgents] = useState({});

  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase.channel('online_presence_room', {
      config: {
        presence: {
          key: currentUser.id
        }
      }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineAgents(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Un nuevo usuario se conectó
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // Un usuario se desconectó
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: currentUser.id,
            email: currentUser.email,
            nombre: currentUser.nombre || currentUser.email,
            rol: currentUser.rol || 'agente',
            estadoCx: currentUser.estadoCx || 'activo',
            estadoPresencia: currentUser.estadoPresencia || 'Conectado',
            onlineAt: new Date().toISOString()
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.estadoCx, currentUser?.estadoPresencia]);

  const updateMyPresence = async (nuevoEstado) => {
    if (!currentUser?.id) return;

    // Actualizar registro en la base de datos de PostgreSQL
    await supabase
      .from('usuarios')
      .update({
        estado_presencia: nuevoEstado.presencia,
        estado_cx: nuevoEstado.cx,
        presencia: {
          estado: nuevoEstado.std,
          desdeIso: new Date().toISOString(),
          desdeMs: Date.now()
        }
      })
      .eq('id', currentUser.id);
  };

  return { onlineAgents, updateMyPresence };
}
