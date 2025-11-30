# Estructura del Scraper Univalle

## Descripción General

Este scraper está diseñado para extraer datos académicos del portal Univalle y almacenarlos en Google Sheets. Está basado en la lógica documentada en `docs/SCRAPING_UNIVALLE_PYTHON.md`.

## Arquitectura

```
/scraper
  /config
    - __init__.py
    - settings.py              # Configuración centralizada

  /services
    - __init__.py
    - univalle_scraper.py      # Lógica principal de scraping
    - sheets_service.py        # Integración con Google Sheets
    - period_manager.py        # Gestión de períodos académicos

  /utils
    - __init__.py
    - helpers.py               # Funciones auxiliares

  - __init__.py
  - main.py                    # Punto de entrada principal
  - requirements.txt           # Dependencias Python
  - env.example               # Ejemplo de variables de entorno
  - README.md                 # Documentación de uso
  - ESTRUCTURA.md             # Este archivo
```

## Módulos

### 1. config/settings.py

**Propósito**: Centralizar toda la configuración del scraper.

**Características**:
- Carga variables de entorno desde archivo `.env`
- URLs del portal Univalle
- Configuración de Google Sheets
- Cookies opcionales
- Timeouts y reintentos
- Configuración de logging
- Validación de configuración requerida

**Variables principales**:
- `UNIVALLE_BASE_URL`: URL base del portal
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID de la hoja de cálculo
- `GOOGLE_SHEETS_CREDENTIALS_PATH`: Ruta a credenciales JSON
- `LOG_LEVEL`: Nivel de logging

### 2. services/univalle_scraper.py

**Propósito**: Implementa toda la lógica de scraping del portal Univalle.

**Características**:
- Extracción de HTML con manejo de codificación ISO-8859-1
- Manejo de framesets
- Parseo de tablas HTML usando regex
- Extracción de información personal
- Extracción de actividades (pregrado, postgrado, investigación, etc.)
- Clasificación automática pregrado/postgrado
- Deduplicación de actividades
- Obtención de períodos disponibles

**Clases principales**:
- `InformacionPersonal`: Dataclass para información del docente
- `ActividadAsignatura`: Dataclass para actividades de docencia
- `ActividadInvestigacion`: Dataclass para actividades de investigación
- `DatosDocente`: Dataclass para datos completos de un período
- `UnivalleScraper`: Clase principal con toda la lógica

**Métodos clave**:
- `obtener_html()`: Realiza la petición HTTP
- `procesar_docente()`: Procesa un docente completo
- `extraer_tablas()`: Extrae todas las tablas del HTML
- `extraer_celdas()`: Extrae celdas manejando colspan
- `_es_postgrado()`: Clasifica actividades

### 3. services/sheets_service.py

**Propósito**: Maneja todas las interacciones con Google Sheets.

**Características**:
- Autenticación con Google Sheets API
- Creación y gestión de hojas
- Agregar/actualizar filas
- Limpieza de hojas
- Formateo de hojas
- Búsqueda de datos
- Sanitización de valores

**Clases principales**:
- `SheetsService`: Clase principal con métodos de Sheets

**Métodos clave**:
- `crear_hoja()`: Crea una hoja con headers
- `agregar_fila()`: Agrega una fila
- `agregar_filas()`: Agrega múltiples filas (batch)
- `limpiar_hoja()`: Limpia contenido de hoja
- `buscar_fila_por_cedula()`: Busca docente por cédula

### 4. services/period_manager.py

**Propósito**: Gestiona los períodos académicos.

**Características**:
- Obtener últimos N períodos desde el portal
- Crear estructura de hojas para períodos
- Limpiar hojas de períodos
- Validación de períodos
- Normalización de nombres de hojas

**Clases principales**:
- `PeriodManager`: Clase principal para gestión de períodos

**Métodos clave**:
- `obtener_ultimos_n_periodos()`: Obtiene períodos desde portal
- `crear_hojas_periodos()`: Crea estructura completa de hojas
- `limpiar_hojas_periodos()`: Limpia todas las hojas

### 5. utils/helpers.py

**Propósito**: Funciones auxiliares reutilizables.

**Funciones principales**:
- `validar_cedula()`: Valida formato de cédula colombiana
- `limpiar_cedula()`: Limpia cédula (remueve espacios, puntos)
- `normalizar_texto()`: Normaliza texto
- `formatear_nombre_completo()`: Combina nombre y apellidos
- `parsear_horas()`: Parsea string de horas a float
- `generar_id_actividad()`: Genera ID único para actividad
- `deduplicar_actividades()`: Elimina duplicados
- `sanitizar_valor_hoja()`: Sanitiza valores para Sheets
- `parsear_periodo_label()`: Parsea label de período

### 6. main.py

**Propósito**: Orquestador principal del scraper.

**Características**:
- Configuración de logging
- Validación de configuración
- Inicialización de servicios
- Procesamiento de docentes (individual o masivo)
- Creación/limpieza de estructura de hojas
- Manejo de errores robusto
- CLI con argparse

**Funciones principales**:
- `main()`: Función principal
- `procesar_docente()`: Procesa un docente para múltiples períodos
- `guardar_datos_en_sheets()`: Guarda datos en Sheets
- `crear_estructura_hojas()`: Crea estructura completa

**Argumentos de línea de comandos**:
- `--cedula`: Cédula del docente
- `--periodos`: Número de períodos (default: 8)
- `--crear-hojas`: Crear estructura de hojas
- `--limpiar-hojas`: Limpiar hojas existentes
- `--cedulas-archivo`: Archivo con lista de cédulas

## Flujo de Ejecución

1. **Inicialización**:
   - Cargar configuración desde `.env`
   - Validar configuración requerida
   - Configurar logging
   - Inicializar servicios (Scraper, Sheets, PeriodManager)

2. **Preparación**:
   - Obtener períodos disponibles desde portal
   - Crear/limpiar estructura de hojas (si se solicita)

3. **Procesamiento**:
   - Para cada cédula:
     - Para cada período:
       - Obtener HTML del portal
       - Parsear HTML y extraer datos
       - Guardar datos en Sheets

4. **Finalización**:
   - Logging de resultados
   - Manejo de errores
   - Reporte de estadísticas

## Logging

El scraper usa logging estándar de Python con:
- **Archivo**: `scraper.log`
- **Consola**: Salida estándar
- **Niveles**: DEBUG, INFO, WARNING, ERROR

Configuración en `.env`:
- `LOG_LEVEL`: Nivel mínimo de logging
- `LOG_FORMAT`: Formato de mensajes
- `LOG_FILE`: Nombre del archivo de log

## Manejo de Errores

- **Reintentos HTTP**: Configurable con `REQUEST_MAX_RETRIES`
- **Timeouts**: Configurable con `REQUEST_TIMEOUT`
- **Validación**: Validación de cédulas, períodos, configuración
- **Logging detallado**: Todos los errores se registran con traceback
- **Continuación**: Error en un período no detiene el procesamiento completo

## Dependencias

- `requests`: Peticiones HTTP
- `beautifulsoup4`: Parseo HTML (opcional, no usado actualmente)
- `gspread`: Integración con Google Sheets
- `oauth2client`: Autenticación Google
- `pandas`: Análisis de datos (para futuras expansiones)
- `python-dotenv`: Carga de variables de entorno

## Extensiones Futuras

Posibles mejoras:
- Exportación a otros formatos (CSV, Excel)
- Dashboard web para monitoreo
- Notificaciones de errores
- Cache de resultados
- Procesamiento asíncrono
- API REST para consultas

