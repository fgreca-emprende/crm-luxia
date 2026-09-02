# Guía de Estilo y Sistema de Diseño (Design System Style Guide)
### CRM-Luxia Enterprise • Apple Human Interface Guidelines (macOS Sequoia 15 & iOS 18)

Este documento define la **fuente de la verdad visual, cromática y de interacción** para el desarrollo de la interfaz de usuario en CRM-Luxia. Todo nuevo componente, vista o flujo de usuario debe alinearse rigurosamente con estos principios y tokens.

---

## 1. Filosofía de Diseño y Fundamentos

El sistema de diseño de CRM-Luxia está inspirado directamente en el lenguaje visual de **Apple macOS Sequoia 15 y iOS 18 / iPadOS 18**:

- **Materiales Líquidos y Acrílicos (Liquid Glass):** Uso de capas translúcidas con desenfoque de fondo (*backdrop-filter blur*) y saturación aumentada para una sensación táctil y moderna.
- **Geometría Orgánica (Squircles & Continuous Curves):** Bordes curvados continuos con radios generosos (`14px`, `18px`, `22px`, `28px`, `9999px`).
- **Resalte Especular (Inner Specular Highlight):** Cada tarjeta, modal y barra cuenta con un sutil bisel interno (`inset 0 1px 0.5px ...`) que simula la refracción de la luz sobre vidrio pulido.
- **Física Natural y Micro-interacciones:** Transiciones fluidas con curvas de aceleración elásticas tipo Apple (`cubic-bezier(0.16, 1, 0.3, 1)`) y retroalimentación táctil de compresión al presionar botones (`transform: scale(0.97)`).
- **Lienzo 100% Full-Width:** Eliminación de barras laterales fijas que consumen espacio horizontal; navegación centralizada en el **Apple Command SuperBar** flotante con ancho adaptativo hasta 1680px.

---

## 2. Paleta de Colores del Sistema (System Tints)

Los colores de acento se adaptan dinámicamente según el modo activo (**Claro Cerámico** vs **Oscuro Deep OLED**).

### 2.1 Colores Semánticos Principales

| Token CSS | Modo Claro (Sequoia) | Modo Oscuro (Space OLED) | Propósito Semántico |
| :--- | :--- | :--- | :--- |
| `--apple-blue` | `#0071E3` (Accesible) | `#0A84FF` (Vibrante) | Acciones primarias, selección activa, enlaces y focos |
| `--apple-purple` | `#AF52DE` | `#BF5AF2` | Luxia IA, análisis predictivo, inteligencia y ML |
| `--apple-indigo` | `#5856D6` | `#5E5CE6` | Integraciones, webhooks, sincronizaciones y APIs |
| `--apple-pink` | `#FF2D55` | `#FF375F` | Notificaciones destacadas, gamificación y logros |
| `--apple-red` | `#FF3B30` | `#FF453A` | Alertas críticas, riesgo de churn, errores y peligro |
| `--apple-orange` | `#FF9500` | `#FF9F0A` | Advertencias, SLA en riesgo, estados break y demoras |
| `--apple-yellow` | `#FFCC00` | `#FFD60A` | Monedas, favoritos, scoring intermedio y destacados |
| `--apple-green` | `#34C759` | `#30D158` | Éxito, contratos vigentes, pagos recibidos y online |
| `--apple-mint` | `#00C7BE` | `#63E6E2` | Onboarding, satisfacción de clientes (CSAT) y NPS |
| `--apple-teal` | `#30B0C7` | `#40C8E0` | Mesa de ayuda (CX), tickets y telecomunicaciones |
| `--apple-cyan` | `#32ADE6` | `#64D2FF` | Información contextual, canales web y chat en vivo |

---

### 2.2 Escala de Grises y Jerarquía de Superficies

