/**
 * Hook para calcular horas totales de un período
 */

import { useMemo } from 'react';
import { extraerHorasSemestre } from '@/web/lib/data-processor';
import type { DatosDocente } from '@/shared/types/docente.types';

/**
 * Calcula el total de horas de un período
 */
export function usePeriodHours(datos?: DatosDocente): number {
  return useMemo(() => {
    if (!datos) return 0;

    let total = 0;

    // Calcular horas de docencia
    if (datos.actividadesDocencia) {
      const { pregrado, postgrado, direccionTesis } = datos.actividadesDocencia;
      [...pregrado, ...postgrado, ...direccionTesis].forEach((act) => {
        total += extraerHorasSemestre(act['HORAS SEMESTRE']);
      });
    }

    // Calcular horas de otras actividades
    const otrasActividades = [
      datos.actividadesInvestigacion,
      datos.actividadesExtension,
      datos.actividadesIntelectualesOArtisticas,
      datos.actividadesAdministrativas,
      datos.actividadesComplementarias,
      datos.docenteEnComision,
    ];

    otrasActividades.forEach((acts) => {
      if (Array.isArray(acts)) {
        acts.forEach((act) => {
          total += extraerHorasSemestre(act['HORAS SEMESTRE']);
        });
      }
    });

    return total;
  }, [datos]);
}

