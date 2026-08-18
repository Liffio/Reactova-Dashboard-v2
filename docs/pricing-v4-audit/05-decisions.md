# 05 — Decisions

## Status: ALL TEN SETTLED

**Production was measured on 2026-08-19** by read-only SELECT. D3, D7 and D9 — the three that were blocked pending data — are now settled on measured figures, not estimates.

**No decision in this file is open. No stage is blocked on a decision.**

| Was blocked | Settled by | Outcome |
|---|---|---|
| **D3** — existing Business/Agency subscribers | 7 subscription rows; **4 active paying workspaces** | **Reprice directly.** No migration programme |
| **D7** — external API hardening | **0 active API credentials, 0 ever used** | **A4 ships with immediate enforcement.** SB5 struck |
| **D9** — capability coverage | `capability_routes` = 8 rows / 6 capabilities; `child_modules` = 125 | **The seed IS the live state.** Coverage numbers are now measured |

Stages unblocked by this file: **C2** (D1) · **D1** (D4, D5) · **D5** (D6) · **B1** (D8) · **all of Track F** (D10) · **D2** (D3) · **A4** (D7).

**Nothing is blocked on a decision.** Two *supporting* data items remain open — neither gates a decision; see the table at the end.

---

## D1 · Growth = rename `PRO` → `GROWTH` — **SETTLED (Option A)**

**Decision.** Rename the existing enum member. `PRO` already occupies the middle slot at exactly $29 (`src/entities/enums.ts:66`, `src/config/billing.config.ts:101`), so the rename is price-preserving and leaves no dead member. `PLAN_ORDER` and `planRank` keep their ordering by construction.

**Accepted cost.** `ALTER TYPE ... RENAME VALUE` is not cleanly reversible once new rows carry the new value. Take a full dump first and preview the SQL.

### Required pre-step before any SQL is drafted

**A value rename touches only the Postgres enum type. Every other place the literal string `"PRO"` is stored is untouched and must be migrated separately.** Enumerate all of them first — the migration must not be drafted until this list exists:

| Category | What to enumerate |
|---|---|
| **Provider SKU key names** | `STRIPE_PRICE_PRO_MONTHLY` / `_QUARTERLY` / `_YEARLY` and `RAZORPAY_PLAN_PRO_*` — the env **key names** themselves (`src/config/billing.config.ts:223-227`, `:251-255`; declared `src/env.ts:104-130`). A DB enum rename does not rename an env var |
| **Provider price metadata** | Any `notes.liffio_plan_key` on Razorpay plan objects (`scripts/setupRazorpayPlans.ts:57-62`) and any Stripe price/product metadata carrying the plan literal |
| **Stored webhook payloads** | Raw event bodies persisted at `src/api/webhooks/stripe.ts:151-158` and `src/api/webhooks/razorpay.ts:101` — these carry `metadata.plan` / `notes.plan` as text |
| **`plan_catalog` rows** | Keyed by plan literal; upserted by `planCatalogService.ensureSeeded` (`src/services/planCatalog.ts:45-83`) |
| **`ai_token_plan_configs` rows** | One row per plan (`src/db/migrations/1783500000000-AddAiTokenMetering.ts:54-61`) |
| **`feature_overrides` rows** | Keyed via `PLAN_TO_FEATURE_KEY` (`src/api/middleware/planGate.ts:7-10`) — note PRO is **not** currently mapped, so verify rather than assume |
| **Admin audit rows** | Plan literals recorded in `audit_logs` by the admin control plane (`src/services/adminBillingMutations.ts`, `src/services/adminWorkspaceMutations.ts`) — historical rows are immutable and will retain `"PRO"` |
| **`packages` rows** | Seeded with `key = plan.toLowerCase()` → `pro`, humanId `pkg-pro` (`src/db/seeds/backfillPackages.ts:66,132`) |

**Recorded as a required pre-step in [`phases/phase-c-tier-definitions.md`](phases/phase-c-tier-definitions.md) C2.**

Decide per category whether to migrate, dual-read, or accept historical residue. Audit rows are the clearest case for accepting residue; SKU key names are the clearest case for migrating.

---

## D2 · Keep V4's absolute price targets — **SETTLED**

**Decision.** Ship V4's numbers as written:

