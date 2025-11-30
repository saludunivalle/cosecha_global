"""
Configuración del scraper Univalle
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# URLs
UNIVALLE_BASE_URL = os.getenv('UNIVALLE_BASE_URL', 'https://proxse26.univalle.edu.co/asignacion')
UNIVALLE_ENDPOINT = f"{UNIVALLE_BASE_URL}/vin_inicio_impresion.php3"
UNIVALLE_PERIODOS_URL = f"{UNIVALLE_BASE_URL}/vin_docente.php3"

# Google Sheets
GOOGLE_SHEETS_CREDENTIALS_PATH = os.getenv('GOOGLE_SHEETS_CREDENTIALS_PATH', 'credentials.json')
GOOGLE_SHEETS_SPREADSHEET_ID = os.getenv('GOOGLE_SHEETS_SPREADSHEET_ID', '')  # Deprecated: usar SOURCE/TARGET
GOOGLE_SHEETS_SOURCE_ID = os.getenv('GOOGLE_SHEETS_SOURCE_ID', os.getenv('SHEET_SOURCE', ''))
GOOGLE_SHEETS_TARGET_ID = os.getenv('GOOGLE_SHEETS_TARGET_ID', os.getenv('SHEET_TARGET', ''))

# Cookies opcionales (pueden estar vacías)
COOKIE_PHPSESSID = os.getenv('COOKIE_PHPSESSID', '')
COOKIE_ASIGACAD = os.getenv('COOKIE_ASIGACAD', '')

# Configuración de scraping
REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', '30'))
REQUEST_MAX_RETRIES = int(os.getenv('REQUEST_MAX_RETRIES', '3'))
REQUEST_RETRY_DELAY = int(os.getenv('REQUEST_RETRY_DELAY', '2'))

# Configuración de períodos
DEFAULT_PERIODOS_COUNT = int(os.getenv('DEFAULT_PERIODOS_COUNT', '8'))
TARGET_PERIOD = os.getenv('TARGET_PERIOD', '')

# Google Sheets API Configuration
SHEETS_READ_TIMEOUT = int(os.getenv('SHEETS_READ_TIMEOUT', '120'))  # segundos
SHEETS_BATCH_SIZE = int(os.getenv('SHEETS_BATCH_SIZE', '1000'))  # filas por batch
SHEETS_MAX_RETRIES = int(os.getenv('SHEETS_MAX_RETRIES', '5'))
SHEETS_RETRY_DELAY = int(os.getenv('SHEETS_RETRY_DELAY', '5'))  # segundos iniciales
SHEETS_BACKOFF_FACTOR = float(os.getenv('SHEETS_BACKOFF_FACTOR', '2'))  # multiplicador de delay

# Rate limiting
REQUESTS_PER_MINUTE = int(os.getenv('REQUESTS_PER_MINUTE', '60'))
REQUEST_DELAY = float(os.getenv('REQUEST_DELAY', '1.0'))  # segundos entre requests

# Configuración de logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FORMAT = os.getenv(
    'LOG_FORMAT',
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
LOG_FILE = os.getenv('LOG_FILE', 'scraper.log')

# Validación de configuración requerida
def validate_config():
    """
    Valida que la configuración requerida esté presente.
    
    Raises:
        ValueError: Si falta configuración requerida
    """
    # Validar que al menos una de las configuraciones esté presente
    has_source = bool(GOOGLE_SHEETS_SOURCE_ID)
    has_target = bool(GOOGLE_SHEETS_TARGET_ID)
    has_legacy = bool(GOOGLE_SHEETS_SPREADSHEET_ID)
    
    if not has_source and not has_legacy:
        raise ValueError(
            "Falta variable de entorno requerida: GOOGLE_SHEETS_SOURCE_ID o GOOGLE_SHEETS_SPREADSHEET_ID"
        )
    
    if not has_target and not has_legacy:
        raise ValueError(
            "Falta variable de entorno requerida: GOOGLE_SHEETS_TARGET_ID o GOOGLE_SHEETS_SPREADSHEET_ID"
        )
    
    # TARGET_PERIOD es requerido para el flujo completo
    # (pero puede estar vacío si se pasa como argumento en línea de comandos)
    # La validación del formato se hace en period_manager.get_target_period()
    
    # Verificar que el archivo de credenciales existe si se especificó
    if GOOGLE_SHEETS_CREDENTIALS_PATH and not Path(GOOGLE_SHEETS_CREDENTIALS_PATH).exists():
        raise FileNotFoundError(
            f"Archivo de credenciales no encontrado: {GOOGLE_SHEETS_CREDENTIALS_PATH}"
        )

