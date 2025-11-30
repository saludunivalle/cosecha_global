# Ejemplo de Uso: get_cedulas_from_sheet

Este documento muestra cómo usar el método `get_cedulas_from_sheet` para extraer cédulas desde Google Sheets.

## Descripción

El método `get_cedulas_from_sheet` permite:
- Conectarse a Google Sheets usando service account (credenciales desde variables de entorno)
- Leer una hoja de trabajo específica (worksheet)
- Extraer cédulas de una columna específica (por defecto columna D)
- Limpiar y validar las cédulas automáticamente
- Eliminar duplicados, valores vacíos y formatos incorrectos
- Retornar una lista de cédulas únicas y validadas

## Ejemplos de Uso

### 1. Uso Básico - Hoja por Defecto

```python
from scraper.services.sheets_service import SheetsService

# Inicializar servicio (usa credenciales desde .env)
service = SheetsService()

# Extraer cédulas de la hoja "2025-2", columna D
cedulas = service.get_cedulas_from_sheet(
    worksheet_name="2025-2",
    column="D"
)

print(f"Encontradas {len(cedulas)} cédulas únicas")
for cedula in cedulas:
    print(f"  - {cedula}")
```

### 2. Usar con URL Externa

```python
from scraper.services.sheets_service import SheetsService

service = SheetsService()

# Extraer cédulas de una hoja externa usando URL
sheet_url = "https://docs.google.com/spreadsheets/d/1ABC123...xyz/edit"
cedulas = service.get_cedulas_from_sheet(
    sheet_url=sheet_url,
    worksheet_name="2025-2",
    column="D"
)
```

### 3. Especificar Columna Diferente

```python
from scraper.services.sheets_service import SheetsService

service = SheetsService()

# Extraer de columna E (índice 5)
cedulas = service.get_cedulas_from_sheet(
    worksheet_name="2025-2",
    column="E"  # o column=5
)
```

### 4. Usar Primera Hoja (Sin Especificar Nombre)

```python
from scraper.services.sheets_service import SheetsService

service = SheetsService()

# Si no se especifica worksheet_name, usa la primera hoja
cedulas = service.get_cedulas_from_sheet(
    column="D"
)
```

### 5. Integración con el Scraper Principal

```python
from scraper.services.sheets_service import SheetsService
from scraper.services.univalle_scraper import UnivalleScraper
from scraper.services.period_manager import PeriodManager

# Inicializar servicios
sheets_service = SheetsService()
scraper = UnivalleScraper()
period_manager = PeriodManager(sheets_service, scraper)

# Obtener períodos
periodos = period_manager.obtener_ultimos_n_periodos(8)

# Extraer cédulas de la hoja del período más reciente
periodo_reciente = periodos[0]['label']
cedulas = sheets_service.get_cedulas_from_sheet(
    worksheet_name=f"Periodo_{periodo_reciente}",
    column="D"
)

# Procesar cada cédula
for cedula in cedulas:
    try:
        datos = scraper.procesar_docente(cedula, periodos[0]['idPeriod'])
        # Guardar datos...
    except Exception as e:
        print(f"Error procesando {cedula}: {e}")
```

### 6. Script Completo de Procesamiento Masivo

```python
"""
Script para procesar múltiples docentes desde una hoja de Google Sheets
"""

import logging
from scraper.services.sheets_service import SheetsService
from scraper.services.univalle_scraper import UnivalleScraper
from scraper.services.period_manager import PeriodManager
from scraper.config.settings import validate_config

# Configurar logging
logging.basicConfig(level=logging.INFO)

def main():
    # Validar configuración
    validate_config()
    
    # Inicializar servicios
    sheets_service = SheetsService()
    scraper = UnivalleScraper()
    period_manager = PeriodManager(sheets_service, scraper)
    
    # Obtener períodos
    periodos = period_manager.obtener_ultimos_n_periodos(8)
    print(f"Procesando {len(periodos)} períodos")
    
    # Extraer cédulas de la hoja "2025-2"
    try:
        cedulas = sheets_service.get_cedulas_from_sheet(
            worksheet_name="2025-2",
            column="D"
        )
        print(f"\nEncontradas {len(cedulas)} cédulas para procesar")
    except Exception as e:
        print(f"Error extrayendo cédulas: {e}")
        return
    
    # Procesar cada cédula
    resultados = {
        'exitosos': 0,
        'errores': 0,
        'detalles': []
    }
    
    for i, cedula in enumerate(cedulas, 1):
        print(f"\n[{i}/{len(cedulas)}] Procesando cédula: {cedula}")
        
        for periodo in periodos:
            try:
                datos = scraper.procesar_docente(cedula, periodo['idPeriod'])
                resultados['exitosos'] += 1
                print(f"  ✓ Período {periodo['label']}: OK")
            except Exception as e:
                resultados['errores'] += 1
                print(f"  ✗ Período {periodo['label']}: {e}")
    
    # Resumen
    print(f"\n{'='*50}")
    print(f"Resumen:")
    print(f"  Exitosos: {resultados['exitosos']}")
    print(f"  Errores: {resultados['errores']}")

if __name__ == "__main__":
    main()
```

## Detalles de Funcionamiento

### Validación y Limpieza Automática

El método automáticamente:

1. **Limpia las cédulas**:
   - Remueve espacios, puntos y guiones
   - Normaliza formato

2. **Valida formato**:
   - Debe ser numérica
   - Entre 7 y 10 dígitos
   - Elimina valores inválidos

3. **Elimina duplicados**:
   - Usa un set interno
   - Retorna lista única

4. **Detecta headers**:
   - Si la primera fila contiene "No. Documento", "Cédula", "ID", etc.
   - La omite automáticamente

### Formatos de Columna Soportados

El parámetro `column` acepta:
- **Letras**: 'A', 'B', 'D', 'Z', 'AA', 'AB', etc.
- **Números**: 1, 2, 4 (basado en 1)

Ejemplos:
```python
column="D"      # Columna D
column=4        # Columna D (equivalente)
column="AA"     # Columna AA (27)
```

### Manejo de Errores

El método lanza excepciones si:
- La hoja de trabajo no existe
- La URL de la hoja es inválida
- No hay acceso a la hoja
- Error al leer la columna

Ejemplo de manejo:

```python
from scraper.services.sheets_service import SheetsService

service = SheetsService()

try:
    cedulas = service.get_cedulas_from_sheet(
        worksheet_name="2025-2",
        column="D"
    )
except ValueError as e:
    print(f"Error de configuración: {e}")
except Exception as e:
    print(f"Error inesperado: {e}")
```

## Notas Importantes

1. **Credenciales**: Las credenciales se leen automáticamente desde variables de entorno (`.env`)

2. **Permisos**: La cuenta de servicio debe tener acceso a la hoja de cálculo

3. **Rendimiento**: Para grandes volúmenes de datos, considera procesar en lotes

4. **Logging**: Todos los pasos se registran en los logs para debugging

## Integración con main.py

Puedes extender `main.py` para usar este método:

```python
# En main.py, agregar opción:
parser.add_argument(
    '--extraer-cedulas',
    type=str,
    help='Nombre de la hoja de trabajo de la cual extraer cédulas'
)

# En la función main():
if args.extraer_cedulas:
    cedulas = sheets_service.get_cedulas_from_sheet(
        worksheet_name=args.extraer_cedulas,
        column="D"
    )
    # Procesar cédulas...
```

