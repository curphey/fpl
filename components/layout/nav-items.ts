export interface NavItem {
  label: string;
  href: string;
  icon: 'dashboard' | 'fixtures' | 'transfers' | 'captain' | 'live' | 'players' | 'chips';
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard' },
  { label: 'Fixtures', href: '/fixtures', icon: 'fixtures' },
  { label: 'Transfers', href: '/transfers', icon: 'transfers' },
  { label: 'Captain', href: '/captain', icon: 'captain' },
  { label: 'Live', href: '/live', icon: 'live' },
];

/** Additional nav items shown only in the sidebar */
export const secondaryNavItems: NavItem[] = [
  { label: 'Players', href: '/players', icon: 'players' },
  { label: 'Chips', href: '/chips', icon: 'chips' },
];
