# Phase B — Make the Matrix Enforceable

The bulk of the work. V4 reads as a configuration exercise. **It is a gate-layer build *and* a package-authoring build** — and 📏 production measurement shows the package layer is not merely flat but **inverted**. 44 of the capability rows in `01-capability-map.md` are `NEW_GATE`; separately, every package hands out nearly everything.

All stages are Backend-only.

> ⚠️ **This phase converts a fail-open system into a fail-closed one.** Read `04-risks.md` SB1 before starting B1.

> ## 📏 Production measured 2026-08-19 — what changed in this phase
>
> | | Measured | Previously assumed |
> |---|---:|---|
> | Live workspaces | **74** | — |
> | `workspace_packages` rows | **2** | — |
> | Workspaces with no package row | **72 of 74** | 35–45 |
> | **Paying** workspaces among them | **4 — all of them** | unknown |
> | `capability_routes` | **8 rows, 6 capabilities** | 8 rows, 5 capabilities |
> | `child_modules` | **125** | 121 (codegen snapshot — **stale**) |
>
> **B1's report-only pass is now cheap** — 4 paying workspaces to review. **B2b is no longer awkwardly gated**, because A4 is unblocked. **B3 gains a concrete reconciliation target:** 125, not 121.

> ## 🔴 📏 MEASURED — `package_features` by package, production 2026-08-19
>
> | Package | Features | `analytics` | `team` | `api` | `scheduler` | `post_metrics` | `post_story` |
> |---|---:|---:|---:|---:|---:|---|---|
> | **Agency** | 146 | 11 | 6 | 9 | 28 | yes | **yes** |
> | **Free** | **140** | 11 | **6** | **9** | 28 | **yes** | **yes** |
> | **Starter** | 113 | 11 | 0 | 0 | 28 | yes | **yes** |
> | **Business** | **94** | 9 | **0** | **0** | 21 | yes | **yes** |
> | **Pro** | 92 | 9 | 0 | 0 | 21 | yes | **yes** |
> | **Growth** | **1** | 0 | 0 | 0 | 0 | no | no |
>
> **🔴 The ladder is INVERTED.** Free grants **140** features including all 6 `team:*` and all 9 `api:*` keys. Business grants **94** and **zero** of either. **A Free workspace holds strictly more capability than a paying Business workspace.**
>
> **B1, run against these packages, would assign a FREE workspace more capability than a BUSINESS one.** That is why **B0 now precedes B1** and B1 must not run against current package contents.
>
> **Two further findings:**
> - **A "Growth" package already exists with 1 feature** — hand-created 69 minutes before the real packages and abandoned. 📏 **Orphaned: zero references** from `workspace_packages`, `package_prices`, `package_limits` or `package_products`. **Settled — B0 deletes and recreates it.**
> - **All five real packages grant `scheduler:post_story`** — the capability the server rejects. **B7 has five live targets**, not a hypothetical.
>
> **📏 These contents were produced in a SINGLE WRITE RUN — but by an unidentified program.** Creation timestamps:
>
> | Package | Created | Features |
> |---|---|---:|
> | Growth | 2026-07-21 **20:57:33.808** | 1 |
> | Free | 2026-07-21 **22:06:34.815** | 140 |
> | Starter | 2026-07-21 22:06:34.859 | 113 |
> | Pro | 2026-07-21 22:06:34.888 | 92 |
> | Business | 2026-07-21 22:06:34.915 | 94 |
> | Agency | 2026-07-21 22:06:34.941 | 146 |
>
> **📏 All five real packages were created within 126 milliseconds — one write run, by one program.** Growth predates them by 69 minutes and was created separately, then abandoned.
>
> **The "legacy drift from separate seeding epochs" hypothesis is REFUTED** — that is a data conclusion and it stands. This is not accumulated history; one execution produced Free with 140 features and Business with 94.
>
> **⚠️ But the writer is unidentified.** The rows were written by **production code at an unknown commit**. Local `Backend/` sits at `62b4177`, which is **not established to be the deployed release**. **We cannot say the local `backfillPackages.ts` is the program that ran**, nor that re-running it would reproduce the inversion. See the provenance rule in [`00-findings.md`](../00-findings.md).

---

## B0 · Author per-tier package contents 🔴 **NEW — must precede B1**

| | |
|---|---|
| **Goal** | **(a)** Each package grants **exactly** the capability set V4 §10 sells for that tier — no more, no less. **(b)** A future write cannot reproduce the inversion — **requirement stands, scope blocked on identifying the deployed writer** |
| **Repo** | Backend |
| **Files touched** | `src/db/seeds/backfillPackages.ts:51-64` (`GATED_MODULES`), `:157-171` (the row builder), `:148-155` (the curated-package skip). Plus a reconciliation script writing `package_features` |
| **Config-only vs new code** | New code (the reconciliation script + the standing monotonicity test) + **data** |
| **Migration required** | **N** — data rewrite, not schema |
| **PREVIEW-ONLY** | **YES.** It writes `package_features`. You execute it |
| **Dependencies** | **None.** Ships on its own — and **must land before B1** |
| **Rollback** | Restore the captured CSV. **Capture the current `package_features` as CSV before the first write** — 586 rows across 6 packages |
| **How to verify** | **(a)** Per tier, the granted key set **equals** V4 §10's column, exactly — set equality, both directions, plus the **monotonicity assertion as a permanent test**. **(b)** cannot be verified until the deployed writer is identified — see below |
| **Safe to ship independently** | **Yes** — 📏 only 2 workspaces hold a package today, so the blast radius of the rewrite itself is 2 rows |

