import { Card } from './card';

export function StatCard({
  label,
  value,
  subvalue,
  className = '',
}: {
  label: string;
  value: string | number;
  subvalue?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-fpl-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-fpl-green">{value}</p>
      {subvalue && (
        <p className="mt-0.5 text-xs text-fpl-muted">{subvalue}</p>
      )}
    </Card>
  );
}
