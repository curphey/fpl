"use client";

import { useState, useCallback } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { ManagerProvider } from "@/lib/fpl/manager-context";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useEdgeSwipe } from "@/lib/hooks/use-edge-swipe";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Swipe from left edge to open sidebar (mobile only)
  useEdgeSwipe({
    edge: "left",
    edgeWidth: 20,
    threshold: 50,
    enabled: !sidebarOpen,
    onSwipe: openSidebar,
  });

  return (
    <ManagerProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Header onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />
        <main className="pb-20 lg:ml-60 lg:pb-0">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
        <MobileNav />
      </div>
    </ManagerProvider>
  );
}
