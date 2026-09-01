# Manual de Operaciones y Gobernanza CRM
### Luxia · Guía Operativa por Roles & Casos de Uso Regionales

Este manual detalla las capacidades, flujos operativos y configuraciones del CRM-Luxia según los niveles de acceso y roles de seguridad (**Lector**, **Agente**, **Agente_CX**, **Supervisor**, **Supervisor_CX**, **Admin**, **SuperAdmin** y **Editor**).

---

## 01. Navegación, Interfaz & Selector Regional [roles: lector, agente, agente_cx, supervisor, supervisor_cx, admin, superadmin, editor]
El CRM-Luxia es una plataforma regional multipaís diseñada para centralizar la gestión de cuentas y operaciones en Argentina, Chile, Colombia, Perú y México.

### Funcionalidades Clave y Lógica Interna
*   **Selector Regional en Cabecera:** Permite filtrar los tableros de KPIs, listas de clientes, embudos de venta (Pipeline Kanban) y alertas de forma instantánea.
*   **Consolidación Multimoneda Dual:**
    *   *Vista "Toda la Región":* Consolida todos los importes financieros del sistema (monto estimado de tratos, tarifas, facturación de contratos) en dólares estadounidenses (**USD**).
    *   *Vista de País Individual:* Muestra las cifras financieras en la **Moneda Local** correspondiente (ARS, CLP, COP, PEN, MXN) y, de manera complementaria, el valor equivalente en **USD**.
*   **Tasas de Cambio Congeladas (Frozen Exchange Rates):** El sistema congela la tasa de cambio vigente en el instante de creación o edición de cada oportunidad o contrato. Esto evita la alteración retroactiva de datos históricos por fluctuaciones cambiarias.
*   **Buscadores de Tablas e Iniciales (Search Tokens):** Filtros rápidos de búsqueda integrados en cada vista de listados (Clientes, Leads, Oportunidades) que permiten encontrar registros rápidamente ingresando sus iniciales o palabras clave indexadas (ej. "W PE" para encontrar "Walmart Perú").
*   **Copiloto Conversacional de Cuenta (Sentinel IA):** Chat de IA interactivo accesible de forma local dentro de la ficha de detalle de cada cliente, lead u oportunidad, especializado en analizar bitácoras, correos, contratos y notas específicas de esa entidad.
*   **Widgets Flotantes Personalizables:** Los botones de "Ayuda y Documentación" e "IA de Soporte" son flotantes e interactivos. El usuario puede arrastrarlos por la pantalla, minimizarlos o cerrarlos. Se pueden restaurar desde la sección "Mi Perfil > Preferencias de Interfaz".

### Guías Paso a Paso

#### Cómo cambiar de región o moneda de visualización:
1. Dirígete a la barra superior del CRM.
2. Haz clic en el selector desplegable de **Filtrar por Región** (esquina superior derecha).
3. Selecciona un país específico para visualizar importes en su moneda local y USD, o selecciona **Toda la Región** para consolidación total en USD.

#### Cómo realizar búsquedas rápidas con Search Tokens:
1. Dirígete al listado de la sección deseada (ej. Gestión de Clientes).
2. Escribe el nombre o iniciales de la empresa (ej. "W PE") en el campo de texto de búsqueda de la tabla.
3. El listado se filtrará instantáneamente en tiempo real según los tokens indexados.

#### Cómo arrastrar o restaurar los botones flotantes de ayuda:
1. Haz clic o mantén presionado sobre los botones flotantes "Ayuda" o "Soporte IA" y arrástralos a la posición deseada en la pantalla.
2. Si cerraste un botón flotante con la `X`, dirígete a **Mi Perfil > Preferencias de Interfaz** y haz clic en **Restaurar Botones Flotantes**.

---

## 02. Tablero de Actividades & Dashboard de KPIs [roles: lector, agente, agente_cx, supervisor, supervisor_cx, admin, superadmin, editor]
El Tablero CRM es la pantalla principal de control del día a día, ofreciendo una vista operativa de tareas y un panel analítico.

### Funcionalidades Clave y Lógica Interna
*   **Modo Tablero de Tareas (Kanban):**
    *   *Flujo de Actividades:* Organiza las tareas en 5 columnas de estado: `📦 Backlog`, `📋 Por Hacer`, `⚙️ En Proceso`, `👀 En Revisión` y `✅ Completado`.
    *   *Drag & Drop:* Permite arrastrar tarjetas entre columnas para actualizar su estado. Los lectores (`lector`) no tienen permitido realizar movimientos.
    *   *Aislamiento Restringido:* Los agentes de Adquisición/Retención solo visualizan tareas propias o sin asignar. Los supervisores pueden ver además las tareas asignadas a los Account Managers de su equipo.
    *   *Alertas de Vencimiento:* El tablero está sincronizado con las alertas del sistema, mostrando un indicador visual resaltado en las tareas que están por vencer en las próximas 24 horas (`crm_actividad_por_vencer`).
*   **Modo Dashboard (KPIs & Métricas del Tablero):**
    *   *Métricas del Tablero:* Despliega contadores clave en tiempo real con el conteo de actividades activas, tareas pendientes en checklists, cantidad de alertas críticas del tablero y la tasa de eficiencia global (porcentaje de completado).
    *   *Distribución por Estado:* Muestra de forma interactiva la cantidad y porcentaje de actividades posicionadas en cada columna del flujo de trabajo.
    *   *Carga de Trabajo:* Desglosa en una matriz el total de actividades y tareas pendientes asignadas a cada miembro del equipo para balancear la carga de trabajo.
    *   *Vencimientos Críticos:* Muestra una lista priorizada de las actividades y tareas que vencen en los próximos 7 días para agilizar el seguimiento.

### Guías Paso a Paso

#### Cómo gestionar tareas en el Tablero Kanban:
> ⚠️ **Nota para el Rol Lector**: Los usuarios con rol Lector (`lector`) tienen permisos de solo lectura. No pueden crear nuevas actividades (el botón **+** estará deshabilitado), editar sus campos ni mover tarjetas entre columnas mediante arrastre. Su visualización tiene fines exclusivos de auditoría.

