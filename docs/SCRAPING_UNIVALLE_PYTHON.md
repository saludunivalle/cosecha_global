# Documentación: Scraping del Aplicativo Univalle (vin_asignacion.php3) para Python

Esta documentación describe la lógica exacta del scraping del portal Univalle basada en el código TypeScript/JavaScript existente en `src/web/`, con instrucciones para replicarla en Python.

## Tabla de Contenidos

1. [Construcción de la URL](#1-construcción-de-la-url)
2. [Parseo del HTML](#2-parseo-del-html)
3. [Selectores y Extracción de Datos](#3-selectores-y-extracción-de-datos)
4. [Manejo de Múltiples Actividades](#4-manejo-de-múltiples-actividades)
5. [Ejemplo de Implementación Python](#5-ejemplo-de-implementación-python)

---

## 1. Construcción de la URL

### 1.1 URL Base

```
https://proxse26.univalle.edu.co/asignacion/vin_inicio_impresion.php3
```

### 1.2 Parámetros de Consulta

La URL se construye con dos parámetros GET:

- `cedula`: Número de cédula del docente (ejemplo: `1112966620`)
- `periodo`: ID numérico del período académico (ejemplo: `48`)

### 1.3 Formato Completo

```python
def construir_url(cedula: str, id_periodo: int) -> str:
    """
    Construye la URL para consultar datos de un docente.
    
    Args:
        cedula: Número de cédula del docente (sin puntos ni guiones)
        id_periodo: ID numérico del período académico
        
    Returns:
        URL completa con parámetros
    """
    base_url = "https://proxse26.univalle.edu.co/asignacion/vin_inicio_impresion.php3"
    return f"{base_url}?cedula={cedula}&periodo={id_periodo}"
```

### 1.4 Headers HTTP

Aunque las cookies **NO son requeridas** actualmente (el portal funciona sin autenticación), el código mantiene compatibilidad:

```python
def construir_headers(cookies: dict = None) -> dict:
    """
    Construye headers HTTP para la petición.
    
    Args:
        cookies: Diccionario opcional con 'PHPSESSID' y/o 'asigacad'
        
    Returns:
        Diccionario con headers HTTP
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    # Opcional: agregar cookies si están disponibles
    if cookies:
        cookie_parts = []
        if cookies.get('asigacad'):
            cookie_parts.append(f"asigacad={cookies['asigacad']}")
        if cookies.get('PHPSESSID'):
            cookie_parts.append(f"PHPSESSID={cookies['PHPSESSID']}")
        
        if cookie_parts:
            headers['Cookie'] = '; '.join(cookie_parts)
    
    return headers
```

### 1.5 Codificación de Respuesta

**IMPORTANTE**: El HTML viene codificado en **ISO-8859-1** (Latin-1), no UTF-8.

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def obtener_html(cedula: str, id_periodo: int, cookies: dict = None) -> str:
    """
    Realiza la petición HTTP y obtiene el HTML.
    
    Args:
        cedula: Número de cédula del docente
        id_periodo: ID del período académico
        cookies: Cookies opcionales
        
    Returns:
        HTML decodificado en ISO-8859-1
    """
    url = construir_url(cedula, id_periodo)
    headers = construir_headers(cookies)
    
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    
    # CRÍTICO: Decodificar como ISO-8859-1
    response.encoding = 'iso-8859-1'
    html = response.text
    
    # Verificar que no sea una respuesta vacía
    if len(html) < 100:
        raise ValueError("Respuesta vacía o muy corta del servidor")
    
    return html
```

### 1.6 Manejo de Framesets

Si el HTML contiene un `<frameset>`, es necesario extraer el contenido del frame:

```python
import re
from bs4 import BeautifulSoup

def manejar_frameset(html: str, base_url: str, cookies: dict = None) -> str:
    """
    Maneja framesets extrayendo el contenido del frame principal.
    
    Args:
        html: HTML que puede contener frameset
        base_url: URL base para construir URLs relativas
        cookies: Cookies opcionales
        
    Returns:
        HTML del contenido del frame o HTML original
    """
    if '<frameset' in html.lower() or '<frame' in html.lower():
        # Buscar el frame con name="mainFrame_"
        match = re.search(r'name=["\']mainFrame_["\'][^>]*src=["\']([^"\']+)["\']', html, re.IGNORECASE)
        if match:
            frame_src = match.group(1)
            
            # Construir URL completa si es relativa
            if not frame_src.startswith('http'):
                frame_url = f"{base_url.rstrip('/asignacion')}/{frame_src.lstrip('/')}"
            else:
                frame_url = frame_src
            
            # Obtener contenido del frame
            headers = construir_headers(cookies)
            if cookies:
                headers['Referer'] = base_url
            
            response = requests.get(frame_url, headers=headers, timeout=30)
            response.encoding = 'iso-8859-1'
            return response.text
    
    return html
```

---

## 2. Parseo del HTML

### 2.1 Extracción de Tablas

El HTML contiene múltiples tablas. Se extraen todas usando regex:

```python
import re

def extraer_tablas(html: str) -> list:
    """
    Extrae todas las tablas del HTML usando regex.
    
    Args:
        html: HTML completo
        
    Returns:
        Lista de strings HTML de cada tabla
    """
    # Regex que captura tablas completas (incluyendo anidadas)
    pattern = r'<table[^>]*>[\s\S]*?</table>'
    matches = re.findall(pattern, html, re.IGNORECASE)
    return matches if matches else []
```

### 2.2 Extracción de Filas

Para cada tabla, se extraen las filas (`<tr>`):

```python
def extraer_filas(tabla_html: str) -> list:
    """
    Extrae todas las filas de una tabla.
    
    Args:
        tabla_html: HTML de una tabla
        
    Returns:
        Lista de strings HTML de cada fila
    """
    pattern = r'<tr[^>]*>[\s\S]*?</tr>'
    matches = re.findall(pattern, tabla_html, re.IGNORECASE)
    return matches if matches else []
```

### 2.3 Extracción de Celdas

Para cada fila, se extraen las celdas (`<td>` o `<th>`) manejando `colspan`:

```python
def extraer_texto_de_celda(celda_html: str) -> str:
    """
    Extrae el texto limpio de una celda HTML.
    
    Args:
        celda_html: HTML de una celda (<td> o <th>)
        
    Returns:
        Texto limpio sin tags HTML ni entidades
    """
    # Remover tags HTML
    texto = re.sub(r'<[^>]+>', '', celda_html)
    
    # Decodificar entidades HTML comunes
    entidades = {
        '&aacute;': 'á', '&Aacute;': 'Á',
        '&eacute;': 'é', '&Eacute;': 'É',
        '&iacute;': 'í', '&Iacute;': 'Í',
        '&oacute;': 'ó', '&Oacute;': 'Ó',
        '&uacute;': 'ú', '&Uacute;': 'Ú',
        '&ntilde;': 'ñ', '&Ntilde;': 'Ñ',
        '&amp;': '&',
        '&quot;': '"',
        '&lt;': '<',
        '&gt;': '>',
        '&nbsp;': ' ',
    }
    
    for entidad, caracter in entidades.items():
        texto = texto.replace(entidad, caracter)
    
    # Normalizar espacios
    texto = ' '.join(texto.split())
    
    return texto.strip()


def extraer_celdas(fila_html: str) -> list:
    """
    Extrae las celdas de una fila, manejando colspan.
    
    Args:
        fila_html: HTML de una fila
        
    Returns:
        Lista de textos de celdas (replicadas según colspan)
    """
    # Buscar todas las celdas
    pattern = r'<t[dh][^>]*>([\s\S]*?)</t[dh]>'
    matches = re.findall(pattern, fila_html, re.IGNORECASE)
    
    celdas = []
    for match in matches:
        # Buscar colspan
        colspan_match = re.search(r'colspan=["\']?(\d+)["\']?', match, re.IGNORECASE)
        colspan = int(colspan_match.group(1)) if colspan_match else 1
        
        # Extraer texto
        texto = extraer_texto_de_celda(match)
        
        # Replicar según colspan
        for _ in range(colspan):
            celdas.append(texto)
    
    return celdas
```

---

## 3. Selectores y Extracción de Datos

### 3.1 Información Personal

#### 3.1.1 Identificación de la Tabla

La tabla de información personal se identifica por:

- Tiene headers que incluyen "CEDULA" o "DOCUMENTO" o "DOCENTES"
- Y headers que incluyen "APELLIDO" o "NOMBRE"

```python
def es_tabla_informacion_personal(headers: list) -> bool:
    """
    Verifica si una tabla es de información personal.
    
    Args:
        headers: Lista de headers normalizados (mayúsculas)
        
    Returns:
        True si es tabla de información personal
    """
    headers_upper = [h.upper() for h in headers]
    
    tiene_cedula = any(
        'CEDULA' in h or 'DOCUMENTO' in h or h == 'DOCENTES' or 'IDENTIFICACION' in h
        for h in headers_upper
    )
    
    tiene_apellido = any(
        'APELLIDO' in h or 'APELLIDOS' in h or 'NOMBRE' in h
        for h in headers_upper
    )
    
    return tiene_cedula and tiene_apellido
```

#### 3.1.2 Extracción de Campos

Los campos se extraen desde la **segunda fila** (índice 1) y **cuarta fila** (índice 3):

```python
def extraer_informacion_personal(tabla_html: str) -> dict:
    """
    Extrae información personal de una tabla.
    
    Args:
        tabla_html: HTML de la tabla de información personal
        
    Returns:
        Diccionario con información personal
    """
    informacion = {}
    
    filas = extraer_filas(tabla_html)
    if len(filas) < 4:
        return informacion
    
    # Primera fila: headers (índice 0)
    headers = extraer_celdas(filas[0])
    
    # Segunda fila: datos básicos (índice 1)
    valores_fila2 = extraer_celdas(filas[1])
    
    # Mapear valores a campos
    for i, header in enumerate(headers):
        if i < len(valores_fila2):
            valor = valores_fila2[i]
            header_upper = header.upper().strip()
            
            if 'CEDULA' in header_upper or header_upper == 'DOCENTES' or 'DOCUMENTO' in header_upper:
                informacion['CEDULA'] = valor
            
            if '1 APELLIDO' in header_upper or header_upper == 'APELLIDO1' or 'PRIMER APELLIDO' in header_upper:
                informacion['1 APELLIDO'] = valor
            
            if '2 APELLIDO' in header_upper or header_upper == 'APELLIDO2' or 'SEGUNDO APELLIDO' in header_upper:
                informacion['2 APELLIDO'] = valor
            
            if header_upper == 'NOMBRE' or ('NOMBRES' in header_upper and 'COMPLETO' not in header_upper):
                informacion['NOMBRE'] = valor
            
            if 'UNIDAD' in header_upper and 'ACADEMICA' in header_upper:
                informacion['UNIDAD ACADEMICA'] = valor
    
    # Cuarta fila: información laboral (índice 3)
    valores_fila4 = extraer_celdas(filas[3])
    
    if len(valores_fila4) >= 5:
        informacion['VINCULACION'] = valores_fila4[0]
        informacion['CATEGORIA'] = valores_fila4[1]
        informacion['DEDICACION'] = valores_fila4[2]
        informacion['NIVEL ALCANZADO'] = valores_fila4[3]
        informacion['CENTRO COSTO'] = valores_fila4[4]
    
    return informacion
```

#### 3.1.3 Extracción desde Texto Plano (Fallback)

Si no se encuentra en la tabla, se busca en el texto plano usando regex:

```python
def extraer_campos_desde_texto_plano(html: str) -> dict:
    """
    Extrae campos desde texto plano como fallback.
    
    Busca patrones como: VINCULACION=valor, CATEGORIA=valor, etc.
    
    Args:
        html: HTML completo
        
    Returns:
        Diccionario con campos encontrados
    """
    informacion = {}
    
    # Normalizar HTML
    html_norm = html.replace('&nbsp;', ' ').replace('\n', ' ')
    html_norm = re.sub(r'\s+', ' ', html_norm)
    
    # Patrones para buscar
    patrones = {
        'VINCULACION': [
            r'VINCULACION\s*[=:]\s*([^\s,<>&"\']+)',
            r'VINCULACI[OÓ]N\s*[=:]\s*([^\s,<>&"\']+)',
        ],
        'CATEGORIA': [
            r'CATEGORIA\s*[=:]\s*([^\s,<>&"\']+)',
            r'CATEGOR[IÍ]A\s*[=:]\s*([^\s,<>&"\']+)',
        ],
        'DEDICACION': [
            r'DEDICACION\s*[=:]\s*([^\s,<>&"\']+)',
            r'DEDICACI[OÓ]N\s*[=:]\s*([^\s,<>&"\']+)',
        ],
        'NIVEL ALCANZADO': [
            r'NIVEL\s+ALCANZADO\s*[=:]\s*([^\s,<>&"\']+)',
        ],
    }
    
    for campo, regexes in patrones.items():
        for regex in regexes:
            match = re.search(regex, html_norm, re.IGNORECASE)
            if match:
                valor = match.group(1).strip()
                if valor and len(valor) < 100 and '<' not in valor:
                    informacion[campo] = valor
                    break
    
    return informacion
```

### 3.2 Actividades de Docencia

#### 3.2.1 Identificación de Tabla de Asignaturas

La tabla se identifica por:

- Tiene header "CODIGO" (pero NO "CODIGO ESTUDIANTE")
- Y ("NOMBRE DE ASIGNATURA" o "TIPO" o "GRUPO")
- Y "HORAS" o "SEMESTRE"
- Y NO tiene "ESTUDIANTE" ni "TESIS"

```python
def es_tabla_asignaturas(headers: list) -> bool:
    """
    Verifica si una tabla es de asignaturas (pregrado/postgrado).
    
    Args:
        headers: Lista de headers normalizados
        
    Returns:
        True si es tabla de asignaturas
    """
    headers_upper = [h.upper() for h in headers]
    
    tiene_codigo = any(
        h == 'CODIGO' or ('CODIGO' in h and 'ESTUDIANTE' not in h)
        for h in headers_upper
    )
    
    tiene_nombre = any('NOMBRE' in h and 'ASIGNATURA' in h for h in headers_upper)
    tiene_tipo = any(h == 'TIPO' or 'TIPO' in h for h in headers_upper)
    tiene_grupo = any(h == 'GRUPO' or 'GRUPO' in h for h in headers_upper)
    tiene_horas = any('HORAS' in h or 'SEMESTRE' in h for h in headers_upper)
    
    no_es_tesis = not any(
        'ESTUDIANTE' in h or 'TESIS' in h
        for h in headers_upper
    )
    
    return (tiene_codigo and 
            (tiene_nombre or tiene_tipo or tiene_grupo) and 
            no_es_tesis and 
            tiene_horas)
```

#### 3.2.2 Extracción de Actividades

Cada fila después del header representa una actividad:

```python
def extraer_actividades_asignaturas(tabla_html: str) -> tuple:
    """
    Extrae actividades de asignaturas (pregrado y postgrado).
    
    Args:
        tabla_html: HTML de la tabla de asignaturas
        
    Returns:
        Tupla (pregrado_list, postgrado_list)
    """
    pregrado = []
    postgrado = []
    
    filas = extraer_filas(tabla_html)
    if len(filas) < 2:
        return pregrado, postgrado
    
    # Encontrar fila de headers
    headers = extraer_celdas(filas[0])
    header_index = 0
    
    # Procesar cada fila de datos
    for i in range(1, len(filas)):
        celdas = extraer_celdas(filas[i])
        
        # Omitir filas vacías
        if all(not c or not c.strip() for c in celdas):
            continue
        
        # Crear objeto actividad
        actividad = {}
        for j, header in enumerate(headers):
            if j < len(celdas):
                actividad[header] = celdas[j]
        
        # Normalizar estructura
        actividad_normalizada = normalizar_asignatura(actividad, headers)
        
        # Clasificar como pregrado o postgrado
        if es_actividad_postgrado(actividad_normalizada):
            postgrado.append(actividad_normalizada)
        else:
            pregrado.append(actividad_normalizada)
    
    return pregrado, postgrado


def normalizar_asignatura(actividad: dict, headers: list) -> dict:
    """
    Normaliza estructura de asignatura.
    
    Args:
        actividad: Diccionario con valores de celdas
        headers: Lista de headers
        
    Returns:
        Estructura normalizada
    """
    normalizada = {
        'CODIGO': '',
        'GRUPO': '',
        'TIPO': '',
        'NOMBRE DE ASIGNATURA': '',
        'CRED': '',
        'PORC': '',
        'FREC': '',
        'INTEN': '',
        'HORAS SEMESTRE': '',
    }
    
    for header in headers:
        header_upper = header.upper()
        valor = actividad.get(header, '')
        
        if 'CODIGO' in header_upper:
            normalizada['CODIGO'] = valor
        elif 'GRUPO' in header_upper:
            normalizada['GRUPO'] = valor
        elif 'TIPO' in header_upper:
            normalizada['TIPO'] = valor
        elif 'NOMBRE' in header_upper and 'ASIGNATURA' in header_upper:
            normalizada['NOMBRE DE ASIGNATURA'] = valor
        elif 'CRED' in header_upper:
            normalizada['CRED'] = valor
        elif 'PORC' in header_upper:
            normalizada['PORC'] = valor
        elif 'FREC' in header_upper:
            normalizada['FREC'] = valor
        elif 'INTEN' in header_upper:
            normalizada['INTEN'] = valor
        elif 'HORAS' in header_upper and 'SEMESTRE' in header_upper:
            normalizada['HORAS SEMESTRE'] = valor
        elif header_upper == 'HORAS':
            normalizada['HORAS SEMESTRE'] = valor
    
    return normalizada
```

#### 3.2.3 Clasificación Pregrado/Postgrado

```python
KEYWORDS_POSTGRADO = [
    'MAESTRIA', 'MAESTRÍA', 'MAGISTER', 'MASTER', 'MAESTR',
    'DOCTORADO', 'DOCTORAL', 'PHD', 'DOCTOR',
    'ESPECIALIZA', 'ESPECIALIZACION', 'ESPECIALIZACIÓN',
    'POSTGRADO', 'POSGRADO', 'POST-GRADO', 'POST GRADO',
]

KEYWORDS_PREGRADO = [
    'LICENCIATURA', 'INGENIERIA', 'INGENERÍA',
    'BACHILLERATO', 'TECNOLOGIA', 'TECNOLOGÍA',
    'PROFESIONAL', 'CARRERA', 'PREGRADO',
]

def es_actividad_postgrado(actividad: dict) -> bool:
    """
    Determina si una actividad es de postgrado.
    
    Args:
        actividad: Actividad normalizada
        
    Returns:
        True si es postgrado
    """
    codigo = str(actividad.get('CODIGO', '')).strip()
    nombre = str(actividad.get('NOMBRE DE ASIGNATURA', '')).upper().strip()
    tipo = str(actividad.get('TIPO', '')).upper().strip()
    
    # Verificar keywords
    if any(kw in nombre or kw in tipo for kw in KEYWORDS_POSTGRADO):
        return True
    
    if any(kw in nombre or kw in tipo for kw in KEYWORDS_PREGRADO):
        return False
    
    # Analizar código numérico
    codigo_limpio = re.sub(r'[A-Za-z]', '', codigo)
    if codigo_limpio and re.match(r'^\d+$', codigo_limpio):
        if es_codigo_postgrado(codigo_limpio):
            return True
        if es_codigo_pregrado(codigo_limpio):
            return False
    
    # Códigos con letras iniciales
    if codigo and re.match(r'^(M|D|E|P)[A-Z0-9]', codigo.upper()):
        return True
    
    if codigo and re.match(r'^(L|I|T|B)[A-Z0-9]', codigo.upper()):
        return False
    
    # Por defecto: pregrado
    return False


def es_codigo_postgrado(codigo: str) -> bool:
    """Verifica si un código numérico es de postgrado."""
    # Códigos que empiezan con 61 seguido de 7-9
    if re.match(r'^61[7-9]\d{2,}$', codigo):
        return True
    # Códigos que empiezan con 7, 8, 9
    if re.match(r'^[7-9]\d{2,}$', codigo):
        return True
    # Códigos que empiezan con 0 seguido de 7-9
    if re.match(r'^0[7-9]\d{2,}$', codigo):
        return True
    return False


def es_codigo_pregrado(codigo: str) -> bool:
    """Verifica si un código numérico es de pregrado."""
    # Códigos que empiezan con 1-5
    if re.match(r'^[1-5]\d{3,}$', codigo):
        return True
    # Códigos que empiezan con 0 seguido de 1-6
    if re.match(r'^0[1-6]\d{2,}$', codigo):
        return True
    return False
```

### 3.3 Actividades de Investigación

#### 3.3.1 Identificación de Tabla de Investigación

Se busca una tabla que contenga:

- Texto "ACTIVIDADES DE INVESTIGACION" o "ACTIVIDADES DE INVESTIGACIÓN"
- Y headers: ("CODIGO" y "NOMBRE DEL PROYECTO" y "HORAS SEMESTRE")
- O headers: ("APROBADO POR" y ("NOMBRE DEL PROYECTO" o "ANTEPROYECTO") y "HORAS SEMESTRE")

```python
def es_tabla_investigacion(tabla_html: str, headers: list) -> bool:
    """
    Verifica si una tabla es de actividades de investigación.
    
    Args:
        tabla_html: HTML de la tabla
        headers: Lista de headers
        
    Returns:
        True si es tabla de investigación
    """
    texto = extraer_texto_de_celda(tabla_html).upper()
    
    tiene_titulo = ('ACTIVIDADES DE INVESTIGACION' in texto or
                    'ACTIVIDADES DE INVESTIGACIÓN' in texto)
    
    if not tiene_titulo:
        return False
    
    headers_upper = [h.upper() for h in headers]
    
    tiene_codigo = 'CODIGO' in texto
    tiene_nombre_proyecto = ('NOMBRE DEL PROYECTO' in texto or
                            'NOMBRE DEL ANTEPROYECTO' in texto)
    tiene_horas = 'HORAS SEMESTRE' in texto
    tiene_aprobado = 'APROBADO POR' in texto
    
    return ((tiene_codigo and tiene_nombre_proyecto and tiene_horas) or
            (tiene_aprobado and tiene_nombre_proyecto and tiene_horas))
```

#### 3.3.2 Extracción de Actividades de Investigación

```python
def extraer_actividades_investigacion(tabla_html: str) -> list:
    """
    Extrae actividades de investigación de una tabla.
    
    Args:
        tabla_html: HTML de la tabla de investigación
        
    Returns:
        Lista de actividades de investigación
    """
    actividades = []
    
    # Buscar tabla anidada dentro de la tabla contenedora
    tabla_interna = buscar_tabla_anidada(tabla_html) or tabla_html
    
    filas = extraer_filas(tabla_interna)
    if len(filas) < 2:
        return actividades
    
    # Encontrar fila de headers
    header_index = -1
    headers = []
    
    for i in range(min(10, len(filas))):
        fila_texto = extraer_texto_de_celda(filas[i]).upper()
        
        tiene_codigo = 'CODIGO' in fila_texto
        tiene_nombre = ('NOMBRE DEL PROYECTO' in fila_texto or
                       'NOMBRE DEL ANTEPROYECTO' in fila_texto)
        tiene_horas = 'HORAS SEMESTRE' in fila_texto
        tiene_aprobado = 'APROBADO POR' in fila_texto
        
        if ((tiene_codigo and tiene_nombre and tiene_horas) or
            (tiene_aprobado and tiene_nombre and tiene_horas)):
            header_index = i
            headers = extraer_celdas(filas[i])
            break
    
    if header_index == -1:
        return actividades
    
    # Procesar filas de datos
    for i in range(header_index + 1, len(filas)):
        celdas = extraer_celdas(filas[i])
        
        if len(celdas) < 2:
            continue
        
        # Omitir filas vacías
        if all(not c or not c.strip() for c in celdas):
            continue
        
        actividad = {}
        for j, header in enumerate(headers):
            if j < len(celdas):
                actividad[header] = celdas[j]
        
        # Normalizar campos importantes
        actividad_normalizada = normalizar_investigacion(actividad, headers)
        
        # Validar que tenga información mínima
        nombre_proyecto = actividad_normalizada.get('NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION', '')
        horas = actividad_normalizada.get('HORAS SEMESTRE', '')
        
        if nombre_proyecto or horas:
            actividades.append(actividad_normalizada)
    
    return actividades


def normalizar_investigacion(actividad: dict, headers: list) -> dict:
    """
    Normaliza estructura de actividad de investigación.
    
    Args:
        actividad: Diccionario con valores
        headers: Lista de headers
        
    Returns:
        Estructura normalizada
    """
    normalizada = {
        'CODIGO': '',
        'APROBADO POR': '',
        'NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION': '',
        'HORAS SEMESTRE': '',
    }
    
    for header in headers:
        header_upper = header.upper()
        valor = actividad.get(header, '')
        
        if 'CODIGO' in header_upper:
            normalizada['CODIGO'] = valor
        elif 'APROBADO' in header_upper and 'POR' in header_upper:
            normalizada['APROBADO POR'] = valor
        elif ('NOMBRE' in header_upper and
              ('PROYECTO' in header_upper or
               'ANTEPROYECTO' in header_upper or
               'PROPUESTA' in header_upper)):
            normalizada['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = valor
        elif 'HORAS' in header_upper and 'SEMESTRE' in header_upper:
            normalizada['HORAS SEMESTRE'] = valor
        
        # Copiar todos los campos originales
        normalizada[header] = valor
    
    return normalizada


def buscar_tabla_anidada(tabla_html: str) -> str:
    """
    Busca tabla anidada dentro de otra tabla.
    
    Args:
        tabla_html: HTML de la tabla contenedora
        
    Returns:
        HTML de la tabla anidada o None
    """
    match = re.search(
        r'<tbody[^>]*>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(<table[^>]*>[\s\S]*?</table>)',
        tabla_html,
        re.IGNORECASE
    )
    return match.group(1) if match else None
```

### 3.4 Dirección de Tesis

#### 3.4.1 Identificación

La tabla de tesis se identifica por:

- Headers que incluyen "ESTUDIANTE"
- Y ("PLAN" o "TITULO" o "TESIS")
- Y NO es tabla de investigación

```python
def es_tabla_tesis(headers: list) -> bool:
    """
    Verifica si una tabla es de dirección de tesis.
    
    Args:
        headers: Lista de headers normalizados
        
    Returns:
        True si es tabla de tesis
    """
    headers_upper = [h.upper() for h in headers]
    
    tiene_estudiante = any('ESTUDIANTE' in h for h in headers_upper)
    tiene_plan = any('PLAN' in h for h in headers_upper)
    tiene_titulo = any('TITULO' in h or 'TESIS' in h for h in headers_upper)
    tiene_codigo_est = any('CODIGO' in h and 'ESTUDIANTE' in h for h in headers_upper)
    
    # No debe ser tabla de investigación
    tiene_anteproyecto = any('ANTEPROYECTO' in h for h in headers_upper)
    tiene_propuesta_inv = any('PROPUESTA' in h and 'INVESTIGACION' in h for h in headers_upper)
    
    if (tiene_anteproyecto or tiene_propuesta_inv) and not tiene_estudiante:
        return False
    
    return (tiene_codigo_est or
            (tiene_estudiante and (tiene_plan or tiene_titulo)))
```

### 3.5 Otras Actividades

#### 3.5.1 Actividades Complementarias

Headers incluyen "PARTICIPACION EN"

#### 3.5.2 Docente en Comisión

Headers incluyen "TIPO DE COMISION"

#### 3.5.3 Actividades Administrativas

Headers incluyen "CARGO" y "DESCRIPCION DEL CARGO"

#### 3.5.4 Actividades de Extensión

Headers incluyen "TIPO" y "NOMBRE" y ("HORAS" o "SEMESTRE") y NO "APROBADO"

#### 3.5.5 Actividades Intelectuales o Artísticas

Headers incluyen "APROBADO POR" y "TIPO" y "NOMBRE" y "HORAS"

---

## 4. Manejo de Múltiples Actividades

### 4.1 Estructura de Datos

Cada profesor puede tener **múltiples actividades del mismo tipo**. El sistema procesa cada fila de la tabla como una actividad independiente:

```python
def procesar_html_completo(html: str, id_periodo: int) -> dict:
    """
    Procesa el HTML completo y extrae todos los datos.
    
    Args:
        html: HTML completo
        id_periodo: ID del período
        
    Returns:
        Diccionario con todos los datos estructurados
    """
    resultado = {
        'periodo': id_periodo,
        'informacionPersonal': {},
        'actividadesDocencia': {
            'pregrado': [],
            'postgrado': [],
            'direccionTesis': [],
        },
        'actividadesInvestigacion': [],
        'actividadesExtension': [],
        'actividadesIntelectualesOArtisticas': [],
        'actividadesAdministrativas': [],
        'actividadesComplementarias': [],
        'docenteEnComision': [],
    }
    
    # Extraer todas las tablas
    tablas = extraer_tablas(html)
    
    # Procesar cada tabla
    for tabla_html in tablas:
        filas = extraer_filas(tabla_html)
        if not filas:
            continue
        
        headers = extraer_celdas(filas[0])
        headers_upper = [h.upper() for h in headers]
        
        # Identificar tipo de tabla y procesar
        if es_tabla_informacion_personal(headers_upper):
            info = extraer_informacion_personal(tabla_html)
            resultado['informacionPersonal'].update(info)
        
        elif es_tabla_asignaturas(headers_upper):
            pregrado, postgrado = extraer_actividades_asignaturas(tabla_html)
            resultado['actividadesDocencia']['pregrado'].extend(pregrado)
            resultado['actividadesDocencia']['postgrado'].extend(postgrado)
        
        elif es_tabla_tesis(headers_upper):
            tesis = extraer_actividades_tesis(tabla_html)
            resultado['actividadesDocencia']['direccionTesis'].extend(tesis)
        
        elif es_tabla_investigacion(tabla_html, headers_upper):
            investigacion = extraer_actividades_investigacion(tabla_html)
            resultado['actividadesInvestigacion'].extend(investigacion)
        
        # ... otros tipos de actividades
    
    return resultado
```

### 4.2 Procesamiento Iterativo

El código itera sobre **todas las filas** de cada tabla, creando una actividad por fila:

```python
def extraer_actividades_asignaturas(tabla_html: str) -> tuple:
    """
    Extrae TODAS las actividades de asignaturas (múltiples filas).
    
    Args:
        tabla_html: HTML de la tabla
        
    Returns:
        Tupla (pregrado_list, postgrado_list)
    """
    pregrado = []
    postgrado = []
    
    filas = extraer_filas(tabla_html)
    if len(filas) < 2:
        return pregrado, postgrado
    
    headers = extraer_celdas(filas[0])
    header_index = 0
    
    # ITERAR sobre todas las filas después del header
    for i in range(header_index + 1, len(filas)):
        celdas = extraer_celdas(filas[i])
        
        # Omitir filas vacías
        if all(not c or not c.strip() for c in celdas):
            continue
        
        # Crear UNA actividad por fila
        actividad = {}
        for j, header in enumerate(headers):
            if j < len(celdas):
                actividad[header] = celdas[j]
        
        actividad_normalizada = normalizar_asignatura(actividad, headers)
        
        # Validar que tenga información mínima
        if not actividad_normalizada.get('CODIGO') and not actividad_normalizada.get('NOMBRE DE ASIGNATURA'):
            continue
        
        # Clasificar y agregar
        if es_actividad_postgrado(actividad_normalizada):
            postgrado.append(actividad_normalizada)  # Agregar a lista
        else:
            pregrado.append(actividad_normalizada)  # Agregar a lista
    
    return pregrado, postgrado
```

### 4.3 Deduplicación (Opcional)

El código original incluye deduplicación basada en un ID generado:

```python
def generar_id_actividad(actividad: dict) -> str:
    """
    Genera un ID único para una actividad basado en sus campos clave.
    
    Args:
        actividad: Actividad normalizada
        
    Returns:
        ID único en formato: codigo|nombre|grupo|tipo
    """
    codigo = str(actividad.get('CODIGO', '')).strip()
    nombre = str(actividad.get('NOMBRE DE ASIGNATURA', '')).strip()
    grupo = str(actividad.get('GRUPO', '')).strip()
    tipo = str(actividad.get('TIPO', '')).strip()
    
    return f"{codigo}|{nombre}|{grupo}|{tipo}".lower()


def deduplicar_actividades(actividades: list) -> list:
    """
    Elimina actividades duplicadas de una lista.
    
    Args:
        actividades: Lista de actividades
        
    Returns:
        Lista sin duplicados
    """
    vistos = set()
    actividades_unicas = []
    
    for actividad in actividades:
        actividad_id = generar_id_actividad(actividad)
        
        if actividad_id in ('|||', ''):
            actividades_unicas.append(actividad)
            continue
        
        if actividad_id not in vistos:
            vistos.add(actividad_id)
            actividades_unicas.append(actividad)
    
    return actividades_unicas
```

---

## 5. Ejemplo de Implementación Python

### 5.1 Módulo Completo

```python
"""
Scraper para el portal Univalle (vin_inicio_impresion.php3)
Basado en la lógica de src/web/lib/
"""

import re
import requests
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field


@dataclass
class InformacionPersonal:
    """Información personal del docente."""
    cedula: str = ''
    nombre: str = ''
    apellido1: str = ''
    apellido2: str = ''
    unidad_academica: str = ''
    vinculacion: str = ''
    categoria: str = ''
    dedicacion: str = ''
    nivel_alcanzado: str = ''
    centro_costo: str = ''


@dataclass
class ActividadAsignatura:
    """Actividad de asignatura (pregrado/postgrado)."""
    codigo: str = ''
    nombre_asignatura: str = ''
    grupo: str = ''
    tipo: str = ''
    horas_semestre: str = ''
    cred: str = ''
    porc: str = ''
    frec: str = ''
    inten: str = ''


@dataclass
class ActividadInvestigacion:
    """Actividad de investigación."""
    codigo: str = ''
    nombre_proyecto: str = ''
    aprobado_por: str = ''
    horas_semestre: str = ''


@dataclass
class DatosDocente:
    """Datos completos de un docente."""
    periodo: int
    informacion_personal: InformacionPersonal = field(default_factory=InformacionPersonal)
    actividades_pregrado: List[ActividadAsignatura] = field(default_factory=list)
    actividades_postgrado: List[ActividadAsignatura] = field(default_factory=list)
    actividades_tesis: List[Dict] = field(default_factory=list)
    actividades_investigacion: List[ActividadInvestigacion] = field(default_factory=list)
    actividades_extension: List[Dict] = field(default_factory=list)
    actividades_intelectuales: List[Dict] = field(default_factory=list)
    actividades_administrativas: List[Dict] = field(default_factory=list)
    actividades_complementarias: List[Dict] = field(default_factory=list)
    docente_en_comision: List[Dict] = field(default_factory=list)


class ScraperUnivalle:
    """Scraper para el portal Univalle."""
    
    BASE_URL = "https://proxse26.univalle.edu.co/asignacion"
    ENDPOINT = f"{BASE_URL}/vin_inicio_impresion.php3"
    
    # Keywords para clasificación
    KEYWORDS_POSTGRADO = [
        'MAESTRIA', 'MAESTRÍA', 'MAGISTER', 'MASTER', 'DOCTORADO',
        'DOCTORAL', 'PHD', 'ESPECIALIZA', 'POSTGRADO', 'POSGRADO',
    ]
    
    KEYWORDS_PREGRADO = [
        'LICENCIATURA', 'INGENIERIA', 'INGENERÍA', 'BACHILLERATO',
        'TECNOLOGIA', 'TECNOLOGÍA', 'PREGRADO',
    ]
    
    def __init__(self, cookies: Optional[Dict[str, str]] = None):
        """
        Inicializa el scraper.
        
        Args:
            cookies: Diccionario opcional con 'PHPSESSID' y/o 'asigacad'
        """
        self.cookies = cookies or {}
        self.session = requests.Session()
        
        # Configurar headers por defecto
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
        })
    
    def construir_url(self, cedula: str, id_periodo: int) -> str:
        """Construye la URL de consulta."""
        return f"{self.ENDPOINT}?cedula={cedula}&periodo={id_periodo}"
    
    def obtener_html(self, cedula: str, id_periodo: int) -> str:
        """
        Obtiene el HTML del portal.
        
        Args:
            cedula: Número de cédula del docente
            id_periodo: ID del período académico
            
        Returns:
            HTML decodificado en ISO-8859-1
        """
        url = self.construir_url(cedula, id_periodo)
        
        # Agregar cookies si están disponibles
        cookies_dict = {}
        if self.cookies.get('PHPSESSID'):
            cookies_dict['PHPSESSID'] = self.cookies['PHPSESSID']
        if self.cookies.get('asigacad'):
            cookies_dict['asigacad'] = self.cookies['asigacad']
        
        response = self.session.get(url, cookies=cookies_dict, timeout=30)
        response.raise_for_status()
        
        # CRÍTICO: Decodificar como ISO-8859-1
        response.encoding = 'iso-8859-1'
        html = response.text
        
        if len(html) < 100:
            raise ValueError("Respuesta vacía o muy corta del servidor")
        
        # Manejar framesets
        if '<frameset' in html.lower() or '<frame' in html.lower():
            html = self._manejar_frameset(html)
        
        return html
    
    def _manejar_frameset(self, html: str) -> str:
        """Maneja framesets extrayendo el contenido del frame."""
        match = re.search(
            r'name=["\']mainFrame_["\'][^>]*src=["\']([^"\']+)["\']',
            html,
            re.IGNORECASE
        )
        if match:
            frame_src = match.group(1)
            if not frame_src.startswith('http'):
                frame_url = f"{self.BASE_URL}/{frame_src.lstrip('/')}"
            else:
                frame_url = frame_src
            
            response = self.session.get(frame_url, timeout=30)
            response.encoding = 'iso-8859-1'
            return response.text
        return html
    
    def extraer_tablas(self, html: str) -> List[str]:
        """Extrae todas las tablas del HTML."""
        pattern = r'<table[^>]*>[\s\S]*?</table>'
        return re.findall(pattern, html, re.IGNORECASE)
    
    def extraer_filas(self, tabla_html: str) -> List[str]:
        """Extrae todas las filas de una tabla."""
        pattern = r'<tr[^>]*>[\s\S]*?</tr>'
        return re.findall(pattern, tabla_html, re.IGNORECASE)
    
    def extraer_texto_de_celda(self, celda_html: str) -> str:
        """Extrae texto limpio de una celda."""
        texto = re.sub(r'<[^>]+>', '', celda_html)
        
        entidades = {
            '&aacute;': 'á', '&Aacute;': 'Á',
            '&eacute;': 'é', '&Eacute;': 'É',
            '&iacute;': 'í', '&Iacute;': 'Í',
            '&oacute;': 'ó', '&Oacute;': 'Ó',
            '&uacute;': 'ú', '&Uacute;': 'Ú',
            '&ntilde;': 'ñ', '&Ntilde;': 'Ñ',
            '&amp;': '&', '&quot;': '"',
            '&lt;': '<', '&gt;': '>',
            '&nbsp;': ' ',
        }
        
        for entidad, caracter in entidades.items():
            texto = texto.replace(entidad, caracter)
        
        return ' '.join(texto.split()).strip()
    
    def extraer_celdas(self, fila_html: str) -> List[str]:
        """Extrae celdas de una fila, manejando colspan."""
        pattern = r'<t[dh][^>]*>([\s\S]*?)</t[dh]>'
        matches = re.findall(pattern, fila_html, re.IGNORECASE)
        
        celdas = []
        for match in matches:
            colspan_match = re.search(r'colspan=["\']?(\d+)["\']?', match, re.IGNORECASE)
            colspan = int(colspan_match.group(1)) if colspan_match else 1
            
            texto = self.extraer_texto_de_celda(match)
            
            for _ in range(colspan):
                celdas.append(texto)
        
        return celdas
    
    def procesar_docente(self, cedula: str, id_periodo: int) -> DatosDocente:
        """
        Procesa un docente completo y retorna todos sus datos.
        
        Args:
            cedula: Número de cédula del docente
            id_periodo: ID del período académico
            
        Returns:
            DatosDocente con toda la información
        """
        html = self.obtener_html(cedula, id_periodo)
        
        resultado = DatosDocente(periodo=id_periodo)
        
        tablas = self.extraer_tablas(html)
        
        for tabla_html in tablas:
            filas = self.extraer_filas(tabla_html)
            if not filas:
                continue
            
            headers = self.extraer_celdas(filas[0])
            headers_upper = [h.upper() for h in headers]
            
            # Identificar y procesar según tipo
            if self._es_tabla_informacion_personal(headers_upper):
                self._procesar_informacion_personal(
                    tabla_html, filas, resultado.informacion_personal
                )
            
            elif self._es_tabla_asignaturas(headers_upper):
                pregrado, postgrado = self._procesar_asignaturas(
                    filas, headers
                )
                resultado.actividades_pregrado.extend(pregrado)
                resultado.actividades_postgrado.extend(postgrado)
            
            elif self._es_tabla_investigacion(tabla_html, headers_upper):
                investigacion = self._procesar_investigacion(
                    tabla_html, filas, headers
                )
                resultado.actividades_investigacion.extend(investigacion)
        
        return resultado
    
    def _es_tabla_informacion_personal(self, headers_upper: List[str]) -> bool:
        """Verifica si es tabla de información personal."""
        tiene_cedula = any(
            'CEDULA' in h or 'DOCUMENTO' in h or h == 'DOCENTES'
            for h in headers_upper
        )
        tiene_apellido = any(
            'APELLIDO' in h or 'NOMBRE' in h
            for h in headers_upper
        )
        return tiene_cedula and tiene_apellido
    
    def _es_tabla_asignaturas(self, headers_upper: List[str]) -> bool:
        """Verifica si es tabla de asignaturas."""
        tiene_codigo = any(
            h == 'CODIGO' or ('CODIGO' in h and 'ESTUDIANTE' not in h)
            for h in headers_upper
        )
        tiene_nombre = any('NOMBRE' in h and 'ASIGNATURA' in h for h in headers_upper)
        tiene_horas = any('HORAS' in h or 'SEMESTRE' in h for h in headers_upper)
        no_es_tesis = not any('ESTUDIANTE' in h or 'TESIS' in h for h in headers_upper)
        
        return tiene_codigo and tiene_nombre and tiene_horas and no_es_tesis
    
    def _es_tabla_investigacion(self, tabla_html: str, headers_upper: List[str]) -> bool:
        """Verifica si es tabla de investigación."""
        texto = self.extraer_texto_de_celda(tabla_html).upper()
        tiene_titulo = 'ACTIVIDADES DE INVESTIGACION' in texto
        tiene_codigo = 'CODIGO' in texto
        tiene_nombre = 'NOMBRE DEL PROYECTO' in texto or 'NOMBRE DEL ANTEPROYECTO' in texto
        tiene_horas = 'HORAS SEMESTRE' in texto
        
        return tiene_titulo and tiene_codigo and tiene_nombre and tiene_horas
    
    def _procesar_informacion_personal(
        self,
        tabla_html: str,
        filas: List[str],
        info: InformacionPersonal
    ):
        """Procesa información personal."""
        if len(filas) < 4:
            return
        
        headers = self.extraer_celdas(filas[0])
        valores_fila2 = self.extraer_celdas(filas[1])
        valores_fila4 = self.extraer_celdas(filas[3])
        
        # Mapear valores de fila 2
        for i, header in enumerate(headers):
            if i < len(valores_fila2):
                valor = valores_fila2[i]
                header_upper = header.upper()
                
                if 'CEDULA' in header_upper:
                    info.cedula = valor
                elif '1 APELLIDO' in header_upper:
                    info.apellido1 = valor
                elif '2 APELLIDO' in header_upper:
                    info.apellido2 = valor
                elif header_upper == 'NOMBRE':
                    info.nombre = valor
                elif 'UNIDAD' in header_upper and 'ACADEMICA' in header_upper:
                    info.unidad_academica = valor
        
        # Mapear valores de fila 4
        if len(valores_fila4) >= 5:
            info.vinculacion = valores_fila4[0]
            info.categoria = valores_fila4[1]
            info.dedicacion = valores_fila4[2]
            info.nivel_alcanzado = valores_fila4[3]
            info.centro_costo = valores_fila4[4]
    
    def _procesar_asignaturas(
        self,
        filas: List[str],
        headers: List[str]
    ) -> Tuple[List[ActividadAsignatura], List[ActividadAsignatura]]:
        """Procesa actividades de asignaturas."""
        pregrado = []
        postgrado = []
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = ActividadAsignatura()
            
            for j, header in enumerate(headers):
                if j < len(celdas):
                    valor = celdas[j]
                    header_upper = header.upper()
                    
                    if 'CODIGO' in header_upper:
                        actividad.codigo = valor
                    elif 'GRUPO' in header_upper:
                        actividad.grupo = valor
                    elif 'TIPO' in header_upper:
                        actividad.tipo = valor
                    elif 'NOMBRE' in header_upper and 'ASIGNATURA' in header_upper:
                        actividad.nombre_asignatura = valor
                    elif 'HORAS' in header_upper:
                        actividad.horas_semestre = valor
            
            if actividad.codigo or actividad.nombre_asignatura:
                if self._es_postgrado(actividad):
                    postgrado.append(actividad)
                else:
                    pregrado.append(actividad)
        
        return pregrado, postgrado
    
    def _procesar_investigacion(
        self,
        tabla_html: str,
        filas: List[str],
        headers: List[str]
    ) -> List[ActividadInvestigacion]:
        """Procesa actividades de investigación."""
        actividades = []
        
        # Buscar fila de headers
        header_index = -1
        for i in range(min(10, len(filas))):
            fila_texto = self.extraer_texto_de_celda(filas[i]).upper()
            if ('CODIGO' in fila_texto and
                'NOMBRE DEL PROYECTO' in fila_texto and
                'HORAS SEMESTRE' in fila_texto):
                header_index = i
                headers = self.extraer_celdas(filas[i])
                break
        
        if header_index == -1:
            return actividades
        
        # Procesar filas de datos
        for i in range(header_index + 1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if len(celdas) < 2 or all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = ActividadInvestigacion()
            
            for j, header in enumerate(headers):
                if j < len(celdas):
                    valor = celdas[j]
                    header_upper = header.upper()
                    
                    if 'CODIGO' in header_upper:
                        actividad.codigo = valor
                    elif 'APROBADO' in header_upper and 'POR' in header_upper:
                        actividad.aprobado_por = valor
                    elif 'NOMBRE' in header_upper and ('PROYECTO' in header_upper or 'ANTEPROYECTO' in header_upper):
                        actividad.nombre_proyecto = valor
                    elif 'HORAS' in header_upper:
                        actividad.horas_semestre = valor
            
            if actividad.nombre_proyecto or actividad.horas_semestre:
                actividades.append(actividad)
        
        return actividades
    
    def _es_postgrado(self, actividad: ActividadAsignatura) -> bool:
        """Determina si una actividad es de postgrado."""
        nombre = actividad.nombre_asignatura.upper()
        tipo = actividad.tipo.upper()
        
        if any(kw in nombre or kw in tipo for kw in self.KEYWORDS_POSTGRADO):
            return True
        
        if any(kw in nombre or kw in tipo for kw in self.KEYWORDS_PREGRADO):
            return False
        
        # Analizar código
        codigo_limpio = re.sub(r'[A-Za-z]', '', actividad.codigo)
        if codigo_limpio and re.match(r'^\d+$', codigo_limpio):
            if re.match(r'^[7-9]\d{2,}$', codigo_limpio):
                return True
        
        return False


# Ejemplo de uso
if __name__ == "__main__":
    scraper = ScraperUnivalle()
    
    # Procesar un docente
    datos = scraper.procesar_docente(cedula="1112966620", id_periodo=48)
    
    print(f"Cédula: {datos.informacion_personal.cedula}")
    print(f"Nombre: {datos.informacion_personal.nombre}")
    print(f"Pregrado: {len(datos.actividades_pregrado)} actividades")
    print(f"Postgrado: {len(datos.actividades_postgrado)} actividades")
    print(f"Investigación: {len(datos.actividades_investigacion)} actividades")
```

---

## Resumen de Selectores

### Información Personal

| Campo | Selector/Ubicación |
|-------|-------------------|
| Cédula | Fila 2 (índice 1), celda con header "CEDULA" |
| Nombre Profesor | Fila 2, celda con header "NOMBRE" |
| 1 Apellido | Fila 2, celda con header "1 APELLIDO" o "APELLIDO1" |
| 2 Apellido | Fila 2, celda con header "2 APELLIDO" o "APELLIDO2" |
| Escuela/Unidad Académica | Fila 2, celda con header "UNIDAD ACADEMICA" |
| Departamento | Texto plano o tabla adicional |
| Vinculación | Fila 4 (índice 3), primera celda |
| Categoría | Fila 4, segunda celda |
| Dedicación | Fila 4, tercera celda |
| Nivel Alcanzado | Fila 4, cuarta celda |
| Cargo | Texto plano o tabla adicional |

### Actividades

| Campo | Selector/Ubicación |
|-------|-------------------|
| Tipo Actividad | Clasificación por tipo de tabla |
| Categoría | Mismo que información personal |
| Nombre Actividad | Header "NOMBRE DE ASIGNATURA" o "NOMBRE DEL PROYECTO" |
| Número de Horas | Header "HORAS SEMESTRE" o "HORAS" |
| Período | Parámetro `periodo` en URL |
| Detalle Actividad | Campos adicionales de la actividad |
| Actividad | Tipo de actividad (pregrado/postgrado/investigación/etc.) |
| Vinculación | Mismo que información personal |
| Dedicación | Mismo que información personal |
| Nivel | Mismo que información personal |
| Cargo | Tabla de actividades administrativas |

---

## Notas Importantes

1. **Codificación**: SIEMPRE usar ISO-8859-1 para decodificar el HTML.

2. **Múltiples Actividades**: Cada fila de la tabla representa una actividad independiente. Se procesan todas las filas iterativamente.

3. **Tablas Anidadas**: Algunas tablas (como investigación) tienen tablas anidadas dentro. Buscar el patrón: `<tbody>...<td>...<table>...</table>`

4. **Colspan**: Al extraer celdas, manejar el atributo `colspan` replicando el valor en múltiples celdas.

5. **Fallback**: Si no se encuentra información en la estructura HTML, buscar en texto plano usando regex.

6. **Framesets**: Si el HTML contiene frameset, extraer el contenido del frame `mainFrame_`.

7. **Deduplicación**: Opcionalmente, deduplicar actividades usando un ID generado desde campos clave.

