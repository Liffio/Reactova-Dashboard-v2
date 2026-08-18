# 07 — Paywall Coverage Sweep

**The question this file answers:** if every stage in [`03-plan.md`](03-plan.md) shipped exactly as written, would anything V4 sells still be reachable without paying for it?

This file does not re-derive the capability map. It takes [`01-capability-map.md`](01-capability-map.md) as input and audits the **plan** for completeness against the live registry and **📏 the measured contents of production's `package_features`**.

> ## ⚠️ PROVENANCE — two sources, and they must not be mixed
>
> This audit draws on **two independent sources**, and a claim is only as good as the one it came from.
>
> | Label | Source | What it can support |
> |---|---|---|
> | 📏 **MEASURED** | **The PRODUCTION database**, read-only SELECT, 2026-08-19 | Facts about **data**: row counts, states, timestamps, what exists |
> | *(source citations)* | The **LOCAL working copies** — `Backend/` at `62b4177`, `Frontend/` at `5a1935a` | Facts about **code as it exists locally** |
>
> **🔴 The local working copies are not necessarily at the deployed commit.** Nothing in this audit establishes what is running in production. The two repos were pulled during this work and may be ahead of, behind, or divergent from the deployed release.
>
> **Therefore: no claim may reason from production data to local source, or from local source to production behaviour.** In particular, "the production database contains X" does **not** establish "the local code that would produce X is the code that produced it."
>
> ### Standing rule for anything added to this audit
>
> **Every figure must state whether it came from production data or from local source, and must not infer across the two.** Where a conclusion genuinely needs both, it is a hypothesis until the deployed commit is known — label it as one.
>
> A conclusion that needs the bridge and cannot have it should be left **unscoped**, not guessed. That is cheaper than a fix aimed at code that may not be running.
>
> **This file is the one most affected by the rule.** Its §1.2 originally reasoned from measured package *contents* to conclusions about the local seed *code*. Those inferences have been re-labelled; the measurements themselves stand.

---

## 0 · The plain answer

**Before this sweep: yes, nearly everything.** The plan seeded route rules against packages that grant almost every capability to almost every tier — 📏 and grant *more* to Free than to Business.

**After B0 + B2a + B2b + B2c ship as now specified: no, with six exceptions.** The tier ladder itself becomes enforced. What remains reachable without paying:

| # | Still reachable | Closed by | Status |
|---|---|---|---|
| **1** | **All 7 `agency:*` white-label capabilities**, except at the 3 routes carrying `requirePlan` | **F-a3** | Specified, in Track F-a |
| **2** | **Every Lyra AI capability, on every tier** — the mount has no `loadAuthorizationContext`, so no capability rule can ever match there. **Plus unmetered AI** for anyone who omits the `x-workspace-id` header | **A4** *(scope extension)* | Specified |
| **3** | **The cost of Free-tier analytics and AI alerts** — gating hides the output; the hourly sync and daily scan still run for every workspace | **B2a** *(scope extension)* | Specified |
| **4** | **Free's 500 DMs/month**, internal-route daily caps, the analytics history window, the workspace-creation cap, and correct API-request counting | **B5** *(blocked on Jira LF-66)*, **B4**, **B6**, **A5**, **0.6** | Specified; B5 blocked externally |
| **5** | **Per-plan Instagram account limits** and **support tiering** | **Nothing — permanently unenforceable.** See §5 | Must leave the marketing copy |
| **6** | Any capability where the package withholds the key but **no route rule exists** — the wall fails open on a miss | Per-stage 1:1 rule coverage; see §3.4 | Verification duty, §4.5 |

**Items 1–4 are all specified stages.** Ship them and only items 5 and 6 remain — item 5 is a copy problem, item 6 is a verification discipline.

> **The structural rule that makes this work:** a capability is enforced only where **the package withholds the key AND a route rule exists**. `applyEntitlement` filters the permission set; `requireCapabilityFromRegistry` turns a request into a 403 only on a rule match, and calls `next()` on a miss. **Either half alone enforces nothing.** B0 supplies the first half for every key; B2a/B2b/B2c/F-a3 supply the second for the keys V4 sells.

---

## 🔴 Headline findings

