# Ejemplo de Uso - Flujo Completo

Este documento muestra cómo usar el flujo completo de scraping implementado en `main.py`.

## Descripción

El flujo completo automatiza todo el proceso de scraping:

1. **Lee cédulas** desde Google Sheet (hoja "2025-2", columna D)
2. **Calcula períodos** (actual: 2026-1 + 8 anteriores)
3. **Prepara hojas** de períodos en el segundo Sheet
4. **Scrapea cada cédula** y agrupa actividades por período
5. **Escribe datos** en las hojas correspondientes (batch write)
6. **Logging completo**: total procesado, errores, tiempo de ejecución
7. **Notificaciones** si hay errores críticos

## Características

- ✅ Barra de progreso con `tqdm`
- ✅ Manejo robusto de errores
- ✅ Logging detallado
- ✅ Batch writing para eficiencia
- ✅ Agrupación automática por período
- ✅ Retry logic para requests
- ✅ Delay configurable entre cédulas

## Uso Básico

### Ejecutar con configuración por defecto

```bash
python scraper/main.py --modo completo
```

Esto usará:
- Hoja fuente: La hoja configurada en `GOOGLE_SHEETS_SPREADSHEET_ID`
- Hoja fuente worksheet: "2025-2"
- Columna de cédulas: "D"
- Hoja destino: La misma hoja por defecto
- Período actual: "2026-1"
- Períodos anteriores: 8

### Ejecutar con opciones personalizadas

```bash
python scraper/main.py \
  --modo completo \
  --source-sheet-url "https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_1" \
  --source-worksheet "2025-2" \
  --source-column "D" \
  --target-sheet-url "https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_2" \
  --current-period "2026-1" \
  --n-periodos 8 \
  --delay-cedulas 1.0
```

## Parámetros Disponibles

### Modo Completo

| Parámetro | Descripción | Default |
|-----------|-------------|---------|
| `--modo` | Modo de ejecución: `completo`, `individual`, `archivo` | `completo` |
| `--source-sheet-url` | URL de la hoja fuente con cédulas | Hoja por defecto |
| `--source-worksheet` | Nombre de la hoja fuente | `2025-2` |
| `--source-column` | Columna de cédulas (letra o índice) | `D` |
| `--target-sheet-url` | URL de la hoja destino | Hoja por defecto |
| `--current-period` | Período actual (formato: "2026-1") | `2026-1` |
| `--n-periodos` | Número de períodos anteriores | `8` |
| `--delay-cedulas` | Delay entre cédulas (segundos) | `1.0` |

## Ejemplo de Salida

```
================================================================================
INICIANDO FLUJO COMPLETO DE SCRAPING
================================================================================
Inicio: 2026-01-15 10:30:00

[PASO 1/7] Inicializando servicios...
✓ Servicios inicializados

[PASO 2/7] Leyendo cédulas desde hoja '2025-2', columna D...
✓ 50 cédulas encontradas

[PASO 3/7] Calculando períodos desde 2026-1 (+ 8 anteriores)...
✓ 9 períodos calculados: ['2026-1', '2025-2', '2025-1', '2024-2', ...]

[PASO 4/7] Preparando hojas de períodos...
✓ 9 hojas preparadas

[PASO 5/7] Scrapeando 50 cédulas...
Scrapeando cédulas: 100%|████████████| 50/50 [15:32<00:00, 18.65s/cedula]
✓ Scraping completado: 48 exitosas, 2 con errores

[PASO 6/7] Escribiendo datos en hojas (batch write)...
Escribiendo hojas: 100%|████████████| 9/9 [00:45<00:00, 5.02s/periodo]
✓ Período 2026-1: 120 actividades escritas
✓ Período 2025-2: 150 actividades escritas
...

[PASO 7/7] Generando resumen final...
================================================================================
RESUMEN FINAL
================================================================================
Tiempo total de ejecución: 967.45 segundos (16.12 minutos)
Cédulas leídas: 50
Cédulas procesadas exitosamente: 48
Cédulas con errores: 2
Total actividades extraídas: 1250
Períodos procesados: 9

Actividades por período:
  2026-1: 120 actividades
  2025-2: 150 actividades
  2025-1: 140 actividades
  ...

Errores por cédula (2):
  1234567890: Período 2025-2: Error de conexión
  9876543210: No se encontraron actividades
================================================================================
Fin: 2026-01-15 10:46:07
================================================================================
```

