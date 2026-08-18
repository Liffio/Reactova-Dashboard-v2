# 04 — Risks

Three categories: **data loss**, **live money**, **silent breakage**. Each entry names the stage that carries the risk and the mitigation.

> **Risk IDs in this file are `DL*` / `LM*` / `SB*`.** They are **not** R-numbers. `00-findings.md` uses R1–R9 for *refuted doc claims* — an unrelated scheme. Phase files that previously cited "R1", "R4", "R5", "R6", "R7" against this file were citing IDs that never existed here; all have been repointed (Correction P7).

> **Stage references updated.** LM6 now carries stage **A6** (it previously had none). DL3 carries **F-a2**, LM8 **F-b1**, LM10 **F-b2** — Track F was split and renumbered by Decision D10.

> ## 📏 Production measured 2026-08-19 — four risks changed severity
>
> Read-only SELECTs against production. **These are measurements, not estimates.**
>
> | Risk | Was | Now | Why |
> |---|---|---|---|
> | **LM2** | critical | **medium** | 4 active paying workspaces total. Repricing is 3–4 individual conversations, not a migration programme |
> | **LM3** | high | **medium** | 3 Agency customers, all known by name |
> | **SB5** | high | **STRUCK** | **0 active API credentials, 0 ever used.** There are no key holders to break |
> | **SB1** | critical | **critical — restated, BOTH directions** | Blast radius is *wider* than modelled (72 of 74 unpackaged, not 35–45), the *paying* population is 4, and 📏 against current packages B1 would **grant** 68 Free workspaces more than Business holds |
> | **SB13** | *(new)* | **critical — now the top finding** | 📏 The package ladder is **inverted**. Fixed by the new stage **B0** |
>
> **DL2** and **DL4** are now quantified rather than open. **LM8** has a confirmed live instance.
>
> **Update 2026-08-19 (second measurement): SB3 is also STRUCK.** Zero workspaces exceed any proposed automation or seat cap on any plan. **SB4** drops high → **low**.

> ## 🧭 Framing — this is a PRE-LAUNCH BUILD, not a live-system migration
>
> Every blast radius that has been measured has come back at or near **zero**:
>
> | Measured | Value |
> |---|---|
> | Active paying workspaces | **4** |
> | Active API credentials | **0** (none ever used) |
> | Workspaces over any proposed limit | **0** |
> | Capability rules in production | **8** |
> | `workspace_packages` rows | **2** (one of them a leak) |
> | Soft-deleted workspaces | **3** |
>
> **Read every entry below in that light.** Much of this audit was written in migration language — "existing customers", "blast radius", "churn event", "grandfathering", "deprecation window" — because it was written from source with no visibility into production. **There is barely an installed base to migrate.** The work is building a paywall before customers arrive, not retrofitting one around customers who are already inside.
>
> **What this does NOT downgrade:** correctness. A gate that fails open is equally wrong with 4 customers or 4,000, and it is far cheaper to fix now. The measurements change *urgency and sequencing*, not *whether the work is needed*.

---

## A. Data-loss risks

### DL1 · Phase C2 as an enum rename is not trivially reversible
**Stage:** C2 · **Severity: high**
`ALTER TYPE ... RENAME VALUE` on the Postgres `Plan` enum cannot be cleanly reversed once new rows carry the new value. Every column storing or defaulting to `'PRO'` is affected, across `workspace_subscriptions`, `plan_catalog`, `ai_token_plan_configs`, `feature_overrides` and any audit rows.
**Mitigation:** preview the exact SQL before running. Take a full dump first. **Decision D1 is settled: the rename (Option A) is chosen**, and Option B (append `GROWTH` as a sixth member) is not taken. A **required pre-step** now precedes any SQL — enumerate every place `"PRO"` is stored *outside* the enum (provider SKU env key names, provider price metadata, stored webhook payloads, `plan_catalog`, `ai_token_plan_configs`, `feature_overrides`, audit rows, `packages`). See `phases/phase-c-tier-definitions.md` C2.

