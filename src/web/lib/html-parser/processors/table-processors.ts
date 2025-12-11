/**
 * Procesadores de tablas HTML para extraer diferentes tipos de información
 */

import type { InformacionPersonal, ActividadesDocencia, ActividadPregradoPostgrado, ActividadTesis } from '@/shared/types/docente.types';
import { extractCells, extraerFilas } from '../html-utils';
import { encontrarFilaHeaders, normalizarHeaders, esHeaderConocido, headerContiene } from '../header-utils';
import { normalizarEstructuraAsignatura, normalizarEstructuraTesis } from '../normalizers';
import { esActividadPostgrado } from '../classifiers';
import { extraerActividadInvestigacionDeFila } from '../extractors/research-activity-row';
import { debugLog } from '../utils';

/**
 * Procesa una tabla para extraer información personal
 */
export function procesarTablaInformacionPersonal(
  tableHtml: string,
  rowMatches: string[],
  headers: string[],
  headersNorm: string[],
  contadorTablas: number,
  informacionPersonal: InformacionPersonal
): void {
  const tieneCedula = headersNorm.some((h) =>
    h.includes('CEDULA') ||
    h.includes('DOCUMENTO') ||
    h === 'DOCENTES' ||
    h.includes('IDENTIFICACION')
  );
  const tieneApellido = headersNorm.some((h) =>
    h.includes('APELLIDO') ||
    h.includes('APELLIDOS') ||
    h.includes('NOMBRE')
  );

  if (tieneCedula && tieneApellido) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como INFORMACIÓN PERSONAL (con cédula y apellidos)`);

    if (rowMatches.length >= 2) {
      const values = extractCells(rowMatches[1]);
      debugLog(`📊 Headers completos:`, headers);
      debugLog(`📊 Valores encontrados (fila 1):`, values);
      
      headers.forEach((header, i) => {
        const valor = values[i] || '';
        const headerNorm = header.toUpperCase().trim().replace(/\s+/g, ' ');

        if (headerNorm.includes('CEDULA') || headerNorm === 'DOCENTES' || headerNorm.includes('DOCUMENTO')) {
          informacionPersonal['CEDULA'] = valor;
          debugLog(`   ✓ CEDULA = ${valor}`);
        }

        if (headerNorm.includes('1 APELLIDO') || headerNorm === 'APELLIDO1' || headerNorm.includes('PRIMER APELLIDO')) {
          informacionPersonal['1 APELLIDO'] = valor;
          debugLog(`   ✓ 1 APELLIDO = ${valor}`);
        }
        if (headerNorm.includes('2 APELLIDO') || headerNorm === 'APELLIDO2' || headerNorm.includes('SEGUNDO APELLIDO')) {
          informacionPersonal['2 APELLIDO'] = valor;
          debugLog(`   ✓ 2 APELLIDO = ${valor}`);
        }

        if (headerNorm === 'NOMBRE' || (headerNorm.includes('NOMBRES') && !headerNorm.includes('COMPLETO'))) {
          informacionPersonal['NOMBRE'] = valor;
          debugLog(`   ✓ NOMBRE = ${valor}`);
        }

        if (headerNorm.includes('UNIDAD') && headerNorm.includes('ACADEMICA')) {
          informacionPersonal['UNIDAD ACADEMICA'] = valor;
          debugLog(`   ✓ UNIDAD ACADEMICA = ${valor}`);
        }

        // Buscar VINCULACION, CATEGORIA, DEDICACION y NIVEL ALCANZADO
        if ((headerNorm.includes('VINCULACION') || headerNorm.includes('VINCULACIÓN')) && valor && valor.trim()) {
          const valorLimpio = valor.trim();
          if (valorLimpio.length > 0 && valorLimpio.length < 50 && valorLimpio !== headerNorm) {
            informacionPersonal['VINCULACION'] = valorLimpio;
            debugLog(`   ✓ VINCULACION = ${valorLimpio}`);
          }
        }
        
        if ((headerNorm.includes('CATEGORIA') || headerNorm.includes('CATEGORÍA')) && valor && valor.trim()) {
          const valorLimpio = valor.trim();
          if (valorLimpio.length > 0 && valorLimpio.length < 50 && valorLimpio !== headerNorm) {
            informacionPersonal['CATEGORIA'] = valorLimpio;
            debugLog(`   ✓ CATEGORIA = ${valorLimpio}`);
          }
        }
        
        if ((headerNorm.includes('DEDICACION') || headerNorm.includes('DEDICACIÓN')) && valor && valor.trim()) {
          const valorLimpio = valor.trim();
          if (valorLimpio.length > 0 && valorLimpio.length < 50 && valorLimpio !== headerNorm) {
            informacionPersonal['DEDICACION'] = valorLimpio;
            debugLog(`   ✓ DEDICACION = ${valorLimpio}`);
          }
        }
        
        if ((headerNorm.includes('NIVEL') && headerNorm.includes('ALCANZADO')) || 
            headerNorm === 'NIVEL ALCANZADO' ||
            (headerNorm === 'NIVEL' && !headerNorm.includes('ASIGNATURA') && !headerNorm.includes('ACADEMICO'))) {
          if (valor && valor.trim()) {
            const valorLimpio = valor.trim();
            if (valorLimpio.length > 0 && valorLimpio.length < 50 && valorLimpio !== headerNorm) {
              informacionPersonal['NIVEL ALCANZADO'] = valorLimpio;
              debugLog(`   ✓ NIVEL ALCANZADO = ${valorLimpio}`);
            }
          }
        }

        informacionPersonal[header] = valor;
        informacionPersonal[headerNorm] = valor;
      });
    }

    debugLog(`🔄 Continuando procesamiento de otras tablas...`);
  }
}

/**
 * Procesa una tabla para extraer información adicional (VINCULACION, CATEGORIA, etc.)
 */
export function procesarTablaInformacionAdicional(
  tableHtml: string,
  rowMatches: string[],
  headers: string[],
  headersNorm: string[],
  contadorTablas: number,
  informacionPersonal: InformacionPersonal
): void {
  const tieneVinculacion = headersNorm.some((h) => h.includes('VINCULACION') || h.includes('VINCULACIÓN'));
  const tieneCategoria = headersNorm.some((h) => h.includes('CATEGORIA') || h.includes('CATEGORÍA'));
  const tieneDedicacion = headersNorm.some((h) => h.includes('DEDICACION') || h.includes('DEDICACIÓN'));
  const tieneNivel = headersNorm.some((h) =>
    (h.includes('NIVEL') && h.includes('ALCANZADO')) ||
    h === 'NIVEL' ||
    (h.includes('NIVEL') && !h.includes('ASIGNATURA'))
  );
  const tieneCedula = headersNorm.some((h) => h.includes('CEDULA') || h.includes('DOCUMENTO') || h === 'DOCENTES');

  if ((tieneVinculacion || tieneCategoria || tieneDedicacion || tieneNivel) && !tieneCedula) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como INFORMACIÓN ADICIONAL (campos laborales sin cédula)`);

    for (let ri = 1; ri < rowMatches.length; ri++) {
      const row = rowMatches[ri];
      const cells = extractCells(row);

      if (cells.length === 0 || cells.every(c => !c || c.trim() === '')) continue;

      if (headers.length > 0 && cells.length >= headers.length) {
        headers.forEach((header, i) => {
          const valor = cells[i] || '';
          if (!valor || valor.trim() === '' || esHeaderConocido(valor)) return;

          const headerNorm = header.toUpperCase().trim();
          if (headerNorm.includes('VINCULACION') || headerNorm.includes('VINCULACIÓN')) {
            informacionPersonal['VINCULACION'] = valor.trim();
          }
          if (headerNorm.includes('CATEGORIA') || headerNorm.includes('CATEGORÍA')) {
            informacionPersonal['CATEGORIA'] = valor.trim();
          }
          if (headerNorm.includes('DEDICACION') || headerNorm.includes('DEDICACIÓN')) {
            informacionPersonal['DEDICACION'] = valor.trim();
          }
          if ((headerNorm.includes('NIVEL') && headerNorm.includes('ALCANZADO')) ||
              (headerNorm === 'NIVEL' && !headerNorm.includes('ASIGNATURA'))) {
            informacionPersonal['NIVEL ALCANZADO'] = valor.trim();
          }
        });
      } else if (cells.length >= 2) {
        const campo = cells[0]?.toUpperCase().trim() || '';
        const valor = cells[1]?.trim() || '';
        if (!campo || !valor || esHeaderConocido(valor)) continue;

        if (campo.includes('VINCULACION') || campo.includes('VINCULACIÓN')) {
          informacionPersonal['VINCULACION'] = valor;
        }
        if (campo.includes('CATEGORIA') || campo.includes('CATEGORÍA')) {
          informacionPersonal['CATEGORIA'] = valor;
        }
        if (campo.includes('DEDICACION') || campo.includes('DEDICACIÓN')) {
          informacionPersonal['DEDICACION'] = valor;
        }
        if ((campo.includes('NIVEL') && campo.includes('ALCANZADO')) ||
            (campo === 'NIVEL' && !campo.includes('ASIGNATURA'))) {
          informacionPersonal['NIVEL ALCANZADO'] = valor;
        }
      }
    }

    debugLog(`🔄 Continuando con otras tablas...`);
  }
}

