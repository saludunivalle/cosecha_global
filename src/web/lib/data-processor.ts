/**
 * Utilidades para procesar y consolidar datos de docentes
 */

import type { ResultadoBusqueda, DatosDocente } from '@/shared/types/docente.types';
import type { DatosConsolidados } from './types';

/**
 * Extrae horas semestre de un valor
 * Maneja diferentes formatos: "48", "48.0", "48,5", "48 horas", etc.
 * Soporta tanto punto como coma decimal
 */
export function extraerHorasSemestre(valor: string | number): number {
  if (!valor || valor === '–' || valor === '' || valor === null || valor === undefined) return 0;

  // Si ya es un número, retornarlo directamente
  if (typeof valor === 'number') {
    return isNaN(valor) ? 0 : Math.max(0, valor);
  }

  // Convertir a string y limpiar
  let str = String(valor).trim();
  if (!str) return 0;

  // Reemplazar coma por punto para manejar formato europeo de decimales (48,5 -> 48.5)
  str = str.replace(',', '.');

  // Extraer número (permite decimales con punto)
  const num = parseFloat(str.replace(/[^\d.]/g, ''));

  // Validar que sea un número válido y no negativo
  if (isNaN(num) || num < 0) return 0;

  return num;
}

/**
 * Genera un identificador único para una actividad basado en sus campos clave
 */
function generarIdActividad(actividad: Record<string, any>): string {
  // Campos clave que identifican únicamente una actividad
  const codigo = String(actividad.CODIGO || actividad['CODIGO ESTUDIANTE'] || actividad['APROBADO POR'] || '').trim();
  const nombre = String(
    actividad['NOMBRE DE ASIGNATURA'] ||
    actividad.NOMBRE ||
    actividad['TITULO DE LA TESIS'] ||
    actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] ||
    actividad['NOMBRE DEL PROYECTO DE INVESTIGACION'] ||
    actividad['DESCRIPCION DEL CARGO'] ||
    actividad['TIPO DE COMISION'] ||
    ''
  ).trim();
  const grupo = String(actividad.GRUPO || '').trim();
  const tipo = String(actividad.TIPO || '').trim();

  // Crear hash simple concatenando campos normalizados
  return `${codigo}|${nombre}|${grupo}|${tipo}`.toLowerCase();
}

/**
 * Elimina actividades duplicadas de un array
 * Mantiene la primera ocurrencia de cada actividad
 */
export function deduplicarActividades<T extends Record<string, any>>(actividades: T[]): T[] {
  if (!Array.isArray(actividades) || actividades.length === 0) return actividades;

  const vistos = new Set<string>();
  const actividadesUnicas: T[] = [];

  for (const actividad of actividades) {
    const id = generarIdActividad(actividad);

    // Si el ID está vacío (actividad sin datos clave), mantenerla
    if (id === '|||' || id === '') {
      actividadesUnicas.push(actividad);
      continue;
    }

    // Solo agregar si no se ha visto antes
    if (!vistos.has(id)) {
      vistos.add(id);
      actividadesUnicas.push(actividad);
    }
  }

  return actividadesUnicas;
}

/**
 * Combina nombre completo desde información personal
 */
export function combinarNombreCompleto(info: Record<string, any>): string {
  if (!info || typeof info !== 'object') return 'No disponible';

  // Priorizar NOMBRE COMPLETO si existe
  if (info['NOMBRE COMPLETO']) {
    return info['NOMBRE COMPLETO'];
  }

  const apellido1 = info['1 APELLIDO'] || info['APELLIDO1'] || '';
  const apellido2 = info['2 APELLIDO'] || info['APELLIDO2'] || '';
  const nombre = info['NOMBRE'] || '';

  const nombreCompleto = `${nombre} ${apellido1} ${apellido2}`.trim().replace(/\s+/g, ' ');
  return nombreCompleto || 'No disponible';
}

/**
 * Consolida datos por categoría desde múltiples resultados
 */
export function consolidarDatosPorCategoria(
  results: ResultadoBusqueda[]
): DatosConsolidados {
  const consolidado: DatosConsolidados = {
    pregrado: {},
    postgrado: {},
    direccionTesis: {},
    actividadesInvestigacion: {},
    actividadesExtension: {},
    actividadesIntelectualesOArtisticas: {},
    actividadesAdministrativas: {},
    actividadesComplementarias: {},
    docenteEnComision: {},
  };

  results.forEach((res) => {
    if (res.error || !res.data || res.data.length === 0) return;

    const periodo = res.periodo;
    const filaObj = res.data[0];

    // Consolidar actividades de docencia (con deduplicación)
    if (filaObj.actividadesDocencia) {
      if (filaObj.actividadesDocencia.pregrado) {
        consolidado.pregrado[periodo] = deduplicarActividades(filaObj.actividadesDocencia.pregrado);
      }
      if (filaObj.actividadesDocencia.postgrado) {
        consolidado.postgrado[periodo] = deduplicarActividades(filaObj.actividadesDocencia.postgrado);
      }
      if (filaObj.actividadesDocencia.direccionTesis) {
        consolidado.direccionTesis[periodo] = deduplicarActividades(filaObj.actividadesDocencia.direccionTesis);
      }
    }

    // Consolidar otras actividades (con deduplicación)
    const otrasActividades: Array<keyof DatosConsolidados> = [
      'actividadesInvestigacion',
      'actividadesExtension',
      'actividadesIntelectualesOArtisticas',
      'actividadesAdministrativas',
      'actividadesComplementarias',
      'docenteEnComision',
    ];

    otrasActividades.forEach((key) => {
      const actividades = (filaObj as any)[key];
      if (actividades && Array.isArray(actividades) && actividades.length > 0) {
        consolidado[key][periodo] = deduplicarActividades(actividades);
      }
    });
  });

  return consolidado;
}

