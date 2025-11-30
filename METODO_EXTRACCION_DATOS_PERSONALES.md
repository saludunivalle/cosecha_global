# Método de Extracción de Datos Personales con BeautifulSoup

## Resumen

Se creó un nuevo método `_extraer_datos_personales_con_soup()` que usa BeautifulSoup para extraer datos personales del profesor, específicamente **cargo** y **departamento**, basado en cómo lo hace `web/` en `personal-info.ts`.

---

## Método Creado

### `_extraer_datos_personales_con_soup(html, info)`

**Ubicación**: `scraper/services/univalle_scraper.py` líneas 422-540

**Propósito**: Extraer datos personales usando BeautifulSoup como método principal, complementando el método regex existente.

**Características**:
- Usa BeautifulSoup para parsear HTML de forma más robusta
- Busca tabla de datos personales identificándola por contenido
- Extrae datos de múltiples filas:
  - Fila 2: CEDULA, APELLIDOS, NOMBRE, UNIDAD, **DEPARTAMENTO**
  - Fila 4: VINCULACION, CATEGORIA, DEDICACION, NIVEL, **CARGO**
  - Filas adicionales: Busca formato campo=valor
- Incluye fallbacks y validaciones
- Logging detallado para debugging

---

## Flujo de Integración

### 1. Llamada en `_extraer_actividades_desde_html()`

**Ubicación**: Línea ~1270

```python
# Extraer información personal usando BeautifulSoup (método principal)
self._extraer_datos_personales_con_soup(html, resultado.informacion_personal)

# Extraer información personal desde texto plano como fallback
self._extraer_info_personal_desde_texto_plano(html, resultado.informacion_personal)
```

**Orden de ejecución**:
1. ✅ BeautifulSoup (método principal)
2. ✅ Regex (método original, como complemento)
3. ✅ Texto plano (fallback)

### 2. Uso en Construcción de Actividades

**Ubicación**: Líneas 1295-1305

```python
info = datos_docente.informacion_personal

# Construir datos base compartidos
nombre_completo = self._construir_nombre_completo(info)
escuela = info.unidad_academica or info.escuela or ''
departamento = info.departamento or ''  # ✅ Extraído con BeautifulSoup
vinculacion = info.vinculacion or ''
dedicacion = info.dedicacion or ''
nivel = info.nivel_alcanzado or ''
cargo = info.cargo or ''  # ✅ Extraído con BeautifulSoup
categoria_info = info.categoria or ''
```

### 3. Inclusión en Cada Actividad

**Todas las actividades incluyen cargo y departamento**:

```python
actividades.append(self._construir_actividad_dict(
    cedula=cedula,
    nombre_profesor=nombre_completo,
    escuela=escuela,
    departamento=departamento,  # ✅ Incluido
    tipo_actividad='Pregrado',
    categoria=categoria_info,
    nombre_actividad=nombre_completo_actividad,
    numero_horas=actividad.horas_semestre,
    periodo=periodo_label,
    detalle_actividad=...,
    actividad='Docencia',
    vinculacion=vinculacion,
    dedicacion=dedicacion,
    nivel=nivel,
    cargo=cargo,  # ✅ Incluido
    ...
))
```

---

## Estrategia de Extracción

### 1. Búsqueda de Tabla de Datos Personales

```python
# Buscar todas las tablas
tablas = soup.find_all('table')

for tabla in tablas:
    filas = tabla.find_all('tr')
    
    # Verificar si es tabla de datos personales
    primera_fila_texto = filas[0].get_text(strip=True).upper()
    if 'CEDULA' not in primera_fila_texto and 'APELLIDO' not in primera_fila_texto:
        continue
```

### 2. Extracción desde Fila 2 (Datos Básicos)

```python
# Fila 2 (índice 1): CEDULA, APELLIDOS, NOMBRE, UNIDAD, DEPARTAMENTO
fila2 = filas[1]
celdas_fila2 = fila2.find_all(['td', 'th'])

for i, celda in enumerate(celdas_fila2):
    texto = celda.get_text(strip=True)
    header_texto = headers_fila1[i].get_text(strip=True).upper()
    
    if 'DEPARTAMENTO' in header_texto or 'DPTO' in header_texto:
        info.departamento = texto
    elif 'CARGO' in header_texto:
        info.cargo = texto
```

