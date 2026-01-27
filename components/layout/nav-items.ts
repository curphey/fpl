export interface NavItem {
  label: string;
  href: string;
  icon: 'dashboard' | 'fixtures' | 'transfers' | 'captain' | 'live';
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard' },
  { label: 'Fixtures', href: '/fixtures', icon: 'fixtures' },
  { label: 'Transfers', href: '/transfers', icon: 'transfers' },
  { label: 'Captain', href: '/captain', icon: 'captain' },
  { label: 'Live', href: '/live', icon: 'live' },
];