1. Dirígete a la pestaña **Tablero** del menú principal.
2. Para mover una tarea (exclusivo ejecutivos/admins), haz clic sobre su tarjeta y arrástrala a la columna de estado correspondiente (ej: de *Por Hacer* a *En Proceso*).
3. Para registrar una nueva tarea (exclusivo ejecutivos/admins), haz clic en el botón **+** de la parte superior de la columna destino. Completa los campos del modal (nombre, vencimiento, cliente, prioridad y descripción) y haz clic en **Guardar**.
4. Haz clic sobre cualquier tarjeta existente para ver su detalle, notas e historial, o para reasignar el responsable o la prioridad.

#### Cómo auditar el Dashboard de KPIs:
1. Cambia el switch superior de la vista de **Tablero** a **Dashboard**.
2. Utiliza el filtro regional global del CRM en la barra superior para segmentar la distribución de actividades por un país o consolidar toda la región.
3. Analiza la matriz de carga de trabajo por responsable y el listado de vencimientos críticos para programar revisiones prioritarias.

---

## 03. Captación & Prospección de Leads [roles: agente, supervisor, admin, superadmin]
Módulo de admisión y calificación inicial de potenciales clientes corporativos.

### Funcionalidades Clave y Lógica Interna
*   **Canales de Ingreso de Leads:**
    *   *Manual:* Mediante el botón "+ Registrar Lead".
    *   *Automatizado (API Inbound):* Ingestión de registros vía POST en la API `/v1/leads`.
    *   *Páginas de Aterrizaje (Web-to-Lead):* Formularios públicos embebibles que insertan datos directamente en el CRM.
*   **Ruteo Territorial Round-Robin:** Al registrarse un lead sin un Account Manager (AM) asignado, el backend ejecuta un algoritmo de distribución rotativa entre los comerciales del país del lead.
    *   *Priorización por Certificación:* El algoritmo Round-Robin asigna el lead con prioridad a los comerciales que tengan el badge de capacitación activa (`🎓 Certificado`).
*   **Sentinel Lead Scorer (Calificación IA):** Sentinel procesa los datos del lead contra el perfil de cliente ideal (ICP) del país seleccionado y retorna:
    *   *Score Numérico:* Calificación entre 0 y 100 puntos.
    *   *Prioridad Cromática:* Green (viabilidad excelente), Yellow (viabilidad moderada), Red (descalificado).
    *   *Análisis IA:* Explicación concisa del encaje comercial y 2 o 3 recomendaciones de próximos pasos para el ejecutivo.
*   **Carga Masiva de Prospectos:** Permite la importación de bases de datos mediante archivos CSV.
    *   *Sanitización UTF-8 BOM:* Evita la deformación de caracteres especiales (tildes, eñes) por incompatibilidad de formatos al importar.
    *   *Pre-validación:* Evalúa cada línea del archivo antes de insertar. Si detecta datos requeridos vacíos o correos inválidos, frena la carga y emite un informe con las filas y celdas a corregir.

### Guías Paso a Paso

#### Cómo registrar un Lead manualmente:
1. Dirígete a la sección **Prospección (Leads)** en el menú principal.
2. Haz clic en **+ Registrar Lead** en la esquina superior derecha.
3. Rellena los datos básicos: Nombre de la Empresa, Nombre del Contacto, Correo, Teléfono, Perfil de LinkedIn (URL), País y Servicio Logístico de interés.
4. Si requieres asignación inmediata, selecciona un ejecutivo del listado. De lo contrario, déjalo vacío para que el motor ejecute el Round-Robin.
5. Haz clic en **Guardar Lead**.

#### Cómo evaluar un prospecto con Sentinel Scorer:
1. Selecciona la tarjeta del lead deseado de la grilla de prospección.
2. Haz clic en el botón de **✨ Calificar Lead con IA**.
3. Revisa la prioridad (Green/Yellow/Red), el desglose del puntaje y los próximos pasos en la sección de análisis que aparecerá en la ficha.

#### Cómo realizar una carga masiva desde CSV:
1. Haz clic en **Carga Masiva** en el panel de Leads.
2. Presiona **Descargar Plantilla CSV**. Es obligatorio usar esta estructura para asegurar la coincidencia con los campos nativos y dinámicos configurados.
3. Rellena las filas del CSV. Asegúrate de guardar el archivo con codificación UTF-8.
4. Sube el archivo arrastrándolo al panel del modal. El validador escaneará el documento.
5. Revisa el reporte de validación: si está en verde, haz clic en **Confirmar Carga Masiva** para procesar y distribuir las cuentas.

---

## 04. Pipeline de Ventas & Oportunidades [roles: agente, supervisor, admin, superadmin, editor]
Embudo visual de oportunidades de negocio estructurado en formato Kanban.

### Funcionalidades Clave y Lógica Interna
*   **Segregación por Divisiones:** División del Kanban en dos flujos independientes:
    *   *Adquisición (Hunting):* Para captación de cuentas nuevas.
    *   *Retención (Farming/Fidelización):* Para renovaciones, ampliaciones de servicio o cuentas ya existentes.
*   **Formularios Dinámicos Adaptativos:** El formulario de creación y edición renderiza campos dinámicos específicos según el Tipo de Servicio seleccionado (ej: campos para crossdocking vs almacenamiento).
*   **Ingreso Obligatorio en Moneda Local:** El campo "Monto Estimado Mensual" exige ingresar el valor en la moneda del país del trato. El backend calcula y registra en caliente su equivalencia en USD usando la tasa de cambio congelada.
*   **Gobernanza de Transición (Gatekeeping):** Para mover una oportunidad de una columna a otra en el Kanban, el sistema evalúa los requerimientos de la etapa destino definidos por los administradores. Si faltan datos obligatorios, el arrastre se cancela y se abre un modal para ingresar la información faltante.
*   **Flujo de Cierre Ganado:** Al marcar un trato como *Ganado*, el sistema solicita datos de cierre comercial y crea de forma automática la ficha del cliente, inicializando su estado en **Onboarding** y activando su checklist de tareas.
*   **Exportación Controlada (Rate Limiting):** Los supervisores y administradores pueden exportar reportes en CSV/Excel. El sistema cuenta con límites máximos de descargas por hora y emite alertas de seguridad silenciosas si se intenta descargar un volumen de registros inusualmente alto.

