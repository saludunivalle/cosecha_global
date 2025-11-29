/**
 * Utilidades específicas para procesamiento de HTML
 */

import { extraerTextoDeCelda } from './utils';

/**
 * Extrae celdas de una fila HTML, manejando colspan
 */
export function extractCells(rowHtml: string): string[] {
  const cellMatches = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
  if (!cellMatches) return [];

  const cells: string[] = [];
  
  cellMatches.forEach((cellMatch) => {
    const colspanMatch = cellMatch.match(/colspan=["']?(\d+)["']?/i);
    const colspan = colspanMatch ? parseInt(colspanMatch[1], 10) : 1;
    const cellContent = extraerTextoDeCelda(cellMatch);
    
    for (let i = 0; i < colspan; i++) {
      cells.push(cellContent);
    }
  });

  return cells;
}

/**
 * Extrae todas las tablas de un HTML
 */
export function extraerTablas(html: string): string[] {
  const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  return tableMatches || [];
}

/**
 * Extrae todas las filas de una tabla HTML
 */
export function extraerFilas(tablaHtml: string): string[] {
  const rowMatches = tablaHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  return rowMatches || [];
}

/**
 * Busca tabla anidada dentro de otra tabla
 */
export function buscarTablaAnidada(tablaHtml: string): string | null {
  const tablaAnidadaMatch = tablaHtml.match(/<tbody[^>]*>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(<table[^>]*>[\s\S]*?<\/table>)/i);
  return tablaAnidadaMatch?.[1] || null;
}

/**
 * Verifica si una fila tiene fondo (típicamente headers)
 */
export function tieneFondo(rowHtml: string): boolean {
  return /bgcolor/i.test(rowHtml) || /background/i.test(rowHtml);
}