### Why the seed cannot produce a correct ladder without changing its *shape*

`GATED_MODULES` (`backfillPackages.ts:51-64`) contains **four** entries and withholds at **parent-module granularity, all-or-nothing**:

| Module | Withheld when | Actually withheld from |
|---|---|---|
| `api` | `features.apiEnabled` false | FREE only |
| `agency` | `features.agencyPanel` false | All but AGENCY ✅ |
| `team` | `features.teamEnabled` false | **Nobody** — the flag is `true` on every plan including FREE |
| `scheduler` | `limits.schedulerPostsPerDay > 0` | **Nobody** — every plan is > 0 |

**Every other module — `automation`, `analytics`, `biolink`, `lead`, `shortlink`, `dashboard`, `settings`, `workspace`, `affiliate`, `creator_program`, `billing` — is in no gate**, so the builder writes one row per child for every package (`:157-171`). The file says so itself (`:45-48`): *"A module absent here has no per-plan gate in the current product and is therefore included in every package."*

**This is a shape problem, not an input problem.** Changing which flags are true cannot express "Growth gets `analytics:post_metrics` but not `analytics:export_data`", because the unit of gating is the parent module. **B0 must extend `GATED_MODULES` to per-child-key granularity** — a per-tier allowlist of capability keys — or replace it with one.

> ⚠️ **The curated-package guard would silently skip everything** *(local source, `62b4177` — confirm against the deployed release)*. `backfillPackages.ts:148-155` returns early for any package that already has `package_features` rows (`skippedCurated`), and 📏 all six packages have rows. **Either way B0 should not rely on a re-seed** — it needs an explicit update path, delete-then-write per package inside a transaction. That holds whether or not the deployed seed carries this guard.

### (b) Prevent a future write from reproducing the inversion — **requirement stands, scope UNSCOPED**

**The requirement is real:** whatever writes packages must not be able to produce a ladder where Free grants more than Business. **The implementation cannot be specified yet**, and the reason is provenance, not laziness.

**The rows were written by production code at an unknown commit.** Local `Backend/` is at `62b4177` and is **not established to be the deployed release**. So a fix aimed at local `backfillPackages.ts` may be aimed at a program that never ran.

| | |
|---|---|
| **(a) Data** | **Fully specified. Ships.** Replace all `package_features` contents wholesale, per the authored per-tier targets below. **This does not depend on provenance** — it is defined by V4 §10's targets, not by what wrote the current rows |
| **(b) Writer** | **Requirement stands, scope blocked.** Identify the deployed writer first. Do **not** trace local source for a defect that may not exist there |

> **This is a stronger reason to leave (b) unscoped than "we haven't found the bug yet."** It is not that the mechanism is elusive — it is that **the program under suspicion may not be the program that ran.** Reading local `backfillPackages.ts` more carefully cannot resolve that; only knowing the deployed commit can.

**An earlier version of this stage specified (b) as a concrete fix to `backfillPackages.ts`, including a reading of `GATED_MODULES` and `planConfig` that would explain the inversion's direction. That reading is withdrawn** — it describes local code that may never have written these rows.

### The one investigation step still worth taking — and it is a DATA question

**Read `package_features.created_at` directly.** The measured timestamps are `packages.created_at`; the feature rows may have been written or amended later. If they cluster with package creation, one program wrote everything; if they scatter, something edited them afterwards — which narrows the writer without reading a line of local source.

**That is a production SELECT.** It needs no assumption about which code is deployed, so it is the only step here that survives the provenance rule.

### The safeguard that does not depend on knowing the writer

```
granted(FREE) ⊂ granted(STARTER) ⊂ granted(GROWTH) ⊂ granted(BUSINESS) ⊂ granted(AGENCY)
```

**The monotonicity assertion is writer-agnostic — and that is now its main virtue.** It holds regardless of which program writes the rows, at which commit, in which environment. **It is the durable half of (b):** a check that fails loudly whenever an inverted ladder appears, whatever produced it.

**Make it a permanent test.** Until the deployed writer is identified, it is the whole of the protection — and it would have caught today's state on the day it was written.

### ✅ Disposition of the existing 1-feature "Growth" package — **SETTLED: DELETE AND RECREATE**

**📏 MEASURED 2026-08-19 — the `Growth` package (`939ab979-1ded-442b-94a2-c53cac036298`) is ORPHANED:**

