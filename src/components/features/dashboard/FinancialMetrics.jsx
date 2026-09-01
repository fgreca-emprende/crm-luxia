import React from 'react';

export function FinancialMetrics({ title, subtitle, data = {}, loading = false, borderClass = '', titleColorClass = '', cardStyle = {} }) {
  return (
    <div className={`apple-card apple-card-hover h-100 p-3.5 d-flex flex-column justify-content-between ${borderClass}`} style={cardStyle}>
      <div>
        <div className="d-flex align-items-center justify-content-between mb-1">
          <span className="small text-uppercase fw-bold" style={{ fontSize: '0.7rem', color: titleColorClass === 'text-danger' ? 'var(--apple-red)' : 'var(--apple-text-secondary)', letterSpacing: '0.04em' }}>
            {title}
          </span>
          <span className={`apple-badge ${titleColorClass === 'text-danger' ? 'apple-badge-red' : 'apple-badge-blue'}`}>
            <i className="bi bi-cash-stack"></i>
          </span>
        </div>
        <div className="mt-2">
          {loading ? (
            <div className="skeleton-shimmer" style={{ width: '80px', height: '22px', display: 'inline-block', margin: '4px 0', borderRadius: 'var(--apple-radius-sm)' }}></div>
          ) : Object.keys(data || {}).length > 0 ? (
            Object.entries(data).map(([currency, amount]) => (
              <h4 key={currency} className="fw-bold mb-1" style={{ fontSize: '1.35rem', color: 'var(--apple-text-primary)' }}>
                <span className="me-1.5" style={{ fontSize: '0.8rem', color: 'var(--apple-text-secondary)' }}>{currency}</span>
                {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}
              </h4>
            ))
          ) : (
            <h3 className="fw-bold mb-0" style={{ fontSize: '1.85rem', color: 'var(--apple-text-primary)' }}>0</h3>
          )}
        </div>
      </div>
      <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>
        {subtitle}
      </p>
    </div>
  );
}
