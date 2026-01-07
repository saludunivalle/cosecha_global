"""
Gestor de períodos académicos
"""

import logging
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

import gspread.exceptions

from scraper.services.sheets_service import SheetsService
from scraper.services.univalle_scraper import UnivalleScraper
from scraper.config.settings import DEFAULT_PERIODOS_COUNT
from scraper.utils.helpers import parsear_periodo_label

logger = logging.getLogger(__name__)


def calcular_periodo_anterior(year: int, term: int) -> tuple:
    """
    Calcula el período anterior a un año y término dado.
    
    Args:
        year: Año del período
        term: Término del período (1 o 2)
        
    Returns:
        Tupla (año_anterior, término_anterior)
    """
    if term == 1:
        # Si es término 1, el anterior es año-1, término 2
        return (year - 1, 2)
    else:
        # Si es término 2, el anterior es el mismo año, término 1
        return (year, 1)


class PeriodManager:
    """Gestor de períodos académicos."""
    
    def __init__(self, sheets_service: SheetsService, scraper: UnivalleScraper):
        """
        Inicializa el gestor de períodos.
        
        Args:
            sheets_service: Servicio de Google Sheets
            scraper: Scraper de Univalle
        """
        self.sheets_service = sheets_service
        self.scraper = scraper
    
    def obtener_ultimos_n_periodos(self, n: int = DEFAULT_PERIODOS_COUNT) -> List[Dict[str, Any]]:
        """
        Obtiene los últimos N períodos disponibles desde el portal.
        
        Args:
            n: Número de períodos a obtener
            
        Returns:
            Lista de diccionarios con información de períodos
        """
        logger.info(f"Obteniendo últimos {n} períodos desde el portal")
        
        try:
            periodos = self.scraper.obtener_periodos_disponibles()
            
            # Retornar los primeros N
            periodos_seleccionados = periodos[:n]
            
            logger.info(
                f"Obtenidos {len(periodos_seleccionados)} períodos: "
                f"{[p['label'] for p in periodos_seleccionados]}"
            )
            
            return periodos_seleccionados
            
        except Exception as e:
            logger.error(f"Error al obtener períodos: {e}")
            raise
    
    def crear_hojas_periodos(
        self,
        periodos: List[Dict[str, Any]],
        headers: Dict[str, List[str]],
        limpiar_existentes: bool = False
    ):
        """
        Crea hojas para cada período con sus respectivos headers.
        
        Args:
            periodos: Lista de períodos a crear
            headers: Diccionario con nombre de hoja como clave y lista de headers como valor
            limpiar_existentes: Si es True, limpia las hojas si ya existen
        """
        logger.info(f"Creando hojas para {len(periodos)} períodos")
        
        for periodo in periodos:
            periodo_label = periodo.get('label', f"Periodo_{periodo['idPeriod']}")
            
            # Crear hoja principal del período
            hoja_nombre = f"Periodo_{periodo_label}"
            headers_principales = headers.get('principal', [
                'Cédula', 'Nombre', 'Apellido1', 'Apellido2',
                'Escuela', 'Departamento', 'Período'
            ])
            
            self.sheets_service.crear_hoja(
                hoja_nombre,
                headers_principales,
                limpiar_existente=limpiar_existentes
            )
            
            # Crear hojas específicas por tipo de actividad
            tipos_actividades = [
                'Pregrado', 'Postgrado', 'Investigacion',
                'Extension', 'Tesis', 'Administrativas',
                'Complementarias', 'Intelectuales', 'Comision'
            ]
            
            for tipo in tipos_actividades:
                hoja_tipo_nombre = f"{hoja_nombre}_{tipo}"
                headers_tipo = headers.get(tipo.lower(), ['Cédula', 'Período', 'Detalles'])
                
                self.sheets_service.crear_hoja(
                    hoja_tipo_nombre,
                    headers_tipo,
                    limpiar_existente=limpiar_existentes
                )
            
            logger.info(f"Hoja creada/actualizada: {hoja_nombre}")
    
    def limpiar_hojas_periodos(self, periodos: List[Dict[str, Any]]):
        """
        Limpia todas las hojas de los períodos especificados.
        
        Args:
            periodos: Lista de períodos a limpiar
        """
        logger.info(f"Limpiando hojas de {len(periodos)} períodos")
        
        for periodo in periodos:
            periodo_label = periodo.get('label', f"Periodo_{periodo['idPeriod']}")
            hoja_nombre = f"Periodo_{periodo_label}"
            
            try:
                # Limpiar hoja principal
                self.sheets_service.limpiar_hoja(hoja_nombre)
                
                # Limpiar hojas de actividades
                tipos_actividades = [
                    'Pregrado', 'Postgrado', 'Investigacion',
                    'Extension', 'Tesis', 'Administrativas',
                    'Complementarias', 'Intelectuales', 'Comision'
                ]
                
                for tipo in tipos_actividades:
                    hoja_tipo_nombre = f"{hoja_nombre}_{tipo}"
                    try:
                        self.sheets_service.limpiar_hoja(hoja_tipo_nombre)
                    except Exception as e:
                        logger.warning(f"No se pudo limpiar {hoja_tipo_nombre}: {e}")
                
                logger.info(f"Período {hoja_nombre} limpiado")
                
            except Exception as e:
                logger.error(f"Error al limpiar período {hoja_nombre}: {e}")
    
    def obtener_periodos_activos(self) -> List[Dict[str, Any]]:
        """
        Obtiene los períodos activos desde una hoja de configuración.
        
        Returns:
            Lista de períodos activos
        """
        try:
            # Intentar leer desde hoja de configuración
            valores = self.sheets_service.obtener_todos_los_valores('Configuracion')
            
            periodos_activos = []
            for fila in valores[1:]:  # Saltar header
                if len(fila) >= 2 and fila[1].lower() == 'x':  # Columna activo
                    periodo_label = fila[0]
                    periodo_info = parsear_periodo_label(periodo_label)
                    
                    if periodo_info:
                        # Buscar ID del período (esto requeriría mapeo adicional)
                        periodos_activos.append({
                            'label': periodo_label,
                            'year': periodo_info['year'],
                            'term': periodo_info['term']
                        })
            
            return periodos_activos
            
        except Exception as e:
            logger.warning(f"No se pudo leer períodos activos: {e}")
            # Fallback: usar últimos N períodos
            return self.obtener_ultimos_n_periodos()
    
    def normalizar_nombre_hoja_periodo(self, periodo: Dict[str, Any]) -> str:
        """
        Normaliza el nombre de hoja para un período.
        
        Args:
            periodo: Diccionario con información del período
            
        Returns:
            Nombre normalizado de la hoja
        """
        label = periodo.get('label', f"Periodo_{periodo.get('idPeriod', '')}")
        return f"Periodo_{label}"
    
    def validar_periodo(self, periodo: Dict[str, Any]) -> bool:
        """
        Valida que un período tenga la estructura correcta.
        
        Args:
            periodo: Diccionario con información del período
            
        Returns:
            True si el período es válido
        """
        required_keys = ['idPeriod', 'label']
        return all(key in periodo for key in required_keys)
    
    def get_target_period(self) -> str:
        """
        Obtiene el período objetivo desde la variable de entorno TARGET_PERIOD.
        
        Returns:
            Período en formato "2026-1" o "2025-2"
            
        Raises:
            ValueError: Si TARGET_PERIOD no está configurado o tiene formato inválido
            
        Example:
            >>> manager = PeriodManager(...)
            >>> period = manager.get_target_period()
            >>> print(period)
            '2026-1'
        """
        target_period = os.getenv('TARGET_PERIOD')
        
        if not target_period:
            raise ValueError(
                "Variable de entorno TARGET_PERIOD no está configurada. "
                "Debe ser en formato 'YYYY-T' (ej: '2026-1', '2025-2')"
            )
        
        # Validar formato del período
        periodo_info = parsear_periodo_label(target_period)
        
        if not periodo_info:
            raise ValueError(
                f"Formato de período inválido en TARGET_PERIOD: {target_period}. "
                f"Debe ser en formato 'YYYY-T' (ej: '2026-1', '2025-2')"
            )
        
        logger.info(f"Período objetivo obtenido: {target_period}")
        
        return target_period
    
    def prepare_single_period_sheet(self, sheet_url: Optional[str] = None, period: str = None):
        """
        Prepara la hoja de un período específico en Google Sheets.
        
        Para el período especificado:
        - Si la hoja existe: borra todo excepto los encabezados (fila 1)
        - Si no existe: crea la hoja con los encabezados especificados
        
        Args:
            sheet_url: URL de la hoja de cálculo. Si es None, usa la hoja
                      configurada en GOOGLE_SHEETS_SPREADSHEET_ID.
            period: Período en formato "2026-1" o "2025-2". Si es None, 
                   usa TARGET_PERIOD de variable de entorno.
        
        Headers utilizados:
            cedula, nombre profesor, escuela, departamento, tipo actividad,
            categoría, nombre actividad, número de horas, periodo,
            actividad, vinculación, dedicación, nivel
        
        Raises:
            ValueError: Si el período no está especificado o tiene formato inválido
            
        Example:
            >>> manager = PeriodManager(...)
            >>> manager.prepare_single_period_sheet(period="2026-1")
        """
        if not period:
            period = self.get_target_period()
        
        # Validar formato del período
        periodo_info = parsear_periodo_label(period)
        if not periodo_info:
            raise ValueError(
                f"Formato de período inválido: {period}. "
                f"Debe ser en formato 'YYYY-T' (ej: '2026-1', '2025-2')"
            )
        
        logger.info(f"Preparando hoja para período: {period}")
        
        # Headers especificados (13 columnas)
        #No están, Porcentaje horas, Detalle actividad, Cargo y departamento
        #Porcentaje horas no se necesita, Detalle actividad es lom mismo que nombre actividad, cargo es lo mismo que vincuclacion
        headers = [
            'Cedula',
            'Nombre Profesor',
            'Escuela',
            'Departamento',
            'Tipo de Actividad',
            'Categoría',
            'Nombre de actividad',
            'Número de horas',
            'Período',
            'Actividad',
            'Vinculación',
            'Dedicación',
            'Nivel'
        ]
        
        # Obtener o crear conexión a la hoja de cálculo
        if sheet_url:
            # Extraer ID de la URL usando método del servicio
            # Usamos el método privado directamente ya que es parte del servicio
            sheet_id = self.sheets_service._extract_sheet_id_from_url(sheet_url)
            spreadsheet = self.sheets_service.client.open_by_key(sheet_id)
            logger.info(f"Usando hoja externa: {spreadsheet.title}")
        else:
            # Usar la hoja configurada por defecto
            spreadsheet = self.sheets_service.spreadsheet
            logger.info(f"Usando hoja por defecto: {spreadsheet.title}")
        
        nombre_hoja = period  # El nombre de la hoja es el período (ej: "2026-1")
        
        try:
            # Verificar si la hoja existe
            worksheet = None
            hoja_existe = False
            
            try:
                worksheet = spreadsheet.worksheet(nombre_hoja)
                hoja_existe = True
                logger.info(f"Hoja '{nombre_hoja}' existe, limpiando datos (manteniendo headers)")
            except gspread.exceptions.WorksheetNotFound:
                hoja_existe = False
                logger.info(f"Hoja '{nombre_hoja}' no existe, será creada")
            
            if hoja_existe and worksheet:
                # Hoja existe, limpiar datos manteniendo headers
                try:
                    # Obtener todos los valores
                    todos_valores = worksheet.get_all_values()
                    
                    if len(todos_valores) > 0:
                        # Verificar si la primera fila tiene headers
                        primera_fila = todos_valores[0]
                        
                        # Limpiar todas las filas excepto la primera
                        # Usar batch_clear en lugar de delete_rows para evitar el error
                        # "cannot delete all non-frozen rows"
                        if len(todos_valores) > 1:
                            # Calcular rango a limpiar (desde fila 2 hasta el final)
                            ultima_fila = len(todos_valores)
                            # Usar batch_clear para limpiar el contenido sin eliminar filas
                            # Esto evita el error de "cannot delete all non-frozen rows"
                            rango_limpiar = f'A2:Z{ultima_fila}'
                            worksheet.batch_clear([rango_limpiar])
                            logger.debug(f"Limpiado contenido de {ultima_fila - 1} filas de datos")
                            
                            # Si hay más de 1000 filas, limpiar también las filas extra
                            # usando delete_rows solo si hay filas suficientes
                            if ultima_fila > 1000:
                                # Dejar solo la primera fila y algunas filas vacías
                                # Eliminar desde la fila 1001 en adelante
                                try:
                                    worksheet.delete_rows(1001, ultima_fila)
                                    logger.debug(f"Eliminadas filas adicionales (1001-{ultima_fila})")
                                except Exception as del_err:
                                    logger.warning(f"No se pudieron eliminar filas adicionales: {del_err}")
                        
                        # Verificar si los headers coinciden
                        headers_existentes = [str(h).lower().strip() for h in primera_fila]
                        headers_esperados = [str(h).lower().strip() for h in headers]
                        
                        # Si los headers no coinciden, actualizarlos
                        if headers_existentes != headers_esperados:
                            logger.info(f"Actualizando headers en hoja '{nombre_hoja}'")
                            # Actualizar la primera fila con los headers correctos
                            worksheet.update('A1', [headers])
                        else:
                            logger.debug(f"Headers correctos en hoja '{nombre_hoja}'")
                    else:
                        # Hoja vacía, agregar headers
                        logger.info(f"Hoja '{nombre_hoja}' está vacía, agregando headers")
                        worksheet.update('A1', [headers])
                
                except Exception as e:
                    logger.warning(f"Error al limpiar hoja '{nombre_hoja}': {e}")
                    # Si falla la limpieza, intentar actualizar solo los headers
                    try:
                        worksheet.update('A1', [headers])
                        logger.info(f"Headers actualizados en hoja '{nombre_hoja}'")
                    except Exception as header_err:
                        logger.error(f"Error al actualizar headers: {header_err}")
                        raise
            
            else:
                # Hoja no existe, crearla
                # Verificar primero que realmente no existe (por si acaso)
                try:
                    worksheet = spreadsheet.worksheet(nombre_hoja)
                    logger.info(f"Hoja '{nombre_hoja}' encontrada después de verificación")
                except gspread.exceptions.WorksheetNotFound:
                    # Realmente no existe, crearla
                    logger.info(f"Creando hoja '{nombre_hoja}'")
                    try:
                        worksheet = spreadsheet.add_worksheet(
                            title=nombre_hoja,
                            rows=1000,
                            cols=len(headers)
                        )
                        
                        # Agregar headers
                        worksheet.update('A1', [headers])
                        
                        logger.info(f"Hoja '{nombre_hoja}' creada con {len(headers)} columnas")
                    except gspread.exceptions.APIError as api_err:
                        # Si el error es que la hoja ya existe, obtenerla
                        if 'already exists' in str(api_err).lower():
                            logger.warning(f"Hoja '{nombre_hoja}' ya existe (creada por otro proceso), obteniéndola")
                            worksheet = spreadsheet.worksheet(nombre_hoja)
                            # Asegurar que tenga los headers correctos
                            worksheet.update('A1', [headers])
                        else:
                            raise
        
        except Exception as e:
            logger.error(f"Error preparando hoja '{nombre_hoja}': {e}", exc_info=True)
            raise
        
        logger.info(f"✓ Hoja '{nombre_hoja}' preparada exitosamente")