## Estructura de Datos

### Headers de las Hojas

Cada hoja de período tiene los siguientes headers:

```
cedula, nombre profesor, escuela, departamento, tipo actividad,
categoría, nombre actividad, número de horas, periodo,
detalle actividad, actividad, vinculación, dedicación, nivel,
cargo, departamento
```

### Formato de Actividades

Cada fila representa una actividad con los siguientes campos:

- **cedula**: Cédula del profesor
- **nombre profesor**: Nombre completo del profesor
- **escuela**: Escuela o unidad académica
- **departamento**: Departamento (aparece 2 veces según especificación)
- **tipo actividad**: Pregrado, Postgrado, Investigación, etc.
- **categoría**: Categoría del profesor
- **nombre actividad**: Nombre de la asignatura/proyecto
- **número de horas**: Horas de la actividad
- **periodo**: Período académico (ej: "2026-1")
- **detalle actividad**: Detalles adicionales
- **actividad**: Tipo de actividad (Docencia, Investigación, etc.)
- **vinculación**: Tipo de vinculación
- **dedicación**: Dedicación del profesor
- **nivel**: Nivel alcanzado
- **cargo**: Cargo del profesor

## Manejo de Errores

### Errores por Cédula

Si una cédula tiene errores en algunos períodos, el sistema:

1. Registra el error
2. Continúa con los demás períodos
3. Continúa con las demás cédulas
4. Reporta errores al final

### Errores Críticos

Errores críticos son aquellos que detienen el proceso:

- No se pueden leer cédulas
- No se pueden calcular períodos
- No se pueden preparar hojas
- Error fatal en el flujo

Los errores críticos se reportan al final y se pueden extender para enviar notificaciones (email/Slack).

## Modos Alternativos

### Modo Individual

Para procesar una sola cédula:

```bash
python scraper/main.py --modo individual --cedula "1234567890"
```

### Modo Archivo

Para procesar desde un archivo de cédulas:

```bash
python scraper/main.py --modo archivo --cedulas-archivo "cedulas.txt"
```

El archivo debe tener una cédula por línea:

```
1234567890
9876543210
5555555555
```

## Configuración

Asegúrate de tener configuradas las variables de entorno en `.env`:

```env
GOOGLE_SHEETS_CREDENTIALS_PATH=path/to/credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
UNIVALLE_BASE_URL=https://proxse26.univalle.edu.co/asignacion
LOG_LEVEL=INFO
LOG_FILE=scraper.log
```

## Optimizaciones

### Delay Entre Cédulas

Ajusta `--delay-cedulas` según la capacidad del servidor:

- **0.5 segundos**: Más rápido, puede causar rate limiting
- **1.0 segundos**: Balanceado (recomendado)
- **2.0 segundos**: Más conservador, evita rate limiting

### Batch Writing

El sistema escribe todas las actividades de un período en un solo batch para eficiencia. Si tienes muchos datos, puedes ajustar el tamaño del batch en `sheets_service.py`.

## Logs

Los logs se guardan en el archivo especificado en `LOG_FILE` (default: `scraper.log`). También se muestran en la consola.

### Niveles de Log

- **DEBUG**: Información detallada para debugging
- **INFO**: Información general del proceso
- **WARNING**: Advertencias (errores no críticos)
- **ERROR**: Errores que requieren atención

## Notificaciones (Futuro)

El sistema está preparado para extender notificaciones:

- Email: Enviar resumen de errores críticos
- Slack: Notificar cuando termine el proceso
- Webhook: Enviar resultados a un endpoint

Actualmente solo se loguean los errores críticos. Para implementar notificaciones, modifica la función `enviar_notificacion()` en `main.py`.

