/**
 * Vista principal de períodos
 * Componente refactorizado - < 200 líneas
 */

'use client';

import React from 'react';
import PeriodCardList from './period-view/components/PeriodCardList';
import type { ResultadoBusqueda } from '@/shared/types/docente.types';

interface PeriodViewProps {
  resultados: ResultadoBusqueda[];
  periodosNombres: Record<number, string>;
}

export default React.memo(function PeriodView({
  resultados,
  periodosNombres,
}: PeriodViewProps) {
  return <PeriodCardList resultados={resultados} periodosNombres={periodosNombres} />;
});
