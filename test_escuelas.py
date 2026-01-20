"""Script de prueba para verificar el mapeo de escuelas"""

import sys
from pathlib import Path

# Agregar el directorio padre al path
sys.path.insert(0, str(Path(__file__).parent))

from scraper.utils.helpers import determinar_escuela_desde_departamento, limpiar_escuela, limpiar_departamento

# Casos de prueba
casos_prueba_departamentos = [
    # Departamentos que deben mapearse a Ciencias Básicas
    ("Ciencias Fisiológicas", "Ciencias Básicas"),
    ("MICROBIOLOGIA", "Ciencias Básicas"),
    ("Morfología", "Ciencias Básicas"),
    
    # Departamentos que deben mapearse a Medicina
    ("Cirugía", "Medicina"),
    ("Medicina Interna", "Medicina"),
    ("Medicina Familiar", "Medicina"),
    ("Medicina Física y Rehabilitación", "Medicina"),
    ("Psiquiatría", "Medicina"),
    ("Patología", "Medicina"),
    ("Anestesiología", "Medicina"),
    ("Obstetricia y Ginecología", "Medicina"),
    ("Pediatría", "Medicina"),
]

casos_prueba_escuelas = [
    # Escuelas que deben normalizarse
    ("REHABILITACION HUMA", "Rehabilitación Humana"),
    ("BACTERIOLOGIA Y LABORA", "Bacteriología y Lab. Clínico"),
]

print("="*80)
print("PRUEBAS DE MAPEO DE ESCUELAS")
print("="*80)
print()

# Probar departamentos -> escuelas
print("1. MAPEO DE DEPARTAMENTOS A ESCUELAS")
print("-" * 80)
for departamento, escuela_esperada in casos_prueba_departamentos:
    departamento_limpio = limpiar_departamento(departamento)
    escuela_obtenida = determinar_escuela_desde_departamento(departamento_limpio)
    resultado = "✓ PASS" if escuela_obtenida == escuela_esperada else "✗ FAIL"
    print(f"{resultado} | {departamento:35} -> {escuela_obtenida:30} (esperado: {escuela_esperada})")

print()
print("2. NORMALIZACIÓN DE NOMBRES DE ESCUELAS")
print("-" * 80)
for escuela_raw, escuela_esperada in casos_prueba_escuelas:
    escuela_obtenida = limpiar_escuela(escuela_raw)
    resultado = "✓ PASS" if escuela_obtenida == escuela_esperada else "✗ FAIL"
    print(f"{resultado} | {escuela_raw:35} -> {escuela_obtenida:30} (esperado: {escuela_esperada})")

print()
print("="*80)
print("FIN DE PRUEBAS")
print("="*80)