| Plan | Global | India |
|---|---:|---:|
| Free | $0 | ₹0 |
| Starter — launch | **$9** | **₹499** |
| Starter — standard | $15 | ₹799 |
| Growth | **$29** | **₹1,499** |
| Business | **$59** | **₹2,499** |
| Agency | **$549** | **₹22,999** |

**Rationale.** These anchor to competitors, not to our configured baseline. Growth at $29 is exactly ManyChat Pro; Business at $59 undercuts ManyChat Business ($69, AI extra) by 14%. The targets are therefore unaffected by the baseline error.

**Discarded.** The revenue reasoning in V4 §2.4, §19 and §28 argues from a V3 baseline of Business $49 / Agency $449 — **neither is in the codebase** (configured: $79 / $299). Every ARPU percentage, the §19.1 sensitivity table and the §19.2 cannibalisation analysis derive from that wrong baseline and are discarded. The *ladder-shape* argument (1.93× then 2.03×) depends only on the target prices and survives.

**Recorded in [`06-doc-corrections.md`](06-doc-corrections.md) §1.**

---

## D3 · Existing Business / Agency subscribers — **SETTLED on measured data**

**📏 MEASURED 2026-08-19 — `workspace_subscriptions`, 7 rows in total:**

| Plan | Status | Count | Provider / interval |
|---|---|---:|---|
| AGENCY | ACTIVE | **3** | 2 Stripe monthly, 1 Razorpay monthly |
| BUSINESS | ACTIVE | **1** | Razorpay, yearly |
| STARTER | ACTIVE | **1** | Razorpay, yearly |
| BUSINESS | CANCELED | 2 | Stripe, monthly |

**5 active subscriptions · 4 active paying workspaces.**

**Decision: reprice directly. No migration programme.**

| Plan | From | To | Handling |
|---|---:|---:|---|
| BUSINESS | $79 | **$59** | Reprice. Notify the one active customer |
| AGENCY | $299 | **$549** | Reprice. Notify the three active customers individually |

**The opposite-handling rule is withdrawn.** "Migrate Business down / grandfather Agency at $299" was designed for a population large enough that per-customer handling was impractical. At **n=4** it is not. Four emails and four conversations replace a migration programme, and each customer can be handled on its merits rather than by policy.

**Consequences recorded elsewhere:**
- **LM2 downgraded** critical → medium; **LM3** high → medium (`04-risks.md`). The 84% Agency rise plus C3's AI-token reduction is a conversation with **3 customers**, not a churn event.
- **Stage D2 is unblocked.** It still depends on C2 and D1 as stages.

> **📏 Also measured: only 1 of the 7 subscription rows carries a `package_price_id` pin.**
>
> The grandfathering primitive exists and works, but it is **pinning exactly one row today — it is not load-bearing yet.** That cuts both ways:
> - It cannot be relied on to hold the current cohort at old prices, because 6 of 7 rows are not pinned.
> - **The risk of getting D6's cohort marker wrong right now is near zero.** There is almost nothing to break. Build it while that is still true — see D6.

---

## D4 · INR source of truth = explicit per-plan price sheet — **SETTLED**

**Decision.** An explicit per-plan INR price sheet with literal values from V4 §3. **No FX derivation anywhere.**

| Plan | Monthly | Yearly |
|---|---:|---:|
| Free | ₹0 | ₹0 |
| Starter — launch | **₹499** | **₹4,999** |
| Starter — standard | **₹799** | **₹7,999** |
| Growth | **₹1,499** | **₹14,999** |
| Business | **₹2,499** | **₹24,999** |
| Agency | **₹22,999** | **₹2,29,999** |

**Required changes:**
- **Delete the `usdCents × 84` path** — `usdToInrRate` (`src/config/billing.config.ts:184`) and its application at `scripts/setupRazorpayPlans.ts:52`.
- **Reconcile `packages.monthly_price_inr_paise` to the same literals** so all three lineages converge — the third lineage is `src/db/seeds/backfillPackagePrices.ts:150-151`, which links Razorpay `package_prices` from that column rather than from the rate.
- **Remove the "₹49 first month" string** (`src/config/marketing.config.ts:54-55`). It is advertised with no implementation in any checkout path.
- Remove the `?? 84` frontend fallbacks (`Frontend/src/routes/checkout.tsx:97`, `src/routes/_app/billings.tsx:525`).

**The code already anticipated this.** `src/config/billing.config.ts:181-183`: *"Replace with a real INR price sheet if INR pricing ever diverges from a straight conversion."* It has diverged — currently by up to **+166%** on Business (₹2,499 advertised vs ₹6,636 charged). Act on it.

