# Análisis de Estructura HTML - Tablas de Actividades

## Resumen del Análisis

Se analizó un HTML real del portal Univalle (cédula 10015949, período 2026-1) y se identificó la estructura exacta de las tablas.

---

## 1. Tabla de Asignaturas

### Estructura de Columnas

**Total de columnas: 9**

| Índice | Header | Campo Extraído | Ejemplo de Valor |
|--------|--------|----------------|------------------|
| 0 | CODIGO | `actividad.codigo` | `'610022'` |
| 1 | GRUPO | `actividad.grupo` | `'1'` |
| 2 | TIPO | `actividad.tipo` | `'CL'` |
| 3 | NOMBRE DE ASIGNATURA | `actividad.nombre_asignatura` | `'CIRUGÍA PEDIÁTRICA AVAN'` |
| 4 | CRED | `actividad.cred` | `'20'` |
| 5 | PORC | `actividad.porc` | `'1%'` ⚠️ **NO es horas** |
| 6 | FREC | `actividad.frec` | `''` |
| 7 | INTEN | `actividad.inten` | `''` |
| 8 | HORAS SEMESTRE | `actividad.horas_semestre` | `'45.00'` ✅ |

### ⚠️ Problema Identificado: Columna PORC vs HORAS

**El problema de "2%" era porque se estaba leyendo la columna PORC (índice 5) en lugar de HORAS SEMESTRE (índice 8).**

- **Columna 5 (PORC)**: Contiene porcentaje (ej: "1%", "2%")
- **Columna 8 (HORAS SEMESTRE)**: Contiene horas reales (ej: "45.00")

### Estructura HTML de una Fila

```html
<tr>
  <!-- Columna 0: CODIGO (colspan="3") -->
  <td colspan="3" nowrap height="22">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333">610022</font>
    </div>
  </td>
  
  <!-- Columna 1: GRUPO -->
  <td width="39" height="22">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333">1</font>
    </div>
  </td>
  
  <!-- Columna 2: TIPO -->
  <td width="41" height="22">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333">CL</font>
    </div>
  </td>
  
  <!-- Columna 3: NOMBRE DE ASIGNATURA (colspan="4") -->
  <td colspan="4" nowrap height="22">
    <div align="left">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333">CIRUGÍA PEDIÁTRICA AVAN</font>
    </div>
  </td>
  
  <!-- Columna 4: CRED -->
  <td width="27" height="22">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333">20</font>
    </div>
  </td>
  
  <!-- Columna 5: PORC (porcentaje) ⚠️ NO es horas -->
  <td width="35" height="22">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333">1%</font>
    </div>
  </td>
  
  <!-- Columna 6: FREC -->
  <td width="36" height="22">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333"></font>
    </div>
  </td>
  
  <!-- Columna 7: INTEN -->
  <td width="37" height="22">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333"></font>
    </div>
  </td>
  
  <!-- Columna 8: HORAS SEMESTRE (colspan="3") ✅ -->
  <td colspan="3" width="85" height="22">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif" color="#333333">45.00</font>
    </div>
  </td>
</tr>
```

### ⚠️ Importante: Colspan

**Las celdas usan `colspan`**, lo que significa que:
- CODIGO tiene `colspan="3"` (ocupa 3 columnas lógicas)
- NOMBRE DE ASIGNATURA tiene `colspan="4"` (ocupa 4 columnas lógicas)
- HORAS SEMESTRE tiene `colspan="3"` (ocupa 3 columnas lógicas)

**Esto puede causar problemas si la extracción no maneja colspan correctamente.**

---

## 2. Tabla de Información Personal

### Estructura de Filas

**Total de filas: 4**

### Fila 2 (Índice 1): Datos Básicos

| Índice | Campo | Valor de Ejemplo |
|--------|-------|------------------|
| 0 | CEDULA | `'10015949'` |
| 1 | 1 APELLIDO | `'FIGUEROA'` |
| 2 | 2 APELLIDO | `'GUTIERREZ'` |
| 3 | NOMBRE | `'LUIS MAURICIO'` |
| 4 | DEPARTAMENTO | `'DEPARTAMENTO DE CIRUGIA'` ✅ |

