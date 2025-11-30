"""
Orquestador principal del scraper Univalle
"""

import sys
import logging
import argparse
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    # Fallback sin barra de progreso
    def tqdm(iterable, desc=None, total=None, **kwargs):
        if desc:
            print(desc)
        return iterable

# Agregar el directorio padre al path para imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.config.settings import (
    LOG_LEVEL,
    LOG_FORMAT,
    LOG_FILE,
    validate_config,
    GOOGLE_SHEETS_SPREADSHEET_ID,
    TARGET_PERIOD,
)
from scraper.services.univalle_scraper import UnivalleScraper, DatosDocente
from scraper.services.sheets_service import SheetsService
from scraper.services.period_manager import PeriodManager
from scraper.utils.helpers import (
    validar_cedula,
    limpiar_cedula,
    formatear_nombre_completo,
)


def configurar_logging():
    """Configura el sistema de logging."""
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL.upper()),
        format=LOG_FORMAT,
        handlers=[
            logging.FileHandler(LOG_FILE, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )


def procesar_docente(
    scraper: UnivalleScraper,
    sheets_service: SheetsService,
    cedula: str,
    periodos: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Procesa un docente para múltiples períodos.
    
    Args:
        scraper: Instancia del scraper
        sheets_service: Instancia del servicio de Sheets
        cedula: Cédula del docente
        periodos: Lista de períodos a procesar
        
    Returns:
        Diccionario con resultados del procesamiento
    """
    logger = logging.getLogger(__name__)
    
    cedula_limpia = limpiar_cedula(cedula)
    
    if not validar_cedula(cedula_limpia):
        raise ValueError(f"Cédula inválida: {cedula}")
    
    logger.info(f"Procesando docente: {cedula_limpia}")
    
    resultados = {
        'cedula': cedula_limpia,
        'periodos_procesados': [],
        'errores': []
    }
    
    for periodo in periodos:
        periodo_id = periodo['idPeriod']
        periodo_label = periodo['label']
        
        try:
            logger.info(f"Procesando período {periodo_label} (ID: {periodo_id})")
            
            # Scraping
            datos = scraper.procesar_docente(cedula_limpia, periodo_id)
            
            # Guardar en Sheets
            guardar_datos_en_sheets(sheets_service, datos, periodo_label)
            
            resultados['periodos_procesados'].append({
                'periodo': periodo_label,
                'idPeriod': periodo_id,
                'pregrado': len(datos.actividades_pregrado),
                'postgrado': len(datos.actividades_postgrado),
                'investigacion': len(datos.actividades_investigacion),
            })
            
            logger.info(
                f"Período {periodo_label} completado: "
                f"{len(datos.actividades_pregrado)} pregrado, "
                f"{len(datos.actividades_postgrado)} postgrado, "
                f"{len(datos.actividades_investigacion)} investigación"
            )
            
        except Exception as e:
            error_msg = f"Error procesando período {periodo_label}: {e}"
            logger.error(error_msg, exc_info=True)
            resultados['errores'].append({
                'periodo': periodo_label,
                'error': str(e)
            })
    
    return resultados


def guardar_datos_en_sheets(
    sheets_service: SheetsService,
    datos: DatosDocente,
    periodo_label: str
):
    """
    Guarda los datos de un docente en Google Sheets.
    
    Args:
        sheets_service: Instancia del servicio de Sheets
        datos: Datos del docente
        periodo_label: Label del período
    """
    logger = logging.getLogger(__name__)
    
    info = datos.informacion_personal
    
    # Hoja principal del período
    hoja_principal = f"Periodo_{periodo_label}"
    
    # Datos básicos del docente
    fila_principal = [
        info.cedula,
        info.nombre,
        info.apellido1,
        info.apellido2,
        info.unidad_academica or info.escuela,
        info.departamento,
        periodo_label,
        info.vinculacion,
        info.categoria,
        info.dedicacion,
        info.nivel_alcanzado,
        info.cargo,
    ]
    
    sheets_service.agregar_fila(hoja_principal, fila_principal)
    
    # Guardar actividades de pregrado
    if datos.actividades_pregrado:
        hoja_pregrado = f"{hoja_principal}_Pregrado"
        filas_pregrado = []
        
        for actividad in datos.actividades_pregrado:
            fila = [
                info.cedula,
                periodo_label,
                actividad.codigo,
                actividad.nombre_asignatura,
                actividad.grupo,
                actividad.tipo,
                actividad.horas_semestre,
            ]
            filas_pregrado.append(fila)
        
        sheets_service.agregar_filas(hoja_pregrado, filas_pregrado)
        logger.debug(f"Guardadas {len(filas_pregrado)} actividades de pregrado")
    
    # Guardar actividades de postgrado
    if datos.actividades_postgrado:
        hoja_postgrado = f"{hoja_principal}_Postgrado"
        filas_postgrado = []
        
        for actividad in datos.actividades_postgrado:
            fila = [
                info.cedula,
                periodo_label,
                actividad.codigo,
                actividad.nombre_asignatura,
                actividad.grupo,
                actividad.tipo,
                actividad.horas_semestre,
            ]
            filas_postgrado.append(fila)
        
        sheets_service.agregar_filas(hoja_postgrado, filas_postgrado)
        logger.debug(f"Guardadas {len(filas_postgrado)} actividades de postgrado")
    
    # Guardar actividades de investigación
    if datos.actividades_investigacion:
        hoja_investigacion = f"{hoja_principal}_Investigacion"
        filas_investigacion = []
        
        for actividad in datos.actividades_investigacion:
            fila = [
                info.cedula,
                periodo_label,
                actividad.codigo,
                actividad.nombre_proyecto,
                actividad.aprobado_por,
                actividad.horas_semestre,
            ]
            filas_investigacion.append(fila)
        
        sheets_service.agregar_filas(hoja_investigacion, filas_investigacion)
        logger.debug(f"Guardadas {len(filas_investigacion)} actividades de investigación")


def crear_estructura_hojas(period_manager: PeriodManager, num_periodos: int):
    """
    Crea la estructura de hojas para los períodos.
    
    Args:
        period_manager: Instancia del gestor de períodos
        num_periodos: Número de períodos a crear
    """
    logger = logging.getLogger(__name__)
    
    logger.info("Creando estructura de hojas...")
    
    periodos = period_manager.obtener_ultimos_n_periodos(num_periodos)
    
    headers = {
        'principal': [
            'Cédula', 'Nombre', 'Apellido1', 'Apellido2',
            'Escuela', 'Departamento', 'Período',
            'Vinculación', 'Categoría', 'Dedicación',
            'Nivel Alcanzado', 'Cargo'
        ],
        'pregrado': [
            'Cédula', 'Período', 'Código', 'Nombre Asignatura',
            'Grupo', 'Tipo', 'Horas Semestre'
        ],
        'postgrado': [
            'Cédula', 'Período', 'Código', 'Nombre Asignatura',
            'Grupo', 'Tipo', 'Horas Semestre'
        ],
        'investigacion': [
            'Cédula', 'Período', 'Código', 'Nombre Proyecto',
            'Aprobado Por', 'Horas Semestre'
        ],
        'tesis': [
            'Cédula', 'Período', 'Código Estudiante', 'Título Tesis',
            'Plan', 'Horas Semestre'
        ],
        'extension': [
            'Cédula', 'Período', 'Tipo', 'Nombre', 'Horas Semestre'
        ],
        'administrativas': [
            'Cédula', 'Período', 'Cargo', 'Descripción', 'Horas Semestre'
        ],
        'complementarias': [
            'Cédula', 'Período', 'Tipo', 'Descripción', 'Horas Semestre'
        ],
        'intelectuales': [
            'Cédula', 'Período', 'Título', 'Tipo', 'Descripción'
        ],
        'comision': [
            'Cédula', 'Período', 'Tipo Comisión', 'Descripción'
        ],
    }
    
    period_manager.crear_hojas_periodos(periodos, headers, limpiar_existentes=False)
    
    logger.info(f"Estructura creada para {len(periodos)} períodos")


def enviar_notificacion(errores_criticos: List[str], logger: logging.Logger):
    """
    Envía notificación si hay errores críticos.
    
    Args:
        errores_criticos: Lista de mensajes de errores críticos
        logger: Logger para registrar
    """
    if not errores_criticos:
        return
    
    # Por ahora solo loguear, se puede extender a email/Slack
    logger.error("="*60)
    logger.error("ERRORES CRÍTICOS DETECTADOS:")
    logger.error("="*60)
    for error in errores_criticos:
        logger.error(f"  ❌ {error}")
    logger.error("="*60)
    
    # TODO: Implementar notificaciones por email/Slack si se requiere
    # Ejemplo:
    # send_email_notification(errores_criticos)
    # send_slack_notification(errores_criticos)


def agrupar_actividades_por_periodo(actividades: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Agrupa actividades por período.
    
    Args:
        actividades: Lista de actividades de un profesor
        
    Returns:
        Diccionario con período como clave y lista de actividades como valor
    """
    agrupadas = defaultdict(list)
    
    for actividad in actividades:
        periodo = actividad.get('periodo', '')
        if periodo:
            agrupadas[periodo].append(actividad)
    
    return dict(agrupadas)


def escribir_actividades_en_hojas(
    sheets_service: SheetsService,
    actividades_por_periodo: Dict[str, List[Dict[str, Any]]],
    logger: logging.Logger
):
    """
    Escribe actividades agrupadas por período en las hojas correspondientes.
    
    Usa batch write para eficiencia.
    
    Args:
        sheets_service: Servicio de Google Sheets
        actividades_por_periodo: Diccionario con período como clave y lista de actividades
        logger: Logger para registrar
    """
    headers = [
        'cedula', 'nombre profesor', 'escuela', 'departamento',
        'tipo actividad', 'categoría', 'nombre actividad',
        'número de horas', 'periodo', 'detalle actividad',
        'actividad', 'vinculación', 'dedicación', 'nivel', 'cargo', 'departamento'
    ]
    
    for periodo_label, actividades in actividades_por_periodo.items():
        try:
            logger.debug(f"Escribiendo {len(actividades)} actividades para período {periodo_label}")
            
            # Convertir diccionarios a listas de valores
            filas = []
            for actividad in actividades:
                fila = [
                    actividad.get('cedula', ''),
                    actividad.get('nombre_profesor', ''),
                    actividad.get('escuela', ''),
                    actividad.get('departamento', ''),
                    actividad.get('tipo_actividad', ''),
                    actividad.get('categoria', ''),
                    actividad.get('nombre_actividad', ''),
                    actividad.get('numero_horas', ''),
                    actividad.get('periodo', ''),
                    actividad.get('detalle_actividad', ''),
                    actividad.get('actividad', ''),
                    actividad.get('vinculacion', ''),
                    actividad.get('dedicacion', ''),
                    actividad.get('nivel', ''),
                    actividad.get('cargo', ''),
                    actividad.get('departamento', '')  # Duplicado según especificación
                ]
                filas.append(fila)
            
            # Escribir en batch a la hoja del período
            nombre_hoja = periodo_label
            sheets_service.agregar_filas(nombre_hoja, filas)
            
            logger.debug(f"✓ {len(filas)} filas escritas en hoja '{nombre_hoja}'")
            
        except Exception as e:
            logger.error(f"Error escribiendo actividades para período {periodo_label}: {e}", exc_info=True)
            raise


def flujo_completo(
    source_sheet_url: Optional[str] = None,
    source_worksheet: str = "2025-2",
    source_column: str = "D",
    target_sheet_url: Optional[str] = None,
    target_period: Optional[str] = None,
    delay_entre_cedulas: float = 1.0
):
    """
    Flujo completo de scraping para un período específico:
    
    1. Leer cédulas desde Google Sheet
    2. Obtener período objetivo (TARGET_PERIOD)
    3. Preparar hoja del período
    4. Scrapear cada cédula para el período
    5. Escribir datos en batch
    6. Logging completo y notificaciones
    
    Args:
        source_sheet_url: URL de la hoja fuente (None = usar hoja por defecto)
        source_worksheet: Nombre de la hoja fuente (default: "2025-2")
        source_column: Columna de cédulas (default: "D")
        target_sheet_url: URL de la hoja destino (None = usar hoja por defecto)
        target_period: Período a procesar (None = usar TARGET_PERIOD de variable de entorno)
        delay_entre_cedulas: Delay entre cédulas en segundos (default: 1.0)
    """
    logger = logging.getLogger(__name__)
    inicio_total = time.time()
    
    logger.info("="*80)
    logger.info("INICIANDO FLUJO COMPLETO DE SCRAPING")
    logger.info("="*80)
    logger.info(f"Inicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    errores_criticos = []
    estadisticas = {
        'cedulas_leidas': 0,
        'cedulas_procesadas': 0,
        'cedulas_con_error': 0,
        'total_actividades': 0,
        'errores_por_cedula': {}
    }
    
    try:
        # 1. Inicializar servicios
        logger.info("\n[PASO 1/5] Inicializando servicios...")
        scraper = UnivalleScraper()
        sheets_service = SheetsService()
        period_manager = PeriodManager(sheets_service, scraper)
        logger.info("✓ Servicios inicializados")
        
        # 2. Obtener período objetivo
        logger.info("\n[PASO 2/5] Obteniendo período objetivo...")
        try:
            if not target_period:
                target_period = period_manager.get_target_period()
            else:
                # Validar formato del período proporcionado
                from scraper.utils.helpers import parsear_periodo_label
                periodo_info = parsear_periodo_label(target_period)
                if not periodo_info:
                    raise ValueError(
                        f"Formato de período inválido: {target_period}. "
                        f"Debe ser en formato 'YYYY-T' (ej: '2026-1', '2025-2')"
                    )
            
            logger.info(f"✓ Período objetivo: {target_period}")
        except Exception as e:
            error_msg = f"Error obteniendo período objetivo: {e}"
            logger.error(error_msg, exc_info=True)
            errores_criticos.append(error_msg)
            raise
        
        # 3. Leer cédulas desde Google Sheet
        logger.info(f"\n[PASO 3/5] Leyendo cédulas desde hoja '{source_worksheet}', columna {source_column}...")
        try:
            # Usar método batch más eficiente (usa configuración de settings)
            if source_sheet_url:
                cedulas = sheets_service.get_cedulas_batch(
                    sheet_url=source_sheet_url,
                    worksheet_name=source_worksheet,
                    column=source_column
                )
            else:
                cedulas = sheets_service.get_cedulas_batch(
                    worksheet_name=source_worksheet,
                    column=source_column
                )
            
            estadisticas['cedulas_leidas'] = len(cedulas)
            logger.info(f"✓ {len(cedulas)} cédulas encontradas")
            
            if not cedulas:
                raise ValueError(f"No se encontraron cédulas en la hoja '{source_worksheet}'")
            
        except Exception as e:
            error_msg = f"Error leyendo cédulas: {e}"
            logger.error(error_msg, exc_info=True)
            errores_criticos.append(error_msg)
            raise
        
        # 4. Preparar hoja del período
        logger.info(f"\n[PASO 4/5] Preparando hoja para período {target_period}...")
        try:
            if target_sheet_url:
                period_manager.prepare_single_period_sheet(
                    sheet_url=target_sheet_url,
                    period=target_period
                )
            else:
                period_manager.prepare_single_period_sheet(
                    period=target_period
                )
            logger.info(f"✓ Hoja del período {target_period} preparada")
        except Exception as e:
            error_msg = f"Error preparando hoja: {e}"
            logger.error(error_msg, exc_info=True)
            errores_criticos.append(error_msg)
            raise
        
        # 5. Obtener ID del período objetivo
        logger.info(f"\n[PASO 5/7] Obteniendo ID del período {target_period}...")
        try:
            logger.info("Obteniendo períodos disponibles desde el sistema...")
            periodos_disponibles = scraper.obtener_periodos_disponibles()
            logger.info(f"✓ {len(periodos_disponibles)} períodos disponibles en el sistema")
            
            # Buscar ID del período objetivo
            periodo_match = next(
                (p for p in periodos_disponibles if p['label'] == target_period),
                None
            )
            
            if not periodo_match:
                raise ValueError(
                    f"No se encontró el período {target_period} en el sistema. "
                    f"Períodos disponibles: {[p['label'] for p in periodos_disponibles[:10]]}"
                )
            
            periodo_id = periodo_match['idPeriod']
            logger.info(f"✓ Período {target_period} → ID: {periodo_id}")
            
        except Exception as e:
            error_msg = f"Error obteniendo ID del período: {e}"
            logger.error(error_msg, exc_info=True)
            errores_criticos.append(error_msg)
            raise
        
        # 6. Scrapear cada cédula para el período objetivo
        logger.info(f"\n[PASO 6/7] Scrapeando {len(cedulas)} cédulas para período {target_period}...")
        
        # Acumulador de actividades para el período
        actividades_periodo: List[Dict[str, Any]] = []
        
        # Procesar cada cédula con barra de progreso
        cedulas_procesadas = []
        errores_cedulas = []
        
        iterador_cedulas = tqdm(
            cedulas,
            desc=f"Scrapeando cédulas para {target_period}",
            unit="cedula",
            disable=not HAS_TQDM
        )
        
        for cedula in iterador_cedulas:
            if HAS_TQDM:
                iterador_cedulas.set_description(f"Scrapeando {cedula} - {target_period}")
            
            cedula_limpia = limpiar_cedula(cedula)
            errores_cedula = []
            
            try:
                logger.debug(f"Scrapeando {cedula_limpia} para período {target_period} (ID: {periodo_id})")
                actividades_cedula = scraper.scrape_teacher_data(
                    cedula_limpia,
                    id_periodo=periodo_id,
                    max_retries=3,
                    delay_min=0.5,
                    delay_max=1.0
                )
                
                # Asegurar que todas las actividades tengan el período correcto
                for actividad in actividades_cedula:
                    if not actividad.get('periodo') or actividad.get('periodo') != target_period:
                        actividad['periodo'] = target_period
                
                if actividades_cedula:
                    actividades_periodo.extend(actividades_cedula)
                    estadisticas['total_actividades'] += len(actividades_cedula)
                    estadisticas['cedulas_procesadas'] += 1
                    logger.info(f"✓ {cedula_limpia}: {len(actividades_cedula)} actividades extraídas")
                else:
                    logger.warning(f"⚠️ {cedula_limpia}: No se encontraron actividades para período {target_period}")
                
                cedulas_procesadas.append(cedula_limpia)
                
            except Exception as e:
                error_msg = f"Error procesando {cedula_limpia}: {e}"
                logger.error(error_msg, exc_info=True)
                errores_cedula.append(str(e))
                estadisticas['errores_por_cedula'][cedula_limpia] = errores_cedula
                errores_cedulas.append(cedula_limpia)
                estadisticas['cedulas_con_error'] += 1
            
            # Delay entre cédulas
            if delay_entre_cedulas > 0:
                time.sleep(delay_entre_cedulas)
        
        logger.info(f"\n✓ Scraping completado: {estadisticas['cedulas_procesadas']} exitosas, {estadisticas['cedulas_con_error']} con errores")
        
        # 7. Escribir datos en batch
        logger.info(f"\n[PASO 7/7] Escribiendo datos en hoja del período {target_period}...")
        
        if not actividades_periodo:
            logger.warning("⚠️ No hay actividades para escribir")
        else:
            try:
                escribir_actividades_en_hojas(
                    sheets_service,
                    {target_period: actividades_periodo},
                    logger
                )
                logger.info(f"✓ Período {target_period}: {len(actividades_periodo)} actividades escritas")
            except Exception as e:
                error_msg = f"Error escribiendo período {target_period}: {e}"
                logger.error(error_msg, exc_info=True)
                errores_criticos.append(error_msg)
        
        # 7. Resumen final
        tiempo_total = time.time() - inicio_total
        logger.info(f"\n[PASO 7/7] Generando resumen final...")
        
        logger.info("="*80)
        logger.info("RESUMEN FINAL")
        logger.info("="*80)
        logger.info(f"Período procesado: {target_period}")
        logger.info(f"Tiempo total de ejecución: {tiempo_total:.2f} segundos ({tiempo_total/60:.2f} minutos)")
        logger.info(f"Cédulas leídas: {estadisticas['cedulas_leidas']}")
        logger.info(f"Cédulas procesadas exitosamente: {estadisticas['cedulas_procesadas']}")
        logger.info(f"Cédulas con errores: {estadisticas['cedulas_con_error']}")
        logger.info(f"Total actividades extraídas: {estadisticas['total_actividades']}")
        logger.info(f"Actividades para período {target_period}: {len(actividades_periodo)}")
        
        # Errores
        if estadisticas['errores_por_cedula']:
            logger.warning(f"\nErrores por cédula ({len(estadisticas['errores_por_cedula'])}):")
            for cedula, errores in list(estadisticas['errores_por_cedula'].items())[:10]:  # Mostrar solo primeros 10
                logger.warning(f"  {cedula}: {errores[0] if errores else 'Error desconocido'}")
            if len(estadisticas['errores_por_cedula']) > 10:
                logger.warning(f"  ... y {len(estadisticas['errores_por_cedula']) - 10} más")
        
        # Notificaciones si hay errores críticos
        if errores_criticos or estadisticas['cedulas_con_error'] > 0:
            enviar_notificacion(errores_criticos, logger)
        
        logger.info("="*80)
        logger.info(f"Fin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("="*80)
        
        return {
            'exito': True,
            'estadisticas': estadisticas,
            'errores_criticos': errores_criticos,
            'tiempo_total': tiempo_total
        }
        
    except Exception as e:
        tiempo_total = time.time() - inicio_total
        error_msg = f"Error fatal en flujo completo: {e}"
        logger.error(error_msg, exc_info=True)
        errores_criticos.append(error_msg)
        enviar_notificacion(errores_criticos, logger)
        
        return {
            'exito': False,
            'estadisticas': estadisticas,
            'errores_criticos': errores_criticos,
            'tiempo_total': tiempo_total,
            'error': str(e)
        }


def main():
    """Función principal del orquestador."""
    configurar_logging()
    logger = logging.getLogger(__name__)
    
    parser = argparse.ArgumentParser(
        description='Scraper de datos académicos del portal Univalle - Flujo completo'
    )
    
    parser.add_argument(
        '--modo',
        type=str,
        choices=['completo', 'individual', 'archivo'],
        default='completo',
        help='Modo de ejecución: completo (default), individual, archivo'
    )
    
    # Argumentos para flujo completo
    parser.add_argument(
        '--source-sheet-url',
        type=str,
        help='URL de la hoja fuente con cédulas (opcional, usa hoja por defecto si no se especifica)'
    )
    
    parser.add_argument(
        '--source-worksheet',
        type=str,
        default='2025-2',
        help='Nombre de la hoja fuente (default: "2025-2")'
    )
    
    parser.add_argument(
        '--source-column',
        type=str,
        default='D',
        help='Columna de cédulas en hoja fuente (default: "D")'
    )
    
    parser.add_argument(
        '--target-sheet-url',
        type=str,
        help='URL de la hoja destino para escribir datos (opcional, usa hoja por defecto si no se especifica)'
    )
    
    parser.add_argument(
        '--target-period',
        type=str,
        default=None,
        help='Período objetivo a procesar (ej: "2026-1"). Si no se especifica, usa TARGET_PERIOD de variable de entorno'
    )
    
    parser.add_argument(
        '--delay-cedulas',
        type=float,
        default=1.0,
        help='Delay entre cédulas en segundos (default: 1.0)'
    )
    
    # Argumentos para modo individual
    parser.add_argument(
        '--cedula',
        type=str,
        help='Cédula del docente a procesar (modo individual)'
    )
    
    parser.add_argument(
        '--periodos',
        type=int,
        default=8,
        help='Número de períodos a procesar (default: 8)'
    )
    
    parser.add_argument(
        '--cedulas-archivo',
        type=str,
        help='Ruta a archivo con lista de cédulas (modo archivo)'
    )
    
    parser.add_argument(
        '--crear-hojas',
        action='store_true',
        help='Crear estructura de hojas antes de procesar'
    )
    
    parser.add_argument(
        '--limpiar-hojas',
        action='store_true',
        help='Limpiar hojas existentes antes de procesar'
    )
    
    args = parser.parse_args()
    
    try:
        # Validar configuración
        validate_config()
        logger.info("✓ Configuración validada correctamente")
        
        # Inicializar servicios
        scraper = UnivalleScraper()
        sheets_service = SheetsService()
        period_manager = PeriodManager(sheets_service, scraper)
        
        # Ejecutar según modo
        if args.modo == 'completo':
            logger.info("Ejecutando flujo completo...")
            resultado = flujo_completo(
                source_sheet_url=args.source_sheet_url,
                source_worksheet=args.source_worksheet,
                source_column=args.source_column,
                target_sheet_url=args.target_sheet_url,
                target_period=args.target_period,
                delay_entre_cedulas=args.delay_cedulas
            )
            
            if not resultado['exito']:
                sys.exit(1)
        
        elif args.modo == 'individual':
            # Modo individual (mantener compatibilidad)
            if not args.cedula:
                parser.error("--cedula es requerido en modo individual")
            
            periodos = period_manager.obtener_ultimos_n_periodos(args.periodos)
            resultado = procesar_docente(scraper, sheets_service, args.cedula, periodos)
            
            logger.info("Procesamiento completado:")
            logger.info(f"  Períodos procesados: {len(resultado['periodos_procesados'])}")
            logger.info(f"  Errores: {len(resultado['errores'])}")
        
        elif args.modo == 'archivo':
            # Modo archivo (mantener compatibilidad)
            if not args.cedulas_archivo:
                parser.error("--cedulas-archivo es requerido en modo archivo")
            
            with open(args.cedulas_archivo, 'r', encoding='utf-8') as f:
                cedulas = [line.strip() for line in f if line.strip()]
            
            periodos = period_manager.obtener_ultimos_n_periodos(args.periodos)
            
            resultados_totales = {
                'exitosos': 0,
                'errores': 0,
                'detalles': []
            }
            
            for cedula in tqdm(cedulas, desc="Procesando cédulas", disable=not HAS_TQDM):
                try:
                    resultado = procesar_docente(scraper, sheets_service, cedula, periodos)
                    resultados_totales['exitosos'] += 1
                    resultados_totales['detalles'].append(resultado)
                except Exception as e:
                    logger.error(f"Error procesando {cedula}: {e}", exc_info=True)
                    resultados_totales['errores'] += 1
            
            logger.info("Procesamiento masivo completado:")
            logger.info(f"  Exitosos: {resultados_totales['exitosos']}")
            logger.info(f"  Errores: {resultados_totales['errores']}")
        
        logger.info("✓ Proceso completado exitosamente")
        
    except KeyboardInterrupt:
        logger.warning("\n⚠️ Proceso interrumpido por el usuario")
        sys.exit(130)
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()

