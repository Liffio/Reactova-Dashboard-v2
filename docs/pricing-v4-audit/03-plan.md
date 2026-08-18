# 03 — Stage Index

One line per stage. Full detail — goal, files with line refs, config-vs-code, migration, PREVIEW-ONLY flag, dependencies, rollback, verification, independence — lives in the linked phase file.

**Ordering principle:** correctness before tiers · tiers before checkout · checkout before frontend · Agency's *billing* on its own track.

**Legend:** `CFG` config-only · `CODE` new code · `DATA` data only · `MIG` migration required · 🔒 **PREVIEW-ONLY — you execute the DB write** · ⚠️ behaviour change for existing customers

**Dependencies are stated at STAGE granularity, never phase granularity** (Correction P4). "Phase B ──▶ C1" and "C1 ──▶ B4" read as a cycle only because whole phases were being named as dependency nodes.

> **⚠️ Provenance:** 📏 figures below are **production database** measurements. Source citations are the **local** working copies (`Backend/` `62b4177`, `Frontend/` `5a1935a`), which are **not established to match the deployed release**. No claim here reasons from one to the other — see the standing rule in [`00-findings.md`](00-findings.md).

> ## 📏 Production measured 2026-08-19 — no stage is blocked on a decision
>
> Read-only SELECTs settled D3, D7 and D9. **Blocked-on-decision drops from 2 to 0.**
>
> | Measured | Value | Effect on this plan |
> |---|---|---|
> | Active paying workspaces | **4** (3 Agency, 1 Business, 1 Starter — 5 subs) | **D2 unblocked** — reprice directly |
> | Active API credentials | **0**, none ever used | **A4 unblocked**, ships immediately; SB5 struck |
> | `capability_routes` / `child_modules` | **8 rows, 6 caps** / **125** | **D9 settled** — seed is live; coverage is 119 of 125 |
> | Live workspaces / unpackaged | **74** / **72** | SB1 restated — wider reach, 4 paying |
> | Soft-deleted workspaces | **3** | A3 needs a 3-row check |
> | Subscription rows with a price pin | **1 of 7** | D5's marker is cheap to build now |
>
> **Two live defects confirmed, not modelled:** a CANCELED BUSINESS workspace still holds its package row (**A1**), and an ACTIVE Agency subscription carries a synthetic provider id (**0.10**, Razorpay path).

> ## 🔴 📏 THE TOP FINDING — the package layer is INVERTED
>
> **Measured 2026-08-19, `package_features` by package:**
>
> | Package | Features | `team` | `api` | `post_story` |
> |---|---:|---:|---:|---|
> | Agency | 146 | 6 | 9 | yes |
> | **Free** | **140** | **6** | **9** | yes |
> | Starter | 113 | 0 | 0 | yes |
> | **Business** | **94** | **0** | **0** | yes |
> | Pro | 92 | 0 | 0 | yes |
> | Growth | **1** | 0 | 0 | no |
>
> **A FREE workspace holds strictly more capability than a paying BUSINESS workspace.** Free grants all 6 `team:*` and all 9 `api:*` keys; Business grants none of either.
>
> **This displaces "116 of 121 capability keys are ungated" as the audit's headline finding.** The original framing — *"V4 is a gate-layer build, not a config exercise"* — was right but incomplete. **V4 is a gate-layer build AND a package-authoring build, and it is the package layer that is currently broken.** Route rules cannot deny a capability the package grants, so B2a/B2b as originally written would have gated nothing.
>
> **Three stages have been added and integrated into the tables below:** **B0** (author per-tier package contents, before B1), **B2c** (the Starter boundary — 35 keys with no gate), **F-a3** (Agency white-label). Plus four scope extensions. Full detail in [`07-paywall-coverage.md`](07-paywall-coverage.md).

---

## [Phase 0 — Live Bugs](phases/phase-0-live-bugs.md)
*Harming customers today. No dependency on any pricing decision. Ship first.*

