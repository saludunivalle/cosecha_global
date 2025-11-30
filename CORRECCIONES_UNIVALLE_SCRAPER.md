# Correcciones Aplicadas al Scraper de Univalle

## Fecha: 2025-11-30

## Problemas Identificados y Corregidos

### 1. ❌ Problema: Nombres de actividad mostraban números (10.00, 20.00, etc.)
**Causa**: Las columnas de HORAS y NOMBRE se estaban confundiendo durante la extracción.

**Solución aplicada**:
- ✅ Identificación de columnas ANTES del loop de procesamiento de filas
- ✅ Priorización de columna "HORAS SEMESTRE" sobre otras columnas con "HORAS"
- ✅ Validación que el nombre NO sea un número
- ✅ Logging detallado con advertencias cuando se detecta error de columnas

**Archivos modificados**:
- `scraper/services/univalle_scraper.py` - Función `_procesar_asignaturas()` (líneas 661-850)
- `scraper/services/univalle_scraper.py` - Función `_procesar_actividades_genericas()` (líneas 990-1200)

**Código clave agregado**:
```python
# Identificar índices de columnas ANTES del loop
indice_horas = -1
indice_nombre = -1

for j, header in enumerate(headers):
    header_upper = header.upper()
    
    # Columna de HORAS SEMESTRE (prioridad alta)
    if 'HORAS' in header_upper and 'SEMESTRE' in header_upper:
        indice_horas = j
        logger.debug(f"✓ Columna HORAS SEMESTRE identificada: índice {j}")
    
    # Columna de NOMBRE (con diferentes variantes)
    elif ('NOMBRE' in header_upper and 'ASIGNATURA' in header_upper) or \
         ('NOMBRE' in header_upper and 'ANTEPROYECTO' in header_upper) or \
         (header_upper == 'NOMBRE'):
        if indice_nombre == -1:
            indice_nombre = j
            logger.debug(f"✓ Columna NOMBRE identificada: índice {j}")

# Validar que el nombre NO sea un número
if nombre_raw and re.match(r'^\d+\.?\d*$', nombre_raw):
    logger.error(f"❌ ERROR: Nombre de actividad es un número '{nombre_raw}' - las columnas están invertidas")
```

---

### 2. ❌ Problema: Horas mostraban 0.0 cuando deberían tener valores reales
**Causa**: La columna de horas no se identificaba correctamente, o se confundía con otras columnas numéricas (PORC, CRED, etc.)

**Solución aplicada**:
- ✅ Identificación explícita de columna "HORAS SEMESTRE" por header
- ✅ Extracción usando índice identificado (no por búsqueda genérica)
- ✅ Validación que el valor sea numérico antes de asignar
- ✅ Logging detallado mostrando de qué columna se extraen las horas
- ✅ Advertencias cuando no se encuentran horas válidas

**Código clave**:
```python
# Extraer HORAS usando el índice identificado
if indice_horas >= 0 and indice_horas < len(celdas):
    horas_raw = celdas[indice_horas].strip() if celdas[indice_horas] else ''
    # Validar que sea un número
    if horas_raw and re.match(r'^\d+\.?\d*$', horas_raw):
        actividad.horas_semestre = horas_raw
        logger.debug(f"  Horas extraídas: '{horas_raw}' de columna {indice_horas}")
    else:
        logger.warning(f"⚠️ Valor en columna HORAS no es numérico: '{horas_raw}'")
```

---

### 3. ❌ Problema: Cargo y Departamento aparecían como "faltante"
**Causa**: Aunque el código buscaba estos campos, no se estaban encontrando en la estructura HTML.

**Solución aplicada**:
- ✅ Mejorado logging para mostrar claramente cuando se encuentran estos campos
- ✅ Búsqueda en múltiples ubicaciones (fila 2, fila 4, filas adicionales)
- ✅ Soporte para variantes: "DEPARTAMENTO", "DPTO", "ESCUELA"
- ✅ Validación y advertencias claras cuando no se encuentran
- ✅ Extracción con BeautifulSoup como método principal
- ✅ Fallback con regex si BeautifulSoup falla

**Código clave**:
```python
# Logging mejorado
logger.info(f"✓ DEPARTAMENTO encontrado: '{texto}'")
logger.info(f"✓ CARGO encontrado: '{texto}'")

# Validación al final
if not info.departamento:
    logger.warning(f"⚠️ No se encontró DEPARTAMENTO para cédula {cedula}")
if not info.cargo:
    logger.warning(f"⚠️ No se encontró CARGO para cédula {cedula}")
```

---

### 4. ✅ Escuela sin palabra "ESCUELA"
**Estado**: Ya implementado correctamente

La función `limpiar_escuela()` ya remueve prefijos:
- "ESCUELA DE" → nombre limpio
- "ESCUELA" → nombre limpio
- "FACULTAD DE" → nombre limpio
- "FACULTAD" → nombre limpio
- "INSTITUTO DE" → nombre limpio
- "INSTITUTO" → nombre limpio

**Archivo**: `scraper/utils/helpers.py` - Función `limpiar_escuela()`

---

## Mapeo de Columnas de Google Sheets

Según especificaciones del usuario, las columnas de Google Sheets son:

