export interface NavItem {
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "fixtures"
    | "transfers"
    | "captain"
    | "live"
    | "players"
    | "chips"
    | "leagues"
    | "team"
    | "optimize"
    | "notifications"
    | "expected"
    | "simulator"
    | "chat";
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "My Team", href: "/team", icon: "team" },
  { label: "Transfers", href: "/transfers", icon: "transfers" },
  { label: "Live", href: "/live", icon: "live" },
  { label: "Fixtures", href: "/fixtures", icon: "fixtures" },
];

/** Additional nav items shown only in the sidebar */
export const secondaryNavItems: NavItem[] = [
  { label: "Captain", href: "/captain", icon: "captain" },
  { label: "Expected Pts", href: "/expected-points", icon: "expected" },
  { label: "Players", href: "/players", icon: "players" },
  { label: "Leagues", href: "/leagues", icon: "leagues" },
  { label: "Chips", href: "/chips", icon: "chips" },
  { label: "AI Chat", href: "/chat", icon: "chat" },
  { label: "AI Optimizer", href: "/optimize", icon: "optimize" },
  { label: "AI Simulator", href: "/simulator", icon: "simulator" },
  { label: "Notifications", href: "/notifications", icon: "notifications" },
];