**Recorded in [`phases/phase-d-checkout.md`](phases/phase-d-checkout.md) D1.**

---

## D5 · Ship INR, with country + state capture as a hard requirement — **SETTLED**

**Decision.** INR ships. Prices stay **exclusive of GST**. Customer **country and state capture at checkout is a hard requirement inside stage D1** — not deferred to a later stage.

**Rationale.** Place of supply determines IGST vs CGST/SGST. B2B customers cannot claim input tax credit without a compliant invoice. Capturing the data late means the early cohort's invoices can never be reconstructed correctly.

**In scope for D1:**
- Persist customer country **and state** against the subscription. Today `User.country` is read at `src/api/routes/billing.ts:98,111,115` and **discarded**; state is not captured at all.
- Surface both on `BillingInvoice` (`src/entities/billing/BillingInvoice.entity.ts` — currently has no tax, place-of-supply or GSTIN field; `upsertInvoice` at `src/services/billingSubscription.ts:253-304`).

**Out of scope — flag, do not implement:**
- GST rate calculation
- Filing logic
- GSTIN validation and B2B/B2C determination

**Anything beyond capture gets flagged for a tax specialist rather than guessed.** This audit cannot advise on Indian tax obligations; it can only record that the system currently cannot produce a compliant invoice.

---

## D6 · Launch price-lock — minimum viable now, mechanics later — **SETTLED**

**BUILD now:** a flag or timestamp on the subscription marking **GA-window cohort membership**, so the founding cohort is recoverable later. Reuse `package_prices.is_current` + `packagePriceId` pinning (`src/services/billing/packageCheckout.ts:232-235`) — that half already works and holds a subscriber at the price they bought. **Do not rebuild it.**

> **📏 MEASURED 2026-08-19: exactly 1 of 7 subscription rows carries a `package_price_id` pin.**
>
> **The pinning primitive is not load-bearing yet.** Two things follow:
> - **Do not assume it protects the current cohort.** Six of seven rows are unpinned, so "founding subscribers keep $9 because pinning exists" is true of the mechanism, not of today's rows.
> - **Build the cohort marker now, while the cost of getting it wrong is near zero.** There is almost nothing in production to migrate or corrupt. Every month of delay adds rows that a later marker has to be backfilled against.

**DO NOT BUILD now:** the 12-month upgrade-restoration rule from V4 §17 — the "trying Growth doesn't cost you the lock" mechanic.

**Consequence — mandatory.** The restoration promise must come **out of the HTML** until it ships. Affected lines in `liffio-pricing-v4.html`:
- `:372` — *"Trying Growth doesn't cost you the lock — it's suspended, not lost."*
- `:377` — *"If you upgrade → Lock suspended; come back to Starter within 12 months and it's restored"*

Founding subscribers still keep $9 regardless, because the pinning half exists. Only the upgrade-and-return path is unsupported. **Recorded in [`06-doc-corrections.md`](06-doc-corrections.md) §11.**

---

## D7 · External API hardening — **SETTLED: IMMEDIATE ENFORCEMENT**

**📏 MEASURED 2026-08-19 — `api_credentials`: 0 active, 0 ever used.** `last_used_at` is null across the board.

**Decision: A4 ships with immediate enforcement.**

| | |
|---|---|
| Deprecation window | **None** |
| Log-only phase | **None** |
| Customer comms | **None** |

The agreed rule was "effectively unused → immediate enforcement." The measurement is not merely *effectively* unused — the table is **empty**, and no key has ever been used.

**The D7 gate is removed from stage A4 entirely. A4 is no longer blocked on anything.**

**SB5 is STRUCK** (`04-risks.md`) — "Phase A4 breaks every existing API key holder" is conditional on there being key holders. There are none. It is also removed from the risk-to-stage matrix.

**The hole is still real and still worth closing.** `/api/v1/external` has no RBAC (`src/api/router.ts:157`; zero `req.authz` across 791 lines of `src/api/routes/externalApi.ts`), and a VIEWER-scoped key can hard-delete automations, cascading to DM jobs, follow-ups and leads. Nothing has exploited it because nothing has ever held a key. **Fix it before the first key is issued** — that is now a free change, and it stops being free the moment someone creates one.

