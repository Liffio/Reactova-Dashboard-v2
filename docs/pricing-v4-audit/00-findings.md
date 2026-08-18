# 00 — Findings: Confirmed / Refuted / Unverifiable

Read-only audit of `Backend/` (`Reactova-Dashboard-Backend-v2`, Express 5 + TypeORM) and `Frontend/` (`Reactova-Dashboard-v2`, React + TanStack Router) against `PRICING_PACKAGES_V4.md` and `liffio-pricing-v4.html`.

**Method:** every claim the doc makes about the code was treated as unverified and checked against source. Where the doc and the code disagree, the code wins. Paths are repo-relative.

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

## Audit provenance

| Item | Finding |
|---|---|
| Doc's stated basis | Backend `@749f3f6`, Frontend `@a43352f` |
| Both commits exist | ✅ `749f3f6` = "feat: build plugin SDK in CI and deploy workflows"; `a43352f` = "feat: add generic plugin host page…" |
| Distance to HEAD | **Backend +76 commits** (HEAD `17145bc`), **Frontend +59 commits** (HEAD `d121ada`) |
| Doc-cited files changed since basis | `workspaceLimits.ts` (+208), `workspacePackages.ts` (+108), `aiTokenService.ts` (+340), `worker.ts` (+34), `rateLimiter.ts` (+39), `api/router.ts` (+82), `billing.ts` (+7) |
| Doc-cited files unchanged since basis | `billingSubscription.ts`, `freeWorkspaceLimit.ts`, `api/routes/workspaces.ts`, `api/webhooks/`, `entities/billing/` |
| Framework | **Express 5 + TypeORM**, not NestJS (`Backend/package.json`, `express: ^5.2.1`) |

Every limit, AI-token and capacity claim in the doc predates a material rewrite of the file it cites. Every billing-lifecycle claim sits on unchanged code.

## 📏 Production measurement — 2026-08-19

The original audit was **source-only**: no database access was used, and every population figure was inferred from code comments or seed migrations. **Production has since been measured by read-only SELECT.** Figures marked 📏 anywhere in this audit are measurements; unmarked figures remain source-derived.

| Measured | Value |
|---|---|
| `workspace_subscriptions` | **7 rows** — 3 AGENCY ACTIVE, 1 BUSINESS ACTIVE, 1 STARTER ACTIVE, 2 BUSINESS CANCELED |
| Active subscriptions / paying workspaces | **5 / 4** |
| Rows carrying a `package_price_id` pin | **1 of 7** |
| Rows carrying a **synthetic** `provider_subscription_id` | **1** (AGENCY, Razorpay) |
| Workspaces | **74 live, 3 soft-deleted** |
| `workspace_packages` | **2 rows** — one of them on a **CANCELED** workspace |
| `capability_routes` | **8 rows, all enabled, 6 distinct capabilities** |
| `child_modules` | **125 rows** |
| `api_credentials` | **0 active, 0 ever used** |
| `package_features` **by package** | Agency **146** · Free **140** · Starter 113 · Business **94** · Pro 92 · **Growth 1** |
| Package `created_at` | Growth **20:57:33.808** · the five real packages **22:06:34.815–.941** — all within **126 ms** |
| References to the `Growth` package | **0** across `workspace_packages`, `package_prices`, `package_limits`, `package_products` |
| Packages granting `scheduler:post_story` | **all five real packages** |

### 🔴 THE TOP FINDING — the package ladder is inverted

**The audit's original headline was:** *"V4 reads as a configuration exercise; it is a gate-layer build."* That framing survives, but it was **incomplete and it named the wrong layer as the problem.**

**The measured truth:** V4 is a gate-layer build **and a package-authoring build** — and it is the **package layer** that is currently broken, not merely absent.

| Package | Features | `team` | `api` | `post_story` |
|---|---:|---:|---:|---|
| Agency | 146 | 6 | 9 | yes |
| **Free** | **140** | **6** | **9** | yes |
| Starter | 113 | 0 | 0 | yes |
| **Business** | **94** | **0** | **0** | yes |
| Pro | 92 | 0 | 0 | yes |
| Growth | **1** | 0 | 0 | no |

**A FREE workspace holds strictly more capability than a paying BUSINESS workspace.** Free grants all 6 `team:*` and all 9 `api:*` keys; Business grants none of either.