| Referencing table | Rows |
|---|---:|
| `workspace_packages` | **0** |
| `package_prices` | **0** |
| `package_limits` | **0** |
| `package_products` | **0** |

**Nothing references its id.** The adopt-or-delete branch is closed: **delete it, then recreate under B0's authored contents.** No subscription, no price, no limit and no product points at it, so there is no history to preserve and no foreign key to break.

**It was created by hand and abandoned.** 📏 Its `created_at` is **2026-07-21 20:57:33.808** — **69 minutes before** the five real packages, which were all created within 126 ms of each other. It is not seed output; it is someone's half-finished manual attempt at a Growth tier, left in place.

> **Interaction with C2 — now clean.** C2 renames the *plan* `PRO → GROWTH`, and `backfillPackages.ts:66,132` derives package `key`/`humanId` from the plan literal. **Once B0 has dropped the orphan, C2 can create a clean `growth` package with no collision.** Sequence: B0 deletes → B0 recreates under authored contents → C2 renames the plan. See [`phase-c-tier-definitions.md`](phase-c-tier-definitions.md) C2.

### Required per-tier target

The authoritative source is V4 §10's matrix column per tier, cross-checked against [`01-capability-map.md`](../01-capability-map.md). The shape B0 must produce:

| Tier | Grants | Must NOT grant |
|---|---|---|
| **Free** | Base automation triggers, base biolink, base lead view, `analytics:overview`, `billing:*`, `workspace:*`, `settings:*`, `affiliate:*`, `creator_program:*`, `dashboard:ai_insights`, `team:view_members` | **All `api:*`** · **all `team:*` except `view_members`** · every Starter+ key · every Growth+ key |
| **Starter** | Free **+** the ~35 Starter-boundary keys (automation 8, biolink 6, lead 6, shortlink 5, scheduler 9, `analytics:conversion_rate`) | All `api:*`, all Growth+ analytics, scheduler templates, team management |
| **Growth** | Starter **+** `analytics:post_metrics`, `video_metrics`, `profile_outcomes`, `scheduler:caption_templates`, `hashtag_groups`, `schedule_templates`, `bulk_upload`, `best_time_to_post` (B3) | All `api:*`, all `team:*` management, `analytics:export_data`, `automation_attribution`, `scheduler:approval_workflow`, `activity_log` |
| **Business** | Growth **+** all `api:*`, `team:*` management, `analytics:export_data`, `automation_attribution`, `scheduler:approval_workflow`, `approve_posts`, `activity_log`, the alerts key (B3) | `agency:*` |
| **Agency** | Business **+** all `agency:*` | — |
| **All tiers** | — | **`scheduler:post_story`** and **`analytics:story_metrics`** — unsellable, see B7 |

### Verification — set equality, both directions

```
for each tier T:
    granted(T)  == expected(T)        # no extra keys
    expected(T) == granted(T)         # no missing keys
    granted(FREE) ⊂ granted(STARTER) ⊂ granted(GROWTH) ⊂ granted(BUSINESS) ⊂ granted(AGENCY)
```

**The monotonicity assertion is the one that would have caught today's state.** Free ⊄ Business is exactly the inversion measured. Add it as a permanent test, not a one-off check.

**Also assert:** no package grants `scheduler:post_story` or `analytics:story_metrics`; `granted(FREE) ∩ api:* = ∅`; `granted(FREE) ∩ team:* = {team:view_members}`.

### Verifying (b) — what can and cannot be checked today

**Cannot be checked:** "re-running the seed on a fresh database reproduces the inversion." That test names a specific local program, and we do not know it is the one that ran. A green result would prove nothing about production; a red one would be a bug in code that may not be deployed.

**Can be checked, and should be permanent:**

| Check | Why it survives the provenance rule |
|---|---|
| **The monotonicity assertion runs as a standing test** against whatever contents exist | Writer-agnostic. Catches an inverted ladder from any source, at any commit |
| **A read of `package_features.created_at`** | A production data question |

**When the deployed commit becomes known**, (b) can be scoped properly and a fresh-database reproduction test becomes meaningful. Until then the assertion carries it.

---

## B1 · Bind plan → package

| | |
|---|---|
| **Goal** | Every workspace carries a package matching its plan, so the capability ceiling becomes real |
| **Repo** | Backend |
| **Files touched** | **Reuse** `src/db/seeds/backfillPackages.ts` (already derives one package per `plan_catalog` row at `:74-81`, gating modules on `BILLING_PLANS` at `:51-64`) and `assignWorkspacePackage` (`src/services/workspacePackages.ts`). Reconciliation query against `workspace_packages` / `workspace_subscriptions`. Possibly `src/services/defaultPackage.ts:36,83-85,115` |
| **Config-only vs new code** | New code (a reconciliation script) + **data** |
| **Migration required** | **N** — this is a backfill, not a schema change |
| **PREVIEW-ONLY** | **YES.** The backfill writes `workspace_packages` rows. You execute it |
| **Dependencies** | **B0 — mandatory. B1 must NOT run against current package contents.** Plus **A1, A2**, or assigned packages leak on cancellation and cache staleness masks the effect |
| **Rollback** | `clearWorkspacePackage` per affected workspace (`src/services/workspacePackages.ts:198`). Capture the pre-state as a CSV before running |
| **How to verify** | Report-only pass first: for every workspace, list `plan`, current package, would-be package, and **the exact set of capabilities that would be removed AND granted** — both directions, per D8 as amended. Zero workspaces with a paid plan and no package after the write. **Assert no workspace gains a capability its tier does not sell** |
| **Safe to ship independently** | **No** — depends on A1/A2, and is the trigger for SB1 |