### Guías Paso a Paso

#### Cómo crear una Oportunidad Comercial:
1. Dirígete a **Pipeline de Ventas** y selecciona la pestaña **Adquisición** o **Retención**.
2. Haz clic en **+ Nueva Oportunidad**.
3. Selecciona el Cliente o Lead asociado, asígnale un nombre descriptivo y elige el Servicio Logístico.
4. Ingresa el **Monto Estimado Mensual en la Moneda Local del País** (ej: CLP para Chile, PEN para Perú).
5. Selecciona la etapa inicial y completa los campos dinámicos obligatorios.
6. Haz clic en **Guardar Oportunidad**.

#### Cómo mover un trato de etapa en el Kanban (Gatekeeping):
1. Arrastra la tarjeta del trato a la columna de la etapa deseada.
2. Si la transición está protegida por Gatekeeping y faltan datos, se abrirá el modal **Campos Obligatorios de Etapa**.
3. Rellena los campos exigidos (ej: tarifa propuesta, fecha estimada de cierre) y presiona **Confirmar Transición**.

#### Cómo cerrar un trato como Ganado:
1. Mueve el trato a la columna **Cerrado Ganado**.
2. Completa los detalles comerciales obligatorios: Fecha de Inicio de Operaciones, Enlace al contrato inicial en Google Drive y Servicio logístico contratado.
3. Presiona **Confirmar Cierre**. El sistema notificará al equipo y creará automáticamente el expediente de Onboarding para el cliente.

---

## 05. Onboarding de Clientes [roles: agente, supervisor, admin, superadmin, editor]
Gestión y seguimiento de los hitos técnicos y legales obligatorios para dar de alta operaciones.

### Funcionalidades Clave y Lógica Interna
*   **Checklist de 6 Hitos Estándar:**
    1. *Firma de Contrato:* Carga del documento regulador.
    2. *Aprovisionamiento de Plataforma:* Configuración de accesos y usuarios del cliente al portal de Luxia.
    3. *Integración API / Webhook:* Conexión y pruebas de transmisión de datos.
    4. *Capacitación Operativa:* Entrenamiento sobre el uso del sistema a despachadores.
    5. *Primera Operación en Producción:* Registro del primer despacho exitoso.
    6. *Revisión de 30 Días:* Auditoría operativa final del primer mes.
*   **Regla de Auto-Activación (100%):** Al marcar la totalidad de los hitos como completados, el sistema cambia reactivamente el estado de la cuenta de *Onboarding* a *Activo*.
*   **Auditoría de Evidencias:** Cada hito marcado requiere que el ejecutivo cargue una evidencia que lo respalde (ej: adjuntar un enlace a Google Drive o Jira, o redactar una nota técnica de validación).
*   **Notificación a Responsables:** Permite asignar responsables del equipo de soporte a hitos específicos. Al asignarlos, se genera y encola una alerta SMTP basada en la plantilla de correo configurada.

### Guías Paso a Paso

#### Cómo auditar y completar un hito de Onboarding:
1. En la ficha de un cliente, dirígete a la pestaña **Onboarding**.
2. Haz clic en la casilla de verificación (Checkbox) del hito que deseas completar.
3. En el modal emergente de **Auditoría de Evidencias**, ingresa el enlace de soporte (Jira o Drive) y una nota breve del trabajo realizado.
4. Selecciona el **Responsable Luxia** asignado del menú desplegable.
5. Haz clic en **Confirmar Hito**. El medidor de avance se actualizará y la cuenta se activará automáticamente al alcanzar el 100%.

---

## 06. Gestión de Negocios y Contratos [roles: agente, supervisor, admin, superadmin, editor]
Expediente unificado de la cuenta del cliente que concentra los datos de contratos vigentes, Account Managers y bitácoras operativas.

### Funcionalidades Clave y Lógica Interna
*   **Solapa "Negocios y Contratos":** Centraliza toda la información comercial contractual y de servicios recurrentes activos.
*   **Control y Gestión de SLAs Contractuales:**
    *   *Account Manager:* Visualización del AM comercial directo asignado para control y escalamiento de quejas.
    *   *Enlace Google Drive:* Acceso directo en un clic al contrato escaneado en formato PDF.
    *   *Switch de Renovación Automática:* Parámetro lógico que determina si el contrato se renueva de forma automática o requiere de una renegociación contractual previa al vencimiento.
    *   *Alertas Preventivas:* Disparo automático de correos preventivos y tareas de bitácora a los 30, 60 y 90 días del vencimiento del contrato.
    *   *Cuenta Regresiva:* Badge dinámico de vigencia del contrato (ej: *"Vence en 45 días"* o *"Vencido hace 3 días"*).
    *   *Versionado Histórico de Contratos:* Permite guardar múltiples versiones de un contrato (v1, v2) para auditar cambios en tarifas o volumen de envíos a lo largo del tiempo.
*   **Autonomía Operativa de Registro Local:** Permite dar de alta clientes locales directamente en el CRM sin requerir la vinculación obligatoria de oportunidades ganadas.

### Guías Paso a Paso

#### Cómo añadir un Contrato a un Cliente:
1. En la ficha de clientes, abre la pestaña **Negocios y Contratos**.
2. Haz clic en **+ Nuevo Contrato**.
3. Rellena los datos: Nombre del Acuerdo, Fechas de Inicio y Vencimiento, y Enlace a la carpeta de Google Drive.
4. Selecciona el **Tipo de Servicio Logístico** y el **Monto Mensual Estimado en la moneda local**.
5. Activa el switch de **Renovación Automática** si aplica y define los días de anticipación de las alertas preventivas (30, 60 o 90 días).
6. Presiona **Guardar Contrato**. El sistema creará los recordatorios automatizados.

