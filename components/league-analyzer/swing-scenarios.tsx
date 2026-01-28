import type { SwingScenario } from '@/lib/fpl/league-analyzer';

export function SwingScenariosTable({
  data,
}: {
  data: SwingScenario[];
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center text-sm text-fpl-muted">
        No swing scenarios &mdash; you own all players your rivals have.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card">
      <div className="border-b border-fpl-border px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fpl-muted">
          Points Swing Scenarios
        </h3>
        <p className="mt-0.5 text-xs text-fpl-muted">
          Net impact on your average rank gap if a player you don&apos;t own scores
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fpl-border text-left text-xs uppercase tracking-wide text-fpl-muted">
              <th className="px-4 py-2">Player</th>
              <th className="hidden px-4 py-2 sm:table-cell">Pos</th>
              <th className="hidden px-4 py-2 md:table-cell">Team</th>
              <th className="px-4 py-2 text-right">Rivals</th>
              <th className="px-4 py-2 text-right">If 2pts</th>
              <th className="px-4 py-2 text-right">If 6pts</th>
              <th className="px-4 py-2 text-right">If 10pts</th>
              <th className="px-4 py-2 text-right">If 15pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fpl-border/50">
            {data.map((row) => (
              <tr
                key={row.playerId}
                className="transition-colors hover:bg-fpl-purple-light/50"
              >
                <td className="px-4 py-2 font-medium">{row.playerName}</td>
                <td className="hidden px-4 py-2 text-fpl-muted sm:table-cell">
                  {row.position}
                </td>
                <td className="hidden px-4 py-2 text-fpl-muted md:table-cell">
                  {row.teamShortName}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.rivalsOwning}/{row.totalRivals}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <ImpactCell value={row.netImpact2} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <ImpactCell value={row.netImpact6} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <ImpactCell value={row.netImpact10} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <ImpactCell value={row.netImpact15} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImpactCell({ value }: { value: number }) {
  const color = value < -3 ? 'text-fpl-danger' : value < -1 ? 'text-yellow-400' : 'text-fpl-muted';
  return <span className={color}>{value.toFixed(1)}</span>;
}
