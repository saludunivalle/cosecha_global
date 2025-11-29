'use client';

import { useState } from 'react';
import PeriodView from './PeriodView';
import ActivityView from './ActivityView';
import ViewToggle from './ViewToggle';
import { consolidarDatosPorCategoria } from '@/web/lib/data-processor';
import type { ResultadoBusqueda } from '@/shared/types/docente.types';
import type { DatosConsolidados } from '@/web/lib/types';

interface ActivitiesViewProps {
  resultados: ResultadoBusqueda[];
  periodosNombres: Record<number, string>;
  periodos: number[];
}

export default function ActivitiesView({
  resultados,
  periodosNombres,
  periodos,
}: ActivitiesViewProps) {
  const [vistaPorActividad, setVistaPorActividad] = useState(false);

  // Consolidar datos por categoría
  const datosConsolidados: DatosConsolidados = consolidarDatosPorCategoria(resultados);

  return (
    <>
      <ViewToggle
        checked={vistaPorActividad}
        onChange={setVistaPorActividad}
      />
      
      {vistaPorActividad ? (
        <ActivityView
          resultados={resultados}
          datosConsolidados={datosConsolidados}
          periodosNombres={periodosNombres}
          periodos={periodos}
        />
      ) : (
        <PeriodView
          resultados={resultados}
          periodosNombres={periodosNombres}
        />
      )}
    </>
  );
}

