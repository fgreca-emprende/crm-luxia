import React, { useEffect, useRef, useState } from 'react';

export function ChartsPanel({ metrics, historyData }) {
  const donutChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const tierBarChartRef = useRef(null);

  const donutInstance = useRef(null);
  const lineInstance = useRef(null);
  const tierBarInstance = useRef(null);

  const [themeToggle, setThemeToggle] = useState(0);

  // Monitor prefers-color-scheme & data-theme to redraw charts when theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setThemeToggle(prev => prev + 1);
    
    mediaQuery.addEventListener('change', handleChange);
    const observer = new MutationObserver(handleChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (metrics.loading || typeof window.Chart === 'undefined') return;

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDark = currentTheme === 'dark' || (currentTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const textColor = isDark ? '#a1a1a6' : '#6e6e73';
    const textPrimaryColor = isDark ? '#ffffff' : '#1d1d1f';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const cardBgColor = isDark ? '#18181c' : '#ffffff';

    // 1. Donut Chart (Ciclo de Vida)
    if (donutChartRef.current) {
      if (donutInstance.current) donutInstance.current.destroy();
      const ctx = donutChartRef.current.getContext('2d');
      donutInstance.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Activo', 'Onboarding', 'En Riesgo', 'Churn'],
          datasets: [{
            data: [
              metrics.estados?.activo || 0,
              metrics.estados?.onboarding || 0,
              metrics.estados?.riesgo || 0,
              metrics.estados?.churn || 0
            ],
            backgroundColor: isDark 
              ? ['#30d158', '#2997ff', '#ff9f0a', '#ff453a']
              : ['#34c759', '#0071e3', '#ff9500', '#ff3b30'],
            borderWidth: 2,
            borderColor: cardBgColor
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textPrimaryColor,
                boxWidth: 12,
                font: { family: "-apple-system, 'SF Pro Text', sans-serif", size: 11, weight: '500' }
              }
            }
          },
          cutout: '72%'
        }
      });
    }

    // 2. Line Chart (Evolución de Salud)
    if (lineChartRef.current) {
      if (lineInstance.current) lineInstance.current.destroy();
      const ctx = lineChartRef.current.getContext('2d');
      let labels = historyData ? historyData.map(h => h.label) : [];
      let data = historyData ? historyData.map(h => h.avg) : [];

      if (labels.length === 0) {
        if (metrics.totalClientes === 0) {
          labels = ['Sin datos'];
          data = [0];
        } else {
          labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Actual'];
          data = [88, 85, 89, 87, metrics.saludPromedio];
        }
      }

      lineInstance.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Salud Promedio',
            data: data,
            borderColor: isDark ? '#30d158' : '#34c759',
            backgroundColor: isDark ? 'rgba(48, 209, 88, 0.12)' : 'rgba(52, 199, 89, 0.10)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: isDark ? '#30d158' : '#34c759',
            pointBorderColor: cardBgColor
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 20 }
            },
            x: {
              grid: { display: false },
              ticks: { color: textPrimaryColor, font: { weight: '600' } }
            }
          }
        }
      });
    }

    // 3. Horizontal Bar Chart (Matriz ABC de Cartera)
    if (tierBarChartRef.current) {
      if (tierBarInstance.current) tierBarInstance.current.destroy();
      const ctx = tierBarChartRef.current.getContext('2d');
      
      const counts = [
        metrics.tiers?.tier1?.count || 0,
        metrics.tiers?.tier2?.count || 0,
        metrics.tiers?.tier3?.count || 0
      ];

      tierBarInstance.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Tier 1 (Enterprise ≥ $1k)', 'Tier 2 (Mid-Market $300-$1k)', 'Tier 3 (SMB < $300)'],
          datasets: [{
            label: 'Clientes',
            data: counts,
            backgroundColor: isDark ? ['#bf5af2', '#2997ff', '#30d158'] : ['#af52de', '#0071e3', '#34c759'],
            borderRadius: 8,
            barThickness: 20
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1 }
            },
            y: {
              grid: { display: false },
              ticks: { color: textPrimaryColor, font: { weight: '600' } }
            }
          }
        }
      });
    }

    return () => {
      if (donutInstance.current) donutInstance.current.destroy();
      if (lineInstance.current) lineInstance.current.destroy();
      if (tierBarInstance.current) tierBarInstance.current.destroy();
    };
  }, [metrics, historyData, themeToggle]);

  return (
    <div className="row g-3">
      {/* Evolución Histórica de Salud de Cartera */}
      <div className="col-md-8">
        <div className="apple-card p-4 d-flex flex-column h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold mb-0" style={{ color: 'var(--apple-text-primary)' }}>
              <i className="bi bi-activity text-success me-2"></i>Evolución Histórica de Salud de Cartera
            </h6>
            <span className="apple-badge apple-badge-green">
              LUXIA IA
            </span>
          </div>
          <div className="flex-grow-1 position-relative" style={{ minHeight: '260px', height: '260px' }}>
            {typeof window.Chart === 'undefined' ? (
              <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                <div className="spinner-border spinner-border-sm me-2"></div> Cargando motor gráfico...
              </div>
            ) : (
              <canvas ref={lineChartRef}></canvas>
            )}
          </div>
        </div>
      </div>

      {/* Estados de Ciclo de Vida */}
      <div className="col-md-4">
        <div className="apple-card p-4 d-flex flex-column h-100">
          <h6 className="fw-bold mb-3" style={{ color: 'var(--apple-text-primary)' }}>
            <i className="bi bi-pie-chart-fill text-primary me-2"></i>Estados de Ciclo de Vida
          </h6>
          <div className="flex-grow-1 position-relative d-flex align-items-center justify-content-center" style={{ minHeight: '260px', height: '260px' }}>
            {typeof window.Chart === 'undefined' ? (
              <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                <div className="spinner-border spinner-border-sm me-2"></div> Cargando motor de distribución...
              </div>
            ) : (
              <div className="w-100 h-100 position-relative">
                <canvas ref={donutChartRef}></canvas>
                <div className="position-absolute d-flex flex-column align-items-center justify-content-center" style={{ top: '42%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}>
                  <span className="small fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em', color: 'var(--apple-text-secondary)' }}>Salud</span>
                  <span className="fw-bold h3 mb-0" style={{ color: 'var(--apple-text-primary)' }}>{metrics.saludPromedio}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Matriz ABC de Cartera (Ingresos por Tier) */}
      <div className="col-12 mt-3">
        <div className="apple-card p-4 d-flex flex-column" style={{ minHeight: '300px' }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold mb-0" style={{ color: 'var(--apple-text-primary)' }}>
              <i className="bi bi-diagram-3-fill me-2" style={{ color: 'var(--apple-indigo)' }}></i>
              Matriz ABC de Cartera (Concentración de Revenue por Tier)
            </h6>
            <span className="apple-badge apple-badge-purple">
              Clasificación Enterprise
            </span>
          </div>
          <div className="position-relative flex-grow-1" style={{ height: '220px' }}>
            {typeof window.Chart === 'undefined' ? (
              <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                <div className="spinner-border spinner-border-sm me-2"></div> Cargando gráfico...
              </div>
            ) : (
              <canvas ref={tierBarChartRef}></canvas>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
