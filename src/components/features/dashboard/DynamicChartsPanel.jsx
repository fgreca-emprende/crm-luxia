import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral } from '../../../lib/configGeneral';
import { DynamicChart } from '../../ui/DynamicChart';

export function DynamicChartsPanel({ activeTab }) {
  const [activeKpis, setActiveKpis] = useState([]);
  const [kpiResults, setKpiResults] = useState({});

  useEffect(() => {
    const loadDynamicKpis = async () => {
      try {
        const defs = await getConfigGeneral('kpi_definitions');
        if (Array.isArray(defs)) {
          setActiveKpis(defs.filter(d => d.status === 'active'));
        }

        const results = await getConfigGeneral('kpi_results');
        if (results && typeof results === 'object') {
          setKpiResults(results);
        }
      } catch (err) {
        console.warn('Error loading dynamic kpis:', err);
      }
    };
    loadDynamicKpis();
  }, []);

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    try {
      if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
      if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
      if (ts._seconds) return new Date(ts._seconds * 1000).toLocaleString();
      return new Date(ts).toLocaleString();
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  const kpisToShow = activeKpis.filter(kpi => (kpi.dashboardTab || 'cartera') === activeTab);

  if (kpisToShow.length === 0) return null;

  return (
    <div className="row g-3 mt-1">
      {kpisToShow.map(kpi => {
        const result = kpiResults[kpi.id];
        
        return (
          <div key={kpi.id} className="col-md-6">
            <div className="card-premium h-100 p-4 d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h6 className="fw-bold text-dark mb-0">
                    <i className="bi bi-graph-up-arrow text-primary me-2"></i>{kpi.nombre}
                  </h6>
                  <p className="small text-muted mb-0 mt-1" style={{ fontSize: '0.75rem' }}>{kpi.descripcion}</p>
                </div>
                <span className="badge bg-primary bg-opacity-10 text-primary small px-2 py-1 fw-bold rounded-pill">
                  Dinámico
                </span>
              </div>
              <div className="flex-grow-1 position-relative" style={{ minHeight: '260px', height: '260px' }}>
                {!result ? (
                  <div className="d-flex align-items-center justify-content-center h-100 text-muted small bg-light rounded-3 border border-dashed">
                    <div className="spinner-border spinner-border-sm me-2 text-primary"></div> Esperando al Data Cruncher...
                  </div>
                ) : (
                  <DynamicChart 
                    chartType={kpi.chartType} 
                    data={result.data || []} 
                    xAxisKey={result.xAxisKey || 'label'} 
                    yAxisKeys={result.yAxisKeys || ['value']} 
                  />
                )}
              </div>
              {result && result.lastUpdated && (
                <div className="text-end mt-2">
                  <span className="small text-muted" style={{ fontSize: '0.65rem' }}>
                    Actualizado: {formatTimestamp(result.lastUpdated)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
