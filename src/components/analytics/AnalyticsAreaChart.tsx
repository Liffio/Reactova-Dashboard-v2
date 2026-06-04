import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatChartSeries, type ChartPoint } from "@/components/analytics/analyticsChartUtils";

const chartConfig = {
  value: {
    label: "Count",
    color: "hsl(var(--foreground))",
  },
};

export function AnalyticsAreaChart({
  data,
  emptyMessage = "No data for this period.",
}: {
  data: ChartPoint[];
  emptyMessage?: string;
}) {
  const formatted = formatChartSeries(data);

  if (formatted.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <AreaChart data={formatted} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
          content={<ChartTooltipContent indicator="line" labelKey="label" />}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          fill="var(--color-value)"
          fillOpacity={0.12}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
