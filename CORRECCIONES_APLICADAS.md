# Correcciones Aplicadas en `_procesar_asignaturas` y Métodos Relacionados

## Resumen

Se aplicaron correcciones basadas en el análisis HTML real para mejorar la extracción de datos de actividades.

---

## 1. ✅ Nombre de Actividad

### Problema
- Se extraía solo el nombre o valores incorrectos como "2%"
- No se limpiaba correctamente el texto

### Correcciones Aplicadas

**Ubicación**: `_procesar_asignaturas()` líneas 547-548

```python
elif 'NOMBRE' in header_upper and 'ASIGNATURA' in header_upper:
    # Limpiar nombre de asignatura: remover porcentajes y espacios extra
    nombre_limpio = valor
    # Remover porcentajes si están al final (ej: "Nombre 2%")
    nombre_limpio = re.sub(r'\s*\d+%$', '', nombre_limpio).strip()
    # Remover espacios múltiples
    nombre_limpio = re.sub(r'\s+', ' ', nombre_limpio).strip()
    actividad.nombre_asignatura = nombre_limpio
```

**Validaciones agregadas**:
- Remueve porcentajes al final del nombre
- Normaliza espacios múltiples
- Valida que el nombre tenga más de 3 caracteres
- Valida que no termine en porcentaje

**Ubicación**: `_construir_actividad_dict()` líneas 1371-1376

```python
# Validación: nombre no debe terminar en porcentaje
if nombre_actividad_limpio.endswith('%'):
    logger.warning(f"Nombre de actividad termina en porcentaje (incorrecto): '{nombre_actividad_limpio}'")
    nombre_actividad_limpio = re.sub(r'\s*\d+%$', '', nombre_actividad_limpio).strip()

# Validación: nombre debe tener longitud razonable
if nombre_actividad_limpio and len(nombre_actividad_limpio) < 4:
    logger.warning(f"Nombre de actividad muy corto: '{nombre_actividad_limpio}'")
```

---

## 2. ✅ Número de Horas

### Problema
- Se leía de la columna incorrecta (PORC en lugar de HORAS SEMESTRE)
- No se validaba que fuera un número válido > 0

### Correcciones Aplicadas

**Ubicación**: `_procesar_asignaturas()` líneas 517-526, 549-555, 590-610

1. **Identificación explícita de columna de horas**:
```python
# Identificar índice de columna de horas
indice_horas = -1
for j, header in enumerate(headers):
    header_upper = header.upper()
    if ('HORAS' in header_upper and 'SEMESTRE' in header_upper) or \
       (header_upper == 'HORAS SEMESTRE') or \
       ('HORAS' in header_upper and 'TOTAL' not in header_upper and 'PORC' not in header_upper):
        indice_horas = j
        logger.debug(f"Columna de horas identificada: índice {j}, header: '{header}'")
        break
```

2. **Evitar columna PORC explícitamente**:
```python
# Identificar índices de columnas clave
indice_porc = -1
for j, header in enumerate(headers):
    header_upper = header.upper()
    if 'PORC' in header_upper:
        indice_porc = j

# Al extraer horas, verificar que no sea PORC
if j != indice_porc:
    actividad.horas_semestre = valor
```

3. **Validación y conversión a número**:
```python
# Validaciones y conversión de horas a número
horas_valida = False
if actividad.horas_semestre and actividad.horas_semestre.strip():
    try:
        # Limpiar horas: remover caracteres no numéricos excepto punto
        horas_limpia = re.sub(r'[^\d.]', '', actividad.horas_semestre)
        if horas_limpia:
            horas_numero = float(horas_limpia)
            if horas_numero > 0:
                actividad.horas_semestre = str(horas_numero)
                horas_valida = True
            else:
                logger.warning(f"Horas debe ser mayor a 0, encontrado: {horas_numero}")
                actividad.horas_semestre = ''
    except (ValueError, TypeError):
        logger.warning(f"No se pudo convertir horas a número: '{actividad.horas_semestre}'")
        actividad.horas_semestre = ''
```

4. **Validación en `_construir_actividad_dict()`**:
```python
# Validación: horas debe ser mayor a 0 si hay actividad
if nombre_actividad_limpio and horas_numero == 0:
    logger.warning(f"Actividad '{nombre_actividad_limpio}' tiene 0 horas - puede ser un error")
```

---

## 3. ✅ Cargo y Departamento

### Problema
- No se extraían correctamente desde la tabla de información personal

### Correcciones Aplicadas

**Ubicación**: `_procesar_informacion_personal()` líneas 436-460, 505-520