| # | Stage | Repo | Type | MIG | Indep. |
|---|---|---|---|---|---|
| 0.1 | Checkout renders the wrong plan's feature list (`?plan=STARTER` shows Pro) | FE | CODE | N | ✅ |
| 0.2 | Annual checkout shows a yearly total as "$279/mo" | FE | CODE | N | ✅ |
| 0.3 | Agency nav gated on display string `"Agency"`, not key `AGENCY` | FE | CODE | N | ✅ |
| 0.4 | `useCan()` called with one arg → permanently closed gate | FE | CODE | N | ✅ |
| 0.5 | `maxApiCredentials` counted per-user, not per-workspace | BE | CODE | N | ✅ **📏 caveat void — 0 credentials exist** |
| 0.6 | `apiRequestsPerDay` counts posts+automations, not requests | BE | CODE | N/Y 🔒 | defer to A4 |
| 0.7 | Two workers emit no lifecycle events (analytics sync fails silently) | BE | CODE | N | ✅ |
| 0.8 | `creatorProgramApiLimiter` defined but never mounted | BE | CODE | N | ✅ |
| 0.9 | Stripe webhook failures marked processed → never retried | BE | CODE | N/Y 🔒 | ✅ |
| 0.10 | Synthetic provider ids passed to the provider API | BE | CODE | N | ✅ **🔴 📏 LIVE instance — 1 ACTIVE Agency sub; check Razorpay too** |
| **0.11** | **"50,000 automated DMs/month" — no monthly DM cap exists anywhere** | FE | CODE | N | ✅ |
| **0.12** | **Per-plan Instagram account limits — no backend field of any kind** | FE | CODE | N | ✅ |
| **0.13** | **Business "5 team member seats" — backend gives 20** | FE | CODE | N | ✅ |

> **0.11–0.13 were promoted out of E7** (Correction P6). They are **live false claims against the current backend**, not V4 drift, so they carry no C1 dependency. The remainder of E7 stays gated behind C1.

---

## [Phase A — Correctness](phases/phase-a-correctness.md)
*Entitlement leaks and revenue bypasses. Worth shipping even if V4 is abandoned. **No migrations; entire phase is code-only** — with one measured exception: A1 should be paired with a one-off 🔒 cleanup of the single leaked package row.*

| # | Stage | Repo | Type | MIG | Indep. |
|---|---|---|---|---|---|
| A1 | Clear `workspace_packages` on cancellation — close the entitlement leak | BE | CODE | N | ✅ **🔴 📏 LIVE leak instance + one-off cleanup 🔒** |
| A2 | Invalidate `ws_ctx` on every billing transition (currently 1 caller) | BE | CODE | N | ✅ |
| A3 | Filter `deletedAt` in workspace + API-key middleware | BE | CODE | N | ✅ ⚠️ |
| A4 | Bring `/api/v1/external` **and `/api/v1/liffio/<lyra>`** under RBAC + the capability wall | BE | CODE | N | ✅ **📏 unblocked — 0 API keys exist; ship early** |
| A5 | Enforce workspace creation limits — **sole enforcement point for `workspacesIncluded`** | BE | CODE | N | ✅ |
| **A6** | **Stop granting entitlement before Razorpay payment settles** | BE | CODE | N | ✅ |

> 🔴 **A4's scope now includes the Lyra surface** — `/api/v1/liffio/<lyra>` is mounted without `loadAuthorizationContext`, so V4's per-tier Lyra capabilities can never be enforced there; and **omitting the `x-workspace-id` header skips both the token balance check and the charge while still running the AI call.** Specified in [`phase-a-correctness.md`](phases/phase-a-correctness.md) A4.
>
> **A6 is new** (Correction P2). `packageCheckout.ts:199-205` assigns the package at checkout *creation*, pre-payment — an abandoned Razorpay checkout leaves a **permanent** package grant. A1 does not cover it: an abandoned checkout never produces a subscription to cancel, so A1's code path never fires. Risk LM6 previously had no stage.
>
> **A5 absorbed old F4** (Correction P1) — same file, same limit key. Track F contributes slot *release* semantics instead, as F-a2.

---

## [Phase B — Make the Matrix Enforceable](phases/phase-b-enforceable-matrix.md)
*The bulk of the work. 44 capability rows are `NEW_GATE`. Converts a fail-open system to fail-closed — see `04-risks.md` SB1.*