/**
 * Busca campos de información personal en todas las filas de una tabla
 */
export function buscarCamposEnFilas(
  rowMatches: string[],
  headers: string[],
  informacionPersonal: InformacionPersonal
): void {
  if (rowMatches.length <= 1) return;

  for (let ri = 1; ri < rowMatches.length; ri++) {
    const row = rowMatches[ri];
    const cells = extractCells(row);
    if (cells.length < 2) continue;
    
    if (headers.length > 0 && cells.length >= headers.length) {
      headers.forEach((header, idx) => {
        const headerNorm = header.toUpperCase().trim();
        const valor = cells[idx]?.trim() || '';
        if (!valor || esHeaderConocido(valor)) return;
        
        if ((headerNorm.includes('VINCULACION') || headerNorm.includes('VINCULACIÓN')) && !informacionPersonal['VINCULACION']) {
          informacionPersonal['VINCULACION'] = valor;
        }
        if ((headerNorm.includes('CATEGORIA') || headerNorm.includes('CATEGORÍA')) && !informacionPersonal['CATEGORIA']) {
          informacionPersonal['CATEGORIA'] = valor;
        }
        if ((headerNorm.includes('DEDICACION') || headerNorm.includes('DEDICACIÓN')) && !informacionPersonal['DEDICACION']) {
          informacionPersonal['DEDICACION'] = valor;
        }
        if (((headerNorm.includes('NIVEL') && headerNorm.includes('ALCANZADO')) ||
             headerNorm === 'NIVEL ALCANZADO' ||
             (headerNorm === 'NIVEL' && !headerNorm.includes('ASIGNATURA'))) && 
            !informacionPersonal['NIVEL ALCANZADO']) {
          informacionPersonal['NIVEL ALCANZADO'] = valor;
        }
      });
    }
    
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]?.toUpperCase().trim() || '';
      if (!cell || esHeaderConocido(cell)) continue;
      
      if ((cell.includes('VINCULACION') || cell.includes('VINCULACIÓN')) && !informacionPersonal['VINCULACION']) {
        if (i + 1 < cells.length && cells[i + 1] && cells[i + 1].trim() && !esHeaderConocido(cells[i + 1])) {
          informacionPersonal['VINCULACION'] = cells[i + 1].trim();
        }
      }
      
      if ((cell.includes('CATEGORIA') || cell.includes('CATEGORÍA')) && !informacionPersonal['CATEGORIA']) {
        if (i + 1 < cells.length && cells[i + 1] && cells[i + 1].trim() && !esHeaderConocido(cells[i + 1])) {
          informacionPersonal['CATEGORIA'] = cells[i + 1].trim();
        }
      }
      
      if ((cell.includes('DEDICACION') || cell.includes('DEDICACIÓN')) && !informacionPersonal['DEDICACION']) {
        if (i + 1 < cells.length && cells[i + 1] && cells[i + 1].trim() && !esHeaderConocido(cells[i + 1])) {
          informacionPersonal['DEDICACION'] = cells[i + 1].trim();
        }
      }
      
      if (((cell.includes('NIVEL') && cell.includes('ALCANZADO')) ||
           (cell === 'NIVEL' && !cell.includes('ASIGNATURA'))) && 
          !informacionPersonal['NIVEL ALCANZADO']) {
        if (i + 1 < cells.length && cells[i + 1] && cells[i + 1].trim() && !esHeaderConocido(cells[i + 1])) {
          informacionPersonal['NIVEL ALCANZADO'] = cells[i + 1].trim();
        }
      }
    }
  }
}