**✅ DEPARTAMENTO está en la fila 2, columna 4 (índice 4)**

### Fragmento HTML de Fila 2

```html
<tr>
  <!-- Columna 0: CEDULA -->
  <td width="82" height="15">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif">10015949</font>
    </div>
  </td>
  
  <!-- Columna 1: 1 APELLIDO -->
  <td width="119" height="15">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif">FIGUEROA</font>
    </div>
  </td>
  
  <!-- Columna 2: 2 APELLIDO -->
  <td width="163" height="15">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif">GUTIERREZ</font>
    </div>
  </td>
  
  <!-- Columna 3: NOMBRE -->
  <td width="146" height="15">
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif">LUIS MAURICIO</font>
    </div>
  </td>
  
  <!-- Columna 4: DEPARTAMENTO ✅ -->
  <td>
    <div align="center">
      <font size="1" face="Arial, Helvetica, sans-serif">DEPARTAMENTO DE CIRUGIA</font>
    </div>
  </td>
</tr>
```

### ⚠️ CARGO no encontrado

**CARGO no se encontró en la tabla de información personal analizada.**

Posibles ubicaciones:
1. En otra tabla separada
2. En filas adicionales de la tabla de información personal
3. En texto plano del HTML con formato `CARGO=valor`
4. Puede no estar presente en todos los casos

---

## 3. Mapeo Final: Columna → Campo

### Tabla de Asignaturas

```
Columna 0: CODIGO → actividad.codigo
Columna 1: GRUPO → actividad.grupo
Columna 2: TIPO → actividad.tipo
Columna 3: NOMBRE DE ASIGNATURA → actividad.nombre_asignatura
Columna 4: CRED → actividad.cred
Columna 5: PORC → actividad.porc ⚠️ NO es horas
Columna 6: FREC → actividad.frec
Columna 7: INTEN → actividad.inten
Columna 8: HORAS SEMESTRE → actividad.horas_semestre ✅
```

### Tabla de Información Personal

```
Fila 1 (Headers):
  - CEDULA | 1 APELLIDO | 2 APELLIDO | NOMBRE | DEPARTAMENTO

Fila 2 (Datos):
  Columna 0: CEDULA → info.cedula
  Columna 1: 1 APELLIDO → info.apellido1
  Columna 2: 2 APELLIDO → info.apellido2
  Columna 3: NOMBRE → info.nombre
  Columna 4: DEPARTAMENTO → info.departamento ✅
```

---

## 4. Correcciones Necesarias en el Scraper

### ✅ Ya Corregido

1. **Nombre de actividad**: Ahora combina código y nombre
2. **Horas**: Identifica correctamente columna 8 (HORAS SEMESTRE) y evita columna 5 (PORC)

### 🔧 Pendiente de Verificar

1. **Manejo de colspan**: Verificar que `extraer_celdas()` maneje correctamente `colspan`
2. **DEPARTAMENTO**: Ya se extrae de fila 2, columna 4 ✅
3. **CARGO**: Buscar en otras ubicaciones (otras tablas, filas adicionales, texto plano)

---

## 5. Recomendaciones

1. **Verificar manejo de colspan**: Asegurar que cuando una celda tiene `colspan="3"`, se cuente como 3 celdas lógicas
2. **Buscar CARGO en otras ubicaciones**: 
   - Revisar todas las tablas del HTML
   - Buscar en texto plano con regex
   - Verificar si está en actividades administrativas
3. **Validar extracción de horas**: Confirmar que siempre se lee de columna 8, no de columna 5

---

## 6. Fragmentos HTML de Ejemplo

### Fila de Actividad Completa

Ver sección 1.3 "Estructura HTML de una Fila" arriba.

### Sección DEPARTAMENTO

Ver sección 2.2 "Fragmento HTML de Fila 2" arriba.

### Sección CARGO

**No encontrada en el HTML analizado.** Se requiere análisis adicional o HTML de otro docente que tenga cargo definido.