**Mandatory report-only stage.** Run the reconciliation in dry-run and review the capability-removal diff per workspace before any write.

**📏 MEASURED 2026-08-19 — the blast radius, restated.** The stale comment at `src/services/entitlement.ts:15-17` estimated 35–45 unpackaged workspaces. The real numbers:

| | Measured |
|---|---|
| Live workspaces | **74** |
| `workspace_packages` rows, platform-wide | **2** |
| Workspaces with **no** package row | **72 of 74** (97%) |
| Of those, **paying** | **4** |

**Wider than modelled:** the ceiling is inert almost platform-wide, not for roughly half.

**Cheaper than modelled:** the review that matters covers **4 paying workspaces**, not a fleet. Produce the full 72-row diff, but the rows that carry commercial risk are four.

**🔴 Every paying customer is unpackaged.** All 3 AGENCY ACTIVE, the 1 BUSINESS ACTIVE and the 1 STARTER ACTIVE workspace have no package row. **B1 turns the ceiling on for 100% of paying customers in a single deploy** — there is no partial rollout available, and no already-packaged cohort whose behaviour could serve as a canary. That is the argument for the report-only pass, and it is stronger now than when D8 was decided, not weaker.

### 🔴 B1's risk runs in BOTH directions — and against the current packages, mostly upward

SB1 was written as *"assigning packages silently removes capabilities from paying customers."* **📏 Measured, the opposite is true for most of the platform.**

| Cohort | Count | What B1 would do **against current package contents** |
|---|---:|---|
| Unpackaged **FREE** workspaces | **68** | **GRANTS more.** The Free package holds 140 features including all `api:*` and all `team:*` — more than the Business package's 94 |
| Unpackaged **paying** workspaces | **4** | Mixed. Business/Agency would be **restricted** (94/146 features); Starter roughly flat |
| The **CANCELED** Business workspace | 1 | Already packaged — this is the A1 leak |

**Assigning the current Free package to 68 Free workspaces would hand them API keys and team management.** That is the inversion, arriving as a deploy.

**This is why B0 is mandatory and must precede B1.** With authored packages, B1 becomes what it was always meant to be: a downward-only ceiling. **The report-only pass (D8) must show the direction per workspace — granted *and* removed — not only removals.**

**One of the 2 existing package rows is a leak.** It belongs to a **CANCELED BUSINESS** workspace (see A1). Do not treat it as a valid pre-state to preserve — reconcile it to *no package*, and note that A1 plus a one-off cleanup covers it independently.

**Also resolve here:** `packages.is_default` exists in migration (`1785900000000-AddPackageIsDefault.ts:34`) and service code (`defaultPackage.ts:36`) but **not on the entity** — TypeORM is unaware of the column. Fix before relying on default-package resolution.

---

## B2a · Capability routes — analytics and scheduler

| | |
|---|---|
| **Goal** | Gate the capabilities that define the Growth tier |
| **Repo** | Backend |
| **Files touched** | New migration seeding `capability_routes` — follow the shape of `src/db/migrations/1785700000000-AddCapabilityRoutes.ts:71-93`. Then `npm run capability-routes:codegen` to regenerate `src/generated/capabilityRoutes.ts`. Routes to cover: `src/api/routes/analytics.ts:29,50`; scheduler template/bulk-upload endpoints in `src/api/routes/scheduler.ts`; best-time-to-post at `src/api/routes/scheduler.ts:1001` |
| **Capabilities** | `analytics:post_metrics`, `analytics:video_metrics`, `analytics:profile_outcomes`, `analytics:automation_attribution`, `analytics:export_data`, `scheduler:caption_templates`, `scheduler:hashtag_groups`, `scheduler:schedule_templates`, `scheduler:bulk_upload`, `scheduler:approval_workflow`, `scheduler:activity_log` |
| **Config-only vs new code** | New code + **data** |
| **Migration required** | **Y** (seeds `capability_routes` rows) |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **B0** — a rule cannot deny a capability the package grants — then **B1** |
| **Rollback** | Delete the seeded rows, re-run codegen. Reversible `down()` in the migration |
| **How to verify** | `npm run capability-routes:codegen:check` clean. Per-capability integration test: a workspace whose package excludes `analytics:post_metrics` gets 403 `CAPABILITY_NOT_INCLUDED` on the post-metrics route |
| **Safe to ship independently** | **No** |

