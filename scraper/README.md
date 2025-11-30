# Scraper Univalle

Scraper para extraer datos académicos del portal Univalle (`vin_asignacion.php3`).

## Estructura

```
/scraper
  /config
    - settings.py          # Configuración de URLs, credenciales
  /services
    - univalle_scraper.py  # Lógica de scraping
    - sheets_service.py    # Manejo de Google Sheets
    - period_manager.py    # Gestión de períodos
  /utils
    - helpers.py           # Funciones auxiliares
  - main.py                # Orquestador principal
  - requirements.txt       # Dependencias
  - .env.example          # Ejemplo de variables de entorno
```

## Instalación

1. Instalar dependencias:

```bash
pip install -r requirements.txt
```

2. Configurar variables de entorno:

Copiar `.env.example` a `.env` y completar con tus credenciales:

```bash
cp .env.example .env
```

Editar `.env` con:
- `GOOGLE_SHEETS_CREDENTIALS_PATH`: Ruta al archivo JSON de credenciales de Google
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID de la hoja de cálculo de Google Sheets

3. Configurar credenciales de Google Sheets:

- Crear un proyecto en Google Cloud Console
- Habilitar Google Sheets API y Google Drive API
- Crear una cuenta de servicio y descargar el JSON de credenciales
- Guardar el JSON como `credentials.json` en la raíz del proyecto

## Uso

### Procesar un docente

```bash
python -m scraper.main --cedula 1112966620 --periodos 8
```

### Crear estructura de hojas

```bash
python -m scraper.main --crear-hojas --periodos 8
```

### Limpiar hojas existentes

```bash
python -m scraper.main --limpiar-hojas --periodos 8
```

### Procesar múltiples docentes desde archivo

Crear archivo `cedulas.txt` con una cédula por línea:

```
1112966620
1234567890
9876543210
```

Ejecutar:

```bash
python -m scraper.main --cedulas-archivo cedulas.txt --periodos 8
```

## Opciones de línea de comandos

- `--cedula`: Cédula del docente a procesar
- `--periodos`: Número de períodos a procesar (default: 8)
- `--crear-hojas`: Crear estructura de hojas antes de procesar
- `--limpiar-hojas`: Limpiar hojas existentes antes de procesar
- `--cedulas-archivo`: Ruta a archivo con lista de cédulas

## Variables de entorno

Ver `.env.example` para todas las variables disponibles.

Principales:
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID de la hoja de cálculo (requerido)
- `GOOGLE_SHEETS_CREDENTIALS_PATH`: Ruta al archivo de credenciales (requerido)
- `LOG_LEVEL`: Nivel de logging (INFO, DEBUG, WARNING, ERROR)
- `REQUEST_TIMEOUT`: Timeout de peticiones HTTP en segundos

## Logging

Los logs se guardan en `scraper.log` y también se muestran en consola.

Para cambiar el nivel de logging, editar `LOG_LEVEL` en `.env`.

## Manejo de errores

El scraper incluye:
- Reintentos automáticos para peticiones HTTP
- Validación de datos antes de procesar
- Manejo robusto de errores con logging detallado
- Continuación en caso de error en un período específico