| # | Stage | Repo | Type | MIG | Indep. |
|---|---|---|---|---|---|
| **B0** | **Author per-tier package contents — 📏 the ladder is inverted** | BE | CODE+DATA | N 🔒 | ✅ **must precede B1** |
| B1 | Bind plan → package so the ceiling becomes real (**report-only pass first**) | BE | CODE+DATA | N 🔒 | ❌ after **B0**, A1, A2 |
| B2a | Capability routes — analytics + scheduler (the Growth boundary) **+ job plan-predicates** | BE | CODE+DATA | Y 🔒 | ❌ after B0, B1, B3 |
| B2b | Capability routes — team + API (the Business boundary) | BE | CODE+DATA | Y 🔒 | ❌ after B0, B1, A4 |
| **B2c** | **Capability routes — the Starter boundary (~35 keys, no stage until now)** | BE | CODE+DATA | Y 🔒 | ❌ after B0, B1 |
| B3 | Add 2 missing keys: best-time-to-post, proactive AI alerts | BE | CODE+DATA | Y 🔒 | ❌ after B1, before B2a |
| B4 | Enforce daily caps on internal routes, not just external API | BE | CODE | N/Y 🔒 | ✅ ⚠️ *after C1* |
| B5 | DM monthly metering — Free's 500/mo does not exist at all | BE | CODE | Y 🔒 | ⛔ *after Jira **LF-66*** |
| B6 | Tier the analytics history window (incl. the 366-day custom-range bypass) | BE | CODE | N | ✅ ⚠️ |
| B7 | Remove Stories from anything sellable — **📏 5 live packages grant it** | BE | CODE+DATA | Y 🔒 | ✅ |

> 🔴 **B0 is the phase's critical prerequisite.** B2a, B2b and B2c are all **inert without it** — a route rule cannot deny a capability the package grants. And B1 must not run before it: 📏 against current contents, assigning the Free package would hand 68 Free workspaces all 9 `api:*` and all 6 `team:*` keys — more than a paying Business workspace holds.
>
> **B2a's scope extends** to add a plan predicate to **`lyraGrowthAlert`** as well as `schedulerAnalyticsSync` — both run paid work for every workspace on a schedule. **B7's scope extends** to strip `analytics:story_metrics` alongside `scheduler:post_story`.
>
> **B5 collides with Jira epic LF-66** (Correction P3) — the DM-engine rewrite (blocking sleep, idempotency, rate tiers, reconciliation sweep). Conflicting files: `src/services/dm.ts` and `src/queue/jobs/sendDm.ts`. **Sequence B5 after LF-66 lands**, then re-derive its line references. The limit key, the `PlanDefinition.limits` field and the counter migration can be prepared in advance; only the enforcement hook is blocked.

---

## [Phase C — Tier Definitions](phases/phase-c-tier-definitions.md)
*Config values and Growth itself. **C1 changes numbers only; C3 changes data only; C2 is the sole code stage.***

| # | Stage | Repo | Type | MIG | Indep. |
|---|---|---|---|---|---|
| C1 | Limit VALUE changes — one file, no logic | BE | **CFG** | N | ❌ after B0, B1, B2a, B2b, B2c · *activates dormant `>=999` enforcement — 📏 **0** workspaces affected* |
| C2 | Introduce Growth — **`PRO` already occupies the slot at exactly $29** | BE | CODE | Y 🔒 | ❌ after C1 · **pre-step required first** |
| C3 | AI token allocations + rollover — **Agency `-1` → 75,000** | BE | **DATA** | N 🔒 | ✅ ⚠️ |

> ✅ **C2's "Growth" package collision is resolved by B0.** 📏 The half-built `Growth` package (1 feature) is **orphaned** — zero rows in `workspace_packages`, `package_prices`, `package_limits` and `package_products`. **Settled: B0 deletes and recreates it**, after which the `PRO → GROWTH` rename creates a clean package. **Sequence: B0 → C2.**
>
> **C2's required pre-step (Decision D1):** before any SQL is drafted, enumerate every place the literal `"PRO"` is stored **outside** the Postgres enum — provider SKU env key *names*, provider price metadata, stored webhook payloads, `plan_catalog`, `ai_token_plan_configs`, `feature_overrides`, admin audit rows, `packages`. A value rename touches none of them.

---

