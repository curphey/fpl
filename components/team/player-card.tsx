import { memo } from "react";
import type { Player } from "@/lib/fpl/types";

export const PlayerCard = memo(function PlayerCard({
  player,
  teamCode,
  teamShortName,
  points,
  isCaptain,
  isViceCaptain,
  isBench,
  autoSub,
}: {
  player: Player;
  teamCode: number;
  teamShortName: string;
  points: number | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isBench: boolean;
  autoSub?: "in" | "out";
}) {
  const statusDot =
    player.status === "d"
      ? "bg-yellow-400"
      : player.status === "i" || player.status === "s" || player.status === "u"
        ? "bg-red-500"
        : null;

  const isGK = player.element_type === 1;
  const kitSuffix = isGK ? "_1" : "";
  const kitUrl = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${kitSuffix}-66.png`;

  return (
    <div
      className={`relative flex flex-col items-center ${isBench ? "opacity-80" : ""}`}
    >
      {/* Captain badge */}
      {isCaptain && (
        <span className="absolute -top-2 -left-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-fpl-green text-[10px] font-bold text-fpl-purple">
          C
        </span>
      )}

      {/* Vice-captain badge */}
      {isViceCaptain && (
        <span className="absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-fpl-green bg-fpl-purple text-[10px] font-bold text-fpl-green">
          V
        </span>
      )}

      {/* Status dot */}
      {statusDot && (
        <span
          className={`absolute top-1 right-1 z-20 h-2 w-2 rounded-full ${statusDot}`}
        />
      )}

      {/* Auto-sub arrow */}
      {autoSub && (
        <span
          className={`absolute top-1 left-1 z-20 text-[10px] font-bold leading-none ${
            autoSub === "in" ? "text-green-400" : "text-red-400"
          }`}
        >
          {autoSub === "in" ? "▲" : "▼"}
        </span>
      )}

      {/* Kit image */}
      <div className="flex h-14 w-[72px] items-center justify-center rounded-t-md bg-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={kitUrl}
          alt={`${teamShortName} kit`}
          width={48}
          height={48}
          className="h-12 w-auto object-contain drop-shadow-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      {/* Name + points */}
      <div className="w-[72px] rounded-b-md bg-fpl-purple px-1 py-1 text-center">
        <p className="truncate text-[10px] font-semibold leading-tight text-white">
          {player.web_name}
        </p>
        <p className="mt-0.5 text-[10px] font-bold leading-tight text-fpl-green">
          {points !== null ? points : "-"}
        </p>
      </div>
    </div>
  );
});
