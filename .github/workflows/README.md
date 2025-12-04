# GitHub Actions - Automatización del Scraper

El scraper está configurado con **9 workflows independientes**, uno para cada período académico. Cada workflow procesa un solo período de forma independiente para evitar timeouts.

## Cómo Funciona

- **Ejecución automática**: Todos los días con escalonamiento de 30 minutos entre cada período
- **Timeout**: 45 minutos por período
- **Ejecución independiente**: Si un período falla, los demás no se afectan

### Workflows por Período

- `scraper-2026-1.yml` - Período 2026-1
- `scraper-2025-2.yml` - Período 2025-2
- `scraper-2025-1.yml` - Período 2025-1
- `scraper-2024-2.yml` - Período 2024-2
- `scraper-2024-1.yml` - Período 2024-1
- `scraper-2023-2.yml` - Período 2023-2
- `scraper-2023-1.yml` - Período 2023-1
- `scraper-2022-2.yml` - Período 2022-2
- `scraper-2022-1.yml` - Período 2022-1

## Configuración Requerida

Configura los siguientes secrets en **Settings → Secrets and variables → Actions → Secrets**:

- `GOOGLE_CREDENTIALS`: JSON completo del service account de Google Cloud
- `SHEET_URL_SOURCE`: URL de la hoja con las cédulas
- `SHEET_URL_TARGET`: URL de la hoja donde se escribirán los datos

**Importante**: Comparte las hojas de Google Sheets con el email del service account y otorga permisos de **Editor**.

## Ejecución

### Automática

Los workflows se ejecutan automáticamente todos los días según el horario configurado en cada workflow.

### Manual

1. Ve a **Actions** en tu repositorio de GitHub
2. Selecciona el workflow del período deseado
3. Click en **Run workflow**
4. (Opcional) Ajusta los parámetros si es necesario
5. Click en **Run workflow**

## Ver Resultados

1. Ve a **Actions** en tu repositorio
2. Click en la ejecución que quieres revisar
3. Explora los logs de cada step
4. Si hay errores, descarga los artifacts con los logs completos
