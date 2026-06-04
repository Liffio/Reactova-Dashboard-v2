export type ChartPoint = { day: string; value: number };

export function AnalyticsTimeSeriesChart({
  data,
  maxValue,
}: {
  data: ChartPoint[];
  maxValue: number;
}) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">No data for this period.</p>
    );
  }

  const points = data
    .map((point, i) => {
      const x = (i / Math.max(1, data.length - 1)) * 580 + 10;
      const y = 190 - (point.value / maxValue) * 170;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 600 200" className="h-52 w-full" role="img" aria-label="Time series chart">
      <line x1="10" y1="190" x2="590" y2="190" stroke="hsl(var(--border))" strokeWidth="1" />
      <polygon
        fill="hsl(var(--muted))"
        points={`10,190 ${points} 590,190`}
      />
      <polyline
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((point, i) => {
        const x = (i / Math.max(1, data.length - 1)) * 580 + 10;
        const y = 190 - (point.value / maxValue) * 170;
        return (
          <circle
            key={point.day}
            cx={x}
            cy={y}
            r="3"
            fill="hsl(var(--background))"
            stroke="hsl(var(--foreground))"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}
