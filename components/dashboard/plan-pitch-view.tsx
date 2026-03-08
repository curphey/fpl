"use client";

/* eslint-disable @next/next/no-img-element */

export interface PlanLineupPlayer {
  id: number;
  name: string;
  teamCode?: number;
  elementType?: number; // 1=GK, 2=DEF, 3=MID, 4=FWD
  predictedPts?: number;
}

interface PlanPitchViewProps {
  startingXI: PlanLineupPlayer[];
  benchOrder: PlanLineupPlayer[];
  captainId: number;
}

function getKitUrl(teamCode: number, isGK: boolean): string {
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${isGK ? "_1" : ""}-66.png`;
}

function PlanPlayerCard({
  player,
  isCaptain,
  isBench,
}: {
  player: PlanLineupPlayer;
  isCaptain: boolean;
  isBench: boolean;
}) {
  const isGK = (player.elementType ?? 0) === 1;
  const teamCode = player.teamCode ?? 1;
  const kitUrl = getKitUrl(teamCode, isGK);
  const pts = player.predictedPts ?? 0;

  return (
    <div
      className={`relative flex flex-col items-center ${isBench ? "opacity-80" : ""}`}
    >
      {isCaptain && (
        <span className="absolute -top-1 -left-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-fpl-green text-[10px] font-bold text-fpl-purple">
          C
        </span>
      )}

      <div
        className="flex h-14 w-14 items-center justify-center rounded-t-md sm:h-16 sm:w-16"
        style={{ background: "linear-gradient(to bottom, #2d7a2d, #1a0a3e)" }}
      >
        <img
          src={kitUrl}
          alt=""
          width={48}
          height={48}
          className="h-11 w-auto object-contain drop-shadow-lg sm:h-13"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      {isBench ? (
        <div className="w-14 rounded-b-md bg-white px-0.5 py-1 text-center sm:w-16">
          <p className="truncate text-[10px] font-semibold leading-tight text-gray-900 sm:text-[11px]">
            {player.name}
          </p>
          <p className="mt-0.5 text-[10px] font-bold leading-tight text-fpl-purple sm:text-[11px]">
            {pts} pts
          </p>
        </div>
      ) : (
        <div className="w-14 rounded-b-md bg-fpl-purple px-0.5 py-1 text-center sm:w-16">
          <p className="truncate text-[10px] font-semibold leading-tight text-white sm:text-[11px]">
            {player.name}
          </p>
          <p className="mt-0.5 text-[10px] font-bold leading-tight text-fpl-green sm:text-[11px]">
            {pts} pts
          </p>
        </div>
      )}
    </div>
  );
}

const BENCH_POS_LABEL: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export function PlanPitchView({
  startingXI,
  benchOrder,
  captainId,
}: PlanPitchViewProps) {
  // Group starters by position: GK, DEF, MID, FWD
  const rows = [
    startingXI.filter((p) => (p.elementType ?? 0) === 1),
    startingXI.filter((p) => (p.elementType ?? 0) === 2),
    startingXI.filter((p) => (p.elementType ?? 0) === 3),
    startingXI.filter((p) => (p.elementType ?? 0) === 4),
  ];

  return (
    <div>
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
          <rect
            x="10"
            y="10"
            width="380"
            height="540"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
          <line
            x1="10"
            y1="280"
            x2="390"
            y2="280"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
          <circle
            cx="200"
            cy="280"
            r="50"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
          <circle cx="200" cy="280" r="3" fill="rgba(255,255,255,0.35)" />
          <rect
            x="80"
            y="10"
            width="240"
            height="90"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
          <rect
            x="140"
            y="10"
            width="120"
            height="35"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
          <circle cx="200" cy="80" r="3" fill="rgba(255,255,255,0.35)" />
          <path
            d="M 152 100 A 50 50 0 0 1 248 100"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
          <rect
            x="80"
            y="460"
            width="240"
            height="90"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
          <rect
            x="140"
            y="515"
            width="120"
            height="35"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
          <circle cx="200" cy="480" r="3" fill="rgba(255,255,255,0.35)" />
          <path
            d="M 152 460 A 50 50 0 0 0 248 460"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
          />
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

        {/* Formation rows */}
        <div className="relative z-10 flex flex-col gap-3 px-2 pt-4 pb-2">
          {rows.map((row, i) => (
            <div key={i} className="flex w-full justify-evenly">
              {row.map((player) => (
                <PlanPlayerCard
                  key={player.id}
                  player={player}
                  isCaptain={player.id === captainId}
                  isBench={false}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Bench */}
        <div
          className="relative z-10 mx-3 mb-3 rounded-xl border-2 border-cyan-400/70 p-3"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(20,8,50,0.85))",
            boxShadow: "0 0 18px rgba(34,211,238,0.25)",
          }}
        >
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-cyan-300">
            Bench
          </p>
          <div className="flex w-full justify-evenly">
            {benchOrder.map((player, i) => (
              <div
                key={player.id}
                className="flex flex-col items-center gap-1"
              >
                {i === 0 ? (
                  <span className="border-b border-dotted border-cyan-300/60 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-300/90">
                    {BENCH_POS_LABEL[player.elementType ?? 0] ?? "GKP"}
                  </span>
                ) : (
                  <span className="border-b border-dotted border-cyan-300/60 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-300/90">
                    {i}.
                  </span>
                )}
                <PlanPlayerCard
                  player={player}
                  isCaptain={false}
                  isBench={true}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