**Why this displaces "119 of 125 keys are ungated" as the headline.** That finding says the *route layer* has no enforcement points. This one says the *entitlement layer* — the thing those enforcement points consult — hands out nearly everything, in the wrong order. **A capability rule cannot deny a key the package grants**, so route rules seeded against these packages would gate nothing. The gate-layer build was correctly identified; the layer beneath it was assumed to work and does not.

**Three consequences:**
1. **A new stage, B0**, authors per-tier package contents and must precede B1. Without it, every gating stage in Phase B is inert.
2. **B1's risk inverts.** Assigning the current Free package to 68 unpackaged Free workspaces would *grant* them API keys and team management — see `04-risks.md` SB1.
3. **The recurrence question is open** — see below.

### 📏 One write run, not legacy drift — but the writer is UNIDENTIFIED

An earlier reading proposed that the divergent package contents were accumulated drift from separate seeding epochs. **📏 Creation timestamps refute it:** the five real packages were created at **22:06:34.815, .859, .888, .915 and .941** — **within 126 milliseconds of each other.** One execution of one program produced Free with 140 features and Business with 94. **That is a data conclusion and it stands.**

**⚠️ What does NOT follow is which program.** The rows were written by **production code at an unknown commit**. Local `Backend/` sits at `62b4177` and is **not established to be the deployed release**.

| Claim | Status |
|---|---|
| 📏 The six packages hold these contents | **MEASURED — stands** |
| 📏 They were written within 126 ms of one another | **MEASURED — stands** |
| The writer was `backfillPackages.ts` **as it exists locally** | **UNVERIFIABLE** |
| Re-running the **local** seed would reproduce the inversion | **UNVERIFIABLE — withdrawn** |
| A local reading of `GATED_MODULES` / `planConfig` explains the counts | **UNVERIFIABLE, and moot** |

**An earlier version of this section asserted the fourth and fifth of these. Both are withdrawn** under the provenance rule above.

**Consequence for B0 — it splits:**

| | |
|---|---|
| **B0(a)** replace `package_features` wholesale | **Unaffected. Ships.** Specified against V4 §10's targets, not against the provenance of what is there now |
| **B0(b)** prevent a future write from reproducing the inversion | **Requirement stands; scope UNSCOPED** until the deployed writer is identified. **Do not trace local source for a defect that may not exist there** |

**The safeguard that survives:** the **monotonicity assertion** — `granted(FREE) ⊂ … ⊂ granted(AGENCY)` — is **writer-agnostic**. It holds regardless of which program writes the rows, at which commit, in which environment, and it would have caught today's state on the day it was written. Until the writer is known, it is the whole of the protection.

**The one investigation step that survives is a data question:** read `package_features.created_at` directly. The measured timestamps are `packages.created_at`; whether the feature rows were written with the packages or amended later is answerable by SELECT, with no assumption about deployed code.

**The `Growth` package is separate and orphaned.** Created at **20:57:33.808** — 69 minutes earlier — with 1 feature, and referenced **zero** times by `workspace_packages`, `package_prices`, `package_limits` or `package_products`. **B0 deletes and recreates it**, after which C2's `PRO → GROWTH` rename is collision-free.

### Where the source-only audit was wrong

| Claim | Source said | Production says |
|---|---|---|
| Unpackaged workspaces | 35–45 (`entitlement.ts:15-17`) | **72 of 74** — nearly double, and the comment is stale |
| Capability keys | 121 (`generated/modules.ts`) | **125** — the codegen snapshot is 4 keys stale |
| Capabilities gated | 5 | **6** |
| Ungated keys | 116 of 121 | **119 of 125** |
| Package differentiation | assumed to express the tier ladder | **inverted** — Free 140 features, Business 94 |
| Cause of the inversion | inferred as legacy drift across seeding epochs | **refuted** — 📏 one write run, 126 ms apart. **The writing program is unidentified** |

**Three findings were promoted from "latent" to "live":** all five real packages grant `scheduler:post_story` — the capability the server rejects — so B7 has five concrete targets rather than a hypothetical. And: C18's entitlement leak has an instance (the CANCELED BUSINESS workspace still holds its package row), and C11's synthetic-id idiom has an instance in an **ACTIVE** Agency subscription. Neither was hypothetical after all.

