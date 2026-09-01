import { useEffect, useRef, useState } from 'react';
import { getConfigGeneral } from '../../../lib/configGeneral';

export function PipelineChartsPanel({ leads, oportunidades, exchangeRates, selectedCountry, activePipeline = 'global', comerciales = [] }) {
  const funnelChartRef = useRef(null);
  const lossChartRef = useRef(null);
  const leaderboardChartRef = useRef(null);
  const tierChartRef = useRef(null);

  const funnelInstance = useRef(null);
  const lossInstance = useRef(null);
  const leaderboardInstance = useRef(null);
  const tierInstance = useRef(null);

  const [themeToggle, setThemeToggle] = useState(0);
  const [currencyMode, setCurrencyMode] = useState('both'); // 'both', 'local', 'usd'
  const [monthlyTargetUSD, setMonthlyTargetUSD] = useState(2500); // Target de ventas mensual configurable

  // Currency helper
  const getCountryCurrency = (country) => {
    switch (country) {
      case 'AR': return 'ARS';
      case 'CL': return 'CLP';
      case 'PE': return 'PEN';
      case 'CO': return 'COP';
      case 'MX': return 'MXN';
      default: return 'USD';
    }
  };

  const selectedCurrency = getCountryCurrency(selectedCountry);
  const rates = exchangeRates || { USD: 1, ARS: 1250, CLP: 940, PEN: 3.7, COP: 4100, MXN: 18 };

  const [pipelineConfig, setPipelineConfig] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const conf = await getConfigGeneral('pipeline_config');
        if (conf) {
          setPipelineConfig(conf);
        }
      } catch (err) {
        console.warn("Error loading pipeline config in Dashboard:", err.message);
      }
    };
    fetchConfig();
  }, []);

  const activePipelineKey = activePipeline === 'global' ? 'adquisicion' : activePipeline;
  const activeStages = pipelineConfig?.[`${activePipelineKey}_default`]?.stages
    || [
         { id: 'diagnostico', label: '📋 Diagnóstico', orden: 10 },
         { id: 'propuesta', label: '💡 Propuesta', orden: 20 },
         { id: 'negociacion', label: '🤝 Negociación', orden: 30 }
       ];

  // Calculate Pipeline Metrics & Executive Business Intelligence
  const calculatedMetrics = (() => {
    let totalUSD = 0;
    let totalLocal = 0;
    let ponderadoUSD = 0;
    let ponderadoLocal = 0;
    let activeOpsCount = 0;
    let closedWonCount = 0;
    let closedLostCount = 0;
    let totalSalesCycleDays = 0;
    let salesCycleCount = 0;

    // Stagnation & Deal Tier breakdown
    let stagnantOpsCount = 0;
    let stagnantUSD = 0;
    let stagnantLocal = 0;

    let enterpriseUSD = 0;
    let enterpriseCount = 0;
    let midMarketUSD = 0;
    let midMarketCount = 0;
    let smbUSD = 0;
    let smbCount = 0;

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    oportunidades.forEach(op => {
      const stage = op.etapa;
      const amount = Number(op.montoEstimadoMensual) || 0;
      const opCurrency = op.moneda || getCountryCurrency(op.pais);
      
      const rateToUSD = rates[opCurrency] || 1;
      const amountUSD = amount / rateToUSD;
      const amountLocal = amountUSD * (rates[selectedCurrency] || 1);

      if (stage === 'ganado') {
        closedWonCount++;
        if (op.createdAt && op.updatedAt) {
          const start = op.createdAt.toDate ? op.createdAt.toDate().getTime() : new Date(op.createdAt).getTime();
          const end = op.updatedAt.toDate ? op.updatedAt.toDate().getTime() : new Date(op.updatedAt).getTime();
          totalSalesCycleDays += Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
          salesCycleCount++;
        }
      } else if (stage === 'perdido') {
        closedLostCount++;
      } else {
        // Active deals
        activeOpsCount++;
        totalUSD += amountUSD;
        totalLocal += amountLocal;

        // Probabilities
        let prob = 10;
        if (stage === 'diagnostico') prob = 20;
        else if (stage === 'propuesta') prob = 50;
        else if (stage === 'negociacion') prob = 80;
        else if (op.probabilidad) prob = Number(op.probabilidad);

        ponderadoUSD += (amountUSD * prob) / 100;
        ponderadoLocal += (amountLocal * prob) / 100;

        // Check stagnation (> 30 days in same stage)
        const lastUpdated = op.updatedAt?.toDate ? op.updatedAt.toDate().getTime() : new Date(op.updatedAt || op.createdAt || 0).getTime();
        if (lastUpdated > 0 && lastUpdated < thirtyDaysAgo) {
          stagnantOpsCount++;
          stagnantUSD += amountUSD;
          stagnantLocal += amountLocal;
        }

        // Deal Tier classification (MRR)
        if (amountUSD >= 1000) {
          enterpriseUSD += amountUSD;
          enterpriseCount++;
        } else if (amountUSD >= 300) {
          midMarketUSD += amountUSD;
          midMarketCount++;
        } else {
          smbUSD += amountUSD;
          smbCount++;
        }
      }
    });

    const totalLeads = leads.length;
    const leadsContacted = leads.filter(l => l.estado === 'contactado' || l.estado === 'calificado').length;
    const leadsQualified = leads.filter(l => l.estado === 'calificado').length;

    // Conversion Rates
    const leadConvRate = totalLeads > 0 ? Math.round((leadsQualified / totalLeads) * 100) : 0;
    const fullFunnelRate = totalLeads > 0 ? Math.round((closedWonCount / totalLeads) * 100) : 0;
    const totalClosed = closedWonCount + closedLostCount;
    const winRate = totalClosed > 0 ? Math.round((closedWonCount / totalClosed) * 100) : 0;
    const avgSalesCycle = salesCycleCount > 0 ? Math.round(totalSalesCycleDays / salesCycleCount) : 0;

    // Sales Velocity ($ Revenue / Day = (Total Pipeline * Win Rate) / Avg Sales Cycle)
    const velocityUSD = avgSalesCycle > 0 ? (totalUSD * (winRate / 100)) / avgSalesCycle : 0;
    const velocityLocal = avgSalesCycle > 0 ? (totalLocal * (winRate / 100)) / avgSalesCycle : 0;

    // Cobertura de Pipeline vs Target ($Pipeline / Target)
    const targetLocal = monthlyTargetUSD * (rates[selectedCurrency] || 1);
    const coverageRatio = monthlyTargetUSD > 0 ? (totalUSD / monthlyTargetUSD).toFixed(1) : 0;

    const stagnantRate = activeOpsCount > 0 ? Math.round((stagnantOpsCount / activeOpsCount) * 100) : 0;
    const enterprisePct = totalUSD > 0 ? Math.round((enterpriseUSD / totalUSD) * 100) : 0;

    return {
      activeOpsCount,
      totalUSD,
      totalLocal,
      ponderadoUSD,
      ponderadoLocal,
      leadConvRate,
      fullFunnelRate,
      winRate,
      avgSalesCycle,
      totalLeads,
      velocityUSD,
      velocityLocal,
      coverageRatio,
      targetLocal,
      stagnantOpsCount,
      stagnantUSD,
      stagnantLocal,
      stagnantRate,
      enterpriseUSD,
      enterpriseCount,
      midMarketUSD,
      midMarketCount,
      smbUSD,
      smbCount,
      enterprisePct
    };
  })();

  // OS & Manual Theme Listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setThemeToggle(prev => prev + 1);
    mediaQuery.addEventListener('change', handleChange);
    
    // Observer for data-theme changes on html
    const observer = new MutationObserver(handleChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    };
  }, []);

  // Render Charts with Apple Palette & Theme awareness
  useEffect(() => {
    if (typeof window.Chart === 'undefined') return;

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDark = currentTheme === 'dark' || (currentTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    const textColor = isDark ? '#a1a1a6' : '#6e6e73';
    const textPrimaryColor = isDark ? '#ffffff' : '#1d1d1f';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    // 1. Embudo Comercial Inbound/Outbound (Horizontal Bar)
    if (funnelChartRef.current) {
      if (funnelInstance.current) funnelInstance.current.destroy();
      
      const leadsNuevos = leads.length;
      const leadsContactados = leads.filter(l => l.estado === 'contactado' || l.estado === 'calificado').length;
      const leadsCalificados = leads.filter(l => l.estado === 'calificado').length;
      const opsActivas = oportunidades.filter(o => o.etapa !== 'ganado' && o.etapa !== 'perdido').length;
      const opsGanadas = oportunidades.filter(o => o.etapa === 'ganado').length;

      const ctx = funnelChartRef.current.getContext('2d');
      funnelInstance.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Leads Registrados', 'Contactados', 'Calificados', 'Pipeline Activo', 'Negocios Ganados'],
          datasets: [{
            label: 'Conversión',
            data: [leadsNuevos, leadsContactados, leadsCalificados, opsActivas, opsGanadas],
            backgroundColor: isDark 
              ? ['#2997ff', '#64d2ff', '#ff9f0a', '#bf5af2', '#30d158']
              : ['#0071e3', '#30b0c7', '#ff9500', '#af52de', '#34c759'],
            borderRadius: 8,
            barThickness: 22
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

    // 2. Distribución de Pérdidas de Pipeline (Doughnut Dinámico)
    if (lossChartRef.current) {
      if (lossInstance.current) lossInstance.current.destroy();
      
      const configuredReasonsMap = {};
      if (Array.isArray(pipelineConfig?.lossReasons)) {
        pipelineConfig.lossReasons.forEach(r => {
          configuredReasonsMap[r.id.toLowerCase()] = r.label;
        });
      }

      const REASON_LABELS_MAP = {
        precio: '💵 Precio',
        cobertura: '📍 Cobertura',
        competencia: '🛡️ Competencia',
        tecnologia: '⚙️ Tecnología',
        otro: '❓ Otro',
        ...configuredReasonsMap
      };

      const dynamicLossCounts = {};
      const lostOps = oportunidades.filter(o => o.etapa === 'perdido');

      if (lostOps.length > 0) {
        lostOps.forEach(o => {
          const rawReason = (o.perdidaRazon || 'otro').trim();
          const displayLabel = REASON_LABELS_MAP[rawReason.toLowerCase()] || rawReason;
          dynamicLossCounts[displayLabel] = (dynamicLossCounts[displayLabel] || 0) + 1;
        });
      } else {
        const activeReasons = Array.isArray(pipelineConfig?.lossReasons) && pipelineConfig.lossReasons.length > 0
          ? pipelineConfig.lossReasons.map(r => r.label)
          : ['💵 Precio', '📍 Cobertura', '🛡️ Competencia', '⚙️ Tecnología', '❓ Otro'];
        activeReasons.forEach(r => { dynamicLossCounts[r] = 0; });
      }

      const ctx = lossChartRef.current.getContext('2d');
      lossInstance.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(dynamicLossCounts),
          datasets: [{
            data: Object.values(dynamicLossCounts),
            backgroundColor: isDark
              ? ['#ff453a', '#ff9f0a', '#ffd60a', '#64d2ff', '#bf5af2', '#8e8e93']
              : ['#ff3b30', '#ff9500', '#ffcc00', '#30b0c7', '#af52de', '#8e8e93'],
            borderWidth: 2,
            borderColor: isDark ? '#18181c' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: {
              position: 'right',
              labels: { color: textPrimaryColor, boxWidth: 12, padding: 12 }
            }
          }
        }
      });
    }

    // 3. Pipeline Activo por Ejecutivo
    if (leaderboardChartRef.current) {
      if (leaderboardInstance.current) leaderboardInstance.current.destroy();

      const commercialData = {};
      comerciales.forEach(u => {
        const email = u.email?.toLowerCase().trim();
        if (email) {
          commercialData[email] = {
            displayName: u.nombre ? u.nombre.split(' ')[0] : email.split('@')[0],
            totalAmount: 0
          };
          activeStages.forEach(st => {
            commercialData[email][st.id] = 0;
          });
        }
      });

      oportunidades.forEach(op => {
        if (op.etapa !== 'ganado' && op.etapa !== 'perdido') {
          const email = op.comercialEmail?.toLowerCase().trim();
          if (email) {
            if (!commercialData[email]) {
              commercialData[email] = {
                displayName: email.split('@')[0],
                totalAmount: 0
              };
              activeStages.forEach(st => { commercialData[email][st.id] = 0; });
            }
            const amount = Number(op.montoEstimadoMensual) || 0;
            const opCurrency = op.moneda || getCountryCurrency(op.pais);
            const rateToUSD = rates[opCurrency] || 1;
            const amountUSD = amount / rateToUSD;

            commercialData[email].totalAmount += amountUSD;
            commercialData[email][op.etapa] = (commercialData[email][op.etapa] || 0) + amountUSD;
          }
        }
      });

      const emailsList = Object.keys(commercialData).sort((a, b) => commercialData[b].totalAmount - commercialData[a].totalAmount);
      const xLabels = emailsList.map(e => commercialData[e].displayName);

      const appleColors = isDark 
        ? ['#2997ff', '#64d2ff', '#ff9f0a', '#bf5af2', '#30d158', '#ffd60a']
        : ['#0071e3', '#30b0c7', '#ff9500', '#af52de', '#34c759', '#ffcc00'];

      const datasets = activeStages.map((st, idx) => {
        const labelClean = st.label.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
        return {
          label: labelClean || st.id,
          data: emailsList.map(email => {
            const amountUSD = commercialData[email][st.id] || 0;
            return Math.round(currencyMode === 'local' && selectedCountry ? amountUSD * (rates[selectedCurrency] || 1) : amountUSD);
          }),
          backgroundColor: appleColors[idx % appleColors.length],
          borderRadius: 4,
          stack: 'Stack 0'
        };
      });

      const ctx = leaderboardChartRef.current.getContext('2d');
      leaderboardInstance.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: xLabels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textPrimaryColor, boxWidth: 10 }
            }
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: { color: textPrimaryColor, font: { weight: '600' } }
            },
            y: {
              stacked: true,
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                callback: (val) => {
                  const curr = currencyMode === 'local' && selectedCountry ? selectedCurrency : 'USD';
                  return `$${val.toLocaleString()} ${curr}`;
                }
              }
            }
          }
        }
      });
    }

    // 4. Segmentación de Pipeline por Tamaño de Deal (Tiers Enterprise, Mid-Market, SMB)
    if (tierChartRef.current) {
      if (tierInstance.current) tierInstance.current.destroy();

      const tierLabels = ['Enterprise (≥ $1k)', 'Mid-Market ($300-$1k)', 'SMB (< $300)'];
      const isLocal = currencyMode === 'local' && selectedCountry;
      const rate = isLocal ? (rates[selectedCurrency] || 1) : 1;

      const tierData = [
        Math.round(calculatedMetrics.enterpriseUSD * rate),
        Math.round(calculatedMetrics.midMarketUSD * rate),
        Math.round(calculatedMetrics.smbUSD * rate)
      ];

      const ctx = tierChartRef.current.getContext('2d');
      tierInstance.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: tierLabels,
          datasets: [{
            label: `Volumen (${isLocal ? selectedCurrency : 'USD'})`,
            data: tierData,
            backgroundColor: isDark ? ['#bf5af2', '#2997ff', '#30d158'] : ['#af52de', '#0071e3', '#34c759'],
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textPrimaryColor, font: { weight: '600' } } },
            y: {
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                callback: (val) => `$${val.toLocaleString()} ${isLocal ? selectedCurrency : 'USD'}`
              }
            }
          }
        }
      });
    }
  }, [leads, oportunidades, comerciales, themeToggle, exchangeRates, pipelineConfig, activePipeline, activeStages, currencyMode, selectedCurrency, selectedCountry, calculatedMetrics.enterpriseUSD, calculatedMetrics.midMarketUSD, calculatedMetrics.smbUSD]);

  const renderCurrencyString = (amountUSD, amountLocal) => {
    if (selectedCountry) {
      if (currencyMode === 'local') {
        return (
          <span className="fw-bold" style={{ color: 'var(--apple-text-primary)', fontSize: '1.35rem', letterSpacing: '-0.02em' }}>
            {amountLocal.toLocaleString(undefined, { style: 'currency', currency: selectedCurrency, maximumFractionDigits: 0 })}
          </span>
        );
      }
      if (currencyMode === 'usd') {
        return (
          <span className="fw-bold" style={{ color: 'var(--apple-text-primary)', fontSize: '1.35rem', letterSpacing: '-0.02em' }}>
            {amountUSD.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
          </span>
        );
      }
      return (
        <div className="d-flex flex-column gap-1">
          <span className="fw-bold" style={{ color: 'var(--apple-text-primary)', fontSize: '1.35rem', letterSpacing: '-0.02em' }}>
            {amountLocal.toLocaleString(undefined, { style: 'currency', currency: selectedCurrency, maximumFractionDigits: 0 })}
          </span>
          <span className="badge bg-secondary-subtle text-secondary align-self-start fw-semibold" style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '9999px' }}>
            {amountUSD.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} USD
          </span>
        </div>
      );
    }
    return (
      <span className="fw-bold" style={{ color: 'var(--apple-text-primary)', fontSize: '1.35rem', letterSpacing: '-0.02em' }}>
        {amountUSD.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
      </span>
    );
  };

  const getCoverageBadge = (ratio) => {
    const val = parseFloat(ratio) || 0;
    if (val >= 3.5) return { label: 'Óptima', cls: 'glow-green' };
    if (val >= 2.5) return { label: 'En Alerta', cls: 'glow-orange' };
    return { label: 'Crítica', cls: 'glow-red' };
  };

  const coverageInfo = getCoverageBadge(calculatedMetrics.coverageRatio);

  return (
    <div className="animate__animated animate__fadeIn">
      {/* Target & Currency Control Bar */}
      <div className="apple-toolbar-island mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <span className="small fw-semibold" style={{ fontSize: '0.82rem', color: 'var(--apple-text-secondary)' }}>
              <i className="bi bi-bullseye me-1" style={{ color: 'var(--luxia-brand, var(--apple-blue))' }}></i> Target Mensual:
            </span>
            <div className="apple-target-pill">
              <span className="fw-bold" style={{ fontSize: '0.82rem', color: 'var(--apple-text-tertiary)' }}>$</span>
              <input 
                type="number" 
                className="no-spinners"
                value={monthlyTargetUSD}
                onChange={(e) => setMonthlyTargetUSD(Math.max(1, Number(e.target.value) || 1))}
                title="Modificar Target de Ventas Mensual"
              />
              <span className="fw-semibold" style={{ fontSize: '0.75rem', color: 'var(--apple-text-tertiary)' }}>USD</span>
            </div>
          </div>
          
          <div className={`apple-badge-glow ${coverageInfo.cls}`}>
            <span className="pulse-dot"></span>
            <span>Cobertura {calculatedMetrics.coverageRatio}x ({coverageInfo.label})</span>
          </div>
        </div>

        {/* Apple Segmented Currency Mode Selector */}
        <div className="apple-segmented-control">
          <button 
            type="button" 
            className={`apple-segmented-item ${currencyMode === 'both' ? 'active' : ''}`} 
            onClick={() => setCurrencyMode('both')}
          >
            Ambas (Local + USD)
          </button>
          <button 
            type="button" 
            className={`apple-segmented-item ${currencyMode === 'local' ? 'active' : ''}`} 
            onClick={() => setCurrencyMode('local')}
            disabled={!selectedCountry}
          >
            Moneda Local
          </button>
          <button 
            type="button" 
            className={`apple-segmented-item ${currencyMode === 'usd' ? 'active' : ''}`} 
            onClick={() => setCurrencyMode('usd')}
          >
            Solo USD
          </button>
        </div>
      </div>

      {/* KPIs Grid 1: Executive Business Intelligence */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4 col-lg-2">
          <div className="kpi-card-ambient kpi-glow-blue h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-truncate" style={{ fontSize: '0.75rem', color: 'var(--apple-text-secondary)' }}>Forecast Ponderado</span>
              <div className="kpi-icon-badge kpi-icon-blue"><i className="bi bi-graph-up-arrow"></i></div>
            </div>
            <div className="my-1">
              {renderCurrencyString(calculatedMetrics.ponderadoUSD, calculatedMetrics.ponderadoLocal)}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--apple-text-tertiary)' }}>Monto aj. por probabilidad</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="kpi-card-ambient kpi-glow-teal h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-truncate" style={{ fontSize: '0.75rem', color: 'var(--apple-text-secondary)' }}>Pipeline Activo</span>
              <div className="kpi-icon-badge kpi-icon-teal"><i className="bi bi-funnel"></i></div>
            </div>
            <div className="my-1">
              {renderCurrencyString(calculatedMetrics.totalUSD, calculatedMetrics.totalLocal)}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--apple-text-tertiary)' }}>{calculatedMetrics.activeOpsCount} negocios activos</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="kpi-card-ambient kpi-glow-purple h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-truncate" style={{ fontSize: '0.75rem', color: 'var(--apple-text-secondary)' }}>Velocidad Revenue</span>
              <div className="kpi-icon-badge kpi-icon-purple"><i className="bi bi-lightning-charge"></i></div>
            </div>
            <div className="my-1">
              {renderCurrencyString(calculatedMetrics.velocityUSD, calculatedMetrics.velocityLocal)}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--apple-text-tertiary)' }}>Generación $/día esperada</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="kpi-card-ambient kpi-glow-green h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-truncate" style={{ fontSize: '0.75rem', color: 'var(--apple-text-secondary)' }}>Ticket Promedio</span>
              <div className="kpi-icon-badge kpi-icon-green"><i className="bi bi-receipt"></i></div>
            </div>
            <div className="my-1">
              {renderCurrencyString(
                calculatedMetrics.activeOpsCount > 0 ? calculatedMetrics.totalUSD / calculatedMetrics.activeOpsCount : 0,
                calculatedMetrics.activeOpsCount > 0 ? calculatedMetrics.totalLocal / calculatedMetrics.activeOpsCount : 0
              )}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--apple-text-tertiary)' }}>Monto medio por deal</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="kpi-card-ambient kpi-glow-orange h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-truncate" style={{ fontSize: '0.75rem', color: 'var(--apple-text-secondary)' }}>Win Rate</span>
              <div className="kpi-icon-badge kpi-icon-orange"><i className="bi bi-trophy"></i></div>
            </div>
            <h4 className="fw-bold mb-0 my-1" style={{ fontSize: '1.45rem', color: 'var(--apple-orange)', letterSpacing: '-0.02em' }}>
              {calculatedMetrics.winRate}%
            </h4>
            <span style={{ fontSize: '0.7rem', color: 'var(--apple-text-tertiary)' }}>Efectividad de cierre</span>
          </div>
        </div>

        <div className="col-6 col-md-4 col-lg-2">
          <div className="kpi-card-ambient kpi-glow-indigo h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-truncate" style={{ fontSize: '0.75rem', color: 'var(--apple-text-secondary)' }}>Ciclo Venta</span>
              <div className="kpi-icon-badge kpi-icon-indigo"><i className="bi bi-clock-history"></i></div>
            </div>
            <h4 className="fw-bold mb-0 my-1" style={{ fontSize: '1.45rem', color: 'var(--apple-text-primary)', letterSpacing: '-0.02em' }}>
              {calculatedMetrics.avgSalesCycle} <span style={{ fontSize: '0.8rem', color: 'var(--apple-text-secondary)', fontWeight: 500 }}>días</span>
            </h4>
            <span style={{ fontSize: '0.7rem', color: 'var(--apple-text-tertiary)' }}>Lead a Cierre Ganado</span>
          </div>
        </div>
      </div>

      {/* KPIs Grid 2: Indicadores Avanzados de Salud de Negocio */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="kpi-card-ambient kpi-glow-blue h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Cobertura de Meta</span>
              <div className="kpi-icon-badge kpi-icon-blue"><i className="bi bi-shield-check"></i></div>
            </div>
            <h4 className="fw-bold mb-0 my-1" style={{ fontSize: '1.65rem', color: 'var(--apple-blue)', letterSpacing: '-0.02em' }}>
              {calculatedMetrics.coverageRatio}x
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--apple-text-tertiary)' }}>Vs. Target (${monthlyTargetUSD.toLocaleString()} USD)</span>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="kpi-card-ambient kpi-glow-red h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Riesgo Estancamiento</span>
              <div className="kpi-icon-badge kpi-icon-red"><i className="bi bi-exclamation-triangle"></i></div>
            </div>
            <h4 className="fw-bold mb-0 my-1" style={{ fontSize: '1.65rem', color: 'var(--apple-red)', letterSpacing: '-0.02em' }}>
              {calculatedMetrics.stagnantRate}%
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--apple-text-tertiary)' }}>
              {renderCurrencyString(calculatedMetrics.stagnantUSD, calculatedMetrics.stagnantLocal)} en riesgo
            </span>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="kpi-card-ambient kpi-glow-green h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Conversión End-to-End</span>
              <div className="kpi-icon-badge kpi-icon-green"><i className="bi bi-arrow-repeat"></i></div>
            </div>
            <h4 className="fw-bold mb-0 my-1" style={{ fontSize: '1.65rem', color: 'var(--apple-green)', letterSpacing: '-0.02em' }}>
              {calculatedMetrics.fullFunnelRate}%
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--apple-text-tertiary)' }}>De Lead Total a Cliente Ganado</span>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="kpi-card-ambient kpi-glow-teal h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Aportación Enterprise</span>
              <div className="kpi-icon-badge kpi-icon-teal"><i className="bi bi-buildings"></i></div>
            </div>
            <h4 className="fw-bold mb-0 my-1" style={{ fontSize: '1.65rem', color: 'var(--apple-teal)', letterSpacing: '-0.02em' }}>
              {calculatedMetrics.enterprisePct}%
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--apple-text-tertiary)' }}>{calculatedMetrics.enterpriseCount} negocios ≥ $1,000 USD/mes</span>
          </div>
        </div>
      </div>

      {/* Charts Panel */}
      <div className="row g-4 mb-4">
        {/* Funnel Chart */}
        <div className="col-lg-6">
          <div className="apple-card p-4 h-100 d-flex flex-column" style={{ minHeight: '360px' }}>
            <h6 className="fw-bold mb-3" style={{ color: 'var(--apple-text-primary)' }}>
              <i className="bi bi-funnel-fill text-primary me-2"></i>Embudo Comercial Inbound/Outbound
            </h6>
            <div className="position-relative flex-grow-1" style={{ height: '260px' }}>
              <canvas ref={funnelChartRef}></canvas>
            </div>
          </div>
        </div>

        {/* Loss Reasons */}
        <div className="col-lg-6">
          <div className="apple-card p-4 h-100 d-flex flex-column" style={{ minHeight: '360px' }}>
            <h6 className="fw-bold mb-3" style={{ color: 'var(--apple-text-primary)' }}>
              <i className="bi bi-x-circle-fill text-danger me-2"></i>Distribución de Pérdidas de Pipeline
            </h6>
            <div className="position-relative flex-grow-1" style={{ height: '260px' }}>
              <canvas ref={lossChartRef}></canvas>
            </div>
          </div>
        </div>

        {/* Segmentación por Tamaño de Deal */}
        <div className="col-lg-6">
          <div className="apple-card p-4 h-100 d-flex flex-column" style={{ minHeight: '380px' }}>
            <h6 className="fw-bold mb-3" style={{ color: 'var(--apple-text-primary)' }}>
              <i className="bi bi-diagram-3-fill me-2" style={{ color: 'var(--apple-indigo)' }}></i>
              Segmentación por Tamaño de Deal (Tiers)
            </h6>
            <div className="position-relative flex-grow-1" style={{ height: '270px' }}>
              <canvas ref={tierChartRef}></canvas>
            </div>
          </div>
        </div>

        {/* Leaderboard Stacked Bar Chart */}
        <div className="col-lg-6">
          <div className="apple-card p-4 h-100 d-flex flex-column" style={{ minHeight: '380px' }}>
            <h6 className="fw-bold mb-3" style={{ color: 'var(--apple-text-primary)' }}>
              <i className="bi bi-trophy-fill text-warning me-2"></i>
              Pipeline Activo por Ejecutivo ({currencyMode === 'local' && selectedCountry ? selectedCurrency : 'USD'})
            </h6>
            <div className="position-relative flex-grow-1" style={{ height: '270px' }}>
              <canvas ref={leaderboardChartRef}></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
