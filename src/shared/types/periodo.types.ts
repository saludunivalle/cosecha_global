/**
 * Tipos relacionados con períodos académicos
 */

export interface Periodo {
  idPeriod: number;
  year: number;
  term: number;
  label: string;
}

export interface PeriodoResponse {
  periodos: Periodo[];
}

