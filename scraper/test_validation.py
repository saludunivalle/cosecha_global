"""
Script para probar validaciones del scraper con 1 cédula
"""

import sys
import os
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.services.univalle_scraper import UnivalleScraper
import logging

# Configurar logging detallado
log_file = Path(__file__).parent / 'test_validation.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)

def test_scraper_validation(cedula: str, periodo: int = None):
    """Prueba el scraper con validaciones."""
    logger.info("="*80)
    logger.info("PRUEBA DE VALIDACIONES DEL SCRAPER")
    logger.info("="*80)
    
    scraper = UnivalleScraper()
    
    try:
        logger.info(f"\n📋 Probando con cédula: {cedula}")
        if periodo:
            logger.info(f"📅 Período: {periodo}")
        else:
            logger.info("📅 Período: Más reciente (automático)")
        
        actividades = scraper.scrape_teacher_data(
            cedula=cedula,
            id_periodo=periodo,
            max_retries=3
        )
        
        logger.info(f"\n✅ Scraping completado: {len(actividades)} actividades extraídas")
        
        # Resumen de actividades
        if actividades:
            logger.info("\n📊 RESUMEN DE ACTIVIDADES:")
            logger.info("-" * 80)
            
            tipos_actividad = {}
            for act in actividades:
                tipo = act.get('tipo_actividad', 'Desconocido')
                tipos_actividad[tipo] = tipos_actividad.get(tipo, 0) + 1
            
            for tipo, cantidad in tipos_actividad.items():
                logger.info(f"  {tipo}: {cantidad} actividades")
            
            # Mostrar primera actividad como ejemplo
            logger.info("\n📄 EJEMPLO DE PRIMERA ACTIVIDAD:")
            logger.info("-" * 80)
            primera = actividades[0]
            for key, value in primera.items():
                logger.info(f"  {key}: {value}")
        
        return actividades
        
    except Exception as e:
        logger.error(f"❌ Error durante el scraping: {e}", exc_info=True)
        return None

if __name__ == "__main__":
    # Cédula de prueba (usar una real)
    cedula_prueba = input("Ingrese cédula del docente a probar: ").strip()
    
    if not cedula_prueba:
        print("❌ Se requiere una cédula")
        sys.exit(1)
    
    periodo_input = input("Ingrese ID del período (o Enter para más reciente): ").strip()
    periodo = None
    
    if periodo_input:
        try:
            periodo = int(periodo_input)
        except ValueError:
            print("⚠️ ID de período inválido, usando más reciente")
    
    print(f"\n🚀 Iniciando prueba de validaciones...")
    print(f"📝 Los logs se guardarán en: scraper/test_validation.log\n")
    
    actividades = test_scraper_validation(cedula_prueba, periodo)
    
    if actividades:
        print(f"\n✅ Prueba completada: {len(actividades)} actividades extraídas")
        print("📋 Revisa los logs para ver las validaciones")
    else:
        print("\n❌ La prueba falló. Revisa los logs para más detalles")

