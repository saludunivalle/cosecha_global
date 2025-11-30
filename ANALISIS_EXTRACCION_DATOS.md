# Análisis Comparativo: Extracción de Datos entre web/ y scraper/

## Problemas Identificados

### 1. Nombre de Actividad
**Problema**: El scraper extrae solo `nombre_asignatura` (ej: "HISTORIA IDEAS EN CIENCIAS DE LA SALUD") cuando debería extraer `"{codigo} - {nombre_asignatura}"` (ej: "626001C - HISTORIA IDEAS EN CIENCIAS DE LA SALUD").

**Ubicación del problema**:
- `scraper/services/univalle_scraper.py` línea 1001 y 1024
- Actualmente: `nombre_actividad=actividad.nombre_asignatura`
- Debería ser: `nombre_actividad=f"{actividad.codigo} - {actividad.nombre_asignatura}"`

**Cómo lo hace web/**:
- `web/` mantiene `CODIGO` y `NOMBRE DE ASIGNATURA` como campos separados
- La UI los muestra en columnas separadas, pero el formato esperado para el scraper es combinado

### 2. Número de Horas
**Problema**: Siempre extrae 0, cuando debería tener valores reales.

**Ubicación del problema**:
- `scraper/services/univalle_scraper.py` línea 492-493: Extrae horas correctamente de la tabla
- `scraper/services/univalle_scraper.py` línea 1002 y 1025: Usa `actividad.horas_semestre`
- El problema puede estar en:
  1. La columna de horas no se está identificando correctamente
  2. El valor está vacío o en formato incorrecto
  3. La función `parsear_horas` está retornando 0

**Cómo lo hace web/**:
- `src/web/lib/html-parser/processors/table-processors.ts` línea 484-488: Busca headers que contengan "HORAS" y "SEMESTRE"
- `src/web/lib/html-parser/normalizers.ts` línea 42-46: Normaliza el campo "HORAS SEMESTRE"

### 3. Cargo y Departamento
**Problema**: No se están extrayendo estos campos.

**Ubicación del problema**:
- `scraper/services/univalle_scraper.py` línea 422-459: `_procesar_informacion_personal` no extrae cargo ni departamento
- Solo extrae: cedula, apellidos, nombre, unidad_academica, vinculacion, categoria, dedicacion, nivel_alcanzado, centro_costo

**Cómo lo hace web/**:
- `web/` no extrae explícitamente cargo y departamento de la tabla de información personal
- Estos campos pueden estar en:
  - Filas adicionales de la tabla de información personal
  - Otras tablas del HTML
  - Texto plano del HTML con formato `CARGO=valor` o `DEPARTAMENTO=valor`

## Estructura de Tabla HTML

### Tabla de Información Personal
```
Fila 0 (Headers): CEDULA | 1 APELLIDO | 2 APELLIDO | NOMBRE | UNIDAD ACADEMICA
Fila 1 (Valores): [cedula] | [apellido1] | [apellido2] | [nombre] | [unidad]
Fila 2 (Headers): VINCULACION | CATEGORIA | DEDICACION | NIVEL ALCANZADO | CENTRO COSTO
Fila 3 (Valores): [vinculacion] | [categoria] | [dedicacion] | [nivel] | [centro_costo]
Fila 4+ (Posibles): CARGO | DEPARTAMENTO | ESCUELA (pueden estar aquí o en otras filas)
```

### Tabla de Asignaturas
```
Fila 0 (Headers): CODIGO | GRUPO | TIPO | NOMBRE DE ASIGNATURA | CRED | PORC | FREC | INTEN | HORAS SEMESTRE
Fila 1+ (Datos): [codigo] | [grupo] | [tipo] | [nombre] | [cred] | [porc] | [frec] | [inten] | [horas]
```

**IMPORTANTE**: 
- El nombre de actividad debe combinarse como: `{CODIGO} - {NOMBRE DE ASIGNATURA}`
- Las horas están en la columna con header que contiene "HORAS" y "SEMESTRE"
- Cargo y departamento pueden estar en filas adicionales o en otras tablas

## Correcciones Implementadas

### 1. ✅ Nombre de Actividad
**Corrección aplicada**: 
- Líneas 993-1003 y 1016-1026 en `scraper/services/univalle_scraper.py`
- Ahora combina código y nombre: `f"{actividad.codigo} - {actividad.nombre_asignatura}"`
- Maneja casos donde solo hay código o solo nombre

### 2. ✅ Número de Horas
**Corrección aplicada**:
- Líneas 461-520 en `scraper/services/univalle_scraper.py`
- Mejorada identificación de columna de horas:
  - Prioriza headers con "HORAS SEMESTRE"
  - Evita confundir con columna PORC (porcentaje)
  - Búsqueda fallback en valores numéricos si no se encuentra por header
- Agregado logging para debugging

### 3. ✅ Cargo y Departamento
**Corrección aplicada**:
- Líneas 422-505 en `scraper/services/univalle_scraper.py`
- Extracción mejorada:
  - Busca en headers de fila 2 y fila 4
  - Busca en filas adicionales (5-10) con formato "CARGO=valor"
  - Extrae desde múltiples posiciones posibles
  - También extrae ESCUELA si está disponible

## Estructura de Extracción Actualizada

### Tabla de Asignaturas
```python
# Headers esperados:
CODIGO | GRUPO | TIPO | NOMBRE DE ASIGNATURA | CRED | PORC | FREC | INTEN | HORAS SEMESTRE

# Extracción:
- nombre_actividad = f"{CODIGO} - {NOMBRE DE ASIGNATURA}"
- horas_semestre = valor de columna con header que contiene "HORAS" y "SEMESTRE"
```

### Tabla de Información Personal
```python
# Extracción mejorada:
- Busca CARGO en headers y filas adicionales
- Busca DEPARTAMENTO/DPTO en headers y filas adicionales
- Busca ESCUELA si está disponible
```

## Mapeo de Columnas - Tabla de Asignaturas

| Índice | Header Esperado | Campo Extraído | Notas |
|--------|----------------|----------------|-------|
| 0 | CODIGO | `actividad.codigo` | Excluye "CODIGO ESTUDIANTE" |
| 1 | GRUPO | `actividad.grupo` | |
| 2 | TIPO | `actividad.tipo` | |
| 3 | NOMBRE DE ASIGNATURA | `actividad.nombre_asignatura` | |
| 4 | CRED | `actividad.cred` | |
| 5 | PORC | `actividad.porc` | ⚠️ NO confundir con horas |
| 6 | FREC | `actividad.frec` | |
| 7 | INTEN | `actividad.inten` | |
| 8 | HORAS SEMESTRE | `actividad.horas_semestre` | ✅ Columna objetivo |

**IMPORTANTE**: 
- El problema de "2%" era porque se estaba leyendo la columna PORC (porcentaje) en lugar de HORAS SEMESTRE
- La corrección identifica explícitamente la columna de horas y evita confundirla con PORC

## Próximos Pasos para Validación

1. **Probar con HTML de ejemplo**:
   - Guardar HTML completo de una cédula con actividades
   - Verificar que las columnas se identifiquen correctamente
   - Validar que horas no sea 0

2. **Verificar cargo y departamento**:
   - Revisar HTML para ver en qué fila/columna están estos campos
   - Ajustar extracción si es necesario

3. **Logging mejorado**:
   - Los logs ahora muestran qué columna se usa para horas
   - Revisar logs para validar extracción correcta