---

## 07. Inteligencia de Salud, Bitácora & Alertas [roles: agente, supervisor, admin, superadmin, editor]
Módulo de prevención proactiva de pérdida de cuentas (Churn) y alertas automatizadas.

### Funcionalidades Clave y Lógica Interna
*   **Sentinel Health Score IA:** Sistema que analiza notas de la bitácora, incidencias abiertas en CX y demoras logísticas para computar un puntaje de salud de cuenta entre 0 y 100 puntos. Muestra una curva histórica con justificación descriptiva emitida por Sentinel IA para cada punto de control.
*   **Timeline de Bitácora:** Registro histórico inmutable. Almacena de forma cronológica eventos del sistema (transición de Kanban, carga de contratos) y notas manuales redactadas por los Account Managers.
*   **Canal "Alertas de Riesgo":** Muro de notificaciones que expone alertas críticas generadas por Sentinel IA.
    *   *Diagnóstico Completo:* Expone la causa raíz identificada por IA y la sugerencia de plan de acción inmediato.
    *   *Resolución Protegida por Cooldown:* El ejecutivo debe redactar obligatoriamente una nota de auditoría explicando qué medidas comerciales se tomaron antes de marcar la alerta como resuelta. Una vez resuelta, esa alerta entra en un enfriamiento de 24 horas para evitar resoluciones accidentales repetidas.
*   **Aislamiento Comercial de Supervisores:** Los supervisores restringidos solo visualizan los leads, clientes y alertas de los Account Managers pertenecientes a su división (Adquisición o Retención).

### Guías Paso a Paso

#### Cómo justificar la salud de una cuenta y ver su timeline:
1. Ingresa a la ficha de un cliente específico.
2. Observa la sección superior de **Health Score**. Haz clic en **Ver Línea de Tiempo de Salud**.
3. Selecciona un punto de control en el gráfico interactivo para ver la justificación en Markdown que emitió Sentinel IA en esa fecha.

#### Cómo resolver una Alerta de Riesgo con auditoría:
1. Dirígete a **Alertas de Riesgo** en el menú de navegación.
2. Selecciona la alerta activa sobre la cuenta en peligro. Lee la **Causa Raíz** y la **Acción Sugerida**.
3. Haz clic en **Resolver Alerta**.
4. Rellena el campo de **Nota de Auditoría Comercial** indicando las acciones concretas realizadas (ej: *"Reunión ejecutada, se negoció el incremento de flota en CL"*).
5. Presiona **Confirmar Resolución**.

---

## 08. WhatsApp y Omnicanalidad Comercial [roles: agente, supervisor, admin, superadmin]
Centro integrado de comunicación omnicanal con leads y clientes corporativos.

### Funcionalidades Clave y Lógica Interna
*   **Consola de Chat WhatsApp Business:**
    *   *Ventana de 24 horas de Meta:* Si se ha recibido un mensaje del cliente en las últimas 24 horas, se habilita el teclado para redactar texto libre.
    *   *Plantillas Meta:* Si la ventana de 24 horas está cerrada, el ejecutivo solo puede seleccionar y enviar una plantilla pre-aprobada por Meta.
    *   *Notas Internas (Susurros):* Permite redactar anotaciones internas privadas en el timeline de la conversación. Estas notas son invisibles para el cliente pero visibles por todo el equipo de Luxia.
    *   *Sugerencias IA del Copiloto Sentinel:* Analiza los últimos mensajes de la conversación de WhatsApp y genera sugerencias de respuesta adaptativas en un clic.
*   **Copiloto de Terreno & Asistente de Voz:**
    *   *Dictado por Voz:* Permite dictar notas de bitácora mediante reconocimiento de voz integrado en el navegador (Web Speech API).
    *   *Action Mode:* Ejecuta cambios de etapa de oportunidades o hitos del onboarding mediante comandos de voz (ej: *"Completar hito firma contrato"*).
    *   *Query Mode:* Analiza por voz la bitácora y responde preguntas operativas del cliente al comercial en terreno.
*   **Integración de Google Meet:**
    *   *Grabación de Meet:* Genera el enlace de la reunión con consentimiento de grabación obligatorio.
    *   *Widget de Meet de Luxia:* Se superpone a la videollamada y emite beeps acústicos y alertas visuales al cumplirse el minuto 4 del límite configurado (5 minutos estándar).
    *   *Grabadora Local HTML5 (MediaRecorder):* Si el comercial cuenta con licencia Workspace Starter, el sistema realiza la grabación directamente en el cliente HTML5 y la sube a Firebase Cloud Storage.

### Guías Paso a Paso

#### Cómo enviar mensajes y utilizar macros en WhatsApp:
1. Abre la pestaña **WhatsApp** en la ficha del cliente.
2. Si la conversación está abierta (dentro de las 24 horas), escribe tu mensaje en la caja inferior. Puedes hacer clic en **✨ Copiloto WhatsApp** para que Sentinel redacte una sugerencia.
3. Si la ventana está cerrada, selecciona **Enviar Plantilla**, elige la plantilla adecuada, completa los valores variables y haz clic en **Enviar**.
4. Si quieres guardar un apunte interno para el equipo, activa el check **Guardar como Susurro (Nota Interna)** antes de enviar.

#### Cómo iniciar una reunión de Google Meet con temporizador:
1. En el widget de contactos de un cliente, haz clic en el botón de **Google Meet**.
2. Marca la casilla obligatoria de **Consentimiento Legal de Grabación del Cliente**.
3. Haz clic en **Generar Meet e Iniciar Videollamada**.
4. Al abrirse Meet, observa el widget de Luxia flotante. El temporizador iniciará la cuenta regresiva. Presta atención a los beeps acústicos cuando falte un minuto para finalizar la sesión auditada.

---

