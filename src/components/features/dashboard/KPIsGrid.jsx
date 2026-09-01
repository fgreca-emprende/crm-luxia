import { FinancialMetrics } from './FinancialMetrics';

export function KPIsGrid({ metrics, financeStats }) {
  const renderLoadingSkeleton = (width = '70px') => (
    <div className="skeleton-shimmer" style={{ width, height: '28px', display: 'inline-block', verticalAlign: 'middle', margin: '2px 0', borderRadius: 'var(--apple-radius-sm)' }}></div>
  );

  return (
    <div className="row g-3 mb-4">
      {/* FILA 1: Crecimiento y Salud */}
      
      {/* Card 1: Total Clientes */}
      <div className="col-12 col-md-3">
        <div className="kpi-card-ambient kpi-glow-blue h-100 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Total Clientes</span>
              <div className="kpi-icon-badge kpi-icon-blue"><i className="bi bi-people-fill"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-text-primary)', letterSpacing: '-0.02em' }}>
              {metrics.loading ? renderLoadingSkeleton('60px') : metrics.totalClientes}
            </h3>
          </div>
          <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Base Operativa Luxia</p>
        </div>
      </div>

      {/* Card 2: Tasa de Retención Bruta */}
      <div className="col-12 col-md-3">
        <div className="kpi-card-ambient kpi-glow-green h-100 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Retención Bruta (GRR)</span>
              <div className="kpi-icon-badge kpi-icon-green"><i className="bi bi-shield-check"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-green)', letterSpacing: '-0.02em' }}>
              {metrics.loading ? renderLoadingSkeleton('80px') : `${metrics.tasaRetencion}%`}
            </h3>
          </div>
          <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Meta: &gt;90% anual</p>
        </div>
      </div>

      {/* Card 3: Retención Neta de Ingresos (NRR / NDR) */}
      <div className="col-12 col-md-3">
        <div className="kpi-card-ambient kpi-glow-blue h-100 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Retención Neta (NRR)</span>
              <div className="kpi-icon-badge kpi-icon-blue"><i className="bi bi-graph-up-arrow"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-blue)', letterSpacing: '-0.02em' }}>
              {metrics.loading ? renderLoadingSkeleton('80px') : `${metrics.nrrPct ?? 100}%`}
            </h3>
          </div>
          <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Expansión vs. Churn</p>
        </div>
      </div>

      {/* Card 4: Salud Promedio (IA) */}
      <div className="col-12 col-md-3">
        <div className="kpi-card-ambient kpi-glow-purple h-100 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Salud Promedio (IA)</span>
              <div className="kpi-icon-badge kpi-icon-purple"><i className="bi bi-heart-pulse-fill"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-purple)', letterSpacing: '-0.02em' }}>
              {metrics.loading ? renderLoadingSkeleton('80px') : `${metrics.saludPromedio}%`}
            </h3>
          </div>
          <div className="progress mt-2" style={{ height: '6px', backgroundColor: 'var(--apple-surface-subtle)', borderRadius: 'var(--apple-radius-pill)' }}>
            <div className="progress-bar" role="progressbar" style={{ width: metrics.loading ? '0%' : `${metrics.saludPromedio}%`, backgroundColor: 'var(--apple-purple)', borderRadius: 'var(--apple-radius-pill)' }}></div>
          </div>
        </div>
      </div>

      {/* FILA 2: Riesgo, Concentración y Alertas */}
      
      {/* Card 5: Clientes Críticos */}
      <div className="col-12 col-md-3">
        <div className="kpi-card-ambient kpi-glow-red h-100 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Clientes Críticos</span>
              <div className="kpi-icon-badge kpi-icon-red"><i className="bi bi-exclamation-triangle-fill"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-red)', letterSpacing: '-0.02em' }}>
              {metrics.loading ? renderLoadingSkeleton('50px') : metrics.clientesCriticos}
            </h3>
          </div>
          <p className="small fw-semibold mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-red)' }}>Requieren llamada preventiva</p>
        </div>
      </div>

      {/* Card 6: Concentración Top 5 Cuentas */}
      <div className="col-12 col-md-3">
        <div className="kpi-card-ambient kpi-glow-orange h-100 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Concentración Top 5</span>
              <div className="kpi-icon-badge kpi-icon-orange"><i className="bi bi-pie-chart-fill"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-orange)', letterSpacing: '-0.02em' }}>
              {metrics.loading ? renderLoadingSkeleton('60px') : `${metrics.top5Concentration ?? 0}%`}
            </h3>
          </div>
          <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>% MRR en 5 mayores cuentas</p>
        </div>
      </div>

      {/* Card 7: Contratos en Riesgo */}
      <div className="col-12 col-md-3">
        <div className="kpi-card-ambient kpi-glow-orange h-100 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Por Vencer (60d)</span>
              <div className="kpi-icon-badge kpi-icon-orange"><i className="bi bi-calendar-event"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-orange)', letterSpacing: '-0.02em' }}>
              {metrics.loading ? renderLoadingSkeleton('50px') : (metrics.renewals60Count ?? metrics.contratosRiesgo)}
            </h3>
          </div>
          <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Renovación preventiva</p>
        </div>
      </div>

      {/* Card 8: Días sin Churn */}
      <div className="col-12 col-md-3">
        <div className="kpi-card-ambient kpi-glow-teal h-100 d-flex flex-column justify-content-between">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>Días sin Churn</span>
              <div className="kpi-icon-badge kpi-icon-teal"><i className="bi bi-trophy-fill"></i></div>
            </div>
            <h3 className="fw-bold mb-0 my-1" style={{ fontSize: '1.75rem', color: 'var(--apple-teal)', letterSpacing: '-0.02em' }}>
              {metrics.loading ? renderLoadingSkeleton('50px') : metrics.diasSinChurn}
            </h3>
          </div>
          <p className="small mb-0 mt-2" style={{ fontSize: '0.72rem', color: 'var(--apple-text-secondary)' }}>Racha de retención</p>
        </div>
      </div>

      {/* FILA 3: Métricas Financieras Desglosadas */}
      <div className="col-12 col-md-4">
        <FinancialMetrics
          title="MRR Vigente por Moneda"
          subtitle="Facturación recurrente mensual"
          data={financeStats?.mrrPorMoneda}
          loading={metrics.loading}
          borderClass="border-start border-primary border-4"
        />
      </div>

      <div className="col-12 col-md-4">
        <FinancialMetrics
          title="ARR Proyectado (Contratos)"
          subtitle="Valor anual total contratado"
          data={financeStats?.arrPorMoneda}
          loading={metrics.loading}
          borderClass="border-start border-success border-4"
        />
      </div>

      <div className="col-12 col-md-4">
        <FinancialMetrics
          title="MRR en Riesgo (Cuentas Rojas)"
          subtitle="Impacto de cuentas críticas"
          data={financeStats?.mrrRiesgoPorMoneda}
          loading={metrics.loading}
          borderClass="border-start border-danger border-4"
          titleColorClass="text-danger"
        />
      </div>
    </div>
  );
}
