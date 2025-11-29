/**
 * Parser de HTML para extraer datos del portal Univalle
 * Basado en la lógica de procesarHTML de searchState.gs
 * 
 * REFACTORIZADO: Usa módulos especializados para mejor mantenibilidad
 */

import type {
  DatosDocente,
  InformacionPersonal,
  ActividadesDocencia,
} from '@/shared/types/docente.types';

// Importar módulos de utilidades
import { debugLog } from './html-parser/utils';
import { extraerTablas, extraerFilas } from './html-parser/html-utils';
import { encontrarFilaHeaders, normalizarHeaders } from './html-parser/header-utils';

// Importar extractores especializados
import {
  extraerDatosPersonalesDeHTML,
  extraerCamposDesdeTextoPlano,
} from './html-parser/extractors/personal-info';
import { extraerActividadesInvestigacionDeHTML } from './html-parser/extractors/research-activities';
import { extraerActividadesIntelectualesDeHTML } from './html-parser/extractors/intellectual-activities';

// Importar procesadores de tablas
import {
  procesarTablaInformacionPersonal,
  procesarTablaInformacionAdicional,
  buscarCamposEnFilas,
  procesarTablaAsignaturas,
  procesarTablaTesis,
  procesarOtrasActividades,
  busquedaExhaustivaCampos,
} from './html-parser/processors/table-processors';

// Importar utilidades adicionales
import { extractCells } from './html-parser/html-utils';
import { extraerActividadInvestigacionDeFila } from './html-parser/extractors/research-activity-row';
import { extraerTextoDeCelda } from './html-parser/utils';

/**
 * Procesa el HTML extraído y devuelve datos estructurados
 * 
 * @param html - HTML completo a procesar
 * @param idPeriod - ID del período académico
 * @returns Array con un objeto DatosDocente por período
 */
export function procesarHTML(html: string, idPeriod: number): DatosDocente[] {
  debugLog(`=== INICIANDO PROCESAMIENTO HTML PARA PERIODO ${idPeriod} ===`);

  // Extraer todas las tablas del HTML
  const tableMatches = extraerTablas(html);
  if (tableMatches.length === 0) {
    debugLog('❌ No se encontraron tablas en el HTML');
    return [];
  }

  debugLog(`✅ Encontradas ${tableMatches.length} tablas en total`);

  // Inicializar estructura de datos
  const informacionPersonal: InformacionPersonal = {};
  
  // Extraer información personal (estructura HTML real + texto plano como fallback)
  extraerDatosPersonalesDeHTML(html, informacionPersonal);
  extraerCamposDesdeTextoPlano(html, informacionPersonal);
  
  const actividadesDocencia: ActividadesDocencia = {
    pregrado: [],
    postgrado: [],
    direccionTesis: [],
  };
  
  // Extraer actividades usando funciones especializadas
  const actividadesInvestigacion = extraerActividadesInvestigacionDeHTML(html, idPeriod);
  const actividadesIntelectualesOArtisticas = extraerActividadesIntelectualesDeHTML(html);
  
  const actividadesExtension: any[] = [];
  const actividadesAdministrativas: any[] = [];
  const actividadesComplementarias: any[] = [];
  const docenteEnComision: any[] = [];

  // Procesar cada tabla individualmente
  let contadorTablas = 0;

  tableMatches.forEach((tableHtml) => {
    contadorTablas++;
    debugLog(`\n=== PROCESANDO TABLA ${contadorTablas}/${tableMatches.length} ===`);

    const rowMatches = extraerFilas(tableHtml);
    if (rowMatches.length === 0) {
      debugLog(`⚠️ Tabla ${contadorTablas} no tiene filas, omitiendo`);
      return;
    }

    // Encontrar fila de headers
    const { headers, indice: headerRowIndex } = encontrarFilaHeaders(rowMatches);
    const headersNorm = normalizarHeaders(headers);

    debugLog(`📋 Headers encontrados:`, headers);
    debugLog(`📋 Headers normalizados:`, headersNorm);

    // Procesar diferentes tipos de tablas
    procesarTablaInformacionPersonal(
      tableHtml,
      rowMatches,
      headers,
      headersNorm,
      contadorTablas,
      informacionPersonal
    );

    procesarTablaInformacionAdicional(
      tableHtml,
      rowMatches,
      headers,
      headersNorm,
      contadorTablas,
      informacionPersonal
    );

    buscarCamposEnFilas(rowMatches, headers, informacionPersonal);

    procesarTablaAsignaturas(
      rowMatches,
      headers,
      headersNorm,
      headerRowIndex,
      contadorTablas,
      actividadesDocencia
    );

    procesarTablaTesis(
      rowMatches,
      headers,
      headersNorm,
      headerRowIndex,
      contadorTablas,
      actividadesDocencia
    );

    // Procesar actividades de investigación desde tablas genéricas (solo si no se encontraron con función especializada)
    if (actividadesInvestigacion.length === 0) {
      procesarActividadesInvestigacionGenéricas(
        tableHtml,
        rowMatches,
        headers,
        headersNorm,
        headerRowIndex,
        contadorTablas,
        actividadesInvestigacion
      );
    }

    // Procesar actividades intelectuales desde tablas genéricas (solo si no se encontraron con función especializada)
    if (actividadesIntelectualesOArtisticas.length === 0) {
      procesarActividadesIntelectualesGenéricas(
        tableHtml,
        rowMatches,
        headers,
        headersNorm,
        headerRowIndex,
        contadorTablas,
        actividadesIntelectualesOArtisticas
      );
    }

    procesarOtrasActividades(
      tableHtml,
      rowMatches,
      headers,
      headersNorm,
      headerRowIndex,
      contadorTablas,
      actividadesExtension,
      actividadesAdministrativas,
      actividadesComplementarias,
      docenteEnComision
    );
  });

  // Búsqueda exhaustiva de campos faltantes
  busquedaExhaustivaCampos(informacionPersonal);

  // Mostrar resumen final
  mostrarResumenFinal(idPeriod, informacionPersonal, actividadesDocencia, actividadesInvestigacion, 
                     actividadesExtension, actividadesIntelectualesOArtisticas, actividadesAdministrativas,
                     actividadesComplementarias, docenteEnComision);

  return [
    {
      periodo: idPeriod,
      informacionPersonal,
      actividadesDocencia,
      actividadesInvestigacion,
      actividadesExtension,
      actividadesIntelectualesOArtisticas,
      actividadesAdministrativas,
      actividadesComplementarias,
      docenteEnComision,
    },
  ];
}

