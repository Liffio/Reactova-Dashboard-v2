import { API_BASE } from "@/lib/api";

const baseUrl = API_BASE.replace(/\/$/, "");

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted border border-border p-4 text-sm font-mono text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 pb-10 border-b border-border last:border-0">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function ApiDocs() {
  return (
    <article className="space-y-10 text-foreground">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reactova External API</h1>
        <p className="text-muted-foreground leading-relaxed">
          Automate post scheduling and workflow creation from Postman, Zapier, or your own scripts.
          API keys are account-scoped and only work with the endpoints documented here.
        </p>
        <p className="text-sm font-mono text-primary">{baseUrl}/api/v1/external</p>
      </header>

      <Section id="authentication" title="Authentication">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Send your API key as a Bearer token. Every request must include your workspace ID so actions
          run in the correct tenant context.
        </p>
        <Code>{`Authorization: Bearer rv_live_xxxxxxxx
x-workspace-id: your_workspace_id
Content-Type: application/json`}</Code>
        <p className="text-sm text-muted-foreground">
          Keys are shown once when created. Store them in a secrets manager — they cannot be retrieved later.
        </p>
      </Section>

      <Section id="rate-limits" title="Rate limits">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Limits depend on your workspace plan. Counters reset daily (UTC).
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Keys</th>
                <th className="px-3 py-2">Posts/day</th>
                <th className="px-3 py-2">Automations/day</th>
              </tr>
            </thead>
            <tbody>
              <tr className="stripe-row"><td className="px-3 py-2">Free</td><td className="px-3 py-2">$0</td><td className="px-3 py-2">—</td><td className="px-3 py-2">—</td><td className="px-3 py-2">—</td></tr>
              <tr className="stripe-row"><td className="px-3 py-2">Starter</td><td className="px-3 py-2">$9</td><td className="px-3 py-2">2</td><td className="px-3 py-2">10</td><td className="px-3 py-2">5</td></tr>
              <tr className="stripe-row"><td className="px-3 py-2">Pro</td><td className="px-3 py-2">$29</td><td className="px-3 py-2">5</td><td className="px-3 py-2">50</td><td className="px-3 py-2">25</td></tr>
              <tr className="stripe-row"><td className="px-3 py-2">Business</td><td className="px-3 py-2">$79</td><td className="px-3 py-2">10</td><td className="px-3 py-2">200</td><td className="px-3 py-2">100</td></tr>
              <tr className="stripe-row"><td className="px-3 py-2">Agency</td><td className="px-3 py-2">$299</td><td className="px-3 py-2">50</td><td className="px-3 py-2">Unlimited</td><td className="px-3 py-2">Unlimited</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="schedule-post" title="Schedule a post">
        <p className="text-sm">
          <span className="font-mono text-xs bg-primary/15 text-primary px-2 py-0.5 rounded">POST</span>
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
          <code className="text-foreground">scheduledLocal</code> + <code className="text-foreground">timezone</code>{" "}
          for wall-clock scheduling, or <code className="text-foreground">scheduledAt</code> (ISO UTC).
        </p>
      </Section>

      <Section id="create-automation" title="Create automation (workflow)">
        <p className="text-sm">
          <span className="font-mono text-xs bg-primary/15 text-primary px-2 py-0.5 rounded">POST</span>
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
      </Section>

      <Section id="errors" title="Errors">
        <div className="overflow-x-auto rounded-lg border border-border text-sm">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr className="stripe-row"><td className="px-3 py-2 font-mono">401</td><td className="px-3 py-2">Invalid or expired API key</td></tr>
              <tr className="stripe-row"><td className="px-3 py-2 font-mono">400</td><td className="px-3 py-2">Validation error or missing x-workspace-id</td></tr>
              <tr className="stripe-row"><td className="px-3 py-2 font-mono">404</td><td className="px-3 py-2">Workspace not found or not accessible</td></tr>
              <tr className="stripe-row"><td className="px-3 py-2 font-mono">429</td><td className="px-3 py-2">Daily plan limit reached</td></tr>
            </tbody>
          </table>
        </div>
      </Section>
    </article>
  );
}
