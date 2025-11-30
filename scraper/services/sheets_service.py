"""
Servicio para interactuar con Google Sheets
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

import gspread
from oauth2client.service_account import ServiceAccountCredentials

from scraper.config.settings import (
    GOOGLE_SHEETS_CREDENTIALS_PATH,
    GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SHEETS_SOURCE_ID,
    GOOGLE_SHEETS_TARGET_ID,
)
from scraper.utils.helpers import sanitizar_valor_hoja, validar_cedula, limpiar_cedula

logger = logging.getLogger(__name__)


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
            # Obtener la hoja de cálculo apropiada
            if sheet_url:
                # Extraer ID de la URL
                sheet_id = self._extract_sheet_id_from_url(sheet_url)
                spreadsheet = self.client.open_by_key(sheet_id)
                logger.info(f"Accediendo a hoja externa: {spreadsheet.title}")
            else:
                # Usar la hoja fuente por defecto
                spreadsheet = self.get_source_spreadsheet()
                logger.info(f"Accediendo a hoja fuente: {spreadsheet.title}")
            
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
            
            logger.info(f"Extrayendo cédulas de la columna {column} (índice {columna_idx})")
            
            # Obtener todos los valores de la columna (saltando la primera fila si es header)
            try:
                # Intentar obtener todos los valores de la columna
                valores_columna = worksheet.col_values(columna_idx)
                
                # Si la primera fila parece ser un header (contiene "No. Documento" o similar)
                # saltarla
                if valores_columna and len(valores_columna) > 0:
                    primer_valor = str(valores_columna[0]).upper()
                    if any(keyword in primer_valor for keyword in ['NO.', 'DOCUMENTO', 'CEDULA', 'ID']):
                        valores_columna = valores_columna[1:]
                        logger.debug("Saltando primera fila (header detectado)")
                
            except Exception as e:
                logger.error(f"Error al leer columna {column}: {e}")
                raise
            
            # Procesar y limpiar cédulas
            cedulas_unicas = self._procesar_y_limpiar_cedulas(valores_columna)
            
            logger.info(
                f"Extraídas {len(cedulas_unicas)} cédulas únicas y válidas "
                f"de {len(valores_columna)} valores en la columna {column}"
            )
            
            return cedulas_unicas
            
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

