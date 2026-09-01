import React from 'react';

/**
 * SpinnerPremium component.
 * Features an elegant orbital dual-ring rotating animation with glowing effects.
 * Supports absolute/relative overlay masking and customized loading text.
 * 
 * @param {string} size - Size variant ('sm', 'md', 'lg')
 * @param {string} text - Optional text displayed below the spinner
 * @param {boolean} overlay - If true, wraps the spinner in a blurred glass backdrop layer
 */
export function SpinnerPremium({ size = 'md', text = '', overlay = false }) {
  const containerClasses = `spinner-premium-container spinner-premium-${size}`;

  const spinnerElement = (
    <div className={containerClasses}>
      <div className="spinner-premium-orbital">
        <div className="spinner-premium-glow"></div>
        <div className="spinner-ring-outer"></div>
        <div className="spinner-ring-inner"></div>
      </div>
      {text && (
        <div 
          className="text-muted small fw-bold mt-2 text-center" 
          style={{ 
            fontFamily: "'Outfit', sans-serif", 
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            opacity: 0.8
          }}
        >
          {text}
        </div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="glass-overlay-loading">
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
}
