# Guía de Instalación - Scraper Univalle

## Requisitos Previos

1. **Python 3.8+** instalado
2. **Cuenta de Google Cloud** con acceso a Google Sheets API
3. **Acceso al portal Univalle** (no requiere autenticación actualmente)

## Paso 1: Clonar/Preparar el Proyecto

Asegúrate de tener todos los archivos del scraper en el directorio `scraper/`.

## Paso 2: Instalar Dependencias

```bash
cd scraper
pip install -r requirements.txt
```

O si usas un entorno virtual (recomendado):

**Linux/Mac:**
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Windows PowerShell:**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Windows CMD:**
```cmd
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
```

**Nota para Windows:** Si tienes problemas, consulta `INSTALACION_WINDOWS.md` para una guía detallada.

## Paso 3: Configurar Google Cloud

### 3.1 Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el ID del proyecto

### 3.2 Habilitar APIs

1. Ve a "APIs & Services" > "Library"
2. Busca y habilita:
   - **Google Sheets API**
   - **Google Drive API**

### 3.3 Crear Cuenta de Servicio

1. Ve a "APIs & Services" > "Credentials"
2. Click en "Create Credentials" > "Service Account"
3. Completa:
   - **Name**: `scraper-univalle` (o el nombre que prefieras)
   - **ID**: Se genera automáticamente
   - **Description**: Opcional
4. Click en "Create and Continue"
5. Opcionalmente asigna roles (no necesario para uso básico)
6. Click en "Done"

### 3.4 Crear y Descargar Clave JSON

1. En la lista de cuentas de servicio, click en la cuenta que acabas de crear
2. Ve a la pestaña "Keys"
3. Click en "Add Key" > "Create new key"
4. Selecciona "JSON"
5. Click en "Create"
6. Se descargará un archivo JSON (guárdalo como `credentials.json` en la raíz del proyecto)

### 3.5 Compartir Hoja de Cálculo

1. Abre la hoja de cálculo de Google Sheets donde quieres guardar los datos
2. Click en "Share" (Compartir)
3. Agrega el email de la cuenta de servicio (está en el JSON: `client_email`)
4. Dale permisos de "Editor"
5. Copia el ID de la hoja desde la URL:
   ```
   https://docs.google.com/spreadsheets/d/ID_AQUI/edit
   ```

## Paso 4: Configurar Variables de Entorno

1. Copia el archivo de ejemplo:

```bash
cp env.example .env
```

2. Edita `.env` con tus valores:

```env
# ID de la hoja de cálculo (copiado en paso 3.5)
GOOGLE_SHEETS_SPREADSHEET_ID=tu_id_aqui

# Ruta al archivo JSON de credenciales
GOOGLE_SHEETS_CREDENTIALS_PATH=credentials.json

# Cookies opcionales (pueden dejarse vacías)
COOKIE_PHPSESSID=
COOKIE_ASIGACAD=

# Configuración de logging
LOG_LEVEL=INFO
LOG_FILE=scraper.log

# Número de períodos a procesar por defecto
DEFAULT_PERIODOS_COUNT=8
```

## Paso 5: Verificar Instalación

Prueba la conexión con Google Sheets:

```bash
python -c "from scraper.services.sheets_service import SheetsService; s = SheetsService(); print('Conectado a:', s.spreadsheet.title)"
```

Si hay errores, verifica:
- Que el archivo `credentials.json` existe
- Que el email de la cuenta de servicio tiene acceso a la hoja
- Que las APIs están habilitadas en Google Cloud

## Paso 6: Probar el Scraper

### Crear estructura de hojas:

```bash
python -m scraper.main --crear-hojas --periodos 8
```

### Probar con un docente:

```bash
python -m scraper.main --cedula 1112966620 --periodos 2
```

Esto debería:
1. Obtener los últimos 2 períodos desde el portal
2. Scrapear los datos del docente
3. Guardar los datos en las hojas correspondientes

## Solución de Problemas

### Error: "FileNotFoundError: credentials.json"

- Verifica que el archivo existe en la raíz del proyecto
- Verifica la ruta en `.env`

### Error: "Permission denied" o "Access denied"

- Verifica que la cuenta de servicio tiene acceso a la hoja
- Verifica que las APIs están habilitadas

### Error: "Invalid spreadsheet ID"

- Verifica que el ID en `.env` es correcto
- El ID está en la URL de la hoja

### Error: "Connection timeout"

- Verifica tu conexión a internet
- El portal puede estar lento, aumenta `REQUEST_TIMEOUT` en `.env`

### Error: "Cédula inválida"

- Verifica que la cédula tiene 7-10 dígitos
- No incluyas puntos ni guiones

## Siguiente Paso

Una vez instalado, lee:
- `README.md` para uso básico
- `ESTRUCTURA.md` para entender la arquitectura
- `../docs/SCRAPING_UNIVALLE_PYTHON.md` para detalles técnicos del scraping

## Soporte

Para problemas o preguntas:
1. Revisa los logs en `scraper.log`
2. Verifica la configuración en `.env`
3. Revisa la documentación en `docs/`