| # | Finding | Consequence |
|---|---|---|
| **H1** | 📏 **CONFIRMED AND WORSE — the package ladder is INVERTED.** Free grants **140** features including all 6 `team:*` and all 9 `api:*`; Business grants **94** and none of either. `GATED_MODULES` (`backfillPackages.ts:51-64`) withholds only 4 parent modules all-or-nothing, and `team`/`scheduler` are never actually withheld because their flags are true on every plan | **This is the audit's top finding**, ahead of "119 of 125 keys ungated". A route rule cannot deny a key the package grants, so B2a/B2b were inert as written — **and B1 against these contents would grant 68 Free workspaces more than a paying Business customer holds.** Closed by the new stage **B0** |
| **H1b** | 📏 **A half-built `Growth` package exists and is ORPHANED** — 1 feature; `workspace_packages`, `package_prices`, `package_limits` and `package_products` all reference it **zero** times. Created by hand 69 minutes before the real packages, then abandoned | **Settled: DELETE AND RECREATE.** Once B0 drops it, C2's `PRO → GROWTH` rename creates a clean `growth` package with no collision |
| **H1c** | 📏 **The inversion came from ONE write run** — all five real packages created within **126 milliseconds**. Not legacy drift. **But the writer is unidentified:** production code at an unknown commit, which local `Backend/` is not established to match | **B0(a) stands unchanged.** **B0(b) — preventing a re-write from reproducing it — is a requirement but is UNSCOPED** until the deployed writer is known. The **monotonicity assertion** is writer-agnostic and carries the safeguard meanwhile |
| **H2** | **No stage gated the STARTER boundary.** B2a is Growth, B2b is Business | **~35 keys** V4 sells as Starter+ — all of `automation`, `biolink`, `lead`, `shortlink`, and 9 `scheduler` keys. Closed by the new stage **B2c** |
| **H3** | **`agency:*` (7 keys) had no capability stage** | White-label rested on `requirePlan(Plan.AGENCY)` at 3 routes. Closed by the new stage **F-a3** |
| **H4** | **Lyra AI is unmetered when `x-workspace-id` is omitted** | `lyra.ts:64-73` leaves `workspaceId` undefined; `:77` skips `checkTokenBalance`, `:138` returns before `consumeTokens`. **The AI call still executes.** Closed by **A4** *(extended)* |
| **H5** | **`lyraGrowthAlert` has the same no-plan-predicate shape as `schedulerAnalyticsSync`** | A daily AI scan runs for every workspace including FREE. Gating the capability hides the notification, not the cost. Closed by **B2a** *(extended)* |
| **H6** | **Four route mounts lack `loadAuthorizationContext`** beyond the two already known | `/api/creator/v1`, `/api/v1/billing`, `/api/v1/liffio/<lyra>`, `/api/v1/affiliate`. Only the Lyra one leaks a paid capability today — closed by **A4** |
| **H7** | 📏 **All five real packages grant `scheduler:post_story`** — the capability the server rejects | **B7 has five live targets**, not a hypothetical. Its scope also extends to `analytics:story_metrics` |

---

# 1 · Sellable-but-ungated sweep

## 1.1 The live registry

**📏 MEASURED 2026-08-19: `child_modules` = 125 rows.** The committed snapshot (`src/generated/modules.ts`) carries 121 and is 4 keys stale — B3 owns the reconciliation.

| Parent | Keys | V4 tier boundary | Gated by which stage? |
|---|---:|---|---|
| `automation` | 15 | **Starter+** (V4 §10.1) | **B2c** ✅ *(new)* |
| `scheduler` | 21 | Mixed: Starter+ / Growth+ / Business+ | 6 live today · 6 in B2a · **9 in B2c** ✅ |
| `biolink` | 11 | Mixed: all-tiers + **Starter+** | **B2c** ✅ *(new)* |
| `platform` | 11 | *n/a — platform admin* | Exempt by design |
| `affiliate` | 10 | All tiers | Intentionally free |
| `analytics` | 9 | Mixed: all-tiers / **Growth+** / **Business+** | 5 in B2a · 1 in B2c · 1 via B6 · 1 free · 1 dead |
| `lead` | 8 | Mixed: all-tiers + **Starter+** | **B2c** ✅ *(new)* |
| `agency` | 7 | **Agency only** | **F-a3** ✅ *(new)* |
| `api` | 6 | **Business+** | **B2b** ✅ |
| `billing` | 6 | All tiers | Intentionally free |
| `shortlink` | 6 | Mixed: all-tiers + **Starter+** | **B2c** ✅ *(new)* |
| `team` | 5 | 1 all-tiers, 4 **Business+** | **B2b** ✅ |
| `workspace` | 4 | All tiers | Intentionally free |
| `creator_program` | 2 | All tiers | Intentionally free |
| `settings` | 2 | All tiers | Intentionally free |
| `dashboard` | 1 | All tiers | Intentionally free |

**Every module now has an owning stage or an explicit free/exempt disposition.**

## 1.2 🔴 H1 — the measured package contents

**📏 MEASURED 2026-08-19 — `package_features` by package:**

| Package | Features | `analytics` | `team` | `api` | `scheduler` | `post_metrics` | `post_story` |
|---|---:|---:|---:|---:|---:|---|---|
| **Agency** | 146 | 11 | 6 | 9 | 28 | yes | **yes** |
| **Free** | **140** | 11 | **6** | **9** | 28 | **yes** | **yes** |
| **Starter** | 113 | 11 | 0 | 0 | 28 | yes | **yes** |
| **Business** | **94** | 9 | **0** | **0** | 21 | yes | **yes** |
| **Pro** | 92 | 9 | 0 | 0 | 21 | yes | **yes** |
| **Growth** | **1** | 0 | 0 | 0 | 0 | no | no |

**The ladder is inverted, not merely flat.** Free grants 140 features to Business's 94, and holds all 6 `team:*` and all 9 `api:*` keys that Business does not.

### Why

`backfillPackages.ts` writes **one `package_features` row per child module** for every parent, unless the parent is in `GATED_MODULES` and the plan's flag is false (`:157-171`). `GATED_MODULES` (`:51-64`) has four entries:

