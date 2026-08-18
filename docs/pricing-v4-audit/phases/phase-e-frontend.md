# Phase E — Frontend

Last, by design. The frontend must not advertise a tier the backend cannot enforce.

All stages are Frontend-only. **No stage in this phase requires a migration or a DB write.**

> Exception: **E2 and E4 ship in Phase 0**, not here — `checkout.tsx` and the Agency nav are mis-selling customers today, independent of V4. They are repeated here only for completeness and are **not** counted as separate stages in the [`03-plan.md`](../03-plan.md) rollup.
>
> Three further `checkout.tsx` claims were **promoted out of E7 into Phase 0** as stages 0.11–0.13 (Correction P6). They are false against the current backend, not stale against V4.

---

## E1 · Plan literal rename

| | |
|---|---|
| **Goal** | The frontend knows about Growth |
| **Repo** | Frontend |
| **Files touched** | 8 files carrying the `"FREE" \| "STARTER" \| "PRO" \| "BUSINESS" \| "AGENCY"` union — `src/lib/api/admin-creator-eligibility-api.ts:290`, `src/lib/api/admin-dashboard-api.ts:16`, `src/lib/api/admin-workspaces-api.ts:247` (`BILLING_PLANS` — admin override dropdown), `src/lib/api/analytics-api.ts:10,42`, `src/lib/api/workspaces-api.ts:20`, `src/routes/checkout.tsx:38-42,53,61,82,212`, `src/routes/_app/admin.users.index.tsx:113` (`PLAN_VALUES`), `src/routes/_app/rbac-master.tsx:305,343`. Plus: `src/routes/_app/billings.tsx:74` (`planOrder`), `src/state/app-context.tsx:82-92` (`mapPlan()` display names), `src/components/admin/dashboard/plan-donut-card.tsx:12-16` (chart hues), `src/routes/_app/admin.creator-management.$profileId.tsx:90`, `src/routes/_app/admin.users.$userId.billing.tsx:307,313` (defaults to PRO) |
| **Config-only vs new code** | New code — mechanical |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **C2** must land first. Also **B3** — `npm run modules:codegen` writes the Frontend's `src/generated/modules.ts` (`Backend/src/db/seeds/runModuleCodegen.ts:15-16`), so regenerate rather than hand-edit |
| **Rollback** | Revert commit |
| **How to verify** | `tsc` clean; a Growth workspace renders as Growth everywhere; admin dropdowns list Growth |
| **Safe to ship independently** | **No — must follow C2** |

### ⚠️ `billings.tsx:74` is load-bearing
`planOrder` drives card sort (`:260-262`), current-plan index (`:264`), and the **upgrade-vs-downgrade decision** (`:366-368`) which sets the button label and disabled state (`:417-427`). Getting the order wrong silently inverts upgrade buttons. It must match `PLAN_ORDER` in `Backend/src/config/billing.config.ts:7`.

---

## E2 · Fix `checkout.tsx` — **ship in Phase 0**

| | |
|---|---|
| **Goal** | Checkout shows the plan the customer actually selected, at the price they will actually pay |
| **Repo** | Frontend |
| **Files touched** | `src/routes/checkout.tsx:31-33` (`validateSearch` accepts any string), `:38-42` (`PLAN_LABELS` — no FREE/STARTER), `:44-69` (`PLAN_HIGHLIGHTS` — no FREE/STARTER), `:82` (defaults to PRO), `:151-166` (`usdForInterval` / `priceDisplay` — yearly total suffixed `/mo`), `:97` (`?? 84` FX fallback), `:212-213`, `:232` |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **None** |
| **Rollback** | Revert commit |
| **How to verify** | `/checkout?plan=STARTER` shows Starter at $9 with Starter's features; yearly shows `/yr`; an unknown plan is rejected rather than rendered as Pro |
| **Safe to ship independently** | **Yes — do it now** |

Full detail in `phases/phase-0-live-bugs.md` §0.1 and §0.2.

---

## E3 · De-duplicate hardcoded plan data

