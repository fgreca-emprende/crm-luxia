export const cacheManager = {
  data: new Map(),
  get(key) {
    const item = this.data.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.data.delete(key);
      return null;
    }
    return item.value;
  },
  set(key, value, ttlMs) {
    this.data.set(key, { value, expiry: Date.now() + ttlMs });
  },
  clear() {
    this.data.clear();
  },
  clearPrefix(prefix) {
    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        this.data.delete(key);
      }
    }
  }
};

export const dbTracker = {
  getStats() {
    return {
      reads: parseInt(sessionStorage.getItem('sb_reads') || '0', 10),
      writes: parseInt(sessionStorage.getItem('sb_writes') || '0', 10),
    };
  },
  trackReads(count = 1) {
    if (!count || count < 0) return;
    const current = parseInt(sessionStorage.getItem('sb_reads') || '0', 10);
    sessionStorage.setItem('sb_reads', (current + count).toString());
    window.dispatchEvent(new Event('db-stats-updated'));
  },
  trackWrites(count = 1) {
    if (!count || count < 0) return;
    const current = parseInt(sessionStorage.getItem('sb_writes') || '0', 10);
    sessionStorage.setItem('sb_writes', (current + count).toString());
    window.dispatchEvent(new Event('db-stats-updated'));
  },
  reset() {
    sessionStorage.setItem('sb_reads', '0');
    sessionStorage.setItem('sb_writes', '0');
    window.dispatchEvent(new Event('db-stats-updated'));
  }
};

export async function fetchWithCache(key, fetchFn, ttlMs = 30000) {
  const cached = cacheManager.get(key);
  if (cached) return cached;
  try {
    const result = await fetchFn();
    cacheManager.set(key, result, ttlMs);
    
    // Telemetry tracking para Supabase
    let rowCount = 1;
    if (result) {
      if (Array.isArray(result)) {
        rowCount = result.length || 0;
      } else if (result.data && Array.isArray(result.data)) {
        rowCount = result.data.length || 0;
      }
    }
    dbTracker.trackReads(rowCount);

    return result;
  } catch (err) {
    console.error(`[Cache] Error fetching ${key}:`, err);
    if (err.message && (err.message.includes('unavailable') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
      window.dispatchEvent(new Event('backend-unavailable'));
    }
    throw err;
  }
}

/**
 * Executes an async function with exponential backoff retry policy and circuit breaker notification.
 * @param {Function} asyncFn The async function to execute
 * @param {number} maxRetries Maximum number of retries (default 3)
 * @param {number} baseDelayMs Base delay in milliseconds (default 1000)
 */
export async function withRetryAndCircuitBreaker(asyncFn, maxRetries = 3, baseDelayMs = 1000) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await asyncFn();
    } catch (error) {
      const isNetworkOrQuotaError = 
        error.message.includes('429') || 
        error.message.includes('quota') || 
        error.message.includes('RESOURCE_EXHAUSTED') || 
        error.message.includes('503') ||
        error.message.includes('network') ||
        error.message.includes('fetch') ||
        error.message.includes('unavailable') ||
        error.message.includes('Failed to fetch');

      if (isNetworkOrQuotaError && attempt < maxRetries) {
        attempt++;
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[CircuitBreaker] Intento ${attempt} falló, reintentando en ${delayMs}ms... Error: ${error.message}`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        if (isNetworkOrQuotaError) {
          window.dispatchEvent(new Event('backend-unavailable'));
        }
        throw error;
      }
    }
  }
}
