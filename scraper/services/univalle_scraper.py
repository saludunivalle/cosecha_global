"""
Servicio de scraping del portal Univalle
Basado en la lógica documentada en docs/SCRAPING_UNIVALLE_PYTHON.md
"""

import re
import logging
import time
import random
import traceback
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup

from scraper.config.settings import (
    UNIVALLE_ENDPOINT,
    UNIVALLE_PERIODOS_URL,
    COOKIE_PHPSESSID,
    COOKIE_ASIGACAD,
    REQUEST_TIMEOUT,
    REQUEST_MAX_RETRIES,
    REQUEST_RETRY_DELAY,
)
from scraper.utils.helpers import (
    validar_cedula,
    limpiar_cedula,
    normalizar_texto,
    limpiar_departamento,
    limpiar_escuela,
    parsear_horas,
    generar_id_actividad,
    deduplicar_actividades,
    parsear_periodo_label,
    formatear_nombre_completo,
)

logger = logging.getLogger(__name__)


# Keywords para clasificación pregrado/postgrado
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


@dataclass
class InformacionPersonal:
    """Información personal del docente."""
    cedula: str = ''
    nombre: str = ''
    apellido1: str = ''
    apellido2: str = ''
    unidad_academica: str = ''
    escuela: str = ''
    departamento: str = ''
    vinculacion: str = ''
    categoria: str = ''
    dedicacion: str = ''
    nivel_alcanzado: str = ''
    cargo: str = ''
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
    periodo: Optional[int] = None


@dataclass
class ActividadInvestigacion:
    """Actividad de investigación."""
    codigo: str = ''
    nombre_proyecto: str = ''
    aprobado_por: str = ''
    horas_semestre: str = ''
    periodo: Optional[int] = None


@dataclass
class DatosDocente:
    """Datos completos de un docente para un período."""
    periodo: int
    informacion_personal: InformacionPersonal = field(default_factory=InformacionPersonal)
    actividades_pregrado: List[ActividadAsignatura] = field(default_factory=list)
    actividades_postgrado: List[ActividadAsignatura] = field(default_factory=list)
    actividades_tesis: List[Dict[str, Any]] = field(default_factory=list)
    actividades_investigacion: List[ActividadInvestigacion] = field(default_factory=list)
    actividades_extension: List[Dict[str, Any]] = field(default_factory=list)
    actividades_intelectuales: List[Dict[str, Any]] = field(default_factory=list)
    actividades_administrativas: List[Dict[str, Any]] = field(default_factory=list)
    actividades_complementarias: List[Dict[str, Any]] = field(default_factory=list)
    docente_en_comision: List[Dict[str, Any]] = field(default_factory=list)