/**
 * Detecta si una tabla es de tesis
 */
export function esTablaTesis(headersNorm: string[]): boolean {
  const tieneAnteproyectoHeader = headersNorm.some((h) => 
    h.includes('ANTEPROYECTO') || h.includes('ANTE PROYECTO') || h.includes('ANTE-PROYECTO')
  );
  const tienePropuestaInvestigacionHeader = headersNorm.some((h) =>
    (h.includes('PROPUESTA') && h.includes('INVESTIGACION')) ||
    h.includes('PROPUESTA DE INVESTIGACION')
  );
  const tieneIndicadoresInvestigacion = tieneAnteproyectoHeader || tienePropuestaInvestigacionHeader;
  
  const tieneIndicadoresTesis = 
    headersNorm.some((h) => h.includes('CODIGO') && h.includes('ESTUDIANTE')) ||
    headersNorm.some((h) => h.includes('ESTUDIANTE')) ||
    headersNorm.some((h) => h.includes('PLAN')) ||
    headersNorm.some((h) => h.includes('TITULO') && h.includes('TESIS')) ||
    (headersNorm.some((h) => h.includes('DIRECCION')) && headersNorm.some((h) => h.includes('TESIS')));
  
  if (tieneIndicadoresInvestigacion && !tieneIndicadoresTesis) {
    return false;
  }

  if (headersNorm.some((h) => h.includes('CODIGO') && h.includes('ESTUDIANTE'))) {
    return true;
  }

  const tieneCodigoEst = headersNorm.some((h) => h.includes('ESTUDIANTE'));
  const tienePlan = headersNorm.some((h) => h.includes('PLAN') || h === 'COD PLAN');
  const tieneTitulo = headersNorm.some((h) => h.includes('TITULO') || h.includes('TESIS'));

  if (tieneCodigoEst && (tienePlan || tieneTitulo)) {
    return true;
  }

  const tieneDireccion = headersNorm.some((h) => h.includes('DIRECCION') || h.includes('DIRECCIÓN'));
  const tieneTesis = headersNorm.some((h) => h.includes('TESIS'));

  return tieneDireccion && tieneTesis;
}

