import { useState, useEffect } from 'react';

/**
 * Hook personalizado para virtualización nativa del DOM (Window-level scrolling).
 * @param {Array} items Lista de elementos a renderizar.
 * @param {number} itemHeight Altura estimada de cada elemento en píxeles.
 * @param {number} overscan Cantidad de elementos extra a renderizar arriba/abajo para evitar parpadeos al hacer scroll.
 */
export function useVirtualWindow(items, itemHeight = 100, overscan = 5) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleScroll = () => {
      setScrollTop(window.scrollY || document.documentElement.scrollTop);
    };
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    
    // Disparador inicial
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const totalHeight = items.length * itemHeight;
  
  // Calcular índices de inicio y fin
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);

  const visibleItems = items.slice(startIndex, endIndex);
  const paddingTop = startIndex * itemHeight;
  const paddingBottom = Math.max(0, totalHeight - paddingTop - (visibleItems.length * itemHeight));

  return {
    visibleItems,
    paddingTop,
    paddingBottom,
    startIndex
  };
}
