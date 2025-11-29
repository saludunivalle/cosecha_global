/**
 * Tipos específicos del módulo web
 */

export type VistaModo = 'periodo' | 'actividad';

export interface DatosConsolidados {
  pregrado: Record<number, any[]>;
  postgrado: Record<number, any[]>;
  direccionTesis: Record<number, any[]>;
  actividadesInvestigacion: Record<number, any[]>;
  actividadesExtension: Record<number, any[]>;
  actividadesIntelectualesOArtisticas: Record<number, any[]>;
  actividadesAdministrativas: Record<number, any[]>;
  actividadesComplementarias: Record<number, any[]>;
  docenteEnComision: Record<number, any[]>;
}