| Module | Withheld when | Actually withheld from |
|---|---|---|
| `api` | `features.apiEnabled` false | FREE only *(and 📏 not even that — see below)* |
| `agency` | `features.agencyPanel` false | All but AGENCY ✅ — the one that works |
| `team` | `features.teamEnabled` false | **Nobody** — `true` on every plan |
| `scheduler` | `limits.schedulerPostsPerDay > 0` | **Nobody** — every plan is > 0 |

Everything else is in no gate, so it goes into every package. The file says so (`:45-48`).

### 📏 One WRITE RUN produced this — the "separate seeding epochs" inference is REFUTED

An earlier draft of this section proposed that the divergent per-module counts reflected packages written at different times against different registry states. **📏 Creation timestamps refute it — this is a data fact and it stands:**

| Package | Created | Features |
|---|---|---:|
| Growth | 2026-07-21 **20:57:33.808** | 1 |
| Free | 2026-07-21 **22:06:34.815** | **140** |
| Starter | 2026-07-21 22:06:34.859 | 113 |
| Pro | 2026-07-21 22:06:34.888 | 92 |
| Business | 2026-07-21 22:06:34.915 | **94** |
| Agency | 2026-07-21 22:06:34.941 | 146 |

**📏 All five real packages were created within 126 milliseconds — one write run, by one program.** Growth predates them by 69 minutes and was created separately, then abandoned.

**This is not accumulated history.** The inversion was produced in a single execution, so it is the *behaviour of whatever wrote it* — not drift.

### ⚠️ What we CANNOT say — the writer is unidentified

**The rows were written by PRODUCTION code at an unknown commit.** `Backend/` locally sits at `62b4177`, which is **not established to be the deployed release**. So:

| Claim | Status |
|---|---|
| 📏 The six packages hold these contents | **MEASURED — stands** |
| 📏 They were written within 126 ms of each other | **MEASURED — stands** |
| The writer was `backfillPackages.ts` **as it exists locally** | **UNVERIFIABLE** — the deployed program may differ |
| Re-running the **local** seed would reproduce the inversion | **UNVERIFIABLE** — it may not be the same program |
| The `GATED_MODULES` / `planConfig` reading explains the counts | **UNVERIFIABLE, and moot** — it describes local code that may not have run |

**An earlier draft asserted the second and third of these. Both are withdrawn.**

### Why this makes B0(b) *less* scoped, not more

The previous conclusion — *"fix the seed in the same stage"* — assumed the local seed was the writer. **It may not be.** Tracing local `backfillPackages.ts` for a defect that may not exist in the deployed program is effort spent on a guess.

| | |
|---|---|
| **B0(a)** — wholesale replacement of `package_features` | **Stands entirely.** It is specified against V4 §10's targets, not against the provenance of the current contents. What wrote them does not change what should replace them |
| **B0(b)** — prevent a re-write from reproducing the inversion | **Requirement stands; scope UNSCOPED.** It cannot be specified until the deployed writer is identified |

**The one investigation step still worth taking is a data question, not a source question:** read `package_features.created_at` directly. The measured timestamps are `packages.created_at` — the feature rows may have been written or amended later, which would itself narrow the writer. That is a production SELECT and needs no assumption about local code.

*(An earlier version of this section listed a further step — enumerating candidate writers in local source. **Dropped.** It cannot be tied to a known deployed commit, so it could only produce a plausible story about code that may never have run.)*

### The safeguard that survives all of this

**The monotonicity assertion is writer-agnostic**, and that is now its main virtue:

```
granted(FREE) ⊂ granted(STARTER) ⊂ granted(GROWTH) ⊂ granted(BUSINESS) ⊂ granted(AGENCY)
```

It holds regardless of which program writes the rows, at which commit, in which environment. **It is the durable half of B0(b)** — a check that fails loudly whenever an inverted ladder appears, whatever produced it. Make it a permanent test, and it does the job the unscoped seed fix cannot yet do.

### The consequence for the plan, restated

1. B1 assigns a FREE workspace the `free` package
2. That package contains `analytics:post_metrics`, all `api:*` and all `team:*`
3. B2a/B2b seed route rules
4. A rule **matches**, the wall checks the capability, the workspace **has** it → **200 OK**

**And worse:** 📏 68 unpackaged Free workspaces would *gain* API keys and team management the moment B1 runs.

### ✅ Closed by stage B0 — specified in [`phase-b-enforceable-matrix.md`](phases/phase-b-enforceable-matrix.md)

B0 authors per-tier package contents at child-key granularity, **deletes and recreates** the orphaned `Growth` package, and **must precede B1**. Its verification is **set equality per tier, both directions**, plus a **permanent, writer-agnostic monotonicity assertion** — `granted(FREE) ⊂ granted(STARTER) ⊂ … ⊂ granted(AGENCY)`.

**B0(b) — preventing a future write from reproducing the inversion — remains a requirement with an unscoped implementation**, because the program that produced today's contents has not been identified.

## 1.3 Orphan disposition — every key accounted for

**No orphan is left undecided.** Dispositions: **FREE** (intentionally all-tier) · **GATE** (assigned to a stage) · **DEAD** (not sellable).

### ✅ GATE — every orphan now has a stage

