# Ejemplo de Uso: scrape_teacher_data

Este documento muestra cómo usar el método `scrape_teacher_data` para extraer datos de un profesor del portal Univalle.

## Descripción

El método `scrape_teacher_data` realiza scraping completo de un profesor:
- Construye la URL del aplicativo con la cédula
- Hace request GET con retry logic (3 intentos)
- Parsea HTML usando los mismos selectores que en `web/`
- Extrae todos los campos requeridos
- Retorna lista de diccionarios (una entrada por cada actividad)
- Maneja errores: timeout, HTML malformado, profesor sin datos

## Campos Extraídos

Cada diccionario en la lista contiene:
- `cedula`: Número de cédula del profesor
- `nombre_profesor`: Nombre completo
- `escuela`: Escuela o unidad académica
- `departamento`: Departamento
- `tipo_actividad`: Tipo (Pregrado, Postgrado, Investigación, etc.)
- `categoria`: Categoría del docente
- `nombre_actividad`: Nombre de la asignatura/actividad
- `numero_horas`: Número de horas (float)
- `periodo`: Período académico (ej: "2026-1")
- `detalle_actividad`: Detalles adicionales
- `actividad`: Categoría de actividad (Docencia, Investigación, etc.)
- `vinculacion`: Tipo de vinculación
- `dedicacion`: Dedicación
- `nivel`: Nivel alcanzado
- `cargo`: Cargo

## Ejemplos de Uso

### 1. Uso Básico - Período Automático

```python
from scraper.services.univalle_scraper import UnivalleScraper

# Inicializar scraper
scraper = UnivalleScraper()

# Scrapear profesor (usa período más reciente automáticamente)
actividades = scraper.scrape_teacher_data("1112966620")

print(f"Encontradas {len(actividades)} actividades")
for actividad in actividades:
    print(f"  - {actividad['tipo_actividad']}: {actividad['nombre_actividad']} ({actividad['numero_horas']} horas)")
```

### 2. Especificar Período

```python
from scraper.services.univalle_scraper import UnivalleScraper

scraper = UnivalleScraper()

# Scrapear para período específico (ID 48)
actividades = scraper.scrape_teacher_data("1112966620", id_periodo=48)

print(f"Período: {actividades[0]['periodo'] if actividades else 'N/A'}")
```

### 3. Personalizar Retry y Delays

```python
from scraper.services.univalle_scraper import UnivalleScraper

scraper = UnivalleScraper()

# Personalizar: 5 intentos, delays entre 1-2 segundos
actividades = scraper.scrape_teacher_data(
    "1112966620",
    max_retries=5,
    delay_min=1.0,
    delay_max=2.0
)
```

### 4. Manejo de Errores

```python
from scraper.services.univalle_scraper import UnivalleScraper
import requests

scraper = UnivalleScraper()

try:
    actividades = scraper.scrape_teacher_data("1112966620")
    
    if not actividades:
        print("⚠️ No se encontraron actividades para este profesor")
    else:
        print(f"✅ {len(actividades)} actividades encontradas")
        
except ValueError as e:
    print(f"❌ Error de validación: {e}")
    # Ejemplo: "Cédula inválida: 123"
    
except requests.RequestException as e:
    print(f"❌ Error de conexión: {e}")
    # Ejemplo: Timeout después de todos los intentos
    
except Exception as e:
    print(f"❌ Error inesperado: {e}")
    import traceback
    traceback.print_exc()
```

### 5. Procesar Múltiples Profesores

```python
from scraper.services.univalle_scraper import UnivalleScraper
import time

scraper = UnivalleScraper()

cedulas = ["1112966620", "1234567890", "9876543210"]

resultados = {}

for cedula in cedulas:
    try:
        print(f"\nProcesando cédula: {cedula}")
        actividades = scraper.scrape_teacher_data(cedula)
        resultados[cedula] = {
            'exito': True,
            'actividades': actividades,
            'total': len(actividades)
        }
        print(f"✅ {len(actividades)} actividades encontradas")
        
        # Delay entre profesores para no sobrecargar el servidor
        time.sleep(1)
        
    except Exception as e:
        resultados[cedula] = {
            'exito': False,
            'error': str(e),
            'actividades': []
        }
        print(f"❌ Error: {e}")

# Resumen
print("\n" + "="*60)
print("RESUMEN:")
for cedula, resultado in resultados.items():
    if resultado['exito']:
        print(f"  {cedula}: ✅ {resultado['total']} actividades")
    else:
        print(f"  {cedula}: ❌ {resultado['error']}")
```

### 6. Filtrar por Tipo de Actividad

```python
from scraper.services.univalle_scraper import UnivalleScraper

scraper = UnivalleScraper()

actividades = scraper.scrape_teacher_data("1112966620")

# Filtrar solo actividades de investigación
investigacion = [
    a for a in actividades 
    if a['tipo_actividad'] == 'Investigación'
]

print(f"Actividades de investigación: {len(investigacion)}")
for act in investigacion:
    print(f"  - {act['nombre_actividad']}: {act['numero_horas']} horas")
```

### 7. Guardar en Archivo JSON

```python
from scraper.services.univalle_scraper import UnivalleScraper
import json

scraper = UnivalleScraper()

actividades = scraper.scrape_teacher_data("1112966620")

# Guardar en JSON
with open('actividades_profesor.json', 'w', encoding='utf-8') as f:
    json.dump(actividades, f, indent=2, ensure_ascii=False)

print(f"Guardadas {len(actividades)} actividades en actividades_profesor.json")
```

