/**
 * Componente para sección de categoría colapsable
 */

import React from 'react';
import { formatearHoras } from '../utils/hours-calculator';

interface CategorySectionProps {
  titulo: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  totalHoras?: number;
}

export default React.memo(function CategorySection({
  titulo,
  collapsed,
  onToggle,
  children,
  totalHoras,
}: CategorySectionProps) {
  return (
    <div className={`categoria-section ${collapsed ? 'collapsed' : ''}`}>
      <div className="categoria-header" onClick={onToggle} style={{ display: 'flex', alignItems: 'center' }}>
        <span>{titulo}</span>
        <div style={{ marginLeft: 'auto' }}>
          {
            typeof totalHoras === 'number' && (
          <span className="total-badge-category" >
               Total: {formatearHoras(totalHoras)} horas
          </span>
)}
        </div>
        <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
      </div>
      {!collapsed && <div className="categoria-content">{children}</div>}
    </div>
  );
});

