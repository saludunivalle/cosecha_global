/**
 * Utilidades para extracción de períodos
 */

import { debugLog, extraerTextoDeCelda } from '../utils';
import { PERIODO_PATTERNS } from '../constants';

/**
 * Detecta si hay selectores de período en el HTML
 */
export function detectarSelectoresPeriodo(html: string): { tieneSelector: boolean; detalles: string } {
  const selectMatches = html.match(/<select[^>]*>[\s\S]*?<\/select>/gi);
  if (selectMatches) {
    for (const select of selectMatches) {
      const selectTexto = extraerTextoDeCelda(select);
      const selectUpper = selectTexto.toUpperCase();
      if (selectUpper.includes('PERIODO') || 
          selectUpper.includes('SEMESTRE') ||
          selectUpper.match(/\d{4}[-\s]?\d{1,2}/)) {
        debugLog(`   📅 Selector de período detectado en HTML`);
        return { tieneSelector: true, detalles: 'Select encontrado' };
      }
    }
  }
  
  if (html.match(/<input[^>]*type=["']radio["'][^>]*>/gi)) {
    debugLog(`   📅 Radio buttons detectados (posible selector de período)`);
    return { tieneSelector: true, detalles: 'Radio buttons encontrados' };
  }
  
  return { tieneSelector: false, detalles: 'No se encontraron selectores' };
}

/**
 * Extrae el período asociado a una tabla buscando en el contexto HTML cercano
 */
export function extraerPeriodoDeContexto(html: string, tablaHtml: string, tablaIndex: number): string {
  const tablaPosicion = html.indexOf(tablaHtml);
  if (tablaPosicion === -1) return 'DESCONOCIDO';
  
  const inicioBusqueda = Math.max(0, tablaPosicion - 2000);
  const contextoAnterior = html.substring(inicioBusqueda, tablaPosicion);
  
  for (const patron of PERIODO_PATTERNS) {
    const matches = contextoAnterior.match(patron);
    if (matches && matches.length > 0) {
      const periodo = matches[matches.length - 1].trim();
      debugLog(`     📅 Período detectado cerca de tabla ${tablaIndex + 1}: "${periodo}"`);
      return periodo;
    }
  }
  
  return 'DESCONOCIDO';
}