### DL2 · Phase A3 makes reachable data unreachable
**Stage:** A3 · **Severity: medium**
Soft-deleted workspaces are fully usable today via `x-workspace-id` (`src/api/middleware/workspace.ts:38-46`) and via API key (`src/api/middleware/apiKeyWorkspace.ts:41-49`). Adding the `deletedAt` filter cuts off anything currently relying on that — accidentally or deliberately.
**📏 MEASURED 2026-08-19: 3 soft-deleted workspaces exist**, against 74 live. All 3 are reachable today via `x-workspace-id` and via API key. The count DL2 asked for is answered.
**Mitigation:** the remaining question is **not a code question — it is a data question about 3 specific rows.** Before A3 ships, confirm none of the 3 is in active use. If one is, that is a conversation with whoever is using it, not a reason to change the fix. Enumerating 3 workspaces is trivial; there is no longer any reason to ship A3 without doing it. No data is destroyed — only access is removed.

### DL3 · Agency slot release touches four tables
**Stage:** **F-a2** *(formerly F3)* · **Severity: high**
A correct release soft-deletes the workspace, clears `workspace_packages`, deletes/detaches the child `workspace_subscriptions` row, and deactivates `platform_accounts`. Today deletion cascades **nothing** (`src/api/routes/workspaces.ts:283-323`), so this stage introduces real destruction where none existed.
**Mitigation:** explicit confirmation flow; nothing deleted without it. Soft-delete only. Retain the `platform_accounts` row deactivated rather than deleted so the Instagram connection can be restored.

### DL4 · Phase B1 rollback needs a captured baseline
**Stage:** B1 · **Severity: medium**
The backfill writes `workspace_packages` rows. Rollback is `clearWorkspacePackage` per workspace — but that only restores "no package", not a *previous* package if one existed.
**📏 MEASURED 2026-08-19: `workspace_packages` holds 2 rows in total**, across all 74 live workspaces. The pre-state CSV is two lines.
**Mitigation:** capture the full pre-state (`workspace_id`, `package_id`) as CSV before the write. Previously "cheap"; now effectively free, and exact rollback is guaranteed because only 2 rows can be overwritten.

### DL5 · `upsertWorkspaceSubscription` erases period bounds on partial sync
**Stage:** any billing stage · **Severity: low, pre-existing**
Both branches coerce absent periods to `null` (`src/services/billingSubscription.ts:131-132,146-147`), so a sync omitting `currentPeriodStart` wipes a stored one.
**Mitigation:** out of scope for the pricing work, but do not add new sync call sites without addressing it.

---

## B. Live-money / billing-correctness risks

### LM1 · Existing price objects must never be mutated
**Stage:** D2 · **Severity: critical**
Editing a Stripe price or Razorpay plan that has active subscribers changes what those customers are charged, silently and immediately.
**Mitigation:** create new objects, repoint the env SKU ids (`src/env.ts:104-130`), leave old objects in place. Never delete a price with subscribers. Verify in sandbox (`BILLING_MODE=sandbox`, `billing.config.ts:159`) first.

### LM2 · Business is a price CUT, Agency an 84% RISE — against configured reality
**Stage:** D2 · **Severity: ~~critical~~ → MEDIUM** *(downgraded on measured data, 2026-08-19)*

| Plan | Configured | V4 target | Real delta |
|---|---:|---:|---|
| BUSINESS | **$79** (`billing.config.ts:121`) | $59 | **−$20 cut** |
| AGENCY | **$299** (`:141`) | $549 | **+$250, +84%** |

The V4 doc argues from a V3 baseline of Business $49 / Agency $449 — neither is in the codebase. The *direction* of both deltas is still as stated.

**📏 MEASURED 2026-08-19 — the affected population, in full:**

| Plan | Status | Count | Providers |
|---|---|---:|---|
| AGENCY | ACTIVE | **3** | 2 Stripe monthly, 1 Razorpay monthly |
| BUSINESS | ACTIVE | **1** | Razorpay, yearly |
| STARTER | ACTIVE | **1** | Razorpay, yearly |
| BUSINESS | CANCELED | 2 | Stripe, monthly |
| | **7 rows total — 5 active subscriptions, 4 active paying workspaces** | | |

