import { StatCard } from '@/components/ui/stat-card';

export function AnalyzerStats({
  userRank,
  uniquePlayers,
  eoCoverage,
  gapToLeader,
}: {
  userRank: number;
  uniquePlayers: number;
  eoCoverage: number;
  gapToLeader: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatCard label="Your Rank" value={`#${userRank}`} />
      <StatCard
        label="Unique Players"
        value={uniquePlayers}
        subvalue="Only you own"
      />
      <StatCard
        label="EO Coverage"
        value={`${eoCoverage}%`}
        subvalue="High-EO players owned"
      />
      <StatCard
        label="Gap to Leader"
        value={gapToLeader > 0 ? `-${gapToLeader}` : '0'}
        subvalue="Points behind"
      />
    </div>
  );
}
