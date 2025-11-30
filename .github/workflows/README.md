# Configuración del Workflow de GitHub Actions

Este documento explica cómo configurar el workflow de GitHub Actions para ejecutar el scraper automáticamente.

## Descripción del Workflow

El workflow `scraper.yml` ejecuta el scraper de Univalle automáticamente:

- **Trigger automático**: Todos los días a las 3:00 AM hora Colombia (8:00 AM UTC)
- **Trigger manual**: Puede ejecutarse manualmente desde la pestaña "Actions" de GitHub
- **Timeout**: 60 minutos
- **Logs**: Se guardan como artifacts si hay errores

## Configuración de Secrets

### Secrets Requeridos

Configura los siguientes secrets en tu repositorio de GitHub:

**Settings → Secrets and variables → Actions → Secrets**

#### 1. `GOOGLE_CREDENTIALS` (Requerido)

JSON completo de las credenciales del service account de Google Cloud.

**Cómo obtenerlo:**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea o selecciona un proyecto
3. Habilita la API de Google Sheets y Google Drive
4. Crea un Service Account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Dale un nombre descriptivo (ej: "github-actions-scraper")
   - Crea y descarga una clave JSON
5. Copia el contenido completo del archivo JSON
6. Pega todo el contenido en el secret `GOOGLE_CREDENTIALS`

**Ejemplo del formato:**
```json
{
  "type": "service_account",
  "project_id": "tu-proyecto",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "nombre@proyecto.iam.gserviceaccount.com",
  ...
}
```

⚠️ **IMPORTANTE**: 
- Copia TODO el contenido del archivo JSON (incluyendo las llaves `{}`)
- No incluyas saltos de línea extra
- Comparte las hojas de Google Sheets con el email del service account

#### 2. `SHEET_URL_SOURCE` (Requerido)

URL completa de la hoja de Google Sheets que contiene las cédulas.

**Formato:**
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

o simplemente:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID
```

Asegúrate de que:
- La hoja sea accesible por el service account (compartir con el email del service account)
- La hoja tenga la columna con las cédulas (por defecto columna D)

#### 3. `SHEET_URL_TARGET` (Requerido)

URL completa de la hoja de Google Sheets donde se escribirán los datos scrapeados.

**Formato:**
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

Asegúrate de que:
- La hoja sea accesible por el service account (compartir con el email del service account)
- Tenga permisos de escritura para el service account

### Secrets Opcionales

#### `GOOGLE_SHEETS_SPREADSHEET_ID` (Opcional)

ID de la hoja por defecto. Se puede extraer de la URL:

```
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
```

Si usas URLs directamente en los comandos, este secret puede estar vacío.

#### `COOKIE_PHPSESSID` (Opcional)

Cookie de sesión PHP si es necesaria para acceder al portal de Univalle.

#### `COOKIE_ASIGACAD` (Opcional)

Cookie adicional si es necesaria para acceder al portal de Univalle.

## Configuración de Variables

Variables opcionales (pueden configurarse en **Settings → Secrets and variables → Actions → Variables**):

### Variables Opcionales

- `UNIVALLE_BASE_URL`: URL base del portal (default: `https://proxse26.univalle.edu.co/asignacion`)
- `REQUEST_TIMEOUT`: Timeout de requests en segundos (default: `30`)
- `REQUEST_MAX_RETRIES`: Número máximo de reintentos (default: `3`)
- `REQUEST_RETRY_DELAY`: Delay entre reintentos en segundos (default: `2`)
- `DEFAULT_PERIODOS_COUNT`: Número de períodos a procesar (default: `8`)

## Cómo Configurar los Secrets

### Método 1: Desde la Interfaz Web de GitHub

1. Ve a tu repositorio en GitHub
2. Click en **Settings** (Configuración)
3. En el menú lateral, click en **Secrets and variables** → **Actions**
4. Click en **New repository secret**
5. Ingresa el nombre del secret y su valor
6. Click en **Add secret**

### Método 2: Desde la CLI de GitHub

```bash
# Instalar GitHub CLI si no lo tienes
# https://cli.github.com/

# Autenticarte
gh auth login

# Configurar secrets
gh secret set GOOGLE_CREDENTIALS < credentials.json
gh secret set SHEET_URL_SOURCE --body "https://docs.google.com/spreadsheets/d/TU_ID"
gh secret set SHEET_URL_TARGET --body "https://docs.google.com/spreadsheets/d/TU_ID"
```

