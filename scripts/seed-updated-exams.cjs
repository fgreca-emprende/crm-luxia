#!/usr/bin/env node
/**
 * seed-updated-exams.cjs
 * 
 * Script de actualización y sembrado del catálogo maestro de exámenes de Auto-Capacitación.
 * Depura preguntas obsoletas, elimina documentos legados (usuario_basico, usuario_avanzado)
 * e inserta evaluaciones estructuradas y alineadas a los roles RBAC reales del CRM-Luxia.
 * 
 * Ejecución: node scripts/seed-updated-exams.cjs
 */

const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account-dev.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("No se encontró el archivo de cuenta de servicio dev");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const examsCatalog = {
  // 1. LECTOR ÚNICO
  lector_unico: {
    rol: "lector",
    dificultad: "unico",
    teorico: [
      {
        id: "q1",
        pregunta: "¿Cuáles son los permisos de visualización y edición del rol Lector en el CRM-Luxia?",
        opciones: [
          "Acceso exclusivo de sólo lectura a clientes, bitácoras, tablero y contratos, sin permisos de escritura ni mutación",
          "Permisos de lectura y creación de notas manuales de bitácora",
          "Permisos de configuración de Luxia IA y pausa de presupuestos FinOps",
          "Creación de clientes y oportunidades pero sin acceso a exportaciones"
        ],
        correcta: 0
      },
      {
        id: "q2",
        pregunta: "¿Qué representan los niveles de prioridad Green, Yellow y Red en el Health Score del cliente?",
        opciones: [
          "Green: Cuenta estable; Yellow: Riesgo moderado; Red: Riesgo alto de pérdida (Churn)",
          "Green: Contrato por vencer; Yellow: Sin contrato; Red: Contrato activo",
          "Green: Operador activo; Yellow: En descanso; Red: Desconectado",
          "Green: Lead calificado; Yellow: En prospección; Red: Descalificado"
        ],
        correcta: 0
      },
      {
        id: "q3",
        pregunta: "En la vista de consolidación multipaís del CRM, ¿cómo se visualizan los montos financieros?",
        opciones: [
          "En 'Toda la Región' se consolidan en USD, y en la vista de país individual se muestran en moneda local y su equivalente en USD",
          "Únicamente en la moneda local de la sede central en Perú",
          "En euros (EUR) con tasa flotante diaria",
          "Cada comercial puede elegir la divisa sin conversión automática"
        ],
        correcta: 0
      },
      {
        id: "q4",
        pregunta: "¿Dónde se consultan las justificaciones del análisis de salud generadas históricamente por Luxia IA?",
        opciones: [
          "En la línea de tiempo (timeline) de salud y bitácora de la ficha del cliente",
          "En la consola de API Keys de integraciones",
          "En la tabla de usuarios del sistema",
          "Únicamente mediante correos nocturnos"
        ],
        correcta: 0
      },
      {
        id: "q5",
        pregunta: "¿Qué información expone el Tablero CRM en su modo Dashboard de KPIs?",
        opciones: [
          "Gráficos analíticos en tiempo real de tasa de cierre (Win Rate), volumen de leads e importes ponderados",
          "El listado de contraseñas de las cuentas corporativas",
          "El código fuente de las Cloud Functions",
          "Las métricas de almacenamiento en disco del servidor"
        ],
        correcta: 0
      },
      {
        id: "q6",
        pregunta: "¿Qué estados indican la vigencia de un contrato logístico en la lista de contratos del cliente?",
        opciones: [
          "Vigente (Verde), Próximo a Vencer (Naranja) y Vencido (Rojo)",
          "Activo, Pendiente y Eliminado",
          "Sincronizado, Fallido y En Proceso",
          "Aprobado por IA y Rechazado por IA"
        ],
        correcta: 0
      },
      {
        id: "q7",
        pregunta: "¿Puede un usuario con rol Lector modificar o resolver Alertas de Riesgo comercial?",
        opciones: [
          "No, la resolución requiere justificación de auditoría comercial escrita por un AM, Supervisor o Admin",
          "Sí, haciendo clic en el botón de cierre rápido de la alerta",
          "Sí, enviando un comando de voz al Copiloto",
          "Sólo si es el creador original de la cuenta"
        ],
        correcta: 0
      },
      {
        id: "q8",
        pregunta: "¿Cómo responde la interfaz del CRM al principio de diseño Mobile-First en teléfonos móviles?",
        opciones: [
          "Reemplaza el sidebar lateral por un menú deslizable (Slide-over drawer) táctil e intuitivo",
          "Inhabilita el acceso a la plataforma desde dispositivos móviles",
          "Fuerza una tabla con scroll horizontal rígido de 2000px",
          "Oculta toda la información de los contratos comerciales"
        ],
        correcta: 0
      },
      {
        id: "q9",
        pregunta: "Si un Lector identifica un dato erróneo en la ficha de un cliente, ¿cuál es el procedimiento correcto?",
        opciones: [
          "Notificar al Account Manager asignado o al Administrador, ya que no posee privilegios de edición",
          "Modificar directamente el campo en la interfaz",
          "Crear un nuevo registro duplicado con los datos correctos",
          "Borrar la bitácora del cliente para forzar la actualización"
        ],
        correcta: 0
      },
      {
        id: "q10",
        pregunta: "¿Qué información de preventa puede consultar un Lector en el Pipeline Kanban de Oportunidades?",
        opciones: [
          "Las tarjetas de oportunidades por etapa, el valor ponderado y la distribución regional",
          "El código de transacción bancaria de los clientes",
          "Los estados financieros internos de la empresa",
          "Ninguna, la solapa comercial está oculta para Lectores"
        ],
        correcta: 0
      }
    ],
    practico: {
      id: "p1",
      pregunta: "Describe cómo interpretarías la información de la bitácora, el Health Score y las alertas activas de un cliente corporativo en riesgo ('Red') para presentar un informe pasivo a tu gerencia sin alterar datos en el CRM.",
      criteriosEvaluacion: [
        "Identificar la causa raíz en la bitácora y línea de tiempo de salud",
        "Interpretar correctamente los indicadores cromáticos de riesgo (Red/Yellow/Green)",
        "Justificar el rol de consulta y la derivación al Account Manager responsable"
      ]
    }
  },

  // 2. AGENTE COMERCIAL - BÁSICO
  agente_basico: {
    rol: "agente",
    dificultad: "basico",
    teorico: [
      {
        id: "q1",
        pregunta: "¿Cómo califica Luxia IA la prospección de un nuevo Lead ingresado al CRM?",
        opciones: [
          "Asigna un puntaje de 0 a 100, prioridad (Green/Yellow/Red) y un análisis descriptivo del encaje con el ICP del país",
          "Verifica si el correo electrónico tiene contraseña válida",
          "Envía un contrato en PDF directamente al contacto del lead",
          "Elimina los leads que obtengan menos de 50 puntos"
        ],
        correcta: 0
      },
      {
        id: "q2",
        pregunta: "Al calificar positivamente un Lead en el módulo de prospección, ¿qué entidades se crean automáticamente?",
        opciones: [
          "Se crean de forma atómica el Cliente, el Contacto principal y la Oportunidad en la etapa inicial del Pipeline",
          "Se genera un ticket de soporte en la bandeja de CX",
          "Se emite la primera factura en moneda local",
          "Solo se actualiza el campo de observaciones en el lead"
        ],
        correcta: 0
      },
      {
        id: "q3",
        pregunta: "¿Cómo funciona la regla de divisas y tasas de cambio al registrar el monto de una Oportunidad?",
        opciones: [
          "El AM ingresa el valor en la Moneda Local del trato y el backend calcula y congela su equivalente en USD",
          "El monto debe ingresarse obligatoriamente en dólares americanos (USD)",
          "La tasa de cambio se actualiza retroactivamente todos los días alterando tratos cerrados",
          "El sistema no permite registrar montos financieros en preventa"
        ],
        correcta: 0
      },
      {
        id: "q4",
        pregunta: "¿Qué es la regla de Gatekeeping al mover una Oportunidad de etapa en el Kanban comercial?",
        opciones: [
          "Un control que exige completar campos obligatorios de la etapa destino antes de permitir la transición",
          "Un algoritmo que borra las oportunidades sin actividad por más de 7 días",
          "Una restricción que impide mover tarjetas los fines de semana",
          "Un mensaje de aprobación que se envía al cliente antes de cambiar de columna"
        ],
        correcta: 0
      },
      {
        id: "q5",
        pregunta: "Al marcar una Oportunidad como 'Cerrada Ganada', ¿qué proceso de post-venta se inicia automáticamente?",
        opciones: [
          "El cliente pasa al estado 'Onboarding' y se inicializa su checklist estandarizado de hitos de activación",
          "La cuenta pasa directamente a estado Inactivo hasta recibir el primer despacho",
          "Se envía un examen de certificación al Account Manager asignado",
          "Se desactiva la cuenta de WhatsApp Business asociada"
        ],
        correcta: 0
      },
      {
        id: "q6",
        pregunta: "¿Cuáles son las 5 columnas del flujo de tareas del Tablero Kanban del CRM?",
        opciones: [
          "📦 Backlog, 📋 Por Hacer, ⚙️ En Proceso, 👀 En Revisión y ✅ Completado",
          "Nuevo, En Espera, Cancelado, Facturado y Archivado",
          "Lead, Contacto, Trato, Contrato y Cliente",
          "Soporte L1, Soporte L2, Soporte L3, Devs y FinOps"
        ],
        correcta: 0
      },
      {
        id: "q7",
        pregunta: "Para optimizar el uso de base de datos y memoria en el Tablero de Actividades, ¿cómo se cargan las tareas 'Completadas'?",
        opciones: [
          "Se filtran suscribiendo en tiempo real únicamente las tareas modificadas en los últimos 30 días",
          "Se cargan todas las tareas completadas desde el origen de los tiempos",
          "Las tareas completadas se eliminan inmediatamente de Firestore",
          "Se requiere refrescar la página manualmente para ver tareas terminadas"
        ],
        correcta: 0
      },
      {
        id: "q8",
        pregunta: "¿Qué restricción aplica la Consola de WhatsApp Business cuando han transcurrido más de 24 horas del último mensaje del cliente?",
        opciones: [
          "Se bloquea el texto libre y exige utilizar Plantillas Pre-aprobadas por Meta con variables",
          "Se cierra definitivamente la conversación y no se puede volver a contactar",
          "El sistema cobra una multa en dólares al comercial",
          "Se elimina el número telefónico de la base de datos"
        ],
        correcta: 0
      },
      {
        id: "q9",
        pregunta: "¿Qué función cumple un 'Susurro' (Nota Interna) en la consola de WhatsApp?",
        opciones: [
          "Guardar anotaciones internas en amarillo visibles para el equipo Luxia e invisibles para el cliente",
          "Enviar un mensaje de audio que se borra al ser escuchado",
          "Programar un mensaje saliente para el día siguiente",
          "Notificar a la gerencia de finanzas sobre un descuento"
        ],
        correcta: 0
      },
      {
        id: "q10",
        pregunta: "Durante una videollamada comercial iniciada desde el CRM en Google Meet, ¿qué alerta emite el widget de Luxia?",
        opciones: [
          "Emite beeps acústicos y alertas visuales al cumplirse el minuto 4 del límite estándar de 5 minutos",
          "Desconecta la videollamada de forma abrupta a los 2 minutos",
          "Envía un correo al cliente notificando el fin del tiempo",
          "Silencia el micrófono del comercial automáticamente"
        ],
        correcta: 0
      }
    ],
    practico: {
      id: "p1",
      pregunta: "Un lead de un cliente corporativo de Retail en México ingresa al CRM. Describe paso a paso cómo lo evaluarías con Luxia Scorer, cómo lo moverías a través del Pipeline aplicando Gatekeeping y qué datos registrarías al cerrarlo como Ganado.",
      criteriosEvaluacion: [
        "Ejecutar el scoring IA y revisar el score numérico y prioridad Green/Yellow/Red",
        "Demostrar el cumplimiento de los campos de Gatekeeping requeridos por la etapa",
        "Detallar el inicio automático del Onboarding y la inicialización del checklist al marcar Ganado"
      ]
    }
  },

  // 3. AGENTE COMERCIAL - AVANZADO
  agente_avanzado: {
    rol: "agente",
    dificultad: "avanzado",
    teorico: [
      {
        id: "q1",
        pregunta: "¿Cómo opera el ruteo territorial Round-Robin en la asignación de leads entrantes?",
        opciones: [
          "Distribuye rotativamente los leads sin asignación entre los comerciales del país, priorizando a los ejecutivos que cuentan con el badge 🎓 Certificado",
          "Asigna todos los leads al comercial de mayor antigüedad en la empresa",
          "Asigna los leads al azar sin considerar el país ni la certificación del ejecutivo",
          "Deriva los leads al equipo de CX para su primera llamada"
        ],
        correcta: 0
      },
      {
        id: "q2",
        pregunta: "¿Qué ocurre cuando la totalidad (100%) de los hitos del checklist de Onboarding son completados?",
        opciones: [
          "El sistema promueve reactivamente el estado del cliente de 'Onboarding' a 'Activo'",
          "Se requiere aprobación manual por escrito del SuperAdmin",
          "Se archiva la ficha del cliente y se deshabilita su edición",
          "Se elimina el contrato logístico previamente cargado"
        ],
        correcta: 0
      },
      {
        id: "q3",
        pregunta: "Al marcar un hito de onboarding que tiene activado el flag de 'Evidencia Obligatoria', ¿qué exige la plataforma?",
        opciones: [
          "Adjuntar obligatoriamente una URL (Jira, Google Drive) o documento de respaldo antes de guardar el hito",
          "Escribir un correo electrónico al cliente solicitando confirmación",
          "Rendir nuevamente el examen de capacitación del módulo",
          "Cambiar la contraseña de acceso al CRM"
        ],
        correcta: 0
      },
      {
        id: "q4",
        pregunta: "¿Cómo se resuelve formalmente una Alerta de Riesgo comercial generada por Luxia IA?",
        opciones: [
          "Redactando una nota de auditoría comercial obligatoria detallando las acciones de retención realizadas",
          "Haciendo clic en el botón de eliminar alerta sin justificación",
          "Asignando el cliente a un rol Lector de forma temporal",
          "Desactivando el selector regional en la barra superior"
        ],
        correcta: 0
      },
      {
        id: "q5",
        pregunta: "Tras resolver una Alerta de Riesgo, ¿qué mecanismo de protección de Luxia se activa?",
        opciones: [
          "Entra en un periodo de enfriamiento (cooldown) de 24 horas para evitar resoluciones repetidas accidentales",
          "La alerta se vuelve a activar inmediatamente cada 5 minutos",
          "El sistema bloquea al comercial por el resto de la jornada laboral",
          "Se borran los registros de la bitácora de los últimos 30 días"
        ],
        correcta: 0
      },
      {
        id: "q6",
        pregunta: "¿Qué funciones ejecuta el dictado por voz (Web Speech API) en el Copiloto de Terreno del AM?",
        opciones: [
          "Permite dictar notas de bitácora, ejecutar acciones (Action Mode) y consultar resúmenes por voz (Query Mode)",
          "Traducción automática de llamadas telefónicas en tiempo real a 10 idiomas",
          "Generación automática de facturas electrónicas de despacho",
          "Control de velocidad del vehículo del representante comercial"
        ],
        correcta: 0
      },
      {
        id: "q7",
        pregunta: "En la solapa 'Negocios y Contratos', ¿qué utilidad tienen las alertas preventivas de vencimiento?",
        opciones: [
          "Disparan tareas y correos preventivos a los 30, 60 y 90 días previos al vencimiento del contrato comercial",
          "Cancelan el servicio logístico 30 días antes del vencimiento",
          "Aumentan automáticamente la tarifa mensual un 10%",
          "Ocultan el contrato de la vista de los supervisores"
        ],
        correcta: 0
      },
      {
        id: "q8",
        pregunta: "¿Qué diferencia existe entre el Kanban de Adquisición (Hunting) y Retención (Farming)?",
        opciones: [
          "Adquisición gestiona cuentas e hitos de conversión nuevos; Retención administra expansiones, servicios adicionales y renovaciones de cuentas activas",
          "Adquisición es para supervisores y Retención es exclusivo de administradores",
          "Adquisición opera en dólares y Retención en moneda local sin conversión",
          "No existe diferencia, son duplicados con nombres distintos"
        ],
        correcta: 0
      },
      {
        id: "q9",
        pregunta: "Si un cliente se encuentra en la vista restringida de un Agente de Adquisición/Retención, ¿qué registros puede visualizar?",
        opciones: [
          "Únicamente los leads, oportunidades y cuentas asignadas a su propia autoría o registros sin asignar del país",
          "Todos los clientes y datos financieros de la empresa a nivel global",
          "Los datos de los clientes de otros Account Managers de la competencia",
          "Únicamente las métricas de consumo de la IA Luxia"
        ],
        correcta: 0
      },
      {
        id: "q10",
        pregunta: "¿Cómo se acredita el badge 🎓 Certificado en la ficha y perfil de un Account Manager?",
        opciones: [
          "Aprobando el examen teórico y práctico del módulo de Auto-Capacitación para su rol",
          "Solicitándolo por correo electrónico al área de Soporte IT",
          "Registrando más de 100 leads manualmente en una semana",
          "Completando 10 videollamadas de Google Meet sin interrupciones"
        ],
        correcta: 0
      }
    ],
    practico: {
      id: "p1",
      pregunta: "Una cuenta corporativa clave en Colombia registra un contrato por vencer en 45 días y su Health Score ha descendido a 'Yellow'. Describe tu estrategia omnicanal (WhatsApp, reunión de Meet temporizada, notas de bitácora y renovación contractual) para asegurar la retención de la cuenta.",
      criteriosEvaluacion: [
        "Uso de plantillas Meta o chat de WhatsApp registrando notas internas (Susurros)",
        "Coordinación de videollamada en Meet aceptando el aviso de consentimiento y control de tiempo",
        "Resolución justificada de alertas preventivas con nota de auditoría",
        "Actualización de vigencia o carga de nueva versión del contrato en la solapa Negocios y Contratos"
      ]
    }
  },

  // 4. SUPERVISOR COMERCIAL - AVANZADO
  supervisor_basico: {
    rol: "supervisor",
    dificultad: "basico",
    teorico: [
      {
        id: "q1",
        pregunta: "¿Cuál es el alcance de visibilidad de un Supervisor Comercial en el CRM-Luxia?",
        opciones: [
          "Visualiza y audita los leads, oportunidades y cuentas de los comerciales de su misma división (Adquisición o Retención) y país",
          "Acceso ilimitado a la consola de seguridad y matriz de permisos de todos los roles",
          "Visibilidad restringida únicamente a sus propios tratos personales",
          "Acceso a la configuración del presupuesto mensual de IA en dólares"
        ],
        correcta: 0
      },
      {
        id: "q2",
        pregunta: "¿Cómo realiza un Supervisor la reasignación masiva de prospectos o cuentas entre ejecutivos?",
        opciones: [
          "Seleccionando múltiples registros en la tabla de supervisión y ejecutando la opción 'Reasignar Ejecutivo (AM)'",
          "Modificando manualmente cada documento en la consola de Firebase",
          "Enviando un correo de solicitud a la cola SMTP",
          "Los supervisores no tienen permitido reasignar cuentas"
        ],
        correcta: 0
      },
      {
        id: "q3",
        pregunta: "En la exportación de reportes comerciales, ¿qué mecanismo de seguridad se activa si se supera el límite horario de descargas?",
        opciones: [
          "El sistema aplica Rate Limiting, genera una descarga parcial y emite una alerta silenciosa de auditoría",
          "Se elimina la cuenta del supervisor en Firestore",
          "Se borran las oportunidades del Kanban de ventas",
          "Se suspende el servicio regional por 24 horas"
        ],
        correcta: 0
      },
      {
        id: "q4",
        pregunta: "¿Qué información expone el módulo de auditoría de bitácoras para los supervisores?",
        opciones: [
          "La trazabilidad inmutable de notas, cambios de etapa, cargas de contratos e interacciones de la cartera",
          "La clave de acceso personal de cada comercial",
          "Los registros de navegación personal del navegador del usuario",
          "Las estadísticas de consumo de ancho de banda de la oficina"
        ],
        correcta: 0
      },
      {
        id: "q5",
        pregunta: "¿Cómo influye el desempeño de los comerciales certificados en el Leaderboard regional?",
        opciones: [
          "Acumulan puntos XP por interacciones y aprobaciones, posicionando al equipo en la tabla de gamificación",
          "Reduce las cuotas de ventas exigidas por la empresa",
          "Elimina la obligación de adjuntar evidencias en el onboarding",
          "Concede descuentos automáticos en las tarifas de los clientes"
        ],
        correcta: 0
      }
    ],
    practico: {
      id: "p1",
      pregunta: "Un Account Manager del equipo de Adquisición se ausenta por licencia médica. Describe el procedimiento de reasignación masiva de su cartera de leads y tratos en proceso hacia otros comerciales del equipo, asegurando la trazabilidad en la bitácora.",
      criteriosEvaluacion: [
        "Selección de leads y oportunidades en la consola de supervisión",
        "Ejecución de la reasignación masiva al nuevo AM certificado",
        "Verificación del registro de auditoría en la bitácora de los clientes"
      ]
    }
  },

  // 5. ADMINISTRADOR - BÁSICO Y AVANZADO
  admin_basico: {
    rol: "admin",
    dificultad: "basico",
    teorico: [
      {
        id: "q1",
        pregunta: "¿En qué sección de la Consola Administrativa se crean y estructuran campos personalizados para las fichas del CRM?",
        opciones: [
          "En la Consola de Campos Dinámicos (`FieldsConfigPanel`)",
          "En el configurador de Metrics Studio",
          "En el panel de observabilidad IT",
          "En la consola de invitaciones por correo"
        ],
        correcta: 0
      },
      {
        id: "q2",
        pregunta: "¿Qué regla de gobernanza aplica el CRM para la pertenencia a equipos de los usuarios con rol Admin o SuperAdmin?",
        opciones: [
          "Los usuarios con rol Admin o SuperAdmin pertenecen obligatoria y exclusivamente al equipo Global",
          "Los Admins pueden pertenecer al equipo de Adquisición o Retención libremente",
          "Los SuperAdmins no tienen asignado ningún equipo en Firestore",
          "El equipo se asigna según el país de residencia del administrador"
        ],
        correcta: 0
      },
      {
        id: "q3",
        pregunta: "¿Quiénes tienen privilegios para modificar la Matriz de Permisos RBAC en la consola de seguridad?",
        opciones: [
          "Exclusivamente los usuarios con rol SuperAdmin",
          "Todos los usuarios con rol Admin y SuperAdmin",
          "Los supervisores comerciales certificados",
          "Cualquier operador con cuenta corporativa @luxia.com"
        ],
        correcta: 0
      },
      {
        id: "q4",
        pregunta: "¿Cómo se audita el estado del despacho de correos de invitación enviados a nuevos operadores?",
        opciones: [
          "En la tabla de 'Cola de Correos' (`cola_correos`), verificando si el estado es Enviado, Pendiente o Error con su log",
          "Revisando la carpeta de spam de la casilla del administrador",
          "Consultando las alertas de salud de la base de datos",
          "Las invitaciones se envían de forma instantánea sin registro de cola"
        ],
        correcta: 0
      },
      {
        id: "q5",
        pregunta: "¿Cómo genera un Administrador un widget de KPI dinámico en el Dashboard mediante Metrics Studio?",
        opciones: [
          "Ingresando un requerimiento en lenguaje natural al Data Architect IA y seleccionando la pestaña de destino",
          "Escribiendo código fuente directamente en los archivos de la carpeta /src",
          "Creando un archivo de hoja de cálculo en Google Sheets",
          "Ejecutando un comando en el terminal de comandos del servidor"
        ],
        correcta: 0
      },
      {
        id: "q6",
        pregunta: "¿Cómo se refleja la creación de un nuevo campo dinámico en los formularios del frontend?",
        opciones: [
          "Se refleja de forma reactiva e inmediata gracias a la suscripción en tiempo real (`onSnapshot`) de Firestore",
          "Requiere que el equipo de desarrollo compile un nuevo paquete de producción",
          "Se actualiza en un proceso nocturno a las 00:00 horas",
          "Requiere reiniciar los servidores de Firebase Hosting"
        ],
        correcta: 0
      },
      {
        id: "q7",
        pregunta: "¿Qué ocurre al deshabilitar el interruptor 'participaGamificacion' en la configuración de un equipo?",
        opciones: [
          "Los integrantes de dicho equipo no acumularán puntos XP ni figurarán en el Leaderboard público de la plataforma",
          "Se elimina el acceso de los usuarios del equipo al CRM",
          "Se borran los contratos logísticos asociados a ese equipo",
          "Se suspenden los envíos de plantillas de WhatsApp"
        ],
        correcta: 0
      },
      {
        id: "q8",
        pregunta: "¿Qué entidades soportan la adición de secciones y campos dinámicos personalizables?",
        opciones: [
          "Cliente, Contrato, Contacto, Actividad, Lead, Oportunidad y Ticket",
          "Únicamente la entidad Cliente",
          "Únicamente los usuarios y roles",
          "Únicamente las alertas del sistema"
        ],
        correcta: 0
      },
      {
        id: "q9",
        pregunta: "Al configurar una plantilla de invitación por correo, ¿qué variables dinámicas se pueden interpolar?",
        opciones: [
          "{{email}}, {{rol}}, {{equipo}} y {{invitedBy}}",
          "{{password}}, {{credit_card}} y {{token}}",
          "{{today}}, {{weather}} y {{country}}",
          "No admite uso de variables dinámicas"
        ],
        correcta: 0
      },
      {
        id: "q10",
        pregunta: "¿Dónde se administra la lista de razones o motivos por los cuales se marca una oportunidad como Perdida?",
        opciones: [
          "En la pestaña 'Pipeline & Funnel' del panel de Configuración Comercial (`PipelineConfigPanel`)",
          "En el configurador del canal de Slack",
          "En el Help Center público de CX",
          "En la vista de perfil de usuario"
        ],
        correcta: 0
      }
    ],
    practico: {
      id: "p1",
      pregunta: "Como Administrador, se te solicita dar de alta una nueva sección de campos dinámicos llamada 'Datos de Facturación Electrónica' para la entidad Cliente (incluyendo RUT/RFC, Régimen Fiscal y Correo de Facturación obligatorio), e invitar a un nuevo Account Manager fijando su equipo inicial. Describe los pasos detallados.",
      criteriosEvaluacion: [
        "Crear la sección y definir la entidad 'cliente' en FieldsConfigPanel",
        "Agregar los campos especificando claves únicas, tipos (text/email) y el flag obligatorio",
        "Invitar al nuevo operador ingresando su correo corporativo @luxia.com y seleccionando su rol y equipo",
        "Auditar la cola de correos (cola_correos) para confirmar la salida de la invitación"
      ]
    }
  },

  admin_avanzado: {
    rol: "admin",
    dificultad: "avanzado",
    teorico: [
      {
        id: "q1",
        pregunta: "¿Cómo se configuran los requerimientos de Gatekeeping para una etapa específica del Pipeline comercial?",
        opciones: [
          "Seleccionando el Pipeline y Servicio en PipelineConfigPanel y marcando los campos dinámicos/nativos obligatorios",
          "Escribiendo expresiones regulares en el archivo de reglas de seguridad de Firestore",
          "Modificando la base de datos local del navegador",
          "El Gatekeeping es fijo y no se puede personalizar por etapa"
        ],
        correcta: 0
      },
      {
        id: "q2",
        pregunta: "¿Qué función cumple el diseñador de Formularios Web Inbound en la consola de datos?",
        opciones: [
          "Permite arrastrar campos para generar enlaces públicos e `<iframe>` HTML que registran prospectos directamente en el CRM",
          "Diseña el maquetado de las firmas digitales de los correos corporativos",
          "Genera encuestas de satisfacción CSAT para clientes de soporte",
          "Permite cambiar el logo de la barra superior de la aplicación"
        ],
        correcta: 0
      },
      {
        id: "q3",
        pregunta: "Al modificar la plantilla de hitos de Onboarding corporativo, ¿cómo reaccionan los clientes que actualmente están en fase de Onboarding?",
        opciones: [
          "La UI recalcula reactivamente el porcentaje global e incorpora/remueve dinámicamente los pasos ajustados",
          "Se resetean a 0% todos los avances de onboarding de la empresa",
          "Se cancelan los contratos logísticos vigentes",
          "Se bloquea la edición de las fichas de los clientes afectados"
        ],
        correcta: 0
      },
      {
        id: "q4",
        pregunta: "¿Cómo se valida la seguridad y vigencia de las plantillas de correo SMTP en la cola de salida?",
        opciones: [
          "Monitoreando la subcolección `cola_correos` donde se auditan los estados `pending`, `sent` o `error` con sus metadatos",
          "Revisando las descargas en el cliente local de correo",
          "Consultando las cuotas de almacenamiento de Firebase Storage",
          "Ejecutando un examen de certificación en modo prueba"
        ],
        correcta: 0
      },
      {
        id: "q5",
        pregunta: "¿Qué parámetro de configuración determina si las alertas preventivas de contratos se envían a 30, 60 o 90 días?",
        opciones: [
          "El campo `alertaDiasAnticipacion` parametrizado en cada contrato dentro de la solapa Negocios y Contratos",
          "Una constante fija hardcodeada en el archivo index.js del backend",
          "La tasa de cambio del dólar del país donde se ubica el cliente",
          "El nivel de experiencia XP del comercial en la plataforma"
        ],
        correcta: 0
      }
    ],
    practico: {
      id: "p1",
      pregunta: "Diseña la configuración completa para el lanzamiento de un nuevo servicio logístico 'Fondo de Churn / Retención SaaS' en Chile: configura el Gatekeeping del Pipeline de Retención, define 2 campos dinámicos obligatorios y genera un formulario web de captación inbound para integrar en la web oficial.",
      criteriosEvaluacion: [
        "Definición de campos obligatorios de Gatekeeping en PipelineConfigPanel",
        "Creación de campos dinámicos asociados al tipo de servicio logístico",
        "Generación y previsualización del formulario Web-to-Lead/Web-to-Ticket en WebFormsManager"
      ]
    }
  },

  // 8. SUPERADMIN - BÁSICO Y AVANZADO
  superadmin_basico: {
    rol: "superadmin",
    dificultad: "basico",
    teorico: [
      {
        id: "q1",
        pregunta: "¿Cuáles son los 7 roles RBAC soportados en la arquitectura de seguridad del CRM-Luxia?",
        opciones: [
          "lector, agente, agente_cx, supervisor, supervisor_cx, admin y superadmin",
          "lector, editor, comercial, soporte, admin, superadmin y root",
          "basico, intermedio, avanzado, lider, gerente, director y vicedirector",
          "guest, user, operator, manager, admin, superadmin y system"
        ],
        correcta: 0
      },
      {
        id: "q2",
        pregunta: "¿Dónde monitorea un Superadmin el consumo acumulado en dólares (USD) de las APIs de Gemini y WhatsApp?",
        opciones: [
          "En el panel de Consumo de IA (FinOps) (`IaConsumptionPanel`), alimentado por la subcolección `logs_ia_consumo`",
          "En la sección de Preferencias de Interfaz de Mi Perfil",
          "En la carpeta de archivos temporales de Vite",
          "En la consola de administración de Google Calendar"
        ],
        correcta: 0
      },
      {
        id: "q3",
        pregunta: "¿Qué sucede al activar el switch 'Circuit Breaker (Auto-shutoff)' en el panel de FinOps?",
        opciones: [
          "Se suspenden automáticamente todas las llamadas a las APIs de IA al alcanzar el 100% del presupuesto en USD configurado",
          "Se apaga el servidor web del CRM de forma permanente",
          "Se eliminan los registros de auditoría de los usuarios",
          "Se fuerzan todas las contraseñas a expiración inmediata"
        ],
        correcta: 0
      },
      {
        id: "q4",
        pregunta: "¿Qué privilegios exclusivos posee el rol Superadmin sobre la Matriz de Permisos RBAC?",
        opciones: [
          "Puede modificar atómicamente las casillas de verificación de permisos por cada rol de la plataforma",
          "Puede exportar el código fuente completo a un servidor externo",
          "Puede cambiar los precios de los servicios logísticos en tiempo real",
          "No posee privilegios especiales sobre la matriz respecto a los admins"
        ],
        correcta: 0
      },
      {
        id: "q5",
        pregunta: "¿Cómo se auditan las consultas de base de datos de la sesión del navegador mediante la herramienta dbTracker?",
        opciones: [
          "En el Monitor de Telemetría del Centro de Observabilidad IT, contabilizando lecturas, escrituras y borrados de Firestore",
          "Revisando las descargas de archivos CSV del usuario",
          "Consultando el historial de invitaciones por correo",
          "El dbTracker solo funciona en servidores locales de prueba"
        ],
        correcta: 0
      },
      {
        id: "q6",
        pregunta: "¿Qué información almacena cada documento de la subcolección `logs_ia_consumo`?",
        opciones: [
          "Timestamp, email del usuario, agente de IA, modelo, tokens de entrada/salida y costo estimado en USD",
          "Nombre de usuario y contraseña cifrada del comercial",
          "La lista de correos enviados al cliente por el sistema de soporte",
          "El historial de ubicación GPS del teléfono móvil del comercial"
        ],
        correcta: 0
      },
      {
        id: "q7",
        pregunta: "¿Cómo se ajustan las políticas de desconexión por inactividad de sesión de los usuarios?",
        opciones: [
          "En la Consola de Seguridad, parametrizando el tiempo límite de inactividad (1 a 120 minutos) monitoreado por `AgentPresenceMonitor`",
          "En el archivo de configuración del servidor web Apache/Nginx",
          "Editando las reglas de CSS del componente de login",
          "La desconexión por inactividad no se puede personalizar"
        ],
        correcta: 0
      },
      {
        id: "q8",
        pregunta: "En la gestión de roles, si intentas asignar a un Superadmin un equipo diferente a 'Global', ¿qué responde el CRM?",
        opciones: [
          "Bloquea la acción y fuerza reactivamente `equipo: 'Global'`, cumpliendo la invariante formal de gobernanza",
          "Permite la asignación a cualquier equipo de trabajo",
          "Elimina el documento del usuario de Firestore",
          "Cambia el rol del usuario a Lector de forma automática"
        ],
        correcta: 0
      },
      {
        id: "q9",
        pregunta: "¿Cómo se realiza la publicación de un Comunicado o Banner Global en la parte superior del CRM?",
        opciones: [
          "En la pestaña 'Banners de Sistema' del Centro de Observabilidad IT, redactando el mensaje y seleccionando el tipo de alerta",
          "Enviando un correo masivo a todos los usuarios registrados",
          "Modificando el archivo index.html del proyecto",
          "El sistema no soporta banners de comunicación global"
        ],
        correcta: 0
      },
      {
        id: "q10",
        pregunta: "¿Qué información expone el monitor de Uptime y Estado de Servicios de 30 días en Observabilidad IT?",
        opciones: [
          "El estado de conexión y disponibilidad de las APIs de Meta, Google Cloud Platform, Firebase y servicios internos",
          "La lista de productos más vendidos en el e-commerce de los clientes",
          "El estado de la batería de las computadoras de los operadores",
          "La antigüedad de los contratos logísticos de la empresa"
        ],
        correcta: 0
      }
    ],
    practico: {
      id: "p1",
      pregunta: "Como Superadmin, detectas un costo inusual en el consumo de IA durante el fin de semana. Describe cómo auditarías el consumo en `IaConsumptionPanel`, cómo ajustarías las cuotas por rol y cómo activarías el Circuit Breaker de emergencia.",
      criteriosEvaluacion: [
        "Inspeccionar los registros detallados de `logs_ia_consumo` identificando el agente u operador responsable",
        "Ajustar el presupuesto mensual (`limitUsd`) y definir límites de llamadas por hora por rol",
        "Activar el switch de Circuit Breaker (`autoshutoffActive`) para prevenir sobrecostos"
      ]
    }
  },

  superadmin_avanzado: {
    rol: "superadmin",
    dificultad: "avanzado",
    teorico: [
      {
        id: "q1",
        pregunta: "¿Cómo se gestionan la calibración y el versionado de los System Prompts Máster de los agentes Luxia IA?",
        opciones: [
          "En `LuxiaIaConfigPanel`, editando el prompt máster y permitiendo la reversión de versiones desde la subcolección `versions`",
          "Desplegando una nueva versión de código mediante Git y Cloud Functions",
          "Modificando las constantes en el archivo local constants.js",
          "Enviando una solicitud de cambio a la API de Google Gemini"
        ],
        correcta: 0
      },
      {
        id: "q2",
        pregunta: "¿Cómo opera la resiliencia de UI en el frontend ante respuestas malformadas o incompletas de las APIs de IA?",
        opciones: [
          "Mediante Optional Chaining (`?.`), valores de contingencia por defecto y renderizado defensivo que evita caídas del sitio",
          "Recargando la pestaña del navegador automáticamente cada vez que ocurre un error",
          "Mostrando una pantalla azul de error crítico del sistema",
          "Desconectando la sesión del usuario inmediatamente"
        ],
        correcta: 0
      },
      {
        id: "q3",
        pregunta: "En la arquitectura de Firestore, ¿cómo se protegen los campos calculados por IA (`scoreCalculado`, `healthScore`) contra alteración maliciosa en el cliente?",
        opciones: [
          "Se bloquea su modificación directa en `firestore.rules` para clientes y se exige la escritura vía Admin SDK en Cloud Functions",
          "Se cifran los campos con clave AES-256 en la base de datos",
          "Se verifica la IP de origen del navegador antes de permitir la edición",
          "Los datos calculados por IA no requieren protección especial"
        ],
        correcta: 0
      },
      {
        id: "q4",
        pregunta: "¿Qué validación exige el backend de evaluación de exámenes de capacitación respecto a los pesos de las calificaciones?",
        opciones: [
          "Valida que la suma de `pesoTeorico` y `pesoPractico` en la configuración general sea estrictamente igual a 100%",
          "Exige que el peso práctico sea siempre superior al 70%",
          "Requiere que ambos pesos sean números decimales entre 0 y 1",
          "El backend no realiza validaciones de pesos"
        ],
        correcta: 0
      },
      {
        id: "q5",
        pregunta: "¿Cómo evita Metrics Studio la saturación de lecturas en Firestore al calcular gráficos agregados complejos?",
        opciones: [
          "Consolida los resultados precalculados en la colección `kpi_results`, permitiendo a los dashboards leer un único documento resuelto",
          "Descarga toda la base de datos NoSQL al navegador del usuario",
          "Ejecuta consultas en segundo plano utilizando un servidor SQL externo",
          "Genera imágenes estáticas de los gráficos una vez al mes"
        ],
        correcta: 0
      }
    ],
    practico: {
      id: "p1",
      pregunta: "Un cambio reciente en el System Prompt de Luxia Lead Scorer está provocando que el 90% de los leads sean clasificados como 'Red' (falsos negativos). Explica el procedimiento técnico de auditoría, cómo consultar la subcolección `versions` para hacer un rollback de la versión previa del prompt y cómo probar la calibración en caliente.",
      criteriosEvaluacion: [
        "Ingresar a LuxiaIaConfigPanel y acceder al Historial de Versiones del agente afectado",
        "Seleccionar la versión anterior estable y ejecutar la reversión (rollback)",
        "Probar la calibración evaluando un lead de prueba y verificando el log en IaConsumptionPanel"
      ]
    }
  }
};

