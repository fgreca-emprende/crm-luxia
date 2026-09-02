import { describe, it, expect, beforeEach } from 'vitest';
import { cacheManager, dbTracker } from '../api';

// Mock sessionStorage para entorno Node.js
const mockStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = val.toString(); },
    clear: () => { store = {}; },
    removeItem: (key) => { delete store[key]; }
  };
})();

globalThis.sessionStorage = mockStorage;
globalThis.window = {
  dispatchEvent: () => {}
};

describe('Frontend API Cache & Telemetry', () => {
  beforeEach(() => {
    cacheManager.clear();
    sessionStorage.clear();
  });

  it('should store and retrieve cached items within TTL', () => {
    cacheManager.set('key1', { test: 123 }, 5000);
    const result = cacheManager.get('key1');
    expect(result).toEqual({ test: 123 });
  });

  it('should expire items after TTL', async () => {
    cacheManager.set('key2', 'expiredValue', -100);
    const result = cacheManager.get('key2');
    expect(result).toBeNull();
  });

  it('should enforce LRU eviction when exceeding max cache limit', () => {
    for (let i = 0; i < 210; i++) {
      cacheManager.set(`item_${i}`, i, 10000);
    }
    // Items beyond 200 should cause eviction of the oldest items
    expect(cacheManager.get('item_0')).toBeNull();
    expect(cacheManager.get('item_209')).toBe(209);
  });

  it('should track database reads and writes via dbTracker', () => {
    dbTracker.trackReads(5);
    dbTracker.trackWrites(2);
    const stats = dbTracker.getStats();
    expect(stats.reads).toBe(5);
    expect(stats.writes).toBe(2);
  });
});
