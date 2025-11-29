/**
 * Componente para lista de tarjetas de períodos
 */

import React, { useMemo } from 'react';
import PeriodCard from './PeriodCard';
import type { ResultadoBusqueda } from '@/shared/types/docente.types';

interface PeriodCardListProps {
  resultados: ResultadoBusqueda[];
  periodosNombres: Record<number, string>;
}

export default React.memo(function PeriodCardList({
  resultados,
  periodosNombres,
}: PeriodCardListProps) {
  const periodCards = useMemo(() => {
    return resultados.map((res) => {
      const periodo = res.periodo;
      const periodoLabel = periodosNombres[periodo] || String(periodo);

      if (res.error) {
        return (
          <PeriodCard
            key={periodo}
            periodo={periodo}
            periodoLabel={periodoLabel}
            error={res.error}
          />
        );
      }

      if (!res.data || res.data.length === 0) {
        return (
          <PeriodCard
            key={periodo}
            periodo={periodo}
            periodoLabel={periodoLabel}
            error="No hay datos disponibles"
          />
        );
      }

      return (
        <PeriodCard
          key={periodo}
          periodo={periodo}
          periodoLabel={periodoLabel}
          datos={res.data[0]}
        />
      );
    });
  }, [resultados, periodosNombres]);

  return <>{periodCards}</>;
});

