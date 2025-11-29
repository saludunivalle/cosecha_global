/**
 * Utilidades para cálculos de horas
 */

import { extraerHorasSemestre } from '@/web/lib/data-processor';

/**
 * Calcula el total de horas de un array de actividades
 */
export function calcularTotalHoras(actividades: any[]): number {
  return actividades.reduce((sum, act) => {
    return sum + extraerHorasSemestre(act['HORAS SEMESTRE']);
  }, 0);
}

/**
 * Formatea horas con 1 decimal
 */
export function formatearHoras(horas: number): string {
  return horas.toFixed(1);
}