| Module | Keys | V4 tier | Stage |
|---|---|---|---|
| `automation` | `post_scope_next`, `post_scope_specific`, `excluded_keywords`, `dm_button`, `dm_button_tracking`, `reply_variants`, `follow_before_dm`, `trigger_blocks` (8) | **Starter+** | **B2c** |
| `biolink` | `custom_slug`, `item_icons`, `item_thumbnails`, `item_visibility`, `hide_badge`, `click_tracking` (6) | **Starter+** | **B2c** |
| `lead` | `view_email`, `click_state`, `follow_state`, `source_media`, `trigger_provenance`, `export_data` (6) | **Starter+** | **B2c** *(`export_data` is also unbounded — G43)* |
| `shortlink` | `custom_slug`, `custom_domain`, `edit_destination`, `click_tracking`, `lead_attribution` (5) | **Starter+** | **B2c** |
| `scheduler` | `alt_text`, `cover_selection`, `first_comment`, `location_tag`, `media_library`, `thumbnail_offset`, `timezone_scheduling`, `share_to_feed`, `music_volume` (9) | **Starter+** | **B2c** |
| `analytics` | `conversion_rate` | **Starter+** | **B2c** *(also mislabelled — V4 §25.12)* |
| `analytics` | `time_series` | Tiered by **window**, not access | **B6** *(limit-based)* |
| `agency` | `branding`, `client_workspaces`, `custom_domain`, `domain_verification`, `hide_branding`, `shortlink_domain`, `theme_color` (7) | **Agency only** | **F-a3** |

### ✅ FREE — intentionally all-tier

`affiliate:*` (10) · `billing:*` (6) · `workspace:*` (4) · `creator_program:*` (2) · `settings:*` (2) · `dashboard:ai_insights` · `team:view_members` · `analytics:overview` · plus the all-tier subsets: `automation` (7 base triggers), `biolink` (5 base), `lead` (2), `shortlink:toggle_active`.

**Rationale:** V4 §10.10 places account, notification, billing self-service and the affiliate programme at every tier. The affiliate programme is a *revenue channel* — gating it would be counterproductive.

### ⚰️ DEAD — not sellable

| Key | Why | Stage |
|---|---|---|
| `scheduler:post_story` | Server rejects every schedule and publish. 📏 **All five real packages grant it** | **B7** |
| `analytics:story_metrics` | Metrics for a feature that cannot publish | **B7** *(scope extension)* |

### 🛡️ EXEMPT — platform admin

`platform:*` (11 keys). `applyEntitlement` returns these untouched (`entitlement.ts:212-215`); the router comment confirms the design. **Correct as-is** — a platform admin's authority must not depend on a workspace's package.

---

# 2 · Non-capability paywall surfaces

## 2.1 Limit-based gates

| Limit | Enforced at write time? | Stage | Hole? |
|---|---|---|---|
| `workflows` | ✅ `planEnforcement.ts:74-92` | C1 (values) | Short-circuits at `>=999`. 📏 0 workspaces over cap |
| `dmFollowUps` | ⚠️ Write-time only | C1 | **🔴 `followUpScheduler.ts:61` bypasses package and override resolution at send time** (SB8) |
| `teamMembers` | ✅ Binding at accept (`workspaceInviteAccept.ts:139`) | C1 | Closed |
| `maxApiCredentials` | ✅ but per-**user** | 0.5, C1 | 📏 0 credentials exist |
| `apiRequestsPerDay` | ⚠️ Counts posts+automations, not requests | 0.6, B4 | Closed by 0.6 |
| `schedulerPostsPerDay` | ⚠️ External API only | **B4** | Internal UI uncapped until B4 |
| `automationsPerDay` | ⚠️ External API only | **B4** | Internal UI uncapped until B4 |
| `workspacesIncluded` | ❌ Never enforced | **A5** | Closed by A5 |
| **DMs / month** | ❌ No limit key exists | **B5** *(after LF-66)* | Free's advertised 500/mo does not exist |
| **AI tokens** | ✅ Metered | C3 (values) | **🔴 BYPASSABLE — H4** |
| **Analytics history** | ❌ Not plan-gated | **B6** | Closed by B6 |

### 🔴 H4 · AI tokens are bypassable by omitting a header

`lyra.ts:64-73` leaves `workspaceId` undefined when `x-workspace-id` is absent; `:77` then skips `checkTokenBalance`, and the completion handler returns at `:138` before `consumeTokens`. **The LLM call still runs.**

**✅ Closed by A4 *(scope extension)*** — require a resolvable workspace for every metered task and reject with 400, rather than treating "no workspace" as "no charge".

## 2.2 Plan gates — `requirePlan` / `planGate.ts`

**Used in exactly three places, all in `agency.ts`** (`:19`, `:29`, `:136`). `PLAN_TO_FEATURE_KEY` maps only `STARTER → "api"` and `AGENCY → "agency"`; PRO/Growth and BUSINESS are unmapped — consistent with D1's pre-step finding.

**Not a hole, but not the mechanism either.** F-a3 supplies the capability-layer half for `agency:*`. **Keep the `requirePlan` guards** — belt and braces is fine; the two layers disagreeing is not.

## 2.3 Feature-flag booleans in `billing.config.ts`

