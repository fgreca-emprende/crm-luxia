import React from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

// LUXIA® Agro Corporate & Analytical Palette
const COLORS = ['#961f80', '#10b981', '#f59e0b', '#0284c7', '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="card shadow-md border p-2 rounded-3" style={{ background: 'var(--apple-surface-elevated, #ffffff)', borderColor: 'var(--apple-border, rgba(0,0,0,0.1))', color: 'var(--apple-text-primary, #0f172a)', backdropFilter: 'blur(16px)' }}>
        <p className="fw-bold small mb-1" style={{ color: 'var(--apple-text-primary)' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} className="small mb-0" style={{ color: entry.color }}>
            <span className="fw-bold">{entry.name}:</span> {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function DynamicChart({ chartType, data, xAxisKey, yAxisKeys }) {
  if (!data || data.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100 text-muted small bg-light rounded-3 border border-dashed">
        <i className="bi bi-inbox me-2"></i> Sin datos para graficar
      </div>
    );
  }

  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = isDark ? '#94a3b8' : '#6c757d';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(108, 117, 125, 0.1)';

  switch (chartType) {
    case 'bar':
      return (
        <div style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {yAxisKeys.map((key, index) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={50} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
      
    case 'line':
      return (
        <div style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {yAxisKeys.map((key, index) => (
                <Line 
                  key={key} 
                  type="monotone" 
                  dataKey={key} 
                  stroke={COLORS[index % COLORS.length]} 
                  strokeWidth={3}
                  activeDot={{ r: 8 }}
                  dot={{ r: 4, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case 'pie':
      return (
        <div style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey={yAxisKeys[0]}
                nameKey={xAxisKey}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    default:
      return (
        <div className="alert alert-warning small">
          Tipo de gráfico no soportado: {chartType}
        </div>
      );
  }
}
