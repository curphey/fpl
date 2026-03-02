import type {
  Player,
  Team,
  Pick,
  AutomaticSub,
  PlayerPosition,
} from "@/lib/fpl/types";
import { PlayerCard } from "./player-card";

const POSITION_LABEL: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export function PitchView({
  picks,
  playerMap,
  teamMap,
  livePointsMap,
  autoSubs,
}: {
  picks: Pick[];
  playerMap: Map<number, Player>;
  teamMap: Map<number, Team>;
  livePointsMap: Map<number, number> | null;
  autoSubs: AutomaticSub[];
}) {
  const starters = picks.filter((p) => p.position <= 11);
  const bench = picks.filter((p) => p.position > 11);

  const autoSubInIds = new Set(autoSubs.map((s) => s.element_in));
  const autoSubOutIds = new Set(autoSubs.map((s) => s.element_out));

  // Group starters by position: GK (1), DEF (2), MID (3), FWD (4)
  const rows: { position: PlayerPosition; picks: Pick[] }[] = [
    { position: 1, picks: [] },
    { position: 2, picks: [] },
    { position: 3, picks: [] },
    { position: 4, picks: [] },
  ];

  for (const pick of starters) {
    const player = playerMap.get(pick.element);
    if (!player) continue;
    const row = rows.find((r) => r.position === player.element_type);
    if (row) row.picks.push(pick);
  }

  function getAutoSub(elementId: number): "in" | "out" | undefined {
    if (autoSubInIds.has(elementId)) return "in";
    if (autoSubOutIds.has(elementId)) return "out";
    return undefined;
  }

  function getPoints(elementId: number): number | null {
    if (livePointsMap) {
      const pts = livePointsMap.get(elementId);
      return pts !== undefined ? pts : null;
    }
    const player = playerMap.get(elementId);
    return player ? player.event_points : null;
  }

  function renderPick(pick: Pick) {
    const player = playerMap.get(pick.element);
    if (!player) return null;
    const team = teamMap.get(player.team);
    return (
      <PlayerCard
        key={pick.element}
        player={player}
        teamCode={team?.code ?? 1}
        teamShortName={team?.short_name ?? "???"}
        points={getPoints(pick.element)}
        isCaptain={pick.is_captain}
        isViceCaptain={pick.is_vice_captain}
        isBench={pick.position > 11}
        autoSub={getAutoSub(pick.element)}
      />
    );
  }

  function getBenchLabel(pick: Pick, index: number): string {
    const player = playerMap.get(pick.element);
    if (!player) return "";
    // First bench spot is always the GK
    if (index === 0) return POSITION_LABEL[player.element_type] ?? "GKP";
    return `${index}. ${POSITION_LABEL[player.element_type] ?? ""}`;
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        background:
          "repeating-linear-gradient(180deg, #2d7a2d 0px, #2d7a2d 40px, #256525 40px, #256525 80px)",
      }}
    >
      {/* SVG pitch markings */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 400 560"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Pitch border */}
        <rect
          x="10"
          y="10"
          width="380"
          height="540"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Halfway line */}
        <line
          x1="10"
          y1="280"
          x2="390"
          y2="280"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Centre circle */}
        <circle
          cx="200"
          cy="280"
          r="50"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Centre spot */}
        <circle cx="200" cy="280" r="3" fill="rgba(255,255,255,0.35)" />
        {/* Top penalty area */}
        <rect
          x="80"
          y="10"
          width="240"
          height="90"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Top 6-yard box */}
        <rect
          x="140"
          y="10"
          width="120"
          height="35"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Top penalty spot */}
        <circle cx="200" cy="80" r="3" fill="rgba(255,255,255,0.35)" />
        {/* Top penalty arc */}
        <path
          d="M 152 100 A 50 50 0 0 1 248 100"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Bottom penalty area */}
        <rect
          x="80"
          y="460"
          width="240"
          height="90"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Bottom 6-yard box */}
        <rect
          x="140"
          y="515"
          width="120"
          height="35"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Bottom penalty spot */}
        <circle cx="200" cy="480" r="3" fill="rgba(255,255,255,0.35)" />
        {/* Bottom penalty arc */}
        <path
          d="M 152 460 A 50 50 0 0 0 248 460"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        {/* Corner arcs */}
        <path
          d="M 10 22 A 12 12 0 0 1 22 10"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />
        <path
          d="M 378 10 A 12 12 0 0 1 390 22"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />
        <path
          d="M 10 538 A 12 12 0 0 0 22 550"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />
        <path
          d="M 390 538 A 12 12 0 0 1 378 550"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Pitch rows */}
      <div className="relative z-10 flex flex-col gap-4 px-2 pt-4 pb-2">
        {rows.map((row) => (
          <div key={row.position} className="flex w-full justify-evenly">
            {row.picks.map((pick) => renderPick(pick))}
          </div>
        ))}
      </div>

      {/* Bench area */}
      <div
        className="relative z-10 mx-3 mb-3 rounded-xl border-2 border-cyan-400/70 p-3"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(20,8,50,0.85))",
          boxShadow: "0 0 18px rgba(34,211,238,0.25)",
        }}
      >
        <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest text-cyan-300">
          Substitutes
        </p>
        <div className="flex w-full justify-evenly">
          {bench.map((pick, index) => {
            const label = getBenchLabel(pick, index);
            return (
              <div
                key={pick.element}
                className="flex flex-col items-center gap-1.5"
              >
                {label && (
                  <span className="border-b border-dotted border-cyan-300/60 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-300/90">
                    {label}
                  </span>
                )}
                {renderPick(pick)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