**Knock-on: stage 0.5 can ship freely.** `maxApiCredentials` is counted per-user rather than per-workspace (`apiCredentials.ts:87-89`). The caveat on 0.5 was that fixing it **loosens** a limit for multi-workspace users. With **zero credentials in existence**, that concern is theoretical — there is no one to loosen a limit for. 0.5 no longer needs to be paired with C1's value changes.

---

## D8 · Report-only pass before B1 writes — **SETTLED: YES, NON-NEGOTIABLE**

**Decision.** B1 runs in report-only mode first. A **per-workspace capability-removal diff is written to a reviewable file and read before a single row is written.**

**Required output columns:** `workspace_id` · `plan` · current package · would-be package · **the exact set of capabilities that would be removed**.

**Why non-negotiable.** `applyEntitlement` returns permissions untouched when no package is assigned (`src/services/entitlement.ts:207`), and **119 of 125** capability keys have no gate site. Every existing customer currently holds every capability their RBAC role grants. B1 plus B2 turns a fail-open system fail-closed **in one deploy**.

**📏 MEASURED 2026-08-19 — the estimate was wrong in both directions.** `entitlement.ts:15-17` claimed 35–45 unpackaged workspaces. The real figure is **72 of 74 live workspaces** (only 2 `workspace_packages` rows exist platform-wide).

| | Measured |
|---|---|
| Scope of the inert ceiling | **Wider** — 97% of live workspaces, not ~50% |
| Cost of the report-only pass | **Smaller** — 4 paying workspaces to review |
| Paying customers affected by B1 | **All of them.** Every one of the 4 is unpackaged |

**B1 flips the ceiling for 100% of paying customers at once.** There is no partial rollout and no already-packaged cohort to learn from — which is exactly why the report-only pass stays mandatory even though it is now cheap. See `04-risks.md` SB1.

---

## D9 · Capability coverage — **SETTLED: the seed IS the live state**

**📏 MEASURED 2026-08-19:**

| | Measured | Seed / snapshot said |
|---|---:|---|
| `capability_routes` rows | **8**, all enabled | 8 |
| Distinct capabilities covered | **6** | 5 |
| `child_modules` rows | **125** | 121 (codegen snapshot) |

**Nothing was added by operators or plugins.** The concern that Superadmin → Module Registry or plugin activation had seeded additional rows is resolved: they had not. **The seed is the live state.**

**Consequences — the "floor" framing is withdrawn:**

- **Every "seed-derived, unverified against live" caveat is REMOVED** from `01-capability-map.md` and `02-gaps.md`. The coverage numbers are restated as **measured**.
- **Reconcile against 125 `child_modules`, not the 121 in the codegen snapshot.** The snapshot is **4 keys stale**. Coverage is therefore **119 of 125 ungated**, not 116 of 121.
- **6 capabilities are covered, not 5** — one more than the snapshot implied.
- **The staleness is itself a finding.** `npm run capability-routes:codegen:check` is expected to be clean for `capability_routes`, but the module codegen has drifted by 4 keys. **Noted in stage B3**, which already runs `npm run modules:codegen` and reconciles the count discrepancy (`capabilityReconciler.ts:11` says 125; `generated/modules.ts:247-372` lists 121 — the DB is right and the snapshot is stale).

**The number got slightly worse, and it is now certain.** 119 ungated of 125 rather than 116 of 121 — the direction everyone hoped for (live coverage better than seed) did not materialise.

---

## D10 · Track F — **SETTLED: SPLIT INTO F-a AND F-b**

**Decision.** The Agency work is two independent problems that were wrongly treated as one. The 20-workspace *entitlement* is not architecturally blocked; only the *single-subscription billing* is.

### F-a — the 20-workspace GRANT. **Not architecturally blocked.**

A config value plus a create-cap:
- **C1** — `AGENCY.workspacesIncluded` `999999` → **20** (`src/config/billing.config.ts:146`)
- **F-a1** *(formerly F0)* — reconcile `src/api/routes/agency.ts:108` (`const included = 30`) → **20**; treat `extraMeteredRate: 9` (`:122`) as **dead copy and remove it** (V4 §9 explicitly excludes metered overage beyond 20)
- **A5** — the enforcement point (the `workspaces.ts` create handler)

Agency customers get **all 20 slots available at purchase**. Workspaces are created **on demand against the cap**. **Do not create 20 empty rows** — twenty empty shells would each need naming, Instagram connection and configuration, and would pollute every workspace switcher.

