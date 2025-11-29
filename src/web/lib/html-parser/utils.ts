/**
 * Utilidades para procesamiento de texto y HTML
 */

import { HTML_ENTITIES } from './constants';
import { DEBUG_PARSER } from './constants';

/**
 * Función de logging condicional
 */
export function debugLog(...args: any[]): void {
  if (DEBUG_PARSER) {
    console.log('[HTML-PARSER]', ...args);
  }
}

/**
 * Decodifica entidades HTML comunes
 */
export function decodeEntities(text: string): string {
  return text.replace(/&[a-zA-Z]+;/g, (match) => HTML_ENTITIES[match] || match);
}

/**
 * Remueve acentos de un string
 */
export function removeAccents(str: string): string {
  if (!str) return str;
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extrae el texto de una celda HTML, manejando divs y fonts anidados
 * Similar a textContent en el navegador
 */
export function extraerTextoDeCelda(celdaHtml: string): string {
  let texto = celdaHtml.replace(/<[^>]+>/g, '');
  texto = decodeEntities(texto);
  texto = texto.replace(/\s+/g, ' ').trim();
  return texto;
}

/**
 * Normaliza un texto para comparación (mayúsculas, sin espacios extra)
 */
export function normalizarTexto(texto: string): string {
  return texto.toUpperCase().trim().replace(/\s+/g, ' ');
}

/**
 * Verifica si un texto contiene alguna de las palabras clave (case-insensitive)
 */
export function contieneAlgunaPalabra(texto: string, palabras: readonly string[]): boolean {
  const textoUpper = texto.toUpperCase();
  return palabras.some(palabra => textoUpper.includes(palabra));
}

/**
 * Verifica si un texto es vacío o solo contiene caracteres especiales
 */
export function esTextoVacio(texto: string): boolean {
  if (!texto || !texto.trim()) return true;
  const textoLimpio = texto.trim();
  return textoLimpio === '–' || 
         textoLimpio === '-' || 
         /^[\s\-–]+$/.test(textoLimpio);
}