**Mitigation — D3 is SETTLED, and it is not a migration programme.** **Reprice directly:** Business $79 → $59, Agency $299 → $549. **Notify the three or four affected customers individually.** The opposite-handling rule (migrate Business down, grandfather Agency) was designed for a population large enough that per-customer handling was impractical. At n=4 it is not needed — a person can send four emails.

**Why this is medium and not critical.** Severity was driven by the assumption of an unknown-sized subscriber base facing a silent 84% rise. The base is four workspaces, every one of them identifiable. The failure mode "customers are surprised by a price change" is prevented by a mailing list, not by engineering.

**Still critical, and unchanged:** **LM1** — never mutate an existing price object. Five active subscriptions are attached to live provider objects, and one of them (`AGENCY`, Razorpay) carries a **synthetic** `provider_subscription_id` — see LM8.

### LM3 · Agency loses unlimited AI at the same time its price rises
**Stage:** C3 + D2 · **Severity: ~~high~~ → MEDIUM** *(downgraded on measured data, 2026-08-19)*
C3 moves Agency AI tokens from `-1` (unlimited) to 75,000/month. D2 raises the price from $299 to $549. Landing together, an Agency customer sees an 84% price rise **and** a capability reduction in the same billing cycle.
**📏 MEASURED 2026-08-19: 3 Agency workspaces, all ACTIVE.** That is the entire exposure.

**Mitigation:** talk to the three. V4 §21.2's capacity argument for the cap is sound and is about *new* customers; for the existing three, either grandfather unlimited tokens or agree the change with them directly. **This was modelled as "a churn event for the highest-value segment." It is a conversation with three customers** — which is a real commercial task, but not a systemic risk, and not something the plan needs to route around.

**Sequencing advice stands but is now optional:** separating C3 and D2 in time was a way to soften a blind change. With three named customers, notifying them is strictly better than staggering deploys.

### LM4 · Three disagreeing INR sources
**Stage:** D1 · **Severity: critical**
Advertised ₹499/₹2,499/₹9,999 (`marketing.config.ts:49,82,103`) vs charged `usdCents × 84` = ₹756/₹6,636/₹25,116 (`billing.config.ts:184`, `scripts/setupRazorpayPlans.ts:52`) vs a third lineage in `backfillPackagePrices.ts:150-151`. An Indian customer is quoted one number and charged another — up to **+166%** on Business.
**Mitigation:** **D4 is settled** — an explicit per-plan INR price sheet with literal values from V4 §3, and **no FX derivation anywhere**. The `usdCents × 84` path is **deleted**, and `packages.monthly_price_inr_paise` is reconciled to the same literals so all three lineages converge. Stage **D1**. This remains the highest-severity finding in the audit for existing customers until D1 ships.

### LM5 · "₹49 first month" is advertised with no implementation
**Stage:** D1 · **Severity: high**
`marketing.config.ts:54-55` defines an intro price rendered to customers. No checkout path implements it.
**Mitigation:** **settled — REMOVE the string** (D4). Not build-or-remove. Stage **D1**.

### LM6 · Razorpay grants entitlement before payment settles
**Stage:** **A6** · **Severity: high**
`src/services/billing/packageCheckout.ts:199-205` assigns the package synchronously at checkout creation, before the webhook confirms payment. An abandoned Razorpay checkout leaves a permanent package grant.
**Mitigation:** move assignment to the webhook, matching the Stripe path. **This is now its own stage, A6** (Correction P2) — "fold into A1 or B1" was not an assignment, and A1 does not cover it: an abandoned checkout never produces a subscription to cancel, so A1's code path never fires.

### LM7 · Stripe webhook failures are silently discarded
**Stage:** 0.9 · **Severity: high**
`recordEvent` runs before handling (`src/api/webhooks/stripe.ts:151-158`); a handler throw returns 500 (`:294-298`) but the retry short-circuits as a duplicate (`:160-163`). A transient DB error during `invoice.paid` means the payment is **never applied**.
**Mitigation:** Phase 0.9. Ship before any billing change increases webhook volume.

### LM8 · Synthetic ids are sent to the provider — **CONFIRMED LIVE**
**Stage:** 0.10, prerequisite for **F-b1** · **Severity: high — no longer latent**
`checkout_`/`invoice_` ids are guarded nowhere and reach `subscriptions.update()` (`src/services/billing.ts:361-366`) and `.retrieve()` (`billingSubscription.ts:195-196`). F-b1's `agency_<parentId>_<slot>` ids multiply this by 20.

