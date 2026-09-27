import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { chatbotApi, chatbotKeys } from "@/lib/api/chatbot-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { useApp } from "@/state/app-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/chatbot/$chatbotId_/analytics")({
  head: () => ({ meta: [{ title: "Chatbot analytics — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="chatbot">
      <AnalyticsPage />
    </ProtectedRoute>
  ),
});

const RANGES = [7, 30, 90] as const;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const ENTRY_LABEL: Record<string, string> = {
  KEYWORD: "Keyword",
  STORY_REPLY: "Story reply",
  STORY_MENTION: "Story mention",
  DEFAULT_REPLY: "Default reply",
  COMMENT_AUTOMATION: "From a comment",
  CHAINED: "From another chatbot",
};

/**
 * Per-chatbot analytics (spec §11). Drop-off is the headline: it is the number that tells a
 * business which message is losing people. One series in one hue, so no legend; the table below
 * is the accessible view of the same numbers.
 */
function AnalyticsPage() {
  const { chatbotId } = Route.useParams();
  const { current } = useApp();
  const ws = current.id;
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const bot = useQuery({
    queryKey: chatbotKeys.one(ws, chatbotId),
    queryFn: () => chatbotApi.get(ws, chatbotId),
    enabled: isWorkspaceReady(ws),
  });
  const data = useQuery({
    queryKey: chatbotKeys.analytics(ws, chatbotId, days),
    queryFn: () => chatbotApi.analytics(ws, chatbotId, days),
    enabled: isWorkspaceReady(ws),
  });
  const s = data.data?.summary;
  const funnel = (data.data?.funnel ?? []).map((f) => ({
    ...f,
    label: `${f.position + 1}. ${f.name}`,
  }));
  const worst = [...funnel].sort((a, b) => b.dropOffs - a.dropOffs)[0];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex min-h-16 items-center gap-2.5 border-b border-border px-6 py-3 max-md:px-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to the builder">
          <Link to="/chatbot/$chatbotId" params={{ chatbotId }}>
            <ChevronLeft className="!size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Analytics</div>
          <h1 className="truncate font-display text-xl font-bold tracking-tight">
            {bot.data?.name ?? "…"}
          </h1>
        </div>
        <div
          role="group"
          aria-label="Date range"
          className="inline-flex rounded-[10px] bg-secondary p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-semibold text-muted-foreground",
                days === r && "bg-card text-foreground shadow-card",
              )}
            >
              {r} days
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-10 max-md:px-4">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
          {!s ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
              <Tile label="Conversations" value={String(s.started)} />
              <Tile
                label="Completed"
                value={pct(s.completed, s.started)}
                sub={`${s.completed} of ${s.started}`}
              />
              <Tile
                label="Handed to a person"
                value={pct(s.handedOver, s.started)}
                sub={`${s.handedOver}`}
              />
              <Tile
                label="Went quiet (24h)"
                value={pct(s.expired, s.started)}
                sub={`${s.expired}`}
              />
            </div>
          )}

          {s && Object.keys(s.byTrigger).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Started by:{" "}
              {Object.entries(s.byTrigger)
                .map(([k, n]) => `${ENTRY_LABEL[k] ?? k} ${n}`)
                .join(" · ")}
            </p>
          )}

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display text-base font-semibold">Where people drop off</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {worst && worst.dropOffs > 0
                ? `Most people stop at "${worst.label}".`
                : "People who got a step but didn't tap or answer. Updated hourly."}
            </p>
            {funnel.length === 0 ? (
              <Skeleton className="h-48" />
            ) : (
              <div style={{ height: Math.max(160, funnel.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={funnel}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                    barCategoryGap={8}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--grid-line)" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={150}
                      tick={{ fontSize: 12, fill: "var(--foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(v: number) => [v, "Dropped off"]}
                    />
                    <Bar
                      dataKey="dropOffs"
                      fill="var(--chart-1)"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-medium">Step</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                  <th className="px-4 py-2.5 text-right font-medium">Taps</th>
                  <th className="px-4 py-2.5 text-right font-medium">Dropped off</th>
                  <th className="px-4 py-2.5 text-right font-medium">Follow-ups</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((f) => (
                  <tr key={f.stepId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{f.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.sent}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.taps}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {f.dropOffs}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.followUps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
