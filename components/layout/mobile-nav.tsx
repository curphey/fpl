"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";
import { NavIcon } from "./nav-icon";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-fpl-border bg-fpl-purple pb-safe lg:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors active:scale-95 ${
              isActive
                ? "text-fpl-green"
                : "text-fpl-muted hover:text-foreground"
            }`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