**Fail-open warning:** `requireCapabilityFromRegistry` calls `next()` on no rule match (`requireCapability.ts:168`), on missing `req.authz` (`:173-179`), **and on any thrown exception** (`:192-200`). A rule that does not match its route silently grants access. Every rule needs a test proving it denies.

### 🔴 Scope extension — gate the COST, not just the output, on TWO jobs

Gating a capability hides the output; it does not stop the work. **Two scheduled jobs select workspaces with no plan predicate at all:**

| Job | Schedule | Predicate | Cost per run |
|---|---|---|---|
| `schedulerAnalyticsSync` | hourly | `deleted_at IS NULL` + active IG account + insights permission (`:28-39`) | ~101 Graph calls per workspace |
| **`lyraGrowthAlert`** | daily 07:00 | `status = ACTIVE AND deletedAt IS NULL` + active IG account (`:24-33`) | One AI Gateway call per workspace, staggered 2000 ms because the shared 60/min budget is tight |

**`lyraGrowthAlert` is a new finding** — same shape as the analytics sync, previously unrecorded. **Both need a plan predicate inside this stage.** Gating `analytics:post_metrics` stops Free workspaces *seeing* post metrics while the sync still fetches them hourly; gating the alerts key stops Free workspaces *receiving* alerts while the scan still generates them daily.

**Also re-run the codegen at the end of this stage** — see the note at the foot of this file.

---

## B2b · Capability routes — team and API

| | |
|---|---|
| **Goal** | Gate the capabilities that define the Business tier |
| **Repo** | Backend |
| **Files touched** | Same migration pattern. Move `/api/v1/api-credentials` inside the wall — it is currently mounted at `src/api/router.ts:137` with `requireAuth, impersonationWriteGuard` and **no `loadAuthorizationContext`**, so `req.authz` never exists there. Team routes: `src/api/routes/team.ts:406,412` currently gate on `requirePermission("workspace","update")` and role-key checks |
| **Capabilities** | `team:assign_roles`, `team:remove_members`, `team:resend_invite`, `team:revoke_invite`; `api:view_keys`, `api:create_keys`, `api:revoke_keys`, `api:key_expiry`, `api:usage_stats`, `api:docs_access` |
| **Config-only vs new code** | New code + **data** |
| **Migration required** | **Y** |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **B0** (📏 the Free package currently grants all 9 `api:*` and all 6 `team:*` keys — without B0 this stage gates nothing), then **B1**; **A4** for the external-API surface — 📏 now unblocked (0 API credentials) |
| **Rollback** | Delete rows, re-run codegen, revert the mount move |
| **How to verify** | A Growth-package workspace cannot invite a member or create an API key; a Business-package workspace can |
| **Safe to ship independently** | **No** |

**Also required here:** `billing.config.ts` sets `teamEnabled: true` on **every** plan including FREE (`:72`) and `gates: { api: Plan.STARTER }` on every plan (`:73,93,113,133,153`). Those are `CONFIG_ONLY` changes but they are **part of this gate**, not part of Phase C's limit-value work — without them the capability rules and the feature flags disagree.

---

## B2c · Capability routes — the Starter boundary 🔴 **NEW**

| | |
|---|---|
| **Goal** | Gate the ~35 capabilities that define the **Free → Starter** boundary — the conversion event the whole funnel rests on |
| **Repo** | Backend |
| **Files touched** | Same migration pattern as B2a/B2b: seed `capability_routes`, then `npm run capability-routes:codegen`. Route surfaces: `src/api/routes/automations.ts`, `src/api/routes/biolink.ts`, `src/api/routes/leads.ts`, `src/api/routes/shortlinks.ts`, `src/api/routes/scheduler.ts` |
| **Capabilities** | `automation`: `post_scope_next`, `post_scope_specific`, `excluded_keywords`, `dm_button`, `dm_button_tracking`, `reply_variants`, `follow_before_dm`, `trigger_blocks` (8) · `biolink`: `custom_slug`, `item_icons`, `item_thumbnails`, `item_visibility`, `hide_badge`, `click_tracking` (6) · `lead`: `view_email`, `click_state`, `follow_state`, `source_media`, `trigger_provenance`, `export_data` (6) · `shortlink`: `custom_slug`, `custom_domain`, `edit_destination`, `click_tracking`, `lead_attribution` (5) · `scheduler`: `alt_text`, `cover_selection`, `first_comment`, `location_tag`, `media_library`, `thumbnail_offset`, `timezone_scheduling`, `share_to_feed`, `music_volume` (9) · `analytics:conversion_rate` (1) |
| **Config-only vs new code** | New code + **data** |
| **Migration required** | **Y** (seeds `capability_routes` rows) |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **B0** (the package must withhold the key) and **B1** (the ceiling must be assigned). Independent of B2a/B2b |
| **Rollback** | Delete the seeded rows, re-run codegen. Reversible `down()` |
| **How to verify** | A FREE workspace gets 403 `CAPABILITY_NOT_INCLUDED` on each of the 35; a STARTER workspace gets 200 on all 35 |
| **Safe to ship independently** | **No** |