**Nothing in sections A–C below was refuted by the measurement.** Every confirmed finding stayed confirmed.

---

## A. CONFIRMED — claim true, line reference correct

| # | Claim | Evidence |
|---|---|---|
| C1 | No payment grace period; first failed invoice sets `PAYMENT_FAILED` | `src/services/billingSubscription.ts:223-234` — doc's line range exact |
| C2 | `workspace_subscriptions.providerSubscriptionId` is UNIQUE | `src/entities/billing/WorkspaceSubscription.entity.ts:24` |
| C3 | `workspace_subscriptions.workspaceId` is UNIQUE | `src/entities/billing/WorkspaceSubscription.entity.ts:14` |
| C4 | `sendDm` mandatory random 30–90s sleep holding the worker slot | `src/queue/jobs/sendDm.ts:139-140` — doc's line reference exact |
| C5 | Analytics sync ≈101 Graph calls/workspace (1 list + 2 per media × ≤50) | `src/services/scheduler/schedulerAnalytics.ts:199-203`, `:258-261`, `:273-277` |
| C6 | AI token metering = 20 non-whitespace chars/token | `src/lib/aiTokens/tokenFormula.ts:3-16`; default 20 at `src/entities/ai/AiTokenGlobalSettings.entity.ts:13` |
| C7 | Agency AI tokens seeded as `-1` (unlimited) | `src/db/migrations/1783500000000-AddAiTokenMetering.ts:60`; sentinel `src/services/ai/aiTokenService.ts:23` |
| C8 | AI rollover flag exists, default off, cap nullable | `src/entities/ai/AiTokenPlanConfig.entity.ts:19-20`; `rollover_enabled … DEFAULT false` migration `:42` |
| C9 | INR charged = `usdCents × 84` | Constant `src/config/billing.config.ts:184`; applied `scripts/setupRazorpayPlans.ts:52` |
| C10 | GST / place-of-supply absent entirely | Zero repo-wide matches for `gst`, `placeOfSupply`, `tax_rate`, `vat`, `hsn`. `BillingInvoice` has no tax field |
| C11 | Synthetic provider-id idiom in production | `checkout_${event.id}` `src/api/webhooks/stripe.ts:190`; `invoice_${invoice.id}` `:240`; `manual_${uuid}` `src/services/adminBillingMutations.ts:90` |
| C12 | `POST /billing/package-checkout` implemented | `src/api/routes/billing.ts:128`; service `src/services/billing/packageCheckout.ts` |
| C13 | …with no frontend caller | Zero matches for `package-checkout`/`packageCheckout` in `Frontend/src/` |
| C14 | `deriveCoarsePlan` exists for plan-coarsening | `src/services/billing/packageCheckout.ts:32-40` |
| C15 | Workspace creation completely uncapped | `src/api/routes/workspaces.ts:228-281` — no `Plan`, no count, no `planEnforcement` reference |
| C16 | `freeWorkspaceLimit.ts` implements the rule | `src/services/freeWorkspaceLimit.ts:6` (`FREE_WORKSPACE_LIMIT_PER_USER = 1`), `:21-33` |
| C17 | …and has zero callers | 5 grep hits repo-wide, **all inside the file itself** (`:6,8,21,24,25`). No import, no test |
| C18 | Entitlements leak on cancellation — `workspace_packages` never cleared | `finalizeCancellation` `src/services/billingSubscription.ts:245-251` deletes only the subscription row; sole deleter is `clearWorkspacePackage` (`src/services/workspacePackages.ts:198`), called only from `src/api/routes/adminRegistry.ts:467` |
| C19 | `invalidateWorkspaceCtx` called from exactly one place | Definition `src/api/middleware/workspace.ts:21-22`; sole production caller `src/api/routes/adminRbac.ts:379` |
| C20 | External API bypasses the capability wall and RBAC | `src/api/router.ts:157` mounts only `requireApiKey, apiKeyWorkspaceMiddleware`; zero `req.authz`/`requirePermission`/`requireCapability` hits in all 791 lines of `src/api/routes/externalApi.ts` |
| C21 | No DM volume metering anywhere | No `LIMIT_KEYS` entry, no `BILLING_PLANS.limits` field, no throw path. All `dm*` counters are analytics/creator-eligibility/account-health |
| C22 | `schedulerPostsPerDay` / `automationsPerDay` enforced on external API only | Sole call sites `src/api/routes/externalApi.ts:306` and `:505` via `src/services/externalApiUsage.ts:56,60` |
| C23 | Free `dmFollowUps: 0` enforced today | `src/config/billing.config.ts:64` + `src/services/planEnforcement.ts:63-71` |
| C24 | Soft-deleted workspaces remain usable via `x-workspace-id` | `src/api/middleware/workspace.ts:38-46` has no `deletedAt` clause; same omission `src/api/middleware/apiKeyWorkspace.ts:41-49` |
| C25 | Lead CSV export unbounded | `src/api/routes/leads.ts:69-77` — `getMany()`, no limit, no capability gate |
| C26 | `post_analytics_snapshots` exists and is never written | Created `src/db/migrations/1779774755945-InitDb.ts:143-145`; zero writes in `src/` |
| C27 | Stories sellable but rejected server-side | Capability gated `src/generated/capabilityRoutes.ts:24`; rejected `src/services/scheduler/scheduledPosts.ts:702-705`, `:939-944`, and `src/queue/jobs/publishScheduledPost.ts:239-244` |
| C28 | `agency.ts` contradicts the 20-workspace model | `src/api/routes/agency.ts:108` — `const included = 30;`, plus `extraMeteredRate: 9` at `:122` |
| C29 | `creatorProgramApiLimiter` defined but never mounted | `src/api/middleware/rateLimiter.ts:73-81`; imported by no file |
| C30 | No BullMQ rate limiters | Zero `limiter:` matches across `src/queue/` |
| C31 | No AI admission control / semaphore | Zero matches for `semaphore\|mutex\|p-limit\|inflight` in `src/AI/` |
| C32 | Analytics sync hourly, concurrency 1, sequential, no batching, no limit | `src/queue/worker.ts:323-325` (`"0 * * * *"`), `:222-226` (concurrency 1); `src/queue/jobs/schedulerAnalyticsSync.ts:42`, `:52-83` |
| C33 | Single 4 GB droplet, `instances: 1`, fork mode, 500–600M ceilings | `ecosystem.config.js`; `docker-compose.yml` (`mem_limit: 1g` each, header sizes for a 4GB droplet) |
| C34 | `checkout.tsx` defaults to `?plan=PRO` | `Frontend/src/routes/checkout.tsx:82`, fallback `:212` |
| C35 | `checkout.tsx` has no STARTER label | `PLAN_LABELS` `Frontend/src/routes/checkout.tsx:38-42` — only PRO/BUSINESS/AGENCY |
| C36 | `checkout.tsx` displays a conversion, not an advertised price | `Frontend/src/routes/checkout.tsx:159-166` — doc's `:159` exact |
| C37 | "₹49 first month" is a display string with no checkout implementation | `src/config/marketing.config.ts:54-55`; no intro-price logic in any checkout path |
| C38 | Free tier `workflows` currently 10 | `src/config/billing.config.ts:63` |
| C39 | Business `apiRequestsPerDay` currently 2000 | `src/config/billing.config.ts:128` |
| C40 | Business `teamMembers` currently 20 | `src/config/billing.config.ts:125` |

