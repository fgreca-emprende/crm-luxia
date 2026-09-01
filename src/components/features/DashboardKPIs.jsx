import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../contexts/UserRoleContext';
import { getConfigGeneral, setConfigGeneral } from '../../lib/configGeneral';
import { dbTracker } from '../../lib/api';
import { KPIsGrid } from './dashboard/KPIsGrid';
import { ChartsPanel } from './dashboard/ChartsPanel';
import { GamificationPanel } from './dashboard/GamificationPanel';
import { DynamicChartsPanel } from './dashboard/DynamicChartsPanel';
import { PipelineChartsPanel } from './dashboard/PipelineChartsPanel';
import { AgentPresenceMonitor } from './dashboard/AgentPresenceMonitor';

export function DashboardKPIs({ selectedCountry, user }) {
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline', 'cartera' o 'logros'
  
  const normalizarEquipo = (teamStr) => {
    if (!teamStr) return '';
    return teamStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  // Rol desde el contexto compartido
  const { isAdmin, loading: roleLoading, role, userTeam, getDataScope } = useUserRole();
  const normalizedTeam = normalizarEquipo(userTeam);
  
  const leadsScope = getDataScope('leads');
  const oportunidadesScope = getDataScope('oportunidades');
  const clientScope = getDataScope('clientes');

  const isRestricted = leadsScope === 'TEAM' || oportunidadesScope === 'TEAM' || clientScope === 'TEAM' || leadsScope === 'OWN' || oportunidadesScope === 'OWN' || clientScope === 'OWN';
  const isAgent = role === 'agente';

  const [selectedComercial, setSelectedComercial] = useState('');
  const [comerciales, setComerciales] = useState([]);
  const [equipos, setEquipos] = useState([]);

  useEffect(() => {
    const loadEquipos = async () => {
      try {
        const conf = await getConfigGeneral('equipos');
        if (conf && Array.isArray(conf.lista)) {
          setEquipos(conf.lista);
        } else {
          setEquipos([
            { id: 'Global', nombre: 'Global', participaGamificacion: false },
            { id: 'CX', nombre: 'CX (Atención al Cliente)', participaGamificacion: true },
            { id: 'Adquisicion', nombre: 'Adquisición (Hunting)', participaGamificacion: true },
            { id: 'Retencion', nombre: 'Retención (Farming)', participaGamificacion: true },
            { id: 'Administracion', nombre: 'Administración', participaGamificacion: false },
            { id: 'Finanzas', nombre: 'Finanzas', participaGamificacion: false },
            { id: 'Legales', nombre: 'Legales', participaGamificacion: false }
          ]);
        }
      } catch (err) {
        console.error("Error al cargar equipos en DashboardKPIs:", err);
      }
    };
    loadEquipos();
  }, []);

  useEffect(() => {
    const loadComerciales = async () => {
      try {
        const { data, error } = await supabase.from('usuarios').select('*');
        if (data && !error) {
          const temp = {};
          data.forEach(u => {
            const email = (u.email || u.id || '').toLowerCase().trim();
            if (!email || !email.includes('@')) return;
            
            const currentName = u.nombre || '';
            const hasRealName = currentName && !currentName.includes('@');
            
            if (!temp[email] || (!temp[email].hasRealName && hasRealName)) {
              temp[email] = {
                email: email,
                nombre: u.nombre || email,
                gamificacion: u.gamificacion,
                capacitacion: u.capacitacion,
                equipo: u.equipo,
                hasRealName: !!hasRealName
              };
            }
          });
          setComerciales(Object.values(temp));
        }
      } catch (err) {
        console.error("Error al cargar usuarios en DashboardKPIs:", err);
      }
    };
    loadComerciales();
  }, []);

  // Diccionario in-memory para rastrear metadata de cada cliente en tiempo real
  const [clientMetadata, setClientMetadata] = useState({});

  // --- Estados de Arquitectura de Negocio (Hunting vs Farming) ---
  const [businessConfig, setBusinessConfig] = useState({ mesesParaRetencion: 3 });
  const [dashboardView, setDashboardView] = useState('Global'); // 'Global', 'Adquisicion', 'Retencion'

  // Force dashboard view based on userTeam (only if restricted to Adquisicion/Retencion)
  useEffect(() => {
    if (isRestricted) {
      if (normalizedTeam === 'adquisicion') setDashboardView('Adquisicion');
      if (normalizedTeam === 'retencion') setDashboardView('Retencion');
    }
  }, [isRestricted, normalizedTeam]);

  useEffect(() => {
    if (activeTab !== 'logros' && dashboardView === 'Soporte') {
      setDashboardView('Global');
    }
  }, [activeTab, dashboardView]);

  useEffect(() => {
    const fetchConfigAndUser = async () => {
      try {
        const conf = await getConfigGeneral('business');
        if (conf) {
          setBusinessConfig(conf);
        }
      } catch (err) {
        console.warn("Error loading config:", err);
      }
    };
    fetchConfigAndUser();
  }, []);

  // --- Estados de Cartera (Métricas Originales) ---
  const [metrics, setMetrics] = useState({
    totalClientes: 0,
    saludPromedio: 0,
    clientesCriticos: 0,
    contratosRiesgo: 0,
    tasaRetencion: 100,
    diasActivacion: 0,
    estados: {
      onboarding: 0,
      activo: 0,
      riesgo: 0,
      churn: 0
    },
    loading: true
  });
  const [historyData, setHistoryData] = useState([]);
  
  // --- Estados Gamificación & Finanzas ---
  const [financeStats, setFinanceStats] = useState({ mrr: {}, risk: {}, churn: {}, estimatedLoss30Days: 0 });
  const [exchangeRates, setExchangeRates] = useState(null);

  // Normalizar los equipos de comerciales según pestaña y rol (supervisor / admin)
  const filteredComercialesList = useMemo(() => {
    return comerciales.filter(u => {
      const normU = normalizarEquipo(u.equipo);
      
      // 1. Filtrar por el tab activo
      if (activeTab === 'pipeline' || activeTab === 'cartera' || activeTab === 'logros') {
        if (normU !== 'adquisicion' && normU !== 'retencion') return false;
      }
      
      // 2. Filtrar según el rol del usuario (Supervisor de equipo)
      const isSupervisor = role === 'supervisor';
      const isGlobal = isAdmin || role === 'superadmin' || role === 'lector';
      
      if (isSupervisor) {
        return normU === normalizedTeam;
      }
      
      if (isGlobal) {
        return true;
      }
      
      return u.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim();
    });
  }, [comerciales, activeTab, role, normalizedTeam, isAdmin, user]);

  // Lista de usuarios filtrada para Gamificación
  const filteredGamersList = useMemo(() => {
    const participatingTeamIds = new Set(
      equipos
        .filter(eq => eq.participaGamificacion)
        .map(eq => normalizarEquipo(eq.id))
    );

    return comerciales.filter(u => {
      const normU = normalizarEquipo(u.equipo);
      
      if (!participatingTeamIds.has(normU)) {
        return false;
      }
      
      const normView = normalizarEquipo(dashboardView);
      if (normView && normView !== 'global') {
        if (normView === 'soporte' || normView === 'cx') {
          return normU === 'soporte' || normU === 'cx';
        }
        return normU === normView;
      }
      
      return true;
    });
  }, [comerciales, equipos, dashboardView]);

  useEffect(() => {
    if (selectedComercial) {
      const exists = filteredComercialesList.some(u => u.email?.toLowerCase().trim() === selectedComercial.toLowerCase().trim());
      if (!exists) {
        setSelectedComercial('');
      }
    }
  }, [activeTab, filteredComercialesList, selectedComercial]);

  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        const data = await getConfigGeneral('rates');
        if (data && data.rates) {
          setExchangeRates(data.rates);
        } else {
          const rates = {
            USD: 1.0,
            ARS: 1250.0,
            CLP: 950.0,
            COP: 4100.0,
            PEN: 3.75,
            MXN: 19.5
          };
          setExchangeRates(rates);
          try {
            await setConfigGeneral('rates', { rates, lastUpdated: new Date().toISOString() });
          } catch (_e) {
            // Error silencioso al cachear tipos de cambio
          }
        }
      } catch (err) {
        console.warn('[Dashboard] Error fetching exchange rates:', err.message);
      }
    };
    fetchExchangeRates();
  }, []);
  const [gamification, setGamification] = useState({
    churnStreakDays: 0,
    dataQualityScore: 0
  });

  // --- Pipeline & Leads State & Subscriptions ---
  const [leadsData, setLeadsData] = useState([]);
  const [opsData, setOpsData] = useState([]);

  useEffect(() => {
    if (roleLoading || !user) return;

    const fetchLeadsAndOps = async () => {
      setSecondaryLoading(true);
      try {
        let qLeads = supabase.from('leads').select('*');
        let qOps = supabase.from('oportunidades').select('*');

        if ((isAdmin || role === 'supervisor') && selectedComercial) {
          qLeads = qLeads.eq('asignado_a', selectedComercial);
          qOps = qOps.eq('comercial_email', selectedComercial);
        } else {
          if (leadsScope === 'OWN') {
            qLeads = qLeads.eq('asignado_a', user.email);
          }
          if (oportunidadesScope === 'OWN') {
            qOps = qOps.eq('comercial_email', user.email);
          }
        }

        const [leadsRes, opsRes] = await Promise.all([qLeads, qOps]);

        const list = [];
        (leadsRes.data || []).forEach(d => {
          if (leadsScope === 'NONE') return;
          if (selectedCountry && d.pais !== selectedCountry) return;

          if (leadsScope === 'OWN') {
            const isSelf = d.asignado_a && d.asignado_a.toLowerCase().trim() === user.email?.toLowerCase().trim();
            if (!isSelf) return;
          } else if (leadsScope === 'TEAM') {
            const isSelf = d.asignado_a && d.asignado_a.toLowerCase().trim() === user.email?.toLowerCase().trim();
            const isUnassigned = !d.asignado_a;
            if (!isSelf && !isUnassigned) {
              const comercialUser = comerciales.find(u => u.email?.toLowerCase().trim() === d.asignado_a.toLowerCase().trim());
              if (!comercialUser || normalizarEquipo(comercialUser.equipo) !== normalizedTeam) return;
            }
          }

          list.push({
            id: d.id,
            nombreEmpresa: d.nombre_empresa,
            pais: d.pais,
            estado: d.estado,
            montoEstimado: d.monto_estimado,
            asignadoA: d.asignado_a,
            fechaCreacion: d.created_at
          });
        });
        setLeadsData(list);

        const listOps = [];
        (opsRes.data || []).forEach(d => {
          if (oportunidadesScope === 'NONE') return;
          if (selectedCountry && d.pais !== selectedCountry) return;

          if (oportunidadesScope === 'OWN') {
            const isSelf = d.comercial_email && d.comercial_email.toLowerCase().trim() === user.email?.toLowerCase().trim();
            if (!isSelf) return;
          } else if (oportunidadesScope === 'TEAM') {
            const isSelf = d.comercial_email && d.comercial_email.toLowerCase().trim() === user.email?.toLowerCase().trim();
            if (!isSelf) {
              const comercialUser = comerciales.find(u => u.email?.toLowerCase().trim() === d.comercial_email.toLowerCase().trim());
              if (!comercialUser || normalizarEquipo(comercialUser.equipo) !== normalizedTeam) return;
            }
          }

          listOps.push({
            id: d.id,
            titulo: d.titulo,
            etapa: d.etapa,
            montoUSD: d.monto_usd,
            monto: d.monto,
            moneda: d.moneda,
            comercialEmail: d.comercial_email,
            pais: d.pais,
            fechaCierreEstimada: d.fecha_cierre_estimada,
            fechaIngresoEtapa: d.updated_at
          });
        });
        setOpsData(listOps);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Error loading leads and ops in dashboard:", err);
      } finally {
        setSecondaryLoading(false);
      }
    };

    fetchLeadsAndOps();
  }, [selectedCountry, roleLoading, isAdmin, user, selectedComercial, role, isRestricted, normalizedTeam, comerciales, leadsScope, oportunidadesScope]);

  const clientMetadataRef = useRef({});
  useEffect(() => { clientMetadataRef.current = clientMetadata; }, [clientMetadata]);

  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeFilter, setTimeFilter] = useState('24h');

  // --- 1. Sincronización de Clientes ---
  useEffect(() => {
    if (roleLoading) return;

    const fetchClientes = async () => {
      try {
        let q = supabase.from('clientes').select('*');
        if (clientScope === 'OWN') {
          q = q.eq('comercial_email', user.email);
        }

        const { data, error } = await q;
        if (error) throw error;

        let total = 0;
        let criticos = 0;
        let totalScore = 0;
        let scoredCount = 0;

        let onboardingCount = 0;
        let activoCount = 0;
        let riesgoCount = 0;
        let churnCount = 0;

        let mostRecentChurnDate = null;
        let totalDataQualityFields = 0;
        let filledDataQualityFields = 0;

        const metadataMap = {};
        const now = new Date();

        (data || []).forEach(d => {
          if (clientScope === 'NONE') return;

          let fechaIngreso = d.fecha_ingreso ? new Date(d.fecha_ingreso) : now;
          const diffMonths = (now.getFullYear() - fechaIngreso.getFullYear()) * 12 + now.getMonth() - fechaIngreso.getMonth();
          const isRetencion = d.fase_manual
            ? d.fase_manual === 'Retencion'
            : diffMonths > businessConfig.mesesParaRetencion;

          const hs = d.health_score || {};
          metadataMap[d.id] = { 
            pais: d.pais || '', 
            estado: d.estado || '', 
            isRetencion, 
            comercialEmail: d.comercial_email || '',
            riesgo: hs.riesgo || 'Green'
          };

          if (clientScope === 'OWN') {
            const isSelf = d.comercial_email && d.comercial_email.toLowerCase().trim() === user.email?.toLowerCase().trim();
            if (!isSelf) return;
          } else if (clientScope === 'TEAM') {
            const isSelf = d.comercial_email && d.comercial_email.toLowerCase().trim() === user.email?.toLowerCase().trim();
            if (!isSelf) {
              const comercialUser = comerciales.find(u => u.email?.toLowerCase().trim() === d.comercial_email?.toLowerCase().trim());
              if (!comercialUser || normalizarEquipo(comercialUser.equipo) !== normalizedTeam) return;
            }
          }

          if ((isAdmin || role === 'supervisor') && selectedComercial && d.comercial_email !== selectedComercial) return;
          if (selectedCountry && d.pais !== selectedCountry) return;

          if (dashboardView === 'Adquisicion' && isRetencion) return;
          if (dashboardView === 'Retencion' && !isRetencion) return;

          total++;
          const state = d.estado;
          
          if (state === 'Onboarding') onboardingCount++;
          else if (state === 'Activo') activoCount++;
          else if (state === 'En Riesgo') riesgoCount++;
          else if (state === 'Churn') {
            churnCount++;
            let churnDate = d.updated_at ? new Date(d.updated_at) : null;
            if (churnDate && (!mostRecentChurnDate || churnDate > mostRecentChurnDate)) {
              mostRecentChurnDate = churnDate;
            }
          }

          totalDataQualityFields += 3;
          if (d.pais) filledDataQualityFields++;
          if (d.estado) filledDataQualityFields++;
          if (d.nombre_empresa) filledDataQualityFields++;

          if (hs.riesgo === 'Red') criticos++;
          
          if (hs.score !== undefined) {
            scoredCount++;
            totalScore += hs.score;
          } else if (hs.riesgo) {
            scoredCount++;
            if (hs.riesgo === 'Green') totalScore += 90;
            else if (hs.riesgo === 'Yellow') totalScore += 55;
            else if (hs.riesgo === 'Red') totalScore += 25;
          }
        });

        setClientMetadata(metadataMap);

        const avgHealth = total > 0 ? (scoredCount > 0 ? Math.round(totalScore / scoredCount) : 100) : 0;
        const retencion = total > 0 ? ((activoCount + churnCount) > 0 ? Math.round((activoCount / (activoCount + churnCount)) * 100) : 100) : 0;

        setMetrics(prev => ({
          ...prev,
          totalClientes: total,
          clientesCriticos: criticos,
          saludPromedio: avgHealth,
          tasaRetencion: retencion,
          estados: {
            onboarding: onboardingCount,
            activo: activoCount,
            riesgo: riesgoCount,
            churn: churnCount
          },
          loading: false
        }));

        const qualityScore = totalDataQualityFields > 0 ? Math.round((filledDataQualityFields / totalDataQualityFields) * 100) : 0;
        let streakDays = mostRecentChurnDate 
          ? Math.max(0, Math.floor((new Date() - mostRecentChurnDate) / (1000 * 60 * 60 * 24)))
          : 999;

        setGamification({ churnStreakDays: streakDays, dataQualityScore: qualityScore });
      } catch (err) {
        console.error("Error fetching clients for dashboard:", err);
      }
    };

    fetchClientes();
  }, [selectedCountry, dashboardView, businessConfig.mesesParaRetencion, isAdmin, roleLoading, selectedComercial, user, role, isRestricted, normalizedTeam, comerciales, clientScope]);

  // --- 2. Carga de Contratos y Finanzas desde Supabase ---
  const loadSecondaryData = useCallback(async () => {
    if (roleLoading) return;
    setSecondaryLoading(true);
    try {
      const meta = clientMetadataRef.current;

      let qContratos = supabase.from('contratos').select('*');
      if (oportunidadesScope === 'OWN') {
        qContratos = qContratos.eq('comercial_email', user.email);
      }

      const { data: contratosData, error: cErr } = await qContratos;
      if (cErr) throw cErr;

      let enRiesgo = 0;
      let lossUsdSum = 0;
      let mrrUsdTotal = 0;
      let riskUsdTotal = 0;
      let churnUsdTotal = 0;
      
      const clientMrrMap = {};
      let renewals60Count = 0;
      let renewals60Usd = 0;
      
      let tierEnterpriseUsd = 0;
      let tierMidUsd = 0;
      let tierSmbUsd = 0;

      const nowTs = Date.now();
      const SixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

      (contratosData || []).forEach(d => {
        if (oportunidadesScope === 'NONE') return;
        if (oportunidadesScope === 'OWN') {
          const isSelf = d.comercial_email && d.comercial_email.toLowerCase().trim() === user.email?.toLowerCase().trim();
          if (!isSelf) return;
        } else if (oportunidadesScope === 'TEAM') {
          const isSelf = d.comercial_email && d.comercial_email.toLowerCase().trim() === user.email?.toLowerCase().trim();
          if (!isSelf) {
            const comercialUser = comerciales.find(u => u.email?.toLowerCase().trim() === d.comercial_email?.toLowerCase().trim());
            if (!comercialUser || normalizarEquipo(comercialUser.equipo) !== normalizedTeam) return;
          }
        }

        if ((isAdmin || role === 'supervisor') && selectedComercial && d.comercial_email !== selectedComercial) return;
        const clientMeta = meta[d.cliente_id] || {};
        const clientCountry = clientMeta.pais || d.pais || '';
        const clientState = clientMeta.estado || '';
        const clientRiesgo = clientMeta.riesgo || 'Green';
        const isRetencion = clientMeta.isRetencion || false;
        if (selectedCountry && clientCountry !== selectedCountry) return;
        if (dashboardView === 'Adquisicion' && isRetencion) return;
        if (dashboardView === 'Retencion' && !isRetencion) return;
        if (d.estado_sla && (d.estado_sla.includes('Naranja') || d.estado_sla.includes('Rojo') || d.estado_sla.includes('Vencido'))) enRiesgo++;
        
        if (d.monto && Number(d.monto) > 0) {
          const currency = d.moneda || 'USD';
          const montoNum = Number(d.monto);

          let contratoMontoUsd = 0;
          if (d.monto_usd !== undefined && d.monto_usd !== null && Number(d.monto_usd) > 0) {
            contratoMontoUsd = Number(d.monto_usd);
          } else {
            const currencyUpper = currency.toUpperCase();
            const rate = exchangeRates && exchangeRates[currencyUpper] ? Number(exchangeRates[currencyUpper]) : 1.0;
            contratoMontoUsd = montoNum / rate;
          }

          if (clientState !== 'Churn') {
            mrrUsdTotal += contratoMontoUsd;
            clientMrrMap[d.cliente_id] = (clientMrrMap[d.cliente_id] || 0) + contratoMontoUsd;

            if (contratoMontoUsd >= 1000) tierEnterpriseUsd += contratoMontoUsd;
            else if (contratoMontoUsd >= 300) tierMidUsd += contratoMontoUsd;
            else tierSmbUsd += contratoMontoUsd;
          }
          if (clientState === 'En Riesgo') {
            riskUsdTotal += contratoMontoUsd;
          }
          if (clientState === 'Churn') {
            churnUsdTotal += contratoMontoUsd;
          }

          if (clientRiesgo === 'Red') {
            lossUsdSum += contratoMontoUsd;
          }

          if (d.fecha_fin) {
            const vencDate = new Date(d.fecha_fin).getTime();
            if (vencDate >= nowTs && vencDate <= nowTs + SixtyDaysMs) {
              renewals60Count++;
              renewals60Usd += contratoMontoUsd;
            }
          }
        }
      });

      const sortedClientMrrs = Object.values(clientMrrMap).sort((a, b) => b - a);
      const top5SumUsd = sortedClientMrrs.slice(0, 5).reduce((acc, v) => acc + v, 0);
      const top5Concentration = mrrUsdTotal > 0 ? Math.round((top5SumUsd / mrrUsdTotal) * 100) : 0;
      const nrrPct = (mrrUsdTotal + churnUsdTotal) > 0 ? Math.round((mrrUsdTotal / (mrrUsdTotal + churnUsdTotal)) * 100) : 100;

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

      const localCurrency = selectedCountry ? getCountryCurrency(selectedCountry) : null;
      let mrrPayload = {};
      let riskPayload = {};
      let churnPayload = {};
      let lossPayload = null;

      if (localCurrency && localCurrency !== 'USD') {
        const rateLocal = exchangeRates && exchangeRates[localCurrency] ? Number(exchangeRates[localCurrency]) : 1.0;
        mrrPayload = { [localCurrency]: mrrUsdTotal * rateLocal, USD: mrrUsdTotal };
        riskPayload = { [localCurrency]: riskUsdTotal * rateLocal, USD: riskUsdTotal };
        churnPayload = { [localCurrency]: churnUsdTotal * rateLocal, USD: churnUsdTotal };
        lossPayload = { [localCurrency]: lossUsdSum * rateLocal, USD: lossUsdSum };
      } else {
        mrrPayload = { USD: mrrUsdTotal };
        riskPayload = { USD: riskUsdTotal };
        churnPayload = { USD: churnUsdTotal };
        lossPayload = { USD: lossUsdSum };
      }

      setFinanceStats({ 
        mrr: mrrPayload, 
        risk: riskPayload, 
        churn: churnPayload,
        estimatedLoss30Days: lossPayload
      });

      setMetrics(prev => ({
        ...prev,
        contratosRiesgo: enRiesgo,
        nrrPct,
        top5Concentration,
        renewals60Count,
        renewals60Usd,
        tierBreakdown: {
          enterprise: tierEnterpriseUsd,
          mid: tierMidUsd,
          smb: tierSmbUsd
        }
      }));

      setLastUpdated(new Date());
    } catch (err) {
      console.error('[Dashboard] Error cargando datos secundarios:', err);
    } finally {
      setSecondaryLoading(false);
    }
  }, [roleLoading, isAdmin, user, selectedCountry, dashboardView, selectedComercial, exchangeRates, clientScope, oportunidadesScope, normalizedTeam, comerciales]);

  useEffect(() => {
    if (!roleLoading && !metrics.loading) loadSecondaryData();
  }, [roleLoading, metrics.loading, isAdmin, selectedCountry, dashboardView, selectedComercial, loadSecondaryData]);

  useEffect(() => {
    const timer = setInterval(() => loadSecondaryData(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadSecondaryData]);

  const filteredLeadsForPipeline = useMemo(() => {
    if (dashboardView === 'Adquisicion') {
      return leadsData;
    } else if (dashboardView === 'Retencion') {
      return [];
    }
    return leadsData;
  }, [leadsData, dashboardView]);

  const filteredOpsForPipeline = useMemo(() => {
    if (dashboardView === 'Adquisicion') {
      return opsData.filter(op => (op.tipoPipeline || 'adquisicion') === 'adquisicion');
    } else if (dashboardView === 'Retencion') {
      return opsData.filter(op => op.tipoPipeline === 'retencion');
    }
    return opsData;
  }, [opsData, dashboardView]);

  if (roleLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mt-2 small">Cargando perfil y analíticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 animate__animated animate__fadeIn">
      {/* Encabezado Principal Apple */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="mb-1 fw-bold" style={{ color: 'var(--apple-text-primary)', letterSpacing: '-0.03em' }}>
            <i className="bi bi-activity text-primary me-2"></i>Panel de Inteligencia
          </h2>
          <p className="mb-0 small" style={{ color: 'var(--apple-text-secondary)', fontSize: '0.85rem' }}>
            Análisis ejecutivo en tiempo real del ciclo de vida y retención de la cartera.
          </p>
        </div>

        {/* Lado derecho: Fecha y recarga rápida */}
        <div className="d-flex align-items-center gap-2">
          <div className="apple-glass px-3 py-1.5 rounded-pill small fw-semibold d-flex align-items-center gap-2" style={{ fontSize: '0.78rem', color: 'var(--apple-text-secondary)' }}>
            <span className="bullet-active"></span> {today}
          </div>
          {lastUpdated && (
            <span className="small text-muted d-none d-sm-inline" style={{ fontSize: '0.72rem' }}>
              <i className="bi bi-clock me-1"></i>
              {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 shadow-sm"
            style={{ fontSize: '0.75rem' }}
            onClick={() => loadSecondaryData()}
            disabled={secondaryLoading}
            title="Actualizar métricas e historial"
          >
            {secondaryLoading
              ? <span className="spinner-border spinner-border-sm" style={{ width: '0.7rem', height: '0.7rem' }} />
              : <i className="bi bi-arrow-clockwise" />}
          </button>
        </div>
      </div>

      {/* Unified Executive Glass Toolbar */}
      <div className="apple-toolbar-island mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
        {/* Pestañas Principales (Apple Segmented Control) */}
        <div className="apple-segmented-control">
          <button 
            type="button" 
            className={`apple-segmented-item ${activeTab === 'pipeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >
            <i className="bi bi-funnel"></i>
            <span>Embudo y Pipeline</span>
          </button>
          <button 
            type="button" 
            className={`apple-segmented-item ${activeTab === 'cartera' ? 'active' : ''}`}
            onClick={() => setActiveTab('cartera')}
          >
            <i className="bi bi-pie-chart"></i>
            <span>Resumen de Cartera</span>
          </button>
          <button 
            type="button"
            className={`apple-segmented-item ${activeTab === 'logros' ? 'active' : ''}`}
            onClick={() => setActiveTab('logros')}
          >
            <i className="bi bi-controller"></i>
            <span>Logros y Gamificación</span>
          </button>
        </div>

        {/* Filtros Contextuales (Comerciales y Pipeline Scope) */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {!isAgent && (
            <div className="filter-select-wrapper" style={{ minWidth: '180px' }}>
              <i className="bi bi-person filter-select-icon"></i>
              <select
                className="filter-select py-1"
                value={selectedComercial}
                onChange={e => setSelectedComercial(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              >
                <option value="">Todos los Comerciales</option>
                {filteredComercialesList.map(u => (
                  <option key={u.email} value={u.email}>{u.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="apple-segmented-control">
            <button
              type="button"
              className={`apple-segmented-item ${dashboardView === 'Global' ? 'active' : ''}`}
              onClick={() => setDashboardView('Global')}
              disabled={isRestricted}
            >
              <span>Total</span>
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${dashboardView === 'Adquisicion' ? 'active' : ''}`}
              onClick={() => setDashboardView('Adquisicion')}
              disabled={isRestricted}
            >
              <i className="bi bi-tree"></i>
              <span>Adquisición</span>
            </button>
            <button
              type="button"
              className={`apple-segmented-item ${dashboardView === 'Retencion' ? 'active' : ''}`}
              onClick={() => setDashboardView('Retencion')}
              disabled={isRestricted}
            >
              <i className="bi bi-diagram-3"></i>
              <span>Retención</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================== VISTA 0: EMBUDO Y PIPELINE ==================== */}
      {activeTab === 'pipeline' && (
        <PipelineChartsPanel
          leads={filteredLeadsForPipeline}
          oportunidades={filteredOpsForPipeline}
          exchangeRates={exchangeRates}
          selectedCountry={selectedCountry}
          activePipeline={dashboardView.toLowerCase()}
          comerciales={filteredComercialesList}
        />
      )}

      {/* ==================== VISTA 1: RESUMEN DE CARTERA ==================== */}
      {activeTab === 'cartera' && (
        <>
          <KPIsGrid metrics={metrics} financeStats={financeStats} />
          <ChartsPanel metrics={metrics} historyData={historyData} />
        </>
      )}

      {/* ==================== VISTA 2: LOGROS Y GAMIFICACIÓN ==================== */}
      {activeTab === 'logros' && (
        <GamificationPanel
          gamification={gamification}
          comerciales={filteredGamersList}
        />
      )}

      {/* ==================== KPIs DINÁMICOS POR SOLAPA ==================== */}
      <DynamicChartsPanel activeTab={activeTab} />
    </div>
  );
}
