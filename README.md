# Sistema de Gestión de Asignaciones Académicas

Sistema para la gestión y consulta de asignaciones académicas de docentes de la Universidad del Valle.

## 🎯 Funcionalidades

### 1. Aplicativo Web
- Búsqueda de docentes por cédula
- Visualización de asignaciones académicas
- Consulta de múltiples períodos académicos
- Vistas organizadas por período o por actividad

### 2. Sistema de Cosecha (Scraper)
- Extracción automática de datos desde el portal Univalle
- Procesamiento por período individual (arquitectura optimizada)
- Escritura de datos en Google Sheets
- Ejecución automática escalonada vía GitHub Actions
- Procesamiento independiente por período para evitar timeouts

## 📁 Estructura del Proyecto

```
cosecha_global/
├── src/
│   ├── web/              # Aplicativo web (Next.js/React)
│   ├── harvest/          # Sistema de cosecha de datos
│   ├── shared/           # Código compartido
│   └── api/              # API Backend
├── scraper/              # Scraper de datos académicos
│   ├── main.py           # Orquestador principal
│   ├── services/         # Servicios (scraper, sheets, period_manager)
│   ├── config/           # Configuración
│   └── utils/            # Utilidades
├── .github/workflows/    # GitHub Actions workflows
│   ├── scraper-2026-1.yml
│   ├── scraper-2025-2.yml
│   └── ... (9 workflows por período)
├── docs/                 # Documentación
├── scripts/              # Scripts de utilidad
├── public/               # Archivos estáticos
└── legacy/               # Código legacy de Apps Script
```

Ver [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md) para más detalles.

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+ 
- npm o yarn

### Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp env.example.txt .env
# Editar .env con tus credenciales
# Ver docs/CONFIGURACION_GOOGLE_SHEETS.md para configurar Google Sheets API

# Ejecutar en desarrollo
npm run dev
```

### Desarrollo

```bash
# Aplicativo web
npm run dev

# Sistema de cosecha (si se ejecuta independientemente)
npm run harvest
```

## 📚 Documentación

- [Documentación Completa](./docs/DOCUMENTACION_APLICATIVO.md)
- [Instrucciones del Aplicativo Web](./docs/Intrucciones_AsignacionesAcademicas.md)
- [Configuración de Google Sheets API](./docs/CONFIGURACION_GOOGLE_SHEETS.md)
- [Configuración de Cookies](./docs/CONFIGURACION_COOKIES.md)
- [Estructura del Proyecto](./ESTRUCTURA_PROYECTO.md)

## 🔧 Configuración

### Aplicativo Web
- Ver `env.example.txt` para las variables de entorno necesarias
- Ver [Configuración de Google Sheets API](./docs/CONFIGURACION_GOOGLE_SHEETS.md) para configurar la cuenta de servicio

### Scraper

El scraper procesa **un período a la vez** para optimizar el tiempo de ejecución y evitar timeouts.

#### Variables de Entorno Requeridas

```bash
# Credenciales de Google Sheets (JSON como string)
GOOGLE_CREDENTIALS='{"type":"service_account",...}'

# URLs de las hojas de Google Sheets
SHEET_URL_SOURCE="https://docs.google.com/spreadsheets/d/..."
SHEET_URL_TARGET="https://docs.google.com/spreadsheets/d/..."

# Período objetivo a procesar (formato: YYYY-T, ej: "2026-1")
TARGET_PERIOD="2026-1"
```

#### Variables Opcionales

```bash
# Configuración del scraper
UNIVALLE_BASE_URL="https://proxse26.univalle.edu.co/asignacion"
REQUEST_TIMEOUT="30"
REQUEST_MAX_RETRIES="3"
REQUEST_RETRY_DELAY="2"

# Cookies opcionales (si se requieren)
COOKIE_PHPSESSID=""
COOKIE_ASIGACAD=""

# Logging
LOG_LEVEL="INFO"
LOG_FILE="scraper.log"
```

#### Ejecución Local

Para ejecutar el scraper localmente para un período específico:

```bash
# 1. Configurar variables de entorno
export GOOGLE_CREDENTIALS='{"type":"service_account",...}'
export SHEET_URL_SOURCE="https://docs.google.com/spreadsheets/d/..."
export SHEET_URL_TARGET="https://docs.google.com/spreadsheets/d/..."
export TARGET_PERIOD="2026-1"

# 2. Instalar dependencias
cd scraper
pip install -r requirements.txt

# 3. Ejecutar scraper
python main.py --modo completo \
  --source-sheet-url "$SHEET_URL_SOURCE" \
  --target-sheet-url "$SHEET_URL_TARGET" \
  --target-period "$TARGET_PERIOD" \
  --source-worksheet "2025-2" \
  --source-column "D" \
  --delay-cedulas 1.0