> **Slot RELEASE depends on A3** (`deletedAt` filtering). That dependency is named explicitly in **F-a2**, the stage that owns release — not buried inside the old F3. Without A3, a "released" workspace remains fully usable via `x-workspace-id` and the slot is not really free.

### F-b — parent subscription + fan-out. **This is what blocks self-serve Agency checkout.**

Old F1, F2 and F5, renumbered **F-b1 / F-b2 / F-b3**. Stays gated behind Phase A as written. The blocker is that one provider subscription cannot back 20 workspace *subscription rows* (`providerSubscriptionId` UNIQUE, `src/entities/billing/WorkspaceSubscription.entity.ts:24`), and payment-state fan-out to 20 children does not exist.

### Stage renumbering

| Old | New | Note |
|---|---|---|
| F0 | **F-a1** | `extraMeteredRate` now explicitly removed, not "decided" |
| F3 (release half) | **F-a2** | The create half moved to **A5** |
| **F4** | *(removed)* | Duplicated A5's file and A5's limit key — see Correction P1 |
| F1 / F2 / F5 | **F-b1 / F-b2 / F-b3** | Unchanged in substance |

### Corrected statement

**Wrong:** *"'20 workspaces' Agency — architecturally impossible."*

**Accurate:** one provider subscription backing 20 workspace entitlements is blocked by the `providerSubscriptionId` UNIQUE constraint, and payment-state fan-out to 20 children does not exist. **The 20-workspace entitlement itself is a config change.**

**Recorded in [`02-gaps.md`](02-gaps.md), [`03-plan.md`](03-plan.md) and [`phases/phase-f-agency.md`](phases/phase-f-agency.md).**

---

## Data status — measured 2026-08-19

**No decision is blocked. Nothing in this file is waiting on a query.**

### Settled by measurement

| Item | Question | Measured answer | Effect |
|---|---|---|---|
| **D3** | Active subscriptions by plan and by provider price object | 7 rows; 5 active; **4 paying workspaces**; 1 row pinned | Reprice directly; LM2/LM3 downgraded |
| **D7** | Active API credentials by plan and last-used | **0 active, 0 ever used** | A4 immediate; **SB5 struck** |
| **D9** | `capability_routes` and `child_modules` | **8 rows / 6 capabilities**; **125** modules | Seed = live; coverage is **119 of 125** |
| **U2** | Workspaces with no `workspace_packages` row | **72 of 74** (2 package rows total) | SB1 restated — wider, but only 4 paying |
| **DL2** | Soft-deleted workspaces | **3** | A3 needs a 3-row check, not an open investigation |

| **SB3** | Workspaces exceeding each proposed new limit | **0 on every plan, every limit.** Busiest workspace: 6 automations vs a 150 cap; no workspace has >1 member | **SB3 struck**; SB4 downgraded to low; C1's verify-before-shipping precondition removed |

### Still open — one item, and it is not a database question

| Item | What it needs | Informs | Why it is still open |
|---|---|---|---|
| **U8** | Live Stripe/Razorpay price objects | Precise planning of D2 | Needs a **provider dashboard export**, not a DB query. The 5 active subscriptions point at objects whose ids are not recorded in the DB in a usable form |

**U8 is the only remaining data item in the entire audit.** Every database question has been answered.

> **U5** (analytics-sync eligible workspace count) is effectively answered as an upper bound: at most **74** live workspaces are sweepable, against ~101 Graph calls each. It is no longer a planning unknown, though the actual eligible subset — filtered on Instagram permission and active account — has not been counted.

### 🧭 What the full measurement set means

Every measured blast radius came back at or near **zero**: 4 paying workspaces · 0 API credentials · 0 over-limit workspaces · 8 capability rules · 2 package rows · 3 soft-deleted workspaces.

