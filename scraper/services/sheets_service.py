"""
Servicio para interactuar con Google Sheets
"""

import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

import gspread
from gspread.exceptions import APIError
from oauth2client.service_account import ServiceAccountCredentials

# Definir logger antes de usarlo
logger = logging.getLogger(__name__)

# Import opcional de googleapiclient (requiere google-api-python-client)
try:
    from googleapiclient.discovery import build
    HAS_GOOGLEAPICLIENT = True
except ImportError:
    HAS_GOOGLEAPICLIENT = False
    build = None
    logger.warning(
        "google-api-python-client no está instalado. "
        "Algunas funcionalidades avanzadas no estarán disponibles. "
        "Instala con: pip install google-api-python-client"
    )

from tenacity import (
    retry,
    wait_exponential,
    stop_after_attempt,
    retry_if_exception_type,
    before_sleep_log,
)

from scraper.config.settings import (
    GOOGLE_SHEETS_CREDENTIALS_PATH,
    GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SHEETS_SOURCE_ID,
    GOOGLE_SHEETS_TARGET_ID,
    SHEETS_READ_TIMEOUT,
    SHEETS_BATCH_SIZE,
    SHEETS_MAX_RETRIES,
    SHEETS_RETRY_DELAY,
    SHEETS_BACKOFF_FACTOR,
    REQUESTS_PER_MINUTE,
    REQUEST_DELAY,
)
from scraper.utils.helpers import sanitizar_valor_hoja, validar_cedula, limpiar_cedula