```

O usando solo la variable de entorno:

```bash
export TARGET_PERIOD="2026-1"
python scraper/main.py --modo completo
```

## 🤖 GitHub Actions - Automatización del Scraper

El scraper está configurado con **9 workflows independientes**, uno para cada período académico.

### Arquitectura de Workflows

Cada workflow procesa **un solo período** de forma independiente:

- `scraper-2026-1.yml` - Período 2026-1
- `scraper-2025-2.yml` - Período 2025-2
- `scraper-2025-1.yml` - Período 2025-1
- `scraper-2024-2.yml` - Período 2024-2
- `scraper-2024-1.yml` - Período 2024-1
- `scraper-2023-2.yml` - Período 2023-2
- `scraper-2023-1.yml` - Período 2023-1
- `scraper-2022-2.yml` - Período 2022-2
- `scraper-2022-1.yml` - Período 2022-1

### Ejecución Automática

Los workflows se ejecutan automáticamente todos los días con un **escalonamiento de 30 minutos** entre cada uno:

| Período | Hora Colombia (COT) | Hora UTC | Cron Schedule |
|---------|---------------------|----------|---------------|
| 2026-1  | 3:00 AM            | 8:00 AM  | `0 8 * * *`   |
| 2025-2  | 3:30 AM            | 8:30 AM  | `30 8 * * *`  |
| 2025-1  | 4:00 AM            | 9:00 AM  | `0 9 * * *`   |
| 2024-2  | 4:30 AM            | 9:30 AM  | `30 9 * * *`  |
| 2024-1  | 5:00 AM            | 10:00 AM | `0 10 * * *`  |
| 2023-2  | 5:30 AM            | 10:30 AM | `30 10 * * *` |
| 2023-1  | 6:00 AM            | 11:00 AM | `0 11 * * *`  |
| 2022-2  | 6:30 AM            | 11:30 AM | `30 11 * * *` |
| 2022-1  | 7:00 AM            | 12:00 PM | `0 12 * * *`  |

**Tiempo total**: Aproximadamente 4.5 horas para procesar todos los períodos (9 períodos × 30 min de separación)

### Ejecución Manual

Para ejecutar manualmente un período específico:

1. Ve a **Actions** en GitHub
2. Selecciona el workflow del período deseado (ej: "Scraper - Periodo 2026-1")
3. Haz clic en **Run workflow**
4. Opcionalmente ajusta los parámetros:
   - `source_worksheet`: Hoja fuente (default: "2025-2")
   - `source_column`: Columna de cédulas (default: "D")
   - `delay_cedulas`: Delay entre cédulas en segundos (default: "1.0")

### Ventajas de la Arquitectura por Período

✅ **Sin timeouts**: Cada workflow tiene timeout de 45 minutos (suficiente para un período)  
✅ **Ejecución independiente**: Si un período falla, los demás no se afectan  
✅ **Fácil troubleshooting**: Logs y artifacts específicos por período  
✅ **Re-ejecución selectiva**: Solo se re-ejecuta el período que falló  
✅ **Escalonamiento**: Evita sobrecarga del sistema ejecutando en paralelo

### Troubleshooting

#### Si un período falla:

1. **Re-ejecutar solo ese workflow**:
   - Ve a Actions > Selecciona el workflow del período que falló
   - Haz clic en "Re-run jobs" o "Run workflow"

2. **Revisar logs**:
   - Los logs se suben automáticamente como artifacts si hay errores
   - Nombre del artifact: `scraper-logs-{PERIODO}-{RUN_NUMBER}-{ATTEMPT}`

3. **Verificar configuración**:
   - Asegúrate de que los secrets estén configurados:
     - `GOOGLE_CREDENTIALS`
     - `SHEET_URL_SOURCE`
     - `SHEET_URL_TARGET`

4. **Los demás períodos no se afectan**:
   - Cada workflow es completamente independiente
   - Un fallo en un período no afecta la ejecución de los otros

## 📝 Notas

- ✅ **El aplicativo web funciona sin necesidad de autenticación con cookies** - El portal Univalle permite acceso público
- ✅ **Migración completada**: `findDocentByPhone.html` y `searchState.gs` migrados a Next.js/React
- ✅ **Web scraping funcional**: Extracción directa de datos desde el portal
- ✅ **Scraper optimizado**: Procesamiento por período individual para evitar timeouts
- El sistema de cosecha requiere configuración de Google Sheets API
- Los archivos legacy se mantienen en `legacy/` como referencia

## 🆕 Cambios Recientes (Enero 2025)

### Migración a Next.js/React
- ✅ Migrado `findDocentByPhone.html` → Componentes React en `src/web/components/`
- ✅ Migrado `searchState.gs` → Servicios TypeScript en `src/web/lib/`
- ✅ API Routes creadas en `app/api/` para períodos y docentes
- ✅ Web scraping funcional sin requerir cookies de autenticación
- ✅ Parser HTML mejorado con mejor detección de errores
- ✅ Procesamiento en paralelo de múltiples períodos

### Refactorización del Scraper (Enero 2025)
- ✅ **Arquitectura por período individual**: Cada período se procesa de forma independiente
- ✅ **9 workflows independientes**: Un workflow por cada período académico
- ✅ **Ejecución escalonada**: 30 minutos entre cada workflow para evitar sobrecarga
- ✅ **Timeout optimizado**: 45 minutos por período (vs 60 minutos anterior)
- ✅ **Re-ejecución selectiva**: Solo se re-ejecuta el período que falla
- ✅ **Variables de entorno simplificadas**: `TARGET_PERIOD` para especificar el período objetivo

### Funcionalidades Implementadas
- Búsqueda de docentes por cédula
- Visualización por período y por actividad
- Extracción de datos desde portal Univalle
- Procesamiento de múltiples períodos en paralelo
- Interfaz responsive con Bootstrap
- Scraper automatizado con GitHub Actions

## 📄 Licencia

ISC