/**
 * Procesa una tabla de asignaturas (pregrado/postgrado)
 * @param seccionActual - Si se detectó un subtítulo de sección previo ('pregrado' o 'postgrado'), usar para clasificar
 */
export function procesarTablaAsignaturas(
  rowMatches: string[],
  headers: string[],
  headersNorm: string[],
  headerRowIndex: number,
  contadorTablas: number,
  actividadesDocencia: ActividadesDocencia,
  seccionActual: 'pregrado' | 'postgrado' | null = null
): void {
  const tieneCodigoAsignatura = headersNorm.some((h) => h === 'CODIGO' || (h.includes('CODIGO') && !h.includes('ESTUDIANTE')));
  const tieneNombreAsignatura = headersNorm.some((h) => h.includes('NOMBRE') && h.includes('ASIGNATURA'));
  const tieneTipoAsignatura = headersNorm.some((h) => h === 'TIPO' || h.includes('TIPO'));
  const tieneGrupo = headersNorm.some((h) => h === 'GRUPO' || h.includes('GRUPO'));
  const tieneHoras = headersNorm.some((h) => h.includes('HORAS') || h.includes('SEMESTRE'));
  const noEsTablaTesis = !headersNorm.some((h) => h.includes('ESTUDIANTE')) &&
                         !headersNorm.some((h) => h.includes('TESIS'));

  const esTablaAsignaturas = tieneCodigoAsignatura && 
                             (tieneNombreAsignatura || tieneTipoAsignatura || tieneGrupo) && 
                             noEsTablaTesis &&
                             tieneHoras;
  
  if (esTablaAsignaturas) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como ASIGNATURAS (pregrado/postgrado)`);
    debugLog(`📌 Sección actual desde contexto: ${seccionActual || 'ninguna (usará heurística)'}`);

    for (let ri = headerRowIndex + 1; ri < rowMatches.length; ri++) {
      const row = rowMatches[ri];
      const cells = extractCells(row);

      if (cells.every((c) => c === '' || c.trim() === '')) continue;

      const tieneCodigo = cells.some((c, idx) => {
        const header = headers[idx] || '';
        return header.toUpperCase().includes('CODIGO') && c && c.trim() !== '';
      });
      const tieneNombre = cells.some((c, idx) => {
        const header = headers[idx] || '';
        return header.toUpperCase().includes('NOMBRE') && c && c.trim() !== '';
      });

      if (!tieneCodigo && !tieneNombre) continue;

      const obj: Record<string, string> = {};
      for (let ci = 0; ci < headers.length && ci < cells.length; ci++) {
        obj[headers[ci]] = cells[ci] || '';
      }

      const estructuraNormalizada = normalizarEstructuraAsignatura(obj, headers);

      if (!estructuraNormalizada.CODIGO && !estructuraNormalizada['NOMBRE DE ASIGNATURA']) {
        continue;
      }

      // Clasificar usando el subtítulo de sección si está disponible,
      // de lo contrario usar la heurística basada en código/nombre
      let esPostgrado: boolean;
      
      if (seccionActual) {
        // Usar la sección detectada del HTML
        esPostgrado = seccionActual === 'postgrado';
        debugLog(`     🎓 Clasificado como ${esPostgrado ? 'POSTGRADO' : 'PREGRADO'} por sección del HTML`);
      } else {
        // Fallback: usar heurística basada en código y nombre
        esPostgrado = esActividadPostgrado(estructuraNormalizada);
        debugLog(`     🎓 Clasificado como ${esPostgrado ? 'POSTGRADO' : 'PREGRADO'} por heurística`);
      }

      if (esPostgrado) {
        actividadesDocencia.postgrado.push(estructuraNormalizada);
      } else {
        actividadesDocencia.pregrado.push(estructuraNormalizada);
      }
    }

    debugLog(`✅ Tabla ${contadorTablas} procesada como ASIGNATURAS. Continuando con otras tablas...`);
  }
}

/**
 * Procesa una tabla de tesis
 */
export function procesarTablaTesis(
  rowMatches: string[],
  headers: string[],
  headersNorm: string[],
  headerRowIndex: number,
  contadorTablas: number,
  actividadesDocencia: ActividadesDocencia
): void {
  const tieneIndicadoresInvestigacionEnTesis = 
    headersNorm.some((h) => h.includes('ANTEPROYECTO') || h.includes('ANTE PROYECTO')) ||
    headersNorm.some((h) => (h.includes('PROPUESTA') && h.includes('INVESTIGACION')));
  
  const esTesis = esTablaTesis(headersNorm);
  
  if (esTesis && !tieneIndicadoresInvestigacionEnTesis) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como DIRECCIÓN DE TESIS`);
    
    for (let ri2 = headerRowIndex + 1; ri2 < rowMatches.length; ri2++) {
      const row = rowMatches[ri2];
      const cells = extractCells(row);
      if (cells.every((c) => c === '' || c.trim() === '')) continue;

      const obj: Record<string, string> = {};
      for (let ci = 0; ci < headers.length && ci < cells.length; ci++) {
        obj[headers[ci]] = cells[ci] || '';
      }

      const estructuraNormalizada = normalizarEstructuraTesis(obj, headers);

      const tieneInformacionMinima = 
        estructuraNormalizada['CODIGO ESTUDIANTE'] || 
        estructuraNormalizada['TITULO DE LA TESIS'] ||
        estructuraNormalizada['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'];
      
      if (tieneInformacionMinima) {
        actividadesDocencia.direccionTesis.push(estructuraNormalizada);
      }
    }

    debugLog(`✅ Tabla ${contadorTablas} procesada como TESIS. Continuando con otras tablas...`);
  }
}

