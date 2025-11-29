/**
 * Utilidades para trabajar con actividades
 */

import type { DatosDocente } from '@/shared/types/docente.types';

/**
 * Verifica si hay actividades de docencia
 */
export function tieneDocencia(datos?: DatosDocente): boolean {
  if (!datos?.actividadesDocencia) return false;

  const { pregrado, postgrado, direccionTesis } = datos.actividadesDocencia;
  return (
    (pregrado?.length ?? 0) > 0 ||
    (postgrado?.length ?? 0) > 0 ||
    (direccionTesis?.length ?? 0) > 0
  );
}

/**
 * Verifica si hay alguna actividad en el período
 */
export function tieneAlgunaActividad(datos?: DatosDocente): boolean {
  if (!datos) return false;

  return (
    tieneDocencia(datos) ||
    (datos.actividadesInvestigacion?.length ?? 0) > 0 ||
    (datos.actividadesExtension?.length ?? 0) > 0 ||
    (datos.actividadesIntelectualesOArtisticas?.length ?? 0) > 0 ||
    (datos.actividadesAdministrativas?.length ?? 0) > 0 ||
    (datos.actividadesComplementarias?.length ?? 0) > 0 ||
    (datos.docenteEnComision?.length ?? 0) > 0
  );
}

