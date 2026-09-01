import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getConfigGeneral } from '../../lib/configGeneral';

export function HealthScoreTimeline({ clientData }) {
  const clienteId = clientData?.id;

  const [history, setHistory] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  useEffect(() => {
    if (!clienteId) {
      setHistory([]);
      setContratos([]);
      setOnboarding(null);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [contratosRes, onboardingData, healthHist] = await Promise.all([
          supabase.from('contratos').select('*').eq('cliente_id', clienteId),
          getConfigGeneral(`onboarding_${clienteId}`),
          getConfigGeneral(`health_history_${clienteId}`)
        ]);

        if (contratosRes.data) {
          const mapped = contratosRes.data.map(c => ({
            id: c.id,
            estadoSLA: c.estado_sla || 'Vigente',
            esContratoVigente: c.es_contrato_vigente
          }));
          setContratos(mapped);
        }

        if (onboardingData) {
          setOnboarding(onboardingData);
        }

        if (healthHist && Array.isArray(healthHist)) {
          setHistory(healthHist);
        } else {
          // Si no hay historial previo, inicializar con score actual
          const currentScore = clientData?.healthScore || clientData?.health_score || 85;
          setHistory([{
            id: 'h_initial',
            score: currentScore,
            timestamp: new Date().toISOString()
          }]);
        }
      } catch (err) {
        console.error("Error al cargar datos de salud del cliente:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clienteId, clientData]);

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-success spinner-border-sm" role="status"></div>
        <div className="text-muted small mt-2">Cargando histórico de salud...</div>
      </div>
    );
  }

  // 4. Cálculos de factores en tiempo real para evitar indicadores fijos
  const onboardingCompletoRealtime = onboarding
    ? onboarding.porcentajeCompletado === 100
    : (clientData?.estado !== 'Onboarding');
  
  const tieneContratos = contratos.length > 0;
  const tieneContratosVencidos = contratos.some(c => c.estadoSLA && (c.estadoSLA.includes('Vencido') || c.estadoSLA.includes('Rojo') || c.estadoSLA.includes('Naranja')));
  const contratoVigenteRealtime = tieneContratos && !tieneContratosVencidos;

  const palabrasCriticas = ['alerta', 'riesgo', 'grave', 'urgente', 'queja', 'incidente', 'problema', 'demora', 'fallo', 'reclamación'];
  const obsLower = (clientData?.observaciones || '').toLowerCase().trim();
  
  // Si la observación está vacía o es una frase genérica de éxito/marcador, no es crítica
  const esVacioOGenerico = !obsLower || 
                           obsLower === 'sin observaciones' || 
                           obsLower === 'ninguna' || 
                           obsLower === 'no tiene' || 
                           obsLower === 'sin comentarios' ||
                           obsLower === 'estable';
  
  const observacionesCriticasRealtime = !esVacioOGenerico && palabrasCriticas.some(word => {
    // Evitar falsos positivos simples (ej: "sin incidentes", "no hay incidentes", "no tiene problemas")
    if (obsLower.includes('sin ' + word) || 
        obsLower.includes('no hay ' + word) || 
        obsLower.includes('no tiene ' + word) || 
        obsLower.includes('cero ' + word) || 
        obsLower.includes('0 ' + word) || 
        obsLower.includes('sin ' + word + 's') || 
        obsLower.includes('no hay ' + word + 's')) {
      return false;
    }
    return obsLower.includes(word);
  });

  // Campos Dinámicos con Vencimiento
  const getDynamicFieldsRisk = () => {
    let expired = [];
    let expiringSoon = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checkFields = (campos) => {
      if (!campos) return;
      Object.keys(campos).forEach(key => {
        const field = campos[key];
        if (field && typeof field === 'object' && field.fechaVencimiento) {
          const expiration = new Date(field.fechaVencimiento);
          expiration.setHours(0, 0, 0, 0);
          const diffTime = expiration.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            expired.push(field.nombreArchivo || key);
          } else if (diffDays <= 30) {
            expiringSoon.push(field.nombreArchivo || key);
          }
        }
      });
    };

    checkFields(clientData?.camposDinamicos);
    contratos.forEach(c => checkFields(c.camposDinamicos));
    
    return { expired, expiringSoon };
  };

  const dynamicFieldsRisk = getDynamicFieldsRisk();
  const tieneCamposVencidos = dynamicFieldsRisk.expired.length > 0;
  const tieneCamposPorVencer = dynamicFieldsRisk.expiringSoon.length > 0;

  const factores = {
    onboardingCompleto: onboardingCompletoRealtime,
    contratoVigente: contratoVigenteRealtime,
    observacionesCriticas: observacionesCriticasRealtime,
    documentosAlDia: !tieneCamposVencidos && !tieneCamposPorVencer,
    camposVencidos: dynamicFieldsRisk.expired.join(', '),
    camposPorVencer: dynamicFieldsRisk.expiringSoon.join(', ')
  };

  const hasHistory = history.length > 0;
  const latestPoint = hasHistory ? history[history.length - 1] : null;
  const displayedPoint = hoveredPoint || latestPoint;

  // Generar coordenadas SVG
  const width = 500;
  const height = 150;
  const paddingX = 40;
  const paddingY = 20;

  const points = history.map((h, index) => {
    const totalPoints = history.length;
    // Distribuir equitativamente en eje X
    const x = totalPoints > 1 
      ? paddingX + (index * (width - 2 * paddingX)) / (totalPoints - 1)
      : width / 2;

    // Eje Y mapeado de score (0 a 100)
    // 100 score -> paddingY (arriba)
    // 0 score -> height - paddingY (abajo)
    const score = typeof h.score === 'number' ? h.score : (h.riesgo === 'Green' ? 90 : h.riesgo === 'Yellow' ? 55 : 20);
    const y = height - paddingY - (score * (height - 2 * paddingY)) / 100;

    return { x, y, data: h, score };
  });

  // Trazar línea y área del gráfico SVG
  let linePath = '';
  let areaPath = '';

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    areaPath = linePath + ` L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;
  }

  return (
    <div className="health-timeline-card mt-3">
      <div className="row g-3">
        {/* Gráfico Histórico */}
        <div className="col-md-8">
          <div className="card border-0 bg-light rounded-4 p-3 shadow-sm h-100">
            <h6 className="fw-bold text-dark mb-3">
              <i className="bi bi-activity text-success me-2"></i>Historial de Salud (Últimos 90 días)
            </h6>

            {!hasHistory ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
                <i className="bi bi-graph-up fs-2 mb-2 opacity-50"></i>
                <span className="small">No se registran mediciones de salud previas.</span>
                <span className="small text-center px-4 mt-1 opacity-75">
                  Ejecuta una "Evaluación IA" para generar la primera medición histórica del cliente.
                </span>
              </div>
            ) : (
              <div className="position-relative">
                {/* SVG Autogestionado */}
                <svg viewBox={`0 0 ${width} ${height}`} className="w-100 overflow-visible">
                  <defs>
                    <linearGradient id="healthAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#198754" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#198754" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="healthLineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0d6efd" />
                      <stop offset="50%" stopColor="#198754" />
                      <stop offset="100%" stopColor="#198754" />
                    </linearGradient>
                  </defs>

                  {/* Ejes e indicador de fondo */}
                  <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e9ecef" strokeWidth="2" />
                  <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="#e9ecef" strokeWidth="1" strokeDasharray="3" />

                  {/* Marcadores de Eje Y */}
                  <text x={paddingX - 10} y={paddingY + 4} textAnchor="end" fill="#adb5bd" fontSize="9px">100</text>
                  <text x={paddingX - 10} y={height / 2 + 4} textAnchor="end" fill="#adb5bd" fontSize="9px">50</text>
                  <text x={paddingX - 10} y={height - paddingY + 4} textAnchor="end" fill="#adb5bd" fontSize="9px">0</text>

                  {/* Renderizado de Área e Hilo */}
                  {points.length > 1 && (
                    <>
                      <path d={areaPath} fill="url(#healthAreaGrad)" />
                      <path d={linePath} fill="none" stroke="url(#healthLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}

                  {/* Puntos Interactivos */}
                  {points.map((p, idx) => {
                    const isHovered = hoveredPoint?.id === p.data.id;
                    const dateText = p.data.timestamp
                      ? p.data.timestamp.toDate?.().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) || ''
                      : '';
                    
                    return (
                      <g key={p.data.id} className="cursor-pointer">
                        {/* Círculo invisible más grande para facilitar el hover móvil */}
                        <circle 
                          cx={p.x} 
                          cy={p.y} 
                          r="12" 
                          fill="transparent" 
                          onMouseEnter={() => setHoveredPoint(p.data)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        {/* Círculo visual */}
                        <circle 
                          cx={p.x} 
                          cy={p.y} 
                          r={isHovered ? "6" : "4"} 
                          fill={p.data.riesgo === 'Green' ? '#198754' : p.data.riesgo === 'Yellow' ? '#ffc107' : '#dc3545'} 
                          stroke="#ffffff" 
                          strokeWidth="2"
                          style={{ transition: 'r 0.2s ease, fill 0.2s ease' }}
                        />
                        {/* Score sobre el punto */}
                        <text 
                          x={p.x} 
                          y={p.y - 12} 
                          textAnchor="middle" 
                          fill={isHovered ? "#212529" : "#6c757d"} 
                          fontSize={isHovered ? "11px" : "9px"} 
                          fontWeight="bold"
                          style={{ transition: 'all 0.2s ease' }}
                        >
                          {p.score}%
                        </text>
                        {/* Texto de fecha debajo del eje */}
                        {points.length <= 6 || idx === 0 || idx === points.length - 1 || idx % 2 === 0 ? (
                          <text x={p.x} y={height - 5} textAnchor="middle" fill="#adb5bd" fontSize="8px">{dateText}</text>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>

                {/* Floating tooltip removed as scores are now on the curve */}

                {/* Justificación de la IA Detallada */}
                {displayedPoint && displayedPoint.analisis && (
                  <div className="mt-4 p-3 bg-white rounded-3 border-start border-4 border-primary shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.85rem' }}>
                          <i className="bi bi-robot text-primary me-2"></i>Análisis de Gemini
                        </h6>
                        <span className="badge bg-light text-dark border">
                          Score: {displayedPoint.score || (displayedPoint.riesgo === 'Green' ? 90 : displayedPoint.riesgo === 'Yellow' ? 55 : 20)}%
                        </span>
                        <span className={`badge ${displayedPoint.riesgo === 'Green' ? 'bg-success' : displayedPoint.riesgo === 'Yellow' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                          {displayedPoint.riesgo === 'Green' ? 'Urgencia Baja' : displayedPoint.riesgo === 'Yellow' ? 'Urgencia Media' : displayedPoint.riesgo === 'Red' ? 'Urgencia Alta' : (displayedPoint.riesgo || 'N/A')}
                        </span>
                      </div>
                      <span className="text-muted small" style={{ fontSize: '0.70rem' }}>
                        <i className="bi bi-clock-history me-1"></i>
                        {displayedPoint.timestamp?.toDate?.().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'Reciente'}
                      </span>
                    </div>
                    <p className="text-muted mb-0" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                      {displayedPoint.analisis}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panel Lateral de Factores Operativos */}
        <div className="col-md-4">
          <div className="card border-0 bg-light rounded-4 p-3 shadow-sm h-100 d-flex flex-column">
            <h6 className="fw-bold text-dark mb-3">
              <i className="bi bi-shield-check text-primary me-2"></i>Factores de Riesgo (Último Análisis)
            </h6>

            <div className="d-flex flex-column gap-3 flex-grow-1 justify-content-center">
              {/* Factor 1: Onboarding */}
              <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded-3 border-start border-3 border-primary">
                <div>
                  <div className="fw-bold small text-dark">Onboarding Completado</div>
                  <div className="text-muted small" style={{ fontSize: '0.70rem' }}>
                    {factores.onboardingCompleto ? 'Activación completada (100%)' : 'Checklist con tareas pendientes'}
                  </div>
                </div>
                <div className="fs-5">
                  {factores.onboardingCompleto ? (
                    <i className="bi bi-patch-check-fill text-success" title="Completado"></i>
                  ) : (
                    <i className="bi bi-exclamation-triangle-fill text-warning" title="Pendiente"></i>
                  )}
                </div>
              </div>

              {/* Factor 2: Contrato Vigente */}
              <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded-3 border-start border-3 border-info">
                <div>
                  <div className="fw-bold small text-dark">Contratos Vigentes</div>
                  <div className="text-muted small" style={{ fontSize: '0.70rem' }}>
                    {factores.contratoVigente ? 'SLA y contratos vigentes' : 'Contratos vencidos o en riesgo'}
                  </div>
                </div>
                <div className="fs-5">
                  {factores.contratoVigente ? (
                    <i className="bi bi-file-earmark-check-fill text-success" title="Vigente"></i>
                  ) : (
                    <i className="bi bi-file-earmark-x-fill text-danger" title="Vencido/Riesgo"></i>
                  )}
                </div>
              </div>

              {/* Factor 3: Notas Críticas */}
              <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded-3 border-start border-3 border-danger">
                <div>
                  <div className="fw-bold small text-dark">Notas Operativas Estables</div>
                  <div className="text-muted small" style={{ fontSize: '0.70rem' }}>
                    {factores.observacionesCriticas ? 'Atención: quejas o incidentes' : 'Sin incidentes críticos'}
                  </div>
                </div>
                <div className="fs-5">
                  {!factores.observacionesCriticas ? (
                    <i className="bi bi-shield-fill-check text-success" title="Estable"></i>
                  ) : (
                    <i className="bi bi-shield-fill-exclamation text-danger" title="Atención Urgente"></i>
                  )}
                </div>
              </div>

              {/* Factor 4: Alertas de Campos Dinámicos */}
              <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded-3 border-start border-3 border-secondary">
                <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                  <div className="fw-bold small text-dark text-truncate">Doc. y Seguros al Día</div>
                  <div className="text-muted small" style={{ fontSize: '0.70rem', lineHeight: '1.2' }} title={
                    factores.camposVencidos ? `Vencidos: ${factores.camposVencidos}` : 
                    factores.camposPorVencer ? `Alerta 30d: ${factores.camposPorVencer}` : 'Documentación vigente'
                  }>
                    {factores.documentosAlDia ? 'Documentación vigente' : 
                     (factores.camposVencidos ? `Vencidos: ${factores.camposVencidos}` : `Alerta: ${factores.camposPorVencer}`)}
                  </div>
                </div>
                <div className="fs-5 flex-shrink-0">
                  {factores.documentosAlDia ? (
                    <i className="bi bi-folder-check-fill text-success" title="Documentos al Día"></i>
                  ) : (
                    <i className={`bi bi-folder-x-fill ${factores.camposVencidos ? 'text-danger' : 'text-warning'}`} title="Existen alertas de vencimiento"></i>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
