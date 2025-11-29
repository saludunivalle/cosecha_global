/**
 * Tipos relacionados con docentes y sus asignaciones académicas
 */

export interface InformacionPersonal {
  CEDULA?: string;
  DOCENTES?: string;
  'NOMBRE COMPLETO'?: string;
  NOMBRE?: string;
  '1 APELLIDO'?: string;
  '2 APELLIDO'?: string;
  APELLIDO1?: string;
  APELLIDO2?: string;
  'UNIDAD ACADEMICA'?: string;
  unidadAcademica?: string;
  VINCULACION?: string;
  CATEGORIA?: string;
  DEDICACION?: string;
  'NIVEL ALCANZADO'?: string;
  nivelAlcanzado?: string;
  [key: string]: any; // Para campos adicionales
}

export interface ActividadPregradoPostgrado {
  CODIGO: string;
  GRUPO: string;
  TIPO: string;
  'NOMBRE DE ASIGNATURA': string;
  CRED: string;
  PORC: string;
  FREC: string;
  INTEN: string;
  'HORAS SEMESTRE': string | number;
  [key: string]: any;
}

export interface ActividadTesis {
  'CODIGO ESTUDIANTE': string;
  'COD PLAN': string;
  'TITULO DE LA TESIS': string;
  'HORAS SEMESTRE': string | number;
  [key: string]: any;
}

export interface ActividadesDocencia {
  pregrado: ActividadPregradoPostgrado[];
  postgrado: ActividadPregradoPostgrado[];
  direccionTesis: ActividadTesis[];
}

export interface ActividadInvestigacion {
  CODIGO?: string;
  'NOMBRE DEL PROYECTO DE INVESTIGACION': string;
  'HORAS SEMESTRE': string | number;
  [key: string]: any;
}

export interface ActividadExtension {
  TIPO: string;
  NOMBRE: string;
  'HORAS SEMESTRE': string | number;
  [key: string]: any;
}

export interface ActividadIntelectual {
  'APROBADO POR': string;
  TIPO: string;
  NOMBRE: string;
  'HORAS SEMESTRE': string | number;
  [key: string]: any;
}

export interface ActividadAdministrativa {
  CARGO: string;
  'DESCRIPCION DEL CARGO': string;
  'HORAS SEMESTRE': string | number;
  [key: string]: any;
}

export interface ActividadComplementaria {
  'PARTICIPACION EN': string;
  NOMBRE: string;
  'HORAS SEMESTRE': string | number;
  [key: string]: any;
}

export interface DocenteEnComision {
  'TIPO DE COMISION': string;
  DESCRIPCION: string;
  'HORAS SEMESTRE': string | number;
  [key: string]: any;
}

export interface DatosDocente {
  periodo: number;
  informacionPersonal: InformacionPersonal;
  actividadesDocencia: ActividadesDocencia;
  actividadesInvestigacion: ActividadInvestigacion[];
  actividadesExtension: ActividadExtension[];
  actividadesIntelectualesOArtisticas: ActividadIntelectual[];
  actividadesAdministrativas: ActividadAdministrativa[];
  actividadesComplementarias: ActividadComplementaria[];
  docenteEnComision: DocenteEnComision[];
}

export interface Periodo {
  idPeriod: number;
  year: number;
  term: number;
  label: string;
}

export interface ResultadoBusqueda {
  periodo: number;
  data: DatosDocente[];
  error?: string | null;
}