---

## B. CONFIRMED FACT, WRONG LINE REFERENCE

| # | Claim | Doc said | Actual |
|---|---|---|---|
| L1 | `send-dm` worker concurrency 5 | `worker.ts:124-127` | `src/queue/worker.ts:129-132` |
| L2 | Analytics sync worker concurrency 1 | `worker.ts:217-221` | `src/queue/worker.ts:222-226` |
| L3 | Hourly analytics schedule | `worker.ts:305` | `src/queue/worker.ts:323-325` |
| L4 | Ollama gateway 60 req/min assertion | `AI/providers/OllamaProvider.ts:90` | Correct file/line, but it is the **message text on a 429 received from the gateway**, not a limit Liffio enforces |
| L5 | Per-user AI rate limit 20/min | `middleware/rateLimiter.ts:103-111` | `src/api/middleware/rateLimiter.ts:119-127` |

---

## C. REFUTED — the code contradicts the doc

| # | Doc claim | Reality | Where |
|---|---|---|---|
| R1 | **V3 baseline: Business $49, Agency $449** — the premise of §2.4, §19, §28 | **Configured: Business $79 (7900¢), Agency $299 (29900¢).** V4 is therefore a Business **price cut** and an Agency **+84% rise**, not the increases the doc argues | `src/config/billing.config.ts:121`, `:141` |
| R2 | API keys "✅ Enforced today (0 / 0 / — / 10)" | `maxApiCredentials` = **0 / 2 / 5 / 10 / 50**. Starter and Pro can create API keys today | `src/config/billing.config.ts:67,87,107,127,147` |
| R3 | External API is a Business capability | `gates: { api: Plan.STARTER }` on **every** plan; `apiEnabled: true` from Starter up | `src/config/billing.config.ts:73,93,113,133,153`; `:92` |
| R4 | 🔴 "All six Redis rate limiters collide on `rl:<userId>`; `redisStore(prefix)` ignores its prefix" | **Already fixed.** `prefix` is forwarded; the block comment documents the fix; a regression test asserts distinct keyspaces | `src/api/middleware/rateLimiter.ts:19`, comment `:7-16`, test `src/api/middleware/rateLimiter.test.ts:75` |
| R5 | 18 BullMQ workers / 41 job slots | **20 workers / 43 slots**, plus 2 per active plugin. "18" is the count receiving `bindWorkerEvents` — an observability gap, not a capacity figure | `src/queue/worker.ts:129-254`, `:256-277`; `:348-365`; `src/plugins/queue.ts:154-156` |
| R6 | Stripe webhook resolver "returns one arbitrary row" | The column is UNIQUE — at most one row can match. It is also the **4th** resolution strategy, not the first | `src/api/webhooks/stripe.ts:36-109`; UNIQUE at `WorkspaceSubscription.entity.ts:24` |
| R7 | `WorkspaceStatus.SUSPENDED` is a dead enum value | No longer dead — written by `setWorkspaceStatus` in the newly-landed admin control plane. (`SubscriptionStatus.PAUSED` **is** dead: zero references) | `src/services/adminWorkspaceMutations.ts` |
| R8 | `src/config/env.ts` | **Does not exist.** The file is `src/env.ts` | — |
| R9 | "India — billed via Razorpay" (§3, §16, HTML footer) | **No geo routing exists.** `resolveProviderForCountry` hardcodes `"stripe"`; `resolveCheckoutProvider` accepts `country` and never reads it. Razorpay is reachable only if the client explicitly posts `provider:"razorpay"` | `src/config/billing.config.ts:192`; `src/services/billing.ts:127-135` |
| R10 | `agency.ts`'s `includedWorkspaces: 30` needs reconciling with 20 | True, **and worse**: `billing.config.ts` separately sets Agency `workspacesIncluded: 999999`. Three different numbers (20 target / 30 / 999999) | `src/api/routes/agency.ts:108`; `src/config/billing.config.ts:146` |
| R11 | §4.2 "Entitlement ceiling is per workspace ✅ Enforced" | The ceiling is per **package**, not per plan, and **absent entirely** when no package is assigned | `src/services/entitlement.ts:207` |
| R12 | §22 implies capability gating drives the tier matrix | Only **8 capability-route rules** exist (📏 measured, all enabled), covering **6** capabilities. **119 of 125** keys have zero gate sites | `src/db/migrations/1785700000000-AddCapabilityRoutes.ts:71-93`; `src/generated/capabilityRoutes.ts:18-25`; `src/generated/modules.ts:247-372` |
| R13 | Free "3 automations 🔧 (currently 10)" | Value correct, but the **same config object advertises `"1 workflow"`** — marketing copy already contradicts the enforced number, independent of V4 | `src/config/billing.config.ts:60` vs `:63` |
| R14 | Starter "Unlimited automated DMs" is a clean position | Starter `highlights` claims **"Unlimited workflows"** while `workflows: 999` — and `planEnforcement` short-circuits at `>=999`, so it is *effectively* unlimited by accident, not by design | `src/config/billing.config.ts:80,83`; `src/services/planEnforcement.ts:76` |