#### Modo Claro (Light Mode)
* **Canvas de Fondo (`--apple-canvas`):** `#F5F5F7` (Aluminio / Cerámica Apple)
* **Superficie Base (`--apple-surface`):** `rgba(255, 255, 255, 0.82)`
* **Superficie Elevada (`--apple-surface-elevated`):** `rgba(255, 255, 255, 0.96)`
* **Tarjetas (`--apple-surface-card`):** `linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(246, 246, 250, 0.85))`
* **Borde Principal (`--apple-border`):** `rgba(60, 60, 67, 0.12)`
* **Borde Sutil (`--apple-border-subtle`):** `rgba(60, 60, 67, 0.06)`
* **Texto Primario (`--apple-text-primary`):** `#1D1D1F`
* **Texto Secundario (`--apple-text-secondary`):** `#86868B`
* **Texto Terciario (`--apple-text-tertiary`):** `#AEAEB2`

#### Modo Oscuro (Dark Mode OLED)
* **Canvas de Fondo (`--apple-canvas`):** `#000000` (Negro Puro OLED)
* **Superficie Base (`--apple-surface`):** `rgba(28, 28, 30, 0.82)`
* **Superficie Elevada (`--apple-surface-elevated`):** `rgba(36, 36, 40, 0.95)`
* **Tarjetas (`--apple-surface-card`):** `linear-gradient(145deg, rgba(32, 32, 36, 0.92), rgba(20, 20, 24, 0.85))`
* **Borde Principal (`--apple-border`):** `rgba(255, 255, 255, 0.12)`
* **Borde Sutil (`--apple-border-subtle`):** `rgba(255, 255, 255, 0.06)`
* **Texto Primario (`--apple-text-primary`):** `#FFFFFF`
* **Texto Secundario (`--apple-text-secondary`):** `#A1A1A6`
* **Texto Terciario (`--apple-text-tertiary`):** `#636366`

---

## 3. Tipografía y Jerarquía Textual

