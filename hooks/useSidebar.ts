import { useState, useCallback } from 'react';

export interface UseSidebarResult {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

export function useSidebar(initialOpen = false): UseSidebarResult {
  const [sidebarOpen, setSidebarOpen] = useState(initialOpen);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  return {
    sidebarOpen,
    setSidebarOpen,
    openSidebar,
    closeSidebar,
    toggleSidebar,
  };
}
