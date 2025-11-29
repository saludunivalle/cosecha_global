/**
 * Extractores para actividades de investigación
 */

import { debugLog, extraerTextoDeCelda } from '../utils';
import { extraerTablas, extraerFilas, buscarTablaAnidada } from '../html-utils';
import { detectarSelectoresPeriodo, extraerPeriodoDeContexto } from './period-utils';
import { extraerActividadInvestigacionDeFila } from './research-activity-row';
import { extractCells } from '../html-utils';

/**
 * Extrae actividades de investigación de tablas anidadas según la estructura HTML real
 * MEJORADO: Busca TODAS las tablas de investigación, no solo la primera
 */
export function extraerActividadesInvestigacionDeHTML(html: string, idPeriod?: number): any[] {
  debugLog(`\n🔍 Buscando actividades de investigación${idPeriod ? ` para período ${idPeriod}` : ''}...`);
  
  const actividades: any[] = [];
  const infoSelectores = detectarSelectoresPeriodo(html);
  
  if (infoSelectores.tieneSelector) {
    debugLog(`   ℹ️ ${infoSelectores.detalles} - puede haber múltiples períodos`);
  }
  
  if (idPeriod) {
    debugLog(`   📅 Procesando período ID: ${idPeriod}`);
  }
  
  const tableMatches = extraerTablas(html);
  if (tableMatches.length === 0) {
    debugLog(`   ⚠️ No se encontraron tablas`);
    return actividades;
  }
  
  debugLog(`   📊 Total de tablas encontradas: ${tableMatches.length}`);
  
  const tablasInvestigacion = buscarTablasInvestigacion(tableMatches, html);
  
  if (tablasInvestigacion.length === 0) {
    debugLog(`   ❌ No se encontró ninguna tabla de ACTIVIDADES DE INVESTIGACION`);
    return actividades;
  }
  
  debugLog(`   📊 Total de tablas de investigación encontradas: ${tablasInvestigacion.length}`);
  
  for (let tablaIdx = 0; tablaIdx < tablasInvestigacion.length; tablaIdx++) {
    const { tabla: tablaContenedora, periodo } = tablasInvestigacion[tablaIdx];
    debugLog(`\n   🔍 Procesando tabla ${tablaIdx + 1}/${tablasInvestigacion.length} (período: ${periodo})...`);
    
    const tablaInterna = buscarTablaAnidada(tablaContenedora) || tablaContenedora;
    const filas = extraerFilas(tablaInterna);
    
    if (filas.length < 2) {
      debugLog(`     ⚠️ No se encontraron suficientes filas en la tabla interna`);
      continue;
    }
    
    debugLog(`     📊 Total de filas en tabla interna: ${filas.length}`);
    
    const { indiceEncabezado, nombresColumnas } = encontrarEncabezadoInvestigacion(filas);
    
    if (indiceEncabezado === -1) {
      debugLog(`     ❌ No se encontró fila de encabezados con las columnas esperadas`);
      continue;
    }
    
    const filasConDatos = filas.slice(indiceEncabezado + 1);
    debugLog(`     📝 Filas con datos: ${filasConDatos.length}`);
    
    const actividadesEnEstaTabla = procesarFilasInvestigacion(
      filasConDatos,
      nombresColumnas,
      periodo
    );
    
    actividades.push(...actividadesEnEstaTabla);
    debugLog(`     ✅ Actividades extraídas de esta tabla: ${actividadesEnEstaTabla.length}`);
  }
  
  debugLog(`\n   ✅ Total actividades extraídas de todas las tablas: ${actividades.length}`);
  
  if (actividades.length === 0) {
    logDebuggingInfo(html, tableMatches.length, tablasInvestigacion.length);
  }
  
  return actividades;
}

/**
 * Busca todas las tablas de investigación en el HTML
 */
