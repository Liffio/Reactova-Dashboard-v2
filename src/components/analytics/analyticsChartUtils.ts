export type ChartPoint = { day: string; value: number };

export function formatChartSeries(series: ChartPoint[]) {
  return series.map((point) => ({
    ...point,
    label: new Date(point.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
}
