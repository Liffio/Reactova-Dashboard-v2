import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  value: {
    label: "Triggers",
    color: "hsl(var(--foreground))",
  },
};

export function AnalyticsKeywordsChart({
  keywords,
}: {
  keywords: Array<{ keyword: string; value: number }>;
}) {
  if (keywords.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No keyword data in this range.
      </div>
    );
  }

  const data = keywords.map((k) => ({
    keyword: k.keyword.length > 18 ? `${k.keyword.slice(0, 18)}…` : k.keyword,
    fullKeyword: k.keyword,
    value: k.value,
  }));

  const height = Math.max(220, data.length * 36);

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="keyword"
          tickLine={false}
          axisLine={false}
          width={100}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <span className="font-mono text-xs">
                  {(item.payload as { fullKeyword?: string }).fullKeyword ?? item.payload?.keyword}:{" "}
                  {Number(value).toLocaleString()}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ChartContainer>
  );
}
