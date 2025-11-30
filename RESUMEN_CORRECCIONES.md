# Resumen de Correcciones - Extracción de Datos

## Problemas Corregidos

### ✅ 1. Nombre de Actividad
**Problema original**: Extraía solo "HISTORIA IDEAS EN CIENCIAS DE LA SALUD" o "2%"
**Solución**: Ahora combina código y nombre: `"626001C - HISTORIA IDEAS EN CIENCIAS DE LA SALUD"`

**Archivos modificados**:
- `scraper/services/univalle_scraper.py` líneas 993-1003 (pregrado)
- `scraper/services/univalle_scraper.py` líneas 1016-1026 (postgrado)

**Código agregado**:
```python
# Combinar código y nombre: "626001C - HISTORIA IDEAS EN CIENCIAS DE LA SALUD"
nombre_completo_actividad = actividad.nombre_asignatura
if actividad.codigo and actividad.nombre_asignatura:
    nombre_completo_actividad = f"{actividad.codigo} - {actividad.nombre_asignatura}"
elif actividad.codigo:
    nombre_completo_actividad = actividad.codigo
```

### ✅ 2. Número de Horas
**Problema original**: Siempre extraía 0
**Causa identificada**: Se estaba leyendo la columna PORC (porcentaje, "2%") en lugar de HORAS SEMESTRE

**Solución implementada**:
- Identificación explícita de columna de horas por header
- Evita confundir con columna PORC
- Búsqueda fallback en valores numéricos
- Logging mejorado para debugging

**Archivos modificados**:
- `scraper/services/univalle_scraper.py` líneas 461-520 (`_procesar_asignaturas`)

**Mejoras clave**:
```python
# Identificar índice de columna de horas
indice_horas = -1
for j, header in enumerate(headers):
    header_upper = header.upper()
    if ('HORAS' in header_upper and 'SEMESTRE' in header_upper) or \
       (header_upper == 'HORAS SEMESTRE') or \
       ('HORAS' in header_upper and 'TOTAL' not in header_upper and 'PORC' not in header_upper):
        indice_horas = j
        break

# Búsqueda fallback si no se encuentra por header
if not actividad.horas_semestre or not actividad.horas_semestre.strip():
    # Buscar valores numéricos que podrían ser horas
    # (evitando columnas conocidas como PORC, CRED, etc.)
```

### ✅ 3. Cargo y Departamento
**Problema original**: No se extraían estos campos

**Solución implementada**:
- Búsqueda en headers de fila 2 y fila 4
- Búsqueda en filas adicionales (5-10) con formato "CARGO=valor"
- Extracción desde múltiples posiciones posibles
- También extrae ESCUELA si está disponible

**Archivos modificados**:
- `scraper/services/univalle_scraper.py` líneas 422-505 (`_procesar_informacion_personal`)

**Código agregado**:
```python
# Buscar cargo y departamento en headers de fila 2
elif 'CARGO' in header_upper:
    info.cargo = valor
elif 'DEPARTAMENTO' in header_upper or 'DPTO' in header_upper:
    info.departamento = valor

# Buscar en filas adicionales
for i in range(4, min(len(filas), 10)):
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

## Estructura de Tabla HTML Documentada

### Tabla de Asignaturas
```
Headers: CODIGO | GRUPO | TIPO | NOMBRE DE ASIGNATURA | CRED | PORC | FREC | INTEN | HORAS SEMESTRE
```

**Mapeo de columnas**:
- Índice 0: CODIGO → `actividad.codigo`
- Índice 3: NOMBRE DE ASIGNATURA → `actividad.nombre_asignatura`
- Índice 5: PORC → `actividad.porc` ⚠️ NO confundir con horas
- Índice 8: HORAS SEMESTRE → `actividad.horas_semestre` ✅

### Tabla de Información Personal
```
Fila 0: Headers (CEDULA, APELLIDOS, NOMBRE, etc.)
Fila 1: Valores básicos
Fila 2: Headers (VINCULACION, CATEGORIA, etc.)
Fila 3: Valores laborales
Fila 4+: Posibles campos adicionales (CARGO, DEPARTAMENTO, ESCUELA)
```

## Próximos Pasos

1. **Probar con datos reales**:
   - Ejecutar scraper con una cédula conocida
   - Verificar que nombre_actividad tenga formato "CODIGO - NOMBRE"
   - Verificar que horas no sea 0
   - Verificar que cargo y departamento se extraigan

2. **Revisar logs**:
   - Los logs ahora muestran qué columna se usa para horas
   - Revisar para validar extracción correcta

3. **Ajustes adicionales si es necesario**:
   - Si cargo/departamento no se encuentran, revisar HTML de ejemplo
   - Ajustar búsqueda en filas adicionales según estructura real

## Notas Técnicas

- Se agregó logging detallado para facilitar debugging
- La extracción de horas tiene fallback para casos edge
- La extracción de cargo/departamento es robusta con múltiples estrategias
- Compatibilidad mantenida con estructura anterior

