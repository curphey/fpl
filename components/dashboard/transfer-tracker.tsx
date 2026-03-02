import type { TransferPrediction } from "@/lib/db/gw-plan";

const STATUS_LABELS: Record<TransferPrediction["status"], string> = {
  pending: "pending",
  on_track: "on track",
  hit: "hit",
  miss: "miss",
};

const STATUS_COLORS: Record<TransferPrediction["status"], string> = {
  pending: "bg-gray-500/20 text-gray-400",
  on_track: "bg-blue-500/20 text-blue-400",
  hit: "bg-green-500/20 text-green-400",
  miss: "bg-red-500/20 text-red-400",
};

export function TransferTracker({
  predictions,
}: {
  predictions: TransferPrediction[];
}) {
  if (predictions.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Transfer Tracker
      </h3>
      <div className="space-y-2">
        {predictions.map((pred) => (
          <div
            key={pred.id}
            className="rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">GW{pred.gameweekMade}</span>
                  <span className="font-medium text-white">
                    {pred.playerOutName}
                  </span>
                  <span className="text-gray-500">→</span>
                  <span className="font-medium text-white">
                    {pred.playerInName}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span>
                    +{Math.round(pred.predictedGainPts)} pts predicted
                  </span>
                  {pred.actualGainPts !== null && (
                    <span>(actual: {Math.round(pred.actualGainPts)})</span>
                  )}
                </div>
                {pred.trackingNotes && (
                  <p className="mt-1 text-xs text-yellow-400/80">
                    {pred.trackingNotes}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[pred.status]}`}
              >
                {STATUS_LABELS[pred.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
