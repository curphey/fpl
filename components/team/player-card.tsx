import type { Player, PlayerPosition } from '@/lib/fpl/types';

const positionColors: Record<PlayerPosition, string> = {
  1: 'bg-yellow-500',
  2: 'bg-blue-500',
  3: 'bg-green-500',
  4: 'bg-red-500',
};

export function PlayerCard({
  player,
  teamShortName,
  points,
  isCaptain,
  isViceCaptain,
  isBench,
  autoSub,
}: {
  player: Player;
  teamShortName: string;
  points: number | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isBench: boolean;
  autoSub?: 'in' | 'out';
}) {
  const statusDot =
    player.status === 'd'
      ? 'bg-yellow-400'
      : player.status === 'i' || player.status === 's' || player.status === 'u'
        ? 'bg-red-500'
        : null;

  return (
    <div
      className={`relative flex w-[72px] flex-col items-center rounded-lg border border-fpl-border bg-fpl-card px-1.5 py-2 text-center ${
        isBench ? 'opacity-50' : ''
      }`}
    >
      {/* Position color bar */}
      <div
        className={`absolute top-0 left-0 h-1 w-full rounded-t-lg ${positionColors[player.element_type]}`}
      />

      {/* Status dot */}
      {statusDot && (
        <span
          className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${statusDot}`}
        />
      )}

      {/* Auto-sub arrow */}
      {autoSub && (
        <span
          className={`absolute top-1.5 left-1.5 text-[10px] leading-none font-bold ${
            autoSub === 'in' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {autoSub === 'in' ? '\u25B2' : '\u25BC'}
        </span>
      )}

      {/* Player name */}
      <p className="mt-1 w-full truncate text-[11px] font-semibold leading-tight text-foreground">
        {player.web_name}
      </p>

      {/* Team short name */}
      <p className="text-[10px] leading-tight text-fpl-muted">{teamShortName}</p>

      {/* Points */}
      <p className="mt-0.5 text-sm font-bold text-fpl-green">
        {points !== null ? points : '-'}
      </p>

      {/* Captain / Vice-captain badge */}
      {(isCaptain || isViceCaptain) && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-fpl-green text-[9px] font-bold text-fpl-purple">
          {isCaptain ? 'C' : 'V'}
        </span>
      )}
    </div>
  );
}