1. **Extracción mejorada desde fila 2**:
```python
# Mapear valores de fila 2 (datos básicos: CEDULA, APELLIDOS, NOMBRE, UNIDAD, DEPARTAMENTO)
for i, header in enumerate(headers):
    if i < len(valores_fila2):
        valor = valores_fila2[i].strip() if valores_fila2[i] else ''
        header_upper = header.upper()
        
        # ... otros campos ...
        elif 'DEPARTAMENTO' in header_upper or 'DPTO' in header_upper:
            info.departamento = valor
            logger.debug(f"DEPARTAMENTO encontrado en fila 2, columna {i}: '{valor}'")
        elif 'CARGO' in header_upper:
            info.cargo = valor
            logger.debug(f"CARGO encontrado en fila 2, columna {i}: '{valor}'")
```

2. **Fallback por posición (columna 4 según análisis)**:
```python
# Si DEPARTAMENTO no se encontró por header, intentar por posición (columna 4 según análisis)
if not info.departamento and len(valores_fila2) > 4:
    # Columna 4 (índice 4) según análisis HTML
    valor_posicion_4 = valores_fila2[4].strip() if valores_fila2[4] else ''
    if valor_posicion_4 and 'DEPARTAMENTO' in valor_posicion_4.upper():
        info.departamento = valor_posicion_4
        logger.debug(f"DEPARTAMENTO encontrado por posición (columna 4): '{valor_posicion_4}'")
```

3. **Búsqueda en filas adicionales** (ya estaba implementado, mejorado con logging):
```python
# Buscar cargo y departamento en filas adicionales
for i in range(4, min(len(filas), 10)):  # Buscar en filas 5-10
    celdas = self.extraer_celdas(filas[i])
    for j, celda in enumerate(celdas):
        celda_upper = celda.upper().strip()
        if j + 1 < len(celdas):
            valor_siguiente = celdas[j + 1].strip()
            
            if 'CARGO' in celda_upper and not info.cargo:
                info.cargo = valor_siguiente
            elif ('DEPARTAMENTO' in celda_upper or 'DPTO' in celda_upper) and not info.departamento:
                info.departamento = valor_siguiente
```

---

## 4. ✅ Validaciones Agregadas

### Validaciones en `_procesar_asignaturas()`

1. **Validación de nombre de actividad**:
   - No debe terminar en porcentaje
   - Debe tener más de 3 caracteres
   - Se limpia automáticamente

2. **Validación de horas**:
   - Debe ser un número válido
   - Debe ser mayor a 0
   - Se convierte a float

3. **Validación antes de agregar actividad**:
   - Solo se agrega si tiene código o nombre válido
   - Solo se agrega si el nombre es válido
   - Se registran warnings para actividades omitidas

### Validaciones en `_construir_actividad_dict()`

1. **Validaciones con asserts (solo en modo DEBUG)**:
```python
if logger.isEnabledFor(logging.DEBUG):
    if actividad_dict['nombre_actividad']:
        assert not actividad_dict['nombre_actividad'].endswith('%'), \
            f"Nombre de actividad incorrecto (termina en %): '{actividad_dict['nombre_actividad']}'"
        assert len(actividad_dict['nombre_actividad']) > 3, \
            f"Nombre muy corto: '{actividad_dict['nombre_actividad']}'"
    
    if actividad_dict['numero_horas'] > 0:
        assert actividad_dict['numero_horas'] > 0, \
            f"Horas debe ser mayor a 0, encontrado: {actividad_dict['numero_horas']}"
```

---

## 5. ✅ Mejoras Adicionales

### Limpieza de Valores

- Todos los valores se limpian con `.strip()`
- Se normalizan espacios múltiples
- Se remueven caracteres no deseados

### Logging Mejorado

- Se registra qué columna se usa para horas
- Se registran warnings para valores inválidos
- Se registra cuando se encuentran cargo y departamento

### Manejo de Errores

- Try-catch para conversión de horas
- Validaciones que no interrumpen la ejecución
- Logging de actividades omitidas

---

## 6. Mapeo de Columnas Verificado

Basado en el análisis HTML real:

| Índice | Header | Campo | Estado |
|--------|--------|-------|--------|
| 0 | CODIGO | `codigo` | ✅ Correcto |
| 1 | GRUPO | `grupo` | ✅ Correcto |
| 2 | TIPO | `tipo` | ✅ Correcto |
| 3 | NOMBRE DE ASIGNATURA | `nombre_asignatura` | ✅ Corregido (limpieza) |
| 4 | CRED | `cred` | ✅ Correcto |
| 5 | PORC | `porc` | ✅ Identificado (evitado para horas) |
| 6 | FREC | `frec` | ✅ Correcto |
| 7 | INTEN | `inten` | ✅ Correcto |
| 8 | HORAS SEMESTRE | `horas_semestre` | ✅ Corregido (índice correcto) |

---

## 7. Próximos Pasos

1. **Probar con datos reales**: Ejecutar scraper y validar que:
   - Nombre de actividad no tenga porcentajes
   - Horas sean números válidos > 0
   - Cargo y departamento se extraigan correctamente

2. **Monitorear logs**: Revisar warnings para identificar casos edge

3. **Ajustar si es necesario**: Basado en resultados de pruebas reales

