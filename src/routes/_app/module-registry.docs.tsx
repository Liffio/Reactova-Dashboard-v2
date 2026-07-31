import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { BackLink } from "@/components/admin/form-page";
import { DocSection, CodeBlock, Step, Callout } from "@/components/admin/docs-primitives";

const MODULE_MANAGE = "platform:module_manage";

export const Route = createFileRoute("/_app/module-registry/docs")({
  head: () => ({ meta: [{ title: "Module Registry — Developer guide" }] }),
  component: DocsRoute,
});

function DocsRoute() {
  return (
    <PlatformPermissionRoute permission={MODULE_MANAGE}>
      <ModuleRegistryDocs />
    </PlatformPermissionRoute>
  );
}

/**
 * The developer guide for the module registry.
 *
 * Lives in the console rather than in a markdown file because the people who need it are already
 * standing in the console when the question arises — "I made a module, now what?" — and a doc you
 * have to go looking for is a doc nobody reads.
 *
 * It documents the contract, not the implementation: every command, key and function named here is
 * something a developer types. When one of those changes, this page changes with it.
 */
function ModuleRegistryDocs() {
  return (
    <div>
      <PageHeader
        eyebrow={<BackLink to="/module-registry">Module Registry</BackLink>}
        title="Developer guide"
        description="How to create a module in the console and use it in code — end to end."
      />

      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 md:p-10">
        <Callout tone="info" title="The one rule">
          The registry is the source of truth. Code never invents a module key — it imports a
          generated constant. A typo in a string literal compiles fine and fails silently at
          runtime; a missing constant is a build error.
        </Callout>

        <DocSection title="The model" description="Three tables, and what each one means.">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium">Parent module — a product area</dt>
              <dd className="text-muted-foreground">
                Automations, Scheduler, Bio Link. Owns a sidebar entry, an API prefix, and a
                permission that gates visibility. In code it maps to a <em>class</em>.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Child module — a capability inside it</dt>
              <dd className="text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  automation:trigger_blocks
                </code>
                . What roles grant and packages sell. In code it maps to a <em>function</em>, or to
                nothing at all if it only gates UI.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Mapping — which children belong to which parent</dt>
              <dd className="text-muted-foreground">
                Many-to-many, so a capability can live under more than one area.
              </dd>
            </div>
          </dl>
        </DocSection>

        <DocSection
          title="Adding a module"
          description="Console first, then code. In that order — codegen reads the database."
        >
          <div className="space-y-4">
            <Step n={1} title="Create it in the console">
              <p>
                <strong>Module Registry → New module.</strong> The key is derived from the name and
                is <strong>immutable after creation</strong> — code, role grants, package rows and
                mappings all reference it, so renaming would detach every one of them.
              </p>
              <p className="mt-2">
                Set <strong>API prefix</strong> if the module owns endpoints. Disabling the module
                404s everything under it. Leave it blank if it owns none.
              </p>
              <p className="mt-2">
                Set <strong>Required permission</strong> to whatever should gate the sidebar entry —
                usually <code className="font-mono text-xs">&lt;key&gt;:read</code>. Blank means
                everyone with a sidebar sees the link.
              </p>
            </Step>

            <Step n={2} title="Add its capabilities">
              Open the module and use <strong>Sub-functions → Create new</strong>. Keys are
              namespaced under the parent automatically.
            </Step>

            <Step n={3} title="Regenerate the constants">
              <CodeBlock>{`cd server
npm run modules:codegen     # writes both generated files
npm run modules:codegen:check   # CI guard: non-zero exit on drift`}</CodeBlock>
              <p className="mt-2">
                This writes{" "}
                <code className="font-mono text-xs">server/src/generated/modules.ts</code> and{" "}
                <code className="font-mono text-xs">Client-v2/src/generated/modules.ts</code>.{" "}
                <strong>Commit both.</strong> They are generated at author time, never at build time
                — a build that needs a live database is a build that fails when the database is
                unreachable.
              </p>
            </Step>

            <Step n={4} title="Register the code">
              <p>
                Add the module to{" "}
                <code className="font-mono text-xs">server/src/modules/registry.ts</code>, keyed by
                the generated constants:
              </p>
              <CodeBlock>{`import { MODULES, CONTENT_STUDIO_CAPABILITIES as CS } from "../generated/modules";
import { ContentStudioModule } from "./contentStudioModule";

export const MODULE_REGISTRY = {
  [MODULES.CONTENT_STUDIO]: {
    class: ContentStudioModule,                        // parent = class
    children: {
      [CS.BULK_EXPORT]: { fn: ContentStudioModule.bulkExport },  // real function
      [CS.ALT_TEXT]:    { gate: true },                          // UI/data gate only
    },
  },
};`}</CodeBlock>
              <Callout tone="warn" title="fn or gate — never neither">
                Every capability must declare one. An entry with neither is reported by{" "}
                <code className="font-mono text-xs">validateRegistry()</code> and throws on boot in
                development.
              </Callout>
            </Step>
          </div>
        </DocSection>

        <DocSection title="Using it in code" description="Server side.">
          <CodeBlock>{`import { can, invoke } from "../services/capabilityResolver";
import { CONTENT_STUDIO_CAPABILITIES as CS } from "../generated/modules";

// Check — returns false for an unregistered key rather than throwing, so a capability
// deleted from code while a stale grant lingers quietly stops working.
if (can(ctx, CS.BULK_EXPORT)) { /* … */ }

// Dispatch — throws on "not permitted" or "no handler", because a caller that reached
// invoke already decided this should run.
const result = await invoke(ctx, CS.BULK_EXPORT, { format: "csv" });

// When you hold ids rather than a resolved context:
await canForUser(userId, workspaceId, CS.BULK_EXPORT);`}</CodeBlock>

          <p className="mt-3 text-sm">
            For plain CRUD, keep using middleware —{" "}
            <code className="font-mono text-xs">requirePermission("content_studio", "read")</code>.
            Never put permission logic in a route handler.
          </p>
        </DocSection>

        <DocSection title="Using it in code" description="Client side.">
          <CodeBlock>{`import { useCan } from "@/hooks/use-features";
import { CONTENT_STUDIO_CAPABILITIES as CS } from "@/generated/modules";

const canExport = useCan(CS.BULK_EXPORT);
{canExport && <Button onClick={exportAll}>Export</Button>}`}</CodeBlock>
          <Callout tone="warn" title="Hide, do not disable">
            Never hardcode a permission string, and never render an action the user cannot take. The
            server is the enforcement point; the UI's job is to not offer what will be refused.
          </Callout>
        </DocSection>

        <DocSection
          title="How access is decided"
          description="Every condition must hold. If a capability is not working, walk this list in order."
        >
          <ol className="space-y-2 text-sm">
            {[
              ["Registered", "present in modules/registry.ts — otherwise can() returns false"],
              ["Mapped", "the child module is mapped to a parent in the console"],
              [
                "Enabled",
                "the parent module is switched on — disabling withdraws its capabilities",
              ],
              ["Permitted", "the user's role grants it, or a user override does"],
              ["Entitled", "the workspace's package includes it — no package means unrestricted"],
            ].map(([term, detail], i) => (
              <li key={term} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                  {i + 1}
                </span>
                <span>
                  <strong>{term}</strong> — <span className="text-muted-foreground">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </DocSection>

        <DocSection title="Commands" description="All run from `server/`.">
          <CodeBlock>{`npm run modules:codegen         # regenerate constants for both repos
npm run modules:codegen:check   # CI: fail if committed constants drifted
npm run modules:backfill        # seed the registry (idempotent)
npm run modules:check           # health report — faults vs expected divergence
npm run packages:backfill       # seed packages from the plan catalogue

# Local only: this machine's Postgres has no pgvector, so db:migrate cannot run.
npx tsx scripts/applyMigration.ts <MigrationClassName>
npx tsx scripts/revertMigration.ts <MigrationClassName>`}</CodeBlock>
          <p className="mt-3 text-sm text-muted-foreground">
            <code className="font-mono text-xs">modules:check</code> separates{" "}
            <strong>faults</strong> (an ungated sidebar entry, an enabled module with no API prefix,
            a config capability missing from the registry) from <strong>notes</strong> (expected
            divergence). Only faults set a non-zero exit — reporting expected divergence as failure
            is how a real defect once survived unnoticed.
          </p>
        </DocSection>

        <DocSection title="Disabling a module" description="What actually happens.">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              • Every request under its API prefix answers <strong>404</strong>, as if never
              deployed.
            </li>
            <li>• Its capabilities disappear from Access Management.</li>
            <li>• The sidebar entry is removed for everyone.</li>
            <li>
              • Existing role grants are <strong>kept</strong> — re-enabling restores them
              untouched.
            </li>
          </ul>
          <Callout tone="info" title="Never maskable">
            <code className="font-mono text-xs">/api/v1/admin/**</code> and{" "}
            <code className="font-mono text-xs">/api/v1/auth/**</code> are never masked, whatever
            the registry says. Locking yourself out of the console that re-enables modules is not a
            recoverable state. Masking also fails open: if the lookup cannot answer, the request is
            served rather than refused.
          </Callout>
        </DocSection>

        <DocSection title="Packages" description="Selling capabilities.">
          <p className="text-sm">
            A package is a <strong>ceiling</strong>, not a grant. It can only remove capabilities a
            role already confers — including one in a package a user's role does not grant does not
            give it to them.
          </p>
          <Callout tone="info" title="No package means unrestricted">
            A workspace with no package assigned is not entitled to nothing — it keeps everything
            its roles grant. Restricting a tenant is always a deliberate action.
          </Callout>
          <p className="mt-3 text-sm text-muted-foreground">
            Editing a package's contents takes effect immediately for every workspace on it: caches
            are dropped and every member is told exactly which capabilities came and went. CRUD is
            never filtered by a package — that stays with billing and plan enforcement.
          </p>
        </DocSection>
      </div>
    </div>
  );
}
