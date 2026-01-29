"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, secondaryNavItems } from "./nav-items";
import { NavIcon } from "./nav-icon";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed bottom-0 left-0 top-14 z-50 w-60 border-r border-fpl-border bg-fpl-purple-dark transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:scale-[0.98] ${
                  isActive
                    ? "bg-fpl-purple-light text-fpl-green"
                    : "text-fpl-muted hover:bg-fpl-purple-light/50 hover:text-foreground"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}

          {/* Separator */}
          <div className="my-2 border-t border-fpl-border" />
          <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-fpl-muted">
            Analytics
          </span>

          {secondaryNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:scale-[0.98] ${
                  isActive
                    ? "bg-fpl-purple-light text-fpl-green"
                    : "text-fpl-muted hover:bg-fpl-purple-light/50 hover:text-foreground"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
