import type { TransferPrediction } from "@/lib/db/gw-plan";

const STATUS_LABELS: Record<TransferPrediction["status"], string> = {
  pending: "Tracking",
  on_track: "On Track",
  hit: "Hit",
  miss: "Miss",
};

const STATUS_COLORS: Record<TransferPrediction["status"], string> = {
  pending: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  on_track: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  hit: "bg-green-500/20 text-green-400 border-green-500/30",
  miss: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_CARD_BORDERS: Record<TransferPrediction["status"], string> = {
  pending: "border-gray-500/20",
  on_track: "border-blue-500/30",
  hit: "border-green-500/30",
  miss: "border-red-500/30",
};

function computeAccuracy(predicted: number, actual: number): number | null {
  if (predicted === 0) return null;
  return Math.round((actual / predicted) * 100);
}

function AccuracyBadge({ accuracy }: { accuracy: number | null }) {
  if (accuracy === null) return null;

  const color =
    accuracy >= 80
      ? "text-green-400"
      : accuracy >= 0
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <span className={`text-sm font-bold ${color}`}>
      {accuracy >= 0 ? "+" : ""}
      {accuracy}%
    </span>
  );
}

function GwBreakdown({ gwActuals }: { gwActuals: Record<string, number> }) {
  const entries = Object.entries(gwActuals).sort(
    ([a], [b]) => Number(a) - Number(b),
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 flex gap-1.5">
      {entries.map(([gw, pts]) => (
        <div
          key={gw}
          className="flex flex-col items-center rounded bg-white/5 px-2 py-1"
        >
          <span className="text-[10px] text-fpl-muted">GW{gw}</span>
          <span
            className={`text-xs font-semibold ${pts > 0 ? "text-green-400" : pts < 0 ? "text-red-400" : "text-gray-400"}`}
          >
            {pts > 0 ? "+" : ""}
            {pts}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TransferTracker({
  predictions,
}: {
  predictions: TransferPrediction[];
}) {
  if (predictions.length === 0) return null;

  // Summary stats
  const completed = predictions.filter(
    (p) => p.status === "hit" || p.status === "miss",
  );
  const hits = completed.filter((p) => p.status === "hit").length;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Transfer Tracker
        </h3>
        {completed.length > 0 && (
          <span className="text-xs text-fpl-muted">
            {hits}/{completed.length} accurate
          </span>
        )}
      </div>
      <div className="space-y-3">
        {predictions.map((pred) => {
          const isFinished = pred.status === "hit" || pred.status === "miss";
          const accuracy =
            pred.actualGainPts !== null
              ? computeAccuracy(pred.predictedGainPts, pred.actualGainPts)
              : null;

          return (
            <div
              key={pred.id}
              className={`rounded-lg border bg-white/5 p-3 ${STATUS_CARD_BORDERS[pred.status]}`}
            >
              {/* Header: transfer pair + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-red-400">
                      {pred.playerOutName}
                    </span>
                    <span className="text-fpl-muted">&#8594;</span>
                    <span className="font-medium text-green-400">
                      {pred.playerInName}
                    </span>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[pred.status]}`}
                >
                  {STATUS_LABELS[pred.status]}
                </span>
              </div>

              {/* Context line */}
              <p className="mt-1.5 text-xs text-fpl-muted">
                GW{pred.gameweekMade} &bull; Predicted:{" "}
                <span className="font-semibold text-white">
                  {pred.predictedGainPts > 0 ? "+" : ""}
                  {Math.round(pred.predictedGainPts * 10) / 10} pts
                </span>{" "}
                over 4 GWs
              </p>

              {/* Result: shown when actual data exists */}
              {pred.actualGainPts !== null && (
                <div className="mt-2 flex items-center gap-3 rounded bg-white/5 px-2.5 py-1.5">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-fpl-muted">
                      {isFinished ? "Final Result" : "Progress"}
                    </p>
                    <p className="mt-0.5 text-xs">
                      <span className="text-fpl-muted">Predicted:</span>{" "}
                      <span className="font-medium text-white">
                        {Math.round(pred.predictedGainPts * 10) / 10}
                      </span>
                      <span className="mx-1.5 text-fpl-muted">&#8594;</span>
                      <span className="text-fpl-muted">Actual:</span>{" "}
                      <span
                        className={`font-medium ${pred.actualGainPts >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {pred.actualGainPts > 0 ? "+" : ""}
                        {Math.round(pred.actualGainPts * 10) / 10}
                      </span>
                    </p>
                  </div>
                  {accuracy !== null && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-fpl-muted">
                        Accuracy
                      </p>
                      <AccuracyBadge accuracy={accuracy} />
                    </div>
                  )}
                </div>
              )}

              {/* Per-GW breakdown */}
              <GwBreakdown gwActuals={pred.gwActuals} />

              {/* Tracking notes (miss explanation) */}
              {pred.trackingNotes && (
                <p className="mt-2 rounded bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-400/90">
                  {pred.trackingNotes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
