/**
 * Normalizadores de estructuras de datos
 */

import type {
  ActividadPregradoPostgrado,
  ActividadTesis,
} from '@/shared/types/docente.types';

/**
 * Normaliza estructura de asignatura (pregrado/postgrado)
 */
export function normalizarEstructuraAsignatura(
  obj: Record<string, string>,
  headers: string[]
): ActividadPregradoPostgrado {
  const estructuraNormalizada: ActividadPregradoPostgrado = {
    CODIGO: '',
    GRUPO: '',
    TIPO: '',
    'NOMBRE DE ASIGNATURA': '',
    CRED: '',
    PORC: '',
    FREC: '',
    INTEN: '',
    'HORAS SEMESTRE': '',
  };

  headers.forEach((header) => {
    const headerUpper = header.toUpperCase();
    const valor = obj[header] || '';

    if (headerUpper.includes('CODIGO')) estructuraNormalizada.CODIGO = valor;
    else if (headerUpper.includes('GRUPO')) estructuraNormalizada.GRUPO = valor;
    else if (headerUpper.includes('TIPO')) estructuraNormalizada.TIPO = valor;
    else if (headerUpper.includes('NOMBRE') && headerUpper.includes('ASIGNATURA'))
      estructuraNormalizada['NOMBRE DE ASIGNATURA'] = valor;
    else if (headerUpper.includes('CRED')) estructuraNormalizada.CRED = valor;
    else if (headerUpper.includes('PORC')) estructuraNormalizada.PORC = valor;
    else if (headerUpper.includes('FREC')) estructuraNormalizada.FREC = valor;
    else if (headerUpper.includes('INTEN')) estructuraNormalizada.INTEN = valor;
    else if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
             headerUpper === 'HORAS SEMESTRE' ||
             (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
             headerUpper === 'HORAS')
      estructuraNormalizada['HORAS SEMESTRE'] = valor;
  });

  return estructuraNormalizada;
}

/**
 * Normaliza estructura de dirección de tesis
 */
export function normalizarEstructuraTesis(
  obj: Record<string, string>,
  headers: string[]
): ActividadTesis {
  const estructuraNormalizada: ActividadTesis = {
    'CODIGO ESTUDIANTE': '',
    'COD PLAN': '',
    'TITULO DE LA TESIS': '',
    'HORAS SEMESTRE': '',
  };

  headers.forEach((header) => {
    const headerUpper = header.toUpperCase().trim();
    const valor = obj[header] || '';

    // IMPORTANTE: Primero copiar todos los campos al objeto normalizado
    estructuraNormalizada[header as keyof ActividadTesis] = valor as any;

    // Luego normalizar campos específicos
    if (headerUpper.includes('CODIGO') && headerUpper.includes('ESTUDIANTE')) {
      estructuraNormalizada['CODIGO ESTUDIANTE'] = valor;
    } else if (headerUpper.includes('COD') && headerUpper.includes('PLAN')) {
      estructuraNormalizada['COD PLAN'] = valor;
    } else if (headerUpper === 'PLAN' || headerUpper.includes('PLAN')) {
      estructuraNormalizada['COD PLAN'] = valor;
    } else if (headerUpper.includes('TITULO') && headerUpper.includes('TESIS')) {
      estructuraNormalizada['TITULO DE LA TESIS'] = valor;
    } else if (headerUpper === 'TITULO' || headerUpper.includes('TITULO')) {
      estructuraNormalizada['TITULO DE LA TESIS'] = valor;
    } else if (headerUpper.includes('APROBADO') && headerUpper.includes('POR')) {
      estructuraNormalizada['APROBADO POR' as any] = valor;
    } else if (headerUpper.includes('NOMBRE') && 
               (headerUpper.includes('ANTEPROYECTO') || 
                headerUpper.includes('PROPUESTA') || 
                headerUpper.includes('INVESTIGACION'))) {
      estructuraNormalizada['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION' as any] = valor;
      if (!estructuraNormalizada['TITULO DE LA TESIS']) {
        estructuraNormalizada['TITULO DE LA TESIS'] = valor;
      }
    } else if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
               headerUpper === 'HORAS SEMESTRE' ||
               (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
               headerUpper === 'HORAS') {
      estructuraNormalizada['HORAS SEMESTRE'] = valor;
    }
  });

  return estructuraNormalizada;
}

/**
 * Normaliza campo HORAS SEMESTRE desde headers
 */
export function normalizarHorasSemestre(
  headerUpper: string,
  valor: string
): string | undefined {
  if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
      headerUpper === 'HORAS SEMESTRE' ||
      (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
      headerUpper === 'HORAS') {
    return valor;
  }
  return undefined;
}