## Permisos Necesarios del Service Account

El service account necesita los siguientes permisos:

### En Google Sheets API

- Lectura y escritura en las hojas compartidas

### Permisos en las Hojas de Google Sheets

1. Abre cada hoja de Google Sheets (source y target)
2. Click en el botón **Compartir** (Share)
3. Ingresa el email del service account (ej: `nombre@proyecto.iam.gserviceaccount.com`)
4. Otorga el rol:
   - **Editor** para la hoja target (necesita escribir)
   - **Editor** o **Lector** para la hoja source (necesita leer)

## Ejecutar el Workflow

### Ejecución Automática

El workflow se ejecuta automáticamente todos los días a las 3:00 AM hora Colombia (8:00 AM UTC).

### Ejecución Manual

1. Ve a la pestaña **Actions** en tu repositorio de GitHub
2. Selecciona el workflow **Ejecutar Scraper Univalle** en el menú lateral
3. Click en **Run workflow**
4. (Opcional) Modifica los parámetros:
   - Período actual (default: `2026-1`)
   - Número de períodos (default: `8`)
   - Hoja fuente (default: `2025-2`)
   - Columna de cédulas (default: `D`)
   - Delay entre cédulas (default: `1.0`)
5. Click en **Run workflow**

## Ver los Resultados

### Ver Logs de Ejecución

1. Ve a **Actions** en tu repositorio
2. Click en la ejecución que quieres revisar
3. Click en el job **scrape**
4. Explora los logs de cada step

### Descargar Logs (si hay errores)

Si el workflow falla:

1. Ve a la ejecución fallida
2. En la sección **Artifacts**, encontrarás `scraper-logs-XXXX`
3. Descarga el artifact para revisar los logs completos

## Troubleshooting

### Error: "Secret GOOGLE_CREDENTIALS no está configurado"

- Verifica que el secret esté configurado correctamente
- Asegúrate de copiar TODO el contenido del JSON
- Verifica que no haya espacios extras al principio o final

### Error: "credentials.json no se pudo crear o está vacío"

- El JSON del secret podría estar mal formateado
- Verifica que el secret contenga el JSON completo
- Revisa que no haya caracteres especiales que necesiten escaparse

### Error: "Permission denied" al acceder a Google Sheets

- Verifica que el service account tenga acceso a las hojas
- Asegúrate de compartir las hojas con el email del service account
- Verifica que las URLs sean correctas

### Error: "No se encontraron cédulas"

- Verifica que la hoja source tenga datos
- Confirma que la columna especificada contiene las cédulas
- Verifica que el nombre de la hoja (worksheet) sea correcto

### El workflow tarda mucho tiempo

- Aumenta el `timeout-minutes` en el workflow si es necesario
- Considera reducir el número de períodos si no necesitas todos
- Revisa si hay problemas de red o rate limiting

## Cambiar la Hora de Ejecución

Para cambiar la hora del cron, edita la línea en `.github/workflows/scraper.yml`:

```yaml
schedule:
  - cron: '0 8 * * *'  # 8:00 AM UTC = 3:00 AM COT
```

**Formato cron:**
- `minuto hora día mes día-semana`
- Usa [crontab.guru](https://crontab.guru/) para generar expresiones cron

**Ejemplos:**
- `0 8 * * *` - 8:00 AM UTC todos los días (3:00 AM COT)
- `0 12 * * 1` - 12:00 PM UTC todos los lunes (7:00 AM COT lunes)
- `0 */6 * * *` - Cada 6 horas

## Notificaciones (Futuro)

El workflow puede extenderse para enviar notificaciones:

- Email cuando el workflow falla
- Slack webhook
- Discord webhook
- GitHub Issues automáticos

## Seguridad

⚠️ **IMPORTANTE:**

- Los secrets nunca se exponen en los logs
- El archivo `credentials.json` se elimina automáticamente después de la ejecución
- Los artifacts con credenciales se eliminan después de 7 días
- No compartas los secrets públicamente

## Referencias

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Google Service Account Documentation](https://cloud.google.com/iam/docs/service-accounts)
- [Google Sheets API](https://developers.google.com/sheets/api)

