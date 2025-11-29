/**
 * Utilidades para procesamiento de headers de tablas
 */

import { normalizarTexto, extraerTextoDeCelda } from './utils';
import { KNOWN_HEADERS } from './constants';
import { extractCells } from './html-utils';

/**
 * Verifica si un texto es un header conocido (no un valor)
 */
export function esHeaderConocido(texto: string): boolean {
  const textoUpper = normalizarTexto(texto);
  const headerUpper = textoUpper.replace(/\s+/g, '');
  
  if (KNOWN_HEADERS.includes(textoUpper as any) || 
      KNOWN_HEADERS.includes(headerUpper as any)) {
    return true;
  }
  
  return textoUpper === 'NIVEL ALCANZADO' ||
         (textoUpper === 'NIVEL' && textoUpper.length < 10) ||
         (textoUpper.includes('VINCULACION') && textoUpper.length < 15 && !textoUpper.includes(' ')) ||
         (textoUpper.includes('CATEGORIA') && textoUpper.length < 15 && !textoUpper.includes(' ')) ||
         (textoUpper.includes('DEDICACION') && textoUpper.length < 15 && !textoUpper.includes(' ')) ||
         (textoUpper.includes('NIVEL') && textoUpper.includes('ALCANZADO') && textoUpper.length < 20);
}

/**
 * Encuentra la fila de headers en una tabla
 */
export function encontrarFilaHeaders(
  filas: string[],
  maxBusqueda: number = 5
): { headers: string[]; indice: number } {
  // Primero buscar fila con fondo (típicamente headers)
  for (let i = 0; i < Math.min(maxBusqueda, filas.length); i++) {
    const row = filas[i];
    if (/bgcolor/i.test(row) || /background/i.test(row)) {
      const potentialHeaders = extractCells(row);
      if (potentialHeaders.length > 0 && potentialHeaders.some(h => h.trim().length > 2)) {
        return { headers: potentialHeaders, indice: i };
      }
    }
  }
  
  // Buscar en las primeras filas por contenido que parezca headers
  const headersComunes = ['APROBADO', 'NOMBRE', 'PROYECTO', 'HORAS', 'CODIGO', 'ANTEPROYECTO', 'PROPUESTA', 'INVESTIGACION'];
  
  for (let i = 0; i < Math.min(3, filas.length); i++) {
    const potentialHeaders = extractCells(filas[i]);
    const headersNorm = potentialHeaders.map((h) => h.toUpperCase().trim());
    
    const tieneHeadersComunes = headersNorm.some(h => 
      headersComunes.some(header => h.includes(header))
    );
    
    if (tieneHeadersComunes && potentialHeaders.length > 0) {
      return { headers: potentialHeaders, indice: i };
    }
  }
  
  // Fallback: usar la primera fila
  return { headers: extractCells(filas[0] || ''), indice: 0 };
}

/**
 * Normaliza headers (sin remover acentos para preservar nombres originales)
 */
export function normalizarHeaders(headers: string[]): string[] {
  return headers.map((h) => h.toUpperCase().trim());
}

/**
 * Verifica si un header contiene alguna de las palabras clave
 */
export function headerContiene(headers: string[], palabras: string[]): boolean {
  const headersNorm = normalizarHeaders(headers);
  return palabras.some(palabra => 
    headersNorm.some(h => h.includes(palabra.toUpperCase()))
  );
}

/**
 * Mapea valores de celdas a un objeto usando headers
 */
export function mapearCeldasAObjeto(
  cells: string[],
  headers: string[]
): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((header, i) => {
    obj[header] = cells[i] || '';
  });
  return obj;
}