**📏 MEASURED 2026-08-19: one of the three ACTIVE AGENCY subscriptions carries a synthetic `provider_subscription_id` today.** Cancelling that workspace right now would call the provider with an id the provider has never issued. This is a live defect against a paying Agency customer, not a latent risk.

**The live instance is Razorpay, not Stripe.** Phase 0.10 as written names only Stripe call sites. **The Razorpay cancel path must be checked too** — see `phases/phase-0-live-bugs.md` 0.10.
**Mitigation:** Phase 0.10 must land before F-b1 — and now also before anyone attempts to cancel or sync that specific Agency subscription.

### LM9 · No GST or place of supply anywhere
**Stage:** D1 · **Severity: high for INR**
Zero repo-wide matches for `gst`, `placeOfSupply`, `tax_rate`. `BillingInvoice` has no tax field. No country/state is persisted against a subscription. Every INR amount is an undifferentiated gross figure.
**Mitigation:** **D5 is settled — INR ships, prices stay exclusive of GST, and customer country + state capture is a HARD requirement inside stage D1**, not a later stage. Place of supply determines IGST vs CGST/SGST, and B2B customers cannot claim ITC without a compliant invoice. **In scope:** persist country + state against the subscription and surface both on `BillingInvoice`. **Out of scope — flag, do not implement:** rate calculation, filing logic, GSTIN validation. Anything beyond capture goes to a tax specialist rather than a guess.

### LM10 · Razorpay treats a pending subscription as a hard failure
**Stage:** D4 · **Severity: medium**
`src/api/webhooks/razorpay.ts:176` routes `subscription.pending` to `markWorkspacePaymentFailed`, alongside `payment.failed` and `subscription.halted`.
**Mitigation:** fix in D4. Fanned out across 20 Agency children (**F-b2**), this would suspend an entire agency on a transient pending state.

---

## C. Silent-breakage risks — existing customers

### SB1 · Turning on the capability ceiling — **RESTATED on measured data**
**Stage:** B1 + B2 · **Severity: critical (unchanged) — but wider and cheaper than modelled**
Today `applyEntitlement` returns permissions untouched when no package is assigned (`src/services/entitlement.ts:207`), and **119 of 125** capability keys have no gate. **Every existing customer holds every capability their RBAC role grants.** The instant packages are assigned and rules seeded, working features disappear — for people who are paying.

**The estimate was wrong in both directions.** The audit inferred 35–45 unpackaged workspaces from a stale comment at `entitlement.ts:15-17`.

**📏 MEASURED 2026-08-19:**

| | Measured | Previously assumed |
|---|---:|---|
| Live workspaces | **74** | — |
| `workspace_packages` rows, all workspaces | **2** | — |
| Workspaces with **no** package row | **72 of 74** | 35–45 |
| Of those, **paying** workspaces | **4** | unknown, assumed many |

**Wider:** the ceiling is inert **almost platform-wide** — 97% of live workspaces.

**Smaller:** only **4** of them are paying customers. The D8 report-only pass now covers **4 workspaces, not a fleet.**

**Ceiling state by plan, measured:**

| Plan / status | Workspaces | Packaged | Ceiling |
|---|---:|---:|---|
| AGENCY ACTIVE | 3 | 0 | **inert** |
| BUSINESS ACTIVE | 1 | 0 | **inert** |
| STARTER ACTIVE | 1 | 0 | **inert** |
| BUSINESS CANCELED | 1 | **1** | **leaking — see A1** |
| No subscription | 68 | 1 | 67 inert |

**🔴 Every paying customer is unpackaged.** All 3 Agency workspaces, the active Business workspace and the active Starter workspace are in the unpackaged set. **B1 therefore turns the ceiling on for 100% of paying customers simultaneously** — there is no partial rollout available and no already-packaged cohort to learn from.

### 🔴 The risk runs in BOTH directions — and against current packages, mostly UPWARD

SB1 was written as *"assigning packages silently removes capabilities from paying customers."* **📏 The second measurement (package contents, 2026-08-19) shows the opposite is true for most of the platform.**

