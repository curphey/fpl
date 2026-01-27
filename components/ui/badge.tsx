const variantClasses: Record<string, string> = {
  default: 'bg-fpl-purple-light text-foreground',
  green: 'bg-fpl-green/20 text-fpl-green',
  pink: 'bg-fpl-pink/20 text-fpl-pink',
  danger: 'bg-fpl-danger/20 text-fpl-danger',
  gk: 'bg-yellow-500/20 text-yellow-400',
  def: 'bg-blue-500/20 text-blue-400',
  mid: 'bg-green-500/20 text-green-400',
  fwd: 'bg-red-500/20 text-red-400',
};

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: keyof typeof variantClasses;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant] ?? variantClasses.default} ${className}`}
    >
      {children}
    </span>
  );
}

const positionVariantMap: Record<number, keyof typeof variantClasses> = {
  1: 'gk',
  2: 'def',
  3: 'mid',
  4: 'fwd',
};

export function PositionBadge({
  position,
  label,
}: {
  position: number;
  label: string;
}) {
  return <Badge variant={positionVariantMap[position] ?? 'default'}>{label}</Badge>;
}
