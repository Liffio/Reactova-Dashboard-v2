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
        <h1 className="text-3xl font-bold tracking-tight">Liffio External API</h1>
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
          for wall-clock scheduling, or <code className="text-foreground">scheduledAt</code> (ISO UTC). For reels, optional{" "}
          <code className="text-foreground">musicTitle</code>, <code className="text-foreground">musicArtist</code>,{" "}
          <code className="text-foreground">musicUrl</code>, and <code className="text-foreground">shareToFeed</code>.
          Search music with <code className="text-foreground">GET /api/v1/external/scheduler/music/search?q=summer</code>{" "}
          (requires an Instagram web session configured in workspace Settings). Music fields work on all post types;
          licensed audio is applied when publishing reels.
          Pass <code className="text-foreground">igMusicId</code> (and optionally <code className="text-foreground">igMusicClusterId</code>)
          when scheduling. Inline <code className="text-foreground">automation</code> supports{" "}
          <code className="text-foreground">keywords</code> or <code className="text-foreground">triggerBlocks</code>.
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
          List, fetch, update, or cancel scheduled posts. Read endpoints do not count toward daily create limits.
        </p>
        <ul className="text-sm space-y-2 font-mono">
          <li><span className="text-primary">GET</span> /api/v1/external/scheduler/music/search?q=summer</li>
          <li>
            Track <code className="text-foreground">coverUrl</code> values point at{" "}
            <code className="text-foreground">GET /api/v1/public/scheduler/music-cover</code> (signed proxy; no direct
            Instagram CDN calls from clients)
          </li>
          <li><span className="text-primary">GET</span> /api/v1/external/scheduler/posts</li>
          <li><span className="text-primary">GET</span> /api/v1/external/scheduler/posts/:id</li>
          <li><span className="text-primary">PATCH</span> /api/v1/external/scheduler/posts/:id</li>
          <li><span className="text-primary">DELETE</span> /api/v1/external/scheduler/posts/:id</li>
        </ul>
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
        <p className="text-sm text-muted-foreground">
          Use <code className="text-foreground">triggerBlocks</code> for per-keyword DM flows.{" "}
          <code className="text-foreground">postScope</code>: <code className="text-foreground">specific</code>,{" "}
          <code className="text-foreground">any</code>, or <code className="text-foreground">next</code>.
        </p>
      </Section>

      <Section id="automations-crud" title="Automations (list, update, delete)">
        <ul className="text-sm space-y-2 font-mono">
          <li><span className="text-primary">GET</span> /api/v1/external/automations</li>
          <li><span className="text-primary">GET</span> /api/v1/external/automations/:id</li>
          <li><span className="text-primary">PATCH</span> /api/v1/external/automations/:id</li>
          <li><span className="text-primary">DELETE</span> /api/v1/external/automations/:id</li>
        </ul>
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