## [Phase D — Checkout & Billing](phases/phase-d-checkout.md)
*Every stage touches live money. Sandbox-verify before any production provider write. **Never mutate an existing price object.***

| # | Stage | Repo | Type | MIG | Indep. |
|---|---|---|---|---|---|
| D1 | INR price sheet (literal, no FX) **+ country/state capture** | BE | CFG+CODE | **Y** 🔒 | ❌ *D4/D5 settled* |
| D2 | Price changes + new Stripe/Razorpay SKUs | BE | CFG | N 🔒 | ❌ after C2, D1 · **📏 D3 settled — reprice 4 customers directly** |
| D3 | Route India to Razorpay — reuse existing `lib/pricingRegion.ts` | BE | CODE | N | ✅ after D1 |
| D4 | Payment grace period — first failed invoice currently halts everything | BE | CODE | Y 🔒 | ✅ after A2 |
| D5 | Launch price-lock — **cohort marker only; the 12-month rule is not built** | BE | CODE | Y 🔒 | ✅ after D2 |

> **D1 grew and D5 shrank.** D1 now carries the explicit INR price sheet (D4), deletion of the `usdCents × 84` path, removal of the "₹49 first month" string, **and** country + state capture as a hard requirement (D5) — which gives it a migration it did not previously have. D5 now builds only the GA-window cohort marker (D6); **the restoration promise must come out of the HTML** — see [`06-doc-corrections.md`](06-doc-corrections.md) §11.

---

## [Phase E — Frontend](phases/phase-e-frontend.md)
*Last, by design. **No stage touches the database.** E2 and E4 are Phase 0 items, listed for completeness and **not counted separately** in the rollup.*

| # | Stage | Repo | Type | MIG | Indep. |
|---|---|---|---|---|---|
| E1 | Plan literal rename across 8 files + `planOrder` (drives upgrade/downgrade) | FE | CODE | N | ❌ after C2, B3 |
| E2 | Fix `checkout.tsx` — **duplicate of 0.1 + 0.2, ship there** | FE | CODE | N | *(pointer)* |
| E3 | De-duplicate hardcoded price/seat/FX tables | FE | CODE | N | ✅ |
| E4 | Agency nav gating — **duplicate of 0.3, ship there** | FE | CODE | N | *(pointer)* |
| E5 | Wire `package-checkout` + `getMarketingPlans()` — both built, zero callers | FE | CODE | N | ❌ after D1–D3 |
| E6 | Capability-driven UI gating for the new tiers | FE | CODE | N | ❌ after B0, B2a, B2b, B2c, B3 |
| E7 | Reconcile **remaining** contradictory billing copy | FE | CODE | N | ✅ after C1 |

> **E7 was reduced** (Correction P6): the three rows that were false against the *current* backend moved to Phase 0 as 0.11–0.13. What remains in E7 is genuinely C1-dependent — copy that must quote the V4 numbers, which do not exist until C1 lands.

---

## [Phase F — Agency](phases/phase-f-agency.md)
*Separate track, **now split.** The 20-workspace entitlement is a config change; only the single-subscription billing is architecturally blocked.*

### Track F-a — the 20-workspace grant · **not blocked**

| # | Stage | Repo | Type | MIG | Indep. |
|---|---|---|---|---|---|
| F-a1 | Reconcile the Agency workspace counts (20 / 30 / 999999) — *formerly F0* | BE | CFG+CODE | N | ✅ |
| F-a2 | Slot **release** semantics + cooling-off — *formerly the release half of F3* | BE | CODE | N | ❌ after **A3**, A5 |
| **F-a3** | **Capability routes — Agency white-label (`agency:*`, 7 keys)** | BE | CODE+DATA | Y 🔒 | ❌ after B0, B1 |

> The grant is delivered by **C1** (`workspacesIncluded` → 20) + **F-a1** (`agency.ts:108`, and removal of the dead `extraMeteredRate: 9`) + **A5** (enforcement). All 20 slots are available at purchase; workspaces are created **on demand** against the cap. **Do not create 20 empty rows.**
>
> **F-a2 depends on A3, explicitly.** Without `deletedAt` filtering, a "released" workspace is still fully usable via `x-workspace-id` and the slot is not actually free.

### Track F-b — parent subscription + fan-out · **this is what blocks self-serve Agency**