/**
 * Procesa actividades de investigación desde tablas genéricas
 * (solo si no se encontraron con la función especializada)
 */
function procesarActividadesInvestigacionGenéricas(
  tableHtml: string,
  rowMatches: string[],
  headers: string[],
  headersNorm: string[],
  headerRowIndex: number,
  contadorTablas: number,
  actividadesInvestigacion: any[]
): void {

  const tieneAnteproyecto = headersNorm.some((h) => 
    h.includes('ANTEPROYECTO') || h.includes('ANTE PROYECTO') || h.includes('ANTE-PROYECTO')
  );
  const tienePropuestaInvestigacion = headersNorm.some((h) =>
    (h.includes('PROPUESTA') && h.includes('INVESTIGACION')) ||
    h.includes('PROPUESTA DE INVESTIGACION')
  );
  const tieneProyectoInvestigacion = headersNorm.some((h) =>
    (h.includes('PROYECTO') && h.includes('INVESTIGACION')) ||
    h.includes('PROYECTO DE INVESTIGACION')
  );
  const tieneAprobadoPor = headersNorm.some((h) => 
    (h.includes('APROBADO') && h.includes('POR')) || h === 'APROBADO POR'
  );
  const tieneTipo = headersNorm.includes('TIPO');
  const tieneNombreProyecto = headersNorm.some((h) => 
    (h.includes('NOMBRE') && (h.includes('PROYECTO') || h.includes('ANTEPROYECTO') || h.includes('PROPUESTA'))) ||
    (h.includes('NOMBRE') && !h.includes('ASIGNATURA') && !h.includes('ESTUDIANTE'))
  );

  const esTablaInvestigacion = (
    tieneAnteproyecto || 
    tienePropuestaInvestigacion || 
    tieneProyectoInvestigacion ||
    (tieneAprobadoPor && (tieneAnteproyecto || tienePropuestaInvestigacion || tieneNombreProyecto))
  ) &&
  !tieneTipo &&
  !headersNorm.some((h) => h.includes('TIPO DE COMISION')) &&
  !headersNorm.some((h) => h.includes('ASIGNATURA')) &&
  !headersNorm.some((h) => h.includes('ESTUDIANTE')) &&
  !headersNorm.some((h) => h.includes('TESIS'));

  if (esTablaInvestigacion) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES DE INVESTIGACION (procesamiento genérico)`);
    
    const tablasAnidadas = tableHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
    if (tablasAnidadas && tablasAnidadas.length > 1) {
      tablasAnidadas.forEach((tablaAnidada) => {
        const filasAnidadas = tablaAnidada.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
        if (!filasAnidadas || filasAnidadas.length < 2) return;
        
        const { headers: headersAnidados, indice: headerRowIndexAnidado } = encontrarFilaHeaders(filasAnidadas);
        
        for (let ri = headerRowIndexAnidado + 1; ri < filasAnidadas.length; ri++) {
          const row = filasAnidadas[ri];
          const cells = extractCells(row);
          if (cells.every((c: string) => c === '' || c.trim() === '')) continue;
          
          const obj = extraerActividadInvestigacionDeFila(cells, headersAnidados, headers, row);
          if (obj && (obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] || obj['HORAS SEMESTRE'])) {
            actividadesInvestigacion.push(obj);
          }
        }
      });
    }
    
    for (let ri = headerRowIndex + 1; ri < rowMatches.length; ri++) {
      const row = rowMatches[ri];
      const cells = extractCells(row);
      if (cells.every((c: string) => c === '' || c.trim() === '')) continue;
      
      const obj = extraerActividadInvestigacionDeFila(cells, headers, headers, row);
      if (obj && (obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] || obj['HORAS SEMESTRE'])) {
        actividadesInvestigacion.push(obj);
      }
    }
  }
}

/**
 * Procesa actividades intelectuales desde tablas genéricas
 * (solo si no se encontraron con la función especializada)
 */
function procesarActividadesIntelectualesGenéricas(
  tableHtml: string,
  rowMatches: string[],
  headers: string[],
  headersNorm: string[],
  headerRowIndex: number,
  contadorTablas: number,
  actividadesIntelectualesOArtisticas: any[]
): void {

  const esTablaIntelectuales = tableHtml.includes('ACTIVIDADES INTELECTUALES') ||
                                tableHtml.includes('ACTIVIDADES ARTISTICAS') ||
                                (headersNorm.some((h) => h.includes('APROBADO')) &&
                                 headersNorm.includes('TIPO') &&
                                 headersNorm.includes('NOMBRE'));
  
  if (esTablaIntelectuales) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES INTELECTUALES`);
    
    const tablaAnidadaMatch = tableHtml.match(/<tbody[^>]*>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(<table[^>]*>[\s\S]*?<\/table>)/i);
    if (tablaAnidadaMatch && tablaAnidadaMatch[1]) {
      const tablaAProcesar = tablaAnidadaMatch[1];
      const rowMatchesInterna = tablaAProcesar.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
      
      if (rowMatchesInterna && rowMatchesInterna.length > 0) {
        const { headers: headersInterna } = encontrarFilaHeaders(rowMatchesInterna);
        const headersNormInterna = normalizarHeaders(headersInterna);
        
        let indiceEncabezado = 0;
        for (let i = 0; i < Math.min(3, rowMatchesInterna.length); i++) {
          const filaTexto = extraerTextoDeCelda(rowMatchesInterna[i]);
          if (filaTexto.toUpperCase().includes('APROBADO POR') || 
              filaTexto.toUpperCase().includes('TITULO') || 
              filaTexto.toUpperCase().includes('TIPO')) {
            indiceEncabezado = i;
            break;
          }
        }
        
        for (let ri = indiceEncabezado + 1; ri < rowMatchesInterna.length; ri++) {
          const row = rowMatchesInterna[ri];
          const cells = extractCells(row);
          if (cells.every((c: string) => c === '' || c.trim() === '')) continue;
          
          const obj: Record<string, any> = {};
          let aprobadoPor = '';
          let titulo = '';
          let tipo = '';
          let descripcion = '';
          
          if (cells.length >= 4) {
            aprobadoPor = cells[0]?.trim() || '';
            titulo = cells[1]?.trim() || '';
            tipo = cells[2]?.trim() || '';
            descripcion = cells[3]?.trim() || '';
          } else if (cells.length === 3) {
            aprobadoPor = 'No especificado';
            titulo = cells[0]?.trim() || '';
            tipo = cells[1]?.trim() || '';
            descripcion = cells[2]?.trim() || '';
          }
          
          obj['APROBADO POR'] = aprobadoPor;
          obj['TITULO'] = titulo;
          obj['TIPO'] = tipo;
          obj['DESCRIPCION'] = descripcion;
          
          headersInterna.forEach((header, ci) => {
            if (ci < cells.length) {
              obj[header] = cells[ci] || '';
            }
          });
          
          if (titulo || tipo) {
            actividadesIntelectualesOArtisticas.push(obj);
          }
        }
      }
    } else {
      for (let ri = headerRowIndex + 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        const cells = extractCells(row);
        if (cells.every((c: string) => c === '' || c.trim() === '')) continue;
        
        const obj: Record<string, any> = {};
        let aprobadoPor = '';
        
        headers.forEach((header, ci) => {
          const valor = cells[ci] || '';
          const headerUpper = header.toUpperCase();
          
          if (headerUpper.includes('APROBADO') && headerUpper.includes('POR')) {
            aprobadoPor = valor.trim();
            obj['APROBADO POR'] = valor.trim();
          }
          
          if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
              headerUpper === 'HORAS SEMESTRE' ||
              (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
              headerUpper === 'HORAS') {
            obj['HORAS SEMESTRE'] = valor;
          }
          
          obj[header] = valor;
        });
        
        if (!aprobadoPor && cells.length >= 4) {
          aprobadoPor = cells[0]?.trim() || '';
          obj['APROBADO POR'] = aprobadoPor || 'No especificado';
        }
        
        actividadesIntelectualesOArtisticas.push(obj);
      }
    }
  }
}