| Flag | Runtime consumers | Verdict |
|---|---|---|
| `features.apiEnabled` | `apiCredentials.ts:78`, `externalApiUsage.ts:31`, `apiCredentials.ts:80`, `backfillPackages.ts:56` | **Live and load-bearing.** B2b flips Starter → Business. 📏 But note the packages contradict it today |
| `features.agencyPanel` | `backfillPackages.ts:57` | The one gate that works correctly |
| `features.teamEnabled` | **`backfillPackages.ts:58` only — no runtime consumer** | **Dead as a gate.** `true` everywhere, so `team` is in every package |
| `features.whiteLabel` | **No consumer at all** | **Dead flag.** White-label is delivered by `agency:*`. Note for removal |
| `gates: {}` | `minimumPlanForFeature` → `apiCredentials.ts`, `planEnforcement.ts:40` | Live |

**Confirmed: nothing outside B2b's scope consumes these**, except `backfillPackages.ts` — which is B0's file. **B2b and B0 must ship together or neither takes effect.**

## 2.4 External API surface

`/api/v1/external` mounts `requireApiKey, apiKeyWorkspaceMiddleware` only (`router.ts:158-160`) — no `req.authz`, so the wall's `:173-179` branch calls `next()`. **Closed by A4**, 📏 which breaks nobody (0 credentials).

## 2.5 Queue jobs and workers

| Job | Schedule | Predicate | Plan check? |
|---|---|---|---|
| `schedulerAnalyticsSync` | hourly | `deleted_at IS NULL` + active IG + insights permission (`:28-39`) | **🔴 None** |
| `lyraGrowthAlert` | daily 07:00 | `status = ACTIVE AND deletedAt IS NULL` + active IG (`:24-33`) | **🔴 None** |

**Gating the capability hides the OUTPUT; it does not stop the COST.** ✅ **Closed by B2a *(scope extension)*** — a plan predicate on **both** jobs.

**Other scheduled jobs reviewed and cleared:** `affiliateStatsRecalc`, the four creator-programme jobs, `resetWorkspaceTokens`, `expireInvites`, `sweepImpersonationSessions`, `purgeAuditLogs`. `lyraGistWarm` has no scheduled trigger.

## 2.6 Webhook-triggered paths

No new hole. Exposure is indirect and covered by **A6** (pre-payment grant), **A1** (cancellation leak), **F-b2** (Agency fan-out), **0.9** (silently discarded failures). One note: webhook-driven downgrades leave the old ceiling live for up to 300 s until **A2**.

## 2.7 Admin / superadmin overrides and `feature_overrides`

| Surface | Verdict |
|---|---|
| `feature_overrides` (`featureOverride.ts:6,20` → `planGate.ts:21`) | **Intentional.** Reachable only for the two mapped keys |
| `workspace_config.limit_overrides` | **Intentional.** ⚠️ Ignored by `followUpScheduler.ts:61` (SB8) |
| Admin package assignment | **Intentional**, audit-logged |
| Platform permissions | **Correct** — exempt by design |

**Not a hole, but an unlogged bypass surface.** Confirm every override path writes an audit row and that `feature_overrides` grants carry `expires_at`.

## 2.8 Plugin-granted capabilities

`src/plugins/lifecycle.ts` writes `child_modules` (`:475-487`) **and** `capability_routes` (`:508-513`) at activation — *"born enforced"*. **The safest surface in the system.**

**Two notes for B0:** new plugin `child_modules` are in no package, so under authored packages they default to **denied** — correct, but plugin activation will look broken until packages are updated. And the 125-key count **grows at runtime**, so verification must assert on *coverage*, not on totals.

## 2.9 Public / unauthenticated routes

`publicBiolink`, `publicShortlinks`, `publicSchedulerMedia`, `publicLeadsCaptured`, `publicMarketing`, `affiliatePublic`, `/r`, `/:slug`, `/leads-captured/:slug`.

**Nothing paid is reachable unauthenticated.** These serve the *rendered output* of paid features; the authoring is gated. The `/api/v1` catch-all (`router.ts:264-273`) explicitly 404s unmatched `/public/*` so it cannot fall through into workspace auth — deliberate and correct.

---

# 3 · Fail-open inventory

`requireCapabilityFromRegistry` calls `next()` in **three** cases:

| Line | Condition | Effect |
|---|---|---|
| `:168` | No rule matches | Access granted — indistinguishable from a working rule |
| `:173-179` | **`req.authz` absent** | Access granted — the mount never loaded the authz context |
| `:192-200` | **Any thrown exception** | Access granted — a Redis or Postgres blip un-gates everything |

## 3.1 Mounts WITHOUT `loadAuthorizationContext`

