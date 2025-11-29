/**
 * Clasificadores para determinar tipos de actividades y tablas
 */

import type { ActividadPregradoPostgrado } from '@/shared/types/docente.types';
import { KEYWORDS_POSTGRADO, KEYWORDS_PREGRADO } from './constants';
import { debugLog } from './utils';
import { contieneAlgunaPalabra } from './utils';

/**
 * Determina si una actividad es de postgrado
 * Mejora la clasificación para evitar mezclas entre pregrado y postgrado
 */
export function esActividadPostgrado(actividad: ActividadPregradoPostgrado): boolean {
  if (!actividad) {
    debugLog(`     ⚠️ esActividadPostgrado: actividad es null/undefined`);
    return false;
  }

  const codigo = String(actividad.CODIGO || '').trim();
  const nombre = String(actividad['NOMBRE DE ASIGNATURA'] || '').toUpperCase().trim();
  const tipo = String(actividad.TIPO || '').toUpperCase().trim();
  const grupo = String(actividad.GRUPO || '').toUpperCase().trim();

  debugLog(`     🔍 Evaluando clasificación: codigo="${codigo}", nombre="${nombre}", tipo="${tipo}", grupo="${grupo}"`);

  if (!codigo && !nombre && !tipo && !grupo) {
    debugLog(`     ⚠️ Sin información suficiente, clasificando como PREGRADO por defecto`);
    return false;
  }

  // Priorizar detección de postgrado primero
  if (contieneAlgunaPalabra(nombre, KEYWORDS_POSTGRADO) ||
      contieneAlgunaPalabra(tipo, KEYWORDS_POSTGRADO) ||
      contieneAlgunaPalabra(grupo, KEYWORDS_POSTGRADO)) {
    debugLog(`     🎓 POSTGRADO detectado por keyword en nombre/tipo/grupo`);
    return true;
  }

  // Verificar keywords de pregrado para evitar falsos positivos
  if (contieneAlgunaPalabra(nombre, KEYWORDS_PREGRADO) ||
      contieneAlgunaPalabra(tipo, KEYWORDS_PREGRADO) ||
      contieneAlgunaPalabra(grupo, KEYWORDS_PREGRADO)) {
    debugLog(`     🎓 PREGRADO detectado por keyword`);
    return false;
  }

  // Analizar código
  const codigoLimpio = codigo.replace(/[A-Za-z]/g, '');
  
  if (codigoLimpio && /^\d+$/.test(codigoLimpio)) {
    if (esCodigoPostgrado(codigoLimpio)) {
      debugLog(`🎓 POSTGRADO por código: ${codigo} (limpio: ${codigoLimpio}) - ${nombre}`);
      return true;
    }
    
    if (esCodigoPregrado(codigoLimpio)) {
      debugLog(`     🎓 PREGRADO detectado por código: ${codigo} (limpio: ${codigoLimpio})`);
      return false;
    }
  }

  // Códigos con letras que indican postgrado
  if (codigo && /^(M|D|E|P)[A-Z0-9]/.test(codigo.toUpperCase())) {
    debugLog(`🎓 POSTGRADO por código con letra: ${codigo} - ${nombre}`);
    return true;
  }

  // Códigos con letras que indican pregrado
  if (codigo && /^(L|I|T|B)[A-Z0-9]/.test(codigo.toUpperCase())) {
    debugLog(`     🎓 PREGRADO detectado por código con letra inicial: ${codigo}`);
    return false;
  }

  debugLog(`     🎓 Clasificando como PREGRADO por defecto (sin criterios claros de postgrado)`);
  return false;
}

/**
 * Verifica si un código numérico limpio corresponde a postgrado
 */
function esCodigoPostgrado(codigoLimpio: string): boolean {
  // Códigos que empiezan con 61 seguido de 7-9
  if (/^61[7-9]\d{2,}$/.test(codigoLimpio)) {
    return true;
  }
  
  // Códigos que empiezan con 7, 8, 9
  if (/^[7-9]\d{2,}$/.test(codigoLimpio)) {
    return true;
  }
  
  // Códigos que empiezan con 0 seguido de 7-9
  if (/^0[7-9]\d{2,}$/.test(codigoLimpio)) {
    return true;
  }
  
  // Códigos que empiezan con 62 seguido de 7-9
  if (/^62[7-9]\d{2,}$/.test(codigoLimpio)) {
    return true;
  }
  
  // Códigos de 4+ dígitos donde el segundo dígito es 7-9 Y no empieza con 1-6
  if (codigoLimpio.length >= 4) {
    const primerDigito = codigoLimpio[0];
    const segundoDigito = codigoLimpio[1];
    const tercerDigito = codigoLimpio.length >= 3 ? codigoLimpio[2] : '';
    
    if (primerDigito === '6' && segundoDigito === '1' && ['7', '8', '9'].includes(tercerDigito)) {
      return true;
    }
    
    if (!['1', '2', '3', '4', '5', '6'].includes(primerDigito) && 
        ['7', '8', '9'].includes(segundoDigito)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Verifica si un código numérico limpio corresponde a pregrado
 */
function esCodigoPregrado(codigoLimpio: string): boolean {
  // Códigos que empiezan con 1-5 son típicamente pregrado
  if (/^[1-5]\d{3,}$/.test(codigoLimpio)) {
    return true;
  }
  
  // Códigos que empiezan con 0 seguido de 1-6
  if (/^0[1-6]\d{2,}$/.test(codigoLimpio)) {
    return true;
  }
  
  // Códigos que empiezan con 6: pueden ser pregrado o postgrado
  if (/^6\d{3,}$/.test(codigoLimpio)) {
    const segundoDigito = codigoLimpio.length >= 2 ? codigoLimpio[1] : '';
    if (segundoDigito === '0' || 
        (['3', '4', '5', '6', '9'].includes(segundoDigito)) ||
        (segundoDigito === '1' && codigoLimpio.length >= 3 && !['7', '8', '9'].includes(codigoLimpio[2])) ||
        (segundoDigito === '2' && codigoLimpio.length >= 3 && !['7', '8', '9'].includes(codigoLimpio[2]))) {
      return true;
    }
  }
  
  return false;
}