class SheetsService:
    """Servicio para manejar Google Sheets."""
    
    SCOPE = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    def __init__(self, spreadsheet_id: Optional[str] = None):
        """
        Inicializa el servicio de Google Sheets.
        
        Args:
            spreadsheet_id: ID de la hoja a usar. Si es None, usa GOOGLE_SHEETS_TARGET_ID
                          o GOOGLE_SHEETS_SPREADSHEET_ID como fallback.
        """
        try:
            credentials = ServiceAccountCredentials.from_json_keyfile_name(
                GOOGLE_SHEETS_CREDENTIALS_PATH,
                self.SCOPE
            )
            self.client = gspread.authorize(credentials)
            
            # Configurar timeout del cliente HTTP
            if hasattr(self.client, 'http_client') and hasattr(self.client.http_client, 'timeout'):
                self.client.http_client.timeout = SHEETS_READ_TIMEOUT
                logger.debug(f"Timeout configurado: {SHEETS_READ_TIMEOUT} segundos")
            else:
                # Fallback: configurar timeout en el cliente de gspread si está disponible
                try:
                    import httplib2
                    http = httplib2.Http(timeout=SHEETS_READ_TIMEOUT)
                    self.client.http_client = http
                    logger.debug(f"Timeout configurado mediante httplib2: {SHEETS_READ_TIMEOUT} segundos")
                except Exception as e:
                    logger.warning(f"No se pudo configurar timeout del cliente HTTP: {e}")
            
            # Crear servicio de Google Sheets API para acceso directo (si está disponible)
            if HAS_GOOGLEAPICLIENT:
                self.sheets_service_api = build('sheets', 'v4', credentials=credentials)
            else:
                self.sheets_service_api = None
                logger.warning(
                    "google-api-python-client no disponible. "
                    "get_cedulas_batch() y get_cedulas_paginated() no funcionarán. "
                    "Usando get_cedulas_from_sheet() como alternativa."
                )
            
            # Almacenar configuraciones de rate limiting
            self.sheets_batch_size = SHEETS_BATCH_SIZE
            self.sheets_max_retries = SHEETS_MAX_RETRIES
            self.sheets_retry_delay = SHEETS_RETRY_DELAY
            self.sheets_backoff_factor = SHEETS_BACKOFF_FACTOR
            self.requests_per_minute = REQUESTS_PER_MINUTE
            self.request_delay = REQUEST_DELAY
            
            # Determinar qué hoja usar
            if spreadsheet_id:
                sheet_id = spreadsheet_id
            elif GOOGLE_SHEETS_TARGET_ID:
                sheet_id = GOOGLE_SHEETS_TARGET_ID
            elif GOOGLE_SHEETS_SPREADSHEET_ID:
                sheet_id = GOOGLE_SHEETS_SPREADSHEET_ID
            else:
                raise ValueError("No se especificó spreadsheet_id y no hay configuración por defecto")
            
            self.spreadsheet = self.client.open_by_key(sheet_id)
            self.spreadsheet_id = sheet_id
            
            # Inicializar caché de spreadsheets
            self._spreadsheet_cache: Dict[str, Any] = {}
            
            logger.info(f"Conectado a Google Sheets: {self.spreadsheet.title} (ID: {sheet_id})")
        except FileNotFoundError:
            logger.error(f"Archivo de credenciales no encontrado: {GOOGLE_SHEETS_CREDENTIALS_PATH}")
            raise
        except Exception as e:
            logger.error(f"Error al conectar con Google Sheets: {e}")
            raise
    
    def get_source_spreadsheet(self):
        """
        Obtiene la hoja fuente (de donde se leen las cédulas).
        
        Returns:
            Objeto Spreadsheet de gspread
        """
        sheet_id = GOOGLE_SHEETS_SOURCE_ID or GOOGLE_SHEETS_SPREADSHEET_ID
        if not sheet_id:
            raise ValueError("No se configuró GOOGLE_SHEETS_SOURCE_ID")
        return self.client.open_by_key(sheet_id)
    
    def get_target_spreadsheet(self):
        """
        Obtiene la hoja destino (donde se escriben los datos).
        
        Returns:
            Objeto Spreadsheet de gspread
        """
        sheet_id = GOOGLE_SHEETS_TARGET_ID or GOOGLE_SHEETS_SPREADSHEET_ID
        if not sheet_id:
            raise ValueError("No se configuró GOOGLE_SHEETS_TARGET_ID")
        return self.client.open_by_key(sheet_id)
    
    def obtener_hoja(self, nombre_hoja: str, crear_si_no_existe: bool = False, usar_target: bool = True):
        """
        Obtiene una hoja por nombre.
        
        Args:
            nombre_hoja: Nombre de la hoja
            crear_si_no_existe: Si es True, crea la hoja si no existe
            usar_target: Si es True, usa la hoja destino; si es False, usa la hoja fuente
            
        Returns:
            Objeto Worksheet de gspread
        """
        try:
            spreadsheet = self.get_target_spreadsheet() if usar_target else self.get_source_spreadsheet()
            return spreadsheet.worksheet(nombre_hoja)
        except gspread.exceptions.WorksheetNotFound:
            if crear_si_no_existe:
                logger.info(f"Creando hoja: {nombre_hoja}")
                spreadsheet = self.get_target_spreadsheet() if usar_target else self.get_source_spreadsheet()
                return spreadsheet.add_worksheet(
                    title=nombre_hoja,
                    rows=1000,
                    cols=20
                )
            raise
    
    def crear_hoja(self, nombre_hoja: str, headers: List[str], limpiar_existente: bool = False, usar_target: bool = True):
        """
        Crea una hoja con headers.
        
        Args:
            nombre_hoja: Nombre de la hoja
            headers: Lista de headers
            limpiar_existente: Si es True, limpia la hoja si ya existe
            usar_target: Si es True, crea en la hoja destino; si es False, en la fuente
            
        Returns:
            Objeto Worksheet
        """
        try:
            hoja = self.obtener_hoja(nombre_hoja, crear_si_no_existe=True, usar_target=usar_target)
            
            if limpiar_existente:
                logger.info(f"Limpiando hoja existente: {nombre_hoja}")
                hoja.clear()
            
            # Agregar headers
            hoja.append_row(headers)
            logger.info(f"Hoja {nombre_hoja} creada/actualizada con headers")
            
            return hoja
        except Exception as e:
            logger.error(f"Error al crear hoja {nombre_hoja}: {e}")
            raise
    
    def limpiar_hoja(self, nombre_hoja: str):
        """
        Limpia el contenido de una hoja.
        
        Args:
            nombre_hoja: Nombre de la hoja
        """
        try:
            hoja = self.obtener_hoja(nombre_hoja)
            hoja.clear()
            logger.info(f"Hoja {nombre_hoja} limpiada")
        except Exception as e:
            logger.error(f"Error al limpiar hoja {nombre_hoja}: {e}")
            raise
    
    def agregar_fila(self, nombre_hoja: str, valores: List[Any], usar_target: bool = True):
        """
        Agrega una fila a una hoja.
        
        Args:
            nombre_hoja: Nombre de la hoja
            valores: Lista de valores para la fila
            usar_target: Si es True, escribe en la hoja destino; si es False, en la fuente
        """
        try:
            hoja = self.obtener_hoja(nombre_hoja, usar_target=usar_target)
            valores_sanitizados = [sanitizar_valor_hoja(v) for v in valores]
            hoja.append_row(valores_sanitizados)
        except Exception as e:
            logger.error(f"Error al agregar fila a {nombre_hoja}: {e}")
            raise
    
    def agregar_filas(self, nombre_hoja: str, filas: List[List[Any]], usar_target: bool = True):
        """
        Agrega múltiples filas a una hoja.
        
        Args:
            nombre_hoja: Nombre de la hoja
            filas: Lista de listas con valores
            usar_target: Si es True, escribe en la hoja destino; si es False, en la fuente
        """
        try:
            hoja = self.obtener_hoja(nombre_hoja, usar_target=usar_target)
            
            # Sanitizar todas las filas
            filas_sanitizadas = [
                [sanitizar_valor_hoja(v) for v in fila]
                for fila in filas
            ]
            
            # Agregar en lotes para mejor rendimiento
            hoja.append_rows(filas_sanitizadas)
            logger.info(f"Agregadas {len(filas)} filas a {nombre_hoja}")
        except Exception as e:
            logger.error(f"Error al agregar filas a {nombre_hoja}: {e}")
            raise
    
    def obtener_todos_los_valores(self, nombre_hoja: str) -> List[List[Any]]:
        """
        Obtiene todos los valores de una hoja.
        
        Args:
            nombre_hoja: Nombre de la hoja
            
        Returns:
            Lista de listas con todos los valores
        """
        try:
            hoja = self.obtener_hoja(nombre_hoja)
            return hoja.get_all_values()
        except Exception as e:
            logger.error(f"Error al obtener valores de {nombre_hoja}: {e}")
            raise
    
    def buscar_fila_por_cedula(
        self,
        nombre_hoja: str,
        cedula: str,
        columna_cedula: int = 0
    ) -> Optional[int]:
        """
        Busca una fila por cédula.
        
        Args:
            nombre_hoja: Nombre de la hoja
            cedula: Cédula a buscar
            columna_cedula: Índice de la columna con cédulas (0-based)
            
        Returns:
            Índice de la fila (1-based) o None si no se encuentra
        """
        try:
            hoja = self.obtener_hoja(nombre_hoja)
            valores = hoja.get_all_values()
            
            for i, fila in enumerate(valores, start=1):
                if len(fila) > columna_cedula and fila[columna_cedula] == cedula:
                    return i
            
            return None
        except Exception as e:
            logger.error(f"Error al buscar cédula {cedula} en {nombre_hoja}: {e}")
            return None
    
    def actualizar_fila(
        self,
        nombre_hoja: str,
        fila_idx: int,
        valores: List[Any],
        columna_inicio: int = 0
    ):
        """
        Actualiza una fila existente.
        
        Args:
            nombre_hoja: Nombre de la hoja
            fila_idx: Índice de la fila (1-based)
            valores: Lista de valores
            columna_inicio: Columna desde donde empezar (1-based)
        """
        try:
            hoja = self.obtener_hoja(nombre_hoja)
            valores_sanitizados = [sanitizar_valor_hoja(v) for v in valores]
            
            # Actualizar celda por celda
            for i, valor in enumerate(valores_sanitizados):
                hoja.update_cell(fila_idx, columna_inicio + i + 1, valor)
            
            logger.debug(f"Fila {fila_idx} actualizada en {nombre_hoja}")
        except Exception as e:
            logger.error(f"Error al actualizar fila {fila_idx} en {nombre_hoja}: {e}")
            raise
    
    def formatear_hoja(self, nombre_hoja: str):
        """
        Formatea una hoja (congela primera fila, ajusta ancho).
        
        Args:
            nombre_hoja: Nombre de la hoja
        """
        try:
            hoja = self.obtener_hoja(nombre_hoja)
            
            # Congelar primera fila
            hoja.freeze(rows=1)
            
            # Formatear header
            hoja.format('1:1', {
                'textFormat': {'bold': True},
                'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9}
            })
            
            logger.info(f"Hoja {nombre_hoja} formateada")
        except Exception as e:
            logger.warning(f"No se pudo formatear hoja {nombre_hoja}: {e}")
    
    @retry(
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type((APIError, Exception)),
        reraise=True,
        before_sleep=before_sleep_log(logger, logging.WARNING)
    )
    def get_cedulas_from_sheet(
        self,
        sheet_url: Optional[str] = None,
        worksheet_name: str = None,
        column: str = 'D'
    ) -> List[str]:
        """
        Extrae todas las cédulas de una columna específica de una hoja de cálculo.
        
        Conecta con Google Sheets usando service account, lee la hoja específica,
        extrae cédulas de la columna especificada (por defecto columna D),
        limpia y valida las cédulas, eliminando duplicados, valores vacíos
        y formatos incorrectos.
        
        Implementa:
        - Retry logic con backoff exponencial (hasta 5 intentos)
        - Caché de metadata del spreadsheet para evitar llamadas repetidas
        - Lectura por batches para optimizar rendimiento
        - Manejo específico del error 500 de Google Sheets API
        
        Args:
            sheet_url: URL de la hoja de cálculo. Si es None, usa la hoja
                      configurada en GOOGLE_SHEETS_SPREADSHEET_ID.
            worksheet_name: Nombre de la hoja de trabajo (worksheet) a leer.
                           Si es None, usa la primera hoja.
            column: Columna de la cual extraer las cédulas. Puede ser letra ('D')
                    o índice basado en 1 (4). Por defecto 'D'.
        
        Returns:
            Lista de cédulas únicas, validadas y limpiadas.
            
        Raises:
            APIError: Si hay error 500 después de 5 intentos
            Exception: Si hay error al acceder a la hoja o extraer datos.
        
        Example:
            >>> service = SheetsService()
            >>> cedulas = service.get_cedulas_from_sheet(
            ...     worksheet_name="2025-2",
            ...     column="D"
            ... )
            >>> print(f"Encontradas {len(cedulas)} cédulas únicas")
        """
        try:
            # Obtener la hoja de cálculo apropiada (con caché)
            if sheet_url:
                # Extraer ID de la URL
                sheet_id = self._extract_sheet_id_from_url(sheet_url)
                
                # Usar caché si existe
                if sheet_id not in self._spreadsheet_cache:
                    logger.debug(f"Abriendo spreadsheet {sheet_id} (no en caché)")
                    spreadsheet = self.client.open_by_key(sheet_id)
                    self._spreadsheet_cache[sheet_id] = spreadsheet
                    logger.info(f"Accediendo a hoja externa: {spreadsheet.title}")
                else:
                    spreadsheet = self._spreadsheet_cache[sheet_id]
                    logger.debug(f"Usando spreadsheet {sheet_id} desde caché")
            else:
                # Usar la hoja fuente por defecto
                source_id = GOOGLE_SHEETS_SOURCE_ID or GOOGLE_SHEETS_SPREADSHEET_ID
                if not source_id:
                    raise ValueError("No se configuró GOOGLE_SHEETS_SOURCE_ID")
                
                # Usar caché si existe
                if source_id not in self._spreadsheet_cache:
                    logger.debug(f"Abriendo spreadsheet fuente {source_id} (no en caché)")
                    spreadsheet = self.client.open_by_key(source_id)
                    self._spreadsheet_cache[source_id] = spreadsheet
                    logger.info(f"Accediendo a hoja fuente: {spreadsheet.title}")
                else:
                    spreadsheet = self._spreadsheet_cache[source_id]
                    logger.debug(f"Usando spreadsheet fuente {source_id} desde caché")
            
            # Obtener la hoja de trabajo (worksheet)
            if worksheet_name:
                try:
                    worksheet = spreadsheet.worksheet(worksheet_name)
                    logger.info(f"Leyendo hoja de trabajo: {worksheet_name}")
                except gspread.exceptions.WorksheetNotFound:
                    logger.error(f"Hoja de trabajo '{worksheet_name}' no encontrada")
                    raise ValueError(f"Hoja de trabajo '{worksheet_name}' no encontrada en la hoja de cálculo")
            else:
                # Usar la primera hoja
                worksheet = spreadsheet.sheet1
                logger.info(f"Usando primera hoja: {worksheet.title}")
            
            # Convertir columna a índice numérico (gspread usa 1-based)
            columna_idx = self._column_letter_to_index(column)
            columna_letra = column.upper()
            
            logger.info(f"Extrayendo cédulas de la columna {columna_letra} (índice {columna_idx})")
            
            # Leer valores por batches para optimizar rendimiento
            valores_columna = self._leer_columna_por_batches(worksheet, columna_letra, columna_idx)
            
            # Si la primera fila parece ser un header (contiene "No. Documento" o similar)
            # saltarla
            if valores_columna and len(valores_columna) > 0:
                primer_valor = str(valores_columna[0]).upper()
                if any(keyword in primer_valor for keyword in ['NO.', 'DOCUMENTO', 'CEDULA', 'ID']):
                    valores_columna = valores_columna[1:]
                    logger.debug("Saltando primera fila (header detectado)")
            
            # Procesar y limpiar cédulas
            cedulas_unicas = self._procesar_y_limpiar_cedulas(valores_columna)
            
            logger.info(
                f"Extraídas {len(cedulas_unicas)} cédulas únicas y válidas "
                f"de {len(valores_columna)} valores en la columna {columna_letra}"
            )
            
            return cedulas_unicas
            
        except APIError as e:
            # Manejo específico del error 500
            error_str = str(e)
            if '500' in error_str or e.response.status_code == 500:
                logger.warning(
                    f"Error 500 de Google Sheets API detectado: {error_str}. "
                    f"El decorator @retry reintentará automáticamente."
                )
                # Re-lanzar para que tenacity haga el retry
                raise
            # Para otros errores de API, también re-lanzar
            logger.error(f"Error de API de Google Sheets: {e}")
            raise
        except Exception as e:
            logger.error(f"Error en get_cedulas_from_sheet: {e}", exc_info=True)
            raise
    
    def _extract_sheet_id_from_url(self, url: str) -> str:
        """
        Extrae el ID de la hoja de cálculo desde una URL de Google Sheets.
        
        Args:
            url: URL completa de Google Sheets
            
        Returns:
            ID de la hoja de cálculo
            
        Raises:
            ValueError: Si la URL no es válida
        """
        import re
        
        # Patrón para extraer ID de URL de Google Sheets
        patterns = [
            r'/spreadsheets/d/([a-zA-Z0-9-_]+)',  # URL completa
            r'([a-zA-Z0-9-_]{44})',  # Solo ID (44 caracteres típicamente)
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                sheet_id = match.group(1)
                logger.debug(f"ID extraído de URL: {sheet_id}")
                return sheet_id
        
        raise ValueError(f"URL de Google Sheets no válida: {url}")
    
    def _column_letter_to_index(self, column: str) -> int:
        """
        Convierte una letra de columna (ej: 'D') a índice numérico (1-based).
        
        También acepta números como string o int directamente.
        
        Args:
            column: Letra de columna ('A', 'B', 'D', etc.) o número (1-based)
            
        Returns:
            Índice numérico de la columna (1-based)
            
        Raises:
            ValueError: Si la columna no es válida
        """
        # Si es un número, retornarlo directamente
        if isinstance(column, int):
            if column < 1:
                raise ValueError(f"Índice de columna debe ser >= 1, recibido: {column}")
            return column
        
        if isinstance(column, str):
            # Intentar parsear como número
            try:
                col_num = int(column)
                if col_num >= 1:
                    return col_num
            except ValueError:
                pass
            
            # Procesar como letra
            column = column.upper().strip()
            
            if not column:
                raise ValueError("Columna no puede estar vacía")
            
            # Convertir letra a número (A=1, B=2, ..., Z=26, AA=27, etc.)
            result = 0
            for char in column:
                if not char.isalpha():
                    raise ValueError(f"Carácter inválido en columna: {char}")
                result = result * 26 + (ord(char) - ord('A') + 1)
            
            return result
        
        raise ValueError(f"Formato de columna no válido: {column} (tipo: {type(column)})")
    
    def _procesar_y_limpiar_cedulas(self, valores: List[str]) -> List[str]:
        """
        Procesa una lista de valores, limpiando y validando cédulas.
        
        Elimina:
        - Valores vacíos o None
        - Cédulas inválidas
        - Duplicados
        
        Args:
            valores: Lista de valores a procesar
            
        Returns:
            Lista de cédulas únicas, validadas y limpiadas
        """
        cedulas_procesadas = set()
        
        for valor in valores:
            if not valor:
                continue
            
            # Convertir a string y limpiar
            valor_str = str(valor).strip()
            
            if not valor_str:
                continue
            
            # Limpiar cédula (remover espacios, puntos, guiones)
            cedula_limpia = limpiar_cedula(valor_str)
            
            if not cedula_limpia:
                logger.debug(f"Valor vacío después de limpiar: {valor_str}")
                continue
            
            # Validar formato de cédula
            if not validar_cedula(cedula_limpia):
                logger.debug(f"Cédula inválida (ignorada): {valor_str} -> {cedula_limpia}")
                continue
            
            # Agregar al set (automáticamente elimina duplicados)
            cedulas_procesadas.add(cedula_limpia)
        
        # Convertir a lista y ordenar
        cedulas_unicas = sorted(list(cedulas_procesadas))
        
        if len(cedulas_procesadas) < len(valores):
            valores_filtrados = len(valores) - len(cedulas_procesadas)
            logger.debug(
                f"Filtradas {valores_filtrados} cédulas inválidas o duplicadas "
                f"de {len(valores)} valores totales"
            )
        
        return cedulas_unicas
    
    def _leer_columna_por_batches(
        self,
        worksheet: gspread.Worksheet,
        columna_letra: str,
        columna_idx: int,
        batch_size: int = 1000
    ) -> List[str]:
        """
        Lee una columna completa por batches para optimizar rendimiento.
        
        En lugar de usar col_values() que puede ser lento para columnas grandes,
        lee la columna en rangos de batch_size filas usando batch_get().
        
        Args:
            worksheet: Objeto Worksheet de gspread
            columna_letra: Letra de la columna (ej: 'D')
            columna_idx: Índice numérico de la columna (1-based)
            batch_size: Tamaño del batch (default: 1000)
        
        Returns:
            Lista de valores de la columna
        """
        try:
            # Obtener el número total de filas con datos
            # Primero intentamos obtener el último valor para saber cuántas filas hay
            all_values = []
            start_row = 1
            max_attempts = 100  # Límite de seguridad para evitar loops infinitos
            
            logger.debug(f"Leyendo columna {columna_letra} por batches de {batch_size} filas")
            
            for attempt in range(max_attempts):
                end_row = start_row + batch_size - 1
                range_name = f"{columna_letra}{start_row}:{columna_letra}{end_row}"
                
                try:
                    # Leer batch usando batch_get
                    batch_values = worksheet.batch_get([range_name])
                    
                    if not batch_values or not batch_values[0]:
                        # No hay más datos
                        break
                    
                    # batch_get retorna lista de listas, necesitamos aplanar
                    batch_flat = [row[0] if row else '' for row in batch_values[0]]
                    all_values.extend(batch_flat)
                    
                    # Si el batch está incompleto (menos de batch_size valores),
                    # significa que llegamos al final
                    if len(batch_flat) < batch_size:
                        break
                    
                    start_row = end_row + 1
                    
                except Exception as e:
                    # Si hay error en un batch específico, intentar con col_values como fallback
                    logger.warning(
                        f"Error leyendo batch {range_name}: {e}. "
                        f"Usando col_values() como fallback."
                    )
                    # Fallback: usar col_values para el resto
                    try:
                        remaining_values = worksheet.col_values(columna_idx)
                        if all_values:
                            # Combinar con lo que ya tenemos
                            # Remover duplicados del inicio
                            remaining_start = len(all_values)
                            if remaining_start < len(remaining_values):
                                all_values.extend(remaining_values[remaining_start:])
                        else:
                            all_values = remaining_values
                    except Exception as fallback_error:
                        logger.error(f"Error en fallback col_values: {fallback_error}")
                        raise
                    break
            
            logger.debug(f"Leídas {len(all_values)} filas de la columna {columna_letra}")
            return all_values
            
        except Exception as e:
            logger.warning(
                f"Error en lectura por batches, usando col_values() como fallback: {e}"
            )
            # Fallback: usar col_values tradicional
            try:
                return worksheet.col_values(columna_idx)
            except Exception as fallback_error:
                logger.error(f"Error en fallback col_values: {fallback_error}")
                raise
    
    @retry(
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type((APIError, Exception)),
        reraise=True,
        before_sleep=before_sleep_log(logger, logging.WARNING)
    )
    def get_cedulas_batch(
        self,
        sheet_url: Optional[str] = None,
        worksheet_name: str = None,
        column: str = 'D',
        batch_size: Optional[int] = None
    ) -> List[str]:
        """
        Lee cédulas usando batch API de Google Sheets directamente.
        
        Más eficiente para hojas grandes al usar values().get() de la API
        en lugar de métodos de gspread que pueden ser más lentos.
        
        Args:
            sheet_url: URL de la hoja de cálculo. Si es None, usa la hoja fuente.
            worksheet_name: Nombre de la hoja de trabajo (worksheet) a leer.
                           Si es None, usa la primera hoja.
            column: Columna de la cual extraer las cédulas (default: 'D').
            batch_size: Tamaño máximo de filas a leer. Si es None, usa SHEETS_BATCH_SIZE.
        
        Returns:
            Lista de cédulas únicas, validadas y limpiadas.
            
        Raises:
            ValueError: Si la hoja no se encuentra
            APIError: Si hay error de la API de Google Sheets
        """
        try:
            # Verificar que google-api-python-client esté disponible
            if not HAS_GOOGLEAPICLIENT or self.sheets_service_api is None:
                raise ImportError(
                    "google-api-python-client no está instalado. "
                    "Instala con: pip install google-api-python-client"
                )
            
            # Obtener ID del spreadsheet
            if sheet_url:
                spreadsheet_id = self._extract_sheet_id_from_url(sheet_url)
            else:
                # Usar la hoja fuente por defecto
                spreadsheet_id = GOOGLE_SHEETS_SOURCE_ID or GOOGLE_SHEETS_SPREADSHEET_ID
                if not spreadsheet_id:
                    raise ValueError("No se configuró GOOGLE_SHEETS_SOURCE_ID")
            
            logger.info(f"Leyendo cédulas usando batch API desde spreadsheet {spreadsheet_id}")
            
            # Usar batch_size de configuración si no se especifica
            if batch_size is None:
                batch_size = self.sheets_batch_size
            
            # Si no se especifica worksheet_name, obtener la primera hoja
            if not worksheet_name:
                spreadsheet = self.client.open_by_key(spreadsheet_id)
                worksheet_name = spreadsheet.sheet1.title
                logger.info(f"Usando primera hoja: {worksheet_name}")
            
            # Construir rango: desde fila 2 (saltar encabezado) hasta batch_size
            # Formato: 'Hoja'!D2:D5000
            range_name = f"'{worksheet_name}'!{column}2:{column}{batch_size + 1}"
            
            logger.debug(f"Leyendo rango: {range_name}")
            
            # Usar la API directa de Google Sheets
            result = self.sheets_service_api.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueRenderOption='UNFORMATTED_VALUE'
            ).execute()
            
            values = result.get('values', [])
            
            # Extraer cédulas de la primera columna (ya que solo leemos una columna)
            cedulas = []
            for row in values:
                if row and len(row) > 0:
                    cedula_raw = str(row[0]).strip()
                    if cedula_raw:
                        cedulas.append(cedula_raw)
            
            logger.info(f"Leídas {len(cedulas)} cédulas desde API (antes de limpiar)")
            
            # Procesar y limpiar cédulas (usar el método existente)
            cedulas_unicas = self._procesar_y_limpiar_cedulas(cedulas)
            
            logger.info(
                f"Extraídas {len(cedulas_unicas)} cédulas únicas y válidas "
                f"de {len(cedulas)} valores leídos desde la columna {column}"
            )
            
            return cedulas_unicas
            
        except APIError as e:
            # Manejo específico del error 500
            error_str = str(e)
            if '500' in error_str or (hasattr(e, 'response') and e.response.status_code == 500):
                logger.warning(
                    f"Error 500 de Google Sheets API detectado: {error_str}. "
                    f"El decorator @retry reintentará automáticamente."
                )
                raise
            logger.error(f"Error de API de Google Sheets: {e}")
            raise
        except Exception as e:
            logger.error(f"Error en get_cedulas_batch: {e}", exc_info=True)
            # Fallback a paginación manual si el batch falla
            logger.warning("Intentando lectura paginada como fallback...")
            return self.get_cedulas_paginated(
                sheet_url=sheet_url,
                worksheet_name=worksheet_name,
                column=column,
                page_size=1000
            )
    
    @retry(
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(3),  # Menos intentos para paginación
        retry=retry_if_exception_type((APIError, Exception)),
        reraise=True,
        before_sleep=before_sleep_log(logger, logging.WARNING)
    )
    def get_cedulas_paginated(
        self,
        sheet_url: Optional[str] = None,
        worksheet_name: str = None,
        column: str = 'D',
        page_size: Optional[int] = None
    ) -> List[str]:
        """
        Lee cédulas en páginas pequeñas para evitar timeout.
        
        Método de fallback más robusto que lee la columna en chunks pequeños,
        útil cuando el método batch falla o para hojas muy grandes.
        
        Args:
            sheet_url: URL de la hoja de cálculo. Si es None, usa la hoja fuente.
            worksheet_name: Nombre de la hoja de trabajo (worksheet) a leer.
                           Si es None, usa la primera hoja.
            column: Columna de la cual extraer las cédulas (default: 'D').
            page_size: Tamaño de cada página. Si es None, usa SHEETS_BATCH_SIZE.
        
        Returns:
            Lista de cédulas únicas, validadas y limpiadas.
            
        Raises:
            ValueError: Si la hoja no se encuentra
            APIError: Si hay error de la API de Google Sheets después de reintentos
        """
        try:
            # Verificar que google-api-python-client esté disponible
            if not HAS_GOOGLEAPICLIENT or self.sheets_service_api is None:
                raise ImportError(
                    "google-api-python-client no está instalado. "
                    "Instala con: pip install google-api-python-client"
                )
            
            # Obtener ID del spreadsheet
            if sheet_url:
                spreadsheet_id = self._extract_sheet_id_from_url(sheet_url)
            else:
                # Usar la hoja fuente por defecto
                spreadsheet_id = GOOGLE_SHEETS_SOURCE_ID or GOOGLE_SHEETS_SPREADSHEET_ID
                if not spreadsheet_id:
                    raise ValueError("No se configuró GOOGLE_SHEETS_SOURCE_ID")
            
            logger.info(f"Leyendo cédulas con paginación desde spreadsheet {spreadsheet_id}")
            
            # Usar page_size de configuración si no se especifica
            if page_size is None:
                page_size = self.sheets_batch_size
            
            # Si no se especifica worksheet_name, obtener la primera hoja
            if not worksheet_name:
                spreadsheet = self.client.open_by_key(spreadsheet_id)
                worksheet_name = spreadsheet.sheet1.title
                logger.info(f"Usando primera hoja: {worksheet_name}")
            
            cedulas = []
            page = 1
            max_pages = 1000  # Límite de seguridad para evitar loops infinitos
            
            while page <= max_pages:
                # Calcular rango de la página (empezar desde fila 2 para saltar encabezado)
                start_row = 2 + (page - 1) * page_size
                end_row = start_row + page_size - 1
                
                # Construir rango: 'Hoja'!D2:D1001, 'Hoja'!D1002:D2001, etc.
                range_name = f"'{worksheet_name}'!{column}{start_row}:{column}{end_row}"
                
                try:
                    logger.debug(f"Leyendo página {page}: {range_name}")
                    
                    # Usar la API directa de Google Sheets
                    result = self.sheets_service_api.spreadsheets().values().get(
                        spreadsheetId=spreadsheet_id,
                        range=range_name,
                        valueRenderOption='UNFORMATTED_VALUE'
                    ).execute()
                    
                    values = result.get('values', [])
                    
                    if not values:
                        # No hay más datos
                        logger.debug(f"Página {page} vacía, finalizando lectura")
                        break
                    
                    # Procesar página
                    page_cedulas = []
                    for row in values:
                        if row and len(row) > 0:
                            cedula_raw = str(row[0]).strip()
                            if cedula_raw:
                                page_cedulas.append(cedula_raw)
                    
                    cedulas.extend(page_cedulas)
                    logger.info(f"Página {page}: {len(page_cedulas)} cédulas leídas (total acumulado: {len(cedulas)})")
                    
                    # Si la página está incompleta (menos de page_size), significa que llegamos al final
                    if len(values) < page_size:
                        logger.debug(f"Página {page} incompleta ({len(values)} < {page_size}), finalizando lectura")
                        break
                    
                    page += 1
                    
                    # Delay entre páginas para evitar rate limiting (usar configuración)
                    time.sleep(self.request_delay)
                    
                except APIError as e:
                    error_str = str(e)
                    if '500' in error_str or (hasattr(e, 'response') and e.response.status_code == 500):
                        # Usar delay configurado con backoff
                        wait_time = self.sheets_retry_delay * (self.sheets_backoff_factor ** (page - 1))
                        wait_time = min(wait_time, 60)  # Máximo 60 segundos
                        logger.warning(
                            f"Error 500 en página {page}, esperando {wait_time:.1f} segundos antes de reintentar..."
                        )
                        time.sleep(wait_time)
                        # Continuar con la misma página (no incrementar page)
                        continue
                    # Para otros errores de API, re-lanzar para que el decorator @retry lo maneje
                    logger.error(f"Error de API en página {page}: {e}")
                    raise
                except Exception as e:
                    logger.error(f"Error inesperado en página {page}: {e}")
                    # Si es la primera página, re-lanzar
                    if page == 1:
                        raise
                    # Si es una página posterior, continuar (ya tenemos algunas cédulas)
                    logger.warning(f"Continuando después del error en página {page}...")
                    page += 1
                    time.sleep(2)
                    continue
            
            if page > max_pages:
                logger.warning(f"Se alcanzó el límite de páginas ({max_pages}), deteniendo lectura")
            
            logger.info(f"Lectura paginada completada: {len(cedulas)} cédulas leídas en {page - 1} páginas")
            
            # Procesar y limpiar cédulas (usar el método existente)
            cedulas_unicas = self._procesar_y_limpiar_cedulas(cedulas)
            
            logger.info(
                f"Extraídas {len(cedulas_unicas)} cédulas únicas y válidas "
                f"de {len(cedulas)} valores leídos desde la columna {column}"
            )
            
            return cedulas_unicas
            
        except Exception as e:
            logger.error(f"Error en get_cedulas_paginated: {e}", exc_info=True)
            raise