## 09. Gestión de Tickets de Soporte (CX) [roles: agente_cx, supervisor_cx, admin, superadmin]
Bandeja compartida para la resolución y escalamiento de reclamos operacionales.

### Funcionalidades Clave y Lógica Interna
*   **Bandeja Compartida de CX (`CxInboxView`):**
    *   *Diseño Tri-Panel:* Izquierda (listado de tickets ordenados por SLA), Centro (línea de chat interactivo y detalle de interacciones), Derecha (información de la cuenta, tipificación y SLAs).
    *   *Frentes de Atención:* Segmentación de colas por origen: VIP (clientes corporativos prioritarios), Final (destinatarios de envíos), Drivers (conductores de la flota regional).
*   **Gestión de Respuestas y Notas Internas (Susurros):** Permite intercalar entre respuestas públicas (enviadas por correo/WhatsApp al creador del ticket) y susurros internos para auditorías y coordinación técnica.
*   **SLA de Atención y Alarmas:** Relojes de control dinámicos que muestran el tiempo límite de primera respuesta (FRT) y tiempo de resolución (RT). Cambian a color rojo al estar próximos a vencer.
*   **Sugerencias del Copiloto Sentinel CX:** Lee la tipificación asignada al ticket y el historial de mensajes para sugerir un texto formal de resolución o disculpa.

### Guías Paso a Paso

#### Cómo gestionar y responder un ticket de soporte:
1. Selecciona la opción de menú **Soporte y CX (Tickets)**.
2. Haz clic en un ticket de la lista en el panel izquierdo. VIP se muestra arriba con prioridad.
3. Observa los relojes de SLA en el panel derecho para evaluar el tiempo restante.
4. Escribe la respuesta al cliente. Puedes presionar **✨ Copiloto CX** para insertar una sugerencia rápida.
5. Elige si enviar como respuesta pública o guardar como nota interna.
6. Si resolviste la consulta, cambia el estado superior a **Resuelto** y selecciona el **Motivo de Cierre** obligatorio. Haz clic en **Confirmar Cierre**.

---

## 10. Auto-Capacitación y Gamificación [roles: lector, agente, agente_cx, supervisor, supervisor_cx, admin, superadmin, editor]
Entrenamiento interactivo obligatorio para la certificación y ruteo prioritario de leads.

### Funcionalidades Clave y Lógica Interna
*   **Certificaciones Basadas en Rol:** Evaluaciones adaptadas según el perfil de seguridad del usuario logueado (soportando los 7 roles RBAC: Lector, Agente Comercial, Supervisor Comercial, Agente CX, Supervisor CX, Admin y SuperAdmin en niveles Básico, Avanzado o Único).
*   **Prioridad en Ruteo Round-Robin:** Los comerciales certificados con el distintivo de birrete (`🎓`) reciben prioridad de asignación de leads en el algoritmo rotativo regional.
*   **Examen Bimodal:**
    *   *Teórico:* Selección múltiple. Se procesa en servidor con protección contra copias y saltos de pestaña (anti-cheat).
    *   *Práctico:* Caso operativo real de negociación o configuración. El texto es evaluado mediante el motor *Sentinel Exam Engine*, que analiza la estructura, consistencia y viabilidad, emitiendo una nota de 0 a 100 y una retroalimentación detallada en Markdown.
*   **Gamificación Activa:** La aprobación del examen de certificación otorga XP, actualiza el nivel del usuario en el Leaderboard regional y le añade la distinción de birrete (`🎓`) al lado de su nombre.

### Guías Paso a Paso

#### Cómo rendir el examen y certificarse:
1. Haz clic en tu perfil en la barra superior y selecciona **Auto-Capacitación**.
2. Presiona el botón **Iniciar Examen de Certificación**.
3. Responde a las preguntas del cuestionario de opción múltiple.
4. En el área del caso práctico, redacta detenidamente tu solución detallada.
5. Haz clic en **Enviar Examen**. El sistema procesará el envío y mostrará tu puntaje obtenido, tus XP ganados y la retroalimentación de la IA en tiempo real.

---

## 11. Panel de Supervisión y Asignaciones [roles: supervisor, supervisor_cx, admin, superadmin]
Panel máster para coordinadores de equipos comerciales y de soporte.

### Funcionalidades Clave y Lógica Interna
*   **Aislamiento y Visibilidad Restringida:** Los supervisores solo pueden buscar, asignar y auditar leads y clientes que pertenezcan a su área comercial (Adquisición o Retención) y a su región geográfica.
*   **Reasignaciones en Bloque:** Permite seleccionar múltiples prospectos o clientes comerciales y reasignarlos masivamente a otro comercial activo del equipo, registrando la auditoría del cambio.

### Guías Paso a Paso

#### Cómo reasignar múltiples leads en bloque:
1. Dirígete a la sección de **Supervisión > Reasignaciones**.
2. Marca las casillas de verificación de los leads en la tabla.
3. Haz clic en el botón superior **Reasignar Ejecutivo (AM)**.
4. Elige al nuevo AM del listado disponible para tu equipo.
5. Haz clic en **Confirmar Reasignación Masiva**. El cambio se reflejará instantáneamente y quedará guardado en la bitácora de cada prospecto.

---

## 12. Exportación Segura de Datos [roles: supervisor, supervisor_cx, admin, superadmin]
Panel unificado de exportación para la descarga de información comercial del CRM.

### Funcionalidades Clave y Lógica Interna
*   **Rate Limiting y Filtros:** Controla el número máximo de exportaciones por hora por usuario.
*   **Detección de Exfiltración:** Si se solicita descargar un volumen de filas superior al umbral de seguridad, el sistema genera una descarga parcial y dispara una alerta silenciosa al panel de observabilidad.
*   **Almacenamiento Temporal Seguro:** Los reportes generados se guardan en Firebase Cloud Storage y se eliminan automáticamente tras el tiempo de retención configurado.

### Guías Paso a Paso

