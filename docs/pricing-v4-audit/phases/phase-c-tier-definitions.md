# Phase C — Tier Definitions

Config values and the Growth tier itself. **Config-value changes and new enforcement code are strictly separated** — C1 changes numbers only and adds no logic; every enforcement change lives in Phase B.

All stages are Backend-only.

> These stages are meaningless before Phase B. Changing `workflows` from 999 to 75 accomplishes nothing while **119 of 125** capability keys are ungated (📏 measured 2026-08-19) — and nothing at all while every package grants nearly every key (📏 Free: 140 features; Business: 94). **B0 first.**

---

## C1 · Limit VALUE changes — config only, no logic

| | |
|---|---|
| **Goal** | `billing.config.ts` carries the V4 numbers |
| **Repo** | Backend |
| **Files touched** | **One file only:** `src/config/billing.config.ts` — the `limits` blocks at `:62-71` (FREE), `:82-91` (STARTER), `:102-111` (PRO/Growth), `:122-131` (BUSINESS), `:142-151` (AGENCY) |
| **Config-only vs new code** | **CONFIG ONLY.** No logic, no new enforcement, no new keys. If a change requires code, it does not belong in this stage |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No — it is a source file, not data |
| **Dependencies** | **B0, B1, B2a, B2b, B2c** — the authored packages, the assigned ceiling and **all three** capability-gate stages must exist for these numbers to mean anything. Note **B4 depends on C1**, not the reverse |
| **Rollback** | Revert one file |
| **How to verify** | `resolveWorkspaceLimits` returns the new numbers per plan; `npm run typecheck` and `npm run test` clean |
| **Safe to ship independently** | **Yes.** 📏 The SB3 precondition is removed — zero workspaces exceed any proposed cap |

### Value changes

| Limit | Current F/S/PRO/B/A | V4 target F/S/G/B/A |
|---|---|---|
| `workflows` | 10 / 999 / 999 / 999 / 999 | 3 / 25 / 75 / 150 / 150 |
| `dmFollowUps` | 0 / 3 / 3 / 3 / 3 | 0 / 2 / 5 / 5 / 5 |
| `teamMembers` | 2 / 5 / 10 / 20 / 50 | 1 / 3 / 5 / 15 / 15 |
| `maxApiCredentials` | 0 / 2 / 5 / 10 / 50 | 0 / 0 / 0 / 10 / 10 |
| `apiRequestsPerDay` | 1 / 100 / 500 / 2000 / 10000 | 0 / 0 / 0 / 5000 / 5000 |
| `schedulerPostsPerDay` | 5 / 10 / 50 / 200 / 999999 | 3 / 30 / 100 / 200 / 200 |
| `automationsPerDay` | 5 / 5 / 25 / 100 / 999999 | 3 / 25 / 75 / 150 / 150 |
| `workspacesIncluded` | 1 / 1 / 1 / 1 / 999999 | 1 / 1 / 1 / 1 / 20 |

### ℹ️ Note 1 — this stage activates dormant code (explanatory, **not a risk**)

`planEnforcement.ts:74-92` short-circuits when `limit >= 999`:
```
if (limit >= 999) return;   // :76
```
Every paid plan currently sits at exactly 999 `workflows`, so **automation-count enforcement has never run for a paid customer.** Dropping Starter to 25 activates it for the first time. **The code path genuinely has never executed** — worth knowing during review, because a latent bug in it would surface here first and there is no production history to reassure you it works.

**It is no longer a customer risk.** See the measurement below.

> ### ✅ 📏 MEASURED 2026-08-19 — zero workspaces are over any proposed cap
>
> | Plan | Workspaces | Max automations | Over cap | Max seats | Over cap |
> |---|---:|---:|---:|---:|---:|
> | FREE | 69 | 1 | **0** | 1 | **0** |
> | STARTER | 1 | 0 | **0** | 1 | **0** |
> | BUSINESS | 1 | 6 | **0** | 1 | **0** |
> | AGENCY | 3 | 0 | **0** | 1 | **0** |
>
> **The busiest workspace on the platform holds 6 automations against a 150 limit. No workspace has more than one member** — the seat caps (1/3/5/15/15) bind on nobody.
>
> **The "verify before shipping" precondition is REMOVED from C1.** There is nothing to verify: the enforcement activates against an empty set.
>
> **`04-risks.md` SB3 is STRUCK. SB4 is downgraded high → LOW** and deferred past C1 — no downgrade reconciliation exists, but with no over-limit population it cannot land on anyone. It stays a real design gap for *future* customers who grow past a cap and then downgrade.

