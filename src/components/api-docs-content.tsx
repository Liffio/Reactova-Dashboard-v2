import { useQuery } from "@tanstack/react-query";

import { API_BASE } from "@/lib/api/http";
import { SCHEDULED_POST_AUTOMATION_FIELDS } from "./api-docs-automation-fields";
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
 * retired tier and omitted Growth entirely, the same three defects `billings.tsx` had, in a third
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
 * That is the correct output, not a bug, and it makes the page's own premise visible, which
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
          Keys are shown once when created. Store them in a secrets manager. They cannot be
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
    "primaryMediaUrl": "${baseUrl}/api/v1/public/scheduler-media/USER_ID/WORKSPACE_ID/MEDIA_ID.jpg"
  }'`}</Code>
        <p className="text-sm text-muted-foreground">
          That <code className="text-foreground">primaryMediaUrl</code> is what the upload endpoint
          below returns. A URL on your own domain will not work. See{" "}
          <a href="#media-uploads" className="text-primary underline">
            Uploading media
          </a>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          <code className="text-foreground">type</code>: FEED, REEL, CAROUSEL, or STORY. Use{" "}
          <code className="text-foreground">scheduledLocal</code> +{" "}
          <code className="text-foreground">timezone</code> for wall-clock scheduling, or{" "}
          <code className="text-foreground">scheduledAt</code> (ISO UTC). Pass{" "}
          <code className="text-foreground">igMusicId</code> for licensed audio on reels.
        </p>

        <h3 className="pt-2 text-base font-semibold">The inline automation object</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Send <code className="text-foreground">automation</code> with the post and it is created
          alongside it, then goes live bound to that post the moment the post publishes. There is no{" "}
          <code className="text-foreground">postScope</code> here: the scheduled post is the target.
          Everything below is optional unless the Required column says otherwise.
        </p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">Field</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Required</th>
                <th className="px-3 py-2 font-medium">When absent</th>
                <th className="px-3 py-2 font-medium">Notes and limits</th>
              </tr>
            </thead>
            <tbody>
              {SCHEDULED_POST_AUTOMATION_FIELDS.map((f) => (
                <tr key={f.name} className="border-t align-top">
                  <td className="px-3 py-2">
                    <code className="font-mono text-foreground">{f.name}</code>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{f.type}</td>
                  <td className="px-3 py-2 text-muted-foreground">{f.required}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <code className="font-mono">{f.fallback}</code>
                  </td>
                  <td className="px-3 py-2 leading-relaxed text-muted-foreground">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">A full request using every field:</p>
        <Code>{`curl -X POST "${baseUrl}/api/v1/external/scheduler/posts" \\
  -H "Authorization: Bearer rv_live_YOUR_KEY" \\
  -H "x-workspace-id: YOUR_WORKSPACE_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "REEL",
    "primaryMediaUrl": "${baseUrl}/api/v1/public/scheduler-media/USER_ID/WORKSPACE_ID/MEDIA_ID.mp4",
    "scheduledLocal": "2026-05-20T14:30",
    "timezone": "America/New_York",
    "igMusicId": "487118580328718",
    "shareToFeed": true,
    "automation": {
      "enabled": true,
      "name": "Launch DM",
      "keywords": ["GUIDE", "LINK"],
      "excludedKeywords": ["PRICE"],
      "anyComment": false,
      "dmMessage": "Thanks! Here is the link you asked for.",
      "dmButtonLabel": "Open",
      "dmButtonUrl": "https://example.com/guide",
      "autoReply": true,
      "replyMessages": ["Sent! Check your DMs", "On its way"],
      "followBeforeDm": true,
      "brandingEnabled": false,
      "followUps": [
        { "delayMinutes": 1440, "message": "Still interested?" },
        { "delayMinutes": 4320, "message": "Last nudge", "order": 1 }
      ]
    }
  }'`}</Code>

        <p className="text-sm text-muted-foreground">
          The response carries the post, and{" "}
          <code className="text-foreground">GET /scheduler/posts/:id</code> returns the linked
          automation beside it under the same field names you sent:
        </p>
        <Code>{`{
  "post": {
    "id": "8f3c...",
    "status": "SCHEDULED",
    "type": "REEL",
    "scheduledAt": "2026-05-20T18:30:00.000Z",
    "automationId": "b21e..."
  },
  "automation": {
    "id": "b21e...",
    "name": "Launch DM",
    "status": "DRAFT",
    "keywords": ["GUIDE", "LINK"],
    "excludedKeywords": ["PRICE"],
    "anyComment": false,
    "dmMessage": "Thanks! Here is the link you asked for.",
    "dmButtonLabel": "Open",
    "dmButtonUrl": "https://example.com/guide",
    "autoReply": true,
    "replyMessages": ["Sent! Check your DMs", "On its way"],
    "followBeforeDm": true,
    "brandingEnabled": false,
    "followUps": [
      { "delayMinutes": 1440, "message": "Still interested?", "order": 0 },
      { "delayMinutes": 4320, "message": "Last nudge", "order": 1 }
    ]
  }
}`}</Code>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <code className="text-foreground">automation</code> is{" "}
          <code className="text-foreground">null</code> when the post has none. The automation is
          created as a <code className="text-foreground">DRAFT</code> and activates when the post
          publishes.
        </p>

        <h3 className="pt-2 text-base font-semibold">What this endpoint refuses</h3>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t align-top">
                <td className="px-3 py-2 font-mono">400</td>
                <td className="px-3 py-2 text-muted-foreground">none</td>
                <td className="px-3 py-2 leading-relaxed text-muted-foreground">
                  <code className="text-foreground">
                    At least one keyword is required when anyComment is false
                  </code>
                  . Send keywords, or set <code className="text-foreground">anyComment: true</code>,
                  or give every <code className="text-foreground">triggerBlocks</code> entry a
                  keyword.
                </td>
              </tr>
              <tr className="border-t align-top">
                <td className="px-3 py-2 font-mono">403</td>
                <td className="px-3 py-2">
                  <code className="font-mono text-foreground">BRANDING_CONTROL_REQUIRED</code>
                </td>
                <td className="px-3 py-2 leading-relaxed text-muted-foreground">
                  <code className="text-foreground">brandingEnabled: false</code> without the{" "}
                  <code className="text-foreground">automation:branding_control</code> capability.
                  Omit the field to follow your package instead.
                </td>
              </tr>
              <tr className="border-t align-top">
                <td className="px-3 py-2 font-mono">429</td>
                <td className="px-3 py-2 text-muted-foreground">none</td>
                <td className="px-3 py-2 leading-relaxed text-muted-foreground">
                  Your daily scheduled-post or automation allowance is spent, or the workspace is at
                  its total automation limit. See the plan table above.
                </td>
              </tr>
              <tr className="border-t align-top">
                <td className="px-3 py-2 font-mono">400</td>
                <td className="px-3 py-2 text-muted-foreground">none</td>
                <td className="px-3 py-2 leading-relaxed text-muted-foreground">
                  More than 10 <code className="text-foreground">followUps</code>, a follow-up past
                  your plan cap, an empty follow-up <code className="text-foreground">message</code>
                  , or a <code className="text-foreground">delayMinutes</code> outside 1 to 43200.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="media-uploads" title="Uploading media">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every media field takes one of three things: a{" "}
          <strong className="text-foreground">URL</strong>, a{" "}
          <strong className="text-foreground">file</strong> (multipart), or{" "}
          <strong className="text-foreground">raw bytes</strong>. Supply the same field two ways in
          one request and you get a 400. We will not guess which you meant.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground">URLs must be on our allowlist</strong> (Instagram CDN,
          Cloudflare R2 public domains, and media we host for you). A URL on your own CDN is
          rejected with a 400 once the post is, or becomes,{" "}
          <code className="text-foreground">SCHEDULED</code>; carousels are checked at create time
          regardless of status. If your media lives anywhere else, send us the bytes and we will
          host it for you.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Limits: <code className="text-foreground">15 MB</code> for images,{" "}
          <code className="text-foreground">100 MB</code> for video. Over-limit returns{" "}
          <code className="text-foreground">413</code> when the file rides along with a post, and{" "}
          <code className="text-foreground">400</code> on the standalone upload endpoint. Media
          uploads have no separate daily quota. They draw on the same budget as post creates, so an
          exhausted budget blocks them too.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We convert PNG, WebP and GIF to JPEG, pad the aspect ratio into Instagram&apos;s accepted
          range, and extract a real cover frame for reels. You do not need to pre-process anything.
          None of this applies to media you reference by URL; we only process bytes you send us.
        </p>

        <p className="text-sm font-semibold pt-1">Option 1: upload once, reference the URL</p>
        <p className="text-sm">
          <span className="font-mono text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-md">
            POST
          </span>
          <span className="font-mono ml-2">/api/v1/external/scheduler/media</span>
        </p>
        <Code>{`curl -X POST "${baseUrl}/api/v1/external/scheduler/media?postType=REEL" \\
  -H "Authorization: Bearer rv_live_YOUR_KEY" \\
  -H "x-workspace-id: YOUR_WORKSPACE_ID" \\
  -F "file=@clip.mp4"

# → { "url": "...", "primaryMediaUrl": "...", "thumbnailUrl": "...",
#     "filename": "...", "sizeBytes": 4900000, "maxBytes": 104857600 }`}</Code>
        <p className="text-sm text-muted-foreground">
          Use the returned <code className="text-foreground">primaryMediaUrl</code> (and{" "}
          <code className="text-foreground">thumbnailUrl</code> for reels) when you create the post.
        </p>

        <p className="text-sm font-semibold pt-1">Option 2: send the file with the post</p>
        <Code>{`curl -X POST "${baseUrl}/api/v1/external/scheduler/posts" \\
  -H "Authorization: Bearer rv_live_YOUR_KEY" \\
  -H "x-workspace-id: YOUR_WORKSPACE_ID" \\
  -F 'payload={"type":"REEL","scheduledLocal":"2026-05-20T14:30","timezone":"America/New_York","caption":"Hello"}' \\
  -F "primaryMediaUrl=@clip.mp4"`}</Code>
        <p className="text-sm text-muted-foreground">
          The <code className="text-foreground">payload</code> part carries every non-media field as
          JSON. File parts are named for the field they fill:{" "}
          <code className="text-foreground">primaryMediaUrl</code>,{" "}
          <code className="text-foreground">thumbnailUrl</code>, or{" "}
          <code className="text-foreground">carouselMedia</code> (up to 10 for a carousel).
        </p>

        <p className="text-sm font-semibold pt-1">Option 3: post raw bytes</p>
        <Code>{`curl -X POST "${baseUrl}/api/v1/external/scheduler/posts?type=REEL&scheduledLocal=2026-05-20T14:30&timezone=America/New_York" \\
  -H "Authorization: Bearer rv_live_YOUR_KEY" \\
  -H "x-workspace-id: YOUR_WORKSPACE_ID" \\
  -H "Content-Type: video/mp4" \\
  --data-binary @clip.mp4`}</Code>
        <p className="text-sm text-muted-foreground">
          Post fields travel in the query string, the body is the file. Defaults to{" "}
          <code className="text-foreground">primaryMediaUrl</code>; add{" "}
          <code className="text-foreground">X-Media-Field</code> to target another. It accepts{" "}
          <code className="text-foreground">primaryMediaUrl</code>,{" "}
          <code className="text-foreground">thumbnailUrl</code> or{" "}
          <code className="text-foreground">carouselMediaUrls</code>. On{" "}
          <code className="text-foreground">PATCH</code> the header is{" "}
          <strong className="text-foreground">required</strong>, because a post has several media
          fields and we will not guess which one you meant to replace.
        </p>
        <p className="text-sm text-muted-foreground">
          <code className="text-foreground">coverImageUrl</code> is not a field on this API. Sent as
          a multipart part or via <code className="text-foreground">X-Media-Field</code> it returns
          a 400 before anything is stored; sent as a plain JSON value it is silently ignored and the
          request still succeeds, so omit it rather than relying on an error.
        </p>
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
          <code className="text-foreground">specific</code> (with a{" "}
          <code className="text-foreground">postId</code>) or{" "}
          <code className="text-foreground">next</code>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground">
            <code className="text-foreground">postScope: &quot;any&quot;</code> is no longer
            accepted on create.
          </strong>{" "}
          It returns <code className="text-foreground">400</code> with{" "}
          <code className="text-foreground">
            code: &quot;POST_SCOPE_ANY_NO_LONGER_OFFERED&quot;
          </code>
          . Omitting <code className="text-foreground">postScope</code> without a{" "}
          <code className="text-foreground">postId</code> resolved to{" "}
          <code className="text-foreground">any</code> and is refused the same way, so send{" "}
          <code className="text-foreground">next</code>, or{" "}
          <code className="text-foreground">specific</code> with a{" "}
          <code className="text-foreground">postId</code>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Automations created before this keep running unchanged, and a{" "}
          <code className="text-foreground">PATCH</code> may narrow one from{" "}
          <code className="text-foreground">any</code> to{" "}
          <code className="text-foreground">specific</code> or{" "}
          <code className="text-foreground">next</code>. Nothing can move back to{" "}
          <code className="text-foreground">any</code>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The public comment reply is{" "}
          <strong className="text-foreground">off unless you ask for it</strong>: send{" "}
          <code className="text-foreground">autoReply: true</code> together with a non-empty{" "}
          <code className="text-foreground">replyMessages</code>. Omit either and the automation
          sends the DM only. No reply is posted, and the response is still a 201.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <code className="text-foreground">followUps</code> (max 10) queues follow-up DMs after the
          first, each with <code className="text-foreground">message</code> plus one of{" "}
          <code className="text-foreground">delaySeconds</code>,{" "}
          <code className="text-foreground">delayMinutes</code> or{" "}
          <code className="text-foreground">delay</code>. Your plan’s follow-up cap applies.{" "}
          <code className="text-foreground">brandingEnabled: false</code> removes Liffio branding
          from the DM on paid plans.
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
                ["413", "Uploaded file exceeds the size limit for its type"],
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