---

## D. ~~UNVERIFIABLE~~ — mostly RESOLVED by the 2026-08-19 measurement

### ✅ Resolved

| # | Item | 📏 Measured answer | What it changed |
|---|---|---|---|
| **U1** | Live `capability_routes` contents | **8 rows, all enabled, 6 distinct capabilities.** Nothing added by operators or plugins | **The seed IS the live state.** D9 settled; the "plan against a floor" framing is withdrawn |
| **U2** | Whether any workspace has a `workspace_packages` row | **2 rows across 74 live workspaces — 72 unpackaged** | Worse than the 35–45 the stale comment implied. The ceiling is inert platform-wide; **all 4 paying workspaces are unpackaged**. SB1 restated |
| **U3** | Live `child_modules` count | **125** | `capabilityReconciler.ts:11` is right; `generated/modules.ts` is **4 keys stale**. Coverage is 119 of 125, not 116 of 121. Reconciled in B3 |
| **U5** | Eligible-workspace count for the analytics sync | Bounded: **at most 74** live workspaces | No longer a planning unknown as an upper bound. The exact eligible subset (Instagram permission + active account) was not counted |

### Still open

| # | Item | Why it is still open | Impact |
|---|---|---|---|
| **U4** | The AI gateway's real 60 req/min limit and single-slot behaviour | External host (`https://ai-gateway.srv1772252.hstgr.cloud`, `src/env.ts:205`). Asserted only in comments; nothing in either repo enforces or measures it. **Not answerable by a DB query** | V4 §21.2's "saturates at 3 concurrent users" remains unverifiable from this codebase |
| **U6** | Which deployment path is live — PM2 or docker-compose | Both configs exist, both single-instance | Neither changes the capacity conclusion |
| **U7** | Runtime active-plugin count | Determines the `+2 slots each` addition to the 43 | Minor |
| **U8** | Whether existing Stripe/Razorpay price objects match `billing.config.ts` | **Needs a provider dashboard export, not a DB query.** The env SKU ids are empty-by-default (`src/env.ts:104-130`); the actual objects live outside the repo | **Phase D2 still cannot be planned precisely without this.** 5 active subscriptions are attached to objects whose ids are not usably recorded in the DB |

