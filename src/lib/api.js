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
      reads: parseInt(localStorage.getItem('firestore_reads') || '0', 10),
      writes: parseInt(localStorage.getItem('firestore_writes') || '0', 10),
    };
  },
  trackReads(count) {
    if (!count || count < 0) return;
    const current = parseInt(localStorage.getItem('firestore_reads') || '0', 10);
    localStorage.setItem('firestore_reads', (current + count).toString());
    window.dispatchEvent(new Event('firestore-stats-updated'));
  },
  trackWrites(count) {
    if (!count || count < 0) return;
    const current = parseInt(localStorage.getItem('firestore_writes') || '0', 10);
    localStorage.setItem('firestore_writes', (current + count).toString());
    window.dispatchEvent(new Event('firestore-stats-updated'));
  },
  reset() {
    localStorage.setItem('firestore_reads', '0');
    localStorage.setItem('firestore_writes', '0');
    window.dispatchEvent(new Event('firestore-stats-updated'));
  }
};

export function trackSnapshotReads(snapshot) {
  if (!snapshot) return;
  let count = 1;
  if (snapshot.docs !== undefined) {
    count = snapshot.empty ? 1 : snapshot.docs.length;
  } else if (typeof snapshot.exists === 'function') {
    count = snapshot.exists() ? 1 : 0;
  }
  dbTracker.trackReads(count);
}

export async function fetchWithCache(key, fetchFn, ttlMs) {
  const cached = cacheManager.get(key);
  if (cached) return cached;
  try {
    const result = await fetchFn();
    cacheManager.set(key, result, ttlMs);
    
    // Telemetry tracking
    let docCount = 1;
    if (result) {
      if (typeof result.docs !== 'undefined') {
        docCount = result.docs.length || 0;
      } else if (typeof result.exists !== 'undefined') {
        docCount = result.exists() ? 1 : 0;
      }
    }
    dbTracker.trackReads(docCount);

    return result;
  } catch (err) {
    console.error(`[Cache] Error fetching ${key}:`, err);
    if (err.message && (err.message.includes('unavailable') || err.message.includes('deadline-exceeded') || err.message.includes('Failed to fetch'))) {
      window.dispatchEvent(new Event('backend-unavailable'));
    }
    throw err;
  }
}

/**
 * Executes a Cloud Function (or any async function) with an exponential backoff retry policy.
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
        error.message.includes('high demand') || 
        error.message.includes('503') ||
        error.message.includes('network') ||
        error.message.includes('fetch') ||
        error.message.includes('unavailable') ||
        error.message.includes('deadline-exceeded');

      if (isNetworkOrQuotaError && attempt < maxRetries) {
        attempt++;
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[CircuitBreaker] Attempt ${attempt} failed, retrying in ${delayMs}ms... Error: ${error.message}`);
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
