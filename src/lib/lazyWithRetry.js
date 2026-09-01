import { lazy } from 'react';

/**
 * Wrapper to retry dynamic imports if they fail due to hash mismatches after a new deploy.
 * Saves the current view to survive the page reload.
 */
export const lazyWithRetry = (componentImport) => {
  const chunkKey = `lazy-retry-${componentImport.toString().slice(0, 80)}`;
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      const hasRetried = window.sessionStorage.getItem(chunkKey);
      if (!hasRetried) {
        window.sessionStorage.setItem(chunkKey, 'true');
        // Preserve current view if available
        const currentView = window.sessionStorage.getItem('app-active-view');
        if (currentView) {
          window.sessionStorage.setItem('app-restore-view', currentView);
        }
        window.location.reload();
        return new Promise(() => {}); // Prevents React from throwing before reload
      }
      throw error;
    }
  });
};