class UnivalleScraper:
    """Scraper para el portal Univalle."""
    
    def __init__(self):
        """Inicializa el scraper con configuración de sesión."""
        self.session = requests.Session()
        
        # Configurar retry strategy
        retry_strategy = Retry(
            total=REQUEST_MAX_RETRIES,
            backoff_factor=REQUEST_RETRY_DELAY,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Configurar headers por defecto
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })
        
        # Configurar cookies si están disponibles
        self.cookies = {}
        if COOKIE_PHPSESSID:
            self.cookies['PHPSESSID'] = COOKIE_PHPSESSID
        if COOKIE_ASIGACAD:
            self.cookies['asigacad'] = COOKIE_ASIGACAD
    
    def construir_url(self, cedula: str, id_periodo: int) -> str:
        """Construye la URL de consulta."""
        return f"{UNIVALLE_ENDPOINT}?cedula={cedula}&periodo={id_periodo}"
    
    def obtener_html(self, cedula: str, id_periodo: int) -> str:
        """
        Obtiene el HTML del portal.
        
        Args:
            cedula: Número de cédula del docente
            id_periodo: ID del período académico
            
        Returns:
            HTML decodificado en ISO-8859-1
            
        Raises:
            requests.RequestException: Si hay error en la petición
            ValueError: Si la respuesta está vacía
        """
        if not validar_cedula(cedula):
            raise ValueError(f"Cédula inválida: {cedula}")
        
        url = self.construir_url(cedula, id_periodo)
        
        logger.info(f"Consultando: {url}")
        
        try:
            response = self.session.get(
                url,
                cookies=self.cookies if self.cookies else None,
                timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()
            
            # CRÍTICO: Decodificar como ISO-8859-1
            response.encoding = 'iso-8859-1'
            html = response.text
            
            if len(html) < 100:
                raise ValueError("Respuesta vacía o muy corta del servidor")
            
            # Manejar framesets
            if '<frameset' in html.lower() or '<frame' in html.lower():
                html = self._manejar_frameset(html, url)
            
            logger.debug(f"HTML obtenido: {len(html)} caracteres")
            return html
            
        except requests.Timeout:
            logger.error(f"Timeout al consultar {url}")
            raise
        except requests.HTTPError as e:
            logger.error(f"Error HTTP {e.response.status_code} al consultar {url}")
            raise
        except requests.RequestException as e:
            logger.error(f"Error de conexión al consultar {url}: {e}")
            raise
    
    def _manejar_frameset(self, html: str, base_url: str) -> str:
        """Maneja framesets extrayendo el contenido del frame."""
        logger.debug("Detectado frameset, extrayendo contenido del frame...")
        
        match = re.search(
            r'name=["\']mainFrame_["\'][^>]*src=["\']([^"\']+)["\']',
            html,
            re.IGNORECASE
        )
        
        if match:
            frame_src = match.group(1)
            
            # Construir URL completa si es relativa
            if not frame_src.startswith('http'):
                base = base_url.rsplit('/vin_inicio_impresion.php3', 1)[0]
                frame_url = f"{base}/{frame_src.lstrip('/')}"
            else:
                frame_url = frame_src
            
            logger.debug(f"Obteniendo contenido del frame: {frame_url}")
            
            try:
                response = self.session.get(
                    frame_url,
                    cookies=self.cookies if self.cookies else None,
                    timeout=REQUEST_TIMEOUT,
                    headers={'Referer': base_url}
                )
                response.encoding = 'iso-8859-1'
                return response.text
            except Exception as e:
                logger.warning(f"No se pudo obtener contenido del frame: {e}")
                return html
        
        logger.warning("Frameset detectado pero no se encontró frame mainFrame_")
        return html
    
    def extraer_tablas(self, html: str) -> List[str]:
        """Extrae todas las tablas del HTML."""
        pattern = r'<table[^>]*>[\s\S]*?</table>'
        matches = re.findall(pattern, html, re.IGNORECASE)
        logger.debug(f"Encontradas {len(matches)} tablas en el HTML")
        return matches
    
    def extraer_filas(self, tabla_html: str) -> List[str]:
        """Extrae todas las filas de una tabla."""
        pattern = r'<tr[^>]*>[\s\S]*?</tr>'
        matches = re.findall(pattern, tabla_html, re.IGNORECASE)
        return matches
    
    def extraer_texto_de_celda(self, celda_html: str) -> str:
        """Extrae texto limpio de una celda."""
        texto = re.sub(r'<[^>]+>', '', celda_html)
        
        # Decodificar entidades HTML comunes
        entidades = {
            '&aacute;': 'á', '&Aacute;': 'Á',
            '&eacute;': 'é', '&Eacute;': 'É',
            '&iacute;': 'í', '&Iacute;': 'Í',
            '&oacute;': 'ó', '&Oacute;': 'Ó',
            '&uacute;': 'ú', '&Uacute;': 'Ú',
            '&ntilde;': 'ñ', '&Ntilde;': 'Ñ',
            '&amp;': '&', '&quot;': '"',
            '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
        }
        
        for entidad, caracter in entidades.items():
            texto = texto.replace(entidad, caracter)
        
        return normalizar_texto(texto)
    
    def extraer_celdas(self, fila_html: str) -> List[str]:
        """Extrae celdas de una fila, manejando colspan correctamente."""
        # Patrón que captura la etiqueta completa (incluyendo atributos) y el contenido
        pattern = r'<(t[dh])([^>]*)>([\s\S]*?)</\1>'
        matches = re.findall(pattern, fila_html, re.IGNORECASE)
        
        celdas = []
        for tag, attrs, contenido in matches:
            # Buscar colspan en los ATRIBUTOS de la etiqueta (no en el contenido)
            colspan_match = re.search(r'colspan=["\']?(\d+)["\']?', attrs, re.IGNORECASE)
            colspan = int(colspan_match.group(1)) if colspan_match else 1
            
            # Extraer texto del contenido
            texto = self.extraer_texto_de_celda(contenido)
            
            # Agregar celda (SIN replicar por colspan para mantener alineación con headers)
            # Los headers y datos usan el mismo patrón de colspan
            celdas.append(texto)
        
        return celdas
    
    def _detectar_seccion_titulo(self, tabla_html: str) -> Optional[str]:
        """
        Detecta si una tabla es solo un título de sección.
        
        En el HTML de Univalle, los títulos de sección están en tablas separadas
        de los datos. Esta función detecta esas tablas de título.
        
        Returns:
            Nombre de la sección si es una tabla de título, None si no lo es
        """
        texto = self.extraer_texto_de_celda(tabla_html).upper()
        
        # Verificar si es una tabla pequeña (típicamente los subtítulos tienen poco texto)
        # y NO contiene headers de datos (CODIGO, NOMBRE DE ASIGNATURA, HORAS SEMESTRE, etc.)
        es_tabla_datos = (
            'NOMBRE DE ASIGNATURA' in texto or 
            'HORAS SEMESTRE' in texto or 
            'CODIGO ESTUDIANTE' in texto or
            'APROBADO POR' in texto
        )
        
        # Detectar PREGRADO, POSTGRADO y DIRECCION DE TESIS (actividades de docencia)
        # Solo si NO es una tabla de datos
        if not es_tabla_datos:
            # DIRECCION DE TESIS - verificar primero para evitar conflictos
            if 'DIRECCION' in texto and 'TESIS' in texto:
                return 'TESIS'
            # POSTGRADO (con o sin T)
            if ('POSTGRADO' in texto or 'POSGRADO' in texto) and 'PREGRADO' not in texto and 'TOTAL' not in texto:
                return 'POSTGRADO'
            # PREGRADO
            if 'PREGRADO' in texto and 'POSTGRADO' not in texto and 'POSGRADO' not in texto and 'TOTAL' not in texto:
                return 'PREGRADO'
        
        # Detectar tablas que son solo títulos de sección (otras actividades)
        if 'ACTIVIDADES DE INVESTIGACION' in texto and 'APROBADO' not in texto:
            return 'INVESTIGACION'
        if ('ACTIVIDADES INTELECTUALES' in texto or 'ARTISTICAS' in texto) and 'APROBADO' not in texto:
            return 'INTELECTUALES'
        if 'ACTIVIDADES DE EXTENSION' in texto and 'TIPO' not in texto:
            return 'EXTENSION'
        if 'ACTIVIDADES ADMINISTRATIVAS' in texto and 'CARGO' not in texto:
            return 'ADMINISTRATIVAS'
        if 'ACTIVIDADES COMPLEMENTARIAS' in texto and 'PARTICIPACION' not in texto:
            return 'COMPLEMENTARIAS'
        if 'DOCENTE EN COMISION' in texto and 'TIPO DE COMISION' not in texto:
            return 'COMISION'
        
        return None
    
    def _procesar_tabla_con_contexto(
        self,
        tabla_html: str,
        filas: List[str],
        headers: List[str],
        id_periodo: int,
        seccion_contexto: str,
        resultado: DatosDocente
    ):
        """
        Procesa una tabla de datos usando el contexto de la sección anterior.
        
        En el HTML de Univalle, las tablas de datos suelen estar anidadas dentro
        de una tabla contenedora. Esta función busca la tabla interna real.
        
        Args:
            tabla_html: HTML de la tabla
            filas: Filas extraídas de la tabla
            headers: Headers de la primera fila
            id_periodo: ID del período
            seccion_contexto: Tipo de sección (INVESTIGACION, INTELECTUALES, etc.)
            resultado: Objeto donde guardar los resultados
        """
        logger.debug(f"Procesando tabla con contexto de sección: {seccion_contexto}")
        
        # Buscar tabla anidada (los datos reales suelen estar en una tabla interna)
        tabla_interna = self._buscar_tabla_anidada(tabla_html)
        if tabla_interna:
            logger.debug("Encontrada tabla anidada, usando tabla interna")
            filas = self.extraer_filas(tabla_interna)
            if filas:
                headers = self.extraer_celdas(filas[0])
        
        if seccion_contexto == 'INVESTIGACION':
            investigacion = self._procesar_investigacion(
                tabla_html, filas, headers, id_periodo
            )
            resultado.actividades_investigacion.extend(investigacion)
            logger.debug(f"Agregadas {len(investigacion)} actividades de investigación")
        
        elif seccion_contexto == 'INTELECTUALES':
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.actividades_intelectuales.extend(actividades)
            logger.debug(f"Agregadas {len(actividades)} actividades intelectuales")
        
        elif seccion_contexto == 'EXTENSION':
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.actividades_extension.extend(actividades)
        
        elif seccion_contexto == 'ADMINISTRATIVAS':
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.actividades_administrativas.extend(actividades)
        
        elif seccion_contexto == 'COMPLEMENTARIAS':
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.actividades_complementarias.extend(actividades)
        
        elif seccion_contexto == 'COMISION':
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.docente_en_comision.extend(actividades)
        
        elif seccion_contexto == 'PREGRADO':
            # Procesar asignaturas de pregrado usando la sección detectada
            actividades = self._procesar_asignaturas_con_seccion(filas, headers, id_periodo, 'pregrado')
            resultado.actividades_pregrado.extend(actividades)
            logger.debug(f"Agregadas {len(actividades)} actividades de PREGRADO")
        
        elif seccion_contexto == 'POSTGRADO':
            # Procesar asignaturas de postgrado usando la sección detectada
            actividades = self._procesar_asignaturas_con_seccion(filas, headers, id_periodo, 'postgrado')
            resultado.actividades_postgrado.extend(actividades)
            logger.debug(f"Agregadas {len(actividades)} actividades de POSTGRADO")
        
        elif seccion_contexto == 'TESIS':
            # Procesar dirección de tesis
            tesis = self._procesar_tesis(filas, headers, id_periodo)
            resultado.actividades_tesis.extend(tesis)
            logger.debug(f"Agregadas {len(tesis)} actividades de TESIS")
    
    def procesar_docente(self, cedula: str, id_periodo: int) -> DatosDocente:
        """
        Procesa un docente completo y retorna todos sus datos.
        
        Args:
            cedula: Número de cédula del docente
            id_periodo: ID del período académico
            
        Returns:
            DatosDocente con toda la información
        """
        cedula_limpia = limpiar_cedula(cedula)
        
        logger.info(f"Procesando docente {cedula_limpia} para período {id_periodo}")
        
        html = self.obtener_html(cedula_limpia, id_periodo)
        
        resultado = DatosDocente(periodo=id_periodo)
        
        tablas = self.extraer_tablas(html)
        
        # Variable para guardar el contexto de la sección actual
        # Esto es necesario porque en el HTML de Univalle, los títulos de sección
        # están en tablas separadas de los datos
        seccion_actual = None
        
        for tabla_idx, tabla_html in enumerate(tablas, 1):
            logger.debug(f"Procesando tabla {tabla_idx}/{len(tablas)}")
            
            # Primero verificar si es una tabla de título de sección
            seccion_detectada = self._detectar_seccion_titulo(tabla_html)
            if seccion_detectada:
                seccion_actual = seccion_detectada
                logger.debug(f"Detectada sección: {seccion_actual}")
                continue  # Pasar a la siguiente tabla (que tendrá los datos)
            
            filas = self.extraer_filas(tabla_html)
            if not filas:
                continue
            
            headers = self.extraer_celdas(filas[0])
            headers_upper = [h.upper() for h in headers]
            
            # Si tenemos contexto de sección, procesar con ese contexto
            if seccion_actual:
                self._procesar_tabla_con_contexto(
                    tabla_html, filas, headers, id_periodo, seccion_actual, resultado
                )
                seccion_actual = None  # Limpiar el contexto después de usar
                continue
            
            # Identificar y procesar según tipo (sin contexto previo)
            if self._es_tabla_informacion_personal(headers_upper):
                self._procesar_informacion_personal(
                    tabla_html, filas, resultado.informacion_personal
                )
            
            elif self._es_tabla_asignaturas(headers_upper):
                pregrado, postgrado = self._procesar_asignaturas(
                    filas, headers, id_periodo
                )
                resultado.actividades_pregrado.extend(pregrado)
                resultado.actividades_postgrado.extend(postgrado)
            
            elif self._es_tabla_investigacion(tabla_html, headers_upper):
                investigacion = self._procesar_investigacion(
                    tabla_html, filas, headers, id_periodo
                )
                resultado.actividades_investigacion.extend(investigacion)
            
            elif self._es_tabla_tesis(headers_upper):
                tesis = self._procesar_tesis(filas, headers, id_periodo)
                resultado.actividades_tesis.extend(tesis)
            
            # Procesar otros tipos de actividades
            self._procesar_otras_actividades(
                tabla_html, filas, headers, headers_upper, id_periodo, resultado
            )
        
        # Deduplicar actividades
        resultado.actividades_pregrado = deduplicar_actividades([
            self._actividad_a_dict(a) for a in resultado.actividades_pregrado
        ])
        resultado.actividades_postgrado = deduplicar_actividades([
            self._actividad_a_dict(a) for a in resultado.actividades_postgrado
        ])
        
        logger.info(
            f"Procesamiento completado: "
            f"Pregrado={len(resultado.actividades_pregrado)}, "
            f"Postgrado={len(resultado.actividades_postgrado)}, "
            f"Investigación={len(resultado.actividades_investigacion)}, "
            f"Intelectuales={len(resultado.actividades_intelectuales)}"
        )
        
        return resultado
    
    def _actividad_a_dict(self, actividad: Any) -> Dict[str, Any]:
        """Convierte una actividad a diccionario para deduplicación."""
        if isinstance(actividad, dict):
            return actividad
        return actividad.__dict__
    
    def _es_tabla_informacion_personal(self, headers_upper: List[str]) -> bool:
        """Verifica si es tabla de información personal."""
        tiene_cedula = any(
            'CEDULA' in h or 'DOCUMENTO' in h or h == 'DOCENTES'
            for h in headers_upper
        )
        tiene_apellido = any('APELLIDO' in h or 'NOMBRE' in h for h in headers_upper)
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
        # CODIGO es opcional - algunas tablas de investigación no lo tienen
        tiene_nombre = ('NOMBRE DEL PROYECTO' in texto or
                       'NOMBRE DEL ANTEPROYECTO' in texto or
                       'PROPUESTA DE INVESTIGACION' in texto)
        tiene_horas = 'HORAS SEMESTRE' in texto
        tiene_aprobado = 'APROBADO' in texto
        
        # La tabla de investigación debe tener el título, nombre del proyecto/anteproyecto y horas
        return tiene_titulo and tiene_nombre and tiene_horas
    
    def _es_tabla_tesis(self, headers_upper: List[str]) -> bool:
        """Verifica si es tabla de tesis."""
        tiene_estudiante = any('ESTUDIANTE' in h for h in headers_upper)
        tiene_plan = any('PLAN' in h for h in headers_upper)
        tiene_titulo = any('TITULO' in h or 'TESIS' in h for h in headers_upper)
        return tiene_estudiante and (tiene_plan or tiene_titulo)
    
    def _determinar_tipo_actividad(self, seccion: str, subseccion: Optional[str] = None) -> str:
        """
        Determina el tipo de actividad según la sección.
        
        Args:
            seccion: Nombre de la sección principal (ej. 'ACTIVIDADES DE DOCENCIA')
            subseccion: Subsección para docencia (pregrado/posgrado/tesis)
        
        Returns:
            str: Tipo de actividad normalizado
        """
        seccion_upper = (seccion or "").upper().strip()
        
        mapeo: Dict[str, str] = {
            "ACTIVIDADES DE DOCENCIA": subseccion.lower() if subseccion else "docencia",
            "ACTIVIDADES DE INVESTIGACION": "investigación",
            "ACTIVIDADES DE EXTENSION": "extensión",
            "ACTIVIDADES INTELECTUALES O ARTISTICAS": "intelectuales o artísticas",
            "ACTIVIDADES ADMINISTRATIVAS": "administrativas",
            "ACTIVIDADES COMPLEMENTARIAS": "complementarias",
            "DOCENTE EN COMISION": "comisión",
        }
        
        if seccion_upper in mapeo:
            return mapeo[seccion_upper]
        
        # Fallback: devolver la sección en minúsculas
        return seccion.lower() if seccion else ""
    
    def _determinar_actividad_global(self, tipo_actividad: str) -> str:
        """
        Determina la actividad global a partir del tipo de actividad.
        
        Returns:
            str: Actividad global
        """
        if tipo_actividad in ["pregrado", "posgrado", "tesis"]:
            return "docencia"
        return tipo_actividad
    
    def _extraer_nombre_actividad_docencia(self, headers: List[str], celdas: List[str]) -> str:
        """
        Extrae el nombre de la actividad para ACTIVIDADES DE DOCENCIA.
        
        Regla:
        - Buscar columna "NOMBRE DE ASIGNATURA" o "NOMBRE ASIGNATURA" (case-insensitive)
        - Si no encuentra, buscar columna que contenga "NOMBRE" pero no sea numérica
        - Extraer el texto completo de esa celda
        - Si falla, buscar el texto más largo que no sea código ni número
        """
        indice_nombre = -1
        
        logger.debug(f"  _extraer_nombre: headers={headers}")
        logger.debug(f"  _extraer_nombre: celdas={celdas}")
        
        # 1. Buscar exactamente "NOMBRE DE ASIGNATURA" o "NOMBRE ASIGNATURA"
        for j, header in enumerate(headers):
            header_upper = header.upper().strip()
            if "NOMBRE DE ASIGNATURA" in header_upper or "NOMBRE ASIGNATURA" in header_upper:
                indice_nombre = j
                logger.debug(f"✓ Columna NOMBRE DE ASIGNATURA encontrada en índice {j}: '{header}'")
                break
        
        # 2. Si no encontró, buscar columna que contenga "NOMBRE" (pero no "CODIGO")
        if indice_nombre < 0:
            for j, header in enumerate(headers):
                header_upper = header.upper().strip()
                if "NOMBRE" in header_upper and "CODIGO" not in header_upper:
                    indice_nombre = j
                    logger.debug(f"✓ Columna NOMBRE encontrada (fallback) en índice {j}: '{header}'")
                    break
        
        # 3. Extraer valor si se encontró el índice
        if indice_nombre >= 0 and indice_nombre < len(celdas):
            valor = (celdas[indice_nombre] or "").strip()
            # Verificar que no sea un número (para evitar confundir con horas)
            if valor and not re.match(r'^\d+\.?\d*%?$', valor):
                logger.debug(f"  → Nombre extraído por índice {indice_nombre}: '{valor}'")
                return valor
            else:
                logger.debug(f"  → Valor descartado (es número o porcentaje): '{valor}'")
        
        # 4. Fallback: buscar el texto más largo que parezca un nombre de asignatura
        # (no es código, no es número, no es porcentaje)
        mejor_candidato = ""
        for j, celda in enumerate(celdas):
            valor = (celda or "").strip()
            if not valor:
                continue
            # Saltar números, porcentajes, códigos cortos
            if re.match(r'^\d+\.?\d*%?$', valor):
                continue
            if len(valor) <= 3:  # Códigos muy cortos como "MG", "1", etc.
                continue
            # Saltar si parece un código (mayúsculas + números, corto)
            if re.match(r'^[A-Z0-9]{5,8}C?$', valor):
                continue
            # Quedarse con el más largo (probablemente el nombre)
            if len(valor) > len(mejor_candidato):
                mejor_candidato = valor
                logger.debug(f"  → Candidato encontrado en celda {j}: '{valor}'")
        
        if mejor_candidato:
            logger.debug(f"  → Nombre extraído (fallback texto largo): '{mejor_candidato}'")
            return mejor_candidato
        
        logger.debug("  → No se encontró nombre de asignatura")
        return ""
    
    def _extraer_nombre_actividad_generica(self, headers: List[str], celdas: List[str]) -> str:
        """
        Extrae el nombre de la actividad para secciones NO docentes.
        
        Reglas:
        - Buscar columna "NOMBRE" primero
        - Si no existe, buscar "DESCRIPCION DEL CARGO" o "DESCRIPCIÓN"
        - Extraer el texto completo
        """
        # 1. Buscar "NOMBRE"
        for j, header in enumerate(headers):
            header_upper = header.upper()
            if "NOMBRE" in header_upper:
                if j < len(celdas):
                    return (celdas[j] or "").strip()
        
        # 2. Buscar "DESCRIPCION DEL CARGO" o "DESCRIPCIÓN"
        for j, header in enumerate(headers):
            header_upper = header.upper()
            if "DESCRIPCION DEL CARGO" in header_upper or "DESCRIPCION" in header_upper or "DESCRIPCIÓN" in header_upper:
                if j < len(celdas):
                    return (celdas[j] or "").strip()
        
        return ""
    
    def _extraer_nombre_actividad(self, fila_celdas, tipo_seccion: str) -> str:
        """
        Extrae el nombre/descripción de la actividad según la sección.
        
        Este método trabaja directamente con celdas de BeautifulSoup (td/th),
        buscando primero el HEADER y luego tomando el valor de la celda siguiente.
        
        Args:
            fila_celdas: Lista de celdas de la fila (objetos BeautifulSoup)
            tipo_seccion: Tipo de sección (DOCENCIA, INVESTIGACION, ADMINISTRATIVAS, COMISION, etc.)
        
        Returns:
            str: Nombre de la actividad (contenido de la celda de valor)
        """
        tipo_upper = (tipo_seccion or "").upper()
        
        # Definir columnas a buscar según el tipo de sección
        if "DOCENCIA" in tipo_upper:
            columnas_buscar = ["NOMBRE DE ASIGNATURA", "NOMBRE ASIGNATURA", "ASIGNATURA"]
        elif "INVESTIGACION" in tipo_upper:
            columnas_buscar = ["NOMBRE", "NOMBRE PROYECTO", "TITULO", "TÍTULO", "DESCRIPCION", "DESCRIPCIÓN"]
        elif "ADMINISTRATIVAS" in tipo_upper or "COMISION" in tipo_upper:
            columnas_buscar = [
                "DESCRIPCION DEL CARGO",
                "DESCRIPCIÓN DEL CARGO",
                "DESCRIPCIÓN CARGO",
                "DESCRIPCION CARGO",
                "CARGO",
                "NOMBRE",
            ]
        else:
            # EXTENSION, INTELECTUALES, COMPLEMENTARIAS u otras
            columnas_buscar = ["NOMBRE", "DESCRIPCION", "DESCRIPCIÓN", "TITULO", "TÍTULO"]
        
        # Buscar la columna en la fila (patrón header -> valor siguiente)
        for i, celda in enumerate(fila_celdas):
            texto_celda = celda.get_text(strip=True).upper()
            
            for columna_objetivo in columnas_buscar:
                if columna_objetivo in texto_celda:
                    # La siguiente celda en la MISMA FILA contiene el valor
                    if i + 1 < len(fila_celdas):
                        valor = fila_celdas[i + 1].get_text(strip=True)
                        if valor:
                            return valor
        
        logger.warning(f"⚠️ No se encontró nombre de actividad para tipo_seccion={tipo_seccion}")
        return ""

    def _procesar_tabla_asignaturas(self, tabla) -> List[Dict[str, Any]]:
        """
        Procesa tabla de asignaturas (pregrado/posgrado/tesis) usando BeautifulSoup.
        
        Lógica basada en web/searchState.gs:
        1. Identifica tabla por headers (CODIGO, NOMBRE DE ASIGNATURA, HORAS)
        2. Mapea celdas a objeto usando headers
        3. Clasifica pregrado/posgrado basándose en el código
        
        Returns:
            list: Lista de actividades clasificadas
        """
        actividades: List[Dict[str, Any]] = []
        
        filas = tabla.find_all('tr')
        if len(filas) < 2:
            return actividades
        
        # === PASO 1: Extraer headers ===
        headers_row = filas[0]
        headers_celdas = headers_row.find_all(['td', 'th'])
        headers = [c.get_text(strip=True).upper() for c in headers_celdas]
        
        logger.info(f"   📋 Headers detectados: {headers}")
        
        # === PASO 2: Validar que sea tabla de asignaturas ===
        tiene_codigo = any("CODIGO" in h and "ESTUDIANTE" not in h for h in headers)
        tiene_nombre_asignatura = any("NOMBRE" in h and "ASIGNATURA" in h for h in headers)
        tiene_horas = any("HORAS" in h for h in headers)
        
        if not (tiene_codigo and tiene_nombre_asignatura and tiene_horas):
            logger.debug("   ⚠️ No es tabla de asignaturas, omitiendo")
            return actividades
        
        # === PASO 3: Procesar cada fila ===
        for fila_idx, fila in enumerate(filas[1:], start=1):
            celdas = fila.find_all(['td', 'th'])
            if not celdas:
                continue
            
            # Extraer textos de celdas
            valores = [c.get_text(strip=True) for c in celdas]
            
            # Mapear headers → valores
            obj: Dict[str, str] = {}
            for i, header in enumerate(headers):
                if i < len(valores):
                    obj[header] = valores[i]
            
            # === PASO 4: Normalizar estructura ===
            actividad_norm = self._normalizar_estructura_asignatura(obj, headers)
            
            # Validar que tenga información mínima
            if not actividad_norm.get("CODIGO") and not actividad_norm.get("NOMBRE DE ASIGNATURA"):
                continue
            
            # === PASO 5: Clasificar pregrado/posgrado ===
            es_postgrado = self._es_actividad_postgrado(actividad_norm)
            tipo_actividad = "posgrado" if es_postgrado else "pregrado"
            
            # Construir actividad
            horas_valor = actividad_norm.get("HORAS SEMESTRE", "0")
            horas_semestre = self._parsear_horas(horas_valor)
            
            actividad = {
                "tipo_actividad": tipo_actividad,
                "nombre_actividad": actividad_norm.get("NOMBRE DE ASIGNATURA", ""),
                "horas_semestre": horas_semestre,
                "actividad_global": "docencia",
                "codigo": actividad_norm.get("CODIGO", ""),
            }
            
            actividades.append(actividad)
            logger.info(
                f"      ✅ {tipo_actividad.upper()}: "
                f"{actividad['codigo']} - {actividad['nombre_actividad']} ({actividad['horas_semestre']}h)"
            )
        
        return actividades

    def _normalizar_estructura_asignatura(self, obj: Dict[str, str], headers: List[str]) -> Dict[str, str]:
        """
        Normaliza estructura de asignatura mapeando nombres de columnas.
        
        Basado en normalizarEstructuraAsignatura de searchState.gs
        """
        estructura: Dict[str, str] = {
            "CODIGO": "",
            "GRUPO": "",
            "TIPO": "",
            "NOMBRE DE ASIGNATURA": "",
            "CRED": "",
            "PORC": "",
            "FREC": "",
            "INTEN": "",
            "HORAS SEMESTRE": "",
        }
        
        for header in headers:
            header_upper = header.upper()
            valor = obj.get(header, "")
            
            if "CODIGO" in header_upper and "ESTUDIANTE" not in header_upper:
                estructura["CODIGO"] = valor
            elif "GRUPO" in header_upper:
                estructura["GRUPO"] = valor
            elif "TIPO" in header_upper:
                estructura["TIPO"] = valor
            elif "NOMBRE" in header_upper and "ASIGNATURA" in header_upper:
                estructura["NOMBRE DE ASIGNATURA"] = valor
            elif "CRED" in header_upper:
                estructura["CRED"] = valor
            elif "PORC" in header_upper:
                estructura["PORC"] = valor
            elif "FREC" in header_upper:
                estructura["FREC"] = valor
            elif "INTEN" in header_upper:
                estructura["INTEN"] = valor
            elif "HORAS" in header_upper and "SEMESTRE" in header_upper:
                estructura["HORAS SEMESTRE"] = valor
        
        return estructura

    def _es_actividad_postgrado(self, actividad: Dict[str, str]) -> bool:
        """
        Determina si una actividad es de postgrado basándose en el código y el nombre.
        
        Basado en esActividadPostgrado de searchState.gs
        """
        codigo = (actividad.get("CODIGO") or "").upper()
        nombre = (actividad.get("NOMBRE DE ASIGNATURA") or "").upper()
        
        # Keywords de posgrado (complementan KEYWORDS_POSTGRADO globales)
        keywords_postgrado = [
            "ESPECIALIZACION",
            "ESPECIALIZACIÓN",
            "MAESTRIA",
            "MAESTRÍA",
            "DOCTORADO",
            "POSTGRADO",
            "POSGRADO",
            "RESIDENCIA",
        ]
        
        # Verificar keywords en nombre
        if any(kw in nombre for kw in keywords_postgrado):
            return True
        
        # Verificar patrón de código de posgrado
        if not codigo:
            return False
        
        # Sufijos típicos de posgrado
        if codigo.endswith(("E", "M", "D")):
            return True
        
        # Rangos de códigos (heurístico, puede ajustarse)
        try:
            if codigo[0].isdigit():
                primer_digito = int(codigo[0])
                if primer_digito >= 7:
                    return True
        except (IndexError, ValueError):
            pass
        
        return False

    def _parsear_horas(self, valor: str) -> float:
        """
        Parsea valor de horas a float de forma robusta.
        """
        if not valor:
            return 0.0
        try:
            valor_limpio = str(valor).strip().replace(",", ".")
            return float(valor_limpio)
        except (ValueError, TypeError, AttributeError):
            logger.warning(f"⚠️ No se pudo parsear horas desde valor: {valor!r}")
            return 0.0

    def _encontrar_subtitulo_anterior(self, tabla_actual, todas_tablas) -> Optional[str]:
        """
        Busca en las tablas anteriores si hay un subtítulo de docencia.
        
        Returns:
            "pregrado", "posgrado", "tesis" o None
        """
        try:
            idx_actual = todas_tablas.index(tabla_actual)
        except ValueError:
            return None
        
        # Buscar en las 5 tablas anteriores
        for i in range(max(0, idx_actual - 5), idx_actual):
            tabla_anterior = todas_tablas[i]
            texto = tabla_anterior.get_text(strip=True).upper()
            
            if "PREGRADO" in texto and "POSGRADO" not in texto:
                return "pregrado"
            elif "POSGRADO" in texto:
                return "posgrado"
            elif "DIRECCION" in texto and "TESIS" in texto:
                return "tesis"
        
        return None

    def _es_tabla_asignaturas_html(self, tabla) -> bool:
        """
        Verifica si una tabla BeautifulSoup es tabla de asignaturas.
        """
        texto = tabla.get_text(strip=True).upper()
        tiene_codigo = "CODIGO" in texto
        tiene_nombre = "NOMBRE DE ASIGNATURA" in texto or "NOMBRE ASIGNATURA" in texto
        tiene_horas = "HORAS SEMESTRE" in texto
        no_es_tesis = "ESTUDIANTE" not in texto
        
        return tiene_codigo and tiene_nombre and tiene_horas and no_es_tesis

    def _procesar_actividades_docencia(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """
        Procesa PREGRADO, POSGRADO y TESIS.
        Maneja el caso de secciones vacías.
        """
        actividades: List[Dict[str, Any]] = []
        todas_tablas = soup.find_all('table')
        
        for i, tabla in enumerate(todas_tablas):
            # Buscar subtítulo en tablas anteriores
            subtitulo = None
            for j in range(max(0, i - 5), i):
                tabla_anterior = todas_tablas[j]
                texto = tabla_anterior.get_text(strip=True).upper()
                
                if "PREGRADO" in texto and "POSGRADO" not in texto and "TOTAL" not in texto:
                    subtitulo = "pregrado"
                    break
                elif "POSTGRADO" in texto and "TOTAL" not in texto:
                    subtitulo = "posgrado"
                    break
                elif "DIRECCION" in texto and "TESIS" in texto:
                    subtitulo = "tesis"
                    break
            
            # Si no hay subtítulo, no es tabla de docencia
            if not subtitulo:
                continue
            
            # Verificar tipo de tabla
            texto_tabla = tabla.get_text(strip=True).upper()
            
            # Tabla de TESIS (headers diferentes)
            if subtitulo == "tesis" and "CODIGO ESTUDIANTE" in texto_tabla:
                logger.info("   📝 Procesando tabla de TESIS...")
                actividades.extend(self._procesar_tabla_tesis(tabla))
                continue
            
            # Tabla de ASIGNATURAS (pregrado/posgrado)
            if "NOMBRE DE ASIGNATURA" in texto_tabla and "HORAS SEMESTRE" in texto_tabla:
                logger.info(f"   📖 Procesando tabla de {subtitulo.upper()}...")
                
                filas = tabla.find_all('tr')
                if len(filas) < 2:
                    logger.warning(f"   ⚠️ Tabla de {subtitulo} vacía o sin filas de datos")
                    continue
                
                # Extraer headers
                headers_row = filas[0]
                headers = [c.get_text(strip=True).upper() for c in headers_row.find_all(['td', 'th'])]
                
                # Procesar filas de datos
                for fila in filas[1:]:
                    celdas = fila.find_all(['td', 'th'])
                    valores = [c.get_text(strip=True) for c in celdas]
                    
                    if len(valores) < 2:  # Fila vacía
                        continue
                    
                    # Mapear headers → valores
                    obj = dict(zip(headers, valores))
                    
                    # Normalizar estructura
                    actividad_norm = self._normalizar_estructura_asignatura(obj, headers)
                    
                    # Validar datos mínimos
                    if not actividad_norm.get("NOMBRE DE ASIGNATURA"):
                        continue
                    
                    # Usar subtítulo encontrado
                    tipo_actividad = subtitulo
                    
                    actividad = {
                        "tipo_actividad": tipo_actividad,
                        "nombre_actividad": actividad_norm.get("NOMBRE DE ASIGNATURA", ""),
                        "horas_semestre": self._parsear_horas(actividad_norm.get("HORAS SEMESTRE", "0")),
                        "actividad_global": "docencia",
                        "codigo": actividad_norm.get("CODIGO", "")
                    }
                    
                    if actividad["nombre_actividad"]:
                        actividades.append(actividad)
                        logger.info(
                            f"      ✅ {tipo_actividad.upper()}: "
                            f"{actividad['codigo']} - {actividad['nombre_actividad']} ({actividad['horas_semestre']}h)"
                        )
        
        return actividades

    def _procesar_tabla_tesis(self, tabla) -> List[Dict[str, Any]]:
        """Procesa tabla de dirección de tesis."""
        actividades: List[Dict[str, Any]] = []
        
        filas = tabla.find_all('tr')
        if len(filas) < 2:
            return actividades
        
        headers_row = filas[0]
        headers = [c.get_text(strip=True).upper() for c in headers_row.find_all(['td', 'th'])]
        
        for fila in filas[1:]:
            celdas = fila.find_all(['td', 'th'])
            if not celdas:
                continue
            
            valores = [c.get_text(strip=True) for c in celdas]
            if not any(valores):
                continue
            
            obj = dict(zip(headers, valores))
            
            actividad = {
                "tipo_actividad": "tesis",
                "nombre_actividad": obj.get("TITULO DE LA TESIS", "") or obj.get("TITULO", ""),
                "horas_semestre": self._parsear_horas(obj.get("HORAS SEMESTRE", "0")),
                "actividad_global": "docencia",
                "codigo_estudiante": obj.get("CODIGO ESTUDIANTE", "") or obj.get("COD ESTUDIANTE", ""),
            }
            
            if actividad["nombre_actividad"]:
                actividades.append(actividad)
        
        return actividades
    
    def _extraer_horas_semestre(self, fila_celdas) -> float:
        """
        Extrae las horas del semestre de una fila.
        
        Reglas:
        1. Buscar celda con texto que contenga "HORAS" y "SEMESTRE"
        2. La celda siguiente en la MISMA FILA contiene el valor numérico
        3. Convertir a float, manejando formatos "144.00", "144" o con coma
        4. Si no se encuentra o es inválida, registrar warning y asignar 0.0
        
        Args:
            fila_celdas: Lista de celdas de la fila (objetos BeautifulSoup)
        
        Returns:
            float: Horas del semestre (0.0 si no se encuentra)
        """
        try:
            for i, celda in enumerate(fila_celdas):
                texto = celda.get_text(strip=True).upper()
                if "HORAS" in texto and "SEMESTRE" in texto:
                    # La siguiente celda tiene el valor
                    if i + 1 < len(fila_celdas):
                        valor_texto = fila_celdas[i + 1].get_text(strip=True)
                        if not valor_texto:
                            logger.warning("⚠️ Celda de HORAS SEMESTRE encontrada pero sin valor")
                            return 0.0
                        
                        # Usar la función de helpers para parsear robustamente
                        horas = parsear_horas(valor_texto)
                        if horas == 0.0:
                            logger.warning(f"⚠️ Valor de HORAS SEMESTRE no válido: '{valor_texto}'")
                        return horas
            
            logger.warning("⚠️ No se encontró columna HORAS SEMESTRE en fila")
            return 0.0
        
        except Exception as e:
            logger.warning(f"⚠️ Error al extraer HORAS SEMESTRE: {e}")
            return 0.0
    
    def _extraer_escuela_departamento(self, unidad_academica: str) -> tuple[str, str]:
        """
        Extrae departamento y escuela de UNIDAD ACADEMICA.
        
        Lógica:
        1. Extraer el texto completo de UNIDAD ACADEMICA
        2. Dividir por espacios
        3. Departamento = primera palabra (sin "ESCUELA" si aparece)
        4. Escuela = resto de palabras unidas (sin "ESCUELA" ni "DEPARTAMENTO")
        
        Ejemplos:
            "ESCUELA INGENIERIA DE SISTEMAS"
                - Departamento: "ESCUELA"
                - Escuela: "INGENIERIA DE SISTEMAS"
            
            "DEPARTAMENTO MEDICINA INTERNA"
                - Departamento: "DEPARTAMENTO"
                - Escuela: "MEDICINA INTERNA"
        
        Returns:
            tuple[str, str]: (departamento, escuela)
        """
        if not unidad_academica:
            return "", ""
        
        # Limpiar texto
        texto = unidad_academica.strip()
        
        # Dividir por espacios
        partes = texto.split()
        
        if len(partes) == 0:
            return "", ""
        
        if len(partes) == 1:
            # Si solo hay una palabra, es el departamento
            return partes[0], ""
        
        # Primera palabra = departamento
        departamento = partes[0]
        
        # Resto = escuela (sin palabras clave)
        escuela_partes = [p for p in partes[1:] if p.upper() not in ["ESCUELA", "DEPARTAMENTO"]]
        escuela = " ".join(escuela_partes)
        
        return departamento, escuela
    
    def _extraer_datos_personales_con_soup(self, html: str, info: InformacionPersonal) -> None:
        """
        Extrae datos personales usando BeautifulSoup, mapeando por encabezado y validando alineación.
        Si no logra extraer el nombre, intenta buscarlo en el HTML plano como último recurso.
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            tablas = soup.find_all('table')
            for tabla in tablas:
                filas = tabla.find_all('tr')
                if len(filas) < 2:
                    continue
                # Detectar si la primera fila tiene los headers relevantes
                headers_fila1 = [c.get_text(strip=True).upper() for c in filas[0].find_all(['td', 'th'])]
                if not any(h in headers_fila1 for h in ['CEDULA', 'DOCUMENTO', '1 APELLIDO', '2 APELLIDO', 'NOMBRE', 'UNIDAD ACADEMICA']):
                    continue
                logger.debug("Tabla de datos personales encontrada con BeautifulSoup")
                # Procesar fila 2 (valores)
                fila2 = filas[1]
                valores_fila2 = [c.get_text(strip=True) for c in fila2.find_all(['td', 'th'])]
                # Validar alineación
                if len(headers_fila1) != len(valores_fila2):
                    logger.warning(f"Desalineación entre headers y valores en datos personales: headers={len(headers_fila1)}, valores={len(valores_fila2)}")
                # Mapear por encabezado
                for i, header in enumerate(headers_fila1):
                    valor = valores_fila2[i] if i < len(valores_fila2) else ''
                    if not valor:
                        continue
                    if 'CEDULA' in header or 'DOCUMENTO' in header:
                        if not info.cedula and valor.isdigit():
                            info.cedula = valor
                    elif '1 APELLIDO' in header or header == 'APELLIDO1':
                        if not info.apellido1:
                            info.apellido1 = valor
                    elif '2 APELLIDO' in header or header == 'APELLIDO2':
                        if not info.apellido2:
                            info.apellido2 = valor
                    elif header == 'NOMBRE':
                        # Permitir nombres con espacios, tildes, guiones, etc. Solo descartar si está vacío o es solo números
                        #if not info.nombre and valor.isalpha():
                        if not info.nombre and valor.isalpha():
                            info.nombre = valor
                    elif 'UNIDAD' in header and 'ACADEMICA' in header:
                        if not info.unidad_academica:
                            info.unidad_academica = valor
                    elif 'ESCUELA' in header:
                        if not info.escuela:
                            info.escuela = valor
                    elif 'DEPARTAMENTO' in header or 'DPTO' in header:
                        if not info.departamento:
                            info.departamento = valor
                    elif 'CARGO' in header:
                        if not info.cargo:
                            info.cargo = valor
                # Procesar fila 4 si existe (vinculación, categoría, etc.)
                if len(filas) > 3:
                    headers_fila3 = [c.get_text(strip=True).upper() for c in filas[2].find_all(['td', 'th'])]
                    valores_fila4 = [c.get_text(strip=True) for c in filas[3].find_all(['td', 'th'])]
                    for i, header in enumerate(headers_fila3):
                        valor = valores_fila4[i] if i < len(valores_fila4) else ''
                        if not valor:
                            continue
                        if 'VINCULACION' in header or 'VINCULACIÓN' in header:
                            if not info.vinculacion:
                                info.vinculacion = valor
                        elif 'CATEGORIA' in header or 'CATEGORÍA' in header:
                            if not info.categoria:
                                info.categoria = valor
                        elif 'DEDICACION' in header or 'DEDICACIÓN' in header:
                            if not info.dedicacion:
                                info.dedicacion = valor
                        elif 'NIVEL' in header and 'ALCANZADO' in header:
                            if not info.nivel_alcanzado:
                                info.nivel_alcanzado = valor
                        elif 'CENTRO' in header and 'COSTO' in header:
                            if not info.centro_costo:
                                info.centro_costo = valor
                        elif 'CARGO' in header:
                            if not info.cargo:
                                info.cargo = valor
                        elif 'DEPARTAMENTO' in header or 'DPTO' in header:
                            if not info.departamento:
                                info.departamento = valor
                        elif 'ESCUELA' in header:
                            if not info.escuela:
                                info.escuela = valor
                # Buscar en filas adicionales (campo=valor)
                for i in range(4, min(len(filas), 10)):
                    fila = filas[i]
                    celdas = fila.find_all(['td', 'th'])
                    if len(celdas) >= 2:
                        for j in range(len(celdas) - 1):
                            campo = celdas[j].get_text(strip=True).upper()
                            valor = celdas[j + 1].get_text(strip=True)
                            if not valor:
                                continue
                            if 'CARGO' in campo and not info.cargo:
                                info.cargo = valor
                            elif ('DEPARTAMENTO' in campo or 'DPTO' in campo) and not info.departamento:
                                info.departamento = valor
                            elif 'ESCUELA' in campo and not info.escuela:
                                info.escuela = valor
                # Si encontramos datos clave, salir
                if info.cedula or info.nombre:
                    break
        except Exception as e:
            logger.warning(f"Error al extraer datos personales con BeautifulSoup: {e}")
            # Continuar con método regex como fallback
    
    def _procesar_informacion_personal(
        self,
        tabla_html: str,
        filas: List[str],
        info: InformacionPersonal
    ):
        """Procesa información personal usando regex (método original)."""
        if len(filas) < 4:
            return
        
        headers = self.extraer_celdas(filas[0])
        valores_fila2 = self.extraer_celdas(filas[1])
        valores_fila4 = self.extraer_celdas(filas[3])
        
        # Mapear valores de fila 2 (datos básicos: CEDULA, APELLIDOS, NOMBRE, UNIDAD, DEPARTAMENTO)
        for i, header in enumerate(headers):
            if i < len(valores_fila2):
                valor = valores_fila2[i].strip() if valores_fila2[i] else ''
                header_upper = header.upper()
                
                if 'CEDULA' in header_upper:
                    info.cedula = valor
                elif '1 APELLIDO' in header_upper or header_upper == 'APELLIDO1':
                    info.apellido1 = valor
                elif '2 APELLIDO' in header_upper or header_upper == 'APELLIDO2':
                    info.apellido2 = valor
                elif header_upper == 'NOMBRE':
                    info.nombre = valor
                elif 'UNIDAD' in header_upper and 'ACADEMICA' in header_upper:
                    info.unidad_academica = valor
                elif 'ESCUELA' in header_upper:
                    info.escuela = valor
                elif 'DEPARTAMENTO' in header_upper or 'DPTO' in header_upper:
                    info.departamento = valor
                    logger.debug(f"DEPARTAMENTO encontrado en fila 2, columna {i}: '{valor}'")
                elif 'CARGO' in header_upper:
                    info.cargo = valor
                    logger.debug(f"CARGO encontrado en fila 2, columna {i}: '{valor}'")
        
        # Si DEPARTAMENTO no se encontró por header, intentar por posición (columna 4 según análisis)
        if not info.departamento and len(valores_fila2) > 4:
            # Columna 4 (índice 4) según análisis HTML
            valor_posicion_4 = valores_fila2[4].strip() if valores_fila2[4] else ''
            if valor_posicion_4 and 'DEPARTAMENTO' in valor_posicion_4.upper():
                info.departamento = valor_posicion_4
                logger.debug(f"DEPARTAMENTO encontrado por posición (columna 4): '{valor_posicion_4}'")
        
        # Mapear valores de fila 4 usando headers si están disponibles
        if len(filas) > 3:
            headers_fila4 = self.extraer_celdas(filas[2]) if len(filas) > 2 else []
            for i, header in enumerate(headers_fila4 if headers_fila4 else []):
                if i < len(valores_fila4):
                    valor = valores_fila4[i]
                    header_upper = header.upper()
                    
                    if 'VINCULACION' in header_upper or 'VINCULACIÓN' in header_upper:
                        info.vinculacion = valor
                    elif 'CATEGORIA' in header_upper or 'CATEGORÍA' in header_upper:
                        info.categoria = valor
                    elif 'DEDICACION' in header_upper or 'DEDICACIÓN' in header_upper:
                        info.dedicacion = valor
                    elif 'NIVEL' in header_upper and 'ALCANZADO' in header_upper:
                        info.nivel_alcanzado = valor
                    elif 'CENTRO' in header_upper and 'COSTO' in header_upper:
                        info.centro_costo = valor
                    elif 'CARGO' in header_upper:
                        info.cargo = valor
                    elif 'DEPARTAMENTO' in header_upper or 'DPTO' in header_upper:
                        info.departamento = valor
                    elif 'ESCUELA' in header_upper:
                        info.escuela = valor
        
        # Si no se encontraron por headers, usar posición por defecto (compatibilidad)
        if len(valores_fila4) >= 5 and not info.vinculacion:
            info.vinculacion = valores_fila4[0]
            info.categoria = valores_fila4[1]
            info.dedicacion = valores_fila4[2]
            info.nivel_alcanzado = valores_fila4[3]
            info.centro_costo = valores_fila4[4]
        
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
                    elif 'ESCUELA' in celda_upper and not info.escuela:
                        info.escuela = valor_siguiente
    
    def _procesar_asignaturas(
        self,
        filas: List[str],
        headers: List[str],
        id_periodo: int
    ) -> Tuple[List[ActividadAsignatura], List[ActividadAsignatura]]:
        """Procesa actividades de asignaturas."""
        pregrado = []
        postgrado = []
        
        # Identificar índices de columnas ANTES del loop de filas
        indice_horas = -1
        indice_codigo = -1
        indice_porc = -1
        indice_grupo = -1
        indice_tipo = -1
        indice_nombre = -1
        
        logger.debug(f"Headers de tabla de asignaturas: {headers}")
        
        for j, header in enumerate(headers):
            header_upper = header.upper().strip()
            
            # Columna de HORAS SEMESTRE (prioridad alta)
            if 'HORAS' in header_upper and 'SEMESTRE' in header_upper:
                indice_horas = j
                logger.debug(f"✓ Columna HORAS SEMESTRE: índice {j}, header: '{header}'")
            # Columna de HORAS (fallback si no hay HORAS SEMESTRE)
            elif 'HORAS' in header_upper and indice_horas < 0:
                indice_horas = j
                logger.debug(f"✓ Columna HORAS (fallback): índice {j}, header: '{header}'")
            # Columna de CODIGO
            elif 'CODIGO' in header_upper and 'ESTUDIANTE' not in header_upper:
                indice_codigo = j
            # Columna PORC (para evitarla)
            elif 'PORC' in header_upper:
                indice_porc = j
            # Columna GRUPO
            elif 'GRUPO' in header_upper:
                indice_grupo = j
            # Columna TIPO
            elif 'TIPO' in header_upper and 'COMISION' not in header_upper:
                indice_tipo = j
            # Columna NOMBRE DE ASIGNATURA
            elif 'NOMBRE' in header_upper and 'ASIGNATURA' in header_upper:
                indice_nombre = j
                logger.debug(f"✓ Columna NOMBRE DE ASIGNATURA: índice {j}, header: '{header}'")
        
        logger.debug(f"Índices: Horas={indice_horas}, Código={indice_codigo}, Nombre={indice_nombre}")
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            # DEBUG: Mostrar celdas extraídas
            logger.debug(f"Fila {i}: {len(celdas)} celdas extraídas")
            for idx, celda in enumerate(celdas):
                if celda and celda.strip():
                    logger.debug(f"  Celda[{idx}]: '{celda[:50]}...' " if len(celda) > 50 else f"  Celda[{idx}]: '{celda}'")
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = ActividadAsignatura(periodo=id_periodo)
            
            # Extraer NOMBRE de asignatura usando headers específicos
            nombre_docencia = self._extraer_nombre_actividad_docencia(headers, celdas)
            logger.debug(f"  nombre_docencia extraído: '{nombre_docencia}'")
            if nombre_docencia:
                # Limpiar espacios múltiples y porcentajes al final
                nombre_limpio = re.sub(r'\s*\d+%$', '', nombre_docencia).strip()
                nombre_limpio = re.sub(r'\s+', ' ', nombre_limpio).strip()
                actividad.nombre_asignatura = nombre_limpio
                logger.debug(f"  Nombre de asignatura extraído: '{nombre_limpio}'")
            else:
                logger.warning("⚠️ No se pudo extraer nombre de asignatura en fila de docencia")
            
            # 2. Extraer HORAS usando el índice identificado
            if indice_horas >= 0 and indice_horas < len(celdas):
                horas_raw = celdas[indice_horas].strip() if celdas[indice_horas] else ''
                # Limpiar valor de horas (puede tener espacios o caracteres extra)
                horas_limpia = re.sub(r'[^\d.,]', '', horas_raw).replace(',', '.')
                if horas_limpia:
                    actividad.horas_semestre = horas_limpia
                    logger.debug(f"  Horas extraídas: '{horas_limpia}' de columna {indice_horas}")
            
            # Fallback 1: buscar horas en todas las celdas por header
            if not actividad.horas_semestre:
                for j, header in enumerate(headers):
                    if j < len(celdas) and 'HORAS' in header.upper():
                        horas_raw = celdas[j].strip() if celdas[j] else ''
                        horas_limpia = re.sub(r'[^\d.,]', '', horas_raw).replace(',', '.')
                        if horas_limpia:
                            actividad.horas_semestre = horas_limpia
                            logger.debug(f"  Horas extraídas (fallback header): '{horas_limpia}' de columna {j}")
                            break
            
            # Fallback 2: buscar número grande (>10) con decimales en las últimas celdas
            # (típicamente las horas están al final y son números como 128.00, 116.00)
            if not actividad.horas_semestre:
                for j in range(len(celdas) - 1, -1, -1):  # Buscar desde el final
                    valor = (celdas[j] or '').strip()
                    # Buscar números con decimales >= 10 (típico de horas semestre)
                    match = re.match(r'^(\d+)\.(\d+)$', valor)
                    if match and float(valor) >= 10:
                        actividad.horas_semestre = valor
                        logger.debug(f"  Horas extraídas (fallback número grande): '{valor}' de celda {j}")
                        break
            
            # 3. Extraer otros campos usando los índices
            if indice_codigo >= 0 and indice_codigo < len(celdas):
                actividad.codigo = celdas[indice_codigo].strip() if celdas[indice_codigo] else ''
            
            if indice_grupo >= 0 and indice_grupo < len(celdas):
                actividad.grupo = celdas[indice_grupo].strip() if celdas[indice_grupo] else ''
            
            if indice_tipo >= 0 and indice_tipo < len(celdas):
                actividad.tipo = celdas[indice_tipo].strip() if celdas[indice_tipo] else ''
            
            # 4. Extraer campos adicionales por nombre de header (fallback)
            for j, header in enumerate(headers):
                if j < len(celdas):
                    valor = celdas[j].strip() if celdas[j] else ''
                    header_upper = header.upper()
                    
                    # CRED, PORC, FREC, INTEN
                    if 'CRED' in header_upper and not actividad.cred:
                        actividad.cred = valor
                    elif 'PORC' in header_upper and not actividad.porc:
                        actividad.porc = valor
                    elif 'FREC' in header_upper and not actividad.frec:
                        actividad.frec = valor
                    elif 'INTEN' in header_upper and not actividad.inten:
                        actividad.inten = valor
            
            # Conversión de horas a número (más permisivo, igual que .gs)
            if actividad.horas_semestre and actividad.horas_semestre.strip():
                try:
                    # Limpiar horas: remover caracteres no numéricos excepto punto
                    horas_limpia = re.sub(r'[^\d.]', '', actividad.horas_semestre)
                    if horas_limpia:
                        horas_numero = float(horas_limpia)
                        actividad.horas_semestre = str(horas_numero)
                        logger.debug(f"  ✓ Horas: {horas_numero}")
                except (ValueError, TypeError):
                    logger.debug(f"⚠️ No se pudo convertir horas: '{actividad.horas_semestre}'")
                    actividad.horas_semestre = '0'
            else:
                actividad.horas_semestre = '0'
            
            # Limpiar nombre de actividad si existe (sin validaciones estrictas)
            if actividad.nombre_asignatura:
                nombre_limpio = actividad.nombre_asignatura.strip()
                # Solo limpiar porcentajes al final
                if nombre_limpio.endswith('%'):
                    nombre_limpio = re.sub(r'\s*\d+%$', '', nombre_limpio).strip()
                actividad.nombre_asignatura = nombre_limpio
            
            # Agregar actividad si tiene código O nombre (más permisivo, igual que .gs)
            if actividad.codigo or actividad.nombre_asignatura:
                if self._es_postgrado(actividad):
                    postgrado.append(actividad)
                    logger.debug(f"  ✓ Postgrado: '{actividad.nombre_asignatura}' - {actividad.horas_semestre}h")
                else:
                    pregrado.append(actividad)
                    logger.debug(f"  ✓ Pregrado: '{actividad.nombre_asignatura}' - {actividad.horas_semestre}h")
        
        return pregrado, postgrado
    
    def _procesar_asignaturas_con_seccion(
        self,
        filas: List[str],
        headers: List[str],
        id_periodo: int,
        seccion: str
    ) -> List[ActividadAsignatura]:
        """
        Procesa asignaturas usando la sección detectada (pregrado/postgrado).
        
        A diferencia de _procesar_asignaturas, esta función NO clasifica usando
        heurísticas - usa directamente la sección detectada del HTML.
        
        Args:
            filas: Filas de la tabla
            headers: Headers de la tabla
            id_periodo: ID del período
            seccion: 'pregrado' o 'postgrado'
            
        Returns:
            Lista de ActividadAsignatura
        """
        actividades = []
        
        # Identificar índices de columnas
        indice_horas = -1
        indice_codigo = -1
        indice_grupo = -1
        indice_tipo = -1
        indice_nombre = -1
        
        logger.debug(f"Procesando asignaturas de {seccion.upper()} con {len(filas)} filas")
        logger.debug(f"Headers: {headers}")
        
        for j, header in enumerate(headers):
            header_upper = header.upper().strip()
            
            if 'HORAS' in header_upper and 'SEMESTRE' in header_upper:
                indice_horas = j
            elif 'HORAS' in header_upper and indice_horas < 0:
                indice_horas = j
            elif 'CODIGO' in header_upper and 'ESTUDIANTE' not in header_upper:
                indice_codigo = j
            elif 'GRUPO' in header_upper:
                indice_grupo = j
            elif 'TIPO' in header_upper and 'COMISION' not in header_upper:
                indice_tipo = j
            elif 'NOMBRE' in header_upper and 'ASIGNATURA' in header_upper:
                indice_nombre = j
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = ActividadAsignatura(periodo=id_periodo)
            
            # Extraer NOMBRE de asignatura
            nombre_docencia = self._extraer_nombre_actividad_docencia(headers, celdas)
            if nombre_docencia:
                nombre_limpio = re.sub(r'\s*\d+%$', '', nombre_docencia).strip()
                nombre_limpio = re.sub(r'\s+', ' ', nombre_limpio).strip()
                actividad.nombre_asignatura = nombre_limpio
            
            # Extraer HORAS
            if indice_horas >= 0 and indice_horas < len(celdas):
                horas_raw = celdas[indice_horas].strip() if celdas[indice_horas] else ''
                horas_limpia = re.sub(r'[^\d.,]', '', horas_raw).replace(',', '.')
                if horas_limpia:
                    try:
                        actividad.horas_semestre = str(float(horas_limpia))
                    except ValueError:
                        actividad.horas_semestre = '0'
                else:
                    actividad.horas_semestre = '0'
            
            # Extraer CÓDIGO
            if indice_codigo >= 0 and indice_codigo < len(celdas):
                actividad.codigo = celdas[indice_codigo].strip()
            
            # Extraer GRUPO
            if indice_grupo >= 0 and indice_grupo < len(celdas):
                actividad.grupo = celdas[indice_grupo].strip()
            
            # Extraer TIPO
            if indice_tipo >= 0 and indice_tipo < len(celdas):
                actividad.tipo = celdas[indice_tipo].strip()
            
            # Agregar actividad si tiene datos mínimos
            if actividad.codigo or actividad.nombre_asignatura:
                actividades.append(actividad)
                logger.info(
                    f"   ✅ {seccion.upper()}: "
                    f"{actividad.codigo} - {actividad.nombre_asignatura} ({actividad.horas_semestre}h)"
                )
        
        return actividades
    
    def _procesar_investigacion(
        self,
        tabla_html: str,
        filas: List[str],
        headers: List[str],
        id_periodo: int
    ) -> List[ActividadInvestigacion]:
        """Procesa actividades de investigación."""
        actividades = []
        
        # Buscar tabla anidada
        tabla_interna = self._buscar_tabla_anidada(tabla_html) or tabla_html
        filas_internas = self.extraer_filas(tabla_interna)
        
        if not filas_internas:
            filas_internas = filas
        
        # Buscar fila de headers - más flexible, no requiere CODIGO
        header_index = -1
        headers_actuales = headers
        
        for i in range(min(10, len(filas_internas))):
            fila_texto = self.extraer_texto_de_celda(filas_internas[i]).upper()
            # Buscar por nombre del proyecto/anteproyecto Y horas - CODIGO es opcional
            tiene_nombre_proyecto = ('NOMBRE DEL PROYECTO' in fila_texto or 
                                     'NOMBRE DEL ANTEPROYECTO' in fila_texto or
                                     'PROPUESTA DE INVESTIGACION' in fila_texto)
            tiene_horas = 'HORAS SEMESTRE' in fila_texto or 'HORAS' in fila_texto
            
            if tiene_nombre_proyecto and tiene_horas:
                header_index = i
                headers_actuales = self.extraer_celdas(filas_internas[i])
                logger.debug(f"Headers de investigación encontrados en fila {i}: {headers_actuales}")
                break
        
        if header_index == -1:
            logger.debug("No se encontró fila de headers para investigación")
            return actividades
        
        # Procesar filas de datos
        for i in range(header_index + 1, len(filas_internas)):
            celdas = self.extraer_celdas(filas_internas[i])
            
            if len(celdas) < 2 or all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = ActividadInvestigacion(periodo=id_periodo)
            
            for j, header in enumerate(headers_actuales):
                if j < len(celdas):
                    valor = celdas[j]
                    header_upper = header.upper()
                    
                    if 'CODIGO' in header_upper:
                        actividad.codigo = valor
                    elif 'APROBADO' in header_upper:
                        actividad.aprobado_por = valor
                    elif 'NOMBRE' in header_upper or 'ANTEPROYECTO' in header_upper or 'PROPUESTA' in header_upper:
                        # Captura cualquier columna que tenga NOMBRE, ANTEPROYECTO o PROPUESTA
                        if not actividad.nombre_proyecto:  # Solo asignar si está vacío
                            actividad.nombre_proyecto = valor
                    elif 'HORAS' in header_upper:
                        actividad.horas_semestre = valor
            
            if actividad.nombre_proyecto or actividad.horas_semestre:
                logger.debug(f"Actividad de investigación encontrada: {actividad.nombre_proyecto} - {actividad.horas_semestre}h")
                actividades.append(actividad)
        
        logger.debug(f"Total actividades de investigación procesadas: {len(actividades)}")
        return actividades
    
    def _procesar_tesis(
        self,
        filas: List[str],
        headers: List[str],
        id_periodo: int
    ) -> List[Dict[str, Any]]:
        """Procesa actividades de dirección de tesis."""
        actividades = []
        
        # Identificar índices de columnas clave
        indice_horas = -1
        indice_titulo = -1
        indice_estudiante = -1
        
        for j, header in enumerate(headers):
            header_upper = header.upper()
            if 'HORAS' in header_upper and 'SEMESTRE' in header_upper:
                indice_horas = j
            elif 'HORAS' in header_upper and indice_horas == -1:
                indice_horas = j
            if 'TITULO' in header_upper or 'TESIS' in header_upper:
                indice_titulo = j
            if 'ESTUDIANTE' in header_upper or 'CODIGO' in header_upper:
                indice_estudiante = j
        
        logger.debug(f"Tesis - Índice horas: {indice_horas}, título: {indice_titulo}, estudiante: {indice_estudiante}")
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = {'PERIODO': id_periodo}
            
            # Guardar todos los valores con sus headers
            for j, header in enumerate(headers):
                if j < len(celdas):
                    valor = celdas[j].strip() if celdas[j] else ''
                    header_norm = header.upper()
                    actividad[header] = valor
                    actividad[header_norm] = valor
            
            # Extraer TITULO DE LA TESIS (buscar diferentes variantes)
            titulo = ''
            for key in ['TITULO DE LA TESIS', 'TITULO', 'Titulo de la Tesis', 'Titulo', 'TESIS']:
                if key in actividad and actividad[key]:
                    titulo = actividad[key]
                    break
            if not titulo and indice_titulo >= 0 and indice_titulo < len(celdas):
                titulo = celdas[indice_titulo].strip() if celdas[indice_titulo] else ''
            actividad['TITULO DE LA TESIS'] = titulo
            
            # Extraer HORAS SEMESTRE
            horas = ''
            for key in ['HORAS SEMESTRE', 'Horas Semestre', 'HORAS', 'Horas']:
                if key in actividad and actividad[key]:
                    # Verificar que sea un número válido
                    val = actividad[key].strip()
                    if val and re.match(r'^\d+\.?\d*$', val):
                        horas = val
                        break
            if not horas and indice_horas >= 0 and indice_horas < len(celdas):
                valor_horas = celdas[indice_horas].strip() if celdas[indice_horas] else ''
                if valor_horas and re.match(r'^\d+\.?\d*$', valor_horas):
                    horas = valor_horas
            actividad['HORAS SEMESTRE'] = horas
            
            # Extraer CODIGO ESTUDIANTE
            estudiante = ''
            for key in ['CODIGO ESTUDIANTE', 'Codigo Estudiante', 'ESTUDIANTE', 'Estudiante']:
                if key in actividad and actividad[key]:
                    estudiante = actividad[key]
                    break
            if not estudiante and indice_estudiante >= 0 and indice_estudiante < len(celdas):
                estudiante = celdas[indice_estudiante].strip() if celdas[indice_estudiante] else ''
            actividad['CODIGO ESTUDIANTE'] = estudiante
            
            logger.debug(f"Tesis procesada: título='{titulo}', horas='{horas}', estudiante='{estudiante}'")
            
            actividades.append(actividad)
        
        return actividades
    
    def _procesar_otras_actividades(
        self,
        tabla_html: str,
        filas: List[str],
        headers: List[str],
        headers_upper: List[str],
        id_periodo: int,
        resultado: DatosDocente
    ):
        """Procesa otras actividades (extensión, administrativas, intelectuales, etc.)."""
        # Primero verificar si es tabla de actividades intelectuales/artísticas
        texto_tabla = self.extraer_texto_de_celda(tabla_html).upper()
        
        # Actividades intelectuales o artísticas
        if 'ACTIVIDADES INTELECTUALES' in texto_tabla or 'ARTISTICAS' in texto_tabla:
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.actividades_intelectuales.extend(actividades)
            logger.debug(f"Actividades intelectuales/artísticas encontradas: {len(actividades)}")
            return  # Evitar que caiga en otras condiciones
        
        # Actividades complementarias
        if any('PARTICIPACION EN' in h for h in headers_upper):
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.actividades_complementarias.extend(actividades)
        
        # Docente en comisión
        elif any('TIPO DE COMISION' in h for h in headers_upper):
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.docente_en_comision.extend(actividades)
        
        # Actividades administrativas
        elif 'CARGO' in headers_upper and 'DESCRIPCION DEL CARGO' in headers_upper:
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.actividades_administrativas.extend(actividades)
        
        # Actividades de extensión
        elif ('TIPO' in headers_upper and
              'NOMBRE' in headers_upper and
              any('HORAS' in h or 'SEMESTRE' in h for h in headers_upper) and
              not any('APROBADO' in h for h in headers_upper)):
            actividades = self._procesar_actividades_genericas(filas, headers, id_periodo)
            resultado.actividades_extension.extend(actividades)
    
    def _procesar_actividades_genericas(
        self,
        filas: List[str],
        headers: List[str],
        id_periodo: int
    ) -> List[Dict[str, Any]]:
        """Procesa actividades genéricas (extensión, administrativas, complementarias, etc.)."""
        actividades = []
        
        # Identificar índices de columnas clave ANTES del loop
        indice_horas = -1
        indice_nombre = -1
        indice_titulo = -1
        indice_cargo = -1
        indice_descripcion = -1
        
        for j, header in enumerate(headers):
            header_upper = header.upper()
            
            # Priorizar "HORAS SEMESTRE" sobre solo "HORAS"
            if 'HORAS' in header_upper and 'SEMESTRE' in header_upper:
                indice_horas = j
                logger.debug(f"✓ Columna HORAS SEMESTRE identificada: índice {j}, header: '{header}'")
            elif 'HORAS' in header_upper and indice_horas == -1:
                indice_horas = j
                logger.debug(f"✓ Columna HORAS identificada: índice {j}, header: '{header}'")
            
            # Identificar columna NOMBRE (con variantes)
            if ('NOMBRE' in header_upper and 'ASIGNATURA' not in header_upper) or \
               ('NOMBRE' in header_upper and 'ANTEPROYECTO' in header_upper) or \
               ('NOMBRE' in header_upper and 'PROYECTO' in header_upper):
                if indice_nombre == -1:
                    indice_nombre = j
                    logger.debug(f"✓ Columna NOMBRE identificada: índice {j}, header: '{header}'")
            
            # Otras columnas
            if 'TITULO' in header_upper:
                indice_titulo = j
            if 'CARGO' in header_upper and 'DESCRIPCION' not in header_upper:
                indice_cargo = j
            if 'DESCRIPCION' in header_upper:
                indice_descripcion = j
        
        logger.debug(f"Actividades genéricas - Índices: Horas={indice_horas}, Nombre={indice_nombre}")
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = {'PERIODO': id_periodo}
            
            # Guardar todos los valores con sus headers originales
            for j, header in enumerate(headers):
                if j < len(celdas):
                    valor = celdas[j].strip() if celdas[j] else ''
                    header_norm = header.upper()
                    actividad[header] = valor
                    actividad[header_norm] = valor
            
            # Extraer HORAS SEMESTRE usando índice identificado primero
            horas = ''
            if indice_horas >= 0 and indice_horas < len(celdas):
                valor_horas = celdas[indice_horas].strip() if celdas[indice_horas] else ''
                # Validar que sea un número
                if valor_horas and re.match(r'^\d+\.?\d*$', valor_horas):
                    horas = valor_horas
                    logger.debug(f"  Horas extraídas (índice {indice_horas}): '{horas}'")
            
            # Fallback: buscar en diccionario por clave
            if not horas:
                for key in ['HORAS SEMESTRE', 'Horas Semestre', 'HORAS', 'Horas']:
                    if key in actividad and actividad[key]:
                        val = actividad[key].strip()
                        # Verificar que sea un número válido
                        if val and re.match(r'^\d+\.?\d*$', val):
                            horas = val
                            logger.debug(f"  Horas extraídas (clave '{key}'): '{horas}'")
                            break
            
            actividad['HORAS SEMESTRE'] = horas
            
            # Extraer NOMBRE usando índice identificado primero
            nombre = ''
            if indice_nombre >= 0 and indice_nombre < len(celdas):
                nombre_raw = celdas[indice_nombre].strip() if celdas[indice_nombre] else ''
                # Validar que NO sea un número (las horas no son el nombre)
                if nombre_raw and not re.match(r'^\d+\.?\d*$', nombre_raw):
                    nombre = nombre_raw
                    logger.debug(f"  Nombre extraído (índice {indice_nombre}): '{nombre}'")
                elif nombre_raw and re.match(r'^\d+\.?\d*$', nombre_raw):
                    logger.warning(f"⚠️ La columna NOMBRE contiene un número '{nombre_raw}' - posible error de columnas")
            
            # Fallback: buscar en diccionario por clave
            if not nombre:
                for key in ['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION', 'NOMBRE DEL PROYECTO', 'NOMBRE', 'Nombre']:
                    if key in actividad and actividad[key]:
                        nombre_raw = actividad[key].strip()
                        # Validar que NO sea un número
                        if nombre_raw and not re.match(r'^\d+\.?\d*$', nombre_raw):
                            nombre = nombre_raw
                            logger.debug(f"  Nombre extraído (clave '{key}'): '{nombre}'")
                            break
            
            actividad['NOMBRE'] = nombre
            
            # Extraer TITULO
            titulo = ''
            if indice_titulo >= 0 and indice_titulo < len(celdas):
                titulo = celdas[indice_titulo].strip() if celdas[indice_titulo] else ''
            if not titulo:
                for key in ['TITULO', 'Titulo']:
                    if key in actividad and actividad[key]:
                        titulo = actividad[key]
                        break
            actividad['TITULO'] = titulo
            
            # Extraer CARGO
            cargo = ''
            if indice_cargo >= 0 and indice_cargo < len(celdas):
                cargo = celdas[indice_cargo].strip() if celdas[indice_cargo] else ''
            if not cargo:
                for key in ['CARGO', 'Cargo']:
                    if key in actividad and actividad[key]:
                        cargo = actividad[key]
                        break
            actividad['CARGO'] = cargo
            
            # Extraer DESCRIPCION
            descripcion = ''
            if indice_descripcion >= 0 and indice_descripcion < len(celdas):
                descripcion = celdas[indice_descripcion].strip() if celdas[indice_descripcion] else ''
            if not descripcion:
                for key in ['DESCRIPCION DEL CARGO', 'DESCRIPCION', 'Descripcion del Cargo', 'Descripcion']:
                    if key in actividad and actividad[key]:
                        descripcion = actividad[key]
                        break
            actividad['DESCRIPCION DEL CARGO'] = descripcion
            actividad['DESCRIPCION'] = descripcion
            
            # Validar que el nombre NO sea un número
            if nombre and re.match(r'^\d+\.?\d*$', nombre):
                logger.error(f"❌ ERROR: Nombre de actividad es un número '{nombre}' - las columnas están invertidas")
            
            actividades.append(actividad)
        
        return actividades
    
    def _buscar_tabla_anidada(self, tabla_html: str) -> Optional[str]:
        """Busca tabla anidada dentro de otra tabla."""
        match = re.search(
            r'<tbody[^>]*>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(<table[^>]*>[\s\S]*?</table>)',
            tabla_html,
            re.IGNORECASE
        )
        return match.group(1) if match else None
    
    def _es_postgrado(self, actividad: ActividadAsignatura) -> bool:
        """Determina si una actividad es de postgrado."""
        nombre = actividad.nombre_asignatura.upper()
        tipo = actividad.tipo.upper()
        
        if any(kw in nombre or kw in tipo for kw in KEYWORDS_POSTGRADO):
            return True
        
        if any(kw in nombre or kw in tipo for kw in KEYWORDS_PREGRADO):
            return False
        
        # Analizar código numérico
        codigo_limpio = re.sub(r'[A-Za-z]', '', actividad.codigo)
        if codigo_limpio and re.match(r'^\d+$', codigo_limpio):
            if re.match(r'^[7-9]\d{2,}$', codigo_limpio):
                return True
            if re.match(r'^[1-5]\d{3,}$', codigo_limpio):
                return False
        
        return False
    
    def obtener_periodos_disponibles(self) -> List[Dict[str, Any]]:
        """
        Obtiene los períodos disponibles desde el portal.
        
        Returns:
            Lista de diccionarios con información de períodos
        """
        logger.info(f"Obteniendo períodos disponibles desde {UNIVALLE_PERIODOS_URL}")
        
        try:
            response = self.session.get(
                UNIVALLE_PERIODOS_URL,
                cookies=self.cookies if self.cookies else None,
                timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()
            response.encoding = 'iso-8859-1'
            html = response.text
            
            # Buscar options en select
            pattern = r'<option[^>]*value=["\']?(\d+)["\']?[^>]*>([\s\S]*?)</option>'
            matches = re.findall(pattern, html, re.IGNORECASE)
            
            periodos = []
            for match in matches:
                id_periodo = int(match[0])
                label_raw = re.sub(r'<[^>]+>', '', match[1]).strip()
                
                # Parsear label
                periodo_info = parsear_periodo_label(label_raw)
                if periodo_info:
                    periodos.append({
                        'idPeriod': id_periodo,
                        'year': periodo_info['year'],
                        'term': periodo_info['term'],
                        'label': f"{periodo_info['year']}-{periodo_info['term']}"
                    })
            
            # Ordenar por año y término (más reciente primero)
            periodos.sort(key=lambda x: (x['year'], x['term']), reverse=True)
            
            logger.info(f"Encontrados {len(periodos)} períodos disponibles")
            return periodos
            
        except Exception as e:
            logger.error(f"Error al obtener períodos: {e}")
            raise
    
    def scrape_teacher_data(
        self,
        cedula: str,
        id_periodo: Optional[int] = None,
        max_retries: int = 3,
        delay_min: float = 0.5,
        delay_max: float = 1.0
    ) -> List[Dict[str, Any]]:
        """
        Scrapea datos de un profesor y retorna lista de actividades.
        
        Construye URL, hace request GET con retry logic, parsea HTML usando
        los mismos selectores que en web/, extrae todos los campos requeridos
        y retorna lista de diccionarios (puede haber múltiples actividades).
        
        Args:
            cedula: Cédula del profesor
            id_periodo: ID del período. Si es None, usa el período más reciente
            max_retries: Número máximo de intentos (default: 3)
            delay_min: Delay mínimo entre requests en segundos (default: 0.5)
            delay_max: Delay máximo entre requests en segundos (default: 1.0)
        
        Returns:
            Lista de diccionarios, cada uno representa una actividad del profesor.
            Campos: cedula, nombre_profesor, escuela, departamento, tipo_actividad,
            categoria, nombre_actividad, numero_horas, periodo, actividad, 
            vinculacion, dedicacion, nivel
        
        Raises:
            ValueError: Si la cédula es inválida o no se encontraron datos
            requests.RequestException: Si hay error de conexión después de todos los intentos
        """
        cedula_limpia = limpiar_cedula(cedula)
        
        if not validar_cedula(cedula_limpia):
            raise ValueError(f"Cédula inválida: {cedula}")
        
        logger.info(f"{'='*60}")
        logger.info(f"🔍 INICIANDO SCRAPING PARA PROFESOR: {cedula_limpia}")
        logger.info(f"{'='*60}")
        
        # Obtener período si no se especifica
        if id_periodo is None:
            logger.info("Período no especificado, obteniendo período más reciente...")
            try:
                periodos = self.obtener_periodos_disponibles()
                if not periodos:
                    raise ValueError("No se encontraron períodos disponibles")
                id_periodo = periodos[0]['idPeriod']
                periodo_label = periodos[0]['label']
                logger.info(f"✓ Usando período más reciente: {periodo_label} (ID: {id_periodo})")
            except Exception as e:
                logger.error(f"Error al obtener período más reciente: {e}")
                raise ValueError(f"No se pudo obtener período más reciente: {e}")
        
        # Intentar scraping con retry logic
        ultimo_error = None
        
        for intento in range(1, max_retries + 1):
            try:
                logger.info(f"\n📡 Intento {intento}/{max_retries}")
                
                # Delay antes del request (excepto el primero)
                if intento > 1:
                    delay = random.uniform(delay_min, delay_max)
                    logger.debug(f"⏳ Esperando {delay:.2f}s antes del intento...")
                    time.sleep(delay)
                
                # Construir URL
                url = self.construir_url(cedula_limpia, id_periodo)
                logger.info(f"🌐 URL: {url}")
                
                # Hacer request
                inicio_request = time.time()
                response = self.session.get(
                    url,
                    cookies=self.cookies if self.cookies else None,
                    timeout=REQUEST_TIMEOUT
                )
                tiempo_request = time.time() - inicio_request
                logger.info(f"⏱️  Tiempo de respuesta: {tiempo_request:.2f}s")
                
                response.raise_for_status()
                
                # Decodificar HTML
                response.encoding = 'iso-8859-1'
                html = response.text
                logger.info(f"📄 HTML recibido: {len(html)} caracteres")
                
                # Validar que no esté vacío
                if len(html) < 100:
                    raise ValueError("Respuesta vacía o muy corta del servidor")
                
                # Manejar framesets
                if '<frameset' in html.lower() or '<frame' in html.lower():
                    logger.debug("Detectado frameset, extrayendo contenido...")
                    html = self._manejar_frameset(html, url)
                
                # Verificar si es página de error
                if '<title>error</title>' in html.lower() or re.search(r'<h1[^>]*>error', html, re.IGNORECASE):
                    raise ValueError("El servidor devolvió una página de error")
                
                # Parsear y extraer datos
                logger.info("🔄 Parseando HTML y extrayendo datos...")
                
                # Obtener label del período una sola vez
                periodo_label = str(id_periodo)
                try:
                    periodos = self.obtener_periodos_disponibles()
                    periodo_match = next((p for p in periodos if p['idPeriod'] == id_periodo), None)
                    if periodo_match:
                        periodo_label = periodo_match['label']
                except:
                    logger.debug(f"No se pudo obtener label del período, usando ID: {id_periodo}")
                
                actividades = self._extraer_actividades_desde_html(html, cedula_limpia, id_periodo, periodo_label)
                
                if not actividades:
                    logger.warning("⚠️ No se encontraron actividades en el HTML")
                    # Verificar si es página de login (esto sí es un error)
                    tiene_formulario = '<form' in html.lower() and 'periodo academico' in html.lower()
                    tiene_tablas = len(self.extraer_tablas(html)) < 2
                    if tiene_formulario and tiene_tablas:
                        raise ValueError("Página de login detectada - no se encontraron datos del docente")
                    # No hay actividades para este docente/período - esto es normal, retornar lista vacía
                    logger.info(f"ℹ️ Docente {cedula_limpia} sin actividades para el período {periodo_label}")
                    return []
                
                # Validaciones robustas de calidad de datos
                self._validar_actividades(actividades, cedula_limpia)
                
                logger.info(f"✅ Scraping exitoso: {len(actividades)} actividades encontradas")
                logger.info(f"{'='*60}\n")
                
                return actividades
                
            except (NameError, AttributeError, KeyError, TypeError) as e:
                # Errores de código Python: NO reintentar, propagar inmediatamente
                logger.error(f"❌ Error de código en cédula {cedula_limpia}: {e}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise
            
            except requests.Timeout as e:
                # Errores de timeout: SÍ reintentar
                ultimo_error = e
                logger.warning(f"⏱️  Timeout en intento {intento}/{max_retries}: {e}")
                if intento < max_retries:
                    logger.info("🔄 Reintentando...")
            
            except requests.HTTPError as e:
                # HTTPError es subtipo de RequestException, manejar códigos recuperables/no recuperables
                ultimo_error = e
                status_code = e.response.status_code if e.response else 'unknown'
                logger.warning(f"❌ Error HTTP {status_code} en intento {intento}/{max_retries}: {e}")
                
                # Errores que no deberían reintentarse
                if status_code in [400, 401, 403, 404]:
                    logger.error(f"Error HTTP {status_code} no es recuperable")
                    raise
                
                if intento < max_retries:
                    logger.info("🔄 Reintentando...")
            
            except ValueError as e:
                # Errores de validación: NO reintentar
                logger.error(f"❌ Error de validación: {e}")
                raise
            
            except (requests.RequestException, ConnectionError) as e:
                # Otros errores de red (RequestException genérico, ConnectionError): SÍ reintentar
                ultimo_error = e
                logger.warning(f"🔌 Error de conexión en intento {intento}/{max_retries}: {e}")
                if intento < max_retries:
                    logger.info("🔄 Reintentando...")
            
            except Exception as e:
                # Cualquier otro error inesperado se considera de código: NO reintentar
                ultimo_error = e
                logger.error(f"💥 Error inesperado en intento {intento}/{max_retries}: {e}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise
        
        # Si llegamos aquí, todos los intentos fallaron
        logger.error(f"❌ Todos los intentos fallaron después de {max_retries} intentos")
        raise requests.RequestException(
            f"Error al scrapear datos del profesor {cedula_limpia} después de {max_retries} intentos: {ultimo_error}"
        )
    
    def _validar_actividades(
        self,
        actividades: List[Dict[str, Any]],
        cedula: str
    ) -> None:
        """
        Valida la calidad de las actividades extraídas.
        
        Args:
            actividades: Lista de actividades a validar
            cedula: Cédula del profesor (para logging)
        
        No lanza excepciones, solo registra errores para análisis.
        """
        if not actividades:
            logger.warning(f"⚠️ No hay actividades para validar (cédula: {cedula})")
            return
        
        logger.info(f"🔍 Validando {len(actividades)} actividades para cédula {cedula}...")
        
        total_errores = 0
        actividades_con_errores = 0
        
        for idx, act in enumerate(actividades, 1):
            errores = []
            
            # Validar nombre de actividad
            nombre_actividad = act.get('nombre_actividad', '')
            if not nombre_actividad or not nombre_actividad.strip():
                errores.append(f"Nombre actividad vacío o faltante")
            elif nombre_actividad.strip().endswith('%'):
                errores.append(f"Nombre actividad termina en porcentaje: '{nombre_actividad}'")
            elif len(nombre_actividad.strip()) < 4:
                errores.append(f"Nombre actividad muy corto: '{nombre_actividad}'")
            
            # Validar horas
            horas = act.get('numero_horas', 0)
            # Convertir a número si es string
            if isinstance(horas, str):
                try:
                    horas = float(horas) if horas.strip() else 0
                except (ValueError, AttributeError):
                    horas = 0
            
            if horas <= 0:
                errores.append(f"Horas inválidas o faltantes: {horas}")
            
            # Validar cargo
            cargo = act.get('cargo', '')
            if not cargo or not cargo.strip():
                errores.append("Cargo faltante")
            
            # Validar departamento
            departamento = act.get('departamento', '')
            if not departamento or not departamento.strip():
                errores.append("Departamento faltante")
            
            # Validar cédula
            if not act.get('cedula') or act.get('cedula') != cedula:
                errores.append(f"Cédula no coincide: esperada '{cedula}', encontrada '{act.get('cedula')}'")
            
            # Validar nombre de profesor
            if not act.get('nombre_profesor') or not act.get('nombre_profesor').strip():
                errores.append("Nombre de profesor faltante")
            
            # Si hay errores, registrarlos
            if errores:
                actividades_con_errores += 1
                total_errores += len(errores)
                
                logger.error(
                    f"❌ Validación fallida para actividad #{idx} (cédula {cedula}): "
                    f"{', '.join(errores)}"
                )
                logger.debug(f"   Actividad problemática: {act}")
        
        # Resumen de validación
        if total_errores > 0:
            logger.warning(
                f"⚠️ Validación completada: {actividades_con_errores}/{len(actividades)} actividades "
                f"con errores ({total_errores} errores totales)"
            )
        else:
            logger.info(f"✅ Validación exitosa: todas las {len(actividades)} actividades son válidas")
    
    def _extraer_actividades_desde_html(
        self,
        html: str,
        cedula: str,
        id_periodo: int,
        periodo_label: str
    ) -> List[Dict[str, Any]]:
        """
        Extrae todas las actividades desde el HTML y las retorna como lista de diccionarios.
        
        Args:
            html: HTML completo del portal (ya obtenido)
            cedula: Cédula del profesor
            id_periodo: ID del período
            
        Returns:
            Lista de diccionarios, cada uno representa una actividad
        """
        cedula_limpia = cedula
        
        # Logging detallado de parámetros de entrada
        logger.info("📋 Parámetros recibidos:")
        logger.info(f"   - cedula: {cedula}")
        logger.info(f"   - id_periodo: {id_periodo}")
        logger.info(f"   - periodo_label: {periodo_label}")
        logger.info(f"   - len(html): {len(html)}")
        
        actividades = []
        
        # Procesar HTML directamente (sin hacer nueva petición)
        logger.debug("Parseando HTML para extraer datos del docente...")
        
        # Crear estructura temporal para procesar
        resultado = DatosDocente(periodo=id_periodo)
        
        tablas = self.extraer_tablas(html)
        
        # Variable para guardar el contexto de la sección actual
        # Esto es necesario porque en el HTML de Univalle, los títulos de sección
        # están en tablas separadas de los datos
        seccion_actual = None
        
        for tabla_idx, tabla_html in enumerate(tablas, 1):
            logger.debug(f"Procesando tabla {tabla_idx}/{len(tablas)}")
            
            # Primero verificar si es una tabla de título de sección
            seccion_detectada = self._detectar_seccion_titulo(tabla_html)
            if seccion_detectada:
                seccion_actual = seccion_detectada
                logger.debug(f"Detectada sección: {seccion_actual}")
                continue  # Pasar a la siguiente tabla (que tendrá los datos)
            
            filas = self.extraer_filas(tabla_html)
            if not filas:
                continue
            
            headers = self.extraer_celdas(filas[0])
            headers_upper = [h.upper() for h in headers]
            
            # Si tenemos contexto de sección, procesar con ese contexto
            if seccion_actual:
                self._procesar_tabla_con_contexto(
                    tabla_html, filas, headers, id_periodo, seccion_actual, resultado
                )
                seccion_actual = None  # Limpiar el contexto después de usar
                continue
            
            # Identificar y procesar según tipo (sin contexto previo)
            if self._es_tabla_informacion_personal(headers_upper):
                self._procesar_informacion_personal(
                    tabla_html, filas, resultado.informacion_personal
                )
            
            elif self._es_tabla_asignaturas(headers_upper):
                pregrado, postgrado = self._procesar_asignaturas(
                    filas, headers, id_periodo
                )
                resultado.actividades_pregrado.extend(pregrado)
                resultado.actividades_postgrado.extend(postgrado)
            
            elif self._es_tabla_investigacion(tabla_html, headers_upper):
                investigacion = self._procesar_investigacion(
                    tabla_html, filas, headers, id_periodo
                )
                resultado.actividades_investigacion.extend(investigacion)
            
            elif self._es_tabla_tesis(headers_upper):
                tesis = self._procesar_tesis(filas, headers, id_periodo)
                resultado.actividades_tesis.extend(tesis)
            
            # Procesar otros tipos de actividades
            self._procesar_otras_actividades(
                tabla_html, filas, headers, headers_upper, id_periodo, resultado
            )
        
        # Extraer información personal usando BeautifulSoup (método principal)
        self._extraer_datos_personales_con_soup(html, resultado.informacion_personal)
        
        # Extraer información personal desde texto plano como fallback
        self._extraer_info_personal_desde_texto_plano(html, resultado.informacion_personal)
        
        # Validar que se encontraron datos críticos
        info = resultado.informacion_personal
        if not info.departamento:
            logger.warning(f"⚠️ No se encontró DEPARTAMENTO para cédula {cedula_limpia}")
        if not info.cargo:
            logger.warning(f"⚠️ No se encontró CARGO para cédula {cedula_limpia}")
        if not info.escuela and not info.unidad_academica:
            logger.warning(f"⚠️ No se encontró ESCUELA ni UNIDAD ACADEMICA para cédula {cedula_limpia}")
        
        # Usar los datos procesados
        datos_docente = resultado
        
        info = datos_docente.informacion_personal
        
        # Construir datos base compartidos
        nombre_completo = self._construir_nombre_completo(info)
        
        # Extraer escuela y departamento a partir de UNIDAD ACADEMICA
        # según la lógica acordada.
        escuela = ""
        departamento = ""
        
        if info.unidad_academica:
            departamento, escuela = self._extraer_escuela_departamento(info.unidad_academica)
            logger.debug(
                f"UNIDAD ACADEMICA: '{info.unidad_academica}' -> "
                f"Departamento: '{departamento}', Escuela: '{escuela}'"
            )
        else:
            # Fallback a los campos separados si no hay UNIDAD ACADEMICA
            escuela_raw = info.escuela or ''
            departamento_raw = info.departamento or ''
            if escuela_raw:
                escuela = limpiar_escuela(escuela_raw)
                logger.debug(f"Escuela (fallback): '{escuela_raw}' -> '{escuela}'")
            if departamento_raw:
                departamento = limpiar_departamento(departamento_raw)
                logger.debug(f"Departamento (fallback): '{departamento_raw}' -> '{departamento}'")
        
        vinculacion = info.vinculacion or ''
        dedicacion = info.dedicacion or ''
        nivel = info.nivel_alcanzado or ''
        cargo = info.cargo or ''
        categoria_info = info.categoria or ''
        
        logger.debug(f"Procesando actividades para período {periodo_label}")
        logger.debug(f"NIVEL ALCANZADO extraído: '{nivel}'")
        logger.debug(f"VINCULACION extraída: '{vinculacion}'")
        logger.debug(f"DEDICACION extraída: '{dedicacion}'")
        
        # Procesar actividades de pregrado
        logger.debug(f"Total actividades de PREGRADO: {len(datos_docente.actividades_pregrado)}")
        for actividad in datos_docente.actividades_pregrado:
            # Log para debug de cada actividad
            logger.debug(f"  Pregrado - nombre_asignatura: '{actividad.nombre_asignatura}', horas_semestre: '{actividad.horas_semestre}'")
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Docencia',
                categoria='Pregrado',
                nombre_actividad=actividad.nombre_asignatura or '',
                numero_horas=actividad.horas_semestre,
                periodo=periodo_label,
                actividad='ACTIVIDADES DE DOCENCIA',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        # Procesar actividades de postgrado
        logger.debug(f"Total actividades de POSTGRADO: {len(datos_docente.actividades_postgrado)}")
        for actividad in datos_docente.actividades_postgrado:
            # Log para debug de cada actividad
            logger.debug(f"  Postgrado - nombre_asignatura: '{actividad.nombre_asignatura}', horas_semestre: '{actividad.horas_semestre}'")
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Docencia',
                categoria='Postgrado',
                nombre_actividad=actividad.nombre_asignatura or '',
                numero_horas=actividad.horas_semestre,
                periodo=periodo_label,
                actividad='ACTIVIDADES DE DOCENCIA',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        # Helper para determinar categoría de investigación
        def determinar_categoria_investigacion(act):
            nombre = str(act.nombre_proyecto or '').upper()
            if 'ANTEPROYECTO' in nombre:
                return 'Anteproyecto'
            return 'Proyecto'
        
        # Procesar actividades de investigación
        logger.debug(f"Total actividades de INVESTIGACION: {len(datos_docente.actividades_investigacion)}")
        for actividad in datos_docente.actividades_investigacion:
            # Log para debug de cada actividad
            logger.debug(f"  Investigación - nombre_proyecto: '{actividad.nombre_proyecto}', horas_semestre: '{actividad.horas_semestre}'")
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Investigación',
                categoria=determinar_categoria_investigacion(actividad),
                nombre_actividad=actividad.nombre_proyecto or '',
                numero_horas=actividad.horas_semestre,
                periodo=periodo_label,
                actividad='ACTIVIDADES DE INVESTIGACION',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        # Procesar dirección de tesis
        logger.debug(f"Total actividades de TESIS: {len(datos_docente.actividades_tesis)}")
        for tesis in datos_docente.actividades_tesis:
            titulo_tesis = tesis.get('TITULO DE LA TESIS', '') or tesis.get('Titulo de la Tesis', '') or tesis.get('TITULO', '')
            horas_tesis = tesis.get('HORAS SEMESTRE', '') or tesis.get('Horas Semestre', '')
            codigo_est = tesis.get('CODIGO ESTUDIANTE', '') or tesis.get('Codigo Estudiante', '') or tesis.get('ESTUDIANTE', '')
            
            logger.debug(f"  Tesis - título: '{titulo_tesis}', horas: '{horas_tesis}', keys: {list(tesis.keys())}")
            
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Docencia',
                categoria='Tesis',
                nombre_actividad=titulo_tesis,
                numero_horas=horas_tesis,
                periodo=periodo_label,
                actividad='ACTIVIDADES DE DOCENCIA',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        # Procesar actividades de extensión
        for actividad in datos_docente.actividades_extension:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Extensión',
                categoria=actividad.get('TIPO', '') or actividad.get('Tipo', ''),
                nombre_actividad=actividad.get('NOMBRE', '') or actividad.get('Nombre', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                actividad='ACTIVIDADES DE EXTENSION',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        # Procesar actividades intelectuales
        for actividad in datos_docente.actividades_intelectuales:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Intelectuales',
                categoria=actividad.get('TIPO', '') or actividad.get('Tipo', ''),
                nombre_actividad=actividad.get('NOMBRE', '') or actividad.get('Nombre', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                actividad='ACTIVIDADES INTELECTUALES O ARTISTICAS',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        # Procesar actividades administrativas
        for actividad in datos_docente.actividades_administrativas:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Administrativas',
                categoria=actividad.get('CARGO', '') or actividad.get('Cargo', ''),
                nombre_actividad=actividad.get('DESCRIPCION DEL CARGO', '') or actividad.get('DESCRIPCION', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                actividad='ACTIVIDADES ADMINISTRATIVAS',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        # Procesar actividades complementarias
        for actividad in datos_docente.actividades_complementarias:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Complementarias',
                categoria=actividad.get('PARTICIPACION EN', '') or '',
                nombre_actividad=actividad.get('NOMBRE', '') or actividad.get('Nombre', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                actividad='ACTIVIDADES COMPLEMENTARIAS',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        # Procesar docente en comisión
        for actividad in datos_docente.docente_en_comision:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Comisión',
                categoria=actividad.get('TIPO DE COMISION', '') or actividad.get('Tipo de Comision', ''),
                nombre_actividad=actividad.get('DESCRIPCION', '') or actividad.get('Descripcion', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                actividad='DOCENTE EN COMISION',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel
            ))
        
        logger.debug(f"Total actividades extraídas: {len(actividades)}")
        return actividades
    
    def _construir_actividad_dict(
        self,
        cedula: str,
        nombre_profesor: str,
        escuela: str,
        departamento: str,
        tipo_actividad: str,
        categoria: str,
        nombre_actividad: str,
        numero_horas: str,
        periodo: str,
        actividad: str,
        vinculacion: str,
        dedicacion: str,
        nivel: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Construye un diccionario con los 13 campos requeridos para una actividad.
        
        Orden: cedula, nombre profesor, escuela, departamento, tipo actividad, 
               categoría, nombre actividad, número de horas, periodo, actividad, 
               vinculación, dedicación, nivel
        
        Returns:
            Diccionario con todos los campos de la actividad
        """
        # Limpiar nombre de actividad
        nombre_actividad_limpio = str(nombre_actividad).strip() if nombre_actividad else ''
        
        # Limpiar porcentajes al final si existen
        if nombre_actividad_limpio.endswith('%'):
            nombre_actividad_limpio = re.sub(r'\s*\d+%$', '', nombre_actividad_limpio).strip()
        
        # Parsear horas a número
        horas_numero = parsear_horas(numero_horas)
        
        # Limpiar escuela y departamento
        escuela_limpia = limpiar_escuela(escuela)
        departamento_limpio = limpiar_departamento(departamento)
        
        # Construir diccionario (13 campos en orden correcto)
        actividad_dict = {
            'cedula': str(cedula),
            'nombre_profesor': str(nombre_profesor),
            'escuela': escuela_limpia,
            'departamento': departamento_limpio,
            'tipo_actividad': str(tipo_actividad),
            'categoria': str(categoria),
            'nombre_actividad': nombre_actividad_limpio,
            'numero_horas': horas_numero,
            'periodo': str(periodo),
            'actividad': str(actividad),
            'vinculacion': str(vinculacion),
            'dedicacion': str(dedicacion),
            'nivel': str(nivel) if nivel else '',
            **kwargs
        }
        
        return actividad_dict
    
    def _extraer_info_personal_desde_texto_plano(self, html: str, info: InformacionPersonal):
        """
        Extrae información personal desde texto plano como fallback.
        
        Busca patrones como: VINCULACION=valor, CATEGORIA=valor, etc.
        
        Args:
            html: HTML completo
            info: Objeto InformacionPersonal a actualizar
        """
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
            # Solo actualizar si el campo no está ya poblado
            if campo == 'VINCULACION' and info.vinculacion:
                continue
            elif campo == 'CATEGORIA' and info.categoria:
                continue
            elif campo == 'DEDICACION' and info.dedicacion:
                continue
            elif campo == 'NIVEL ALCANZADO' and info.nivel_alcanzado:
                continue
            
            for regex in regexes:
                match = re.search(regex, html_norm, re.IGNORECASE)
                if match:
                    valor = match.group(1).strip()
                    if valor and len(valor) < 100 and '<' not in valor:
                        if campo == 'VINCULACION':
                            info.vinculacion = valor
                        elif campo == 'CATEGORIA':
                            info.categoria = valor
                        elif campo == 'DEDICACION':
                            info.dedicacion = valor
                        elif campo == 'NIVEL ALCANZADO':
                            info.nivel_alcanzado = valor
                        logger.debug(f"Campo {campo} encontrado en texto plano: {valor}")
                        break
    
    def _construir_nombre_completo(self, info: InformacionPersonal) -> str:
        """
        Construye nombre completo desde información personal.
        
        Args:
            info: Información personal del docente
            
        Returns:
            Nombre completo formateado
        """
        return formatear_nombre_completo(
            nombre=info.nombre,
            apellido1=info.apellido1,
            apellido2=info.apellido2
        )