/**
 * Componente para tarjeta de período
 */

import React from 'react';
import { useCollapsibleState } from '../hooks/useCollapsibleState';
import { usePeriodHours } from '../hooks/usePeriodHours';
import ActividadesPorPeriodo from './ActividadesPorPeriodo';

interface PeriodCardProps {
  periodo: number;
  periodoLabel: string;
  datos?: any;
  error?: string;
}

export default React.memo(function PeriodCard({
  periodo,
  periodoLabel,
  datos,
  error,
}: PeriodCardProps) {
  const { collapsed, toggle } = useCollapsibleState(true);
  const totalHoras = usePeriodHours(datos);

  if (error) {
    return (
      <div className="card periodo-card collapsed">
        <div className="card-header" onClick={toggle}>
          <span>Período: {periodoLabel}</span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
        {!collapsed && (
          <div className="card-body">
            <div className="tabla-vacia">
              {error === 'No hay datos disponibles'
                ? 'No se encontraron actividades en ninguna categoría.'
                : 'Ocurrió un error al obtener datos para este período.'}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`card periodo-card ${collapsed ? 'collapsed' : ''}`}>
      <div className="card-header" onClick={toggle}>
        <span>Período: {periodoLabel}</span>
        <div>
          <span className="total-badge">Total: {totalHoras.toFixed(1)} horas</span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
      </div>
      {!collapsed && datos && (
        <div className="card-body">
          <ActividadesPorPeriodo datos={datos} />
        </div>
      )}
    </div>
  );
});

