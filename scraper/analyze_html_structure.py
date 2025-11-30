"""
Script para analizar la estructura HTML de las tablas de actividades
Analiza archivos HTML guardados o HTML obtenido directamente
"""

import re
import sys
from pathlib import Path

# Ajustar imports según dónde se ejecute
try:
    from scraper.services.univalle_scraper import UnivalleScraper
except ImportError:
    # Si se ejecuta desde scraper/, usar imports relativos
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from scraper.services.univalle_scraper import UnivalleScraper

def analizar_tabla_actividades(html: str):
    """Analiza la estructura de la tabla de actividades."""
    print("\n" + "="*80)
    print("ANÁLISIS DE TABLA DE ACTIVIDADES")
    print("="*80)
    
    # Buscar todas las tablas
    table_pattern = r'<table[^>]*>[\s\S]*?</table>'
    tablas = re.findall(table_pattern, html, re.IGNORECASE)
    
    print(f"\n📊 Total de tablas encontradas: {len(tablas)}\n")
    
    # Buscar tabla de asignaturas (tiene CODIGO, NOMBRE DE ASIGNATURA, HORAS)
    tabla_asignaturas = None
    tabla_info_personal = None
    
    for i, tabla in enumerate(tablas):
        tabla_upper = tabla.upper()
        
        # Identificar tabla de asignaturas
        tiene_codigo = 'CODIGO' in tabla_upper and 'ESTUDIANTE' not in tabla_upper
        tiene_nombre_asignatura = 'NOMBRE' in tabla_upper and 'ASIGNATURA' in tabla_upper
        tiene_horas = 'HORAS' in tabla_upper or 'SEMESTRE' in tabla_upper
        
        if tiene_codigo and tiene_nombre_asignatura and tiene_horas:
            tabla_asignaturas = tabla
            print(f"✅ Tabla de ASIGNATURAS encontrada (tabla #{i+1})")
        
        # Identificar tabla de información personal
        tiene_cedula = 'CEDULA' in tabla_upper or 'DOCUMENTO' in tabla_upper
        tiene_apellido = 'APELLIDO' in tabla_upper or 'NOMBRE' in tabla_upper
        tiene_vinculacion = 'VINCULACION' in tabla_upper or 'VINCULACIÓN' in tabla_upper
        
        if tiene_cedula and tiene_apellido:
            tabla_info_personal = tabla
            print(f"✅ Tabla de INFORMACIÓN PERSONAL encontrada (tabla #{i+1})")
    
    # Analizar tabla de asignaturas
    if tabla_asignaturas:
        print("\n" + "-"*80)
        print("ESTRUCTURA DE TABLA DE ASIGNATURAS")
        print("-"*80)
        
        # Extraer filas
        row_pattern = r'<tr[^>]*>([\s\S]*?)</tr>'
        filas = re.findall(row_pattern, tabla_asignaturas, re.IGNORECASE)
        
        if len(filas) > 0:
            # Analizar header (primera fila)
            header_row = filas[0]
            cell_pattern = r'<t[dh][^>]*>([\s\S]*?)</t[dh]>'
            headers = re.findall(cell_pattern, header_row, re.IGNORECASE)
            
            # Limpiar headers
            headers_limpios = []
            for h in headers:
                texto = re.sub(r'<[^>]+>', '', h).strip()
                texto = texto.replace('&nbsp;', ' ').replace('\n', ' ').strip()
                headers_limpios.append(texto)
            
            print(f"\n📋 HEADERS ENCONTRADOS ({len(headers_limpios)} columnas):")
            print("-" * 80)
            for idx, header in enumerate(headers_limpios):
                print(f"  Columna {idx}: '{header}'")
            
            # Analizar fila de datos (segunda fila si existe)
            if len(filas) > 1:
                data_row = filas[1]
                cells = re.findall(cell_pattern, data_row, re.IGNORECASE)
                
                # Limpiar celdas
                celdas_limpias = []
                for c in cells:
                    texto = re.sub(r'<[^>]+>', '', c).strip()
                    texto = texto.replace('&nbsp;', ' ').replace('\n', ' ').strip()
                    celdas_limpias.append(texto)
                
                print(f"\n📊 DATOS DE PRIMERA FILA ({len(celdas_limpias)} celdas):")
                print("-" * 80)
                for idx, (header, valor) in enumerate(zip(headers_limpios, celdas_limpias)):
                    print(f"  Columna {idx} ({header}): '{valor}'")
                
                # Mapeo específico
                print(f"\n🗺️  MAPEO COLUMNA → CAMPO:")
                print("-" * 80)
                
                # Buscar columna de código
                codigo_idx = -1
                nombre_idx = -1
                horas_idx = -1
                
                for idx, header in enumerate(headers_limpios):
                    header_upper = header.upper()
                    if 'CODIGO' in header_upper and 'ESTUDIANTE' not in header_upper:
                        codigo_idx = idx
                        print(f"  Columna {idx}: CODIGO → '{celdas_limpias[idx]}'")
                    elif 'NOMBRE' in header_upper and 'ASIGNATURA' in header_upper:
                        nombre_idx = idx
                        print(f"  Columna {idx}: NOMBRE DE ASIGNATURA → '{celdas_limpias[idx]}'")
                    elif ('HORAS' in header_upper and 'SEMESTRE' in header_upper) or \
                         (header_upper == 'HORAS SEMESTRE') or \
                         ('HORAS' in header_upper and 'TOTAL' not in header_upper and 'PORC' not in header_upper):
                        horas_idx = idx
                        print(f"  Columna {idx}: HORAS SEMESTRE → '{celdas_limpias[idx]}'")
                    elif 'PORC' in header_upper:
                        print(f"  Columna {idx}: PORC (porcentaje) → '{celdas_limpias[idx]}' ⚠️ NO es horas")
                
                # Mostrar fragmento HTML de la fila
                print(f"\n📄 FRAGMENTO HTML DE FILA DE ACTIVIDAD:")
                print("-" * 80)
                # Limitar tamaño del fragmento
                fragmento = data_row[:2000] if len(data_row) > 2000 else data_row
                print(fragmento)
                if len(data_row) > 2000:
                    print("... (truncado)")
    
    # Analizar tabla de información personal
    if tabla_info_personal:
        print("\n" + "-"*80)
        print("ESTRUCTURA DE TABLA DE INFORMACIÓN PERSONAL")
        print("-" * 80)
        
        # Extraer filas
        row_pattern = r'<tr[^>]*>([\s\S]*?)</tr>'
        filas = re.findall(row_pattern, tabla_info_personal, re.IGNORECASE)
        
        print(f"\n📋 Total de filas: {len(filas)}\n")
        
        # Buscar CARGO y DEPARTAMENTO
        cargo_encontrado = False
        departamento_encontrado = False
        
        for i, fila in enumerate(filas):
            fila_upper = fila.upper()
            
            if 'CARGO' in fila_upper:
                cargo_encontrado = True
                print(f"✅ CARGO encontrado en fila {i+1}")
                # Extraer celdas
                cell_pattern = r'<t[dh][^>]*>([\s\S]*?)</t[dh]>'
                cells = re.findall(cell_pattern, fila, re.IGNORECASE)
                celdas_limpias = [re.sub(r'<[^>]+>', '', c).strip().replace('&nbsp;', ' ') for c in cells]
                print(f"   Celdas: {celdas_limpias[:5]}")  # Primeras 5
                
                # Mostrar fragmento
                fragmento = fila[:1000] if len(fila) > 1000 else fila
                print(f"\n📄 Fragmento HTML:")
                print(fragmento)
                if len(fila) > 1000:
                    print("... (truncado)")
            
            if 'DEPARTAMENTO' in fila_upper or 'DPTO' in fila_upper:
                departamento_encontrado = True
                print(f"\n✅ DEPARTAMENTO encontrado en fila {i+1}")
                # Extraer celdas
                cell_pattern = r'<t[dh][^>]*>([\s\S]*?)</t[dh]>'
                cells = re.findall(cell_pattern, fila, re.IGNORECASE)
                celdas_limpias = [re.sub(r'<[^>]+>', '', c).strip().replace('&nbsp;', ' ') for c in cells]
                print(f"   Celdas: {celdas_limpias[:5]}")  # Primeras 5
                
                # Mostrar fragmento
                fragmento = fila[:1000] if len(fila) > 1000 else fila
                print(f"\n📄 Fragmento HTML:")
                print(fragmento)
                if len(fila) > 1000:
                    print("... (truncado)")
        
        if not cargo_encontrado:
            print("⚠️ CARGO no encontrado en tabla de información personal")
        if not departamento_encontrado:
            print("⚠️ DEPARTAMENTO no encontrado en tabla de información personal")
        
        # Buscar en texto plano del HTML completo
        print(f"\n🔍 Buscando CARGO y DEPARTAMENTO en texto plano del HTML...")
        html_upper = html.upper()
        
        # Buscar patrones como "CARGO=valor" o "CARGO: valor"
        cargo_patterns = [
            r'CARGO\s*[=:]\s*([^\s,<>&"\']+)',
            r'CARGO[^=]*[=:]\s*([^\s,<>&"\']+)',
        ]
        
        for pattern in cargo_patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            if matches:
                print(f"✅ CARGO encontrado en texto plano: {matches[0]}")
                break
        
        depto_patterns = [
            r'DEPARTAMENTO\s*[=:]\s*([^\s,<>&"\']+)',
            r'DPTO\s*[=:]\s*([^\s,<>&"\']+)',
            r'DEPARTAMENTO[^=]*[=:]\s*([^\s,<>&"\']+)',
        ]
        
        for pattern in depto_patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            if matches:
                print(f"✅ DEPARTAMENTO encontrado en texto plano: {matches[0]}")
                break

