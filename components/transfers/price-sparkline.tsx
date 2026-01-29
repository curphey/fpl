"use client";

interface PriceSparklineProps {
  history: { gw: number; price: number }[];
  width?: number;
  height?: number;
}

export function PriceSparkline({
  history,
  width = 80,
  height = 24,
}: PriceSparklineProps) {
  if (history.length < 2) {
    return <span className="text-xs text-fpl-muted">-</span>;
  }

  const prices = history.map((h) => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // Padding for the SVG
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Generate points for the polyline
  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * chartWidth;
    const y =
      padding + chartHeight - ((h.price - minPrice) / priceRange) * chartHeight;
    return `${x},${y}`;
  });

  // Determine trend direction
  const firstPrice = history[0].price;
  const lastPrice = history[history.length - 1].price;
  const trendUp = lastPrice > firstPrice;
  const trendFlat = lastPrice === firstPrice;

  const strokeColor = trendFlat
    ? "var(--fpl-muted)"
    : trendUp
      ? "var(--fpl-green)"
      : "var(--fpl-danger)";

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={padding + chartWidth}
        cy={
          padding +
          chartHeight -
          ((lastPrice - minPrice) / priceRange) * chartHeight
        }
        r="2"
        fill={strokeColor}
      />
    </svg>
  );
}