| Package | Features | `team` | `api` |
|---|---:|---:|---:|
| Agency | 146 | 6 | 9 |
| **Free** | **140** | **6** | **9** |
| Starter | 113 | 0 | 0 |
| **Business** | **94** | **0** | **0** |
| Pro | 92 | 0 | 0 |

**The ladder is inverted: the Free package grants strictly more than the Business package.**

| Cohort | Count | What B1 would do **against current package contents** |
|---|---:|---|
| Unpackaged **FREE** workspaces | **68** | **GRANTS more** — all 9 `api:*` and all 6 `team:*` keys, more than a paying Business workspace holds |
| Unpackaged **paying** workspaces | **4** | Mixed — Business/Agency restricted, Starter roughly flat |

**Mitigation — B0 is now a hard prerequisite.** **B1 must not run against current package contents.** Stage **B0** authors per-tier packages first; only then does B1 become the downward-only ceiling SB1 assumed.

**And D8's report must carry both directions.** As originally specified it lists *"the exact set of capabilities that would be removed"* — against an inverted ladder that report would show a near-empty removal list for 68 Free workspaces while silently granting them API keys. **The report must show granted AND removed, per workspace,** and the write must be refused if any workspace gains a capability its tier does not sell.

**Still mandatory, still cheap:** 4 paying workspaces carry the commercial risk; 72 rows if every inert workspace is listed. Readable in minutes. There is no cost argument against doing it.

### SB2 · The capability wall fails open on three paths
**Stage:** B2 · **Severity: high**
`requireCapabilityFromRegistry` calls `next()` when no rule matches (`requireCapability.ts:168`), when `req.authz` is absent (`:173-179`), **and on any thrown exception** (`:192-200`). A rule that does not match its route grants access silently, and looks identical to a rule that is working.
**Mitigation:** every new rule needs a test proving it **denies**, not merely that the happy path still works. `npm run capability-routes:codegen:check` must be clean.

### ~~SB3 · Phase C1 activates enforcement that has never run~~ — **STRUCK 2026-08-19**
**Stage:** C1 · **Severity: ~~high~~ — RISK DOES NOT EXIST**

`planEnforcement.ts:76` short-circuits at `limit >= 999`, so automation-count enforcement has **never executed for a paid customer**. That remains true of the *code*. The risk was that activating it would bite customers already over the new caps.

**📏 MEASURED 2026-08-19 — workspaces exceeding each proposed V4 limit:**

| Plan | Workspaces | Max automations | Over cap | Max seats | Over cap |
|---|---:|---:|---:|---:|---:|
| FREE | 69 | 1 | **0** | 1 | **0** |
| STARTER | 1 | 0 | **0** | 1 | **0** |
| BUSINESS | 1 | 6 | **0** | 1 | **0** |
| AGENCY | 3 | 0 | **0** | 1 | **0** |

**Zero workspaces exceed any proposed automation cap or seat cap on any plan.** The busiest workspace on the platform holds **6 automations against a 150 limit**. **No workspace has more than one member** — the seat caps (1/3/5/15/15) bind on nobody.

**C1 activates dormant enforcement against an empty set.** The verify-before-shipping precondition is removed from C1, and this entry is removed from the risk-to-stage matrix.

*The ID is retained rather than renumbered so that citations elsewhere still resolve.*

### SB4 · No downgrade reconciliation exists
**Stage:** C1 · **Severity: ~~high~~ → LOW** *(downgraded on measured data, 2026-08-19)*
Nothing deactivates the 12th automation when the cap drops to 3. Behaviour on an over-limit workspace is undefined — typically "cannot create new, existing keep working", but that is incidental, not designed.

**📏 MEASURED 2026-08-19: there is no existing over-limit population.** Zero workspaces exceed any proposed cap; the busiest holds 6 automations against a 150 limit. **Nothing is over-limit today, so C1 cannot land on anyone.**

**It is still a real design gap — for FUTURE customers.** A customer who grows past a cap and then downgrades will hit undefined behaviour. That is a product-design question to settle before the platform has customers who can grow into it, not a migration risk.