function buscarTablasInvestigacion(
  tableMatches: string[],
  html: string
): Array<{ tabla: string; indice: number; periodo: string }> {
  const tablasInvestigacion: Array<{ tabla: string; indice: number; periodo: string }> = [];
  
  for (let i = 0; i < tableMatches.length; i++) {
    const tablaHtml = tableMatches[i];
    const texto = extraerTextoDeCelda(tablaHtml);
    const textoUpper = texto.toUpperCase();
    
    const tieneTitulo = textoUpper.includes('ACTIVIDADES DE INVESTIGACION') || 
                        textoUpper.includes('ACTIVIDADES DE INVESTIGACIÓN');
    
    if (!tieneTitulo) continue;
    
    const tieneColumnasCodigo = textoUpper.includes('CODIGO') && 
                                 (textoUpper.includes('NOMBRE DEL PROYECTO') || 
                                  textoUpper.includes('NOMBRE DEL ANTEPROYECTO')) &&
                                 textoUpper.includes('HORAS SEMESTRE');
    
    const tieneColumnasAprobado = textoUpper.includes('APROBADO POR') && 
                                   (textoUpper.includes('NOMBRE DEL PROYECTO') || 
                                    textoUpper.includes('NOMBRE DEL ANTEPROYECTO') ||
                                    textoUpper.includes('ANTEPROYECTO') ||
                                    textoUpper.includes('PROPUESTA DE INVESTIGACION')) &&
                                   textoUpper.includes('HORAS SEMESTRE');
    
    if (tieneColumnasCodigo || tieneColumnasAprobado) {
      const periodo = extraerPeriodoDeContexto(html, tablaHtml, i);
      tablasInvestigacion.push({ tabla: tablaHtml, indice: i, periodo });
      debugLog(`   ✅ Tabla de investigación encontrada (índice ${i + 1}, período: ${periodo})`);
    }
  }
  
  return tablasInvestigacion;
}

/**
 * Encuentra el encabezado de la tabla de investigación
 */
function encontrarEncabezadoInvestigacion(filas: string[]): {
  indiceEncabezado: number;
  nombresColumnas: string[];
} {
  for (let i = 0; i < Math.min(10, filas.length); i++) {
    const filaTexto = extraerTextoDeCelda(filas[i]);
    const filaTextoUpper = filaTexto.toUpperCase();
    
    const tieneCodigo = filaTextoUpper.includes('CODIGO');
    const tieneNombreProyecto = filaTextoUpper.includes('NOMBRE DEL PROYECTO') || 
                                filaTextoUpper.includes('NOMBRE DEL ANTEPROYECTO');
    const tieneHoras = filaTextoUpper.includes('HORAS SEMESTRE');
    const tieneAprobadoPor = filaTextoUpper.includes('APROBADO POR');
    
    if ((tieneCodigo && tieneNombreProyecto && tieneHoras) ||
        (tieneAprobadoPor && tieneNombreProyecto && tieneHoras)) {
      debugLog(`     ✅ Encabezado encontrado en fila ${i + 1}`);
      
      const celdasEncabezado = filas[i].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      const nombresColumnas = celdasEncabezado 
        ? celdasEncabezado.map(c => extraerTextoDeCelda(c).trim())
        : [];
      
      debugLog(`     📋 Columnas detectadas: ${JSON.stringify(nombresColumnas)}`);
      
      return { indiceEncabezado: i, nombresColumnas };
    }
  }
  
  debugLog(`     🔍 Revisando primeras 5 filas para debugging:`);
  for (let i = 0; i < Math.min(5, filas.length); i++) {
    const filaTexto = extraerTextoDeCelda(filas[i]);
    debugLog(`        Fila ${i + 1}: "${filaTexto.substring(0, 150)}..."`);
  }
  
  return { indiceEncabezado: -1, nombresColumnas: [] };
}

/**
 * Procesa las filas de datos de investigación
 */
function procesarFilasInvestigacion(
  filasConDatos: string[],
  nombresColumnas: string[],
  periodo: string
): any[] {
  const actividades: any[] = [];
  
  for (let idx = 0; idx < filasConDatos.length; idx++) {
    const fila = filasConDatos[idx];
    const celdas = fila.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    
    if (!celdas || celdas.length < 2) {
      debugLog(`       ⚠️ Fila ${idx + 1}: menos de 2 celdas, omitiendo`);
      continue;
    }
    
    const textos = celdas.map(c => extraerTextoDeCelda(c));
    const actividad = mapearFilaAInvestigacion(textos, nombresColumnas, periodo, celdas);
    
    const nombreProyecto = actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] || '';
    const horasSemestre = actividad['HORAS SEMESTRE'] || '';
    
    if (nombreProyecto || horasSemestre) {
      actividades.push(actividad);
    } else {
      debugLog(`         ⚠️ Fila filtrada (vacía)`);
    }
  }
  
  return actividades;
}

/**
 * Mapea una fila a una actividad de investigación
 */