| # | Stage | Repo | Type | MIG | Indep. |
|---|---|---|---|---|---|
| F-b1 | Parent `agency_subscriptions` table + synthetic child ids — *formerly F1* | BE | CODE | Y 🔒 | ✅ *(inert)* · needs 0.10 |
| F-b2 | Webhook fan-out — parent event must reach all 20 children — *formerly F2* | BE | CODE | N | ❌ after F-b1, A2 |
| F-b3 | Guided cancellation/downgrade for 20 workspaces — *formerly F5* | BE | CODE | Y? 🔒 | ❌ after F-b1, F-b2, F-a2, A1, D4 |

> **F-a3 is new.** Agency white-label rested on `requirePlan(Plan.AGENCY)` at three routes only (`agency.ts:19,29,136`); the other `agency:*` capabilities were ungated. 📏 The package layer already handles Agency correctly — `agency` is the one module `GATED_MODULES` withholds properly — so F-a3 supplies the missing route-layer half.
>
> **Corrected statement (Decision D10).** The old line — *"a 20-workspace subscription is architecturally impossible"* — was wrong as a description of the whole track. **Accurate:** one provider subscription backing 20 workspace entitlements is blocked by the `providerSubscriptionId` UNIQUE constraint, and payment-state fan-out to 20 children does not exist. **The 20-workspace entitlement itself is a config change.**
>
> **Old F4 is removed** — it duplicated A5's file and A5's limit key (Correction P1).

---

## Critical path to selling V4 honestly

```
Phase 0 (0.1, 0.2, 0.11, 0.12, 0.13)  ─── ship immediately, mis-selling today
        │
        ▼
A2 ──▶ A1        A3 · A4 · A5 · A6  (all independent — A4 now unblocked)
        │
        ▼
B0  ─── author package contents  🔴 THE PREREQUISITE
        │        (without it every gate below is inert, and B1 would
        │         hand Free workspaces more than Business holds)
        ▼
B1 (report-only ──▶ write)     [needs B0, A1, A2]
        │
        ├──▶ B3 ──▶ B2a   (Growth)
        ├──▶ B2b          (Business — needs A4)
        ├──▶ B2c          (Starter — 35 keys)
        └──▶ F-a3         (Agency white-label)
        │
        ▼
B0 · B1 · B2a · B2b · B2c ──▶ C1 ──▶ C2 ──▶ C3
                               │
                               ├──▶ B4          (B4 depends on C1, not the reverse)
                               ├──▶ E7          (remainder)
                               └──▶ F-a1 + A5   (the 20-workspace grant is real here)
        │
        ▼
D1 ──▶ D3          D1 + C2 ──▶ D2 ──▶ D5
        │
        ▼
C2 + B3 ──▶ E1     B2a/B2b/B2c/B3 ──▶ E6     D1–D3 ──▶ E5

B6, B7, D4      ─── parallel, independent, launch-blocking  (B7 pairs with B0)
B5              ─── parallel, but only after Jira LF-66
A3 ──▶ F-a2     ─── slot release
0.10 ──▶ F-b1 ──▶ F-b2 ──▶ F-b3   ─── Agency billing; sales-assisted meanwhile
```

**🔴 B0 is the single most important edge in this diagram.** It is new, it is cheap (📏 2 workspaces hold a package today), and every capability gate in the plan is inert without it.

**Two edges that were previously stated as a cycle:** C1 depends on **B1, B2a, B2b**; **B4** depends on **C1**. Both are true, neither is circular, and neither is a phase-level edge.

## Rollup

| | Count |
|---|---|
| Stage rows across the phase tables | **50** *(+3)* |
| — of which are pointers to a stage counted elsewhere | 2 (E2 → 0.1/0.2 · E4 → 0.3) |
| **Deduplicated total stages** | **48** *(+3)* |
| Requiring a DB write (🔒 PREVIEW-ONLY) — firm | **16** *(+3: B0, B2c, F-a3)* |
| — plus conditional, only if a migration is introduced | 4 (0.6, 0.9, B4, F-b3) |
| Config-only stages | 1 (C1) · plus D2 and F-a1 as config-plus-minimal-code |
| Data-only stages | 1 (C3) |
| Safe to ship independently | **32** *(+1: B0)* |
| **Blocked on an open decision** | **0** 📏 |
| Open data items | **1 — U8** *(a provider dashboard export, not a DB query)* 📏 |
| Blocked on external work | 1 (B5, on Jira epic LF-66) |

