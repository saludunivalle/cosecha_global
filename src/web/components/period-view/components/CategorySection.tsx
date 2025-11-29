/**
 * Componente para sección de categoría colapsable
 */

import React from 'react';

interface CategorySectionProps {
  titulo: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default React.memo(function CategorySection({
  titulo,
  collapsed,
  onToggle,
  children,
}: CategorySectionProps) {
  return (
    <div className={`categoria-section ${collapsed ? 'collapsed' : ''}`}>
      <div className="categoria-header" onClick={onToggle}>
        <span>{titulo}</span>
        <i className={`bi bi-chevron-${collapsed ? 'down' : 'up'} toggle-icon`}></i>
      </div>
      {!collapsed && <div className="categoria-content">{children}</div>}
    </div>
  );
});

