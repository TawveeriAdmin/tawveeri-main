'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface AdminSidebarContextValue {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const AdminSidebarContext = createContext<AdminSidebarContextValue | null>(null);

export function AdminSidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AdminSidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </AdminSidebarContext.Provider>
  );
}

export function useAdminSidebar() {
  const ctx = useContext(AdminSidebarContext);
  if (!ctx) throw new Error('useAdminSidebar must be used within AdminSidebarProvider');
  return ctx;
}
