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
    | "notifications";
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Fixtures", href: "/fixtures", icon: "fixtures" },
  { label: "Transfers", href: "/transfers", icon: "transfers" },
  { label: "Captain", href: "/captain", icon: "captain" },
  { label: "Live", href: "/live", icon: "live" },
];

/** Additional nav items shown only in the sidebar */
export const secondaryNavItems: NavItem[] = [
  { label: "My Team", href: "/team", icon: "team" },
  { label: "Players", href: "/players", icon: "players" },
  { label: "Leagues", href: "/leagues", icon: "leagues" },
  { label: "Chips", href: "/chips", icon: "chips" },
  { label: "AI Optimizer", href: "/optimize", icon: "optimize" },
  { label: "Notifications", href: "/notifications", icon: "notifications" },
];