/**
 * Muestra un resumen final de los datos extraídos
 */
function mostrarResumenFinal(
  idPeriod: number,
  informacionPersonal: InformacionPersonal,
  actividadesDocencia: ActividadesDocencia,
  actividadesInvestigacion: any[],
  actividadesExtension: any[],
  actividadesIntelectualesOArtisticas: any[],
  actividadesAdministrativas: any[],
  actividadesComplementarias: any[],
  docenteEnComision: any[]
): void {
  debugLog(`\n=== RESUMEN FINAL PERIODO ${idPeriod} ===`);
  debugLog(`📋 INFORMACIÓN PERSONAL:`);
  debugLog(`   CEDULA: ${informacionPersonal['CEDULA'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   NOMBRE: ${informacionPersonal['NOMBRE'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   1 APELLIDO: ${informacionPersonal['1 APELLIDO'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   2 APELLIDO: ${informacionPersonal['2 APELLIDO'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   UNIDAD ACADEMICA: ${informacionPersonal['UNIDAD ACADEMICA'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   VINCULACION: ${informacionPersonal['VINCULACION'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   CATEGORIA: ${informacionPersonal['CATEGORIA'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   DEDICACION: ${informacionPersonal['DEDICACION'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   NIVEL ALCANZADO: ${informacionPersonal['NIVEL ALCANZADO'] || '❌ NO ENCONTRADO'}`);

  debugLog(`\n📚 ACTIVIDADES DOCENCIA:`);
  debugLog(`   Pregrado: ${actividadesDocencia.pregrado.length} actividades`);
  if (actividadesDocencia.pregrado.length > 0) {
    actividadesDocencia.pregrado.forEach((act, idx) => {
      debugLog(`     [${idx + 1}] ${act.CODIGO} - ${act['NOMBRE DE ASIGNATURA']} (${act['HORAS SEMESTRE']} horas)`);
    });
  }
  debugLog(`   Postgrado: ${actividadesDocencia.postgrado.length} actividades`);
  if (actividadesDocencia.postgrado.length > 0) {
    actividadesDocencia.postgrado.forEach((act, idx) => {
      debugLog(`     [${idx + 1}] ${act.CODIGO} - ${act['NOMBRE DE ASIGNATURA']} (${act['HORAS SEMESTRE']} horas)`);
    });
  } else {
    debugLog(`     ⚠️ No se encontraron actividades de postgrado. Revisar clasificación.`);
  }
  debugLog(`   Dirección Tesis: ${actividadesDocencia.direccionTesis.length} actividades`);

  debugLog(`\n🔬 OTRAS ACTIVIDADES:`);
  debugLog(`   Investigación: ${actividadesInvestigacion.length}`);
  debugLog(`   Extensión: ${actividadesExtension.length}`);
  debugLog(`   Intelectuales/Artísticas: ${actividadesIntelectualesOArtisticas.length}`);
  debugLog(`   Administrativas: ${actividadesAdministrativas.length}`);
  debugLog(`   Complementarias: ${actividadesComplementarias.length}`);
  debugLog(`   Docente en Comisión: ${docenteEnComision.length}`);
  debugLog(`\n=== FIN PROCESAMIENTO PERIODO ${idPeriod} ===\n`);
}
