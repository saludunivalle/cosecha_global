# Ejemplo de Uso: Gestión de Períodos

Este documento muestra cómo usar los métodos `calculate_periods` y `prepare_period_sheets` del `PeriodManager`.

## Descripción

Estos métodos permiten:
- Calcular períodos académicos anteriores a partir de un período actual
- Preparar hojas de Google Sheets para cada período (crear o limpiar)

## 1. calculate_periods

### Descripción

Calcula una lista de períodos incluyendo el actual y los N anteriores.

### Uso Básico

```python
from scraper.services.sheets_service import SheetsService
from scraper.services.univalle_scraper import UnivalleScraper
from scraper.services.period_manager import PeriodManager

# Inicializar servicios
sheets_service = SheetsService()
scraper = UnivalleScraper()
period_manager = PeriodManager(sheets_service, scraper)

# Calcular períodos desde "2026-1" con 8 anteriores
periods = period_manager.calculate_periods("2026-1", n_previous=8)

print("Períodos calculados:")
for period in periods:
    print(f"  - {period}")
```

**Salida esperada:**
```
Períodos calculados:
  - 2026-1
  - 2025-2
  - 2025-1
  - 2024-2
  - 2024-1
  - 2023-2
  - 2023-1
  - 2022-2
  - 2022-1
```

### Ejemplos Varios

```python
# Desde período 2
periods = period_manager.calculate_periods("2025-2", n_previous=4)
# Resultado: ['2025-2', '2025-1', '2024-2', '2024-1', '2023-2']

# Menos períodos anteriores
periods = period_manager.calculate_periods("2026-1", n_previous=3)
# Resultado: ['2026-1', '2025-2', '2025-1', '2024-2']

# Más períodos
periods = period_manager.calculate_periods("2026-1", n_previous=12)
# Calcula 13 períodos en total (1 actual + 12 anteriores)
```

### Manejo de Errores

```python
try:
    periods = period_manager.calculate_periods("2026-1", n_previous=8)
except ValueError as e:
    print(f"Error: {e}")
    # Error si el formato no es válido, ej: "2026-1" es válido, "2026/1" no
```

## 2. prepare_period_sheets

### Descripción

Prepara las hojas de períodos en Google Sheets:
- Si la hoja existe: borra todo excepto los encabezados (fila 1)
- Si no existe: crea la hoja con los encabezados especificados

### Headers Utilizados

Los headers por defecto son:
```
cedula, nombre profesor, escuela, departamento, tipo actividad,
categoría, nombre actividad, número de horas, periodo,
detalle actividad, actividad, vinculación, dedicación, nivel,
cargo, departamento
```

### Uso Básico

```python
from scraper.services.sheets_service import SheetsService
from scraper.services.univalle_scraper import UnivalleScraper
from scraper.services.period_manager import PeriodManager

# Inicializar servicios
sheets_service = SheetsService()
scraper = UnivalleScraper()
period_manager = PeriodManager(sheets_service, scraper)

# Calcular períodos
periods = period_manager.calculate_periods("2026-1", n_previous=8)

# Preparar hojas (usa hoja por defecto de GOOGLE_SHEETS_SPREADSHEET_ID)
period_manager.prepare_period_sheets(periods=periods)

print(f"Hojas preparadas para {len(periods)} períodos")
```

### Usar con URL Externa

```python
# Preparar hojas en una hoja de cálculo externa
sheet_url = "https://docs.google.com/spreadsheets/d/1ABC123...xyz/edit"

periods = period_manager.calculate_periods("2026-1", n_previous=8)
period_manager.prepare_period_sheets(sheet_url=sheet_url, periods=periods)
```

### Ejemplo Completo: Workflow Completo

```python
"""
Script completo para calcular períodos y preparar hojas
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
    
    # 1. Calcular períodos desde el período actual
    current_period = "2026-1"  # Cambiar según el período actual
    periods = period_manager.calculate_periods(current_period, n_previous=8)
    
    print(f"\nPeríodos a procesar ({len(periods)}):")
    for i, period in enumerate(periods, 1):
        print(f"  {i}. {period}")
    
    # 2. Preparar hojas en Google Sheets
    print(f"\nPreparando hojas en Google Sheets...")
    period_manager.prepare_period_sheets(periods=periods)
    
    print("\n✓ Hojas preparadas exitosamente")
    print(f"  - Total de períodos: {len(periods)}")
    print(f"  - Hojas creadas/limpiadas en: {sheets_service.spreadsheet.title}")

if __name__ == "__main__":
    main()
```

### Comportamiento Detallado

#### Si la hoja existe:

1. **Lee todos los valores** de la hoja
2. **Mantiene la fila 1** (headers)
3. **Elimina todas las filas** desde la 2 en adelante
4. **Verifica headers**: Si los headers no coinciden con los esperados, los actualiza

#### Si la hoja no existe:

1. **Crea la hoja** con 1000 filas y el número de columnas necesario
2. **Agrega los headers** en la primera fila

### Manejo de Errores

```python
try:
    periods = period_manager.calculate_periods("2026-1", n_previous=8)
    period_manager.prepare_period_sheets(periods=periods)
except ValueError as e:
    print(f"Error de validación: {e}")
except Exception as e:
    print(f"Error inesperado: {e}")
    # Los errores individuales de cada hoja se registran pero no detienen el proceso
```

## Integración con el Scraper

### Ejemplo: Preparar y Scrapear

```python
from scraper.services.sheets_service import SheetsService
from scraper.services.univalle_scraper import UnivalleScraper
from scraper.services.period_manager import PeriodManager

# Inicializar
sheets_service = SheetsService()
scraper = UnivalleScraper()
period_manager = PeriodManager(sheets_service, scraper)

# 1. Calcular períodos
current_period = "2026-1"
periods = period_manager.calculate_periods(current_period, n_previous=8)

# 2. Preparar hojas
period_manager.prepare_period_sheets(periods=periods)

# 3. Obtener cédulas de una hoja (ejemplo)
cedulas = sheets_service.get_cedulas_from_sheet(
    worksheet_name="2025-2",
    column="D"
)

# 4. Scrapear y guardar datos para cada período
# (Esto requeriría mapear períodos a IDs del portal)
for cedula in cedulas:
    for period_label in periods:
        # Aquí se necesitaría obtener el ID del período desde el portal
        # o tener un mapeo de períodos a IDs
        pass
```

## Notas Importantes

1. **Formato de Períodos**: Debe ser exactamente "YYYY-T" donde YYYY es el año y T es 1 o 2

2. **Headers**: Los headers se normalizan (minúsculas, sin espacios extra) para comparación

3. **Limpieza**: La limpieza de hojas elimina TODAS las filas excepto la primera, así que úsala con precaución

4. **Permisos**: La cuenta de servicio debe tener permisos de escritura en la hoja de cálculo

5. **Nombres de Hojas**: El nombre de la hoja es exactamente el período (ej: "2026-1", no "Periodo_2026-1")

## Troubleshooting

### Error: "Formato de período inválido"
- Verifica que el formato sea exactamente "YYYY-T" (ej: "2026-1")
- No uses espacios extra o formatos diferentes

### Error: "Hoja no encontrada" al preparar
- Esto es normal si la hoja no existe, se creará automáticamente
- Verifica los permisos de la cuenta de servicio

### Headers no se actualizan
- Los headers se comparan en minúsculas y sin espacios extra
- Si los headers actuales son diferentes, se actualizarán automáticamente