/**
 * Procesa otras actividades (complementarias, comisión, administrativas, extensión)
 */
export function procesarOtrasActividades(
  tableHtml: string,
  rowMatches: string[],
  headers: string[],
  headersNorm: string[],
  headerRowIndex: number,
  contadorTablas: number,
  actividadesExtension: any[],
  actividadesAdministrativas: any[],
  actividadesComplementarias: any[],
  docenteEnComision: any[]
): void {
  // ACTIVIDADES COMPLEMENTARIAS
  if (headersNorm.some((h) => h.includes('PARTICIPACION EN'))) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES COMPLEMENTARIAS`);
    procesarActividadesGenericas(rowMatches, headers, headerRowIndex, actividadesComplementarias);
  }

  // DOCENTE EN COMISION
  if (headersNorm.some((h) => h.includes('TIPO DE COMISION'))) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como DOCENTE EN COMISION`);
    procesarActividadesGenericas(rowMatches, headers, headerRowIndex, docenteEnComision);
  }

  // ACTIVIDADES ADMINISTRATIVAS
  if (headersNorm.includes('CARGO') && headersNorm.includes('DESCRIPCION DEL CARGO')) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES ADMINISTRATIVAS`);
    procesarActividadesGenericas(rowMatches, headers, headerRowIndex, actividadesAdministrativas);
  }

  // ACTIVIDADES DE EXTENSION
  if (headersNorm.includes('TIPO') &&
      headersNorm.includes('NOMBRE') &&
      (headersNorm.some((h) => h.includes('HORAS')) || headersNorm.some((h) => h.includes('SEMESTRE'))) &&
      !headersNorm.some((h) => h.includes('APROBADO'))) {
    debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES DE EXTENSION`);
    procesarActividadesGenericas(rowMatches, headers, headerRowIndex, actividadesExtension);
  }
}

