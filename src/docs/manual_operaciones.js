export const MANUAL_OPERACIONES_MD = `# Manual de Operaciones Comerciales y Agronómicas
## LUXIA® Agro Enterprise CRM · Guía Oficial de Usuario

Bienvenido al **Manual de Operaciones de LUXIA® Agro**. Este documento constituye la guía canónica de referencia para **Asesores Técnicos Comerciales (RTC)**, **Supervisores Regionales** y **Administradores** sobre el uso de la plataforma para la gestión de relaciones comerciales, prescripciones fitosanitarias, acuerdos de Canje Cereal y seguimiento de productores.

---

### 1. Visión General del Ecosistema LUXIA® Agro

**LUXIA® Agro** es una plataforma integral de gestión comercial (CRM/CLM) y revenue assurance diseñada específicamente para la industria de insumos agropecuarios y protección de cultivos (Herbicidas, Fungicidas, Insecticidas, Coadyuvantes y Tratamiento de Semillas).

#### Objetivos Clave de la Plataforma:
1. **Digitalizar el Ciclo Comercial a Campo**: Desde el descubrimiento del lote y la prescripción agronómica hasta la firma de acuerdos de suministro.
2. **Prevenir Riesgos y Churn con Inteligencia Artificial**: A través del motor **LUXIA IA**, que audita deudas, discrepancias en liquidaciones de Canje Cereal y demoras en entregas críticas de campaña.
3. **Visibilidad 360° de Productores y Distribuidores**: Consolidar en un solo perfil la superficie sembrada (hectáreas), cultivos principales (soja, maíz, trigo, girasol), historial de compras y contactos técnicos y financieros.

---

### 2. Módulo de Prospección (Leads) y Dashboard SDR

El **Buzón de Prospección** centraliza la ingesta de potenciales clientes (productores agrícolas, cooperativas de acopio y distribuidores zonales) captados a través de ferias agropecuarias, campañas digitales, referencias técnicas o ingesta vía API.

#### 2.1 Flujo de Registro y Calificación de Leads
1. **Alta de Prospecto**:
   * Presiona **+ Nuevo Prospecto** o importa lotes masivos mediante **Carga Masiva (CSV)**.
   * Completa los datos firmográficos clave: *Razón Social, CUIT/RUT, Contacto Decisor, Correo, Teléfono, Ubicación (Provincia/Localidad) y Superficie Estimada en Hectáreas*.
2. **Evaluación de Idoneidad con LUXIA Lead Scorer**:
   * LUXIA IA evalúa el perfil del prospecto asignando un **Score de Idoneidad (0 a 100)** y recomendando el tier de atención (Tier 1 VIP >5,000 Has, Tier 2 Mid 1,000-5,000 Has, Tier 3 SMB <1,000 Has).
3. **Estados del Ciclo de Prospección**:
   * **🆕 Nuevo**: Prospecto recién ingresado pendiente de asignación o primer contacto.
   * **📞 Contactado**: En fase de relevamiento técnico o visita a campo agendada.
   * **✅ Calificado**: Cumple con los criterios de idoneidad técnica/crediticia. Al calificarlo, el sistema permite convertirlo automáticamente en una **Oportunidad Comercial** en el Pipeline.
   * **❌ Descalificado**: No cumple con los requisitos comerciales (ej. sin capacidad de pago o fuera de zona de distribución).

#### 2.2 Dashboard Operativo SDR
Permite a los supervisores y ejecutivos de prospección monitorear en tiempo real el embudo de entrada, las tasas de conversión a oportunidad y el balanceo de carga de prospectos por asesor.

---

### 3. Pipeline de Ventas y Oportunidades Comerciales

El **Pipeline Comercial** organiza las negociaciones activas en etapas progresivas adaptadas al calendario agrícola:

#### 3.1 Etapas del Embudo Comercial:
1. **Descubrimiento y Relevamiento Agronómico (20%)**: Identificación de problemáticas en lotes (malezas resistentes, plagas, enfermedades fúngicas) y necesidades de volumen para la campaña.
2. **Análisis de Lote y Propuesta Técnica (40%)**: Confección del paquete de fitosanitarios y estimación de dosis por hectárea.
3. **Oferta Comercial y Condiciones de Pago (60%)**: Presentación de cotización formal, fijación de precios en Dólar Link o modalidad Canje Cereal.
4. **Negociación y Aprobación de Crédito (80%)**: Validación del legajo crediticio/SISA y acuerdo de entrega en campo o retiro en sucursal.
5. **Cierre Ganado (100%)**: Confirmación de la orden de compra y emisión del **Contrato de Suministro Fitosanitario**.
6. **Cierre Perdido (0%)**: Registro estructurado del motivo de pérdida (precio de competidor, falta de stock, cambio de estrategia de siembra).

---

### 4. Gestión 360° de Cuentas y Productores (Cartera de Clientes)

La tabla de **Clientes de Cartera** proporciona una vista unificada de todas las relaciones comerciales consolidadas:

#### 4.1 Ficha Técnica del Productor:
* **Datos Operativos**: CUIT, Tipo de Cuenta (*Productor, Distribuidor, Cooperativa*), Superficie Total Sembrada y Localización de Lotes.
* **Mapa de Decisión (Contactos)**: Registro unificado con roles de decisión (*Propietario / Productor, Administrador, Ingeniero Agrónomo / Asesor Técnico, Encargado de Compras, Capataz de Campo*).
* **Bitácora de Campo e Interacciones**: Registro cronológico de visitas técnicas, ensayos en lote, reuniones de seguimiento y minutas comerciales.

#### 4.2 Monitor de Salud (Health Score LUXIA IA):
El motor LUXIA IA audita continuamente la cuenta calculando un índice de salud (0 a 100):
* 🟢 **Green (75-100 pts)**: Cuenta saludable, sin deudas vencidas, entregas a término y cumplimiento de volumen.
* 🟡 **Yellow (40-74 pts)**: Señales de alerta preventiva (garantías pendientes, mora <15 días o demoras moderadas en entregas).
* 🔴 **Red (0-39 pts)**: Riesgo crítico de Churn o incobrabilidad (facturas >60 días, discrepancias graves en liquidación de Canje Cereal o rescisión de contrato).

---

### 5. Tablero Operativo de Onboarding y Campaña

El **Tablero de Onboarding** gestiona los hitos operativos y técnicos necesarios para la correcta entrega y aplicación de los insumos:

#### 5.1 Hitos Típicos de Campaña:
1. **Alta de Legajo y Validación SISA/Crediticia**: Verificación de solvencia y garantías.
2. **Definición de Receta Agronómica y Lotes**: Determinación de productos, dosis por hectárea y fechas estimadas de aplicación.
3. **Programación Logística y Entrega**: Coordinación de camiones, remitos y entrega de fitosanitarios a campo o depósito.
4. **Confirmación de Recepción y Ensayo**: Firma de remito y monitoreo inicial de eficacia biológica.
5. **Liquidación de Canje / Cobranza**: Cierre financiero contra entrega de cereal o pago convenido.

---

### 6. Gobernanza, Alertas Proactivas y Seguridad

* **Centro de Alertas**: LUXIA IA notifica automáticamente desviaciones críticas en tiempo real.
* **Matriz de Privilegios (RBAC)**: Cada usuario opera bajo un rol estricto (*SuperAdmin, Administrador, Supervisor Comercial, Asesor Comercial/RTC, Editor Operativo o Lector*), protegiendo la confidencialidad de precios y cartera.
* **Seguridad y Auditoría**: Registro inmutable de eventos destructivos y control de sesiones activas.
`;