**Recommended test coverage instead.** Since the code path has no production history, cover it with unit tests rather than a pre-flight query: a workspace at the cap, one over it, and one at `>=999` confirming the short-circuit still behaves after the values drop below 999.

### ⚠️ Warning 2 — `workspacesIncluded` has no enforcement to activate

Setting Agency to 20 changes nothing until **A5** enforces it. Per Decision D10 the create-cap lives in A5, not in Track F — the old "F4" stage claiming this enforcement point has been removed (Correction P1).

**C1 carries the `billing.config.ts` half of the Agency grant; [`F-a1`](phase-f-agency.md) carries the `agency.ts` half** (`const included = 30` → 20, and removal of the dead `extraMeteredRate: 9`). Ship them together or the master dashboard and the resolved limit disagree. Together with A5, those three make the 20-workspace entitlement real — **no Track F-b stage is required for it.**

### Also reconcile here (config-only, same file)
- `highlights` contradict `limits` in the same objects: FREE `"1 workflow"` vs `workflows: 10` (`:60` vs `:63`); STARTER `"Unlimited workflows"` vs `999` (`:80` vs `:83`); AGENCY `"Unlimited workspaces"` / `"Unlimited API"` vs `999999` (`:140` vs `:146`). These strings are rendered directly by `Frontend/src/routes/_app/billings.tsx:402`.
- `teamEnabled: true` on FREE (`:72`) and `gates: { api: Plan.STARTER }` (`:73,93,113,133,153`) — **these belong to Phase B2b**, not here, because they are gates rather than values. Listed for cross-reference only.

---

## C2 · Introduce Growth

| | |
|---|---|
| **Goal** | A Growth tier exists end to end |
| **Repo** | Backend (Frontend follows in Phase E1) |
| **Files touched** | `src/entities/enums.ts:63-69` (`Plan`), `src/config/billing.config.ts:7` (`PLAN_ORDER`), `:95-114` (the PRO definition block), `:216-238` / `:244-266` (Stripe/Razorpay env SKU maps), `src/env.ts:104-130` (SKU env keys), `plan_catalog` rows, `ai_token_plan_configs` rows, `src/config/marketing.config.ts:66-76` (the PRO block, currently `showOnMarketingSite: false` with an empty feature list) |
| **Config-only vs new code** | New code + **migration** |
| **Migration required** | **Y** — Postgres enum change |
| **PREVIEW-ONLY** | **YES.** Preview the exact SQL before running |
| **Dependencies** | **C1**; Phase B for capabilities to attach to |
| **Rollback** | Reverse migration. **Destructive if implemented as a rename — see below** |
| **How to verify** | A Growth workspace resolves Growth limits, Growth AI tokens and the Growth capability set; no code path still references the retired name |
| **Safe to ship independently** | **No** |

### The key finding: `PRO` already is Growth's slot

`Plan` already has **five** members with `PRO` in the middle (`enums.ts:63-69`), and PRO is already priced at **exactly $29** (`billing.config.ts:101` — `monthlyUsdCents: 2900`), which is V4's Growth price to the dollar. V4 §26.8 itself recommends mapping PRO → Growth as "the cleanest deprecation available".

### Approach — **SETTLED (Decision D1): rename `PRO` → `GROWTH`**

`ALTER TYPE ... RENAME VALUE`. Price-preserving; existing PRO subscribers become Growth subscribers at the same $29; no dead enum member; `PLAN_ORDER` and `planRank` keep their ordering by construction.

**Accepted cost:** the rename is not cleanly reversible once new rows carry the new value. **Take a full dump before running, and preview the SQL.**

