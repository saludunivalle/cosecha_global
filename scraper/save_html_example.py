"""
Script para guardar HTML de ejemplo para análisis
Ejecuta el scraper y guarda el HTML en scraper/debug_html/
"""

import os
import sys
from pathlib import Path
from scraper.services.univalle_scraper import UnivalleScraper
from scraper.config.settings import UNIVALLE_ENDPOINT

# Crear directorio si no existe
debug_dir = Path(__file__).parent / "debug_html"
debug_dir.mkdir(exist_ok=True)

def save_html_example(cedula: str, id_periodo: int):
    """Guarda HTML de ejemplo para análisis."""
    scraper = UnivalleScraper()
    
    print(f"Obteniendo HTML para cédula {cedula}, período {id_periodo}...")
    
    try:
        html = scraper.obtener_html(cedula, id_periodo)
        
        # Guardar HTML
        filename = f"cedula_{cedula}_periodo_{id_periodo}.html"
        filepath = debug_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"✅ HTML guardado en: {filepath}")
        print(f"   Tamaño: {len(html)} caracteres")
        
        return str(filepath)
        
    except Exception as e:
        print(f"❌ Error al obtener HTML: {e}")
        return None

if __name__ == "__main__":
    # Usar cédula de ejemplo (cambiar por una real)
    cedula = input("Ingrese cédula del docente: ").strip()
    periodo = input("Ingrese ID del período (o Enter para usar más reciente): ").strip()
    
    if not cedula:
        print("❌ Se requiere una cédula")
        sys.exit(1)
    
    id_periodo = None
    if periodo:
        try:
            id_periodo = int(periodo)
        except ValueError:
            print("⚠️ ID de período inválido, usando período más reciente")
    
    if not id_periodo:
        scraper = UnivalleScraper()
        try:
            periodos = scraper.obtener_periodos_disponibles()
            if periodos:
                id_periodo = periodos[0]['idPeriod']
                print(f"📅 Usando período más reciente: {periodos[0]['label']} (ID: {id_periodo})")
            else:
                print("❌ No se pudieron obtener períodos")
                sys.exit(1)
        except Exception as e:
            print(f"❌ Error al obtener períodos: {e}")
            sys.exit(1)
    
    save_html_example(cedula, id_periodo)