#### Cómo exportar datos de la cartera:
1. Haz clic en el botón **Exportar** en el panel correspondiente.
2. Define el rango de fechas.
3. Marca los conceptos y columnas requeridas.
4. Selecciona el formato (Excel o CSV).
5. Haz clic en **Descargar**.

---

## 13. Configuración Comercial (Pipeline e Hitos) [roles: admin, superadmin]
Gobernanza de embudos de ventas y el checklist estándar de activación.

### Funcionalidades Clave y Lógica Interna
*   **Configuración del Embudo (PipelineConfig):**
    *   *Fijar Probabilidades:* Permite modificar la probabilidad por defecto asociada a cada etapa en el Kanban para ponderar las proyecciones de venta.
    *   *Motivos de Pérdida:* Catálogo dinámico de razones por las cuales se pierde un trato (precio, competencia, etc.).
    *   *Campos de Gatekeeping:* Checklist de campos obligatorios requeridos para autorizar el paso a cada columna.
*   **Plantilla de Hitos de Onboarding:** Administración central de hitos requeridos para dar de alta clientes corporativos.
    *   *Segmentación:* Permite configurar hitos exclusivos para ciertos países y servicios logísticos (ej: un hito de integración técnica obligatorio solo para el servicio SaaS).
    *   *Evidencia Obligatoria:* Flag que exige al comercial adjuntar obligatoriamente una URL/archivo para poder completar el hito.

### Guías Paso a Paso

#### Cómo configurar el Gatekeeping de una Etapa del Pipeline:
1. Ve a **Configuración > Comercial > Pipeline & Funnel**.
2. Selecciona el Pipeline (Adquisición o Retención) y el Servicio Logístico.
3. Ubica la etapa que deseas proteger (ej: *Propuesta*).
4. Activa las casillas de los campos dinámicos u obligatorios requeridos (ej: monto estimado, fecha de cierre).
5. Haz clic en **Guardar Cambios**.

#### Cómo configurar Hitos de Onboarding Segmentados:
1. Ve a **Configuración > Comercial > Hitos de Onboarding**.
2. Haz clic en **+ Nuevo Hito**.
3. Escribe el título del hito (ej: *"Configuración de Webhooks de Prueba"*), establece su orden visual y selecciona el país y servicio donde se aplicará de manera obligatoria.
4. Si requiere respaldo físico o enlace, activa el switch de **Evidencia Obligatoria**.
5. Haz clic en **Guardar Hito**.

---

## 14. Configuración de CX (SLAs y Categorías) [roles: admin, superadmin]
Administración del sistema de tickets y de los frentes de soporte.

### Funcionalidades Clave y Lógica Interna
*   **Tiempos de SLAs:** Configuración del FRT (First Response Time) y RT (Resolution Time) en minutos para cada nivel de urgencia (baja, media, alta, crítica).
*   **Multiplicadores de SLA VIP:** Parámetro que reduce a la mitad (ej: factor 0.5x) los tiempos de respuesta exigidos para clientes etiquetados como VIP.
*   **Colas de Routing:** Rutas y reglas de asignación automática de tickets entrantes a los diferentes frentes.
*   **Configuración de Tipificaciones:** Árbol de categorías de tickets de hasta 3 niveles (ej: *Reclamo > Retraso de Colecta > Sin Flota*) con priorización sugerida automática.
*   **Macros and FAQs:** Respuestas rápidas de CX y base de artículos del Help Center.
*   **Encuestas CSAT:** Plantilla de correo SMTP que se envía automáticamente al resolverse un ticket para recopilar la encuesta CSAT.

### Guías Paso a Paso

#### Cómo configurar SLAs y Prioridades VIP:
1. Ve a **Configuración > Soporte y CX > Tiempos de SLAs**.
2. Edita los minutos de primera respuesta y resolución para las urgencias crítica, alta, media y baja.
3. En la sección **Multiplicador VIP**, define el factor corrector de tiempos (ej: `0.5` para exigir la mitad de tiempo).
4. Haz clic en **Guardar Configuración**.

#### Cómo crear un Artículo de FAQ para el Help Center:
1. Ve a **Configuración > Soporte y CX > Base de FAQs**.
2. Haz clic en **+ Crear FAQ**.
3. Selecciona la Categoría, ingresa un Título descriptivo y redacta el cuerpo de respuesta en Markdown.
4. Haz clic en **Guardar y Publicar**. Estará disponible de inmediato en la bandeja tri-panel de CX y en el Help Center.

---

## 15. Configuración de Personas y Equipos [roles: admin, superadmin]
Gestión de usuarios del CRM, invitaciones y equipos.

### Funcionalidades Clave y Lógica Interna
*   **Gestión de Invitaciones por Correo (SMTP Queue):**
    *   *Plantilla de Invitación:* Permite configurar el asunto y cuerpo de la invitación por correo. Soporta las variables dinámicas `{{email}}`, `{{rol}}` y `{{equipo}}`.
    *   *Cola de Correos (`cola_correos`):* Panel de observabilidad técnica que muestra los correos pendientes de envío, en proceso, enviados o fallidos, con detalle de fecha, hora y logs de error SMTP en tiempo real.
*   **Estructura de Equipos:** Definición de divisiones de trabajo (Adquisición, Retención, CX) con un interruptor (`participaGamificacion`) que determina si el equipo compite en el Leaderboard por XP.
*   **Regla de Gobernanza de Equipos para Administradores:** Por arquitectura de seguridad y permisos globales, los usuarios con rol **Admin** o **SuperAdmin** pertenecen de manera obligatoria y exclusiva al equipo **Global**. Al invitar o modificar el rol de un usuario a Admin o SuperAdmin, el sistema fija automáticamente su equipo en *Global* e inhabilita su reasignación a equipos específicos en la consola de usuarios.

### Guías Paso a Paso