**Why this stage exists.** B2a gates the Growth boundary and B2b the Business boundary. **Nothing gated Free → Starter** — the boundary V4 §10.1 describes as "all 15 automation capabilities", and the one every conversion depends on. Found by the completeness sweep in [`07-paywall-coverage.md`](../07-paywall-coverage.md) §1.3.

**Predicate-shaped rules will be needed.** Several of these are *field-level*, not route-level: `automation:excluded_keywords` is a property of a create/update body, not its own endpoint. Follow the existing predicate idiom — `{"op":"exists","path":"igMusicId","source":"body"}` (`src/generated/capabilityRoutes.ts:19`) — rather than inventing new endpoints.

**Same fail-open warning as B2a.** A rule that does not match its route grants access silently. **Every one of the 35 needs a test proving it denies.**

---

## B3 · Add the two missing capability keys

| | |
|---|---|
| **Goal** | Keys for capabilities V4 sells that have no key at all |
| **Repo** | Backend (codegen also writes the Frontend copy) |
| **Files touched** | `src/config/featurePermissions.ts` (`MODULE_FEATURE_DEFINITIONS:353-372`), `src/db/seeds/backfillModuleRegistry.ts`, then `npm run modules:codegen` — note this writes **both** `src/generated/modules.ts` and the Frontend's copy (`src/db/seeds/runModuleCodegen.ts:15-16`) |
| **New keys** | `scheduler:best_time_to_post` (feature exists: `src/services/scheduler/schedulerAnalytics.ts:611,641` → `src/api/routes/scheduler.ts:1001`); an alerts key for proactive AI growth alerts (feature exists: `src/queue/worker.ts:188-191`, `src/queue/jobs/lyraGrowthAlert.ts`) |
| **Config-only vs new code** | New code + **data** |
| **Migration required** | **Y** (seeds `child_modules`) |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | Should precede B2a (best-time-to-post is a Growth capability that B2a gates) |
| **Rollback** | Remove definitions, re-run codegen, delete seeded rows |
| **How to verify** | `npm run modules:codegen:check` clean in **both** repos; the new keys appear in `ALL_CAPABILITY_KEYS` |
| **Safe to ship independently** | **No** |

> ### 📏 The count discrepancy is resolved — the DB is right, the snapshot is stale
>
> **MEASURED 2026-08-19: `child_modules` holds 125 rows.** `capabilityReconciler.ts:11` says 125 and is **correct**; `generated/modules.ts:247-372` lists 121 and is **4 keys stale**.
>
> **Reconcile against 125, not 121.** This stage already runs `npm run modules:codegen`, so it owns the fix — and the regeneration must land in **both** repos (`src/db/seeds/runModuleCodegen.ts:15-16` writes the Frontend copy too).
>
> **Identify the 4 missing keys before adding B3's 2 new ones**, or the new total will be ambiguous. Expected end state: **127** keys (125 + best-time-to-post + the alerts key), with `npm run modules:codegen:check` clean in both repos.
>
> **Coverage restated:** gate coverage is **6 of 125** capabilities, so **119 keys are ungated** — not the 116 of 121 the audit estimated from the snapshot.

---

## B4 · Enforce daily caps on internal routes

| | |
|---|---|
| **Goal** | `schedulerPostsPerDay` and `automationsPerDay` bite on the UI, not only the external API |
| **Repo** | Backend |
| **Files touched** | **Reuse** `src/services/externalApiUsage.ts:52,56,60` (`assertWithinLimits`) and its counter at `:76-80`. Add calls in `src/api/routes/scheduler.ts` (post create) and `src/api/routes/automations.ts:213` (automation create). Fix `apiRequestsPerDay` counting at `externalApiUsage.ts:51`. Fix `maxApiCredentials` scoping at `src/services/apiCredentials.ts:87-89` (also listed as Phase 0.5) |
| **Config-only vs new code** | New code |
| **Migration required** | **N** (unless a new counter column is needed for `apiRequestsPerDay` — then **Y**) |
| **PREVIEW-ONLY** | **Yes, if a migration is introduced** |
| **Dependencies** | None technically. Sequence **after C1** if you do not want today's values (Free 5/day) to start biting before the V4 values are in |
| **Rollback** | Revert commit |
| **How to verify** | A Free workspace is blocked at its daily post cap through the UI, not just the API |
| **Safe to ship independently** | **Yes — but it silently starts limiting users who have never been limited.** See `04-risks.md` SB6 |

**Sequencing warning:** shipping B4 before C1 enforces the *current* values — Free `schedulerPostsPerDay: 5`, `automationsPerDay: 5`; Starter `10 / 5`. Starter's automations-per-day is identical to Free's today. Enforcing that on the UI would be a worse experience than not enforcing it. **Recommend B4 after C1.**

---

## B5 · DM monthly metering

