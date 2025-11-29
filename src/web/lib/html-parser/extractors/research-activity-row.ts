/**
 * Extractores para actividades de investigación por fila
 */

import { debugLog, decodeEntities, extraerTextoDeCelda, esTextoVacio } from '../utils';
import { normalizarHorasSemestre } from '../normalizers';

/**
 * Extrae una actividad de investigación de una fila, buscando inteligentemente el nombre del proyecto
 */
export function extraerActividadInvestigacionDeFila(
  cells: string[],
  headers: string[],
  headersOriginales?: string[],
  rowHtml?: string
): Record<string, any> | null {
  const obj: Record<string, any> = {};
  let nombreProyecto = '';
  let aprobadoPor = '';
  let escuelaDpto = '';
  let horasSemestre = '';
  
  // Mapear usando headers si están disponibles
  if (headers.length > 0) {
    headers.forEach((header, ci) => {
      const valor = cells[ci]?.trim() || '';
      const headerUpper = header.toUpperCase().trim();
      
      obj[header] = valor;
      
      if (headerUpper.includes('APROBADO') && headerUpper.includes('POR')) {
        aprobadoPor = valor;
        obj['APROBADO POR'] = valor;
      }
      
      if (headerUpper.includes('NOMBRE') && 
          (headerUpper.includes('PROYECTO') || 
           headerUpper.includes('ANTEPROYECTO') || 
           headerUpper.includes('PROPUESTA') ||
           headerUpper.includes('INVESTIGACION'))) {
        if (!esTextoVacio(valor)) {
          nombreProyecto = valor;
          obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = valor;
        }
      }
      
      if (headerUpper.includes('ESCUELA') || 
          headerUpper.includes('DPTO') || 
          headerUpper.includes('DEPARTAMENTO')) {
        escuelaDpto = valor;
        obj['Escuela o Dpto'] = valor;
      }
      
      const horas = normalizarHorasSemestre(headerUpper, valor);
      if (horas) {
        horasSemestre = horas;
        obj['HORAS SEMESTRE'] = horas;
      }
    });
  }
  
  // Si no se encontró el nombre del proyecto, buscar en todas las celdas
  if (!nombreProyecto) {
    nombreProyecto = buscarNombreProyectoInteligente(cells, headers, obj);
  }
  
  // Si aún no se encontró y tenemos el HTML de la fila, buscar directamente en el HTML
  if (!nombreProyecto && rowHtml) {
    nombreProyecto = buscarNombreProyectoEnHTML(rowHtml, obj);
  }
  
  // Buscar horas si no se encontró
  if (!horasSemestre) {
    horasSemestre = buscarHorasEnCeldas(cells, obj);
  }
  
  // Validar que tenga al menos horas o nombre
  if (!horasSemestre && !nombreProyecto) {
    return null;
  }
  
  return obj;
}

/**
 * Busca el nombre del proyecto de manera inteligente en las celdas
 */
function buscarNombreProyectoInteligente(
  cells: string[],
  headers: string[],
  obj: Record<string, any>
): string {
  let mejorCandidato = { celda: '', longitud: 0 };
  
  for (let ci = 0; ci < cells.length; ci++) {
    const celda = cells[ci]?.trim() || '';
    if (!celda || celda.length < 10) continue;
    
    const celdaUpper = celda.toUpperCase();
    const header = headers[ci] || '';
    const headerUpper = header.toUpperCase();
    
    const excluir = [
      celdaUpper.includes('ESCUELA'),
      celdaUpper.includes('DPTO'),
      celdaUpper.includes('DEPARTAMENTO'),
      celdaUpper.includes('APROBADO'),
      headerUpper.includes('HORAS'),
      headerUpper.includes('APROBADO'),
      esTextoVacio(celda),
      /^\d+\.?\d*$/.test(celda),
      celda.length < 15,
    ].some(Boolean);
    
    if (!excluir && celda.length > mejorCandidato.longitud) {
      mejorCandidato = { celda, longitud: celda.length };
    }
  }
  
  if (mejorCandidato.celda && mejorCandidato.longitud > 15) {
    obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = mejorCandidato.celda;
    debugLog(`     📝 Nombre del proyecto encontrado (búsqueda inteligente): "${mejorCandidato.celda.substring(0, 50)}..."`);
    return mejorCandidato.celda;
  }
  
  return '';
}

/**
 * Busca el nombre del proyecto en el HTML de la fila
 */
function buscarNombreProyectoEnHTML(
  rowHtml: string,
  obj: Record<string, any>
): string {
  const celdasConWidth = rowHtml.match(/<td[^>]*width[^>]*>([\s\S]*?)<\/td>/gi);
  if (!celdasConWidth) return '';
  
  for (const celdaHtml of celdasConWidth) {
    let texto = celdaHtml.replace(/<[^>]+>/g, '');
    texto = decodeEntities(texto);
    texto = texto.trim();
    
    const excluir = [
      texto.length <= 20,
      texto.toUpperCase().includes('ESCUELA'),
      texto.toUpperCase().includes('DPTO'),
      texto.toUpperCase().includes('DEPARTAMENTO'),
      /^\d+\.?\d*$/.test(texto),
    ].some(Boolean);
    
    if (!excluir) {
      obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = texto;
      debugLog(`     📝 Nombre del proyecto encontrado en HTML (celda con width): "${texto.substring(0, 50)}..."`);
      return texto;
    }
  }
  
  return '';
}

/**
 * Busca horas semestre en las celdas
 */
function buscarHorasEnCeldas(
  cells: string[],
  obj: Record<string, any>
): string {
  for (let ci = 0; ci < cells.length; ci++) {
    const celda = cells[ci]?.trim() || '';
    if (/^\d+\.?\d*$/.test(celda)) {
      obj['HORAS SEMESTRE'] = celda;
      return celda;
    }
  }
  return '';
}

