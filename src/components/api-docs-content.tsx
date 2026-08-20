import { useQuery } from "@tanstack/react-query";

import { API_BASE } from "@/lib/api/http";
import { getBillingConfig } from "@/lib/api/billing-api";

const baseUrl = API_BASE.replace(/\/$/, "");

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border bg-muted p-4 text-sm font-mono text-foreground shadow-soft">
      <code>{children}</code>
    </pre>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 pb-10 border-b border-border last:border-0">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The API plan table, from `/billing/config` rather than five hardcoded arrays. (S5.3)
 *
 * 🚩 What stood here was:
 *
 * ```
 * ["Starter", "$9",  "2",  "10",  "5"],
 * ["Pro",     "$29", "5",  "50",  "25"],
 * ["Business","$79", "10", "200", "100"],
 * ["Agency",  "$299","50", "Unlimited","Unlimited"],
 * ```
 *
 * **Every number in it was already wrong**, and merge 1b makes it wrong a second way. It listed a
 * retired tier and omitted Growth entirely — the same three defects `billings.tsx` had, in a third
 * copy of the same server state.
 *
 * Editing the literals would have bought one release. `/billing/config` already serves
 * `displayName`, `pricing` and `limits` per plan, so this table now follows the server and is right
 * across 1b without anyone remembering it exists.
 *
 * ⚠️ **Retired tiers are filtered out** via `sellable`, so PRO stops being documented as a plan
 * anybody can buy an API key on.
 *
 * ⚠️ **This page documents an API D4 withholds from the V4 launch.** Under D4 every tier's
 * `maxApiCredentials` is 0, so once 1b lands this table will honestly read "0 keys" on every row.
 * That is the correct output, not a bug — and it makes the page's own premise visible, which
 * editing the literals to a friendlier number would have hidden.
 */
