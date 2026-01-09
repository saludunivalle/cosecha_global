/**
 * Componente para mostrar todas las actividades de un período
 */

import React, { useMemo } from 'react';
import CategorySection from './CategorySection';
import SubCategorySection from './SubCategorySection';
import ActivityTable from '../../ActivityTable';
import { useCollapsibleState } from '../hooks/useCollapsibleState';
import { tieneDocencia, tieneAlgunaActividad } from '../utils/activity-helpers';
import type { DatosDocente } from '@/shared/types/docente.types';
import { calcularTotalHoras } from '../utils/hours-calculator';

interface ActividadesPorPeriodoProps {
  datos: DatosDocente;
}

// Configuración de categorías para evitar repetición
const CATEGORIAS_CONFIG = [
  {
    key: 'actividadesInvestigacion',
    titulo: 'ACTIVIDADES DE INVESTIGACION',
    tipoActividad: 'actividadesdeinvestigacion',
  },
  {
    key: 'actividadesExtension',
    titulo: 'ACTIVIDADES DE EXTENSION',
    tipoActividad: 'actividadesdeextension',
  },
  {
    key: 'actividadesIntelectualesOArtisticas',
    titulo: 'ACTIVIDADES INTELECTUALES O ARTISTICAS',
    tipoActividad: 'actividadesintelectualesoartisticas',
  },
  {
    key: 'actividadesAdministrativas',
    titulo: 'ACTIVIDADES ADMINISTRATIVAS',
    tipoActividad: 'actividadesadministrativas',
  },
  {
    key: 'actividadesComplementarias',
    titulo: 'ACTIVIDADES COMPLEMENTARIAS',
    tipoActividad: 'actividadescomplementarias',
  },
  {
    key: 'docenteEnComision',
    titulo: 'DOCENTE EN COMISION',
    tipoActividad: 'docenteencomision',
  },
] as const;

const DOCENCIA_SUBCATEGORIAS = [
  { key: 'pregrado' as const, titulo: 'PREGRADO', tipoActividad: 'pregrado' },
  { key: 'postgrado' as const, titulo: 'POSTGRADO', tipoActividad: 'postgrado' },
  {
    key: 'direccionTesis' as const,
    titulo: 'DIRECCIÓN DE TESIS',
    tipoActividad: 'direcciondetesis',
  },
] as const;

export default React.memo(function ActividadesPorPeriodo({
  datos,
}: ActividadesPorPeriodoProps) {
  const docenciaState = useCollapsibleState(true);
  const investigacionState = useCollapsibleState(true);
  const extensionState = useCollapsibleState(true);
  const intelectualesState = useCollapsibleState(true);
  const administrativasState = useCollapsibleState(true);
  const complementariasState = useCollapsibleState(true);
  const comisionState = useCollapsibleState(true);

  const estadosCategorias = useMemo(
    () => ({
      actividadesInvestigacion: investigacionState,
      actividadesExtension: extensionState,
      actividadesIntelectualesOArtisticas: intelectualesState,
      actividadesAdministrativas: administrativasState,
      actividadesComplementarias: complementariasState,
      docenteEnComision: comisionState,
    }),
    [
      investigacionState,
      extensionState,
      intelectualesState,
      administrativasState,
      complementariasState,
      comisionState,
    ]
  );

  const tieneDocenciaFlag = useMemo(() => tieneDocencia(datos), [datos]);
  const algunaActividad = useMemo(() => tieneAlgunaActividad(datos), [datos]);

  const actividadesDocencia = datos.actividadesDocencia || {};
  const totalHorasDocencia = calcularTotalHoras([
    ...(actividadesDocencia.pregrado || []),
    ...(actividadesDocencia.postgrado || []),
    ...(actividadesDocencia.direccionTesis || []),
  ])
  return (
    <>
      {/* ACTIVIDADES DE DOCENCIA */}
      {tieneDocenciaFlag && (
        <CategorySection
          titulo="ACTIVIDADES DE DOCENCIA"
          collapsed={docenciaState.collapsed}
          onToggle={docenciaState.toggle}
          totalHoras={totalHorasDocencia}
        >
          {actividadesDocencia.pregrado?.length > 0 && (
            <SubCategorySection
              titulo="PREGRADO"
              actividades={actividadesDocencia.pregrado}
              tipoActividad="pregrado"
            />
          )}
          {actividadesDocencia.postgrado?.length > 0 && (
            <SubCategorySection
              titulo="POSTGRADO"
              actividades={actividadesDocencia.postgrado}
              tipoActividad="postgrado"
            />
          )}
          {actividadesDocencia.direccionTesis?.length > 0 && (
            <SubCategorySection
              titulo="DIRECCIÓN DE TESIS"
              actividades={actividadesDocencia.direccionTesis}
              tipoActividad="direcciondetesis"
            />
          )}
        </CategorySection>
      )}

      {/* OTRAS ACTIVIDADES */}
      {CATEGORIAS_CONFIG.map((categoria) => {
        const actividades = datos[categoria.key];
        if (!actividades || !Array.isArray(actividades) || actividades.length === 0) {
          return null;
        }

        const estado = estadosCategorias[categoria.key];
        const totalHorasCategoria = calcularTotalHoras(actividades);
        return (
          <CategorySection
            key={categoria.key}
            titulo={categoria.titulo}
            collapsed={estado.collapsed}
            onToggle={estado.toggle}
            totalHoras={totalHorasCategoria}
          >
            <ActivityTable
              actividades={actividades}
              tipoActividad={categoria.tipoActividad}
            />
          </CategorySection>
        );
      })}

      {!algunaActividad && (
        <div className="tabla-vacia">
          No se encontraron actividades en ninguna categoría.
        </div>
      )}
    </>
  );
});