def main():
    """Función principal."""
    debug_dir = Path(__file__).parent / "debug_html"
    
    # Verificar si hay archivos HTML guardados
    html_files = list(debug_dir.glob("*.html")) if debug_dir.exists() else []
    
    if html_files:
        print(f"📁 Archivos HTML encontrados: {len(html_files)}")
        for i, f in enumerate(html_files, 1):
            print(f"  {i}. {f.name}")
        
        # Usar el primer archivo
        archivo = html_files[0]
        print(f"\n📖 Analizando: {archivo.name}\n")
        
        with open(archivo, 'r', encoding='utf-8', errors='ignore') as f:
            html = f.read()
        
        analizar_tabla_actividades(html)
        
    else:
        print("⚠️ No se encontraron archivos HTML guardados.")
        print("\nOpciones:")
        print("1. Ejecutar scraper para obtener HTML")
        print("2. Proporcionar ruta a archivo HTML")
        
        opcion = input("\n¿Desea obtener HTML ahora? (s/n): ").strip().lower()
        
        if opcion == 's':
            cedula = input("Ingrese cédula del docente: ").strip()
            if not cedula:
                print("❌ Se requiere una cédula")
                return
            
            periodo = input("Ingrese ID del período (o Enter para más reciente): ").strip()
            id_periodo = None
            
            if periodo:
                try:
                    id_periodo = int(periodo)
                except ValueError:
                    print("⚠️ ID inválido, usando período más reciente")
            
            scraper = UnivalleScraper()
            
            if not id_periodo:
                try:
                    periodos = scraper.obtener_periodos_disponibles()
                    if periodos:
                        id_periodo = periodos[0]['idPeriod']
                        print(f"📅 Usando período: {periodos[0]['label']} (ID: {id_periodo})")
                except Exception as e:
                    print(f"❌ Error: {e}")
                    return
            
            try:
                html = scraper.obtener_html(cedula, id_periodo)
                analizar_tabla_actividades(html)
            except Exception as e:
                print(f"❌ Error al obtener HTML: {e}")
        else:
            ruta = input("Ingrese ruta al archivo HTML: ").strip()
            if ruta and Path(ruta).exists():
                with open(ruta, 'r', encoding='utf-8', errors='ignore') as f:
                    html = f.read()
                analizar_tabla_actividades(html)
            else:
                print("❌ Archivo no encontrado")

if __name__ == "__main__":
    main()