#### Cómo enviar una invitación y auditar su envío:
1. Ve a **Configuración > Organización y Personas > Usuarios & Roles**.
2. Haz clic en **+ Invitar Usuario**.
3. Escribe el Correo Corporativo, selecciona el Rol RBAC y el Equipo asignado.
4. Presiona **Enviar Invitación**.
5. Para auditar el envío del correo, desplázate a la sección inferior de **Cola de Correos**. Busca la dirección de correo ingresada y valida el estado: si muestra *Enviado*, el usuario ya recibió la invitación; si muestra *Error*, coloca el cursor sobre el badge de error para visualizar el reporte del servidor SMTP.

---

## 16. Configuración de Datos (Campos y Form) [roles: admin, superadmin]
Constructor no-code de formularios dinámicos, Metrics Studio e Inbound Leads.

### Funcionalidades Clave y Lógica Interna
*   **Secciones y Campos Dinámicos:**
    *   *Creación de Secciones:* Categorías con icono asignable (Bootstrap Icons) y entidad asociada (Cliente, Contrato, Contacto, Actividad).
    *   *Creación de Campos:* Tipos soportados (texto, número, selección select, checkbox, fecha, archivo).
    *   *Catálogos de Origen:* Los campos de selección pueden nutrirse de opciones manuales o enlazar dinámicamente con catálogos vivos del sistema (ej: lista de servicios contratados, lista de AMs activos).
    *   *Live Preview:* Panel lateral que renderiza en tiempo real el formulario final mientras se agregan o modifican campos.
*   **Metrics Studio (IA KPI Engine):**
    *   *Generador en Lenguaje Natural:* Permite ingresar una consulta simple (ej: *"Contratos activos con renovación automática en Perú"*) para que Sentinel Architect procese el prompt, determine la colección destino y genere las métricas.
    *   *Loop de Feedback:* Los ejecutivos pueden calificar el gráfico generado con 👍 o 👎 para entrenar y refinar las respuestas del motor conversacional.
*   **Diseñador de Formularios Web Inbound:**
    *   *Campos Disponibles vs Seleccionados:* Panel con drag-and-drop para mover campos y estructurar formularios web públicos.
    *   *Generador de Código:* Entrega el enlace directo URL y un bloque `<iframe>` HTML listo para insertar en el sitio corporativo.
    *   *Autocreación:* El envío del formulario web valida los datos y da de alta automáticamente la empresa y el contacto en el CRM.

### Guías Paso a Paso

#### Cómo crear un Campo Dinámico y validar su vista:
1. Ve a **Configuración > Datos y Formularios > Campos Dinámicos**.
2. Haz clic en **+ Crear Sección**. Asígnale un nombre (ej: *"Datos de Integración"*), icono y entidad destino (ej: *Cliente*).
3. Dentro de la sección creada, haz clic en **+ Agregar Campo**. Completa la Key (alfanumérica única) y Tipo.
4. Si seleccionas Tipo *Select*, define si las opciones se ingresan manualmente o enlazan a un catálogo dinámico (ej: catálogo de *Servicios*).
5. Observa el panel derecho de **Live Preview** para ver cómo se renderiza el campo y su comportamiento. Haz clic en **Guardar Configuración**.

#### Cómo crear un KPI usando Metrics Studio:
1. Ve a **Configuración > Datos y Formularios > Metrics Studio**.
2. En la caja de texto escribe tu requerimiento en lenguaje natural (ej: *"Total de montos de oportunidades ganadas este mes"*).
3. Selecciona la pestaña de destino del Dashboard donde renderizar el widget.
4. Presiona **✨ Crear KPI con IA**.
5. Revisa el KPI generado. Prueba su visualización y califícalo con 👍 o 👎 en la esquina del widget para enviar retroalimentación al sistema.

---

## 17. Configuración de Seguridad y RBAC [roles: superadmin]
Administración avanzada de privilegios de seguridad y políticas de sesión.

### Funcionalidades Clave y Lógica Interna
*   **Matriz de Permisos RBAC:** Tabla interactiva que asocia roles (Lector, Agente, Supervisor, Admin, SuperAdmin) con acciones atómicas (alta de clientes, exportación de bases de datos, anulación de notas, configuración de SLAs y **configuración de modelos de IA**). Cada permiso es representado por un checkbox.
*   **Matriz de Ámbitos de Datos (Data Scopes):** Panel que asocia cada rol del sistema con el nivel de contención visual para las entidades críticas (`leads`, `oportunidades`, `clientes`, `tablero`, `cx_inbox`, `alertas`, `capacitacion`, `consumo_ia`). Permite conmutar dinámicamente entre los niveles de alcance:
    *   `ALL`: Acceso completo a toda la organización.
    *   `TEAM`: Limitación automática a registros del mismo equipo.
    *   `OWN`: Restricción a registros asignados o creados personalmente.
    *   `NONE`: Ocultamiento total de datos.
*   **Políticas de Desconexión por Inactividad:**
    *   *Interruptor Central:* Habilita o deshabilita la desconexión por inactividad.
    *   *Límite de Inactividad:* Parámetro numérico en minutos (1 a 120 minutos). Monitoreado reactivamente en cliente por `AgentPresenceMonitor.jsx`.

### Guías Paso a Paso

#### Cómo modificar permisos atómicos de la Matriz RBAC:
1. Ve a **Configuración > Seguridad > Matriz de Permisos**.
2. Ubica la fila de la acción o pantalla que deseas proteger (ej: *Catálogo de Modelos IA* o *Configurar Catálogo de Modelos*) y la columna del rol correspondiente (ej: *Agente*).
3. Marca la casilla para otorgar el permiso o desmárcala para denegarlo.
4. Haz clic en **Guardar Matriz de Seguridad**. Los cambios impactarán instantáneamente en los privilegios de navegación de todos los usuarios logueados.

#### Cómo configurar la Matriz de Ámbitos de Datos (Data Scopes):
1. Ve a **Configuración > Seguridad > Matriz de Ámbitos**.
2. Ubica la entidad que deseas regular en las filas (ej: *Leads* u *Oportunidades*) y la columna del rol correspondiente (ej: *Agente*).
3. Selecciona la opción deseada del desplegable (`ALL`, `TEAM`, `OWN` o `NONE`).
4. Haz clic en **Guardar Matriz de Ámbitos**. La visibilidad de registros y la validación en cargas masivas o exportaciones se aplicarán en tiempo real para todos los operadores.

