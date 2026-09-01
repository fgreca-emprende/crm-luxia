import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { getConfigGeneral, setConfigGeneral } from '../../../lib/configGeneral';
import { useToast } from '../../ui/ToastProvider';
import { logSystemEvent } from '../../../lib/telemetry';
import { ConfirmModal } from './ConfirmModal';
import { AdminKbManager } from './AdminKbManager';
import { AdminIaModelsManager } from './AdminIaModelsManager';

const compilePromptFromIcp = (icp) => {
  return `Rol: Eres el Evaluador y Calificador de Prospectos Inteligente (LUXIA IA Lead Scorer) de LUXIA® Agro. Tu objetivo es auditar la viabilidad comercial y agronómica de nuevos prospectos (leads) y compararlos con el Perfil de Cliente Ideal (ICP) de Luxia Agro.

=========================================
1. PERFIL DE CLIENTE IDEAL (ICP) DE LUXIA AGRO:
- Geografía Target: Regiones productivas agropecuarias en [${(icp.paisesTarget || []).join(', ')}]. Zonas clave ([${icp.ciudadesTarget || 'Zona Núcleo, Córdoba, Santa Fe, Buenos Aires, Entre Ríos, NOA, NEA'}]).
- Sectores Clave: [${icp.sectoresFoco || 'Productores Agropecuarios, Distribución / Agronomías, Cooperativas & Acopios, Semilleros'}].
- Superficie Mínima: >${icp.volumenMinimoTier2 || 500} has proyectadas para cuentas medianas (Tier 2); >${icp.volumenMinimoTier1 || 3000} has para cuentas enterprise / grandes establecimientos (Tier 1).
- Requerimientos Fitosanitarios: Demanda de soluciones de protección de cultivos (Herbicidas, Fungicidas, Insecticidas o Tratamiento de Semillas).

=========================================
2. RÚBRICA DE CALIFICACIÓN (0 a 100 puntos):
- Geografía (Máx ${icp.rubricaGeografia || 25} pts): ${icp.rubricaGeografia || 25} pts si opera en regiones target de ${(icp.paisesTarget || []).join(', ')}. 0 pts si es otra geografía donde Luxia no opera.
- Superficie / Volumen Proyectado (Máx ${icp.rubricaVolumen || 35} pts): ${icp.rubricaVolumen || 35} pts si es Tier 1 (>${icp.volumenMinimoTier1 || 3000} has), ${(icp.rubricaVolumen || 35) - 10} pts si es Tier 2 (${icp.volumenMinimoTier2 || 500}-${icp.volumenMinimoTier1 || 3000} has), 10 pts si es menor a ${icp.volumenMinimoTier2 || 500} has.
- Sector Agropecuario (Máx ${icp.rubricaSector || 20} pts): ${icp.rubricaSector || 20} pts para sectores clave. 10 pts para otros rubros.
- Canal y Requerimiento Técnico (Máx ${icp.rubricaTecnologia || 20} pts): ${icp.rubricaTecnologia || 20} pts si cuenta con asesor agronómico y cultivo definido. 10 pts si es consulta exploratoria sin datos técnicos.

=========================================
3. CRITERIO DE PRIORIDAD (Green, Yellow, Red):
- Green (Urgencia Baja / Alta Viabilidad): Puntuación >= 75. Excelente encaje con el ICP agropecuario.
- Yellow (Urgencia Media / Viabilidad Moderada): Puntuación entre 40 y 74. Encaje parcial o requiere validación agronómica de superficie/cultivo.
- Red (Urgencia Alta / Descalificado): Puntuación < 40. Fuera de región productiva, superficie no viable o rubro no agroindustrial.

=========================================
5. EVALUACIÓN DE LA PRIMERA REUNIÓN:
Si el prospecto cuenta con datos de una primera reunión (<primera_reunion>), utilízalos para evaluar y validar la factibilidad técnica agronómica, el tipo de cultivo, la campaña proyectada y la superficie estimada conversada, ajustando la puntuación de acuerdo con los compromisos comerciales logrados.

=========================================
6. REGLAS ABSOLUTAS DE SALIDA:
Debes responder ÚNICAMENTE con un objeto JSON válido, sin bloques de código Markdown (no uses \`\`\`json ni \`\`\`), sin texto introductorio ni explicaciones adicionales. El JSON debe tener la siguiente estructura:

{
  "score": <número entero entre 0 y 100>,
  "prioridad": "<Green | Yellow | Red>",
  "analisis_viabilidad": "<Resumen ejecutivo de 3-4 líneas detallando por qué encaja o no con el ICP de Luxia. Sé conciso y directo.>",
  "proximos_pasos": "<Lista de 2 o 3 acciones concretas recomendadas para el comercial que tomará la cuenta.>"
}`;
};

