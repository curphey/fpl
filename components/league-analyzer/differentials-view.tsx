import type { Differential } from '@/lib/fpl/league-analyzer';
import { Badge } from '@/components/ui/badge';

export function DifferentialsView({
  attack,
  cover,
}: {
  attack: Differential[];
  cover: Differential[];
}) {
  return (
    <div className="space-y-6">
      {/* Attack Differentials */}
      <div className="rounded-lg border border-fpl-border bg-fpl-card">
        <div className="border-b border-fpl-border px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-fpl-muted">
            Your Differentials (Attack)
          </h3>
          <p className="mt-0.5 text-xs text-fpl-muted">
            Players you own that rivals don&apos;t &mdash; sorted by form
          </p>
        </div>

        {attack.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fpl-border text-left text-xs uppercase tracking-wide text-fpl-muted">
                  <th className="px-4 py-2">Player</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Pos</th>
                  <th className="hidden px-4 py-2 md:table-cell">Team</th>
                  <th className="px-4 py-2 text-right">Form</th>
                  <th className="px-4 py-2 text-right">Exp Pts</th>
                  <th className="px-4 py-2 text-right">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fpl-border/50">
                {attack.map((d) => (
                  <tr
                    key={d.playerId}
                    className="transition-colors hover:bg-fpl-purple-light/50"
                  >
                    <td className="px-4 py-2 font-medium">{d.playerName}</td>
                    <td className="hidden px-4 py-2 text-fpl-muted sm:table-cell">
                      {d.position}
                    </td>
                    <td className="hidden px-4 py-2 text-fpl-muted md:table-cell">
                      {d.teamShortName}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-fpl-green">
                      {d.form.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {d.expectedPoints.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Badge variant="green">Attack</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-fpl-muted">
            No attack differentials &mdash; all your players are also owned by rivals.
          </div>
        )}
      </div>

      {/* Cover Differentials */}
      <div className="rounded-lg border border-fpl-border bg-fpl-card">
        <div className="border-b border-fpl-border px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-fpl-muted">
            Their Differentials (Cover)
          </h3>
          <p className="mt-0.5 text-xs text-fpl-muted">
            Players rivals own that you don&apos;t &mdash; sorted by risk
          </p>
        </div>

        {cover.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fpl-border text-left text-xs uppercase tracking-wide text-fpl-muted">
                  <th className="px-4 py-2">Player</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Pos</th>
                  <th className="hidden px-4 py-2 md:table-cell">Team</th>
                  <th className="px-4 py-2 text-right">Rivals</th>
                  <th className="px-4 py-2 text-right">Form</th>
                  <th className="hidden px-4 py-2 text-right sm:table-cell">Exp Pts</th>
                  <th className="px-4 py-2">Risk</th>
                  <th className="px-4 py-2 text-right">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fpl-border/50">
                {cover.map((d) => (
                  <tr
                    key={d.playerId}
                    className="transition-colors hover:bg-fpl-purple-light/50"
                  >
                    <td className="px-4 py-2 font-medium">{d.playerName}</td>
                    <td className="hidden px-4 py-2 text-fpl-muted sm:table-cell">
                      {d.position}
                    </td>
                    <td className="hidden px-4 py-2 text-fpl-muted md:table-cell">
                      {d.teamShortName}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {d.rivalsOwning}/{d.totalRivals}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {d.form.toFixed(1)}
                    </td>
                    <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">
                      {d.expectedPoints.toFixed(1)}
                    </td>
                    <td className="px-4 py-2">
                      <RiskBar value={d.riskScore} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Badge variant="danger">Cover</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-fpl-muted">
            No cover differentials &mdash; you own all players your rivals have.
          </div>
        )}
      </div>
    </div>
  );
}

function RiskBar({ value }: { value: number }) {
  const color =
    value >= 60 ? 'bg-fpl-danger' : value >= 30 ? 'bg-yellow-500' : 'bg-fpl-green';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-fpl-purple-light">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-fpl-muted">{value}%</span>
    </div>
  );
}
