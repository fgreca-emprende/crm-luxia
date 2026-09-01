import React from 'react';

export function SLAIndicator({ estadoSLA }) {
  const status = estadoSLA || 'Vigente';
  const badgeClass = status.includes('Vencido')
    ? 'bg-danger'
    : status.includes('Naranja')
    ? 'bg-warning text-dark'
    : 'bg-success';

  return (
    <span className={`badge ${badgeClass} rounded-pill d-block mb-2`}>
      {status}
    </span>
  );
}