| Columna | Nombre | Fuente en HTML | Función procesadora |
|---------|--------|----------------|---------------------|
| A | cedula | CEDULA | `_procesar_informacion_personal()` |
| B | nombre profesor | NOMBRE + APELLIDOS | `_construir_nombre_completo()` |
| C | escuela | UNIDAD ACADEMICA o ESCUELA | `limpiar_escuela()` |
| D | departamento | DEPARTAMENTO | `limpiar_departamento()` |
| E | tipo actividad | Pregrado/Postgrado/Investigación/etc. | `_extraer_actividades_desde_html()` |
| F | categoría | CATEGORIA | `_procesar_informacion_personal()` |
| G | **nombre actividad** | **NOMBRE DE ASIGNATURA** o **NOMBRE** | `_procesar_asignaturas()` ✅ CORREGIDO |
| H | **número de horas** | **HORAS SEMESTRE** | `_procesar_asignaturas()` ✅ CORREGIDO |
| I | periodo | Del parámetro `id_periodo` | Parámetro de entrada |
| J | detalle actividad | DOCENCIA/INVESTIGACION/EXTENSION/etc. | `_extraer_actividades_desde_html()` |
| K | actividad | Tipo - Grupo o descripción | `_extraer_actividades_desde_html()` |
| L | vinculación | VINCULACION | `_procesar_informacion_personal()` |
| M | dedicación | DEDICACION | `_procesar_informacion_personal()` |
| N | nivel | NIVEL ALCANZADO | `_procesar_informacion_personal()` |
| O | cargo | CARGO | `_procesar_informacion_personal()` ✅ MEJORADO |

---

## Tipos de Detalle Actividad

Según especificaciones del usuario, el campo "detalle actividad" debe contener uno de estos valores:

- **DOCENCIA** - Asignaturas de pregrado, postgrado, dirección de tesis
- **INVESTIGACION** - Proyectos de investigación
- **EXTENSION** - Actividades de extensión
- **INTELECTUALES O ARTISTICAS** - Producción intelectual
- **ADMINISTRATIVAS** - Cargos administrativos
- **COMPLEMENTARIAS** - Actividades complementarias
- **DOCENTE EN COMISION** - Comisiones especiales

Estos valores ya están implementados correctamente en `_extraer_actividades_desde_html()`.

---

## Logging Mejorado

Se agregaron los siguientes niveles de logging:

- `✓` (INFO) - Operación exitosa
- `⚠️` (WARNING) - Advertencia, puede continuar pero con datos incompletos
- `❌` (ERROR) - Error grave, dato incorrecto o columnas invertidas

Ejemplos:
```
✓ Columna HORAS SEMESTRE identificada: índice 8, header: 'HORAS SEMESTRE'
✓ Columna NOMBRE identificada: índice 3, header: 'NOMBRE DE ASIGNATURA'
⚠️ No se encontró DEPARTAMENTO para cédula 38872843
❌ ERROR: Nombre de actividad es un número '10.00' - las columnas están invertidas
```

---

## Testing Recomendado

Para verificar que las correcciones funcionan:

1. **Ejecutar el scraper** con una cédula de prueba:
```bash
python scraper/test_single_cedula.py <cedula>
```

2. **Verificar en los logs**:
   - ✅ "Columna HORAS SEMESTRE identificada"
   - ✅ "Columna NOMBRE identificada"
   - ✅ "Horas extraídas: 'XX.0'"
   - ✅ "Nombre extraído: 'NOMBRE COMPLETO DE LA ASIGNATURA'"
   - ✅ "DEPARTAMENTO encontrado"
   - ✅ "CARGO encontrado"
   - ❌ NO debe aparecer "Nombre de actividad es un número"

3. **Verificar en Google Sheets**:
   - Columna G (nombre actividad): Debe contener nombres de asignaturas, NO números
   - Columna H (número de horas): Debe contener números > 0, NO ceros
   - Columna D (departamento): No debe estar vacío
   - Columna O (cargo): No debe estar vacío
   - Columna C (escuela): NO debe contener la palabra "ESCUELA"

---

## Archivos Modificados

1. **scraper/services/univalle_scraper.py**
   - Líneas 661-850: `_procesar_asignaturas()` - Corregida identificación de columnas
   - Líneas 990-1200: `_procesar_actividades_genericas()` - Corregida identificación de columnas
   - Líneas 479-560: Mejorado logging para departamento, cargo y escuela

2. **scraper/utils/helpers.py**
   - No modificado (funciones `limpiar_escuela()` y `limpiar_departamento()` ya estaban correctas)

---

## Próximos Pasos

1. ✅ **Ejecutar prueba** con cédulas reales del usuario
2. ✅ **Verificar logs** para confirmar que no aparezcan errores
3. ✅ **Revisar datos** en Google Sheets para validar calidad
4. ⚠️ Si persisten problemas, revisar estructura HTML específica del portal

---

## Notas Adicionales

- Las correcciones son **retrocompatibles** - el código sigue funcionando con estructuras HTML antiguas
- El logging mejorado ayuda a **diagnosticar** problemas específicos de cada docente
- Las validaciones agregadas **detectan** cuando las columnas están invertidas o hay datos incorrectos
- Se mantienen múltiples **estrategias de extracción** (BeautifulSoup, regex, búsqueda por índice) para mayor robustez

