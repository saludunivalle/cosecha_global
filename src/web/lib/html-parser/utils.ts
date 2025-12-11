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
 * Corrige problemas de codificación "mojibake" (UTF-8 interpretado como ISO-8859-1)
 * Esto ocurre cuando texto UTF-8 se lee incorrectamente como ISO-8859-1
 * 
 * Ejemplos de problemas corregidos:
 * - "NIÃ'O" → "NIÑO"
 * - "CIRUGÃA PEDIÃTRICA" → "CIRUGÍA PEDIÁTRICA"
 * - "RECIÃ‰N" → "RECIÉN"
 */
export function corregirCodificacion(texto: string): string {
  if (!texto) return texto;
  
  let resultado = texto;
  
  // Mapeo de secuencias mojibake comunes a caracteres correctos
  // Ordenado de más específico a menos específico para evitar reemplazos parciales
  const mojibakeMap: Array<[string, string]> = [
    // Vocales mayúsculas con tilde (más comunes en los ejemplos del usuario)
    ["Ã\x81", "Á"],   // Á - código 193
    ["Ã‰", "É"],     // É - código 201
    ["Ã\x89", "É"],   // É alternativo
    ["Ã\x8D", "Í"],   // Í - código 205
    ["ÃA", "Í"],     // Í - patrón específico del usuario (CIRUGÃA → CIRUGÍA)
    ["Ã", "Ó"],     // Ó - código 211
    ["Ã\x93", "Ó"],   // Ó alternativo
    ["Ãš", "Ú"],     // Ú - código 218
    ["Ã\x9A", "Ú"],   // Ú alternativo
    
    // Eñe mayúscula y minúscula - usando código de escape
    ["Ã\x91", "Ñ"],   // Ñ - código 209
    ["Ã\u0091", "Ñ"], // Ñ alternativo
    ["Ã±", "ñ"],     // ñ - código 241
    
    // Vocales minúsculas con tilde
    ["Ã¡", "á"],     // á - código 225
    ["Ã©", "é"],     // é - código 233
    ["Ã­", "í"],     // í - código 237
    ["Ã³", "ó"],     // ó - código 243
    ["Ãº", "ú"],     // ú - código 250
    
    // Diéresis
    ["Ã¼", "ü"],     // ü
    ["Ãœ", "Ü"],     // Ü
    
    // Otros caracteres especiales del español
    ["Â°", "°"],     // Símbolo de grado
    ["Â¿", "¿"],     // Signo de interrogación invertido
    ["Â¡", "¡"],     // Signo de exclamación invertido
    ["Âº", "º"],     // Ordinal masculino
    ["Âª", "ª"],     // Ordinal femenino
    
    // Comillas y guiones
    ["â€", "–"],    // En dash
    ["â€", "—"],    // Em dash
    ["â€˜", "'"],    // Comilla simple izquierda
    ["â€™", "'"],    // Comilla simple derecha
    ["â€œ", '"'],    // Comilla doble izquierda
    ["â€", '"'],     // Comilla doble derecha
  ];
  
  // Aplicar reemplazos en orden
  for (const [mojibake, correcto] of mojibakeMap) {
    resultado = resultado.split(mojibake).join(correcto);
  }
  
  // Patrones adicionales con regex para caracteres de control
  resultado = resultado
    .replace(/Ã[\x80-\x9F]/g, (match) => {
      // Mapeo de Ã + carácter de control a letra acentuada
      const charCode = match.charCodeAt(1);
      const latinMap: Record<number, string> = {
        0x81: "Á", // 129
        0x89: "É", // 137
        0x8D: "Í", // 141
        0x91: "Ñ", // 145
        0x93: "Ó", // 147
        0x9A: "Ú", // 154
      };
      return latinMap[charCode] || match;
    });
  
  // Patrón adicional para Ñ con apóstrofe: Ã'
  resultado = resultado.replace(/Ã'/g, "Ñ");
  
  return resultado;
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
 * Incluye corrección de codificación mojibake
 */
export function extraerTextoDeCelda(celdaHtml: string): string {
  let texto = celdaHtml.replace(/<[^>]+>/g, '');
  texto = decodeEntities(texto);
  texto = corregirCodificacion(texto);
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