/**
 * Procesa actividades genéricas (complementarias, comisión, etc.)
 */
function procesarActividadesGenericas(
  rowMatches: string[],
  headers: string[],
  headerRowIndex: number,
  actividades: any[]
): void {
  for (let ri = headerRowIndex + 1; ri < rowMatches.length; ri++) {
    const row = rowMatches[ri];
    if (extractCells(row).every((c) => c === '')) continue;
    
    const obj: Record<string, any> = {};
    const cells = extractCells(row);
    
    headers.forEach((header, ci) => {
      const valor = cells[ci] || '';
      const headerUpper = header.toUpperCase();
      
      if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
          headerUpper === 'HORAS SEMESTRE' ||
          (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
          headerUpper === 'HORAS') {
        obj['HORAS SEMESTRE'] = valor;
      }
      
      obj[header] = valor;
    });
    
    actividades.push(obj);
  }
}

/**
 * Busca campos faltantes de información personal en todos los valores guardados
 */
export function busquedaExhaustivaCampos(informacionPersonal: InformacionPersonal): void {
  if (informacionPersonal['VINCULACION'] && 
      informacionPersonal['CATEGORIA'] && 
      informacionPersonal['DEDICACION'] && 
      informacionPersonal['NIVEL ALCANZADO']) {
    return;
  }

  debugLog(`\n🔍 Búsqueda exhaustiva de campos faltantes...`);
  
  for (const [key, value] of Object.entries(informacionPersonal)) {
    if (!value || typeof value !== 'string') continue;
    
    const keyUpper = key.toUpperCase().trim();
    const valueUpper = value.toUpperCase().trim();
    
    if (!informacionPersonal['VINCULACION'] && 
        (keyUpper.includes('VINCULACION') || keyUpper.includes('VINCULACIÓN'))) {
      const valorLimpio = value.trim();
      if (valorLimpio.length > 0 && valorLimpio.length < 50 && 
          !valorLimpio.toUpperCase().includes('VINCULACION')) {
        informacionPersonal['VINCULACION'] = valorLimpio;
        debugLog(`   ✓ VINCULACION encontrado en búsqueda exhaustiva: "${key}" = "${valorLimpio}"`);
      }
    }
    
    if (!informacionPersonal['CATEGORIA'] && 
        (keyUpper.includes('CATEGORIA') || keyUpper.includes('CATEGORÍA'))) {
      const valorLimpio = value.trim();
      if (valorLimpio.length > 0 && valorLimpio.length < 50 && 
          !valorLimpio.toUpperCase().includes('CATEGORIA')) {
        informacionPersonal['CATEGORIA'] = valorLimpio;
        debugLog(`   ✓ CATEGORIA encontrado en búsqueda exhaustiva: "${key}" = "${valorLimpio}"`);
      }
    }
    
    if (!informacionPersonal['DEDICACION'] && 
        (keyUpper.includes('DEDICACION') || keyUpper.includes('DEDICACIÓN'))) {
      const valorLimpio = value.trim();
      if (valorLimpio.length > 0 && valorLimpio.length < 50 && 
          !valorLimpio.toUpperCase().includes('DEDICACION')) {
        informacionPersonal['DEDICACION'] = valorLimpio;
        debugLog(`   ✓ DEDICACION encontrado en búsqueda exhaustiva: "${key}" = "${valorLimpio}"`);
      }
    }
    
    if (!informacionPersonal['NIVEL ALCANZADO'] && 
        (keyUpper.includes('NIVEL') && keyUpper.includes('ALCANZADO'))) {
      const valorLimpio = value.trim();
      if (valorLimpio.length > 0 && valorLimpio.length < 50 && 
          !valorLimpio.toUpperCase().includes('NIVEL')) {
        informacionPersonal['NIVEL ALCANZADO'] = valorLimpio;
        debugLog(`   ✓ NIVEL ALCANZADO encontrado en búsqueda exhaustiva: "${key}" = "${valorLimpio}"`);
      }
    }
  }
}