| | |
|---|---|
| **Goal** | One server-side source of truth for prices, seats and limits |
| **Repo** | Frontend |
| **Files touched** | `src/components/api-docs-content.tsx:69-74` (hardcoded `$0/$9/$29/$79/$299` price + keys + posts/day + automations/day table), `src/routes/_app/settings.tsx:640-644` (`PLAN_TEAM_LIMITS` — a second copy of `teamMembers`), used at `:764,768-770`; `src/routes/checkout.tsx:97` and `src/routes/_app/billings.tsx:525` (`usdToInrRate ?? 84` hardcoded twice); `src/routes/_app/billings.tsx:352` (`"Yearly (save ~20%)"` — real discounts are 18–22% by plan) |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None technically; most valuable **after C1/D2** so the deduplicated values are the V4 ones |
| **Rollback** | Revert commit |
| **How to verify** | Change a limit in `Backend/src/config/billing.config.ts` → the API docs table, the settings seat counter and the billing page all move together, with no frontend edit |
| **Safe to ship independently** | **Yes** |

**Why this matters more than it looks:** `api-docs-content.tsx` and `billings.tsx` currently render **contradictory** feature lists on the same login — `billings.tsx:402` renders backend `highlights` (which say "Unlimited workflows") while `checkout.tsx:44-69` renders its own hardcoded list. Any V4 reprice silently desyncs three surfaces.

---

## E4 · Agency nav gating — **ship in Phase 0**

| | |
|---|---|
| **Goal** | Agency navigation keys off the plan key, not the display string |
| **Repo** | Frontend |
| **Files touched** | `src/components/app-sidebar.tsx:238-240` vs `src/state/app-context.tsx:88-89` |
| **Config-only vs new code** | New code (one line) |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Agency login sees the Agency section; changing `mapPlan()`'s display string does not hide it |
| **Safe to ship independently** | **Yes — do it now** |

Detail in `phases/phase-0-live-bugs.md` §0.3.

---

## E5 · Wire package checkout and region-aware pricing

| | |
|---|---|
| **Goal** | The two backend capabilities V4 needs stop being dead code |
| **Repo** | Frontend |
| **Files touched** | New api-client function + `apiUri` entry for `POST /billing/package-checkout` (backend: `Backend/src/api/routes/billing.ts:128`, schema `:40-44`). **Reuse** `getMarketingPlans()` (`src/lib/api/marketing-api.ts:15-17`) which already exists with zero callers and is backed by region-aware USD/INR formatting (`Backend/src/services/marketing/marketingPlansService.ts:56-61`). Consumer surfaces: `src/routes/_app/billings.tsx`, `src/routes/checkout.tsx` |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **D1, D2, D3** — region-aware pricing is meaningless until INR is reconciled and geo routing works |
| **Rollback** | Revert commit; the plan-checkout path (`POST /checkout`) continues to work |
| **How to verify** | A package can be purchased end to end from the UI; an Indian visitor sees INR without manually switching gateway |
| **Safe to ship independently** | **No** |

**Note:** `checkout.tsx` currently does its own `usd * 84` multiplication (`:159-166`) while `marketingPlansService` — purpose-built for region-correct prices — goes unused. Replace the former with the latter rather than fixing the multiplication.

---

## E6 · Capability-driven UI gating for the new tiers

| | |
|---|---|
| **Goal** | UI reflects Growth/Business boundaries instead of showing controls that 403 |
| **Repo** | Frontend |
| **Files touched** | **Reuse** `useCan` (`src/hooks/use-auth.ts:152-155`), `FeatureGate` / `useFeatureGate` (`src/components/access/feature-gate.tsx:20-22,24-68`) and `ProtectedRoute` (`src/components/auth/guards.tsx:86-138`). Apply to the newly gated surfaces from Phase B — analytics post-metrics views, scheduler template UIs, bulk upload, team management, API keys |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **B0, B2a, B2b, B2c, B3** — the packages must withhold the keys (B0) and the rules must enforce them. 📏 Without B0 the UI would gate on a permission set that grants Free more than Business |
| **Rollback** | Revert commit |
| **How to verify** | A Growth workspace sees team-management controls locked with an upgrade CTA rather than a permissions error |
| **Safe to ship independently** | **No** |

