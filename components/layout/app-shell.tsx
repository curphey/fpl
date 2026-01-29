"use client";

import { useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { ManagerProvider } from "@/lib/fpl/manager-context";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ManagerProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Header onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="pb-16 lg:ml-60 lg:pb-0">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
        <MobileNav />
      </div>
    </ManagerProvider>
  );
}
