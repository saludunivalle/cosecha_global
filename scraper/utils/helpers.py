"""
Funciones auxiliares para el scraper
"""

import re
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


def validar_cedula(cedula: str) -> bool:
    """
    Valida formato de cédula colombiana.
    
    Args:
        cedula: Número de cédula a validar
        
    Returns:
        True si la cédula es válida
    """
    if not cedula:
        return False
    
    # Remover espacios, puntos y guiones
    cedula_limpia = re.sub(r'[\s.\-]', '', cedula)
    
    # Debe ser numérica y tener entre 7 y 10 dígitos
    if not cedula_limpia.isdigit():
        return False
    
    if len(cedula_limpia) < 7 or len(cedula_limpia) > 10:
        return False
    
    return True


def limpiar_cedula(cedula: str) -> str:
    """
    Limpia una cédula removiendo espacios, puntos y guiones.
    
    Args:
        cedula: Cédula a limpiar
        
    Returns:
        Cédula limpia
    """
    if not cedula:
        return ''
    
    return re.sub(r'[\s.\-]', '', str(cedula))


def normalizar_texto(texto: str) -> str:
    """
    Normaliza texto removiendo espacios extra y caracteres especiales.
    
    Args:
        texto: Texto a normalizar
        
    Returns:
        Texto normalizado
    """
    if not texto:
        return ''
    
    # Remover espacios múltiples
    texto = ' '.join(texto.split())
    
    # Remover caracteres de control
    texto = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', texto)
    
    return texto.strip()


def limpiar_departamento(departamento: str) -> str:
    """
    Limpia el nombre del departamento removiendo prefijos comunes.
    
    Ejemplos:
        "DEPARTAMENTO MEDICINA INTERNA" -> "MEDICINA INTERNA"
        "DEPARTAMENTO DE CIRUGIA" -> "CIRUGIA"
        "ESCUELA DE MEDICINA" -> "MEDICINA"
    
    Args:
        departamento: Nombre del departamento a limpiar
        
    Returns:
        Nombre del departamento limpio (sin prefijo)
    """
    if not departamento:
        return ''
    
    # Normalizar primero
    dept = departamento.strip().upper()
    
    # Patrones a remover del inicio
    prefijos = [
        r'^DEPARTAMENTO\s+DE\s+',
        r'^DEPARTAMENTO\s+',
        r'^DEPTO\.\s*DE\s+',
        r'^DEPTO\s+DE\s+',
        r'^DEPTO\.\s*',
        r'^DEPTO\s+',
        r'^ESCUELA\s+DE\s+',
        r'^ESCUELA\s+',
        r'^FACULTAD\s+DE\s+',
    ]
    
    for prefijo in prefijos:
        dept = re.sub(prefijo, '', dept, flags=re.IGNORECASE)
    
    # Limpiar espacios múltiples
    dept = ' '.join(dept.split())
    
    return dept.strip()


def formatear_nombre_completo(
    nombre: str = '',
    apellido1: str = '',
    apellido2: str = ''
) -> str:
    """
    Formatea nombre completo combinando nombre y apellidos.
    
    Args:
        nombre: Nombre del docente
        apellido1: Primer apellido
        apellido2: Segundo apellido
        
    Returns:
        Nombre completo formateado
    """
    partes = [p for p in [nombre, apellido1, apellido2] if p and p.strip()]
    return ' '.join(partes) if partes else 'No disponible'


def parsear_horas(horas_str: str) -> float:
    """
    Parsea string de horas a float.
    
    Args:
        horas_str: String con número de horas
        
    Returns:
        Número de horas como float, 0.0 si no se puede parsear
    """
    if not horas_str:
        return 0.0
    
    # Remover espacios y caracteres no numéricos (excepto punto y coma)
    horas_limpia = re.sub(r'[^\d.,]', '', str(horas_str))
    
    # Reemplazar coma por punto
    horas_limpia = horas_limpia.replace(',', '.')
    
    try:
        return float(horas_limpia)
    except (ValueError, TypeError):
        logger.warning(f"No se pudo parsear horas: {horas_str}")
        return 0.0


def validar_periodo_id(periodo_id: Any) -> bool:
    """
    Valida que un ID de período sea numérico válido.
    
    Args:
        periodo_id: ID del período a validar
        
    Returns:
        True si es válido
    """
    try:
        periodo_int = int(periodo_id)
        return periodo_int > 0
    except (ValueError, TypeError):
        return False


def generar_id_actividad(actividad: Dict[str, Any]) -> str:
    """
    Genera un ID único para una actividad basado en sus campos clave.
    
    Args:
        actividad: Diccionario con datos de la actividad
        
    Returns:
        ID único en formato: codigo|nombre|grupo|tipo
    """
    codigo = str(actividad.get('CODIGO', '')).strip()
    nombre = str(actividad.get('NOMBRE DE ASIGNATURA', '')).strip()
    grupo = str(actividad.get('GRUPO', '')).strip()
    tipo = str(actividad.get('TIPO', '')).strip()
    
    return f"{codigo}|{nombre}|{grupo}|{tipo}".lower()


def deduplicar_actividades(actividades: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Elimina actividades duplicadas de una lista.
    
    Args:
        actividades: Lista de actividades
        
    Returns:
        Lista sin duplicados
    """
    if not actividades:
        return []
    
    vistos = set()
    actividades_unicas = []
    
    for actividad in actividades:
        actividad_id = generar_id_actividad(actividad)
        
        # Si el ID está vacío, mantener la actividad
        if actividad_id in ('|||', ''):
            actividades_unicas.append(actividad)
            continue
        
        # Solo agregar si no se ha visto antes
        if actividad_id not in vistos:
            vistos.add(actividad_id)
            actividades_unicas.append(actividad)
    
    return actividades_unicas


def sanitizar_valor_hoja(valor: Any) -> str:
    """
    Sanitiza un valor para ser guardado en Google Sheets.
    
    Args:
        valor: Valor a sanitizar
        
    Returns:
        String sanitizado
    """
    if valor is None:
        return ''
    
    if isinstance(valor, (int, float)):
        return str(valor)
    
    if isinstance(valor, str):
        # Limitar longitud (Google Sheets tiene límite por celda)
        valor = valor[:50000]
        # Remover caracteres problemáticos
        valor = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', valor)
        return valor
    
    return str(valor)


def parsear_periodo_label(label: str) -> Optional[Dict[str, int]]:
    """
    Parsea un label de período (ej: "2026-1") a año y término.
    
    Args:
        label: Label del período (ej: "2026-1", "2025-2")
        
    Returns:
        Diccionario con 'year' y 'term', o None si no se puede parsear
    """
    if not label:
        return None
    
    # Buscar patrón YYYY-N o YYYY - N
    match = re.search(r'(\d{4})\s*[-\s]\s*0?([12])\b', label)
    
    if match:
        year = int(match.group(1))
        term = int(match.group(2))
        return {'year': year, 'term': term}
    
    return None


def extraer_periodo_desde_texto(texto: str) -> Optional[str]:
    """
    Extrae período desde texto (ej: "2026-1", "2025-2").
    
    Args:
        texto: Texto que puede contener un período
        
    Returns:
        String del período (ej: "2026-1") o None
    """
    if not texto:
        return None
    
    match = re.search(r'(\d{4})\s*[-\s]\s*0?([12])\b', texto)
    
    if match:
        year = match.group(1)
        term = match.group(2)
        return f"{year}-{term}"
    
    return None

