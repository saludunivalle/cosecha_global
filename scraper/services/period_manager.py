"""
Gestor de períodos académicos
"""

import logging
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
    
    def calculate_periods(self, current_period: str, n_previous: int = 8) -> List[str]:
        """
        Calcula una lista de períodos incluyendo el actual y los N anteriores.
        
        Args:
            current_period: Período actual en formato "2026-1" o "2025-2"
            n_previous: Número de períodos anteriores a incluir (default: 8)
            
        Returns:
            Lista de períodos en formato ["2026-1", "2025-2", "2025-1", ...]
            Incluye el período actual y n_previous períodos anteriores.
            
        Raises:
            ValueError: Si el formato del período no es válido
            
        Example:
            >>> manager = PeriodManager(...)
            >>> periods = manager.calculate_periods("2026-1", n_previous=8)
            >>> print(periods)
            ['2026-1', '2025-2', '2025-1', '2024-2', '2024-1', '2023-2', '2023-1', '2022-2', '2022-1']
        """
        # Parsear el período actual
        periodo_info = parsear_periodo_label(current_period)
        
        if not periodo_info:
            raise ValueError(
                f"Formato de período inválido: {current_period}. "
                f"Debe ser en formato 'YYYY-T' (ej: '2026-1', '2025-2')"
            )
        
        year = periodo_info['year']
        term = periodo_info['term']
        
        logger.info(f"Calculando períodos desde {current_period} ({n_previous} anteriores)")
        
        periodos = [current_period]  # Incluir el período actual
        
        # Calcular períodos anteriores
        current_year = year
        current_term = term
        
        for _ in range(n_previous):
            current_year, current_term = calcular_periodo_anterior(current_year, current_term)
            periodo_anterior = f"{current_year}-{current_term}"
            periodos.append(periodo_anterior)
        
        logger.info(f"Calculados {len(periodos)} períodos: {periodos}")
        
        return periodos
    
    def prepare_period_sheets(self, sheet_url: Optional[str] = None, periods: List[str] = None):
        """
        Prepara las hojas de períodos en Google Sheets.
        
        Para cada período en la lista:
        - Si la hoja existe: borra todo excepto los encabezados (fila 1)
        - Si no existe: crea la hoja con los encabezados especificados
        
        Args:
            sheet_url: URL de la hoja de cálculo. Si es None, usa la hoja
                      configurada en GOOGLE_SHEETS_SPREADSHEET_ID.
            periods: Lista de períodos en formato ["2026-1", "2025-2", ...]
                    Si es None, usa los períodos del gestor.
        
        Headers utilizados:
            cedula, nombre profesor, escuela, departamento, tipo actividad,
            categoría, nombre actividad, número de horas, periodo,
            detalle actividad, actividad, vinculación, dedicación, nivel,
            cargo, departamento
        
        Example:
            >>> manager = PeriodManager(...)
            >>> periods = manager.calculate_periods("2026-1", n_previous=8)
            >>> manager.prepare_period_sheets(periods=periods)
        """
        if not periods:
            raise ValueError("Debe proporcionar una lista de períodos")
        
        logger.info(f"Preparando {len(periods)} hojas de períodos")
        
        # Headers especificados
        headers = [
            'cedula',
            'nombre profesor',
            'escuela',
            'departamento',
            'tipo actividad',
            'categoría',
            'nombre actividad',
            'número de horas',
            'periodo',
            'detalle actividad',
            'actividad',
            'vinculación',
            'dedicación',
            'nivel',
            'cargo',
            'departamento'
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
        
        import gspread.exceptions
        
        # Procesar cada período
        for periodo in periods:
            nombre_hoja = periodo  # El nombre de la hoja es el período (ej: "2026-1")
            
            try:
                # Intentar obtener la hoja
                try:
                    worksheet = spreadsheet.worksheet(nombre_hoja)
                    logger.info(f"Hoja '{nombre_hoja}' existe, limpiando datos (manteniendo headers)")
                    
                    # Obtener todos los valores
                    todos_valores = worksheet.get_all_values()
                    
                    if len(todos_valores) > 0:
                        # Verificar si la primera fila tiene headers
                        primera_fila = todos_valores[0]
                        
                        # Limpiar todas las filas excepto la primera
                        if len(todos_valores) > 1:
                            # Borrar filas desde la 2 en adelante
                            # gspread usa índice 1-based, así que fila 2 = índice 2
                            ultima_fila = len(todos_valores)
                            worksheet.delete_rows(2, ultima_fila)
                            logger.debug(f"Eliminadas {ultima_fila - 1} filas de datos")
                        
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
                        worksheet.append_row(headers)
                
                except gspread.exceptions.WorksheetNotFound:
                    # Hoja no existe, crearla
                    logger.info(f"Hoja '{nombre_hoja}' no existe, creándola")
                except Exception as e:
                    # Otro tipo de error
                    logger.warning(f"Error al acceder a hoja '{nombre_hoja}': {e}, intentando crear")
                    
                    # Crear nueva hoja
                    worksheet = spreadsheet.add_worksheet(
                        title=nombre_hoja,
                        rows=1000,
                        cols=len(headers)
                    )
                    
                    # Agregar headers
                    worksheet.append_row(headers)
                    
                    logger.info(f"Hoja '{nombre_hoja}' creada con {len(headers)} columnas")
            
            except Exception as e:
                logger.error(f"Error preparando hoja '{nombre_hoja}': {e}", exc_info=True)
                # Continuar con el siguiente período
        
        logger.info(f"Preparación de {len(periods)} hojas completada")