| | |
|---|---|
| **Goal** | Free's advertised 500 DMs/month becomes real |
| **Repo** | Backend |
| **Files touched** | New limit key in `LIMIT_KEYS` (`src/services/workspaceLimits.ts:23-32`) and in `PlanDefinition.limits` (`src/config/billing.config.ts:33-42`). New counter table + enforcement in the DM enqueue path (`src/services/dm.ts`, `src/queue/jobs/sendDm.ts`). Related existing counters to model on: `IgAccountHealth.totalDmsSent` (`src/entities/platform/IgAccountHealth.entity.ts:27`, incremented `src/services/accountTrustService.ts:224`) |
| **Config-only vs new code** | **New code** — nothing exists |
| **Migration required** | **Y** (counter table or column + the new limit key) |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **Sequence after Jira epic LF-66 lands — see the collision warning below.** No in-repo stage dependency |
| **Rollback** | Drop the limit key so it resolves to unlimited; the counter table is additive and can be left in place |
| **How to verify** | A Free workspace is blocked at DM 501 in a calendar month, with a clear error; the counter resets at period boundary. Paid plans are unaffected |
| **Safe to ship independently** | **Yes in dependency terms — but do not start it before LF-66 lands** |

**Design constraints:** enforce at **enqueue**, not at send — a queued-then-rejected DM wastes the 30–90s worker sleep (`sendDm.ts:139-140`). Note the requeue paths (`sendDm.ts:111-114,220-223,260-263`) must not double-count. Decide whether follow-ups count toward the 500 (V4 gives Free zero follow-ups, so this is moot at Free but matters if the cap is ever applied to a paid tier).

### 🔴 Collision with Jira epic LF-66 — sequence B5 after it lands

**B5 writes into files that are under active rewrite.** Epic **LF-66 (DM engine)** covers the blocking sleep, idempotency, rate tiers and the reconciliation sweep — the same execution path B5 must hook. This audit was performed with no visibility into Jira; the collision was reported separately and is recorded here so the plan does not schedule B5 into a moving target.

**Files that conflict directly:**

| File | B5 needs | LF-66 changes |
|---|---|---|
| `src/services/dm.ts` | The enqueue path, to add the monthly cap check before a job is created | The DM engine's entry points and idempotency handling |
| `src/queue/jobs/sendDm.ts` | The requeue paths (`:111-114`, `:220-223`, `:260-263`) must not double-count against the meter; the blocking sleep (`:139-140`) shapes where enforcement is worth placing | Blocking sleep removal, rate tiers, reconciliation sweep — all of the above line references |

**Consequence.** Every line reference in this stage points into `sendDm.ts` as it exists today. LF-66 invalidates them. Worse, a metering hook written against the current requeue semantics can silently double-count once idempotency and the reconciliation sweep change what a "retry" is.

**Sequencing — required:**
1. LF-66 lands
2. Re-derive B5's line references and the enqueue/requeue boundary against the rewritten engine
3. Then build B5

**Files that do *not* collide** and can be prepared in advance: the new limit key in `LIMIT_KEYS` (`src/services/workspaceLimits.ts:23-32`), the `PlanDefinition.limits` field (`src/config/billing.config.ts:33-42`), and the counter table migration. Only the enforcement hook itself is blocked.

---

## B6 · Tier the analytics history window

| | |
|---|---|
| **Goal** | 7 / 30 / 90 / 90 / 90 days by plan, and the custom-range path respects it |
| **Repo** | Backend |
| **Files touched** | `src/services/analyticsPage.ts:15,29-42` (`parseAnalyticsWindow`), `src/services/adminDashboardMetrics.ts:30` (presets), `:115` (day mapping), `:142-169` (`resolveWindow`), `:134,152-155` (`MAX_CUSTOM_SPAN_DAYS = 366`). Route call sites `src/api/routes/analytics.ts:29,50` |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | Needs the plan in scope at the analytics routes — already available via `req.workspace.plan` |
| **Rollback** | Revert commit |
| **How to verify** | A Free workspace requesting 90d receives 7d (or a clear 403); a custom range of 366 days is clamped to the plan's window |
| **Safe to ship independently** | **Yes — but it truncates ranges customers use today.** See `04-risks.md` SB7 |

**Do not miss the custom-range path.** Tiering only the presets leaves `start`/`end` as an open bypass to 366 days on any plan.

---

## B7 · Remove Stories from anything sellable

| | |
|---|---|
| **Goal** | No package can grant a capability the server rejects |
| **Repo** | Backend |
| **Files touched** | `src/db/seeds/backfillPackages.ts:51-64` (module→package grant logic) to exclude `scheduler:post_story`; verify against `src/services/scheduler/scheduledPosts.ts:702-705`, `:939-944`, `src/queue/jobs/publishScheduledPost.ts:239-244` |
| **Config-only vs new code** | New code (exclusion rule) + **data — 📏 confirmed required** |
| **Migration required** | **Y** — 📏 five live packages carry the grant |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | Must land **before** any package is published or sold. Pairs naturally with **B0**, which rewrites the same table |
| **Rollback** | Re-add the grant |
| **How to verify** | **Named case:** `SELECT` over `package_features` joined to `child_modules` returns **zero** rows for `scheduler:post_story` **and zero for `analytics:story_metrics`**, across **all six** packages. The composer's Story option is hidden or clearly marked unavailable |
| **Safe to ship independently** | **Yes** |