**Two existing problems to fix while here:**
- `FeatureGate` is used in only **two** places today (`src/routes/_app/scheduler.tsx:185` and `:3498-3514`). Everything else falls through to `ProtectedRoute`, whose denial is `"You don't have permission to access this module"` (`guards.tsx:46,59`) — **with no upgrade CTA**. A plan-gated module currently reads to the customer as a permissions bug, not an upsell.
- `src/routes/_app/module-registry.docs.tsx:171` calls `useCan()` with one argument against a two-arg signature, producing `"<key>:undefined"` — a permanently closed gate (Phase 0.4).

---

## E7 · Reconcile contradictory billing copy

| | |
|---|---|
| **Goal** | No frontend string contradicts what the backend enforces |
| **Repo** | Frontend |
| **Files touched** | `src/routes/checkout.tsx:48` ("All 8 automation trigger types" — a fixed count); `src/routes/_app/agency.tsx:141`; `src/features/creator-program/copy.ts:236-241` and `frames.tsx:343` ("Unlimited automations", "Business plan features"). **Three former rows moved to Phase 0 — see below** |
| **Config-only vs new code** | New code (copy) |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **C1** so the numbers quoted are the V4 ones |
| **Rollback** | Revert commit |
| **How to verify** | Every numeric claim in checkout copy matches `resolveWorkspaceLimits` output for that plan |
| **Safe to ship independently** | **Yes** |

### ⚠️ Three rows moved to Phase 0 — Correction P6

E7 previously mixed two different things: copy that is **stale relative to V4's targets** (correct today, wrong after C1) and copy that is **false against the current backend**. Only the first belongs behind a C1 gate.

| Moved to | Claim | Why it left E7 |
|---|---|---|
| **0.11** | `:47,55` — "50,000 automated DMs/month" | No monthly DM cap exists anywhere in the backend |
| **0.12** | `:46,54,62` — per-plan Instagram account limits | No backend field of any kind |
| **0.13** | `:53-60` — Business "5 team member seats" | Backend gives **20** — contradicts what the server enforces now |

Those three ship immediately and carry **no C1 dependency**. Full detail in [`phase-0-live-bugs.md`](phase-0-live-bugs.md) §0.11–§0.13. What remains in E7 is genuinely C1-dependent: it must quote the V4 numbers, which do not exist until C1 lands.

**On the Instagram-account claim (now 0.12): it is unenforceable in principle, not merely unbuilt.** Grep for `instagramAccounts` / `maxInstagramAccounts` across the backend returns nothing. `PlanLimits` (`Backend/src/config/billing.config.ts:33-42`) has no such field. V4's "1 Instagram account per workspace" rests on the connect flow only (`instagramConnectionService.ts:16-32`), not on any limit — so no later stage makes the per-plan version true.

---

## Phase E shipping order

```
NOW (Phase 0):  E2 (=0.1, 0.2), E4 (=0.3), plus 0.11–0.13 carved out of E7
C1 ──▶ E7 (remainder)
C2 + B3 ──▶ E1
B0/B2a/B2b/B2c/B3 ──▶ E6
D1/D2/D3 ──▶ E5
E3  independent (best after C1/D2)
```

| Stage | Migration | PREVIEW-ONLY | Independent | Ship when |
|---|---|---|---|---|
| E1 | N | No | No | After C2 |
| E2 | N | No | **Yes** | **Now — Phase 0** |
| E3 | N | No | Yes | After C1/D2 preferred |
| E4 | N | No | **Yes** | **Now — Phase 0** |
| E5 | N | No | No | After D1–D3 |
| E6 | N | No | No | After B0, B2a/b/c, B3 |
| E7 | N | No | Yes | After C1 |

**Nothing in Phase E touches the database.** Every stage is revertible by commit.