### The three added stages

| Stage | Phase | Why it was missing |
|---|---|---|
| **B0 · Author per-tier package contents** | B, **before B1** | The plan assumed packages already expressed the tier ladder. 📏 They express an **inverted** one — Free 140 features, Business 94 — from 📏 one write run by an **unidentified** program. **B0(a) replaces the contents and ships; B0(b) (preventing recurrence) is unscoped** pending identification of the deployed writer |
| **B2c · Capability routes — the Starter boundary** | B | B2a covered Growth, B2b covered Business. **Nothing covered Free → Starter** — ~35 keys, the conversion boundary the funnel depends on |
| **F-a3 · Capability routes — Agency white-label** | F-a | `agency:*` (7 keys) rested on `requirePlan` at three routes; the rest were ungated |

### The four scope extensions

| Stage | Extension |
|---|---|
| **A4** | Also bring `/api/v1/liffio/<lyra>` inside the wall, and make Lyra token metering unconditional (omitting `x-workspace-id` currently skips balance check **and** charge while still running the AI call) |
| **B2a** | Also add a plan predicate to **`lyraGrowthAlert`**, not just `schedulerAnalyticsSync` — both run paid work for every workspace on a schedule |
| **B7** | Also strip `analytics:story_metrics`. 📏 **All five real packages grant `scheduler:post_story`** — five live targets, not a hypothetical |
| **B2a/B2b/B2c** | Re-run `npm run capability-routes:codegen` at the end of each, or an infrastructure blip degrades the wall to the 8-rule snapshot and un-gates everything the phase added |

### How the recount differs from the previous rollup

The old figure of **41** was wrong three ways, and the phase tables it summarised came to **44**, not 41:

| Correction | Effect |
|---|---|
| **A6 added** (P2) | +1 — LM6 previously had no stage |
| **0.11–0.13 promoted from E7** (P6) | +3 — new stages, and E7 is reduced rather than removed |
| **Old F4 removed** (P1) | −1 — duplicated A5 |
| **Track F renumbered** (D10) | 6 stages → 5 |
| **E2/E4 identified as duplicates** | −2 from the deduplicated total; they duplicate 0.1/0.2 and 0.3 |
| **0.5 inside B4's files-touched** | **Not a stage.** B4 lists the `apiCredentials.ts` fix in its file list as a cross-reference; it is counted once, at 0.5 |

### On "blocked on an open decision" — now zero

The original rollup said **5** (A4, C2, D1, D2, D5). Part 1's decisions took it to 2. **The 2026-08-19 measurement takes it to 0.**

| Was blocked | Now |
|---|---|
| C2 (D1) | **Unblocked** — rename `PRO` → `GROWTH`, with the enumeration pre-step |
| D1 (D4, D5) | **Unblocked** — explicit INR price sheet; country/state capture in scope |
| D5 (D6) | **Unblocked** — cohort marker only; HTML promise withdrawn |
| B1 (D8) | **Unblocked** — report-only pass first, non-negotiable |
| Track F (D10) | **Unblocked** — split into F-a and F-b |
| **A4 (D7)** | **📏 Unblocked** — 0 API credentials, 0 ever used → **immediate enforcement**, SB5 struck |
| **D2 (D3)** | **📏 Unblocked** — 4 paying workspaces → **reprice directly**, notify individually |

### One data item still open — and it does not block a stage from starting

| Item | What it needs | Informs | Why it is not a block |
|---|---|---|---|
| **U8** | A **provider dashboard export** — not a DB query | D2's SKU work | D2 can be planned and sandbox-verified without it; it is required before creating production price objects |

**SB3 has been measured and struck.** Zero workspaces exceed any proposed automation or seat cap on any plan — the busiest holds 6 automations against a 150 limit, and no workspace has more than one member. **C1's verify-before-shipping precondition is removed**, and SB4 (no downgrade reconciliation) drops to **low** and is deferred past C1.

### 🧭 Every measured blast radius is at or near zero

