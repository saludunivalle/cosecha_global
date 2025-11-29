/**
 * Extractores para actividades intelectuales/artísticas
 */

import { debugLog, extraerTextoDeCelda } from '../utils';
import { extraerTablas, extraerFilas, buscarTablaAnidada } from '../html-utils';
import { extractCells } from '../html-utils';

/**
 * Extrae actividades intelectuales de tablas anidadas según la estructura HTML real
 */
export function extraerActividadesIntelectualesDeHTML(html: string): any[] {
  debugLog(`\n🔍 Buscando actividades intelectuales...`);
  
  const actividades: any[] = [];
  const tableMatches = extraerTablas(html);
  
  if (tableMatches.length === 0) {
    debugLog(`   ⚠️ No se encontraron tablas`);
    return actividades;
  }
  
  const tablaContenedora = buscarTablaIntelectuales(tableMatches);
  if (!tablaContenedora) {
    debugLog(`   ❌ No se encontró tabla de ACTIVIDADES INTELECTUALES`);
    return actividades;
  }
  
  const tablaInterna = buscarTablaAnidada(tablaContenedora) || tablaContenedora;
  const filas = extraerFilas(tablaInterna);
  
  if (filas.length < 2) {
    debugLog(`   ⚠️ No se encontraron suficientes filas`);
    return actividades;
  }
  
  const indiceEncabezado = encontrarIndiceEncabezadoIntelectuales(filas);
  if (indiceEncabezado === -1) {
    debugLog(`   ❌ No se encontró encabezado con "APROBADO POR"`);
    return actividades;
  }
  
  const nombresColumnas = extraerNombresColumnas(filas[indiceEncabezado]);
  const filasConDatos = filas.slice(indiceEncabezado + 1);
  
  for (const fila of filasConDatos) {
    const celdas = fila.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (!celdas || celdas.length < 2) continue;
    
    const actividad = mapearFilaAIntelectual(celdas, nombresColumnas);
    if (actividad && (actividad['TITULO'] || actividad['TIPO'])) {
      actividades.push(actividad);
      debugLog(`   ✓ Actividad intelectual extraída: "${actividad['TITULO'].substring(0, 50)}..." (APROBADO POR: ${actividad['APROBADO POR']})`);
    }
  }
  
  debugLog(`   ✅ Total actividades intelectuales extraídas: ${actividades.length}`);
  return actividades;
}

/**
 * Busca la tabla que contiene actividades intelectuales
 */
function buscarTablaIntelectuales(tableMatches: string[]): string | null {
  for (let i = 0; i < tableMatches.length; i++) {
    const tablaHtml = tableMatches[i];
    const texto = extraerTextoDeCelda(tablaHtml);
    const textoUpper = texto.toUpperCase();
    
    const tieneTitulo = textoUpper.includes('ACTIVIDADES INTELECTUALES') || 
                        textoUpper.includes('ACTIVIDADES ARTISTICAS') ||
                        textoUpper.includes('ARTÍSTICAS');
    
    if (tieneTitulo && textoUpper.includes('APROBADO POR')) {
      debugLog(`   ✅ Tabla de intelectuales encontrada (índice ${i + 1})`);
      return tablaHtml;
    }
  }
  
  return null;
}

/**
 * Encuentra el índice de la fila de encabezados
 */
function encontrarIndiceEncabezadoIntelectuales(filas: string[]): number {
  for (let i = 0; i < Math.min(10, filas.length); i++) {
    const filaTexto = extraerTextoDeCelda(filas[i]);
    if (filaTexto.toUpperCase().includes('APROBADO POR')) {
      debugLog(`   ✅ Encabezado encontrado en fila ${i + 1}`);
      return i;
    }
  }
  return -1;
}

/**
 * Extrae nombres de columnas de la fila de encabezados
 */
function extraerNombresColumnas(filaEncabezado: string): string[] {
  const celdasEncabezado = filaEncabezado.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
  const nombresColumnas: string[] = [];
  
  if (celdasEncabezado) {
    nombresColumnas.push(...celdasEncabezado.map(c => extraerTextoDeCelda(c).trim()));
    debugLog(`   📋 Columnas detectadas: ${JSON.stringify(nombresColumnas)}`);
  }
  
  return nombresColumnas;
}

/**
 * Mapea una fila de celdas a una actividad intelectual
 */
function mapearFilaAIntelectual(
  celdas: RegExpMatchArray,
  nombresColumnas: string[]
): Record<string, any> | null {
  const textos = celdas.map(c => extraerTextoDeCelda(c));
  const dato: Record<string, string> = {};
  
  textos.forEach((texto, idx) => {
    const nombreColumna = nombresColumnas[idx];
    const valor = texto.trim();
    
    if (nombreColumna) {
      const key = nombreColumna
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u');
      
      dato[key] = valor;
    }
  });
  
  const actividad = {
    'APROBADO POR': dato.aprobado_por || dato.aprobadopor || 'No especificado',
    'TITULO': dato.titulo || dato.nombre || '',
    'TIPO': dato.tipo || '',
    'DESCRIPCION': dato.descripcion || dato.observaciones || '',
    ...dato
  };
  
  if (Object.keys(actividad).length <= 1) {
    return null;
  }
  
  return actividad;
}