---

### 🔴 REQUIRED PRE-STEP — enumerate every stored `"PRO"` literal outside the enum

**Do not draft the migration SQL until this enumeration exists.**

A value rename touches **only the Postgres enum type**. Every other place the literal string `"PRO"` is persisted is untouched by it and must be handled separately. Produce the list first, then decide per category: migrate, dual-read, or accept historical residue.

| # | Category | What to enumerate | Notes |
|---|---|---|---|
| 1 | **Provider SKU env key NAMES** | `STRIPE_PRICE_PRO_MONTHLY` / `_QUARTERLY` / `_YEARLY`; `RAZORPAY_PLAN_PRO_MONTHLY` / `_QUARTERLY` / `_YEARLY` | Referenced at `src/config/billing.config.ts:223-227` and `:251-255`; declared `src/env.ts:104-130`. **A DB enum rename does not rename an env var.** Also update the deployment environment, not just the code |
| 2 | **Provider price metadata** | `notes.liffio_plan_key` on Razorpay plan objects (`scripts/setupRazorpayPlans.ts:57-62`); any Stripe price/product metadata carrying the plan literal | These live outside the repo. Enumerate from the provider dashboards |
| 3 | **Stored webhook payloads** | Raw event bodies persisted by `recordEvent` (`src/api/webhooks/stripe.ts:151-158`) and `src/api/webhooks/razorpay.ts:101` | Carry `metadata.plan` / `notes.plan` as **text**. Historical rows cannot be meaningfully rewritten — they are a record of what the provider sent |
| 4 | **`plan_catalog` rows** | One row per plan literal | Upserted by `planCatalogService.ensureSeeded` (`src/services/planCatalog.ts:45-83`). Note its `orUpdate` list omits `max_team_members` / `max_automations` / `max_workspaces` (`:73-80`) |
| 5 | **`ai_token_plan_configs` rows** | One row per plan | Seeded `src/db/migrations/1783500000000-AddAiTokenMetering.ts:54-61`. Must be renamed in lockstep or C3 writes to a row that no longer matches |
| 6 | **`feature_overrides` rows** | Keyed via `PLAN_TO_FEATURE_KEY` (`src/api/middleware/planGate.ts:7-10`) | That map contains only `STARTER: "api"` and `AGENCY: "agency"` — **PRO is not mapped**. Verify against live rows rather than assuming none exist |
| 7 | **Admin audit rows** | Plan literals in `audit_logs` written by `src/services/adminBillingMutations.ts` and `src/services/adminWorkspaceMutations.ts` | Historical rows are immutable by design and **will retain `"PRO"`**. Recommend accepting residue and documenting it, not rewriting an audit trail |
| 8 | **`packages` rows** | `key = plan.toLowerCase()` → `pro`; `humanId` → `pkg-pro` | `src/db/seeds/backfillPackages.ts:66,132`. Also `package_prices` / `package_limits` rows joined to it |

**Recommended split:** migrate categories 1, 2, 4, 5, 8 (live configuration); accept residue in 3 and 7 (historical records); verify-then-decide 6.

**Verification for the pre-step:** a repo-wide search for the literal must return only intentional residue —
`grep -rn '"PRO"\|'"'"'PRO'"'"'\|_PRO_\|pkg-pro\|plan=PRO' Backend/src Backend/scripts`

---

### Blast radius of the rename itself
`PLAN_ORDER` drives `planRank` → `planMeetsMinimum` → `requirePlan` (`src/api/middleware/planGate.ts:20`) and the Frontend's upgrade-vs-downgrade decision (`billings.tsx:74,366-368`). Any ordering mistake silently inverts upgrade buttons. Frontend literals are handled separately in Phase E1 (8 files).

---

## C3 · AI token allocations and rollover

