/**
 * Extractores de información personal
 */

import type { InformacionPersonal } from '@/shared/types/docente.types';
import { decodeEntities, extraerTextoDeCelda, debugLog } from '../utils';
import { extraerTablas, extraerFilas } from '../html-utils';
import { extractCells } from '../html-utils';

/**
 * Patrones para extraer campos desde texto plano
 */
const PATRONES_CAMPOS = [
  { 
    campo: 'VINCULACION', 
    regexes: [
      /VINCULACION\s*[=:]\s*([^\s,<>&"']+)/gi,
      /VINCULACI[OÓ]N\s*[=:]\s*([^\s,<>&"']+)/gi,
      /VINCULACION[^=]*[=:]\s*([^\s,<>&"']+)/gi,
    ]
  },
  { 
    campo: 'CATEGORIA', 
    regexes: [
      /CATEGORIA\s*[=:]\s*([^\s,<>&"']+)/gi,
      /CATEGOR[IÍ]A\s*[=:]\s*([^\s,<>&"']+)/gi,
      /CATEGORIA[^=]*[=:]\s*([^\s,<>&"']+)/gi,
    ]
  },
  { 
    campo: 'DEDICACION', 
    regexes: [
      /DEDICACION\s*[=:]\s*([^\s,<>&"']+)/gi,
      /DEDICACI[OÓ]N\s*[=:]\s*([^\s,<>&"']+)/gi,
      /DEDICACION[^=]*[=:]\s*([^\s,<>&"']+)/gi,
    ]
  },
  { 
    campo: 'NIVEL ALCANZADO', 
    regexes: [
      /NIVEL\s+ALCANZADO\s*[=:]\s*([^\s,<>&"']+)/gi,
      /NIVEL\s*ALCANZADO\s*[=:]\s*([^\s,<>&"']+)/gi,
      /NIVEL\s*ALCANZADO[^=]*[=:]\s*([^\s,<>&"']+)/gi,
    ]
  },
] as const;

/**
 * Extrae información personal desde texto plano con formato CAMPO=valor
 */
export function extraerCamposDesdeTextoPlano(
  html: string, 
  informacionPersonal: InformacionPersonal
): void {
  const htmlNormalizado = html.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  
  for (const { campo, regexes } of PATRONES_CAMPOS) {
    if (informacionPersonal[campo]) continue;
    
    for (const regex of regexes) {
      const match = htmlNormalizado.match(regex);
      if (match && match[0]) {
        const partes = match[0].split(/[=:]/);
        if (partes.length >= 2) {
          const valor = partes.slice(1).join(':').trim();
          if (valor && valor.length > 0 && valor.length < 100 && !valor.includes('<')) {
            informacionPersonal[campo] = decodeEntities(valor);
            debugLog(`   ✓ ${campo} encontrado en texto plano: ${informacionPersonal[campo]}`);
            break;
          }
        }
      }
    }
  }
}

/**
 * Extrae datos personales de la tabla según la estructura HTML real
 */
export function extraerDatosPersonalesDeHTML(
  html: string, 
  informacionPersonal: InformacionPersonal
): void {
  debugLog(`\n🔍 Buscando tabla de datos personales...`);
  
  const tableMatches = extraerTablas(html);
  if (tableMatches.length === 0) {
    debugLog(`   ⚠️ No se encontraron tablas`);
    return;
  }
  
  for (const tableHtml of tableMatches) {
    const rowMatches = extraerFilas(tableHtml);
    if (rowMatches.length < 4) continue;
    
    const primeraFila = rowMatches[0];
    const primeraFilaTexto = extraerTextoDeCelda(primeraFila).toUpperCase();
    
    if (!primeraFilaTexto.includes('CEDULA') && !primeraFilaTexto.includes('APELLIDO')) {
      continue;
    }
    
    debugLog(`   ✅ Tabla de datos personales encontrada con ${rowMatches.length} filas`);
    
    // Extraer datos de la fila 2 (índice 1): CEDULA, APELLIDOS, NOMBRE, UNIDAD
    const fila2Celdas = rowMatches[1].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (fila2Celdas && fila2Celdas.length >= 5) {
      const cedula = extraerTextoDeCelda(fila2Celdas[0]);
      const apellido1 = extraerTextoDeCelda(fila2Celdas[1]);
      const apellido2 = extraerTextoDeCelda(fila2Celdas[2]);
      const nombre = extraerTextoDeCelda(fila2Celdas[3]);
      const unidadAcademica = extraerTextoDeCelda(fila2Celdas[4]);
      
      if (cedula) {
        informacionPersonal['CEDULA'] = cedula;
        informacionPersonal['1 APELLIDO'] = apellido1;
        informacionPersonal['2 APELLIDO'] = apellido2;
        informacionPersonal['NOMBRE'] = nombre;
        informacionPersonal['UNIDAD ACADEMICA'] = unidadAcademica;
        
        debugLog(`   ✓ Datos básicos: CEDULA=${cedula}, NOMBRE=${nombre}, APELLIDOS=${apellido1} ${apellido2}`);
      }
    }
    
    // Extraer datos de la fila 4 (índice 3): VINCULACION, CATEGORIA, DEDICACION, NIVEL, CENTRO COSTO
    if (rowMatches.length >= 4) {
      const fila4Celdas = rowMatches[3].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (fila4Celdas && fila4Celdas.length >= 5) {
        const vinculacion = extraerTextoDeCelda(fila4Celdas[0]);
        const categoria = extraerTextoDeCelda(fila4Celdas[1]);
        const dedicacion = extraerTextoDeCelda(fila4Celdas[2]);
        const nivelAlcanzado = extraerTextoDeCelda(fila4Celdas[3]);
        const centroCosto = extraerTextoDeCelda(fila4Celdas[4]);
        
        if (vinculacion) informacionPersonal['VINCULACION'] = vinculacion;
        if (categoria) informacionPersonal['CATEGORIA'] = categoria;
        if (dedicacion) informacionPersonal['DEDICACION'] = dedicacion;
        if (nivelAlcanzado) informacionPersonal['NIVEL ALCANZADO'] = nivelAlcanzado;
        if (centroCosto) informacionPersonal['CENTRO COSTO'] = centroCosto;
        
        debugLog(`   ✓ Datos laborales: VINCULACION=${vinculacion}, CATEGORIA=${categoria}, DEDICACION=${dedicacion}, NIVEL=${nivelAlcanzado}`);
      }
    }
    
    return;
  }
  
  debugLog(`   ⚠️ No se encontró tabla de datos personales con la estructura esperada`);
}

