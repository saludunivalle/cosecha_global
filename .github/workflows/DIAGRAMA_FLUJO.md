# Diagrama de Flujo del Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    TRIGGER                                  │
├─────────────────────────────────────────────────────────────┤
│  • Cron: 3:00 AM COT (8:00 AM UTC) diario                  │
│  • Manual: workflow_dispatch desde GitHub UI                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: Checkout Repository                    │
│  • Clona el repositorio                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 2: Setup Python 3.11                      │
│  • Instala Python 3.11                                      │
│  • Habilita cache de pip                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 3: Install Dependencies                   │
│  • pip install -r scraper/requirements.txt                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 4: Create credentials.json                │
│  • Lee secret GOOGLE_CREDENTIALS                            │
│  • Crea credentials.json                                     │
│  • Valida que sea JSON válido                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 5: Validate Required Secrets              │
│  • Verifica SHEET_URL_SOURCE                                │
│  • Verifica SHEET_URL_TARGET                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 6: Run Scraper                            │
│  • python scraper/main.py --modo completo                   │
│  • Usa variables de entorno configuradas                    │
│  • Continúa aunque falle (continue-on-error)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐           ┌───────────────────┐
│   SUCCESS     │           │     FAILURE       │
└───────┬───────┘           └─────────┬─────────┘
        │                             │
        │                             ▼
        │                  ┌──────────────────────────┐
        │                  │ Upload Logs as Artifact  │
        │                  │ • scraper.log            │
        │                  │ • Retention: 7 days      │
        │                  └────────────┬─────────────┘
        │                               │
        │                               ▼
        │                  ┌──────────────────────────┐
        │                  │ Show Error Summary       │
        │                  │ • Last 50 log lines      │
        │                  └────────────┬─────────────┘
        │                               │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │     STEP 7: Cleanup           │
        │  • Remove credentials.json    │
        │  • Always runs (if: always)   │
        └───────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐           ┌───────────────────┐
│ Success       │           │ Show Error        │
│ Summary       │           │ Message           │
│ • Log summary │           │ Exit with code 1  │
└───────────────┘           └───────────────────┘
```

## Variables de Entorno Usadas

```
┌────────────────────────────────────────────────────────────┐
│                    ENVIRONMENT VARIABLES                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  REQUERIDAS (Secrets):                                     │
│  • GOOGLE_CREDENTIALS          → JSON del service account  │
│  • SHEET_URL_SOURCE            → URL hoja con cédulas      │
│  • SHEET_URL_TARGET            → URL hoja destino          │
│                                                            │
│  OPCIONALES (Secrets):                                     │
│  • GOOGLE_SHEETS_SPREADSHEET_ID → ID de hoja por defecto   │
│  • COOKIE_PHPSESSID             → Cookie PHP session       │
│  • COOKIE_ASIGACAD              → Cookie adicional         │
│                                                            │
│  OPCIONALES (Variables):                                   │
│  • UNIVALLE_BASE_URL            → URL base del portal      │
│  • REQUEST_TIMEOUT              → Timeout en segundos      │
│  • REQUEST_MAX_RETRIES          → Máximo reintentos        │
│  • REQUEST_RETRY_DELAY          → Delay entre reintentos   │
│  • DEFAULT_PERIODOS_COUNT       → Número de períodos       │
│                                                            │
│  FIJAS:                                                    │
│  • GOOGLE_SHEETS_CREDENTIALS_PATH → credentials.json       │
│  • LOG_LEVEL                      → INFO                   │
│  • LOG_FILE                       → scraper.log            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Inputs del Workflow Dispatch

Cuando se ejecuta manualmente, se pueden pasar estos parámetros:

- `current_period`: Período actual (default: `2026-1`)
- `n_periodos`: Número de períodos anteriores (default: `8`)
- `source_worksheet`: Hoja fuente (default: `2025-2`)
- `source_column`: Columna de cédulas (default: `D`)
- `delay_cedulas`: Delay entre cédulas en segundos (default: `1.0`)

## Timeout y Límites

- **Timeout total**: 60 minutos
- **Retención de artifacts**: 7 días
- **Retries automáticos**: Configurables vía variables