---

## 18. Configuración de IA y FinOps (Presupuesto) [roles: superadmin]
Monitoreo financiero y gobernanza de la inteligencia artificial de Sentinel.

### Funcionalidades Clave y Lógica Interna
*   **Sentinel Máster Prompts Config:** Permite editar los System Prompts, temperatura del modelo y número de tokens de salida de los distintos agentes IA integrados en el CRM (scorer, risk, triage, metings, etc.) incluyendo el nuevo **🤖 Auditor KB** para propuestas de manuales. Permite revertir cambios mediante el historial de versiones guardadas.
*   **Gestión RAG y Propuestas de Conocimiento:**
    *   *Bandeja de Propuestas:* Ubicada en la pestaña **📝 Propuestas KB**. Recopila las sugerencias del Auditor de IA basadas en los reportes de feedbacks negativos corregidos por los usuarios para su aprobación o edición por parte del Administrador.
    *   *Botón Actualizar RAG (Validación Inteligente):* Re-indexa de forma vectorial los manuales de operaciones y referencia técnica. Cuenta con un validador de firmas SHA-256 en base de datos. Si no se han realizado cambios en los manuales de texto, el sistema aborta de inmediato la sincronización indicando que la base RAG está al día, evitando costes de APIs de Gemini y escrituras Firestore redundantes.
*   **Módulo FinOps Presupuestario:**
    *   *Presupuesto en USD:* Límite mensual de gasto en APIs de Google Gemini y WhatsApp Business.
    *   *Consumo Acumulado:* Gráficos que muestran el acumulado del mes contra la meta proyectada.
    *   *Circuit Breaker (Auto-shutoff):* Switch que, al activarse, deshabilita en vivo todas las llamadas a las APIs de IA en el CRM al alcanzar el 100% del presupuesto para evitar sobrecostos inesperados.
    *   *Límites por Rol:* Permite asignar topes de llamadas de IA por hora por cada tipo de rol de usuario.
*   **Desactivación Global de Integraciones:** Switch de desconexión de emergencia que pausa integraciones externas con Slack y WhatsApp en caso de incidencias de seguridad.

### Guías Paso a Paso

#### Cómo configurar y revertir un Prompt Máster de IA:
1. Ve a **Configuración > Inteligencia & FinOps > Parámetros Sentinel**.
2. Selecciona la pestaña del agente a modificar (ej: *Sentinel Lead Scorer* o *🤖 Auditor KB*).
3. Edita la caja de texto del **System Prompt**.
4. Haz clic en **Guardar y Publicar**.
5. Si deseas revertir a un estado previo, haz clic en **Historial de Versiones**, selecciona una fecha y presiona **Revertir Versión**.

#### Cómo auditar y aplicar propuestas de conocimiento RAG:
1. Ve a **Configuración > Inteligencia & FinOps > Propuestas KB**.
2. En la bandeja de entrada, revisa el detalle de la sugerencia (muestra la pregunta original, la respuesta fallida de la IA de Soporte, el dato correcto provisto por el usuario y el texto propuesto en markdown).
3. Edita el texto propuesto si lo deseas y presiona **Aprobar Propuesta** para actualizar los manuales maestros automáticamente en Firestore.
4. Para que la IA de Soporte adquiera de inmediato este conocimiento, haz clic en **Actualizar RAG**. Si hay manuales actualizados, se sincronizará la base vectorial; si no se detectan cambios de texto, una alerta te indicará que la base ya está al día sin generar costos.

#### Cómo fijar cuotas de FinOps y activar el Circuit Breaker:
1. Ve a **Configuración > Inteligencia & FinOps > Consumo de IA (FinOps)**.
2. Define el presupuesto límite en dólares (ej: `50.00` USD) y activa el switch **Circuit Breaker (Auto-shutoff)**.
3. Configura los niveles de alerta enviando notificaciones preventivas por correo cuando el gasto alcance el 50%, 75% o 90%.
4. Haz clic en **Guardar Parámetros de Consumo**.

---

## 19. Centro de Observabilidad IT [roles: superadmin]
Panel máster de monitoreo de salud del sistema, bases de datos y red cloud.

### Funcionalidades Clave y Lógica Interna
*   **Telemetría local (dbTracker):** Monitor en tiempo real que contabiliza las lecturas, escrituras y eliminaciones efectuadas en Firestore por la pestaña abierta del usuario. Permite diagnosticar latencias y optimizar la cuota de la base de datos.
*   **Comandos de Escaneo del Sistema:** Botón que ejecuta validaciones de consistencia de la base de datos (ej: huérfanos de clientes, campos dinámicos sin índice).
*   **Uptime y Estado de Servicios:** Monitores que muestran el estado de conexión de las APIs de Meta, Google Cloud Platform, Firebase y APIs internas en las últimas 24 horas y los últimos 30 días.
*   **Persistencia IndexedDB Offline:** Métricas del almacenamiento local IndexedDB que permiten validar la sincronización correcta de la base de datos local del navegador al perder conexión de red.
*   **Banners de Sistema:** Constructor de comunicados globales que muestra alertas críticas en la parte superior del CRM de forma inmediata.

### Guías Paso a Paso

#### Cómo monitorear lecturas Firestore y estado IT:
1. Ve a **Configuración > Observabilidad IT > Monitor de Telemetría**.
2. Observa el contador del **dbTracker** para analizar la cantidad de consultas de tu sesión y detectar consultas redundantes en tus vistas.
3. Si el CRM está presentando lentitud, revisa la grilla de **Uptime de 30 días** para verificar si algún servicio de Firebase o Meta registra caídas temporales de servicio.
4. Para notificar una mantención programada, ve a **Banners de Sistema**, escribe el mensaje (ej: *"Interrupción técnica hoy 22:00 hrs"*), selecciona color rojo de alerta y presiona **Publicar Banner Global**.