> **One item was never on this list and should have been: SB3** — how many workspaces already exceed each proposed new limit. **📏 It was measured on 2026-08-19 and came back at zero on every plan and every limit** (busiest workspace: 6 automations against a 150 cap; no workspace has more than one member). **SB3 is struck** and SB4 downgraded to low — see `04-risks.md`.
>
> **Every database question in this audit is now answered.** The only outstanding item is **U8**, which needs a provider dashboard export rather than a query.

---

## E. Files the doc references that DO NOT exist

| Referenced as | Status |
|---|---|
| `src/config/env.ts` | Does not exist — the file is `src/env.ts` |
| `PackagePrice.entity.ts` / `PackageLimit.entity.ts` | Do not exist. `package_prices`, `package_limits`, `package_products` are raw-SQL tables created in `src/db/migrations/1785400000000-AddPackageBillingCatalog.ts` and accessed via `AppDataSource.query` only |
| A `packages.seed.ts` | Does not exist. Seeding is `src/db/seeds/backfillPackages.ts`, which derives rows from `plan_catalog` |
| Plan allowances in `src/lib/aiTokens/` | Not there — that directory holds only the cost formula. Allowances live in the `ai_token_plan_configs` table |

All other doc-referenced paths I checked **do** exist: `billingSubscription.ts`, `freeWorkspaceLimit.ts`, `api/routes/workspaces.ts`, `api/webhooks/stripe.ts`, `api/webhooks/razorpay.ts`, `config/marketing.config.ts`, `scripts/setupRazorpayPlans.ts`, `services/billing/packageCheckout.ts`, `services/accountTrustService.ts`, `entities/billing/WorkspaceSubscription.entity.ts`.

---

## F. Findings the doc does not mention at all

