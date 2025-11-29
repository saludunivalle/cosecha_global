/**
 * Componente para subcategoría (pregrado, postgrado, etc.)
 */

import React from 'react';
import { useCollapsibleState } from '../hooks/useCollapsibleState';
import { calcularTotalHoras, formatearHoras } from '../utils/hours-calculator';
import ActivityTable from '../../ActivityTable';

interface SubCategorySectionProps {
  titulo: string;
  actividades: any[];
  tipoActividad: string;
}

export default React.memo(function SubCategorySection({
  titulo,
  actividades,
  tipoActividad,
}: SubCategorySectionProps) {
  const { collapsed, toggle } = useCollapsibleState(true);
  const totalHoras = calcularTotalHoras(actividades);

  return (
    <div
      className={`categoria-section ${collapsed ? 'collapsed' : ''}`}
      style={{ marginLeft: '20px' }}
    >
      <div
        className="categoria-header"
        style={{ backgroundColor: '#f8f9fa' }}
        onClick={toggle}
      >
        <span>{titulo}</span>
        <div>
          <span className="total-badge-category">
            Total: {formatearHoras(totalHoras)} horas
          </span>
          <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
        </div>
      </div>
      {!collapsed && (
        <div className="categoria-content">
          <ActivityTable actividades={actividades} tipoActividad={tipoActividad} />
        </div>
      )}
    </div>
  );
});