| Measured | Value |
|---|---|
| Active paying workspaces | **4** |
| Active API credentials | **0** |
| Workspaces over any proposed limit | **0** |
| Capability rules in production | **8** |
| `workspace_packages` rows | **2** |
| Soft-deleted workspaces | **3** |

**This is a pre-launch build, not a live-system migration.** Stages written in migration language — grandfathering, deprecation windows, staged rollouts, report-only passes sized for a fleet — should be read against a platform with four paying customers. **The work is building a paywall before customers arrive.** That makes it cheaper, not optional: a gate that fails open is equally wrong at any scale, and this is the least expensive moment this plan will ever have.

### 📏 Resequencing the measurements justify

| Change | Rationale |
|---|---|
| **A4 moves early in Phase A** — alongside A1/A2/A3 rather than last | It was the only gated Phase A stage. With 0 keys it breaks nobody, and the fix gets *more* expensive once keys start existing |
| **B2b loses a scheduling constraint** | It needed A4 for the external-API surface; A4 is now schedulable immediately, so B2b is effectively gated on B1 alone |
| **0.10 rises to joint-first in Phase 0** | A live ACTIVE Agency subscription carries a synthetic provider id. That customer cannot be cleanly cancelled, repriced or synced until it lands — and D2 will touch them |
| **0.5 detaches from C1** | The "loosens a limit" caveat is void at 0 credentials |
| **A1 gains a one-off PREVIEW-ONLY write** | The live leaked package row is not cleaned by A1's forward fix; clearing it is a separate one-row write |
| **B1's report-only pass shrinks** | 4 paying workspaces carry the commercial risk. Produce the full 72-row diff; read the 4 |
| ~~SB3's count moves onto the critical path for C1~~ | **📏 Measured at zero — struck.** C1's verify-before-shipping precondition is removed |

**What does not resequence.** Phase A still precedes Phase B — A1/A2 remain hard prerequisites for B1, and cache staleness (SB9) still masks every entitlement fix until A2 lands. B1 → B2a/B2b → C1 → D2 is unchanged. **The measurements made stages cheaper and unblocked two of them; they did not remove a single ordering constraint.**

**All 16 firm DB-write stages are PREVIEW-ONLY, plus A1's one-off cleanup of the leaked package row. I will produce the SQL and the reconciliation reports; you execute every write.**

> **B0 carries the largest single write in the plan** — 📏 586 `package_features` rows across 6 packages are rewritten, plus the orphaned `Growth` package deleted and recreated. Capture the rows as CSV first. It is also among the safest: only **2 workspaces** hold a package today, so the live effect of the rewrite is 2 rows deep.
>
> **B0(a) — the data rewrite — is fully specified and ships.** It is defined by V4 §10's targets, so it does not depend on knowing what wrote today's contents.
>
> **B0(b) — preventing a future write from reproducing the inversion — is a requirement with an UNSCOPED implementation.** 📏 The rows came from one write run, but by production code at an unknown commit; local `Backend/` (`62b4177`) is not established to be the deployed release. **Do not trace local source for a defect that may not exist there.** The **writer-agnostic monotonicity assertion** — `granted(FREE) ⊂ … ⊂ granted(AGENCY)`, run as a permanent test — carries the safeguard until the deployed writer is identified.

**Provenance.** Everything marked 📏 was measured by read-only SELECT against production on **2026-08-19**. Unmarked figures come from source inspection. No write of any kind was made by this audit.

---

## Companion documents

| File | What it answers |
|---|---|
| [`00-findings.md`](00-findings.md) | Which of V4's claims about the code are true |
| [`01-capability-map.md`](01-capability-map.md) | Per-capability delta between V4's matrix and the code |
| [`02-gaps.md`](02-gaps.md) | What is broken, severity-ranked |
| [`04-risks.md`](04-risks.md) | What could go wrong while fixing it |
| [`05-decisions.md`](05-decisions.md) | The ten decisions — all settled |
| [`06-doc-corrections.md`](06-doc-corrections.md) | Where V4 and the HTML are wrong about the code |
| **[`07-paywall-coverage.md`](07-paywall-coverage.md)** | **Would anything V4 sells still be free after every stage ships? — plus the acceptance criteria for "V4 is enforced"** |