| | |
|---|---|
| **Is it a migration risk?** | **No.** Zero affected workspaces |
| **Does it gate C1?** | **No.** C1 ships without it |
| **Is it still worth building?** | **Yes** — before a customer is first able to exceed a cap and downgrade |

**Mitigation:** decide the policy explicitly (grandfather / soft-block / forced reconciliation). V4 §25.8 flags it and it remains unbuilt. **Deferrable past C1**; it is no longer part of C1's definition of done.

### ~~SB5 · Phase A4 breaks every existing API key holder~~ — **STRUCK 2026-08-19**
**Stage:** A4 · **Severity: ~~high~~ — RISK DOES NOT EXIST**

**📏 MEASURED 2026-08-19: `api_credentials` — 0 active, 0 ever used.** `last_used_at` is null across the board.

**There are no API key holders to break.** The risk was entirely conditional on an existing population of working keys; that population is empty. **Struck, and removed from the risk-to-stage matrix.**

**Consequences:**
- **A4 ships with IMMEDIATE enforcement.** No deprecation window, no log-only phase, no customer comms.
- **The D7 decision gate is removed from A4 entirely.** A4 is no longer blocked on anything — see `phases/phase-a-correctness.md` A4.
- The underlying hole (G4 — a VIEWER-scoped key can hard-delete automations; `/api/v1/external` has no `req.authz` across 791 lines) **is still real and still worth closing.** Nothing has exploited it because nothing has ever held a key. Fix it before the first key is issued, not after.

*The ID is retained rather than renumbered so that citations elsewhere still resolve.*

### SB6 · Phase B4 starts limiting users who have never been limited
**Stage:** B4 · **Severity: medium**
`schedulerPostsPerDay` and `automationsPerDay` currently bite only on the external API. Enforcing them internally caps UI usage for the first time. Worse if shipped before C1: Starter's `automationsPerDay` is **5** today, identical to Free.
**Mitigation:** ship B4 **after** C1, never before.

### SB7 · Phase B6 truncates analytics ranges in use
**Stage:** B6 · **Severity: medium**
The custom-range path accepts up to 366 days on any plan (`adminDashboardMetrics.ts:134,152-155`). Tiering to 7/30/90 removes reach customers have today.
**Mitigation:** measure actual range usage by plan first. Consider grandfathering existing workspaces for one billing cycle.

### SB8 · `followUpScheduler` ignores package and override limits
**Stage:** affects B1, C1 · **Severity: medium**
`src/services/followUpScheduler.ts:61` reads `BILLING_PLANS[plan].limits.dmFollowUps` directly, bypassing `resolveWorkspaceLimits`. A package or workspace override that raises `dmFollowUps` is honoured at write time (`planEnforcement.ts:58-72`) and **ignored at send time** — follow-ups are silently truncated (`:62`).
**Mitigation:** route it through `resolveWorkspaceLimits`. Otherwise every package-based follow-up grant is a broken promise.

### SB9 · Cache staleness masks every fix
**Stage:** all of Phase A/B · **Severity: medium**
`invalidateWorkspaceCtx` has one production caller (`adminRbac.ts:379`), TTL 300s. Until A2 lands, every entitlement fix appears not to work for up to five minutes, which will be misread as a bug in the fix.
**Mitigation:** ship A2 **before** A1 and B1, even though A1 is the more urgent leak.

### SB10 · Analytics sync failing silently undermines the Growth cost argument
**Stage:** 0.7 · **Severity: medium**
`schedulerAnalyticsSyncWorker` never receives `bindWorkerEvents` (`worker.ts:348-365`) — no completed/failed logs, no Sentry. V4 §21.4 builds the entire case for gating post analytics at Growth on this job's cost, and you currently cannot observe whether it completes.
**Mitigation:** Phase 0.7 before making any capacity decision based on §21.

### SB11 · Analytics sync has no plan filter at all
**Stage:** informational, affects B2a · **Severity: medium**
`schedulerAnalyticsSync.ts:28-39` filters on Instagram permission, active account and not-deleted workspace — **no plan or billing predicate**. Free workspaces are swept identically to Agency at ~101 Graph calls each.
**Mitigation:** gating `analytics:post_metrics` in B2a does **not** stop the sync — it only hides the output. To realise V4 §21.4's cost saving, the sync job itself needs the plan filter. Treat as a distinct task inside B2a.

