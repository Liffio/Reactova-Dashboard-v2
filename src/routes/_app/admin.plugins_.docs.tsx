import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { BackLink } from "@/components/admin/form-page";
import { DocSection, CodeBlock, Step, Callout } from "@/components/admin/docs-primitives";

const PLUGIN_MANAGE = "platform:plugin_manage";

export const Route = createFileRoute("/_app/admin/plugins_/docs")({
  head: () => ({ meta: [{ title: "Plugins — Developer guide" }] }),
  component: DocsRoute,
});

function DocsRoute() {
  return (
    <PlatformPermissionRoute permission={PLUGIN_MANAGE}>
      <PluginDocs />
    </PlatformPermissionRoute>
  );
}

/**
 * The end-to-end guide for building and shipping a plugin.
 *
 * Lives in the console next to the upload button for the same reason the module-registry guide
 * does: the person who needs it is already standing here. It documents the contract, not the
 * implementation — every command, key and field named on this page is something a plugin author
 * types. When one of those changes, this page changes with it.
 */
function PluginDocs() {
  return (
    <div>
      <PageHeader
        eyebrow={<BackLink to="/admin/plugins">Plugins</BackLink>}
        title="Plugin development guide"
        description="From an empty folder to a signed zip installed on the platform — end to end."
      />

      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 md:p-10">
        <Callout tone="info" title="What a plugin is">
          A zip file, developed in its own folder against{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">@liffio/plugin-sdk</code>{" "}
          only — never against core code. It attaches to the <em>running</em> platform: upload +
          activate registers its routes, sidebar entry, capabilities and tables with no core
          rebuild or redeploy, and uninstall removes every trace. The core stays untouched either
          way.
        </Callout>

        <DocSection
          title="Quickstart"
          description="Six steps. The reference implementation for every one of them is the plugin-user/ folder in the repo root."
        >
          <div className="space-y-4">
            <Step n={1} title="Scaffold the project">
              <p>
                The SDK ships a CLI that generates the whole skeleton — folder layout, a valid
                manifest, a working server entry and UI page:
              </p>
              <CodeBlock>{`# anywhere outside the server/ and Client-v2/ repos
npx --package=../server/plugin-sdk liffio-plugin init my-plugin --template full
# templates: server | ui | full (server + UI)`}</CodeBlock>
              <p className="mt-2">
                Or copy <code className="font-mono text-xs">plugin-user/</code> and rename. Either
                way you end up with:
              </p>
              <CodeBlock>{`my-plugin/
├── plugin.json          # the manifest — everything the platform knows about you
├── package.json         # depends on @liffio/plugin-sdk (file:../server/plugin-sdk)
├── src/server/index.ts  # server entry — bundled automatically by \`pack\`
├── ui/index.html        # static UI — served in an iframe inside the app shell
└── migrations/*.sql     # optional — your own plg_ tables`}</CodeBlock>
            </Step>

            <Step n={2} title="Fill in plugin.json">
              <p>
                The manifest is validated on pack <em>and</em> on upload against the same schema, so
                a mistake fails on your machine, not in the console. Field-by-field reference below.
              </p>
            </Step>

            <Step n={3} title="Write the server half">
              <p>
                Export <code className="font-mono text-xs">register(ctx)</code> (and optionally{" "}
                <code className="font-mono text-xs">unregister</code>). Routes go on{" "}
                <code className="font-mono text-xs">ctx.router</code>, which is already mounted
                behind auth + workspace middleware at{" "}
                <code className="font-mono text-xs">/api/v1/plugins/&lt;key&gt;</code>:
              </p>
              <CodeBlock>{`import type { PluginContext } from "@liffio/plugin-sdk";

export async function register(ctx: PluginContext): Promise<void> {
  const db = ctx.db!; // present because plugin.json declares uses: ["db"]

  ctx.router?.get("/items", async (req: any, res: any, next: any) => {
    try {
      const workspaceId = req.workspace.id; // guaranteed by the host
      const items = await db.query(
        "SELECT * FROM plg_my_plugin_items WHERE workspace_id = :workspaceId",
        [],
        { workspaceId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });
}`}</CodeBlock>
              <p className="mt-2">
                Import <strong>only</strong> from the SDK. <code className="font-mono text-xs">pack</code>{" "}
                bundles your entry into one self-contained ESM file — a stray import of a package
                you never installed fails the build right there.
              </p>
            </Step>

            <Step n={4} title="Write the UI half (optional)">
              <p>
                A static page — no framework required. It runs in a sandboxed iframe and talks to
                your own API with a short-lived token it requests from the host page. See the
                bridge section below for the whole protocol; the scaffold's{" "}
                <code className="font-mono text-xs">ui/index.html</code> already implements it.
              </p>
            </Step>

            <Step n={5} title="Pack — bundle, sign, zip">
              <CodeBlock>{`cd my-plugin
npm install          # once — links the SDK
npm run typecheck    # your code against the SDK types
npx liffio-plugin pack . \\
  --key ../server/plugin-fixtures/keys/private.pem \\
  --out ./dist-zips/plugin.my-plugin.zip
npx liffio-plugin validate ./dist-zips/plugin.my-plugin.zip`}</CodeBlock>
              <p className="mt-2">
                <code className="font-mono text-xs">pack</code> compiles + bundles{" "}
                <code className="font-mono text-xs">src/server/index.ts</code> with esbuild, copies
                your built UI, computes a checksum over the archive and signs it with the private
                key. The signature travels inside the zip.
              </p>
            </Step>

            <Step n={6} title="Install it — in this console">
              <p>
                <strong>Plugins → Upload plugin</strong> (validates + verifies the signature, stores
                the archive; runs no plugin code) → <strong>Activate</strong> (TOTP-confirmed; runs
                migrations, registers modules/routes/capabilities in API and worker) → set{" "}
                <strong>Exposure</strong> → <strong>Grant</strong> it to workspaces or users. The
                sidebar entry appears live for granted users — no reload.
              </p>
            </Step>
          </div>
        </DocSection>

        <DocSection
          title="Naming — one key, everything derives"
          description="Pick the manifest key carefully; it is immutable once installed."
        >
          <p className="text-sm">
            The key <code className="font-mono text-xs">plugin.my-plugin</code> derives a{" "}
            <em>keyslug</em> (<code className="font-mono text-xs">my_plugin</code> — prefix stripped,
            hyphens to underscores) and from it every other name:
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="[&_td]:border-b [&_td]:py-1.5 [&_td:first-child]:pr-4 [&_td:first-child]:font-medium [&_td:last-child]:font-mono [&_td:last-child]:text-xs [&_td:last-child]:text-muted-foreground">
                <tr><td>API prefix</td><td>/api/v1/plugins/plugin.my-plugin</td></tr>
                <tr><td>App page</td><td>/plugins/my-plugin</td></tr>
                <tr><td>Registry parent module</td><td>plugin_my_plugin</td></tr>
                <tr><td>Baseline access capability</td><td>plugin_my_plugin:access</td></tr>
                <tr><td>Manifest capability keys</td><td>my_plugin.&lt;thing&gt;.&lt;action&gt;</td></tr>
                <tr><td>Database tables</td><td>plg_my_plugin_*</td></tr>
                <tr><td>Package limit keys</td><td>my_plugin.&lt;suffix&gt;</td></tr>
              </tbody>
            </table>
          </div>
        </DocSection>

        <DocSection title="The manifest, field by field" description="plugin.json — the whole contract.">
          <CodeBlock>{`{
  "key": "plugin.my-plugin",          // ^plugin\\.[a-z0-9][a-z0-9-]{2,40}$ — globally unique, immutable
  "name": "My Plugin",                // display name
  "version": "1.0.0",                 // semver; bump for every new upload
  "engine": ">=1.0.0 <2",             // SDK range you support (use >=1.1.0 if you need coreUsers)
  "provides": ["server", "ui"],       // one or both

  "entryServer": "dist/server/index.js",            // required iff provides has "server" (fixed value)
  "ui": { "entryDir": "dist/ui", "index": "index.html" },  // required iff provides has "ui" (fixed values)

  "parentModule": {                   // required iff "ui" — the sidebar entry
    "name": "My Plugin",
    "route": "/plugins/my-plugin",    // must equal /plugins/<key minus "plugin.">
    "icon": "plug",
    "navGroup": "Workspace"
  },

  "capabilities": [                   // extra grantable permissions beyond baseline access
    {
      "key": "my_plugin.items.manage",           // must start with "<keyslug>."
      "name": "Manage items",
      "routes": [{ "method": "POST", "path": "/items" }]  // enforced from activation ("born enforced");
    }                                                     // :id segments are supported
  ],

  "uses": ["db", "limits"],           // ctx services you request — the admin approves this list
                                      // db | queue | socket | limits | storage | core:users | events:<name>
  "migrations": ["migrations/001_init.sql"],  // flat .sql files under migrations/ only
  "limits": ["my_plugin.max_items"]   // package-limit keys you read via ctx.limits
}`}</CodeBlock>
          <Callout tone="warn" title="Undeclared means absent">
            Every service you want on <code className="font-mono text-xs">ctx</code> must be in{" "}
            <code className="font-mono text-xs">uses</code>. An undeclared service is not stubbed —
            it is simply not there. The super admin sees and approves exactly this list at
            activation; that approval is the consent model.
          </Callout>
        </DocSection>

        <DocSection
          title="What your code receives: ctx"
          description="Always present: logger, manifest, keyslug — plus router in the API process. Everything else is opt-in via uses."
        >
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium font-mono text-xs">ctx.router</dt>
              <dd className="text-muted-foreground">
                Express-compatible router at your API prefix, behind session auth (or plugin-token
                auth for your iframe). <code className="font-mono text-xs">req.user.id</code> and{" "}
                <code className="font-mono text-xs">req.workspace.id</code> are guaranteed; assume
                nothing else on <code className="font-mono text-xs">req</code>. Absent in the worker
                process.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">ctx.db — uses: ["db"]</dt>
              <dd className="text-muted-foreground">
                Raw SQL, mechanically restricted to your own{" "}
                <code className="font-mono text-xs">plg_&lt;keyslug&gt;_*</code> tables. Full rules
                in the next section.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">ctx.coreUsers — uses: ["core:users"] (SDK ≥ 1.1)</dt>
              <dd className="text-muted-foreground">
                Platform user administration: list/get/create/update/remove users, list packages,
                assign a package to a workspace. Every mutation is audited; package changes reuse
                the core assignment path so caches invalidate correctly. <strong>Platform-wide by
                design</strong> — see the callout below.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">ctx.queue — uses: ["queue"]</dt>
              <dd className="text-muted-foreground">
                Namespaced BullMQ queue. <code className="font-mono text-xs">enqueue()</code> from
                anywhere; <code className="font-mono text-xs">process()</code> handlers run only in
                the worker process.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">ctx.events — uses: ["events:<em>name</em>"]</dt>
              <dd className="text-muted-foreground">
                Subscribe to core events, one <code className="font-mono text-xs">uses</code> entry
                per event: <code className="font-mono text-xs">lead.captured</code>,{" "}
                <code className="font-mono text-xs">dm.sent</code>,{" "}
                <code className="font-mono text-xs">post.published</code>,{" "}
                <code className="font-mono text-xs">workspace.member_added</code>.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">ctx.socket — uses: ["socket"]</dt>
              <dd className="text-muted-foreground">
                <code className="font-mono text-xs">emitToWorkspace(workspaceId, event, payload)</code>{" "}
                — real-time pushes to connected members, namespaced by the host. Works from API and
                worker.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">ctx.limits — uses: ["limits"]</dt>
              <dd className="text-muted-foreground">
                <code className="font-mono text-xs">get(key, workspaceId)</code> resolves your
                declared limit keys from the workspace's package.{" "}
                <code className="font-mono text-xs">null</code> means no cap is set — treat it as
                unlimited, not zero.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">ctx.storage — uses: ["storage"]</dt>
              <dd className="text-muted-foreground">
                <code className="font-mono text-xs">storage.dir</code> — a private disk directory
                for your files, shared between API and worker.
              </dd>
            </div>
          </dl>
          <Callout tone="warn" title="core:users is platform-wide">
            Unlike everything else on ctx, it is not workspace-scoped: any workspace this plugin is
            exposed to can see and mutate <em>all</em> users. Reserve it for internal admin tooling,
            keep the plugin's exposure <strong>restricted</strong>, and grant it only to your admin
            workspace.
          </Callout>
        </DocSection>

        <DocSection
          title="Database rules — the plg_ policy"
          description="Both your migrations and every runtime query are statement-inspected. Violations are rejected, not warned."
        >
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Tables must be named <code className="font-mono text-xs">plg_&lt;keyslug&gt;_*</code> and referenced by bare name — no schema qualifiers, no quoted identifiers.</li>
            <li>• Runtime queries: single statement, <code className="font-mono text-xs">SELECT / INSERT / UPDATE / DELETE</code> only. No CTEs, no dollar-quoting.</li>
            <li>• Include a <code className="font-mono text-xs">workspace_id</code> column and index in every table.</li>
            <li>• Migrations run in order at activation, inside the activation transaction.</li>
          </ul>
          <p className="mt-3 text-sm">
            Workspace scoping is mechanical, not trust-based: every statement must contain the
            literal <code className="font-mono text-xs">:workspaceId</code> placeholder, which the
            host replaces with a bound parameter —
          </p>
          <CodeBlock>{`await db.query(
  "SELECT * FROM plg_my_plugin_items WHERE workspace_id = :workspaceId AND status = $1",
  ["open"],                       // your own params are $1..$n — never number the placeholder
  { workspaceId: req.workspace.id },
);
// executes: ... WHERE workspace_id = $2 AND status = $1   params: ["open", workspaceId]`}</CodeBlock>
          <p className="mt-2 text-sm text-muted-foreground">
            SELECT/UPDATE/DELETE additionally require a literal{" "}
            <code className="font-mono text-xs">workspace_id = :workspaceId</code> predicate; INSERT
            must set the column from the placeholder. Cross-tenant reads are therefore impossible to
            write by accident.
          </p>
        </DocSection>

        <DocSection
          title="The UI ↔ host bridge"
          description="Your page runs in an iframe inside the app shell and calls only your own API."
        >
          <div className="space-y-3 text-sm">
            <p>
              On load, your page asks the host for a token; the host answers with a 5-minute JWT
              plus context. Protocol v1, via{" "}
              <code className="font-mono text-xs">postMessage</code>:
            </p>
            <CodeBlock>{`// child -> host
window.parent.postMessage({ v: 1, type: "requestToken" }, "*");
// host -> child
{ v: 1, type: "token", token, pluginKey, workspaceId }
// child -> host (optional, after render)
window.parent.postMessage({ v: 1, type: "resize", height: 900 }, "*");`}</CodeBlock>
            <p>
              Send the token as{" "}
              <code className="font-mono text-xs">Authorization: Bearer &lt;token&gt;</code> on
              requests to <code className="font-mono text-xs">/api/v1/plugins/&lt;key&gt;/…</code>.
              On a 401, request a fresh token once and retry — tokens are short-lived on purpose.
              The SDK exports <code className="font-mono text-xs">initPluginHost()</code> which does
              all of this if your UI has a build step; the scaffold inlines the same ~30 lines for
              build-free pages.
            </p>
            <Callout tone="info" title="The token opens your door only">
              A plugin token is valid under your own API prefix and nowhere else — it cannot call
              core routes. Deeper checks (capabilities, package ceiling, exposure) still apply per
              request.
            </Callout>
          </div>
        </DocSection>

        <DocSection
          title="Signing — how trust works"
          description="One private key signs every plugin; the platform ships the matching public key."
        >
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              • The <strong>private key</strong> lives only on the machine that builds plugins:{" "}
              <code className="font-mono text-xs">server/plugin-fixtures/keys/private.pem</code>{" "}
              (git-ignored). Never on a server, never in git, never in a zip.
            </li>
            <li>
              • The <strong>public key</strong> is committed into the server as the default — no
              environment configuration needed. The{" "}
              <code className="font-mono text-xs">PLUGIN_PUBLIC_KEY</code> env var exists only to
              rotate keys.
            </li>
            <li>
              • Upload verifies the zip's signature against that key. A zip signed with any other
              key is refused — that is the entire point.
            </li>
          </ul>
          <CodeBlock>{`# one-time, if you ever need a fresh pair (server/):
npx tsx scripts/generate-plugin-keys.ts        # writes plugin-fixtures/keys/{private,public}.pem`}</CodeBlock>
        </DocSection>

        <DocSection
          title="Lifecycle, exposure and access"
          description="Who can reach an activated plugin — every layer must agree."
        >
          <ol className="space-y-2 text-sm">
            {[
              [
                "Status",
                "installed → active → disabled. Upload never runs plugin code; activate/deactivate are TOTP-confirmed and hot-apply to API and worker without a restart. Repeated runtime errors trip a circuit breaker that auto-disables the plugin.",
              ],
              [
                "Exposure",
                "hidden (default — nobody sees it) → restricted (only explicitly granted workspaces/users) → released (generally available). Fail-closed: an unknown state means invisible.",
              ],
              [
                "Grants",
                "workspace or user allow/deny from the console's grants dialog. A user DENY beats a workspace ALLOW.",
              ],
              [
                "Package ceiling",
                "attach the plugin to packages to include it in the entitlement ceiling. As everywhere in Liffio, a package can only cap what roles grant — and no package means unrestricted.",
              ],
              [
                "Capability wall",
                "routes you declared under a capability are enforced from the moment of activation; everything else needs only baseline access (plugin_<keyslug>:access).",
              ],
            ].map(([term, detail], i) => (
              <li key={term} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                  {i + 1}
                </span>
                <span>
                  <strong>{term}</strong> —{" "}
                  <span className="text-muted-foreground">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <Callout tone="info" title="Updates and uninstall">
            Ship an update by uploading a zip with the same key and a higher version, then
            activating it — <strong>Rollback</strong> returns to the previous archived version.
            Uninstall deletes every trace (registry rows, grants, routes, unpacked files); your{" "}
            <code className="font-mono text-xs">plg_</code> tables survive until the separate{" "}
            <strong>Purge data</strong> action, and the uploaded archives remain for reinstall.
          </Callout>
        </DocSection>

        <DocSection title="Troubleshooting" description="The errors you will actually meet, in the order you will meet them.">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium font-mono text-xs">404 on /api/v1/admin/plugins</dt>
              <dd className="text-muted-foreground">
                The plugin system is dark-launched: the server only mounts plugin routes when{" "}
                <code className="font-mono text-xs">PLUGINS_ENABLED=true</code> is in its
                environment. Set it and recreate the containers.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">signature.sig does not verify</dt>
              <dd className="text-muted-foreground">
                The zip was signed with a private key that does not match the server's public key.
                Re-pack with the platform private key — and if you ever generated a second keypair,
                delete it; exactly one pair must exist.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">EACCES … plugins/_archives</dt>
              <dd className="text-muted-foreground">
                A <code className="font-mono text-xs">PLUGINS_STORAGE_ROOT</code> override points
                somewhere the container user cannot write. Remove the variable — the default lands
                on the shared uploads volume, which both API and worker need.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">uses entry rejected at upload</dt>
              <dd className="text-muted-foreground">
                The server predates the service (for example{" "}
                <code className="font-mono text-xs">core:users</code> needs SDK 1.1 on the server).
                Deploy the platform first, then upload.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">engine mismatch at activation</dt>
              <dd className="text-muted-foreground">
                Your manifest's <code className="font-mono text-xs">engine</code> range does not
                include the server's SDK version. Widen the range or update the platform.
              </dd>
            </div>
            <div>
              <dt className="font-medium font-mono text-xs">Plugin visible to no one after activation</dt>
              <dd className="text-muted-foreground">
                Working as designed — exposure starts <em>hidden</em>. Set it to restricted +
                grant, or released.
              </dd>
            </div>
          </dl>
        </DocSection>

        <DocSection title="Reference implementations" description="Working code beats prose.">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              • <code className="font-mono text-xs">plugin-user/</code> (repo root) — full
              server+UI plugin: routes, capability-gated mutations, pagination, dialogs,{" "}
              <code className="font-mono text-xs">core:users</code>.
            </li>
            <li>
              • <code className="font-mono text-xs">server/plugin-fixtures/demo-full/</code> —
              minimal server+UI plugin with a <code className="font-mono text-xs">plg_</code>{" "}
              migration and a package limit.
            </li>
            <li>
              • <code className="font-mono text-xs">server/plugin-sdk/README.md</code> — the SDK's
              own reference (service table, bridge protocol, versioning).
            </li>
          </ul>
        </DocSection>
      </div>
    </div>
  );
}
