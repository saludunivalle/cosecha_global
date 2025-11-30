"""
Servicio de scraping del portal Univalle
Basado en la lógica documentada en docs/SCRAPING_UNIVALLE_PYTHON.md
"""

import re
import logging
import time
import random
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
        """Extrae celdas de una fila, manejando colspan."""
        pattern = r'<t[dh][^>]*>([\s\S]*?)</t[dh]>'
        matches = re.findall(pattern, fila_html, re.IGNORECASE)
        
        celdas = []
        for match in matches:
            # Buscar colspan
            colspan_match = re.search(r'colspan=["\']?(\d+)["\']?', match, re.IGNORECASE)
            colspan = int(colspan_match.group(1)) if colspan_match else 1
            
            # Extraer texto
            texto = self.extraer_texto_de_celda(match)
            
            # Replicar según colspan
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
        cedula_limpia = limpiar_cedula(cedula)
        
        logger.info(f"Procesando docente {cedula_limpia} para período {id_periodo}")
        
        html = self.obtener_html(cedula_limpia, id_periodo)
        
        resultado = DatosDocente(periodo=id_periodo)
        
        tablas = self.extraer_tablas(html)
        
        for tabla_idx, tabla_html in enumerate(tablas, 1):
            logger.debug(f"Procesando tabla {tabla_idx}/{len(tablas)}")
            
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
            f"Investigación={len(resultado.actividades_investigacion)}"
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
        tiene_codigo = 'CODIGO' in texto
        tiene_nombre = ('NOMBRE DEL PROYECTO' in texto or
                       'NOMBRE DEL ANTEPROYECTO' in texto)
        tiene_horas = 'HORAS SEMESTRE' in texto
        
        return tiene_titulo and tiene_codigo and tiene_nombre and tiene_horas
    
    def _es_tabla_tesis(self, headers_upper: List[str]) -> bool:
        """Verifica si es tabla de tesis."""
        tiene_estudiante = any('ESTUDIANTE' in h for h in headers_upper)
        tiene_plan = any('PLAN' in h for h in headers_upper)
        tiene_titulo = any('TITULO' in h or 'TESIS' in h for h in headers_upper)
        return tiene_estudiante and (tiene_plan or tiene_titulo)
    
    def _extraer_datos_personales_con_soup(self, html: str, info: InformacionPersonal) -> None:
        """
        Extrae datos personales usando BeautifulSoup.
        Basado en cómo lo hace web/ en personal-info.ts
        
        Args:
            html: HTML completo del portal
            info: Objeto InformacionPersonal a actualizar
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Buscar todas las tablas
            tablas = soup.find_all('table')
            
            for tabla in tablas:
                filas = tabla.find_all('tr')
                if len(filas) < 2:
                    continue
                
                # Verificar si es tabla de datos personales
                primera_fila_texto = filas[0].get_text(strip=True).upper()
                if 'CEDULA' not in primera_fila_texto and 'APELLIDO' not in primera_fila_texto:
                    continue
                
                logger.debug("Tabla de datos personales encontrada con BeautifulSoup")
                
                # Procesar fila 2 (índice 1): CEDULA, APELLIDOS, NOMBRE, UNIDAD, DEPARTAMENTO
                if len(filas) > 1:
                    fila2 = filas[1]
                    celdas_fila2 = fila2.find_all(['td', 'th'])
                    
                    for i, celda in enumerate(celdas_fila2):
                        texto = celda.get_text(strip=True)
                        if not texto:
                            continue
                        
                        # Buscar en headers de la primera fila
                        if len(filas) > 0:
                            headers_fila1 = filas[0].find_all(['td', 'th'])
                            if i < len(headers_fila1):
                                header_texto = headers_fila1[i].get_text(strip=True).upper()
                                
                                if 'CEDULA' in header_texto or 'DOCUMENTO' in header_texto:
                                    if not info.cedula:
                                        info.cedula = texto
                                elif '1 APELLIDO' in header_texto or header_texto == 'APELLIDO1':
                                    if not info.apellido1:
                                        info.apellido1 = texto
                                elif '2 APELLIDO' in header_texto or header_texto == 'APELLIDO2':
                                    if not info.apellido2:
                                        info.apellido2 = texto
                                elif header_texto == 'NOMBRE':
                                    if not info.nombre:
                                        info.nombre = texto
                                elif 'UNIDAD' in header_texto and 'ACADEMICA' in header_texto:
                                    if not info.unidad_academica:
                                        info.unidad_academica = texto
                                elif 'DEPARTAMENTO' in header_texto or 'DPTO' in header_texto:
                                    if not info.departamento:
                                        info.departamento = texto
                                        logger.debug(f"DEPARTAMENTO encontrado con BeautifulSoup: '{texto}'")
                                elif 'CARGO' in header_texto:
                                    if not info.cargo:
                                        info.cargo = texto
                                        logger.debug(f"CARGO encontrado con BeautifulSoup: '{texto}'")
                        
                        # Fallback: buscar por posición (columna 4 según análisis)
                        if i == 4 and not info.departamento:
                            if 'DEPARTAMENTO' in texto.upper() or 'DPTO' in texto.upper():
                                info.departamento = texto
                                logger.debug(f"DEPARTAMENTO encontrado por posición con BeautifulSoup: '{texto}'")
                
                # Procesar fila 4 (índice 3): VINCULACION, CATEGORIA, DEDICACION, NIVEL, CENTRO COSTO
                if len(filas) > 3:
                    fila4 = filas[3]
                    celdas_fila4 = fila4.find_all(['td', 'th'])
                    
                    # Buscar headers de fila 3 (índice 2) si existen
                    headers_fila3 = []
                    if len(filas) > 2:
                        headers_fila3 = filas[2].find_all(['td', 'th'])
                    
                    for i, celda in enumerate(celdas_fila4):
                        texto = celda.get_text(strip=True)
                        if not texto:
                            continue
                        
                        if i < len(headers_fila3):
                            header_texto = headers_fila3[i].get_text(strip=True).upper()
                            
                            if 'VINCULACION' in header_texto or 'VINCULACIÓN' in header_texto:
                                if not info.vinculacion:
                                    info.vinculacion = texto
                            elif 'CATEGORIA' in header_texto or 'CATEGORÍA' in header_texto:
                                if not info.categoria:
                                    info.categoria = texto
                            elif 'DEDICACION' in header_texto or 'DEDICACIÓN' in header_texto:
                                if not info.dedicacion:
                                    info.dedicacion = texto
                            elif 'NIVEL' in header_texto and 'ALCANZADO' in header_texto:
                                if not info.nivel_alcanzado:
                                    info.nivel_alcanzado = texto
                            elif 'CENTRO' in header_texto and 'COSTO' in header_texto:
                                if not info.centro_costo:
                                    info.centro_costo = texto
                            elif 'CARGO' in header_texto:
                                if not info.cargo:
                                    info.cargo = texto
                                    logger.debug(f"CARGO encontrado en fila 4 con BeautifulSoup: '{texto}'")
                            elif 'DEPARTAMENTO' in header_texto or 'DPTO' in header_texto:
                                if not info.departamento:
                                    info.departamento = texto
                                    logger.debug(f"DEPARTAMENTO encontrado en fila 4 con BeautifulSoup: '{texto}'")
                
                # Buscar cargo y departamento en filas adicionales (formato campo=valor)
                for i in range(4, min(len(filas), 10)):
                    fila = filas[i]
                    celdas = fila.find_all(['td', 'th'])
                    
                    if len(celdas) >= 2:
                        for j in range(len(celdas) - 1):
                            campo = celdas[j].get_text(strip=True).upper()
                            valor = celdas[j + 1].get_text(strip=True)
                            
                            if 'CARGO' in campo and not info.cargo:
                                info.cargo = valor
                                logger.debug(f"CARGO encontrado en fila {i+1} con BeautifulSoup: '{valor}'")
                            elif ('DEPARTAMENTO' in campo or 'DPTO' in campo) and not info.departamento:
                                info.departamento = valor
                                logger.debug(f"DEPARTAMENTO encontrado en fila {i+1} con BeautifulSoup: '{valor}'")
                            elif 'ESCUELA' in campo and not info.escuela:
                                info.escuela = valor
                
                # Si encontramos datos en esta tabla, podemos salir
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
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = ActividadAsignatura(periodo=id_periodo)
            
            # Identificar índices de columnas clave
            indice_codigo = -1
            indice_nombre = -1
            indice_porc = -1
            
            for j, header in enumerate(headers):
                header_upper = header.upper()
                if 'CODIGO' in header_upper and 'ESTUDIANTE' not in header_upper:
                    indice_codigo = j
                elif 'NOMBRE' in header_upper and 'ASIGNATURA' in header_upper:
                    indice_nombre = j
                elif 'PORC' in header_upper:
                    indice_porc = j
            
            # Extraer valores de cada columna con limpieza
            for j, header in enumerate(headers):
                if j < len(celdas):
                    valor = celdas[j].strip() if celdas[j] else ''
                    header_upper = header.upper()
                    
                    if 'CODIGO' in header_upper and 'ESTUDIANTE' not in header_upper:
                        actividad.codigo = valor
                    elif 'GRUPO' in header_upper:
                        actividad.grupo = valor
                    elif 'TIPO' in header_upper:
                        actividad.tipo = valor
                    elif 'NOMBRE' in header_upper and 'ASIGNATURA' in header_upper:
                        # Limpiar nombre de asignatura: remover porcentajes y espacios extra
                        nombre_limpio = valor
                        # Remover porcentajes si están al final (ej: "Nombre 2%")
                        nombre_limpio = re.sub(r'\s*\d+%$', '', nombre_limpio).strip()
                        # Remover espacios múltiples
                        nombre_limpio = re.sub(r'\s+', ' ', nombre_limpio).strip()
                        actividad.nombre_asignatura = nombre_limpio
                    elif ('HORAS' in header_upper and 'SEMESTRE' in header_upper) or \
                         (header_upper == 'HORAS SEMESTRE') or \
                         (j == indice_horas):
                        # Usar columna identificada o cualquier columna con HORAS (excepto PORC)
                        if not actividad.horas_semestre or ('SEMESTRE' in header_upper) or (j == indice_horas):
                            # Asegurar que no sea la columna PORC
                            if j != indice_porc:
                                actividad.horas_semestre = valor
                                logger.debug(f"Horas extraídas: '{valor}' de columna '{header}' (índice {j})")
                    elif 'CRED' in header_upper:
                        actividad.cred = valor
                    elif 'PORC' in header_upper:
                        actividad.porc = valor
                    elif 'FREC' in header_upper:
                        actividad.frec = valor
                    elif 'INTEN' in header_upper:
                        actividad.inten = valor
            
            # Si no se encontraron horas por header, buscar en celdas numéricas
            if not actividad.horas_semestre or not actividad.horas_semestre.strip():
                for j, valor in enumerate(celdas):
                    if j < len(headers):
                        header_upper = headers[j].upper()
                        # Evitar columnas conocidas que no son horas
                        if 'PORC' in header_upper or 'CRED' in header_upper or 'FREC' in header_upper or 'INTEN' in header_upper:
                            continue
                        # Evitar columna de código
                        if j == indice_codigo:
                            continue
                        # Buscar valores numéricos que podrían ser horas
                        valor_limpio = valor.strip() if valor else ''
                        if valor_limpio and re.match(r'^\d+\.?\d*$', valor_limpio):
                            # Si es un número y no es código (códigos suelen tener letras)
                            if not actividad.codigo or valor_limpio != actividad.codigo:
                                actividad.horas_semestre = valor_limpio
                                logger.debug(f"Horas encontradas por búsqueda numérica: '{valor_limpio}' en columna '{headers[j]}'")
                                break
            
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
            
            # Validaciones de nombre de actividad
            nombre_valido = False
            if actividad.nombre_asignatura:
                nombre_limpio = actividad.nombre_asignatura.strip()
                # Validar que no termine en porcentaje
                if nombre_limpio and not nombre_limpio.endswith('%'):
                    # Validar que tenga longitud razonable
                    if len(nombre_limpio) > 3:  # Mínimo 4 caracteres
                        nombre_valido = True
                    else:
                        logger.warning(f"Nombre de actividad muy corto: '{nombre_limpio}'")
                else:
                    logger.warning(f"Nombre de actividad termina en porcentaje (incorrecto): '{nombre_limpio}'")
            
            # Solo agregar actividad si tiene datos válidos
            if (actividad.codigo or actividad.nombre_asignatura) and nombre_valido:
                # Log de actividad extraída
                logger.debug(f"Actividad extraída: codigo='{actividad.codigo}', nombre='{actividad.nombre_asignatura}', horas='{actividad.horas_semestre}'")
                
                # Validación final antes de agregar
                if horas_valida or not actividad.horas_semestre:  # Permitir sin horas si no se encontraron
                    if self._es_postgrado(actividad):
                        postgrado.append(actividad)
                    else:
                        pregrado.append(actividad)
                else:
                    logger.warning(f"Actividad omitida por horas inválidas: codigo='{actividad.codigo}', nombre='{actividad.nombre_asignatura}'")
            else:
                logger.warning(f"Actividad omitida por datos inválidos: codigo='{actividad.codigo}', nombre='{actividad.nombre_asignatura}'")
        
        return pregrado, postgrado
    
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
        
        # Buscar fila de headers
        header_index = -1
        headers_actuales = headers
        
        for i in range(min(10, len(filas_internas))):
            fila_texto = self.extraer_texto_de_celda(filas_internas[i]).upper()
            if ('CODIGO' in fila_texto and
                'NOMBRE DEL PROYECTO' in fila_texto and
                'HORAS SEMESTRE' in fila_texto):
                header_index = i
                headers_actuales = self.extraer_celdas(filas_internas[i])
                break
        
        if header_index == -1:
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
                    elif 'APROBADO' in header_upper and 'POR' in header_upper:
                        actividad.aprobado_por = valor
                    elif 'NOMBRE' in header_upper and ('PROYECTO' in header_upper or 'ANTEPROYECTO' in header_upper):
                        actividad.nombre_proyecto = valor
                    elif 'HORAS' in header_upper:
                        actividad.horas_semestre = valor
            
            if actividad.nombre_proyecto or actividad.horas_semestre:
                actividades.append(actividad)
        
        return actividades
    
    def _procesar_tesis(
        self,
        filas: List[str],
        headers: List[str],
        id_periodo: int
    ) -> List[Dict[str, Any]]:
        """Procesa actividades de dirección de tesis."""
        actividades = []
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = {'PERIODO': id_periodo}
            
            for j, header in enumerate(headers):
                if j < len(celdas):
                    actividad[header] = celdas[j]
            
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
        """Procesa otras actividades (extensión, administrativas, etc.)."""
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
        """Procesa actividades genéricas."""
        actividades = []
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = {'PERIODO': id_periodo}
            
            for j, header in enumerate(headers):
                if j < len(celdas):
                    actividad[header] = celdas[j]
            
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
            categoria, nombre_actividad, numero_horas, periodo, detalle_actividad,
            actividad, vinculacion, dedicacion, nivel, cargo, departamento
        
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
                    # Verificar si es página de login
                    tiene_formulario = '<form' in html.lower() and 'periodo academico' in html.lower()
                    tiene_tablas = len(self.extraer_tablas(html)) < 2
                    if tiene_formulario and tiene_tablas:
                        raise ValueError("Página de login detectada - no se encontraron datos del docente")
                    raise ValueError("El procesamiento HTML no devolvió actividades válidas")
                
                # Validaciones robustas de calidad de datos
                self._validar_actividades(actividades, cedula_limpia)
                
                logger.info(f"✅ Scraping exitoso: {len(actividades)} actividades encontradas")
                logger.info(f"{'='*60}\n")
                
                return actividades
                
            except requests.Timeout as e:
                ultimo_error = e
                logger.warning(f"⏱️  Timeout en intento {intento}/{max_retries}: {e}")
                if intento < max_retries:
                    logger.info(f"🔄 Reintentando...")
                    
            except requests.HTTPError as e:
                ultimo_error = e
                status_code = e.response.status_code if e.response else 'unknown'
                logger.warning(f"❌ Error HTTP {status_code} en intento {intento}/{max_retries}: {e}")
                
                # Errores que no deberían reintentarse
                if status_code in [400, 401, 403, 404]:
                    logger.error(f"Error HTTP {status_code} no es recuperable")
                    raise
                
                if intento < max_retries:
                    logger.info(f"🔄 Reintentando...")
                    
            except ValueError as e:
                # Errores de validación no se reintentan
                logger.error(f"❌ Error de validación: {e}")
                raise
                
            except requests.RequestException as e:
                ultimo_error = e
                logger.warning(f"🔌 Error de conexión en intento {intento}/{max_retries}: {e}")
                if intento < max_retries:
                    logger.info(f"🔄 Reintentando...")
                    
            except Exception as e:
                ultimo_error = e
                logger.error(f"💥 Error inesperado en intento {intento}/{max_retries}: {e}", exc_info=True)
                if intento < max_retries:
                    logger.info(f"🔄 Reintentando...")
        
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
        actividades = []
        
        # Procesar HTML directamente (sin hacer nueva petición)
        logger.debug("Parseando HTML para extraer datos del docente...")
        
        # Crear estructura temporal para procesar
        resultado = DatosDocente(periodo=id_periodo)
        
        tablas = self.extraer_tablas(html)
        
        for tabla_idx, tabla_html in enumerate(tablas, 1):
            logger.debug(f"Procesando tabla {tabla_idx}/{len(tablas)}")
            
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
        
        # Usar los datos procesados
        datos_docente = resultado
        
        info = datos_docente.informacion_personal
        
        # Construir datos base compartidos
        nombre_completo = self._construir_nombre_completo(info)
        escuela = info.unidad_academica or info.escuela or ''
        departamento = info.departamento or ''
        vinculacion = info.vinculacion or ''
        dedicacion = info.dedicacion or ''
        nivel = info.nivel_alcanzado or ''
        cargo = info.cargo or ''
        categoria_info = info.categoria or ''
        
        logger.debug(f"Procesando actividades para período {periodo_label}")
        
        # Procesar actividades de pregrado
        for actividad in datos_docente.actividades_pregrado:
            # Combinar código y nombre: "626001C - HISTORIA IDEAS EN CIENCIAS DE LA SALUD"
            nombre_completo_actividad = actividad.nombre_asignatura
            if actividad.codigo and actividad.nombre_asignatura:
                nombre_completo_actividad = f"{actividad.codigo} - {actividad.nombre_asignatura}"
            elif actividad.codigo:
                nombre_completo_actividad = actividad.codigo
            
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Pregrado',
                categoria=categoria_info,
                nombre_actividad=nombre_completo_actividad,
                numero_horas=actividad.horas_semestre,
                periodo=periodo_label,
                detalle_actividad=f"{actividad.tipo} - Grupo {actividad.grupo}" if actividad.grupo else actividad.tipo,
                actividad='Docencia',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo,
                codigo=actividad.codigo,
                grupo=actividad.grupo,
                tipo=actividad.tipo
            ))
        
        # Procesar actividades de postgrado
        for actividad in datos_docente.actividades_postgrado:
            # Combinar código y nombre: "626001C - HISTORIA IDEAS EN CIENCIAS DE LA SALUD"
            nombre_completo_actividad = actividad.nombre_asignatura
            if actividad.codigo and actividad.nombre_asignatura:
                nombre_completo_actividad = f"{actividad.codigo} - {actividad.nombre_asignatura}"
            elif actividad.codigo:
                nombre_completo_actividad = actividad.codigo
            
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Postgrado',
                categoria=categoria_info,
                nombre_actividad=nombre_completo_actividad,
                numero_horas=actividad.horas_semestre,
                periodo=periodo_label,
                detalle_actividad=f"{actividad.tipo} - Grupo {actividad.grupo}" if actividad.grupo else actividad.tipo,
                actividad='Docencia',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo,
                codigo=actividad.codigo,
                grupo=actividad.grupo,
                tipo=actividad.tipo
            ))
        
        # Procesar actividades de investigación
        for actividad in datos_docente.actividades_investigacion:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Investigación',
                categoria=categoria_info,
                nombre_actividad=actividad.nombre_proyecto,
                numero_horas=actividad.horas_semestre,
                periodo=periodo_label,
                detalle_actividad=actividad.aprobado_por,
                actividad='Investigación',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo,
                codigo=actividad.codigo
            ))
        
        # Procesar dirección de tesis
        for tesis in datos_docente.actividades_tesis:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Dirección de Tesis',
                categoria=categoria_info,
                nombre_actividad=tesis.get('TITULO DE LA TESIS', '') or tesis.get('Titulo de la Tesis', ''),
                numero_horas=tesis.get('HORAS SEMESTRE', '') or tesis.get('Horas Semestre', ''),
                periodo=periodo_label,
                detalle_actividad=f"Estudiante: {tesis.get('CODIGO ESTUDIANTE', '')}",
                actividad='Dirección de Tesis',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo
            ))
        
        # Procesar actividades de extensión
        for actividad in datos_docente.actividades_extension:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad=actividad.get('TIPO', 'Extensión'),
                categoria=categoria_info,
                nombre_actividad=actividad.get('NOMBRE', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                detalle_actividad='',
                actividad='Extensión',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo
            ))
        
        # Procesar actividades intelectuales
        for actividad in datos_docente.actividades_intelectuales:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad=actividad.get('TIPO', 'Intelectual'),
                categoria=categoria_info,
                nombre_actividad=actividad.get('TITULO', '') or actividad.get('Titulo', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                detalle_actividad=actividad.get('DESCRIPCION', ''),
                actividad='Intelectual o Artística',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo
            ))
        
        # Procesar actividades administrativas
        for actividad in datos_docente.actividades_administrativas:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Administrativa',
                categoria=categoria_info,
                nombre_actividad=actividad.get('CARGO', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                detalle_actividad=actividad.get('DESCRIPCION DEL CARGO', ''),
                actividad='Administrativa',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo
            ))
        
        # Procesar actividades complementarias
        for actividad in datos_docente.actividades_complementarias:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Complementaria',
                categoria=categoria_info,
                nombre_actividad=actividad.get('PARTICIPACION EN', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                detalle_actividad=actividad.get('NOMBRE', ''),
                actividad='Complementaria',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo
            ))
        
        # Procesar docente en comisión
        for actividad in datos_docente.docente_en_comision:
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Comisión',
                categoria=actividad.get('TIPO DE COMISION', ''),
                nombre_actividad=actividad.get('DESCRIPCION', ''),
                numero_horas=actividad.get('HORAS SEMESTRE', '') or actividad.get('Horas Semestre', ''),
                periodo=periodo_label,
                detalle_actividad='',
                actividad='Comisión',
                vinculacion=vinculacion,
                dedicacion=dedicacion,
                nivel=nivel,
                cargo=cargo
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
        detalle_actividad: str,
        actividad: str,
        vinculacion: str,
        dedicacion: str,
        nivel: str,
        cargo: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Construye un diccionario con todos los campos requeridos para una actividad.
        
        Args:
            **kwargs: Campos adicionales opcionales (codigo, grupo, tipo, etc.)
        
        Returns:
            Diccionario con todos los campos de la actividad
        """
        # Limpiar y validar nombre de actividad
        nombre_actividad_limpio = str(nombre_actividad).strip()
        
        # Validación: nombre no debe terminar en porcentaje
        if nombre_actividad_limpio.endswith('%'):
            logger.warning(f"Nombre de actividad termina en porcentaje (incorrecto): '{nombre_actividad_limpio}'")
            # Intentar limpiar: remover porcentaje al final
            nombre_actividad_limpio = re.sub(r'\s*\d+%$', '', nombre_actividad_limpio).strip()
        
        # Validación: nombre debe tener longitud razonable
        if nombre_actividad_limpio and len(nombre_actividad_limpio) < 4:
            logger.warning(f"Nombre de actividad muy corto: '{nombre_actividad_limpio}'")
        
        # Parsear horas a número si es posible
        horas_numero = parsear_horas(numero_horas)
        
        # Validación: horas debe ser mayor a 0 si hay actividad
        if nombre_actividad_limpio and horas_numero == 0:
            logger.warning(f"Actividad '{nombre_actividad_limpio}' tiene 0 horas - puede ser un error")
        
        # Construir diccionario
        actividad_dict = {
            'cedula': str(cedula),
            'nombre_profesor': str(nombre_profesor),
            'escuela': str(escuela),
            'departamento': str(departamento),
            'tipo_actividad': str(tipo_actividad),
            'categoria': str(categoria),
            'nombre_actividad': nombre_actividad_limpio,
            'numero_horas': horas_numero,
            'periodo': str(periodo),
            'detalle_actividad': str(detalle_actividad),
            'actividad': str(actividad),
            'vinculacion': str(vinculacion),
            'dedicacion': str(dedicacion),
            'nivel': str(nivel),
            'cargo': str(cargo),
            **kwargs  # Incluir campos adicionales si existen
        }
        
        # Validaciones finales (solo en modo debug para no interrumpir ejecución)
        if logger.isEnabledFor(logging.DEBUG):
            if actividad_dict['nombre_actividad']:
                assert not actividad_dict['nombre_actividad'].endswith('%'), \
                    f"Nombre de actividad incorrecto (termina en %): '{actividad_dict['nombre_actividad']}'"
                assert len(actividad_dict['nombre_actividad']) > 3, \
                    f"Nombre muy corto: '{actividad_dict['nombre_actividad']}'"
            
            if actividad_dict['numero_horas'] > 0:
                assert actividad_dict['numero_horas'] > 0, \
                    f"Horas debe ser mayor a 0, encontrado: {actividad_dict['numero_horas']}"
        
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