La tipografía utiliza el sistema de fuentes nativo de Apple:

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif;
```

### Escala Tipográfica
* **Títulos Principales (`h1`, `.apple-title`):** `font-weight: 700; letter-spacing: -0.024em;`
* **Subtítulos y Headers de Sección (`h2`, `h3`, `h5`):** `font-weight: 600; letter-spacing: -0.015em;`
* **Cuerpo de Texto Regular:** `font-size: 0.88rem; font-weight: 400; letter-spacing: -0.011em;`
* **Etiquetas y Botones:** `font-size: 0.82rem - 0.86rem; font-weight: 600;`
* **Micro-copy y Badges:** `font-size: 0.72rem - 0.75rem; font-weight: 600; text-transform: uppercase;`
* **Datos Numéricos / KPIs:** `font-variant-numeric: tabular-nums;` (alineación perfecta de cifras financieras).

---

## 4. Componentes Base y Patrones Visuales

### 4.1 Apple Command SuperBar (`.apple-superbar`)
Barra de navegación flotante superior fijada en pantalla:
* **Efecto de Vidrio:** `backdrop-filter: blur(36px) saturate(210%);`
* **Radio:** `--apple-radius-2xl` (`28px`).
* **Sombra:** `--apple-shadow-floating` con bisel superior reflectivo.
* **Componentes Internos:**
  * **Brand Pill:** Logotipo con gradiente y tipografía audaz.
  * **Nav Pills:** Botones de módulo con fondo translúcido y resaltado activo.
  * **Dropdowns Flotantes:** Menús anidados tipo macOS para *Comercial*, *Operaciones* y *Admin*.
  * **Control Segmentado de Países:** Píldoras interactivas (`AR`, `CL`, `PE`, `CO`, `MX` o `🌍 Todos`).
  * **Switch de Tema:** Selector de 3 modos (Auto / Claro / Oscuro).
  * **Baliza de Presencia:** Indicador circular animado con onda pulsante (*presence beacon*).

---

### 4.2 Tarjetas y Paneles (`.apple-card`, `.card`)
* **Fondo:** `--apple-surface-card` con gradiente sutil.
* **Radio:** `--apple-radius-xl` (`22px`).
* **Borde:** `1px solid var(--apple-border)` + `var(--apple-inner-highlight)`.
* **Hover:** Elevación suave hacia arriba (`transform: translateY(-3px)`) e iluminación del borde.

---

### 4.3 Botones y Píldoras (`.apple-btn`, `.btn`)
* **Radio:** `--apple-radius-pill` (`9999px`).
* **Acción Primaria (`.btn-primary`):** Fondo `--apple-blue` con sombra de resplandor `rgba(0, 113, 227, 0.28)`.
* **Acción Peligro (`.btn-danger`):** Fondo translúcido `--apple-red-light` con texto `--apple-red`.
* **Acción Éxito (`.btn-success`):** Fondo `--apple-green` con sombra de resplandor `rgba(52, 199, 89, 0.28)`.
* **Botones de Vidrio (`.apple-btn-glass`):** Fondo `--apple-surface` con `backdrop-filter: blur(16px)`.
* **Pulsación Táctil:** `:active { transform: scale(0.97); }`

---

### 4.4 Inputs y Selectores de Formulario (`.apple-input`, `.form-control`, `.form-select`)
* **Radio:** `--apple-radius-md` (`14px`).
* **Fondo:** `--apple-surface-elevated` con desenfoque de 12px.
* **Foco Apple Focus Ring:**
  ```css
  border-color: var(--apple-blue) !important;
  box-shadow: 0 0 0 4px var(--apple-blue-light) !important;
  outline: none !important;
  ```

---

### 4.5 Badges y Etiquetas de Estado (`.apple-badge`, `.badge`)
* **Diseño:** Cápsulas suaves (*Soft Glowing Pills*) con tipografía semi-bold y bordes al 30% de opacidad.
* **Clases:**
  * `.apple-badge-blue` / `.bg-primary`: Azul Apple.
  * `.apple-badge-green` / `.bg-success`: Verde Apple.
  * `.apple-badge-orange` / `.bg-warning`: Naranja Apple.
  * `.apple-badge-red` / `.bg-danger`: Rojo Apple.
  * `.apple-badge-teal` / `.bg-info`: Teal / Cyan Apple.

---

### 4.6 Tablas de Datos Flotantes (`.table`, `.table-premium`)
* **Estructura:** Filas separadas flotantes (`border-spacing: 0 0.4rem;`).
* **Fondo de Celda:** `--apple-surface` con bordes redondeados en la primera y última columna.
* **Hover:** Transición a `--apple-surface-elevated` con borde enfocado.

---

### 4.7 Alertas Tipo Vidrio Orgánico (`.alert`)
* **Diseño:** Squircles acrílicos con 20px de desenfoque y colores temáticos suaves:
  * `.alert-primary`: Fondo `--apple-blue-light` con texto `--apple-blue`.
  * `.alert-success`: Fondo `--apple-green-light` con texto `--apple-green`.
  * `.alert-warning`: Fondo `--apple-orange-light` con texto `--apple-orange`.
  * `.alert-danger`: Fondo `--apple-red-light` con texto `--apple-red`.

---

## 5. Reglas de Oro para Desarrolladores

1. **Uso Obligatorio de Variables CSS:** Nunca utilices valores hexadecimales rígidos (ej. `#000000` o `#FFFFFF`) dentro de componentes; utiliza siempre variables semánticas (`var(--apple-text-primary)`, `var(--apple-surface)`, etc.) para garantizar la compatibilidad perfecta con el Modo Oscuro.
2. **Respeto a los Radios de Borde:** Usa variables de squircle (`--apple-radius-md`, `--apple-radius-xl`, `--apple-radius-pill`) para mantener la armonía curvilínea en toda la plataforma.
3. **Animaciones con Física Spring:** Toda transición interactiva debe usar `var(--apple-transition-fast)` o `var(--apple-transition-normal)`.
4. **Accesibilidad y Contraste:** Asegura que los textos sobre fondos translúcidos mantengan un ratio de contraste mínimo de 4.5:1 (WCAG AA).
