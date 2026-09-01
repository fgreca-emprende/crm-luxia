import { supabase } from './supabase';

/**
 * Obtener configuración general desde PostgreSQL en Supabase
 * @param {string} id - ID del documento (ej. 'rates', 'pipeline_config', 'security_config', 'meet_config', 'business')
 */
export async function getConfigGeneral(id) {
  try {
    const { data, error } = await supabase
      .from('config_general')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data.datos || data;
  } catch (err) {
    console.warn(`[configGeneral] Error consultando ${id} en Supabase:`, err.message);
    return null;
  }
}

/**
 * Guardar o actualizar configuración general en PostgreSQL
 * @param {string} id 
 * @param {object} datos 
 */
export async function setConfigGeneral(id, datos) {
  try {
    const { error } = await supabase
      .from('config_general')
      .upsert({
        id,
        datos,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`[configGeneral] Error guardando ${id} en Supabase:`, err.message);
    return false;
  }
}