**This is a pre-launch build, not a live-system migration.** Decisions in this file that were framed as trade-offs against an installed base — grandfathering, deprecation windows, staged rollouts, migration programmes — were answering a question that production does not pose. Where they have been withdrawn (D3's opposite-handling rule, D7's deprecation window, SB3's precondition), it is because there is nobody on the other side of them.

**What this does not change:** every correctness gap is still a correctness gap, and closing them is cheaper now than it will ever be again.

**Everything above is read-only.** Production was measured on **2026-08-19**; no writes were made by this audit at any point.

---

---

## Plan corrections applied alongside these decisions

Eight structural corrections were made to the plan at the same time. They are recorded here so the decision set and the stage index cannot drift apart.

| # | Correction | Where it landed |
|---|---|---|
| **P1** | **A5 and F4 overlapped** — same file (`workspaces.ts` create handler), same limit key (`workspacesIncluded`). **F4 removed**; A5 owns the create-cap for every plan. Track F contributes slot *release* semantics instead, renamed **F-a2** | `phase-a-correctness.md` A5 · `phase-f-agency.md` · `03-plan.md` |
| **P2** | **LM6 had no stage.** Razorpay grants entitlement before payment settles (`packageCheckout.ts:199-205`) — an abandoned checkout leaves a permanent grant. Now **stage A6**, with its own goal, files, rollback and verification. "Fold into A1 or B1" was not an assignment; A1's path never fires for an abandoned checkout | `phase-a-correctness.md` A6 |
| **P3** | **B5 collides with Jira epic LF-66** (DM engine rewrite). Conflicting files: `src/services/dm.ts`, `src/queue/jobs/sendDm.ts`. **B5 sequenced after LF-66 lands** | `phase-b-enforceable-matrix.md` B5 |
| **P4** | **Circular dependency in the prose.** Stated at stage granularity: **C1 depends on B1/B2a/B2b; B4 depends on C1.** Both shipping diagrams fixed | `phase-b-…` · `phase-c-…` · `03-plan.md` |
| **P5** | **phase-a's diagram showed A3 feeding A1.** It does not — **A2 → A1** is the real edge; A3 is independent | `phase-a-correctness.md` |
| **P6** | **Three E7 rows were live false claims, not V4 drift** — promoted to Phase 0 as **0.11** (50,000 DMs/month), **0.12** (per-plan IG account limits), **0.13** (Business "5 seats" vs 20). The rest of E7 stays behind C1 | `phase-0-live-bugs.md` · `phase-e-frontend.md` · `02-gaps.md` |
| **P7** | **Broken cross-references.** Every phase file cited `04-risks.md` with R-numbers that do not exist in it (that file uses DL/LM/SB). Repointed: B1 R1→**SB1** · B4 R6→**SB6** · B6 R6→**SB7** · C1 R7→**SB3/SB4** · C3 R4→**LM3** · A3 R5→**DL2**. G-numbers in phase-b's summary verified: G31→B4 ✅, G32→B6 ✅ | all phase files |
| **P8** | **03-plan.md's rollup was wrong.** Claimed 41; tables summed 44. Recounted and deduplicated: **47 rows, 45 unique stages** (E2 and E4 are pointers to 0.1/0.2 and 0.3). "Blocked on an open decision" corrected from **5 → 2**, both blocked on data | `03-plan.md` |

> **Note on R-numbers.** `00-findings.md` does use R1–R9 — for *refuted doc claims*, not risks. The phase files were citing risk IDs that never existed. The two schemes are unrelated and both are now correct.

---

## What can start now

**Phase 0 and Phase A (except A4) need no further input.** Phase A is entirely code-only — no migrations, no DB writes — and now includes **A6**.

**Newly unblocked by this file:** C2 (pre-step first), D1, D5 (reduced scope), B1 (report-only first), all of Track F-a, **A4** (D7 settled — immediate enforcement) and stage **D2** (D3 settled — reprice directly).

**Nothing is blocked on a decision or on data.** The only remaining external block is **B5**, on Jira epic **LF-66**.

### Resequencing opened up by the measurements

| Change | Why |
|---|---|
| **A4 moves up** — it can ship with A1/A2/A3 rather than waiting | Zero API credentials means zero blast radius. It was the only Phase A stage with a gate |
| **B2b loses its awkward dependency** | B2b needed A4 for the external-API surface. A4 is now schedulable immediately, so B2b is gated only on B1 |
| **0.5 detaches from C1** | The "loosens a limit" caveat is void with zero credentials |
| **B1's report-only pass shrinks** | 4 paying workspaces to review, not a fleet — the safeguard costs minutes |
| ~~SB3 becomes the critical unknown~~ | **📏 Subsequently measured at zero** — no workspace exceeds any proposed automation or seat cap. SB3 struck; SB4 downgraded to low and deferred past C1 |

See [`03-plan.md`](03-plan.md) and [`phases/phase-a-correctness.md`](phases/phase-a-correctness.md) for the revised ordering.