export function ApiDocsContent() {
  const configQuery = useQuery({ queryKey: ["billing-config"], queryFn: getBillingConfig });

  const fmt = (n: number | undefined): string => {
    if (n === undefined || n === null) return "—";
    // -1 and the 999999 sentinel both mean "no cap" in this codebase.
    if (n < 0 || n >= 999_999) return "Unlimited";
    return n === 0 ? "—" : String(n);
  };

  const planRows = (configQuery.data?.plans ?? [])
    .filter((p) => p.sellable)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({
      plan: p.displayName,
      price: `$${p.pricing.monthlyUsd}`,
      keys: fmt(p.limits.maxApiCredentials),
      posts: fmt(p.limits.schedulerPostsPerDay),
      autos: fmt(p.limits.automationsPerDay),
    }));

  return (
    <article className="space-y-10 text-foreground">
      <Section id="authentication" title="Authentication">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Send your API key as a Bearer token. Every request must include your workspace ID so
          actions run in the correct tenant context.
        </p>
        <Code>{`Authorization: Bearer rv_live_xxxxxxxx
x-workspace-id: your_workspace_id
Content-Type: application/json`}</Code>
        <p className="text-sm text-muted-foreground">
          Keys are shown once when created. Store them in a secrets manager — they cannot be
          retrieved later. Generate keys in the{" "}
          <strong className="text-foreground">API keys</strong> tab.
        </p>
      </Section>

      <Section id="base-url" title="Base URL">
        <p className="text-sm text-muted-foreground">All external API endpoints are under:</p>
        <Code>{`${baseUrl}/api/v1/external`}</Code>
      </Section>

      <Section id="rate-limits" title="Rate limits">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Limits depend on your workspace plan. Counters reset daily (UTC).
        </p>
        <div className="overflow-x-auto rounded-xl border shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b bg-muted/40">
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Price</th>
                <th className="px-4 py-2.5">Keys</th>
                <th className="px-4 py-2.5">Posts/day</th>
                <th className="px-4 py-2.5">Automations/day</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {planRows.map((row) => (
                <tr key={row.plan} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{row.plan}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.price}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.keys}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.posts}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.autos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="schedule-post" title="Schedule a post">
        <p className="text-sm">
          <span className="font-mono text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-md">
            POST
          </span>
          <span className="font-mono ml-2">/api/v1/external/scheduler/posts</span>
        </p>
        <Code>{`curl -X POST "${baseUrl}/api/v1/external/scheduler/posts" \\
  -H "Authorization: Bearer rv_live_YOUR_KEY" \\
  -H "x-workspace-id: YOUR_WORKSPACE_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "FEED",
    "caption": "Scheduled via API",
    "scheduledLocal": "2026-05-20T14:30",
    "timezone": "America/New_York",
    "primaryMediaUrl": "https://example.com/image.jpg"
  }'`}</Code>
        <p className="text-sm text-muted-foreground">
          <code className="text-foreground">type</code>: FEED, REEL, CAROUSEL, or STORY. Use{" "}
          <code className="text-foreground">scheduledLocal</code> +{" "}
          <code className="text-foreground">timezone</code> for wall-clock scheduling, or{" "}
          <code className="text-foreground">scheduledAt</code> (ISO UTC). Pass{" "}
          <code className="text-foreground">igMusicId</code> for licensed audio on reels. Inline{" "}
          <code className="text-foreground">automation</code> supports{" "}
          <code className="text-foreground">keywords</code> or{" "}
          <code className="text-foreground">triggerBlocks</code>.
        </p>
        <Code>{`{
  "type": "REEL",
  "primaryMediaUrl": "https://example.com/reel.mp4",
  "scheduledLocal": "2026-05-20T14:30",
  "timezone": "America/New_York",
  "igMusicId": "487118580328718",
  "igMusicClusterId": "410742646320351",
  "musicSoundVolume": 80,
  "originalSoundVolume": 50,
  "shareToFeed": true,
  "automation": {
    "enabled": true,
    "keywords": ["GUIDE", "LINK"],
    "dmMessage": "Thanks! Check your DMs."
  }
}`}</Code>
      </Section>

      <Section id="scheduler-crud" title="Scheduled posts (read & update)">
        <p className="text-sm text-muted-foreground leading-relaxed">
          List, fetch, update, or cancel scheduled posts. Read endpoints do not count toward daily
          create limits.
        </p>
        <ul className="space-y-2 text-sm font-mono">
          {[
            ["GET", "/api/v1/external/scheduler/music/search?q=summer"],
            ["GET", "/api/v1/external/scheduler/posts"],
            ["GET", "/api/v1/external/scheduler/posts/:id"],
            ["PATCH", "/api/v1/external/scheduler/posts/:id"],
            ["DELETE", "/api/v1/external/scheduler/posts/:id"],
          ].map(([method, path]) => (
            <li key={path} className="flex items-center gap-2">
              <span
                className={
                  method === "GET"
                    ? "text-success font-semibold"
                    : method === "DELETE"
                      ? "text-destructive font-semibold"
                      : "text-primary font-semibold"
                }
              >
                {method}
              </span>
              <span className="text-muted-foreground">{path}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="create-automation" title="Create automation (workflow)">
        <p className="text-sm">
          <span className="font-mono text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-md">
            POST
          </span>
          <span className="font-mono ml-2">/api/v1/external/automations</span>
        </p>
        <Code>{`curl -X POST "${baseUrl}/api/v1/external/automations" \\
  -H "Authorization: Bearer rv_live_YOUR_KEY" \\
  -H "x-workspace-id: YOUR_WORKSPACE_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Comment to DM",
    "keywords": ["price", "info"],
    "dmMessage": "Thanks! Check your DMs.",
    "anyComment": false,
    "status": "ACTIVE"
  }'`}</Code>
        <p className="text-sm text-muted-foreground">
          Use <code className="text-foreground">triggerBlocks</code> for per-keyword DM flows.{" "}
          <code className="text-foreground">postScope</code>:{" "}
          <code className="text-foreground">specific</code>,{" "}
          <code className="text-foreground">any</code>, or{" "}
          <code className="text-foreground">next</code>.
        </p>
      </Section>

      <Section id="automations-crud" title="Automations (list, update, delete)">
        <ul className="space-y-2 text-sm font-mono">
          {[
            ["GET", "/api/v1/external/automations"],
            ["GET", "/api/v1/external/automations/:id"],
            ["PATCH", "/api/v1/external/automations/:id"],
            ["DELETE", "/api/v1/external/automations/:id"],
          ].map(([method, path]) => (
            <li key={path} className="flex items-center gap-2">
              <span
                className={
                  method === "GET"
                    ? "text-success font-semibold"
                    : method === "DELETE"
                      ? "text-destructive font-semibold"
                      : "text-primary font-semibold"
                }
              >
                {method}
              </span>
              <span className="text-muted-foreground">{path}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="errors" title="Error codes">
        <div className="overflow-x-auto rounded-xl border shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b bg-muted/40">
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["401", "Invalid or expired API key"],
                ["400", "Validation error or missing x-workspace-id"],
                ["404", "Workspace not found or not accessible"],
                ["429", "Daily plan limit reached"],
              ].map(([code, meaning]) => (
                <tr key={code} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono font-medium">{code}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </article>
  );
}
