/**
 * Constantes utilizadas en el parser de HTML
 */

export const DEBUG_PARSER = process.env.NODE_ENV === 'development' || process.env.DEBUG_PARSER === 'true';

/**
 * Entidades HTML comunes para decodificación
 */
export const HTML_ENTITIES: Record<string, string> = {
  '&aacute;': 'á',
  '&Aacute;': 'Á',
  '&eacute;': 'é',
  '&Eacute;': 'É',
  '&iacute;': 'í',
  '&Iacute;': 'Í',
  '&oacute;': 'ó',
  '&Oacute;': 'Ó',
  '&uacute;': 'ú',
  '&Uacute;': 'Ú',
  '&ntilde;': 'ñ',
  '&Ntilde;': 'Ñ',
  '&amp;': '&',
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

/**
 * Keywords para identificar postgrado
 */
export const KEYWORDS_POSTGRADO = [
  'MAESTRIA',
  'MAESTRÍA',
  'MAGISTER',
  'MASTER',
  'MAESTR',
  'DOCTORADO',
  'DOCTORAL',
  'PHD',
  'DOCTOR',
  'ESPECIALIZA',
  'ESPECIALIZACION',
  'ESPECIALIZACIÓN',
  'POSTGRADO',
  'POSGRADO',
  'POST-GRADO',
  'POST GRADO',
  'POSTGRADUADO',
  'POSGRADUADO',
] as const;

/**
 * Keywords para identificar pregrado
 */
export const KEYWORDS_PREGRADO = [
  'LICENCIATURA',
  'INGENIERIA',
  'INGENERÍA',
  'BACHILLERATO',
  'TECNOLOGIA',
  'TECNOLOGÍA',
  'PROFESIONAL',
  'CARRERA',
  'PREGRADO',
  'PRIMER CICLO',
  'UNDERGRADUATE',
  'TECNICO',
  'TÉCNICO',
] as const;

/**
 * Headers conocidos que deben ser excluidos de valores
 */
export const KNOWN_HEADERS = [
  'VINCULACION',
  'VINCULACIÓN',
  'CATEGORIA',
  'CATEGORÍA',
  'DEDICACION',
  'DEDICACIÓN',
  'NIVEL ALCANZADO',
] as const;

/**
 * Patrones de período para extracción
 */
export const PERIODO_PATTERNS = [
  /\d{4}[-\s]?\d{1,2}/g,  // 2024-1, 2024 1, 20241
  /semestre\s*\d+/gi,      // semestre 1, SEMESTRE 2
  /periodo\s*\d{4}/gi,     // periodo 2024
  /\d{4}\s*[-\s]\s*0?([12])/g, // 2024 - 1, 2024-01
] as const;

