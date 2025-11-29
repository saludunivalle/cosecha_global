/**
 * Hook reutilizable para manejar estado de colapso
 */

import { useState, useCallback } from 'react';

/**
 * Hook para manejar estado de elementos colapsables
 */
export function useCollapsibleState(initialState: boolean = true) {
  const [collapsed, setCollapsed] = useState(initialState);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const expand = useCallback(() => {
    setCollapsed(false);
  }, []);

  const collapse = useCallback(() => {
    setCollapsed(true);
  }, []);

  return {
    collapsed,
    toggle,
    expand,
    collapse,
    setCollapsed,
  };
}