| Mount | Line | Middleware | Assessment |
|---|---|---|---|
| `/api/v1/api-credentials` | `:138` | `requireAuth, impersonationWriteGuard` | **KNOWN** — B2b moves it inside |
| `/api/v1/external` | `:158-160` | `requireApiKey, apiKeyWorkspaceMiddleware` | **KNOWN** — A4 |
| **`/api/v1/liffio/<LYRA_NAME>`** | `:155` | `requireAuth, impersonationWriteGuard, lyraApiLimiter` | **🔴 MATERIAL.** V4 §10.7 sells Lyra per tier; no `req.authz` means **no capability rule can ever match there**. Also resolves workspace itself (`lyra.ts:67`). ✅ **A4** *(extended)* |
| **`/api/creator/v1`** | `:153` | `requireAuth, impersonationWriteGuard` | **NEW.** `creator_program:*` is all-tier so nothing leaks — but any future paid creator capability would be silently ungated. The `/admin` sibling at `:154` *does* load it |
| **`/api/v1/billing`** | `:148` | In-file `requireAuth, workspaceMiddleware, impersonationWriteGuard` | **NEW.** All-tier by design — you must reach billing on any plan. **Record it so nobody adds a gated capability here** |
| **`/api/v1/affiliate`** (user) | `:136` | `requirePermission` inside only | **NEW.** All-tier; relies on RBAC alone |
| `/api/v1/impersonation` | `:147` | `requireAuth` | **By design** (§5.1) |
| `/api/v1/admin/*` | `:225-242` | `requireAuth, denyImpersonation` + `requirePermission` | **By design** — exempt from the ceiling |
| `/api/v1/plugins` | `:253` | `pluginTokenGate` | **By design** — *"re-runs entitlement FRESH"* |

## 3.2 Mounts WITH `loadAuthorizationContext` ✅

`/api/v1/workspaces` (`:137`) · `/api/creator/v1/admin` (`:154`) · `devScoped` (`:216`) · **`workspaceScoped`** (`:168-173`), covering the 16 feature routers.

**The main feature surface is correctly wrapped.**

## 3.3 The Lyra mount — ✅ now covered

A4's scope extends to `/api/v1/liffio/<lyra>`: add `loadAuthorizationContext` and `workspaceMiddleware`, and make metering unconditional. Both defects live in one file and are one change.

## 3.4 The other two fail-open branches

| Branch | Mitigation | Status |
|---|---|---|
| `:168` no rule match | Every rule needs a test proving it **denies** | Required by B2a/B2b — **now also B2c and F-a3** |
| `:192-200` any exception | 📏 `FALLBACK_CAPABILITY_RULES` holds the **8 seeded rules** | **Re-run `npm run capability-routes:codegen` at the end of every B2 stage**, or a blip un-gates everything the phase added. Now stated in phase-b |

---

# 4 · Post-implementation verification checklist

**Acceptance criteria for "V4 is enforced."** Written to be handed to someone who has not read this audit.

> **📏 This checklist is derived against the MEASURED package contents, not assumed ones.** §4.0 exists because a checklist that starts at the route layer would pass while the paywall leaks: against today's packages, a Free workspace answers 200 to everything **and that is the packages' fault, not the rules'.**

## 4.0 🔴 PRE-FLIGHT — package contents. Nothing below is meaningful until this passes

| # | Check | Expected |
|---|---|---|
| **P1** | Per tier, `granted(T)` **equals** V4 §10's column for that tier | **Set equality, both directions.** No extra keys, no missing keys |
| **P2** | `granted(FREE) ⊂ granted(STARTER) ⊂ granted(GROWTH) ⊂ granted(BUSINESS) ⊂ granted(AGENCY)` | **True.** 📏 This is the assertion that fails today — Free ⊄ Business |
| **P3** | `granted(FREE) ∩ api:*` | **∅.** 📏 Currently 9 keys |
| **P4** | `granted(FREE) ∩ team:*` | **`{team:view_members}`.** 📏 Currently all 6 |
| **P5** | Feature counts are **monotonic non-decreasing** by tier | 📏 Currently 140 / 113 / — / 94 / 146 — inverted |
| **P6** | No package grants `scheduler:post_story` | 📏 Currently **all five** do |
| **P7** | No package grants `analytics:story_metrics` | 📏 Currently all do |
| **P8** | The orphaned `Growth` package is **deleted and recreated** under authored contents | 📏 Currently 1 feature, zero references |
| **P10** | **The monotonicity assertion (P2) runs as a permanent test, not a one-off** | It is **writer-agnostic** — it catches an inverted ladder whatever produces it, at whatever commit. This is the durable substitute for the unscoped B0(b) |
| **P9** | Every package's key set is a subset of live `child_modules` | No stale keys from an older registry |

**Make P2 and P5 permanent tests, not one-off checks.** They are cheap, and they are what would have caught the inversion.

## 4.1 Setup

One workspace per tier — `free`, `starter`, `growth`, `business`, `agency` — each with a completed checkout, an active Instagram account, and at least one automation, scheduled post, lead and short link. A session token for each. Every check is `curl` + the `x-workspace-id` header.

**Pass condition for a denial:** HTTP **403** with `CAPABILITY_NOT_INCLUDED`. A **200** is a failure. A **404** or **500** is also a failure — it means the rule did not match, which fails open by a different route.

## 4.2 Per-tier matrix