### SB13 · The capability rules would not deny anyone — packages grant everything 📏 **CONFIRMED**
**Stage:** **B0** (the fix) · B1 + B2a + B2b + B2c (the affected) · **Severity: critical — the plan's top finding**
`GATED_MODULES` (`src/db/seeds/backfillPackages.ts:51-64`) withholds only `api`, `agency`, `team` and `scheduler`, at **parent-module** granularity. Every other module **and all of its children** is written into every package (`:157-171`). `applyEntitlement` admits a capability when the package grants it (`entitlement.ts:227`), so a seeded route rule matches, checks the capability, finds it present, and **allows the request**.
**📏 MEASURED 2026-08-19 — confirmed, and worse than modelled.** The packages do not merely fail to differentiate; **they differentiate backwards.**

| Package | Features | `analytics` | `team` | `api` | `scheduler` | `post_story` |
|---|---:|---:|---:|---:|---:|---|
| Agency | 146 | 11 | 6 | 9 | 28 | yes |
| **Free** | **140** | 11 | **6** | **9** | 28 | yes |
| Starter | 113 | 11 | 0 | 0 | 28 | yes |
| **Business** | **94** | 9 | **0** | **0** | 21 | yes |
| Pro | 92 | 9 | 0 | 0 | 21 | yes |
| **Growth** | **1** | 0 | 0 | 0 | 0 | no |

**Three things the measurement adds:**
1. **Inverted, not flat.** Free grants more than Business. A free workspace assigned its package holds API keys and team management that a paying Business workspace does not.
2. **A half-built `Growth` package exists and is ORPHANED** — 1 feature; zero rows in `workspace_packages`, `package_prices`, `package_limits` and `package_products`. **Settled: B0 deletes and recreates it**, after which C2's `PRO → GROWTH` rename is collision-free.
3. **The contents came from ONE write run, not legacy drift** — 📏 all five real packages created within **126 milliseconds** (2026-07-21 22:06:34.815–.941). **But the writer is unidentified:** the rows were written by production code at an unknown commit, and local `Backend/` (`62b4177`) is **not established to be the deployed release**. **B0(a) — replacing the contents — is unaffected. B0(b) — preventing a future write from reproducing it — is a requirement whose scope is blocked** until the deployed writer is known; do not trace local source for a defect that may not exist there. **The writer-agnostic monotonicity assertion carries the safeguard meanwhile.** The orphaned `Growth` package (created 69 minutes earlier, zero references anywhere) is **deleted and recreated**.

**This is the inverse of SB1's original framing.** SB1 feared turning the ceiling on removes too much. SB13 is the certainty that, as planned, it removes **nothing** — and for Free workspaces, *adds*.

**Mitigation:** stage **B0** — author per-tier package contents at child-key granularity, **before B1**. Note `backfillPackages.ts:148-155` skips packages that already have feature rows, so re-seeding cannot fix them; B0 needs an explicit delete-then-write path. **Add a permanent monotonicity test** — `granted(FREE) ⊂ granted(STARTER) ⊂ … ⊂ granted(AGENCY)` — which is exactly the assertion that would have caught today's state. See `07-paywall-coverage.md` §1.2 and `phases/phase-b-enforceable-matrix.md` B0.

### SB14 · Metered AI is bypassable by omitting a header
**Stage:** A4 *(scope extension)* · **Severity: high**
`src/api/routes/lyra.ts:64-73` leaves `workspaceId` undefined when `x-workspace-id` is absent. `:77` then skips `checkTokenBalance`, and the completion handler returns at `:138` before `consumeTokens`. **The LLM call still executes.** Any authenticated user gets unmetered AI on any tier.
**Compounding:** the Lyra mount has no `loadAuthorizationContext` (`router.ts:155`), so `req.authz` never exists there and the capability wall fails open (`requireCapability.ts:173-179`) — V4 sells Lyra per tier and that surface cannot enforce a tier at all.
**Mitigation:** extend A4 to bring the mount inside the wall and make metering unconditional — reject with 400 when no workspace resolves, rather than treating "no workspace" as "no charge". See `07-paywall-coverage.md` §2.1 and §3.3.