function mapearFilaAInvestigacion(
  textos: string[],
  nombresColumnas: string[],
  periodo: string,
  celdas: RegExpMatchArray
): Record<string, any> {
  const actividad: Record<string, any> = { 'PERIODO': periodo };
  
  textos.forEach((texto, idx) => {
    const nombreColumna = nombresColumnas[idx] || '';
    if (!nombreColumna) return;
    
    const nombreNormalizado = nombreColumna.toUpperCase().trim();
    
    if (nombreNormalizado.includes('CODIGO')) {
      actividad['CODIGO'] = texto.trim();
    } else if (nombreNormalizado.includes('APROBADO') && nombreNormalizado.includes('POR')) {
      actividad['APROBADO POR'] = texto.trim();
    } else if (nombreNormalizado.includes('NOMBRE') && 
               (nombreNormalizado.includes('PROYECTO') || 
                nombreNormalizado.includes('ANTEPROYECTO') ||
                nombreNormalizado.includes('PROPUESTA'))) {
      actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = texto.trim();
    } else if (nombreNormalizado.includes('HORAS') && nombreNormalizado.includes('SEMESTRE')) {
      actividad['HORAS SEMESTRE'] = texto.trim();
    }
    
    actividad[nombreColumna] = texto.trim();
  });
  
  manejarCasosEspecialesColspan(celdas, textos, actividad);
  
  return actividad;
}

/**
 * Maneja casos especiales con colspan en las celdas
 */
function manejarCasosEspecialesColspan(
  celdas: RegExpMatchArray,
  textos: string[],
  actividad: Record<string, any>
): void {
  if (celdas.length === 3 && !actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION']) {
    const primeraCelda = celdas[0];
    const tieneColspan = primeraCelda.match(/colspan/i);
    
    if (tieneColspan) {
      actividad['APROBADO POR'] = textos[0]?.trim() || '';
      actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = textos[1]?.trim() || '';
      actividad['HORAS SEMESTRE'] = textos[2]?.trim() || '';
    } else {
      if (!actividad['CODIGO'] && !actividad['APROBADO POR']) {
        actividad['CODIGO'] = textos[0]?.trim() || '';
      }
      if (!actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION']) {
        actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = textos[1]?.trim() || '';
      }
      if (!actividad['HORAS SEMESTRE']) {
        actividad['HORAS SEMESTRE'] = textos[2]?.trim() || '';
      }
    }
  }
  
  if (celdas.length === 4 && !actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION']) {
    const primeraCelda = celdas[0];
    const tieneColspan = primeraCelda.match(/colspan/i);
    
    if (tieneColspan) {
      actividad['APROBADO POR'] = `${textos[0]?.trim() || ''} ${textos[1]?.trim() || ''}`.trim();
      actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = textos[2]?.trim() || '';
      actividad['HORAS SEMESTRE'] = textos[3]?.trim() || '';
    } else {
      if (!actividad['CODIGO'] && !actividad['APROBADO POR']) {
        actividad['CODIGO'] = textos[0]?.trim() || '';
      }
      if (!actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION']) {
        actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = textos[1]?.trim() || textos[2]?.trim() || '';
      }
      if (!actividad['HORAS SEMESTRE']) {
        actividad['HORAS SEMESTRE'] = textos[2]?.trim() || textos[3]?.trim() || '';
      }
    }
  }
}

/**
 * Registra información de debugging cuando no se encuentran actividades
 */
function logDebuggingInfo(html: string, totalTablas: number, tablasInvestigacion: number): void {
  debugLog(`\n   ⚠️ ADVERTENCIA: No se encontraron actividades de investigación`);
  debugLog(`   🔍 Información de debugging:`);
  debugLog(`      - Total tablas en HTML: ${totalTablas}`);
  debugLog(`      - Tablas de investigación encontradas: ${tablasInvestigacion}`);
  
  const mencionesInvestigacion = (html.match(/investigacion/gi) || []).length;
  const mencionesAprobado = (html.match(/aprobado por/gi) || []).length;
  const mencionesAnteproyecto = (html.match(/anteproyecto/gi) || []).length;
  
  debugLog(`      - Menciones de "investigación" en HTML: ${mencionesInvestigacion}`);
  debugLog(`      - Menciones de "APROBADO POR" en HTML: ${mencionesAprobado}`);
  debugLog(`      - Menciones de "ANTEPROYECTO" en HTML: ${mencionesAnteproyecto}`);
  
  if (mencionesInvestigacion > 0 || mencionesAprobado > 0 || mencionesAnteproyecto > 0) {
    debugLog(`      ⚠️ Hay menciones de investigación en el HTML pero no se encontraron tablas válidas`);
  }
}