| # | Check | FREE | STARTER | GROWTH | BUSINESS | AGENCY |
|---|---|---|---|---|---|---|
| 1 | `POST /api/v1/automations` with `excludedKeywords` | **403** | 200 | 200 | 200 | 200 |
| 2 | `POST /api/v1/automations` with a DM button | **403** | 200 | 200 | 200 | 200 |
| 3 | `PATCH /api/v1/biolink` with `customSlug` | **403** | 200 | 200 | 200 | 200 |
| 4 | `PATCH /api/v1/biolink` hiding the "Powered by" badge | **403** | 200 | 200 | 200 | 200 |
| 5 | `GET /api/v1/leads?fields=email` | **403** | 200 | 200 | 200 | 200 |
| 6 | `GET /api/v1/leads/export` | **403** | 200 | 200 | 200 | 200 |
| 7 | `POST /api/v1/shortlinks` with a custom slug | **403** | 200 | 200 | 200 | 200 |
| 8 | `POST /api/v1/scheduler/posts` with `altText` | **403** | 200 | 200 | 200 | 200 |
| 9 | `GET /api/v1/analytics/posts` (post metrics) | **403** | **403** | 200 | 200 | 200 |
| 10 | `GET /api/v1/analytics/video` | **403** | **403** | 200 | 200 | 200 |
| 11 | `GET /api/v1/scheduler/best-time-to-post` | **403** | **403** | 200 | 200 | 200 |
| 12 | `POST /api/v1/scheduler/caption-templates` | **403** | **403** | 200 | 200 | 200 |
| 13 | `POST /api/v1/scheduler/bulk-upload` | **403** | **403** | 200 | 200 | 200 |
| 14 | `POST /api/v1/team/invites` | **403** | **403** | **403** | 200 | 200 |
| 15 | `PATCH /api/v1/team/members/:id/role` | **403** | **403** | **403** | 200 | 200 |
| 16 | `POST /api/v1/api-credentials` | **403** | **403** | **403** | 200 | 200 |
| 17 | `GET /api/v1/analytics/export` | **403** | **403** | **403** | 200 | 200 |
| 18 | `GET /api/v1/agency/master-dashboard` | **403** | **403** | **403** | **403** | 200 |
| 19 | `PATCH /api/v1/agency/branding` | **403** | **403** | **403** | **403** | 200 |
| **20** | **`POST /api/v1/scheduler/posts` with `type: STORY`** | **403 or 400** | **403 or 400** | **403 or 400** | **403 or 400** | **403 or 400** |

> **Rows 14–16 are the inversion check at the route layer.** 📏 Today a FREE workspace holds all 6 `team:*` and all 9 `api:*` keys while BUSINESS holds none — so before B0 these rows would answer **200 for Free and 403 for Business**, the exact reverse of the table. If you see that pattern, B0 did not run.
>
> **Row 20 is new** — no tier may schedule a Story, because no tier can publish one (B7).

## 4.3 Limit checks

| # | Check | Expected |
|---|---|---|
| 21 | Create automations past the cap (3 / 25 / 75 / 150 / 150) | **403** at cap + 1 on **every** plan — 📏 including paid ones, where enforcement has never run |
| 22 | Invite past the seat cap (1 / 3 / 5 / 15 / 15) | **403** at the **accept** step, not merely a warning at invite |
| 23 | Send 501 DMs in a month on Free | **403** at 501 — the counter must not reset on requeue |
| 24 | Request a 90-day analytics range on Free | Clamped to 7 days |
| 25 | Request `?start=&end=` spanning 366 days on Free | Clamped — **the custom-range path is the bypass** |
| 26 | Post via the **UI** past `schedulerPostsPerDay` | **403** — not only via the external API |
| 27 | Create a second Free workspace | **403** |
| 28 | Create a 21st Agency workspace | **403** |
| 29 | Exhaust AI tokens, then call Lyra | **402** |
| **30** | **Call Lyra with NO `x-workspace-id` header** | **400** — must not execute unmetered *(H4)* |
| **31** | **Call a Business-only Lyra task from a Growth workspace** | **403** — requires A4's `loadAuthorizationContext` on that mount |

## 4.4 Leak and bypass checks

| # | Check | Expected |
|---|---|---|
| 32 | Cancel a Business subscription → re-check rows 14–17 | All **403** within 300 s *(A1 + A2)* |
| 33 | Open a Razorpay checkout, abandon it → check `workspace_packages` | **No row** *(A6)* |
| 34 | Soft-delete a workspace → request with its `x-workspace-id` | **404** *(A3)* |
| 35 | Soft-delete a workspace → request with an API key scoped to it | **404** *(A3)* |
| 36 | VIEWER-scoped API key → `DELETE /api/v1/external/automations/:id` | **403** *(A4)* |
| 37 | Downgrade Business → Growth, re-check rows 14–17 immediately | All **403** within 300 s *(A2)* |
| 38 | Cancel a workspace with a **synthetic** `provider_subscription_id` | Succeeds locally, **no provider API call** *(0.10 — test the Razorpay path)* |
| **39** | **Re-run B1's report against the authored packages** | **Zero workspaces GAIN a capability their tier does not sell.** 📏 The direction that matters most — against current packages, 68 Free workspaces would gain `api:*` and `team:*` |

## 4.5 Fail-open regression checks