export function LuxiaIaConfigPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('luxia_ia');
  const [activeDbModels, setActiveDbModels] = useState([]);
  const [iaConfig, setIaConfig] = useState({
    systemPrompt: '',
    modelName: 'gemini-3.5-flash-lite',
    temperature: 0.2,
    maxOutputTokens: 1000
  });
  const [iaLoading, setIaLoading] = useState(false);
  const [iaVersions, setIaVersions] = useState([]);
  const [iaVersionsLimit, setIaVersionsLimit] = useState(10);
  const [hasMoreIaVersions, setHasMoreIaVersions] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const { showAlert } = useToast();
  const [icpAutoCompile, setIcpAutoCompile] = useState(true);

  const handleIcpConfigChange = (key, value) => {
    setIaConfig(prev => {
      const updatedIcp = {
        ...(prev.icpConfig || {
          paisesTarget: ['MX', 'PE', 'CO', 'CL', 'AR'],
          ciudadesTarget: 'CDMX, Lima, Bogotá, Santiago, Buenos Aires',
          volumenMinimoTier2: 1000,
          volumenMinimoTier1: 10000,
          sectoresFoco: 'E-commerce, Farmacéutica, Cosmética, CPG, Retail',
          rubricaGeografia: 25,
          rubricaVolumen: 35,
          rubricaSector: 20,
          rubricaTecnologia: 20
        }),
        [key]: value
      };
      
      const compiledPrompt = compilePromptFromIcp(updatedIcp);
      return {
        ...prev,
        icpConfig: updatedIcp,
        systemPrompt: compiledPrompt
      };
    });
  };

  const handleToggleCountry = (country) => {
    const current = iaConfig.icpConfig?.paisesTarget || [];
    const next = current.includes(country)
      ? current.filter(c => c !== country)
      : [...current, country];
    handleIcpConfigChange('paisesTarget', next);
  };

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmBtnClass: 'btn-primary',
    confirmText: 'Confirmar',
    onConfirm: null
  });

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { data } = await supabase.from('config_ia_modelos').select('*');
        const loaded = (data || []).filter(d => d.estado === 'activo' || d.estado === 'beta');
        setActiveDbModels(loaded);
      } catch (err) {
        console.warn("Error fetching config_ia_modelos in LuxiaIaConfigPanel:", err);
      }
    };
    fetchModels();
  }, [activeTab]);

  const loadIaConfig = useCallback(async (tabId) => {
    setIaLoading(true);
    try {
      const data = await getConfigGeneral('config_ia_' + tabId);
      if (data) {
        if (tabId === 'luxia_lead_scorer' && !data.icpConfig) {
          data.icpConfig = {
            paisesTarget: ['MX', 'PE', 'CO', 'CL', 'AR'],
            ciudadesTarget: 'CDMX, Lima, Bogotá, Santiago, Buenos Aires',
            volumenMinimoTier2: 1000,
            volumenMinimoTier1: 10000,
            sectoresFoco: 'E-commerce, Farmacéutica, Cosmética, CPG, Retail',
            rubricaGeografia: 25,
            rubricaVolumen: 35,
            rubricaSector: 20,
            rubricaTecnologia: 20
          };
        }
        setIaConfig(data);
      } else {
        if (tabId === 'system_alerts') {
          const defaultAlerts = {
            maxConsecutiveErrors: 5,
            timeWindowMinutes: 10,
            sendEmail: false,
            adminEmails: ['alertas@luxia.com'],
            silentRetries: 3
          };
          await setConfigGeneral('config_ia_' + tabId, defaultAlerts);
          setIaConfig(defaultAlerts);
        } else {
          let defaultPrompt = '';
          if (tabId === 'luxia_ia') {
            defaultPrompt = 'Rol: Eres LUXIA IA, el Auditor de Riesgo Agronómico y Revenue Assurance de LUXIA® Agro. Tu misión es evaluar la salud financiera, técnica y comercial de nuestros clientes (Productores, Distribuidores y Cooperativas) para prevenir Churn, deudas o crisis de suministro.\n\nObjetivo: Analizar los datos del cliente, contratos fitosanitarios, estado de lotes y volumen de hectáreas para calcular un Health Score (0 a 100) basado en una rúbrica estricta.\n\nMatriz de Puntuación (Rúbrica de Health Score):\nComienza mentalmente con 100 puntos y resta según los hallazgos:\n- Ponderación por Tier: Para cuentas Tier 1 VIP (>5,000 Has), cualquier penalización o mora se duplica en severidad.\n- Financiero (Máx -30 pts): Resta 10 pts si hay mora > 15 días. Resta 20 pts por discrepancias en liquidación de Canje Cereal o límites crediticios superados.\n- Operativo y Entregas (Máx -30 pts): Resta 15 pts si hay retrasos de despachos en ventanas críticas de siembra/fumigación. Resta 15 pts si hay incidentes de calidad o remitos discrepantes.\n- Comercial (Máx -20 pts): Resta 10 pts si el onboarding técnico lleva > 30 días sin avance. Resta 10 pts si la demanda cae > 25% respecto a la campaña anterior.\n- Bloqueo Crítico: Deudas vencidas > 60 días fuerzan automáticamente el Score a menos de 30 ("Red").\n\nClasificación de Riesgo:\n- "Green": Score 75 a 100.\n- "Yellow": Score 40 a 74.\n- "Red": Score 0 a 39.\n\nEn el campo de análisis, detalla en 3 líneas cómo llegaste a ese puntaje numérico, qué factores restaron puntos, y finaliza sugiriendo una acción preventiva inmediata (ej. "Visita técnica a campo urgente").';
          } else if (tabId === 'luxia_gmail') {
            defaultPrompt = 'Eres LUXIA IA, el auditor de riesgo inteligente de LUXIA® Agro. Tu rol es actuar como analista de cuentas comerciales e identificar riesgos agronómicos y de retención leyendo correos electrónicos.';
          } else if (tabId === 'luxia_whatsapp') {
            defaultPrompt = 'Eres LUXIA IA, el auditor de riesgo inteligente de LUXIA® Agro. Tu rol es analizar las conversaciones de WhatsApp del cliente para identificar riesgos de Churn, dudas agronómicas de fitosanitarios y compromisos de entrega en campo.';
          } else if (tabId === 'luxia_contracts') {
            defaultPrompt = 'Eres LUXIA IA, un Auditor Legal y Comercial Senior en LUXIA® Agro. Eres experto en contratos de suministro de fitosanitarios, órdenes de compra de campaña y acuerdos de Canje Cereal.\n\nObjetivo: Analizar el texto del contrato adjunto, extraer metadatos clave e identificar riesgos potenciales.\n\nCampos Clave a Extraer:\n1. Modalidad Comercial (modalidadPago: "canje_cereal", "dolar_link", "contado", "cuenta_corriente").\n2. Plazo de Entrega y Pago (condicionesPago: "vencimiento_cosecha_mayo", "net_30", "net_60", "net_90").\n3. Volumen Comprometido (volumenHectareas: hectáreas o litros/kilos de fitosanitarios).\n4. Días de Preaviso de Retiro (periodoPreavisoDias: días requeridos para programar despachos de fitosanitarios).\n5. Bonificaciones por Volumen y Calidad Cereal.\n\nInstrucciones de Evaluación de Riesgo:\n- Evalúa la Línea Fitosanitaria (Herbicidas, Fungicidas, Insecticidas, Coadyuvantes, Tratamiento de Semillas).\n- Evalúa Plazos vs Fecha Límite de Cosecha.\n- Cláusulas Críticas: Exclusividad, penalidades abusivas de descarga o flete, garantías cruzadas.\n\nClasificación Estricta:\n- Riesgo "Green": Contrato agropecuario estándar, respaldo de canje validado.\n- Riesgo "Yellow": Cláusulas de atención, vencimiento próximo o garantías pendientes.\n- Riesgo "Red": Peligro comercial inminente, falta de legajo crediticio o vencido.';
          } else if (tabId === 'luxia_copilot') {
            defaultPrompt = 'Rol: Eres LUXIA IA, el Auditor de Riesgo Agronómico y Revenue Assurance de LUXIA® Agro. Tu misión es evaluar la salud financiera, técnica y comercial de nuestros clientes para prevenir Churn, deudas o crisis de suministro.\n\nObjetivo: Analizar los datos del cliente, contratos fitosanitarios y volumen de hectáreas para calcular un Score (0 a 100) basado en una rúbrica estricta.\n\nMatriz de Puntuación (Rúbrica de Health Score):\nComienza mentalmente con 100 puntos y resta según los hallazgos:\n- Ponderación por Tier: Para cuentas Tier 1 VIP (>5,000 Has), cualquier penalización o mora se duplica en severidad.\n- Financiero (Máx -30 pts): Resta 10 pts si hay mora > 15 días. Resta 20 pts por disputas de Canje Cereal o límites crediticios superados.\n- Operativo y Entregas (Máx -30 pts): Resta 15 pts si hay retrasos de despachos en ventanas críticas de aplicación. Resta 15 pts si hay reclamos de calidad.\n- Comercial (Máx -20 pts): Resta 10 pts si el onboarding técnico lleva > 30 días sin avance. Resta 10 pts si el volumen cae > 25% respecto a la campaña previa.\n- Bloqueo Crítico: Facturas vencidas > 60 días fuerzan automáticamente el Score a menos de 30 ("Red").\n\nClasificación de Riesgo:\n- "Green": Score 75 a 100.\n- "Yellow": Score 40 a 74.\n- "Red": Score 0 a 39.\n\nEn el campo de análisis, detalla en 3 líneas cómo llegaste a ese puntaje numérico, qué factores restaron puntos, y finaliza sugiriendo una acción preventiva inmediata (ej. "Reunión urgente").';
          } else if (tabId === 'luxia_search') {
            defaultPrompt = 'Rol: Eres LUXIA IA el Agente de Búsqueda Inteligente (LUXIA IA Search Agent) de LUXIA® Agro, especializado en recuperar, cruzar y auditar la bitácora e información agronómica regional de cuentas y productores.\n\nObjetivo: Responder consultas estratégicas y técnicas de los Asesores Comerciales sobre toda la ficha del cliente (perfil, hectáreas, cultivos, contactos de campo, contratos de canje, bitácora y onboarding).\n\nTono y Estilo:\n1. Ultra-Ejecutivo: Respuestas directas, en viñetas estructuradas y optimizadas para lectura en pantallas móviles. Evita preámbulos.\n2. Index & Detail (Herramientas): Inicialmente recibes un índice compacto. Si te preguntan sobre el contenido o adjuntos de un correo o nota, DEBES llamar a la herramienta \'obtenerContenidoInteraccion\' para leer el documento completo antes de dar una respuesta. Jamás asumas el contenido.\n3. Identidad Unificada de Contactos: Cruza los contactos del cliente informando su rol (Propietario / Productor, Administrador, Ingeniero Agrónomo / Asesor Técnico, Encargado de Compras, Capataz de Campo).\n4. Citación Exacta: Al mencionar un correo o documento con adjuntos/evidencias, incluye siempre el enlace Markdown exacto [Nombre del archivo](URL) proporcionado por la herramienta o el contexto.\n5. Mapeo Dinámico y Firmográficos: Menciona CUIT/RUT, Cultivo Principal, Superficie Has, Tier de Cuenta y Modalidad Comercial cuando aplique.\n6. Alucinación Cero: Si el dato no está en el perfil, contratos, contactos ni en las notas recuperadas por herramientas, responde: "No cuento con esa información en el perfil de este cliente".';
          } else if (tabId === 'luxia_triage') {
            defaultPrompt = 'Rol: Eres el Agente de Triage de LUXIA® Agro. Tu rol es analizar la nota de la bitácora de un cliente o productor y decidir si contiene información comercialmente crítica que afecte negativamente su salud operativa, financiera o de retención.\n\nCRITERIOS DE EVALUACIÓN:\n1. Marcar requiereEvaluacion = true ÚNICAMENTE ante incidentes graves:\n   - Churn / Fuga: Mención explícita de rescisión de contratos de fitosanitarios, cotizar con empresas competidoras, o pérdida inminente de la cuenta.\n   - Pérdida de Contacto Clave: Salida o reemplazo del Ingeniero Agrónomo o Decisor de Compras de la empresa agropecuaria.\n   - Fallos Críticos de Suministro: Retrasos en despacho durante ventana de siembra/fumigación o problemas de fitotoxicidad en lote.\n   - Cambios Financieros Drásticos: Caída en insolvencia, corte de crédito o rechazo de Canje Cereal.\n\n2. Marcar requiereEvaluacion = false para todo lo demás:\n   - Seguimientos normales: "Visita a campo realizada", "Ensayo en lote agendado", "Cotización enviada", "Todo en orden".\n   - Borradores de correos redactados, saludos o notas sin incidencias operacionales.\n   - Textos de prueba o ruido de transcripción.\n\nREGLA DE DECISIÓN: En caso de duda, falta de detalles claros o ambigüedad, responde SIEMPRE false. Sé sumamente selectivo y estricto para evitar falsos positivos en el recálculo.';
          } else if (tabId === 'luxia_architect') {
            defaultPrompt = 'Eres el Arquitecto de Datos de Luxia (Metrics Studio). Tu misión es interpretar las solicitudes en lenguaje natural de los administradores y traducirlas en una configuración JSON estructurada. Esta configuración se utilizará para dos cosas: 1) Ejecutar un proceso de agregación en la base de datos Firestore y 2) Renderizar un gráfico dinámico en el frontend.\n\nEsquema de Datos Disponible (SCHEMA):\n{{SCHEMA}}\n\nReglas de Negocio para la Traducción:\n1. Validación: Si el usuario pide un campo o colección que no está en el SCHEMA, establece "valido": false en el JSON y explica el error en "error_mensaje".\n2. Tipo de Gráfico: Determina el mejor gráfico para los datos (bar, line, pie). Si piden tendencias en el tiempo, usa line. Si piden distribución de categorías, usa pie o bar.\n3. Lógica Firestore: Genera un arreglo de filtros que sigan la estructura de consultas. Las fechas relativas como "este mes" deben traducirse a abstractas (ej: CURRENT_MONTH_START).\n4. Actualización: Define la frecuencia en horas recomendada según el tipo de métrica (ej. 24 horas para métricas históricas, 1 hora para alertas críticas).';
          } else if (tabId === 'luxia_exam') {
            defaultPrompt = 'Eres el Evaluador de Capacitación de Luxia (LUXIA IA Exam Evaluator). Tu rol es evaluar respuestas a exámenes prácticos sobre el uso del CRM de la plataforma Luxia.\n\nObjetivo: Analizar la respuesta provista por el usuario considerando su Rol en el sistema, la Dificultad, la consigna práctica y los Criterios de Evaluación.\n\nInstrucciones:\n1. Califica de manera objetiva y justa con un puntaje de 0 a 100.\n2. Si la respuesta es incompleta o no responde a la consigna, reduce el puntaje correspondientemente.\n3. Genera feedback constructivo e instructivo formateado en Markdown, explicando qué se hizo bien, qué faltó y cómo mejorar.\n4. Si el puntaje es de aprobación (ej: >= 80), felicítalo y destaca sus aciertos.\n\nREGLA ABSOLUTA DE FORMATO JSON:\nDebes responder ÚNICAMENTE con un JSON estructurado de la siguiente forma:\n{\n  "score": <número de 0 a 100>,\n  "justificacion": "<breve frase explicativa para la nota asignada>",\n  "feedback": "<feedback detallado formateado en Markdown, usando estrictamente \\n para saltar líneas>"\n}';
          } else if (tabId === 'luxia_support') {
            defaultPrompt = 'Eres LUXIA IA el Agente de Soporte IA de Luxia (Centro de Ayuda Conversacional). Tu misión exclusiva es guiar a los Account Managers, supervisores y administradores de manera didáctica, precisa y paso a paso en el uso de la plataforma CRM-Luxia CLM.\n\nFUENTES DE VERDAD Y GROUNDING:\n- Tu único conocimiento válido sobre el sistema proviene de los manuales de operaciones y la referencia técnica provista.\n- Si el usuario te pregunta sobre un flujo, botón, campo, regla de negocio o integración que NO se menciona en la documentación, responde: "Disculpa, esa funcionalidad o detalle no se encuentra especificado en la documentación oficial de Luxia CLM. Te sugiero consultar con el equipo de soporte técnico o desarrollo."\n- Prohibido inventar pasos, URLs, nombres de botones, o asumir comportamientos del sistema.\n\nREGLAS DE FORMATO (MARKDOWN PREMIUM):\n1. Estructura Paso a Paso: Para describir tareas, utiliza listas numeradas (1., 2., 3.).\n2. Resaltado de UI: Negrita (**Nombre de Botón**) para elementos de UI, código (`key_field`) para campos de base de datos, y rutas `Configuración > Calibración IA > Guardar`.\n3. Tono: Profesional, accesible y paciente.';
          } else if (tabId === 'luxia_lead_scorer') {
            defaultPrompt = 'Rol: Eres el Evaluador y Calificador de Prospectos Inteligente (LUXIA IA Lead Scorer) de LUXIA® Agro. Tu objetivo es auditar la viabilidad agronómica y comercial de nuevos prospectos (leads agropecuarios) y compararlos con el Perfil de Cliente Ideal (ICP) de Luxia Agro.\n\n=========================================\n1. PERFIL DE CLIENTE IDEAL (ICP) DE LUXIA AGRO:\n- Geografía Target: Zonas agrícolas de Argentina, Brasil, Paraguay, Uruguay, Bolivia, Perú, México o Colombia.\n- Segmentos Clave: Productores Agropecuarios Medianos/Grandes, Distribuidores y Redes de Agronomías, Cooperativas de Acopio y Semilleros.\n- Superficie Mínima: >1,000 Has agrícolas estimadas para cuentas medianas (Tier 2); >5,000 Has para grandes cuentas / empresas de siembra (Tier 1).\n- Demanda de Fitosanitarios: Necesidad de provisión de Herbicidas, Fungicidas, Insecticidas, Coadyuvantes o Tratamiento Profesional de Semillas para cultivos clave (Soja, Maíz, Trigo, Girasol, Cebada, Maní, Algodón).\n\n=========================================\n2. RÚBRICA DE CALIFICACIÓN (0 a 100 puntos):\n- Geografía y Formalidad (Máx 25 pts): 25 pts si opera en cinturones agrícolas de alta productividad y cuenta con CUIT/RUT/RFC válido.\n- Superficie y Potencial de Demanda (Máx 35 pts): 35 pts si supera 5,000 Has, 25 pts si tiene entre 1,000 y 5,000 Has, 10 pts si es <1,000 Has.\n- Cultivo y Familia de Fitosanitarios (Máx 20 pts): 20 pts para cultivos extensivos con alta demanda de protección de cultivos.\n- Capacidad de Pago y Modalidad Comercial (Máx 20 pts): 20 pts si opera con Canje Cereal disponible o legajo crediticio calificado.\n\n=========================================\n3. CRITERIO DE PRIORIDAD (Green, Yellow, Red):\n- Green (Urgencia Baja / Alta Viabilidad): Puntuación >= 75. Excelente encaje con el ICP agropecuario.\n- Yellow (Urgencia Media / Viabilidad Moderada): Puntuación 40-74. Encaje parcial o superficie mediana.\n- Red (Urgencia Alta / Descalificado): Puntuación < 40. Fuera de zona productiva o superficie insignificante.\n\n=========================================\n4. REGLAS ABSOLUTAS DE SALIDA:\nDebes responder ÚNICAMENTE con un objeto JSON válido, sin bloques de código Markdown (no uses ```json ni ```):\n{\n  "score": <número entero entre 0 y 100>,\n  "prioridad": "<Green | Yellow | Red>",\n  "analisis_viabilidad": "<Resumen ejecutivo de 3-4 líneas detallando el potencial agronómico, cultivo y superficie.>",\n  "proximos_pasos": "<Lista de 2 o 3 acciones comerciales recomendadas para el asesor técnico.>" \n}';
          } else if (tabId === 'luxia_pipeline_health') {
            defaultPrompt = 'Rol: Eres el Auditor de Oportunidades y Salud de Ventas (LUXIA IA Pipeline Health Agent) de CLM-Luxia. Tu rol es auditar la higiene comercial, medir el Valor de Contrato Anual (ACV) y predecir riesgos de estancamiento o pérdida en los negocios activos del pipeline.\n\n=========================================\n1. UMBRALES DE TIEMPO Y ESTANCAMIENTO:\n- Diagnóstico (diagnostico): Máximo 15 días.\n- Presentación de Propuesta (propuesta): Máximo 30 días.\n- Negociación de Tarifas (negociacion): Máximo 20 días.\n- Inactividad Absoluta: Más de 10 días sin interacciones.\n\n=========================================\n2. ANÁLISIS DE RIESGO Y CHAMPION:\n- Falta de Champion: Resta probabilidad si la oportunidad no tiene un contacto referente principal asignado con rol (Champion / Decision Maker).\n- Bloqueadores de Presupuesto y Competencia: Detectar mención de competidores en el mercado o disputas de precio.\n- Registro de Competidor Ganador: En negocios perdidos, extraer la empresa competidora elegida.\n\n=========================================\n3. CÁLCULO DE PROBABILIDAD DE CIERRE (0 a 100%):\n- Alta (75% - 100%): Interacción semanal, Champion validado, propuesta técnica aprobada.\n- Media (40% - 74%): Avance en tiempos normales sin bloqueadores graves.\n- Baja (0% - 39%): Estancado en etapa, silencio > 12 días, objeciones insalvables.\n\n=========================================\n4. REGLAS ABSOLUTAS DE SALIDA:\nResponde ÚNICAMENTE con un objeto JSON válido (sin ```json):\n{\n  "probabilidadCierre": <número entero entre 0 y 100>,\n  "saludPipeline": "<Green | Yellow | Red>",\n  "factoresRiesgo": ["<Factor de riesgo 1>", "<Factor de riesgo 2>"],\n  "analisis_viabilidad": "<Resumen ejecutivo conciso de 3 líneas del estado del negocio y su ACV.>",\n  "planAccionRecomendado": ["<Acción comercial 1>", "<Acción comercial 2>"]\n}';
          } else if (tabId === 'luxia_meet') {
            defaultPrompt = 'Eres LUXIA IA, el auditor de riesgo inteligente de Luxia. Tu rol es analizar las transcripciones de videollamadas (Google Meet) registradas entre nuestros Account Managers y clientes, identificando compromisos, resumen del evento y analizando la salud de la cuenta.\n\nREGLA ABSOLUTA DE FORMATO:\nResponde EXCLUSIVAMENTE con un objeto JSON válido. Sin formateo markdown, sin explicaciones ni introducciones.\nSi no puedes calcular un valor, usa null.\n\nESQUEMA DE RESPUESTA REQUERIDO:\n{\n  "resumen": "<string: resumen de máximo 3 bullets o 4 oraciones de los temas críticos discutidos>",\n  "sentimiento": "POSITIVO" | "NEUTRAL" | "NEGATIVO",\n  "alerta_riesgo": <true | false>,\n  "score_salud": <número entero entre 0 y 100>,\n  "accionables": [\n    {\n      "tarea": "<string: acción o tarea acordada>",\n      "encargado": "<string: correo del comercial si es una tarea para el AM de Luxia, o \'cliente\' si el compromiso es del cliente>",\n      "fecha_vencimiento": "<string: fecha estimada en formato YYYY-MM-DD o null si no se especifica>"\n    }\n  ]\n}';
          } else if (tabId === 'luxia_ia_auditor') {
            defaultPrompt = 'Eres el Auditor de Documentación Inteligente de Luxia CRM. Tu misión es analizar reportes de respuestas incorrectas o incompletas de la IA de soporte y proponer una actualización precisa a los manuales oficiales de la plataforma.\n\nDATOS DEL REPORTE:\n- Pregunta del usuario: "{{originalInput}}"\n- Respuesta errónea de la IA: "{{generatedOutput}}"\n- Corrección/Aclaración del usuario: "{{correctedContent}}"\n\nINSTRUCCIONES DE ANÁLISIS:\n1. Revisa las secciones de los manuales que te proporcionamos a continuación.\n2. Identifica cuál es el manual ("manual_operaciones" o "referencia_tecnica") y cuál es el ID de la sección que contiene la información obsoleta, ambigua o donde falta agregar la aclaración del usuario. Si es un tema completamente nuevo, puedes proponer un ID de sección nuevo y un título correspondiente.\n3. Genera un contenido Markdown actualizado y completo para esa sección. Debe incorporar de manera fluida, clara y en español el dato aportado por el usuario en su corrección.\n4. Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (no agregues bloques de código markdown, solo el JSON puro):\n{\n  "manualId": "manual_operaciones" o "referencia_tecnica",\n  "seccionId": "ID de la sección seleccionada",\n  "tituloSeccion": "Título de la sección",\n  "originalContent": "Contenido original de la sección",\n  "proposedContent": "Contenido completo propuesto para la sección en formato markdown incluyendo el encabezado ##"\n}';
          }

          const defaultIa = {
            systemPrompt: defaultPrompt,
            modelName: 'gemini-3.5-flash-lite',
            temperature: (tabId === 'luxia_gmail' || tabId === 'luxia_whatsapp' || tabId === 'luxia_triage' || tabId === 'luxia_architect' || tabId === 'luxia_search' || tabId === 'luxia_exam' || tabId === 'luxia_support' || tabId === 'luxia_lead_scorer' || tabId === 'luxia_pipeline_health' || tabId === 'luxia_meet' || tabId === 'luxia_ia_auditor') ? 0.1 : 0.2,
            maxOutputTokens: (tabId === 'luxia_gmail' || tabId === 'luxia_whatsapp') ? 600 : (tabId === 'luxia_triage' ? 100 : (tabId === 'luxia_architect' ? 2000 : (tabId === 'luxia_search' ? 1200 : (tabId === 'luxia_exam' ? 1500 : (tabId === 'luxia_support' ? 1500 : (tabId === 'luxia_lead_scorer' ? 1000 : (tabId === 'luxia_pipeline_health' ? 1200 : (tabId === 'luxia_meet' ? 800 : (tabId === 'luxia_ia_auditor' ? 2000 : 1000))))))))),
            disabled: false,
            ...(tabId === 'luxia_whatsapp' ? { bufferWindowMinutes: 2 } : {}),
            ...(tabId === 'luxia_lead_scorer' ? {
              icpConfig: {
                paisesTarget: ['MX', 'PE', 'CO', 'CL', 'AR'],
                ciudadesTarget: 'CDMX, Lima, Bogotá, Santiago, Buenos Aires',
                volumenMinimoTier2: 1000,
                volumenMinimoTier1: 10000,
                sectoresFoco: 'E-commerce, Farmacéutica, Cosmética, CPG, Retail',
                rubricaGeografia: 25,
                rubricaVolumen: 35,
                rubricaSector: 20,
                rubricaTecnologia: 20
              }
            } : {})
          };
          await setConfigGeneral('config_ia_' + tabId, defaultIa);
          setIaConfig(defaultIa);
        }
      }
    } catch (err) {
      showAlert(`Error cargando configuración: ${err.message}`, 'danger');
    } finally {
      setIaLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadIaConfig(activeTab);
  }, [loadIaConfig, activeTab]);

  const handleSaveIa = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setConfigGeneral('config_ia_' + activeTab, iaConfig);

      await logSystemEvent(currentUser, 'system_config_change', {
        tipoConfig: `luxia_ia_${activeTab}`,
        modelName: iaConfig.modelName || null,
        temperature: iaConfig.temperature || null,
        maxOutputTokens: iaConfig.maxOutputTokens || null
      });
      showAlert('Configuración guardada con éxito.', 'success');
      loadIaConfig(activeTab);
    } catch (err) {
      showAlert(`Error al guardar configuración: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAgentDisabled = async (newDisabled) => {
    try {
      const updated = { ...iaConfig, disabled: newDisabled };
      await setConfigGeneral('config_ia_' + activeTab, updated);
      setIaConfig(updated);

      await logSystemEvent(currentUser, 'system_config_change', {
        tipoConfig: `luxia_ia_${activeTab}_toggle`,
        disabled: newDisabled
      });

      showAlert(`Agente ${newDisabled ? 'desactivado' : 'activado'} con éxito.`, 'success');
    } catch (err) {
      showAlert(`Error al cambiar estado: ${err.message}`, 'danger');
    }
  };

  const handleModelChange = async (newModel) => {
    const updated = { ...iaConfig, modelName: newModel };
    setIaConfig(updated);
    try {
      await setConfigGeneral('config_ia_' + activeTab, updated);
      showAlert('Modelo actualizado con éxito.', 'success');
      
      await logSystemEvent(currentUser, 'system_config_change', {
        tipoConfig: `luxia_ia_${activeTab}_model`,
        modelName: newModel
      });
    } catch (err) {
      showAlert(`Error al actualizar modelo: ${err.message}`, 'danger');
    }
  };

  const handleTemperatureChange = async (newTemp) => {
    const updated = { ...iaConfig, temperature: newTemp };
    setIaConfig(updated);
    try {
      await setConfigGeneral('config_ia_' + activeTab, updated);
      showAlert('Temperatura actualizada con éxito.', 'success');
      await logSystemEvent(currentUser, 'system_config_change', {
        tipoConfig: `luxia_ia_${activeTab}_temperature`,
        temperature: newTemp
      });
    } catch (err) {
      showAlert(`Error al actualizar temperatura: ${err.message}`, 'danger');
    }
  };

  const handleMaxTokensChange = async (newTokens) => {
    const updated = { ...iaConfig, maxOutputTokens: newTokens };
    setIaConfig(updated);
    try {
      await setConfigGeneral('config_ia_' + activeTab, updated);
      showAlert('Límite de tokens actualizado con éxito.', 'success');
      await logSystemEvent(currentUser, 'system_config_change', {
        tipoConfig: `luxia_ia_${activeTab}_tokens`,
        maxOutputTokens: newTokens
      });
    } catch (err) {
      showAlert(`Error al actualizar tokens: ${err.message}`, 'danger');
    }
  };

  const handleBufferWindowChange = async (newBuffer) => {
    const updated = { ...iaConfig, bufferWindowMinutes: newBuffer };
    setIaConfig(updated);
    try {
      await setConfigGeneral('config_ia_' + activeTab, updated);
      showAlert('Tiempo de búfer de WhatsApp actualizado con éxito.', 'success');
      await logSystemEvent(currentUser, 'system_config_change', {
        tipoConfig: `luxia_ia_${activeTab}_buffer`,
        bufferWindowMinutes: newBuffer
      });
    } catch (err) {
      showAlert(`Error al actualizar buffer: ${err.message}`, 'danger');
    }
  };

  const handleRestoreIaVersion = async (version) => {
    setSaving(true);
    try {
      const restoredData = {
        systemPrompt: version.systemPrompt || '',
        modelName: version.modelName || 'gemini-3.5-flash-lite',
        temperature: version.temperature !== undefined ? version.temperature : 0.2,
        maxOutputTokens: version.maxOutputTokens !== undefined ? version.maxOutputTokens : 1000,
        disabled: version.disabled !== undefined ? version.disabled : false
      };
      if (version.bufferWindowMinutes !== undefined) {
        restoredData.bufferWindowMinutes = version.bufferWindowMinutes;
      }
      if (version.icpConfig !== undefined) {
        restoredData.icpConfig = version.icpConfig;
      }
      await setConfigGeneral('config_ia_' + activeTab, restoredData);

      showAlert(`Configuración restaurada con éxito.`, 'success');
      loadIaConfig(activeTab);
    } catch (err) {
      showAlert(`Error al restaurar: ${err.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="row g-4 mb-4">
      <div className={activeTab === 'kb_manager' ? "col-12" : "col-lg-8"}>
        <div className="card border-0 bg-light p-4 rounded-4 shadow-sm mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold mb-0 text-dark"><i className="bi bi-cpu me-2 text-primary"></i>Calibración de LUXIA IA</h5>
            <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 fw-bold">SuperAdmin Only</span>
          </div>
          <p className="small text-muted mb-3">
            Ajusta en caliente el comportamiento, tono y límites de los distintos motores de Inteligencia Artificial que operan en la plataforma.
          </p>

          <ul className="nav nav-tabs border-bottom mb-4">
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_ia' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('luxia_ia')}>👤 Salud de Cliente</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_gmail' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('luxia_gmail')}>📥 Gmail Sync</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_whatsapp' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('luxia_whatsapp')}>💬 WhatsApp Sync</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_contracts' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('luxia_contracts')}>📄 Contratos</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_copilot' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('luxia_copilot')}>🎙️ Copiloto</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_search' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('luxia_search')}>🔍 Buscador</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_triage' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('luxia_triage')}>🚦 Triage</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_architect' ? 'active fw-bold text-success' : 'text-success'}`} onClick={() => setActiveTab('luxia_architect')}>📊 Métricas</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_exam' ? 'active fw-bold text-primary' : 'text-primary'}`} onClick={() => setActiveTab('luxia_exam')}>🎓 Capacitación</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_support' ? 'active fw-bold text-warning' : 'text-warning'}`} onClick={() => setActiveTab('luxia_support')}>💬 Soporte IA</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_lead_scorer' ? 'active fw-bold text-success' : 'text-success'}`} onClick={() => setActiveTab('luxia_lead_scorer')}>🎯 Lead Scorer</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_pipeline_health' ? 'active fw-bold text-info' : 'text-info'}`} onClick={() => setActiveTab('luxia_pipeline_health')}>📈 Pipeline Health</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_meet' ? 'active fw-bold text-primary' : 'text-primary'}`} onClick={() => setActiveTab('luxia_meet')}>📹 Google Meet</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'kb_manager' ? 'active fw-bold text-info' : 'text-info'}`} onClick={() => setActiveTab('kb_manager')}>📝 Propuestas KB</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'luxia_ia_auditor' ? 'active fw-bold text-danger' : 'text-danger'}`} onClick={() => setActiveTab('luxia_ia_auditor')}>🤖 Auditor KB</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'system_alerts' ? 'active fw-bold text-danger' : 'text-danger'}`} onClick={() => setActiveTab('system_alerts')}>🚨 Alertas Infra</button>
            </li>
          </ul>

          {activeTab === 'kb_manager' ? (
            <AdminKbManager currentUser={currentUser} />
          ) : iaLoading ? (
            <div className="text-center py-5"><span className="spinner-border spinner-border-sm me-2 text-primary"></span>Cargando configuración...</div>
          ) : activeTab === 'system_alerts' ? (
            <form onSubmit={handleSaveIa} className="animate__animated animate__fadeIn">
              <div className="mb-4 bg-danger bg-opacity-10 p-4 rounded-4 border border-danger border-opacity-25 shadow-sm">
                <h6 className="fw-bold text-danger mb-2 d-flex align-items-center"><i className="bi bi-shield-exclamation fs-4 me-2"></i>Circuit Breaker (Tolerancia a Fallos IA)</h6>
                <p className="small text-dark mb-0">Configura cuándo disparar una alerta crítica de sistema si el proveedor de IA empieza a fallar constantemente (errores de red, cuotas, 503).</p>
              </div>
              <div className="row g-4 mb-4">
                <div className="col-md-4">
                  <label className="form-label small fw-bold mb-1.5 text-dark">Máximo de Fallos Consecutivos</label>
                  <input type="number" className="form-control form-control-lg fw-bold" min="1" value={iaConfig.maxConsecutiveErrors || 5} onChange={e => setIaConfig({...iaConfig, maxConsecutiveErrors: parseInt(e.target.value) || 5})} />
                  <div className="form-text small">Dispara alerta tras X errores.</div>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold mb-1.5 text-dark">Ventana de Tiempo (Minutos)</label>
                  <input type="number" className="form-control form-control-lg fw-bold" min="1" value={iaConfig.timeWindowMinutes || 10} onChange={e => setIaConfig({...iaConfig, timeWindowMinutes: parseInt(e.target.value) || 10})} />
                  <div className="form-text small">Tiempo para acumular los fallos.</div>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold mb-1.5 text-dark">Reintentos Silenciosos (Backoff)</label>
                  <input type="number" className="form-control form-control-lg fw-bold" min="0" max="10" value={iaConfig.silentRetries !== undefined ? iaConfig.silentRetries : 3} onChange={e => setIaConfig({...iaConfig, silentRetries: e.target.value === '' ? 0 : parseInt(e.target.value)})} />
                  <div className="form-text small">Intentos antes de reportar el fallo.</div>
                </div>
                <div className="col-12 mt-2">
                  <div className="card border border-light shadow-sm rounded-4 p-3 bg-light">
                    <div className="form-check form-switch mb-2">
                      <input className="form-check-input" type="checkbox" id="sendEmail" checked={iaConfig.sendEmail || false} onChange={e => setIaConfig({...iaConfig, sendEmail: e.target.checked})} />
                      <label className="form-check-label fw-bold text-dark" htmlFor="sendEmail">Enviar notificación de caída por correo</label>
                    </div>
                    {iaConfig.sendEmail && (
                      <div className="mt-3 animate__animated animate__fadeIn">
                        <label className="form-label small fw-bold mb-1 text-dark">Correos de los Administradores (separados por coma)</label>
                        <input type="text" className="form-control" placeholder="admin1@luxia.com, devops@luxia.com" value={(iaConfig.adminEmails || []).join(', ')} onChange={e => setIaConfig({...iaConfig, adminEmails: e.target.value.split(',').map(s=>s.trim()).filter(s=>s)})} />
                        <div className="form-text small">Recibirán un email urgente cuando se dispare el Circuit Breaker.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-danger rounded-pill px-4 py-2 fw-bold shadow-sm" disabled={saving}>
                {saving ? 'Guardando...' : <><i className="bi bi-save me-2"></i>Guardar Reglas de Alerta</>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSaveIa}>
              {/* Toggle de Habilitación del Agente */}
              <div className={`card border-0 p-3 mb-4 rounded-4 shadow-sm animate__animated animate__fadeIn ${iaConfig.disabled ? 'bg-danger bg-opacity-10 border border-danger border-opacity-25' : 'bg-success bg-opacity-10 border border-success border-opacity-25'}`}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="fw-bold mb-1 text-dark">
                      {iaConfig.disabled ? (
                        <><i className="bi bi-toggle-off text-danger me-2 fs-5"></i>Agente Deshabilitado</>
                      ) : (
                        <><i className="bi bi-toggle-on text-success me-2 fs-5"></i>Agente Activo</>
                      )}
                    </h6>
                    <p className="small text-muted mb-0">
                      {iaConfig.disabled 
                        ? 'Este agente está inactivo. No procesará tareas ni realizará llamadas a la API de Gemini.' 
                        : 'Este agente está operativo y procesará solicitudes según las reglas y prompts definidos.'}
                    </p>
                  </div>
                  <div className="form-check form-switch mb-0">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="agentDisabledToggle" 
                      style={{ transform: 'scale(1.25)', cursor: 'pointer' }}
                      checked={!iaConfig.disabled} 
                      onChange={async (e) => {
                        const newDisabled = !e.target.checked;
                        await handleToggleAgentDisabled(newDisabled);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label small fw-bold mb-0 text-dark">System Prompt (Instrucciones del Sistema)</label>
                  {activeTab === 'luxia_lead_scorer' && (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                      {icpAutoCompile ? 'Generado por Calibración Visual (Solo Lectura)' : 'Edición Libre'}
                    </span>
                  )}
                </div>
                <textarea
                  className="form-control"
                  rows="8"
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  required
                  value={iaConfig.systemPrompt}
                  onChange={e => setIaConfig({...iaConfig, systemPrompt: e.target.value})}
                  readOnly={activeTab === 'luxia_lead_scorer' && icpAutoCompile}
                ></textarea>
                <div className="form-text" style={{ fontSize: '0.75rem' }}>
                  {activeTab === 'luxia_lead_scorer' && icpAutoCompile 
                    ? 'Este prompt se calcula automáticamente a partir de los controles visuales de la sección "Calibración Visual del Cliente Ideal (ICP)".'
                    : 'Define el comportamiento base de LUXIA IA para esta fuente de datos, su tono, y los criterios para catalogar el riesgo.'}
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <label className="form-label small fw-bold mb-1 text-dark">Modelo Fundacional</label>
                  <select
                    className="form-select"
                    value={iaConfig.modelName}
                    onChange={e => handleModelChange(e.target.value)}
                  >
                    {activeDbModels.length > 0 ? (
                      activeDbModels.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nombre || m.id} {m.esDefault ? '(Default Global)' : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recomendado / Producción)</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash (Rápido y eficiente)</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Estándar)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (Razonamiento complejo)</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold mb-1 text-dark">Temperatura: {iaConfig.temperature}</label>
                  <input
                    type="range"
                    className="form-range mt-2"
                    min="0"
                    max="1"
                    step="0.1"
                    value={iaConfig.temperature}
                    onChange={e => setIaConfig({...iaConfig, temperature: parseFloat(e.target.value)})}
                    onMouseUp={e => handleTemperatureChange(parseFloat(e.target.value))}
                    onTouchEnd={e => handleTemperatureChange(parseFloat(e.target.value))}
                  />
                  <div className="form-text d-flex justify-content-between" style={{ fontSize: '0.7rem' }}>
                    <span>Determinista (0.0)</span>
                    <span>Creativo (1.0)</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold mb-1 text-dark">Límite de Tokens de Salida</label>
                  <input
                    type="number"
                    className="form-control"
                    min="100"
                    max="8000"
                    required
                    value={iaConfig.maxOutputTokens}
                    onChange={e => setIaConfig({...iaConfig, maxOutputTokens: parseInt(e.target.value) || 1000})}
                    onBlur={e => handleMaxTokensChange(parseInt(e.target.value) || 1000)}
                  />
                </div>
              </div>

              {activeTab === 'luxia_whatsapp' && (
                <div className="card border border-secondary border-opacity-10 p-3 bg-light rounded-4 mb-4 mt-3">
                  <h6 className="fw-bold text-dark mb-2" style={{ fontSize: '0.85rem' }}>
                    <i className="bi bi-clock-fill text-primary me-2"></i>Agrupación de Mensajes (Debouncing)
                  </h6>
                  <p className="text-muted mb-3" style={{ fontSize: '0.72rem', lineHeight: '1.4' }}>
                    Configura el tiempo máximo (en minutos) para agrupar los mensajes de un mismo cliente en un solo bloque conversacional antes de ejecutar el análisis de LUXIA IA y disparar las alertas. Esto minimiza llamadas a la API de Gemini y evita duplicar notificaciones.
                  </p>
                  <div className="row">
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-dark mb-1" style={{ fontSize: '0.75rem' }}>Tiempo de Búfer (Minutos)</label>
                      <input
                        type="number"
                        className="form-control fw-bold"
                        min="1"
                        max="30"
                        required
                        value={iaConfig.bufferWindowMinutes || 2}
                        onChange={e => setIaConfig({...iaConfig, bufferWindowMinutes: parseInt(e.target.value) || 2})}
                        onBlur={e => handleBufferWindowChange(parseInt(e.target.value) || 2)}
                        style={{ fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'luxia_lead_scorer' && (
                <div className="card border border-secondary border-opacity-10 p-3 bg-light rounded-4 mb-4 mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.85rem' }}>
                      <i className="bi bi-sliders text-success me-2"></i>Calibración Visual del Cliente Ideal (ICP)
                    </h6>
                    <div className="form-check form-switch mb-0">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id="icpAutoCompileToggle" 
                        checked={icpAutoCompile} 
                        onChange={e => setIcpAutoCompile(e.target.checked)} 
                      />
                      <label className="form-check-label small fw-bold text-muted" htmlFor="icpAutoCompileToggle" style={{ fontSize: '0.72rem' }}>Auto-Compilar Prompt</label>
                    </div>
                  </div>

                  {icpAutoCompile ? (
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label small fw-bold mb-1 text-dark" style={{ fontSize: '0.75rem' }}>Países Cobertura Target</label>
                        <div className="d-flex flex-wrap gap-3 p-2 border rounded-3 bg-light bg-opacity-50">
                          {['MX', 'PE', 'CO', 'CL', 'AR'].map(country => {
                            const isChecked = (iaConfig.icpConfig?.paisesTarget || []).includes(country);
                            return (
                              <div key={country} className="form-check">
                                <input 
                                  className="form-check-input" 
                                  type="checkbox" 
                                  id={`country-${country}`} 
                                  checked={isChecked}
                                  onChange={() => handleToggleCountry(country)}
                                />
                                <label className="form-check-label small fw-bold" htmlFor={`country-${country}`} style={{ fontSize: '0.75rem' }}>
                                  {country === 'MX' ? '🇲🇽 México' : country === 'PE' ? '🇵🇪 Perú' : country === 'CO' ? '🇨🇴 Colombia' : country === 'CL' ? '🇨🇱 Chile' : '🇦🇷 Argentina'}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-bold mb-1 text-dark" style={{ fontSize: '0.75rem' }}>Ciudades Target (separadas por coma)</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="CDMX, Lima, Bogotá..." 
                          value={iaConfig.icpConfig?.ciudadesTarget || ''}
                          onChange={e => handleIcpConfigChange('ciudadesTarget', e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-bold mb-1 text-dark" style={{ fontSize: '0.75rem' }}>Sectores Clave (separados por coma)</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="E-commerce, Farmacéutica..." 
                          value={iaConfig.icpConfig?.sectoresFoco || ''}
                          onChange={e => handleIcpConfigChange('sectoresFoco', e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-bold mb-1 text-dark" style={{ fontSize: '0.75rem' }}>Volumen Mínimo Tier 2 (Mediano)</label>
                        <input 
                          type="number" 
                          className="form-control fw-bold" 
                          value={iaConfig.icpConfig?.volumenMinimoTier2 || 1000}
                          onChange={e => handleIcpConfigChange('volumenMinimoTier2', parseInt(e.target.value) || 0)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold mb-1 text-dark" style={{ fontSize: '0.75rem' }}>Volumen Mínimo Tier 1 (Enterprise)</label>
                        <input 
                          type="number" 
                          className="form-control fw-bold" 
                          value={iaConfig.icpConfig?.volumenMinimoTier1 || 10000}
                          onChange={e => handleIcpConfigChange('volumenMinimoTier1', parseInt(e.target.value) || 0)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>

                      <div className="col-12 border-top pt-3 mt-2">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="fw-bold small text-muted mb-0" style={{ fontSize: '0.72rem' }}>Rúbrica de Ponderación (Total: 100 puntos)</h6>
                          {(() => {
                            const sum = (iaConfig.icpConfig?.rubricaGeografia || 0) + 
                                        (iaConfig.icpConfig?.rubricaVolumen || 0) + 
                                        (iaConfig.icpConfig?.rubricaSector || 0) + 
                                        (iaConfig.icpConfig?.rubricaTecnologia || 0);
                            return (
                              <span className={`badge rounded-pill fw-bold ${sum === 100 ? 'bg-success text-white' : 'bg-warning text-dark'}`} style={{ fontSize: '0.7rem' }}>
                                Total: {sum}/100 pts {sum !== 100 && '⚠️'}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="row g-3">
                          <div className="col-md-3">
                            <label className="form-label small text-muted mb-1" style={{ fontSize: '0.7rem' }}>Geografía ({iaConfig.icpConfig?.rubricaGeografia || 25} pts)</label>
                            <input 
                              type="range" 
                              className="form-range" 
                              min="0" 
                              max="100" 
                              value={iaConfig.icpConfig?.rubricaGeografia || 25}
                              onChange={e => handleIcpConfigChange('rubricaGeografia', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small text-muted mb-1" style={{ fontSize: '0.7rem' }}>Volumen ({iaConfig.icpConfig?.rubricaVolumen || 35} pts)</label>
                            <input 
                              type="range" 
                              className="form-range" 
                              min="0" 
                              max="100" 
                              value={iaConfig.icpConfig?.rubricaVolumen || 35}
                              onChange={e => handleIcpConfigChange('rubricaVolumen', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small text-muted mb-1" style={{ fontSize: '0.7rem' }}>Sector ({iaConfig.icpConfig?.rubricaSector || 20} pts)</label>
                            <input 
                              type="range" 
                              className="form-range" 
                              min="0" 
                              max="100" 
                              value={iaConfig.icpConfig?.rubricaSector || 20}
                              onChange={e => handleIcpConfigChange('rubricaSector', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label small text-muted mb-1" style={{ fontSize: '0.7rem' }}>Tecnología ({iaConfig.icpConfig?.rubricaTecnologia || 20} pts)</label>
                            <input 
                              type="range" 
                              className="form-range" 
                              min="0" 
                              max="100" 
                              value={iaConfig.icpConfig?.rubricaTecnologia || 20}
                              onChange={e => handleIcpConfigChange('rubricaTecnologia', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert alert-info py-2 px-3 small mb-0 rounded-3" style={{ fontSize: '0.75rem' }}>
                      <i className="bi bi-info-circle-fill me-2"></i>La calibración visual está desactivada. Puedes modificar el System Prompt libremente en el editor de texto superior.
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Nueva Versión'}
              </button>
            </form>
          )}
        </div>
      </div>

      {activeTab !== 'kb_manager' && (
        <div className="col-lg-4">
          <div className="card border-0 bg-white p-4 rounded-4 shadow-sm" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <h6 className="fw-bold text-dark mb-3">
            <i className="bi bi-clock-history text-primary me-2"></i>Historial de Versiones
          </h6>
          <p className="small text-muted mb-3" style={{ fontSize: '0.75rem' }}>
            Cada vez que guardas la configuración, se crea un respaldo automático. Haz clic en "Restaurar" para volver a una versión previa.
          </p>
          {iaVersions.length === 0 ? (
            <div className="text-center text-muted small py-4">No hay versiones guardadas en el historial.</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {iaVersions.map((v, index) => (
                <div key={v.id} className="p-3 rounded bg-light border border-opacity-10 position-relative shadow-xs">
                  {index === 0 && (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-0.5 position-absolute top-0 end-0 m-2 fw-bold" style={{ fontSize: '0.6rem' }}>
                       Activa
                    </span>
                  )}
                  <div className="fw-bold text-dark small mb-1">
                    {new Date(v.timestamp).toLocaleString()}
                  </div>
                  <div className="text-muted mb-2" style={{ fontSize: '0.7rem' }}>
                    <div><strong>Por:</strong> {v.updatedBy || 'Desconocido'}</div>
                    <div><strong>Modelo:</strong> {v.modelName} (Temp: {v.temperature})</div>
                    {v.restoredFrom && (
                      <div className="text-purple fw-bold" style={{ fontSize: '0.68rem', color: '#6f42c1' }}><i className="bi bi-arrow-counterclockwise"></i> Restaurada</div>
                    )}
                  </div>
                  <div className="text-muted small mb-2 border-top pt-1 text-wrap" style={{ fontSize: '0.68rem', fontFamily: 'monospace', wordBreak: 'break-all' }} title={v.systemPrompt || JSON.stringify(v)}>
                    {v.systemPrompt ? (v.systemPrompt.slice(0, 80) + (v.systemPrompt.length > 80 ? '...' : '')) : (activeTab === 'system_alerts' ? `Fallos: ${v.maxConsecutiveErrors} en ${v.timeWindowMinutes} min` : '')}
                  </div>
                  {index > 0 && (
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-primary rounded-pill w-100 fw-bold py-1"
                      style={{ fontSize: '0.65rem' }}
                      disabled={saving}
                      onClick={() => {
                        setConfirmModal({
                          show: true,
                          title: 'Restaurar Versión Anterior',
                          message: `¿Estás seguro de que deseas restaurar la configuración guardada el ${new Date(v.timestamp).toLocaleString()}? Los cambios se aplicarán inmediatamente en caliente al motor de IA.`,
                          confirmBtnClass: 'btn-primary',
                          confirmText: 'Restaurar Configuración',
                          onConfirm: async () => {
                            setConfirmModal(prev => ({ ...prev, show: false }));
                            await handleRestoreIaVersion(v);
                          }
                        });
                      }}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar
                    </button>
                  )}
                </div>
              ))}
              
              {hasMoreIaVersions && (
                <button
                  type="button"
                  className="btn btn-xs btn-outline-secondary rounded-pill w-100 fw-bold py-1.5 mt-2 shadow-xs"
                  style={{ fontSize: '0.68rem' }}
                  disabled={iaLoading}
                  onClick={() => setIaVersionsLimit(prev => prev + 10)}
                >
                  Ver más versiones
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      <ConfirmModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmBtnClass={confirmModal.confirmBtnClass}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
}