async function seedExams() {
  console.log("=== INICIANDO ACTUALIZACIÓN Y SANAMIENTO DE BANCOS DE EXÁMENES ===");

  // 1. Eliminar documentos obsoletos o legados (ej: usuario_basico, usuario_avanzado)
  const legacyDocs = ['usuario_basico', 'usuario_avanzado'];
  for (const docId of legacyDocs) {
    const docRef = db.collection('config_capacitacion_examenes').doc(docId);
    const snap = await docRef.get();
    if (snap.exists) {
      console.log(` -> Eliminando documento legado/obsoleto: [${docId}]...`);
      await docRef.delete();
    }
  }

  // 2. Insertar / Actualizar los 14 exámenes maestros por rol y dificultad
  const entries = Object.entries(examsCatalog);
  console.log(`\nSembrando ${entries.length} evaluaciones oficiales en /config_capacitacion_examenes...`);

  for (const [docId, examData] of entries) {
    const docRef = db.collection('config_capacitacion_examenes').doc(docId);
    const payload = {
      ...examData,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system-migration-script'
    };
    await docRef.set(payload, { merge: true });
    console.log(` [OK] Examen guardado: [${docId}] | Rol: ${examData.rol} | Dificultad: ${examData.dificultad} | Preguntas Teóricas: ${examData.teorico.length}`);
  }

  console.log("\n¡Actualización y sembrado de exámenes completado con éxito!");
  process.exit(0);
}

seedExams().catch(err => {
  console.error("Error durante el sembrado de exámenes:", err);
  process.exit(1);
});