| # | Check | Expected |
|---|---|---|
| 40 | Every new `capability_routes` rule has a test asserting a **denial** | 100% across B2a, B2b, **B2c**, **F-a3** |
| 41 | **Rule-to-package pairing:** every key a package withholds for tier T has a route rule covering its surface | **1:1.** A withheld key with no rule is not enforced — the wall fails open on a miss |
| 42 | `npm run capability-routes:codegen:check` | Clean |
| 43 | `npm run modules:codegen:check` in **both** repos | Clean; total keys = **127** (125 live + B3's 2) |
| 44 | Request a route whose rule was deleted | Fails **open** — confirm this is understood, not a surprise |
| 45 | Take Redis down, repeat rows 9, 14, 16 | Falls back to `FALLBACK_CAPABILITY_RULES`. 📏 **If the snapshot was not regenerated after B2a/B2b/B2c, these pass — an un-gating outage** |
| 46 | Enumerate mounts lacking `loadAuthorizationContext` | Matches §3.1 exactly; **no new entries** |

## 4.6 Cost checks — output vs cost

| # | Check | Expected |
|---|---|---|
| 47 | Run the hourly analytics sync with only Free workspaces eligible | **0 workspaces swept** |
| 48 | Run the daily `lyraGrowthAlert` scan with only Free/Starter/Growth workspaces | **0 scanned** — Business+ only |

## 4.7 What a passing run does NOT prove

- **That the capability set matches V4's intent.** §4.0 asserts equality against V4 §10 as *transcribed*; a transcription error passes silently. Have someone re-read the matrix against the authored packages once.
- **That plugin capabilities behave.** Activating a plugin adds `child_modules` that no package grants — expected, but it will look like a broken plugin.
- **That anything is enforced for tiers with no test workspace.** Every row above needs all five workspaces to exist.

---

# 5 · Known-unenforceable list

**Things V4 or the HTML sells that cannot be enforced even after every stage ships.**

| # | Claim | Why unenforceable | Action |
|---|---|---|---|
| **K1** | **Per-plan Instagram account limits** (5 / 10 / Unlimited) | **No backend field of any kind.** With `workspacesIncluded: 1` on every non-Agency plan and one account per workspace, "5 accounts on Growth" is **arithmetically impossible**, not merely unbuilt | **Remove.** Already **Phase 0.12** |
| **K2** | **Support tiering** | **No product mechanism.** No ticketing, no routing, no SLA field. V4 §10 concedes it | **Operational promise only.** Never present it as a product feature |
| **K3** | **"50,000 automated DMs/month"** | B5 builds Free's 500/mo meter; **no stage builds a paid-tier ceiling** | **Remove.** Already **Phase 0.11** |
| **K4** | **Instagram Stories** + `analytics:story_metrics` | Server rejects every schedule and publish. 📏 **All five packages grant `post_story` today** | **B7** — strip both. Verification row 20 and P6/P7 |
| **K5** | **"Historical post performance"** | `post_analytics_snapshots` is never written; `post_analytics` is upserted in place | Correctly excluded from V4. **Keep it excluded** |
| **K6** | **Agency "One subscription, one invoice, one renewal date"** | Blocked by `providerSubscriptionId` UNIQUE until F-b1/F-b2 | **Sales-assisted caveat** — `06-doc-corrections.md` §2 |
| **K7** | **"AI token rollover up to 25,000"** | Mechanism exists, but a **null cap means uncapped rollover** (`aiTokenService.ts:453-455`) | **Enforceable only if C3 writes both columns together.** A correctness requirement, not a copy change |

**K1–K3 are in Phase 0. K4 is in B7. K5 and K6 are correctly caveated. K7 is a C3 execution requirement.**

> **Cross-referenced into [`06-doc-corrections.md`](06-doc-corrections.md)** §10 and the K-list table.

---

## Summary — the plan after integration

| Added | Type | Why |
|---|---|---|
| **B0 · Author per-tier package contents** | CODE + DATA 🔒 | 📏 The ladder is **inverted** — Free 140 features, Business 94 — from 📏 one write run by an **unidentified** program. **B0(a) replaces the contents; B0(b) is unscoped** pending identification of the deployed writer. Every gate is inert without B0, and B1 must not run before it |
| **B2c · Capability routes — the Starter boundary** | CODE + DATA 🔒 | ~35 keys. **The Free→Starter conversion boundary was unenforced** |
| **F-a3 · Capability routes — Agency white-label** | CODE + DATA 🔒 | `agency:*` (7 keys) rested on `requirePlan` at 3 routes |

| Extended | Change |
|---|---|
| **A4** | Bring `/api/v1/liffio/<lyra>` inside the wall; make Lyra metering unconditional |
| **B2a** | Plan predicate on **`lyraGrowthAlert`** as well as `schedulerAnalyticsSync` |
| **B7** | Strip `analytics:story_metrics`; 📏 **five live packages** grant `post_story` |
| **B2a/B2b/B2c** | Re-run `capability-routes:codegen` at the end of each |

**All integrated into [`03-plan.md`](03-plan.md): 50 stage rows, 48 unique, 16 firm DB-write stages.**

**The headline conclusion, restated.** The audit originally said *"V4 reads as a configuration exercise; it is a gate-layer build."* **The measured truth is that it is a gate-layer build *and* a package-authoring build — and the package layer is the one currently inverted.** Building gates on top of packages that grant Free more than Business would have produced a paywall that reported success and enforced nothing.