| # | Finding | Where |
|---|---|---|
| N1 | **`src/config/billing.config.ts` is the single source of truth for plan limits, pricing and feature gates.** The doc never cites it | `src/config/billing.config.ts:54-155` |
| N2 | **`Plan` already has five members with `PRO` in the middle slot at exactly $29** — Growth may be a rename, not a sixth tier | `src/entities/enums.ts:63-69`; `src/config/billing.config.ts:101` |
| N3 | A **third** price/limit set exists in the DB seed, disagreeing with `BILLING_PLANS` on both | `src/db/seed.ts:148-176` |
| N4 | `planCatalogService.ensureSeeded`'s `orUpdate` list omits `max_team_members`, `max_automations`, `max_workspaces` — the documented cause of `plan_catalog` staleness | `src/services/planCatalog.ts:73-80` |
| N5 | `maxApiCredentials` is counted **per user across all workspaces**, not per workspace, while the limit is resolved per workspace | `src/services/apiCredentials.ts:87-89` |
| N6 | `apiRequestsPerDay` counts `schedulerPosts + automations`, **not requests** | `src/services/externalApiUsage.ts:51` |
| N7 | `followUpScheduler.ts` reads `BILLING_PLANS[plan].limits.dmFollowUps` directly, bypassing package and workspace-override resolution | `src/services/followUpScheduler.ts:61` |
| N8 | Analytics custom range accepts up to **366 days** on any plan, bypassing the 7/30/90 presets | `src/services/adminDashboardMetrics.ts:134,152-155` |
| N9 | The analytics sync has **no plan filter** — Free workspaces are swept identically to Agency | `src/queue/jobs/schedulerAnalyticsSync.ts:28-39` |
| N10 | Razorpay package checkout assigns the package **before payment settles** | `src/services/billing/packageCheckout.ts:199-205` |
| N11 | Razorpay treats `subscription.pending` as a hard payment failure | `src/api/webhooks/razorpay.ts:176` |
| N12 | Razorpay webhook resolution is `notes.workspaceId` **only** — no fallback; externally-created subscriptions are silently dropped | `src/api/webhooks/razorpay.ts:83-88` |
| N13 | Stripe webhook handler errors return HTTP 500 **after** `recordEvent`, so the retry is classified as a duplicate and the failed work is never re-attempted | `src/api/webhooks/stripe.ts:151-163`, `:294-298` |
| N14 | `checkout_`/`invoice_` synthetic ids are guarded **nowhere** — they will be passed to `stripe.subscriptions.update()` on cancel | `src/services/billing.ts:361-366`; only `manual_` is defended (`adminBillingMutations.ts:158`) |
| N15 | Legacy metadata migration hardcodes `plan: Plan.STARTER` regardless of what was bought | `src/services/billingSubscription.ts:360-361` |
| N16 | `packages.is_default` column exists in migration and service code but **not on the entity** — TypeORM is unaware of it | `src/db/migrations/1785900000000-AddPackageIsDefault.ts:34`; `src/services/defaultPackage.ts:36` |
| N17 | `src/utils/planLimits.ts` exports `PLAN_LIMITS` with **zero importers** | `src/utils/planLimits.ts:11-26` |
| N18 | `apiRateLimiter` uses the **in-memory** store and has no `keyGenerator` | `src/api/middleware/rateLimiter.ts:36-41`; mounted `src/index.ts:191` |
| N19 | `getMarketingPlans()` — the one region-aware price service — has **no callers** | `Frontend/src/lib/api/marketing-api.ts:15-17` |
| N20 | `module-registry.docs.tsx:171` calls `useCan()` with one argument against a two-arg signature, producing `"<key>:undefined"` — **a permanently closed gate** | `Frontend/src/routes/_app/module-registry.docs.tsx:171` |
| N21 | `app-sidebar.tsx` gates the Agency nav on the **display string** `"Agency"`, not the plan key `AGENCY` | `Frontend/src/components/app-sidebar.tsx:238-240` vs `src/state/app-context.tsx:88-89` |
| N22 | `scheduler:approve_posts` is already gated — the only V4 Business capability with live enforcement | `src/generated/capabilityRoutes.ts:18` |
| N23 | Best-time-to-post heatmap **already exists and is ungated** | `src/services/scheduler/schedulerAnalytics.ts:611,641` → `src/api/routes/scheduler.ts:1001` |
| N24 | Proactive AI growth alerts **already exist** (`lyraGrowthAlert` worker), ungated | `src/queue/worker.ts:188-191`; `src/queue/jobs/lyraGrowthAlert.ts` |
| N25 | The capability wall **fails open** on every error path: no rule match, no `req.authz`, or any thrown exception all call `next()` | `src/api/middleware/requireCapability.ts:168`, `:173-179`, `:192-200` |