### SB12 · Frontend hardcodes drift silently
**Stage:** C1, D2 · **Severity: medium**
`api-docs-content.tsx:69-74` (full price table), `settings.tsx:640-644` (seat limits), `checkout.tsx:97` and `billings.tsx:525` (`?? 84` FX). None is server-driven. A backend-only reprice leaves three surfaces contradicting each other on the same login.
**Mitigation:** E3 before or with D2.

---

## Risk-to-stage matrix

| Stage | Data loss | Live money | Silent breakage |
|---|---|---|---|
| 0.9, 0.10 | — | LM7, LM8 | — |
| A1 | — | — | SB9 |
| A2 | — | — | SB9 |
| **A6** | — | **LM6** | — |
| A3 | DL2 *(3 workspaces — measured)* | — | — |
| B1 | DL4 *(2 rows — measured)* | — | **SB1** *(both directions)*, SB8 |
| **B0** | — | — | **SB13** *(the fix)* |
| B2a / B2b / **B2c** | — | — | **SB2**, SB11, **SB13** *(inert without B0)* |
| **F-a3** | — | — | SB2 |
| A4 | — | — | **SB14** |
| B4 | — | — | SB6 |
| B6 | — | — | SB7 |
| C1 | — | — | SB4 *(low)*, SB8, SB12 |
| C2 | **DL1** | — | — |
| C3 | — | LM3 *(medium)* | — |
| D1 | — | **LM4**, LM5, LM9 | — |
| D2 | — | **LM1**, LM2 *(medium)* | SB12 |
| D4 | — | LM10 | — |
| F-b1 | — | LM8 | — |
| F-b2 | — | LM10 | — |
| F-a2 | **DL3** | — | — |

## The three that would hurt most — revised on measured data

1. **SB1** — turning the ceiling on without a report-only pass. **Every paying customer is unpackaged**, so B1 flips all 4 at once with no partial rollout available. The safeguard is now cheap; there is no reason to skip it.
2. **LM4** — enabling INR checkout while three price sources disagree. Charges customers up to 166% more than advertised. **Unchanged by the measurements** — it is a risk to *future* buyers, and 3 of the 5 active subscriptions already run through Razorpay.
3. **SB13** — 📏 **the package ladder is inverted.** Free grants 140 features including all `api:*` and `team:*`; Business grants 94 and none of either. Route rules cannot deny what the package grants, so B2a/B2b/B2c are inert until **B0** authors the packages — and B1 run beforehand would *grant* 68 Free workspaces more than a paying Business customer holds. **This has displaced SB1 as the most dangerous moment in the plan**, because it is not a risk of something going wrong: it is the plan, as written, not working.

**Runner-up, and unchanged by any measurement:** **SB2** — the capability wall fails open on **three** paths: no rule match, no `req.authz`, and any thrown exception. With 119 of 125 keys ungated and the whole paywall about to be built on this mechanism, **a rule that silently does not match looks identical to a rule that works.** It is a code property, so no measurement can shrink it — and every stage in Phase B depends on it behaving.

**Dropped from this list:**
- **LM2 + LM3** — the Agency price rise and token reduction affect **3 named customers**. A commercial conversation, not a systemic risk.
- **SB3 + SB4** — **📏 measured at zero.** No workspace exceeds any proposed cap; SB3 is struck and SB4 is low.

**Nothing now resting on an unmeasured population remains in the top three.** The only open data item is **U8** (the provider price-object inventory), which needs a dashboard export rather than a query.

### What the measurements did *not* make safer

| Risk | Why it is untouched |
|---|---|
| **LM1** | 5 active subscriptions are attached to live provider objects. Mutating one still charges a real customer |
| **LM4**, LM5, LM9 | INR correctness is about future buyers, not the current 4 |
| **SB2** | The capability wall's three fail-open paths are a code property, not a population property |
| ~~**SB3**, **SB4**~~ | **📏 Now measured at zero.** SB3 struck; SB4 downgraded to low and deferred past C1 |
| **DL1** | The enum rename's reversibility does not depend on row counts |
| **LM7** | Stripe webhook retry loss is a code path; 2 of 5 active subscriptions are Stripe |