### 📏 Five live targets — not a hypothetical

**MEASURED 2026-08-19: every one of the five real packages grants `scheduler:post_story`.**

| Package | Grants `post_story` |
|---|---|
| Agency | **yes** |
| Free | **yes** |
| Starter | **yes** |
| Business | **yes** |
| Pro | **yes** |
| Growth (1 feature) | no |

**A FREE workspace is currently granted a capability the server rejects on every call path** — creation as DRAFT succeeds, scheduling throws (`scheduledPosts.ts:702-705`), updating to SCHEDULED throws (`:939-944`), publish-now 400s (`scheduler.ts:573`), and the queue job terminal-fails (`publishScheduledPost.ts:239-244`).

### 🔴 Also strip `analytics:story_metrics`

Metrics for a feature that cannot publish. It sits in every package for the same reason `post_story` does, and B7's original scope missed it. **Same defect, same fix, same stage.** See [`07-paywall-coverage.md`](../07-paywall-coverage.md) K4.

**Alternative:** implement Story publishing. That is a feature build, not a pricing task — out of scope here. **Recommend strip.** Note the frontend composer and a full 9:16 preview renderer exist, so the UI must also be handled or customers will keep trying.

---

## Phase B shipping order

Dependencies are stated at **stage** granularity, never phase granularity — Correction P4. "Phase B ──▶ C1" was wrong in both directions: C1 depends on three specific B stages, and one B stage depends on C1.

```
B0  (author package contents — independent, ships first)
 │
 └──▶  A1, A2 ──▶ B1 (report-only ──▶ write)
                    │
                    ├──▶ B3 ──▶ B2a      (Growth boundary  + job plan-predicates)
                    ├──▶ B2b             (Business boundary — needs A4)
                    └──▶ B2c             (Starter boundary)

B0 · B1 · B2a · B2b · B2c ──▶ C1 ──▶ B4   (C1 needs the ceiling and ALL the gates;
                                           B4 needs C1's values — see warning)

B6, B7        independent   (B7 pairs with B0 — same table)
LF-66 ──▶ B5  (external — Jira epic, not an in-repo stage)
```

**🔴 B0 is the new critical prerequisite.** Every gating stage in this phase — B2a, B2b, B2c — is **inert without it**, because a capability rule cannot deny a key the package grants. And B1 must not run before it, or 68 Free workspaces are handed the inverted Free package.

**The only circularity was in the prose, not the work.** C1 depends on **B1, B2a, B2b**. **B4** depends on **C1**. No stage depends on itself; nothing is deadlocked. Stating either edge as "Phase B ↔ Phase C" made it look otherwise. The matching diagram in [`phase-c-tier-definitions.md`](phase-c-tier-definitions.md) has been corrected the same way.

| Stage | Migration | PREVIEW-ONLY | Independent | Blocks launch | Depends on |
|---|---|---|---|---|---|
| **B0** | N (data rewrite) | **YES** | **Yes** | **Yes — G54** | — *(must precede B1)* |
| B1 | N (backfill) | **YES** | No | Yes — G1 | **B0**, A1, A2 |
| B2a | **Y** | **YES** | No | Yes — G2 | **B0**, B1, B3 |
| B2b | **Y** | **YES** | No | Yes — G2 | **B0**, B1, A4 |
| **B2c** | **Y** | **YES** | No | **Yes — G55** | **B0**, B1 |
| B3 | **Y** | **YES** | No | Yes | B1 |
| B4 | N / Y | Conditional | Yes ⚠️ after C1 | No — G31 | **C1** |
| B5 | **Y** | **YES** | Yes | Yes — G6 | **LF-66 (external)** |
| B6 | N | No | Yes ⚠️ | No — G32 | — |
| B7 | **Y** | **YES** | Yes | Yes — G7 | — *(pairs with B0)* |

**Eight of ten stages in this phase require a DB write. All are PREVIEW-ONLY — you execute them.**

### 🔴 Re-run the codegen at the end of every B2 stage

`FALLBACK_CAPABILITY_RULES` (`src/generated/capabilityRoutes.ts`) is the committed snapshot the wall falls back to when neither Redis nor Postgres can answer (`requireCapability.ts:192-200`). **📏 It currently holds the 8 seeded rules.** If B2a/B2b/B2c seed rules without regenerating it, an infrastructure blip degrades the wall to *today's* coverage — **un-gating everything the phase added.** Run `npm run capability-routes:codegen` as the last step of each, and `:check` in CI.

**G-number citations verified against [`02-gaps.md`](../02-gaps.md):** G31 is "daily caps bite on the external API only" → B4 ✅. G32 is "analytics history not plan-gated; custom range accepts 366 days" → B6 ✅. Both resolve correctly; no repoint needed.
