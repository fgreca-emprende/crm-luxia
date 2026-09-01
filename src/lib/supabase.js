import { createClient } from '@supabase/supabase-js';

// Supabase Local Configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('[Supabase] Advertencia: VITE_SUPABASE_ANON_KEY no está definida en .env.local.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Helper para invocar endpoints del Backend local (/backend/api/...)
export async function callBackendApi(endpoint, data = {}, token = null) {
  let authToken = token;
  if (!authToken) {
    const session = (await supabase.auth.getSession()).data.session;
    authToken = session?.access_token;
  }

  const backendBase = `${supabaseUrl}/backend/api`;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const response = await fetch(`${backendBase}${cleanEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error ${response.status} en backend.`);
  }

  return response.json();
}