### 8. Integración con Sheets

```python
from scraper.services.univalle_scraper import UnivalleScraper
from scraper.services.sheets_service import SheetsService

scraper = UnivalleScraper()
sheets_service = SheetsService()

# Scrapear profesor
actividades = scraper.scrape_teacher_data("1112966620")

# Guardar en hoja de Google Sheets
hoja = "2026-1"
headers = [
    'cedula', 'nombre_profesor', 'escuela', 'departamento',
    'tipo_actividad', 'categoria', 'nombre_actividad',
    'numero_horas', 'periodo', 'detalle_actividad',
    'actividad', 'vinculacion', 'dedicacion', 'nivel', 'cargo'
]

# Convertir diccionarios a listas de valores
filas = []
for actividad in actividades:
    fila = [actividad.get(h, '') for h in headers]
    filas.append(fila)

# Agregar a la hoja
sheets_service.agregar_filas(hoja, filas)
print(f"Agregadas {len(filas)} filas a la hoja {hoja}")
```

## Logging Detallado

El método registra información detallada de cada consulta:

```
============================================================
🔍 INICIANDO SCRAPING PARA PROFESOR: 1112966620
============================================================
Período no especificado, obteniendo período más reciente...
✓ Usando período más reciente: 2026-1 (ID: 49)

📡 Intento 1/3
🌐 URL: https://proxse26.univalle.edu.co/asignacion/vin_inicio_impresion.php3?cedula=1112966620&periodo=49
⏱️  Tiempo de respuesta: 1.23s
📄 HTML recibido: 45234 caracteres
🔄 Parseando HTML y extrayendo datos...
Encontradas 5 tablas en el HTML
Procesando tabla 1/5
...
✅ Scraping exitoso: 12 actividades encontradas
============================================================
```

## Retry Logic

El método implementa retry automático:

1. **3 intentos por defecto** (configurable)
2. **Delays aleatorios** entre 0.5-1 segundo entre intentos
3. **Reintentos solo para errores recuperables**:
   - Timeout
   - Error HTTP 5xx
   - Error de conexión

4. **No reintenta** para:
   - Error HTTP 4xx (400, 401, 403, 404)
   - Errores de validación

## Manejo de Errores

### Timeout

```python
try:
    actividades = scraper.scrape_teacher_data("1112966620")
except requests.Timeout:
    print("El servidor tardó demasiado en responder")
```

### HTML Malformado

```python
try:
    actividades = scraper.scrape_teacher_data("1112966620")
except ValueError as e:
    if "HTML" in str(e):
        print(f"Error al parsear HTML: {e}")
```

### Profesor Sin Datos

```python
try:
    actividades = scraper.scrape_teacher_data("1112966620")
    if not actividades:
        print("No se encontraron actividades para este profesor")
except ValueError as e:
    if "no devolvió actividades" in str(e).lower():
        print("El profesor no tiene datos en el sistema")
```

## Notas Importantes

1. **Delays entre Requests**: El método incluye delays aleatorios (0.5-1s) para evitar sobrecargar el servidor

2. **Múltiples Actividades**: Un profesor puede tener múltiples actividades del mismo tipo. Cada una es un diccionario separado en la lista

3. **Período por Defecto**: Si no se especifica período, usa el más reciente disponible

4. **Logging**: Todos los pasos se registran en los logs para debugging

5. **Validación**: Se valida la cédula antes de hacer el request

## Integración con el Flujo Completo

```python
"""
Ejemplo completo: Scrapear múltiples profesores y guardar en Sheets
"""

from scraper.services.univalle_scraper import UnivalleScraper
from scraper.services.sheets_service import SheetsService
import time

# Inicializar servicios
scraper = UnivalleScraper()
sheets_service = SheetsService()

# Obtener cédulas desde una hoja
cedulas = sheets_service.get_cedulas_from_sheet(
    worksheet_name="2025-2",
    column="D"
)

print(f"Procesando {len(cedulas)} profesores...")

# Procesar cada profesor
for i, cedula in enumerate(cedulas, 1):
    print(f"\n[{i}/{len(cedulas)}] Procesando: {cedula}")
    
    try:
        # Scrapear
        actividades = scraper.scrape_teacher_data(cedula)
        
        # Preparar filas para Sheets
        filas = []
        for actividad in actividades:
            fila = [
                actividad['cedula'],
                actividad['nombre_profesor'],
                actividad['escuela'],
                actividad['departamento'],
                actividad['tipo_actividad'],
                actividad['categoria'],
                actividad['nombre_actividad'],
                actividad['numero_horas'],
                actividad['periodo'],
                actividad['detalle_actividad'],
                actividad['actividad'],
                actividad['vinculacion'],
                actividad['dedicacion'],
                actividad['nivel'],
                actividad['cargo'],
            ]
            filas.append(fila)
        
        # Guardar en hoja del período
        periodo = actividades[0]['periodo'] if actividades else '2026-1'
        sheets_service.agregar_filas(periodo, filas)
        
        print(f"✅ {len(actividades)} actividades guardadas")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Delay entre profesores
    if i < len(cedulas):
        time.sleep(1)

print("\n✅ Procesamiento completado")
```