| | |
|---|---|
| **Goal** | V4's per-tier token allowances, and Agency capped rather than unlimited |
| **Repo** | Backend |
| **Files touched** | **No source files.** Data only: the `ai_token_plan_configs` table (entity `src/entities/ai/AiTokenPlanConfig.entity.ts:13,18,19,20`; seeded by `src/db/migrations/1783500000000-AddAiTokenMetering.ts:54-61`). Admin-editable via `src/api/routes/adminAiTokens.ts:43,66` |
| **Config-only vs new code** | **Data only** — pure UPDATEs, no code |
| **Migration required** | **N** (UPDATE statements, not schema) |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **C2** if the Growth row is keyed by a renamed plan |
| **Rollback** | Restore prior values — capture them first |
| **How to verify** | `getTokenBalance` reports the new allowance per plan; an Agency workspace is now metered rather than unlimited |
| **Safe to ship independently** | **Yes** |

### Value changes

| Plan | Current | V4 target |
|---|---:|---:|
| FREE | 1,000 | 1,000 (no change) |
| STARTER | 5,000 | **10,000** |
| PRO/Growth | 20,000 | **30,000** |
| BUSINESS | 75,000 | 75,000 (no change) |
| **AGENCY** | **-1 (unlimited)** | **75,000** |
| Business rollover | off, cap null | **on, cap 25,000** |
| Agency rollover | off, cap null | **on, cap 25,000** |

### ⚠️ Agency is the sharp edge
Agency moves from **unlimited to 75,000/month**. That is a capability reduction for every existing Agency customer, landing at the same time Phase D2 raises their price. See `04-risks.md` LM3.

### Note on rollover semantics
`aiTokenService.ts:453-455`: `rollover = rolloverEnabled ? Math.min(priorRemaining, rolloverCapTokens ?? priorRemaining) : 0`. **A null cap means uncapped rollover once enabled.** Setting `rolloverEnabled = true` without setting `rolloverCapTokens = 25000` gives unlimited rollover. Both columns must be written together.

---

## Phase C shipping order

Dependencies are stated at **stage** granularity, never phase granularity — Correction P4.

```
B0 · B1 · B2a · B2b · B2c ──▶ C1 ──▶ C2 ──▶ C3
                    │             │
                    ├──▶ B4       └──▶ (C2 also feeds) E1  Frontend rename
                    ├──▶ E7 (remainder)
                    └──▶ F-a1 pairs here (Agency workspacesIncluded = 20)
```

**The previous "Phase B ──▶ C1" was wrong, and it read as circular against phase-b's "C1 ──▶ B4".** Both edges are real; neither is a phase-level edge:

| Edge | Truth |
|---|---|
| **C1 depends on B0, B1, B2a, B2b, B2c** | The authored packages (B0), the assigned ceiling (B1) and **all three** gate stages must exist for a limit value to mean anything. 📏 Without B0 the packages are inverted — Free grants more than Business |
| **B4 depends on C1** | B4 enforces daily caps on internal routes; shipping it before C1 enforces today's values (Starter `automationsPerDay: 5`, identical to Free) |
| **C1 does *not* depend on B4, B5, B6, B7** | Those are independent of the limit values |
| **C2's "Growth" package collision is resolved by B0** | 📏 The half-configured `Growth` package (1 feature) is **orphaned** — zero rows in `workspace_packages`, `package_prices`, `package_limits`, `package_products`. **B0 deletes it and recreates it** under authored contents, so the `PRO → GROWTH` rename creates a clean package with no collision. **Sequence: B0 → C2.** *(Package-key derivation is cited from local source; confirm against the deployed release before running C2.)* |

No stage depends on itself. The apparent cycle was an artefact of naming whole phases as dependency nodes.

| Stage | Config vs code | Migration | PREVIEW-ONLY | Independent | Depends on |
|---|---|---|---|---|---|
| C1 | **Config only** | N | No | Yes — 📏 activates dormant enforcement against **zero** affected workspaces | B0, B1, B2a, B2b, B2c |
| C2 | Code + migration | **Y** | **YES** | No | C1 · *pre-step first* |
| C3 | **Data only** | N | **YES** | Yes | C2 (if the Growth row is keyed by the renamed plan) |

**Separation held:** C1 changes numbers and nothing else. C3 changes data and nothing else. C2 is the only stage in this phase carrying code.