/**
 * Obtiene columnas específicas según el tipo de actividad
 */
export function obtenerColumnasPorTipo(tipoActividad: string): string[] {
  const estructuras: Record<string, string[]> = {
    pregrado: [
      'CODIGO',
      'GRUPO',
      'TIPO',
      'NOMBRE DE ASIGNATURA',
      'CRED',
      'PORC',
      'FREC',
      'INTEN',
      'HORAS SEMESTRE',
    ],
    postgrado: [
      'CODIGO',
      'GRUPO',
      'TIPO',
      'NOMBRE DE ASIGNATURA',
      'CRED',
      'PORC',
      'FREC',
      'INTEN',
      'HORAS SEMESTRE',
    ],
    direcciondetesis: ['CODIGO ESTUDIANTE', 'COD PLAN', 'TITULO DE LA TESIS', 'HORAS SEMESTRE'],
    actividadesdeinvestigacion: [
      'APROBADO POR',
      'NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION',
      'HORAS SEMESTRE',
    ],
    actividadesdeextension: ['TIPO', 'NOMBRE', 'HORAS SEMESTRE'],
    actividadesintelectualesoartisticas: ['APROBADO POR', 'TIPO', 'NOMBRE', 'HORAS SEMESTRE'],
    actividadesadministrativas: ['CARGO', 'DESCRIPCION DEL CARGO', 'HORAS SEMESTRE'],
    actividadescomplementarias: ['PARTICIPACION EN', 'NOMBRE', 'HORAS SEMESTRE'],
    docenteencomision: ['TIPO DE COMISION', 'DESCRIPCION', 'HORAS SEMESTRE'],
  };

  // Normalizar el tipo de actividad para buscar en el mapeo
  const tipoNormalizado = tipoActividad.toLowerCase().replace(/[^a-z]/g, '');

  // Buscar coincidencias exactas primero
  if (estructuras[tipoNormalizado]) {
    return estructuras[tipoNormalizado];
  }

  // Buscar coincidencias parciales
  for (const [key, value] of Object.entries(estructuras)) {
    if (tipoNormalizado.includes(key) || key.includes(tipoNormalizado)) {
      return value;
    }
  }

  // Default
  return ['CODIGO', 'NOMBRE', 'HORAS SEMESTRE'];
}

/**
 * Mapea nombre de columna original a nombre normalizado
 */
export function mapearColumna(nombreOriginal: string): string {
  const mapeo: Record<string, string> = {
    // Docencia
    CODIGO: 'CODIGO',
    GRUPO: 'GRUPO',
    TIPO: 'TIPO',
    'NOMBRE DE ASIGNATURA': 'NOMBRE DE ASIGNATURA',
    CRED: 'CRED',
    PORC: 'PORC',
    FREC: 'FREC',
    INTEN: 'INTEN',
    // Tesis
    'CODIGO ESTUDIANTE': 'CODIGO ESTUDIANTE',
    'COD PLAN': 'COD PLAN',
    'TITULO DE LA TESIS': 'TITULO DE LA TESIS',
    // Investigación
    'NOMBRE DEL PROYECTO DE INVESTIGACION': 'NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION',
    'NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION': 'NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION',
    // Extensión / Intelectuales / Complementarias
    NOMBRE: 'NOMBRE',
    // Intelectuales
    'APROBADO POR': 'APROBADO POR',
    // Complementarias
    'PARTICIPACION EN:': 'PARTICIPACION EN',
    'PARTICIPACION EN': 'PARTICIPACION EN',
    // Administrativas
    CARGO: 'CARGO',
    'DESCRIPCION DEL CARGO': 'DESCRIPCION DEL CARGO',
    // Comisión
    'TIPO DE COMISION:': 'TIPO DE COMISION',
    'TIPO DE COMISION': 'TIPO DE COMISION',
    DESCRIPCION: 'DESCRIPCION',
    // Comunes
    'HORAS SEMESTRE': 'HORAS SEMESTRE',
    'NUMERO DE HORAS': 'HORAS SEMESTRE',
  };

  const nombreUpper = nombreOriginal.toUpperCase().trim();

  // Buscar coincidencia exacta
  if (mapeo[nombreUpper]) {
    return mapeo[nombreUpper];
  }

  // Mapeo flexible para variaciones de investigación
  if (nombreUpper.includes('ANTEPROYECTO') || 
      nombreUpper.includes('PROPUESTA DE INVESTIGACION') ||
      nombreUpper.includes('PROYECTO DE INVESTIGACION'))
    return 'NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION';

  return nombreOriginal;
}

/**
 * Obtiene el valor de una columna específica de un item
 */
export function obtenerValorColumna(item: Record<string, any>, columna: string): any {
  // Buscar coincidencia exacta primero
  if (item[columna] !== undefined) {
    return item[columna];
  }

  // Buscar por mapeo de columnas
  for (const [key, val] of Object.entries(item)) {
    const keyMapeado = mapearColumna(key);
    if (keyMapeado === columna) {
      return val;
    }
  }

  return '–';
}

