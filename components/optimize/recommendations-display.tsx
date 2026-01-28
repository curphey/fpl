import type {
  OptimizationType,
  TransferRecommendation,
  ChipRecommendation,
  WildcardRecommendation,
} from '@/lib/claude/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface RecommendationsDisplayProps {
  type: OptimizationType;
  summary: string;
  recommendations: TransferRecommendation[] | ChipRecommendation | WildcardRecommendation;
  warnings?: string[];
  processingTime: number;
}

export function RecommendationsDisplay({
  type,
  summary,
  recommendations,
  warnings,
  processingTime,
}: RecommendationsDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm">{summary}</p>
          <p className="mt-2 text-xs text-fpl-muted">
            Processed in {(processingTime / 1000).toFixed(1)}s
          </p>
        </CardContent>
      </Card>

      {/* Type-specific display */}
      {type === 'transfer' && Array.isArray(recommendations) && (
        <TransferRecommendations transfers={recommendations as TransferRecommendation[]} />
      )}

      {type === 'chip' && !Array.isArray(recommendations) && (
        <ChipRecommendationDisplay recommendation={recommendations as ChipRecommendation} />
      )}

      {type === 'wildcard' && !Array.isArray(recommendations) && (
        <WildcardRecommendationDisplay
          recommendation={recommendations as WildcardRecommendation}
        />
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <h4 className="mb-2 text-sm font-semibold text-yellow-400">Warnings</h4>
          <ul className="list-inside list-disc space-y-1 text-xs text-yellow-300">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TransferRecommendations({
  transfers,
}: {
  transfers: TransferRecommendation[];
}) {
  if (!transfers.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-fpl-muted">
          No transfer recommendations generated.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {transfers.map((transfer, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transfer {i + 1}</CardTitle>
              <Badge
                variant={
                  transfer.confidence === 'high'
                    ? 'green'
                    : transfer.confidence === 'medium'
                      ? 'default'
                      : 'pink'
                }
              >
                {transfer.confidence} confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Out */}
              <div className="rounded-lg border border-fpl-danger/30 bg-fpl-danger/10 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-fpl-danger">
                  Sell
                </div>
                <div className="font-medium">
                  {transfer.out.name}{' '}
                  <span className="text-fpl-muted">({transfer.out.team})</span>
                </div>
                <div className="text-sm text-fpl-muted">
                  £{transfer.out.price}m
                </div>
                <div className="mt-2 text-xs text-fpl-muted">
                  {transfer.out.reason}
                </div>
              </div>

              {/* In */}
              <div className="rounded-lg border border-fpl-green/30 bg-fpl-green/10 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-fpl-green">
                  Buy
                </div>
                <div className="font-medium">
                  {transfer.in.name}{' '}
                  <span className="text-fpl-muted">({transfer.in.team})</span>
                </div>
                <div className="text-sm text-fpl-muted">
                  £{transfer.in.price}m
                </div>
                <div className="mt-2 text-xs text-fpl-muted">
                  {transfer.in.reason}
                </div>
              </div>
            </div>

            <div className="mt-3 text-right text-xs text-fpl-muted">
              Net cost:{' '}
              <span
                className={
                  transfer.netCost > 0
                    ? 'text-fpl-danger'
                    : transfer.netCost < 0
                      ? 'text-fpl-green'
                      : ''
                }
              >
                {transfer.netCost > 0 ? '+' : ''}£{transfer.netCost}m
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChipRecommendationDisplay({
  recommendation,
}: {
  recommendation: ChipRecommendation;
}) {
  if (!recommendation?.chip) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-fpl-muted">
          No chip recommendation generated.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{recommendation.chip.toUpperCase()}</CardTitle>
          <Badge
            variant={
              recommendation.confidence === 'high'
                ? 'green'
                : recommendation.confidence === 'medium'
                  ? 'default'
                  : 'pink'
            }
          >
            {recommendation.confidence} confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-fpl-green/20 px-4 py-2 text-center">
            <div className="text-2xl font-bold text-fpl-green">
              GW{recommendation.recommendedGameweek}
            </div>
            <div className="text-xs text-fpl-muted">Recommended</div>
          </div>
        </div>

        <p className="text-sm">{recommendation.reasoning}</p>

        {recommendation.alternatives && recommendation.alternatives.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase text-fpl-muted">
              Alternatives
            </h4>
            <ul className="space-y-1">
              {recommendation.alternatives.map((alt, i) => (
                <li key={i} className="text-xs text-fpl-muted">
                  <span className="font-medium">GW{alt.gameweek}</span>:{' '}
                  {alt.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WildcardRecommendationDisplay({
  recommendation,
}: {
  recommendation: WildcardRecommendation;
}) {
  if (!recommendation?.team?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-fpl-muted">
          No wildcard recommendation generated.
        </CardContent>
      </Card>
    );
  }

  const byPosition: Record<string, typeof recommendation.team> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  for (const player of recommendation.team) {
    const pos = player.position.toUpperCase();
    if (byPosition[pos]) {
      byPosition[pos].push(player);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Wildcard Squad</CardTitle>
            <Badge variant="green">{recommendation.formation}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
              <div key={pos}>
                <h4 className="mb-2 text-xs font-semibold uppercase text-fpl-muted">
                  {pos}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {byPosition[pos].map((player, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-fpl-purple-light px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{player.name}</span>
                      <span className="ml-1 text-fpl-muted">
                        ({player.team}) £{player.price}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-right text-sm">
            Total: <span className="font-bold">£{recommendation.totalCost}m</span>
          </div>
        </CardContent>
      </Card>

      {recommendation.keyPicks && recommendation.keyPicks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Picks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendation.keyPicks.map((pick, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-fpl-green">{pick.name}</span>
                  <span className="ml-2 text-fpl-muted">{pick.reason}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {recommendation.differentials && recommendation.differentials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Differentials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recommendation.differentials.map((name, i) => (
                <Badge key={i} variant="pink">
                  {name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