### 3. Extracción desde Fila 4 (Datos Laborales)

```python
# Fila 4 (índice 3): VINCULACION, CATEGORIA, DEDICACION, NIVEL, CARGO
fila4 = filas[3]
celdas_fila4 = fila4.find_all(['td', 'th'])

# Buscar headers de fila 3 si existen
headers_fila3 = filas[2].find_all(['td', 'th'])

for i, celda in enumerate(celdas_fila4):
    if i < len(headers_fila3):
        header_texto = headers_fila3[i].get_text(strip=True).upper()
        
        if 'CARGO' in header_texto:
            info.cargo = texto
        elif 'DEPARTAMENTO' in header_texto:
            info.departamento = texto
```

### 4. Búsqueda en Filas Adicionales (Formato campo=valor)

```python
# Buscar en filas 5-10 (formato campo=valor)
for i in range(4, min(len(filas), 10)):
    fila = filas[i]
    celdas = fila.find_all(['td', 'th'])
    
    if len(celdas) >= 2:
        for j in range(len(celdas) - 1):
            campo = celdas[j].get_text(strip=True).upper()
            valor = celdas[j + 1].get_text(strip=True)
            
            if 'CARGO' in campo:
                info.cargo = valor
            elif 'DEPARTAMENTO' in campo or 'DPTO' in campo:
                info.departamento = valor
```

### 5. Fallback por Posición

```python
# Si DEPARTAMENTO no se encontró, intentar por posición (columna 4)
if i == 4 and not info.departamento:
    if 'DEPARTAMENTO' in texto.upper():
        info.departamento = texto
```

---

## Ventajas del Método BeautifulSoup

1. **Más robusto**: Maneja mejor HTML malformado
2. **Más legible**: Código más claro y mantenible
3. **Mejor manejo de atributos**: Puede buscar por atributos HTML
4. **Consistente con web/**: Usa el mismo enfoque que la implementación TypeScript
5. **Fallback integrado**: Si falla, el método regex continúa funcionando

---

## Validaciones y Logging

### Validaciones
- Verifica que existan filas antes de procesar
- Verifica que existan celdas antes de acceder
- Solo actualiza campos si no están ya poblados
- Maneja excepciones sin interrumpir el flujo

### Logging
```python
logger.debug("Tabla de datos personales encontrada con BeautifulSoup")
logger.debug(f"DEPARTAMENTO encontrado con BeautifulSoup: '{texto}'")
logger.debug(f"CARGO encontrado con BeautifulSoup: '{texto}'")
logger.warning(f"Error al extraer datos personales con BeautifulSoup: {e}")
```

---

## Integración Completa

### Flujo Completo

1. **Scraping inicia** → `scrape_teacher_data()`
2. **Obtiene HTML** → `obtener_html()`
3. **Extrae actividades** → `_extraer_actividades_desde_html()`
4. **Extrae datos personales** → `_extraer_datos_personales_con_soup()` ✅ **NUEVO**
5. **Procesa tablas** → `_procesar_informacion_personal()` (regex, complemento)
6. **Construye actividades** → Cada actividad incluye `cargo` y `departamento` ✅

### Resultado Final

Cada actividad en el resultado incluye:
```python
{
    'cedula': '...',
    'nombre_profesor': '...',
    'escuela': '...',
    'departamento': 'DEPARTAMENTO DE CIRUGIA',  # ✅ Extraído
    'tipo_actividad': '...',
    'categoria': '...',
    'nombre_actividad': '...',
    'numero_horas': ...,
    'periodo': '...',
    'actividad': '...',
    'vinculacion': '...',
    'dedicacion': '...',
    'nivel': '...',
    'cargo': 'PROFESOR ASISTENTE',  # ✅ Extraído
    ...
}
```

---

## Próximos Pasos

1. **Probar con datos reales**: Validar que cargo y departamento se extraigan correctamente
2. **Monitorear logs**: Revisar mensajes de debug para identificar casos edge
3. **Ajustar si es necesario**: Basado en resultados de pruebas reales

---

## Compatibilidad

- ✅ Compatible con método regex existente (ambos se ejecutan)
- ✅ No rompe funcionalidad existente
- ✅ Fallback automático si BeautifulSoup falla
- ✅ Logging detallado para debugging

