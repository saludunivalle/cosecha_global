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
                elif '1 APELLIDO' in header_upper or header_upper == 'APELLIDO1':
                    info.apellido1 = valor
                elif '2 APELLIDO' in header_upper or header_upper == 'APELLIDO2':
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
        headers: List[str],
        id_periodo: int
    ) -> Tuple[List[ActividadAsignatura], List[ActividadAsignatura]]:
        """Procesa actividades de asignaturas."""
        pregrado = []
        postgrado = []
        
        for i in range(1, len(filas)):
            celdas = self.extraer_celdas(filas[i])
            
            if all(not c or not c.strip() for c in celdas):
                continue
            
            actividad = ActividadAsignatura(periodo=id_periodo)
            
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
                    elif 'CRED' in header_upper:
                        actividad.cred = valor
                    elif 'PORC' in header_upper:
                        actividad.porc = valor
                    elif 'FREC' in header_upper:
                        actividad.frec = valor
                    elif 'INTEN' in header_upper:
                        actividad.inten = valor
            
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
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Pregrado',
                categoria=categoria_info,
                nombre_actividad=actividad.nombre_asignatura,
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
            actividades.append(self._construir_actividad_dict(
                cedula=cedula,
                nombre_profesor=nombre_completo,
                escuela=escuela,
                departamento=departamento,
                tipo_actividad='Postgrado',
                categoria=categoria_info,
                nombre_actividad=actividad.nombre_asignatura,
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
        # Parsear horas a número si es posible
        horas_numero = parsear_horas(numero_horas)
        
        return {
            'cedula': str(cedula),
            'nombre_profesor': str(nombre_profesor),
            'escuela': str(escuela),
            'departamento': str(departamento),
            'tipo_actividad': str(tipo_actividad),
            'categoria': str(categoria),
            'nombre_actividad': str(nombre_actividad),
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

