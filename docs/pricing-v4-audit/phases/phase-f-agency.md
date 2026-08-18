# Phase F — Agency

**A separate track.** Do not entangle with Phases A–E. Agency's multi-workspace model is a distinct problem from the single-workspace tier ladder, and mixing them makes both harder to reason about and to roll back.

All stages are Backend-only.

---

## ⚠️ Track F is SPLIT — Decision D10

The Agency work is **two independent problems** that were previously treated as one. The 20-workspace *entitlement* is not architecturally blocked; only the *single-subscription billing* is.

> **Corrected statement.** The old line — *"'20 workspaces' Agency — architecturally impossible"* — was wrong.
>
> **Accurate:** one provider subscription backing 20 workspace entitlements is blocked by the `providerSubscriptionId` UNIQUE constraint (`src/entities/billing/WorkspaceSubscription.entity.ts:24`), and payment-state fan-out to 20 children does not exist. **The 20-workspace entitlement itself is a config change.**

| Track | What it is | Blocked? |
|---|---|---|
| **F-a** | The 20-workspace **grant** — a config value plus a create-cap | **No.** Ships on its own, needs only C1 + A5 |
| **F-b** | Parent subscription + payment-state fan-out | **Yes.** This — not the workspace count — is what blocks self-serve Agency checkout |

### Stage renumbering

| Old | New | Change |
|---|---|---|
| F0 | **F-a1** | Unchanged in substance; `extraMeteredRate` now explicitly **removed**, not "decided" |
| F3 (release half) | **F-a2** | Slot **release** semantics only — the create half moved to A5 |
| F3 (create half) | *(moved)* | → **A5**. Slots are consumed on demand against the cap |
| *(none)* | **F-a3** 🔴 **NEW** | Capability rules for `agency:*` — the white-label gate. Found by the completeness sweep |
| **F4** | *(removed)* | Duplicated A5's file and A5's limit key. See "Why F4 is gone" below |
| F1 | **F-b1** | Unchanged |
| F2 | **F-b2** | Unchanged |
| F5 | **F-b3** | Unchanged |

### Why F4 is gone — Correction P1

Old F4 ("Enforce `workspacesIncluded`") and A5 ("Enforce workspace creation limits") claimed **the same file** (`src/api/routes/workspaces.ts` create handler) and **the same limit key** (`workspacesIncluded`). Two stages cannot own one enforcement point.

**A5 owns the create-cap for every plan, Agency included.** What Track F contributes that A5 does not is **slot lifecycle**: release, cooling-off, and a parent-status-aware delete guard — none of which are create-path concerns. That work is F-a2, renamed accordingly.

---

# Track F-a — the 20-workspace grant

**Not architecturally blocked.** A config value plus a create-cap.

Agency customers get **all 20 slots available at purchase**. Workspaces are created **on demand against the cap**. **Do not create 20 empty rows** — twenty empty shells would each need naming, Instagram connection and configuration, and would pollute every workspace switcher.

The three pieces:

| Piece | Stage | Owner |
|---|---|---|
| `AGENCY.workspacesIncluded` `999999` → **20** | **C1** | [`phase-c-tier-definitions.md`](phase-c-tier-definitions.md) |
| Reconcile `agency.ts` and drop the dead overage rate | **F-a1** | here |
| The enforcement point (create handler) | **A5** | [`phase-a-correctness.md`](phase-a-correctness.md) |
| **Gate the 7 `agency:*` white-label capabilities** | **F-a3** | here 🔴 **NEW** |

---

## F-a1 · Reconcile the Agency workspace counts *(formerly F0)*

| | |
|---|---|
| **Goal** | One number for how many workspaces Agency includes: **20** |
| **Repo** | Backend |
| **Files touched** | `src/api/routes/agency.ts:108` (`const included = 30;` → **20**) and `:122` (`extraMeteredRate: 9` — **remove**); `src/config/billing.config.ts:146` (`workspacesIncluded: 999999` → **20**, executed in **C1**) |
| **Config-only vs new code** | Config + a one-line code change |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None. Pairs with **C1**, which carries the `billing.config.ts` value |
| **Rollback** | Revert commit |
| **How to verify** | `GET /agency/master-dashboard` reports 20; `resolveWorkspaceLimits` returns `workspacesIncluded: 20` for Agency; no response field advertises a metered overage rate |
| **Safe to ship independently** | **Yes** |

**Three conflicting numbers today: 20** (V4 target) **/ 30** (`agency.ts:108`) **/ 999999** (`billing.config.ts:146`). Fix this first — every later stage depends on knowing what the number is.

**`extraMeteredRate: 9` is dead copy — remove it.** Per Decision D10 this is settled, not an open question: V4 §9 explicitly excludes *"Metered overage billing beyond 20 workspaces"*, and there is no billing implementation behind the field. Leaving it in the response advertises a product that does not exist.

---

## F-a2 · Slot release semantics *(formerly the release half of F3)*

| | |
|---|---|
| **Goal** | Releasing an Agency workspace actually frees the slot, and the slot cannot be cycled for abuse |
| **Repo** | Backend |
| **Files touched** | `src/api/routes/workspaces.ts:283-323` (delete — currently `softDelete` at `:321`, cascading nothing; the guard at `:306-319` blocks deletion while a paid subscription is ACTIVE/TRIALING) |
| **Config-only vs new code** | New code |
| **Migration required** | **N** — F-b1 adds the columns the parent-aware branch needs |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **A3 — hard, named explicitly.** **A5** (the create-cap must exist for a "freed" slot to mean anything). The child-subscription detach step and the parent-aware guard activate only after **F-b1** |
| **Rollback** | Revert commit |
| **How to verify** | Deleting an Agency workspace frees a slot and the workspace stops resolving via `x-workspace-id`; a released slot cannot be re-consumed inside the cooling-off window |
| **Safe to ship independently** | **No** — depends on A3 |

### 🔴 The A3 dependency is load-bearing — do not bury it

**Slot release depends on A3** (`deletedAt` filtering in `src/api/middleware/workspace.ts:38-46` and `src/api/middleware/apiKeyWorkspace.ts:41-49`). Without A3, a "released" workspace **remains fully usable** via `x-workspace-id` and via API key. The slot is not really free — the agency has simply stopped counting a workspace that still works. Naming this dependency inside F-a2, rather than leaving it buried in the old F3, is a requirement of Decision D10.

### Release must do more than soft-delete

Today deletion cascades nothing — the subscription row, package assignment, `platform_accounts` row and memberships all survive (`workspaces.ts:283-323`). A correct release:

1. Soft-delete the workspace (unchanged)
2. **Clear its `workspace_packages` row** — otherwise the capability ceiling persists. (A1 covers the *cancellation* path; this is the *deletion* path)
3. Detach or delete the child `workspace_subscriptions` row, freeing the synthetic id — **only meaningful after F-b1**
4. Deactivate its `platform_accounts` row so the Instagram account can be connected elsewhere

### The delete guard will block every child — after F-b1

`workspaces.ts:306-319` refuses deletion while a non-FREE ACTIVE/TRIALING subscription exists. Once F-b1 gives Agency children their own subscription rows, they will have exactly that. **The check must then read the parent's status**, or no Agency workspace can ever be deleted. Before F-b1 lands the guard is harmless, because Agency's extra workspaces carry no subscription of their own.

### Anti-abuse

V4 §24.2 recommends a 7-day cooling-off before a released slot is reusable, or a cap of 5 releases per billing period — otherwise slot-cycling runs 40 accounts through 20 slots. Pick one; both are new code.

> **Data-loss risk DL3 applies to this stage** (it was written against old F3). A correct release soft-deletes, clears the package, detaches the subscription and deactivates the platform account — real destruction where none existed. Explicit confirmation flow; soft-delete only; retain `platform_accounts` deactivated rather than deleted.

---

## F-a3 · Capability routes — Agency white-label 🔴 **NEW**

| | |
|---|---|
| **Goal** | The 7 `agency:*` capabilities are gated by the capability wall, not by three hand-placed `requirePlan` calls |
| **Repo** | Backend |
| **Files touched** | Seed `capability_routes` rows for the agency surface, then `npm run capability-routes:codegen`. Routes: `src/api/routes/agency.ts` |
| **Capabilities** | `agency:branding`, `client_workspaces`, `custom_domain`, `domain_verification`, `hide_branding`, `shortlink_domain`, `theme_color` (7) |
| **Config-only vs new code** | New code + **data** |
| **Migration required** | **Y** (seeds `capability_routes` rows) |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **B0** (the package must withhold the keys) and **B1** (the ceiling must be assigned) |
| **Rollback** | Delete the seeded rows, re-run codegen |
| **How to verify** | A BUSINESS workspace gets 403 `CAPABILITY_NOT_INCLUDED` on each of the 7; an AGENCY workspace gets 200 |
| **Safe to ship independently** | **No** |

**Why it is needed.** `requirePlan(Plan.AGENCY)` appears at exactly **three** routes — `agency.ts:19` (`/brand/by-domain`), `:29` (`/master-dashboard`), `:136` (`/switch-workspace`). **Every other agency capability is ungated.** Three hand-placed guards are not a paywall, and they are invisible to `capabilityReconciler`, so nothing reports the gap.

**📏 The package layer already handles this one correctly** — `agency` is the only module `GATED_MODULES` withholds properly (`features.agencyPanel` is true on AGENCY alone), and measurement confirms: Agency's package holds 146 features against Free's 140, the difference being the agency module. **F-a3 adds the route-layer half.** Both are needed: the package withholds the capability, the rule is what turns a request into a 403.

**Keep the `requirePlan` guards.** Belt and braces is fine. What is not fine is the two layers disagreeing — if C2's rename or a future plan change moves the Agency threshold, both must move together.

---

# Track F-b — parent subscription and fan-out

**This is what blocks self-serve Agency checkout.** Not the workspace count.

The blocker is that one provider subscription cannot back 20 workspace *subscription rows* (`providerSubscriptionId` is NOT NULL + UNIQUE, `src/entities/billing/WorkspaceSubscription.entity.ts:24`), and payment-state fan-out to 20 children does not exist. Gated behind Phase A as written. Per V4 §24.9, Agency ships **sales-assisted** until F-b1 and F-b2 land.

---

## F-b1 · Parent subscription table *(formerly F1)*

| | |
|---|---|
| **Goal** | One provider subscription can back N workspaces |
| **Repo** | Backend |
| **Files touched** | New `agency_subscriptions` table + `workspace_subscriptions.agency_subscription_id` (nullable FK). Entity `src/entities/billing/WorkspaceSubscription.entity.ts`. Writers to update: `upsertWorkspaceSubscription` (`src/services/billingSubscription.ts:104-152`, keyed on `workspaceId` at `:117-120`, so it is **unaffected** by the child-id scheme) |
| **Config-only vs new code** | New code + **migration** |
| **Migration required** | **Y** — new table, new nullable column, new FK |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **F-a1** (the number); **Phase 0.10** |
| **Rollback** | Reverse migration. Additive and safe while no parent rows exist |
| **How to verify** | A parent row can be created and 20 child `workspace_subscriptions` rows attached, each with a distinct synthetic `provider_subscription_id`, without violating the UNIQUE constraint |
| **Safe to ship independently** | **Yes** — the table is inert until F-b2/F-a2 use it |

### Design: synthetic child ids (V4 §23.2 — verified sound)

The codebase already establishes this idiom in production: `checkout_${event.id}` (`src/api/webhooks/stripe.ts:190`), `invoice_${invoice.id}` (`:240`), `manual_${uuid}` (`src/services/adminBillingMutations.ts:90`). Child rows take `agency_<parentId>_<slot>`, preserving the UNIQUE constraint without altering it.

**Keep `plan = BUSINESS` on children.** `Plan` is load-bearing for affiliate commission bands, AI token allocation, `planEnforcement` fallbacks and `requirePlan` gates. `deriveCoarsePlan` (`src/services/billing/packageCheckout.ts:32-40`) exists for exactly this reason.

> ⚠️ **Prerequisite bug:** synthetic ids are guarded **nowhere** except `manual_`. `src/services/billing.ts:361-366` will pass a synthetic id straight into `stripe.subscriptions.update()` on cancel, and `billingSubscription.ts:195-196` into `subscriptions.retrieve()`. **Phase 0.10 must land before F-b1**, or every Agency child will break on cancel.

### Why not the alternatives (V4 §23.2, confirmed)
- *Drop the UNIQUE constraint and share the real id across 20 rows* — breaks the Stripe webhook resolver, cancel-by-child, and per-workspace provider sync. Six call sites become ambiguous (enumerated in `00-findings.md`).
- *Reuse `agencies` / `agency_clients`* — no write path exists for either table; `agencies.workspace_id` is UNIQUE, anchoring an agency to a single workspace.

---

## F-b2 · Webhook fan-out *(formerly F2)*

| | |
|---|---|
| **Goal** | A parent-level billing event applies to all children |
| **Repo** | Backend |
| **Files touched** | `src/api/webhooks/stripe.ts:36-109` (the 6-strategy resolver — add a parent lookup ahead of the `providerSubscriptionId` strategy at `:65-72`), `src/api/webhooks/razorpay.ts:83-88` (resolution is `notes.workspaceId` only — needs an `agencySubscriptionId` branch). Cache invalidation via `invalidateWorkspaceCtx` + `workspacePackages.refresh` |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **F-b1**; **A2** (cache invalidation must already be wired) |
| **Rollback** | Revert commit — single-workspace path is unchanged |
| **How to verify** | `invoice.payment_failed` on a parent marks all 20 children, not one. `invoice.paid` restores all 20 in one transaction |
| **Safe to ship independently** | **No** |

**Resolver order:**
1. Look up `agency_subscriptions` by `provider_subscription_id` → **fan out to all children**
2. Else look up `workspace_subscriptions` → single-workspace path, unchanged

**Cache cost is 4 × 20 per parent event.** `invalidateWorkspaceCtx` currently has exactly one production caller (`src/api/routes/adminRbac.ts:379`) — A2 must extend it first or every fan-out leaves 20 stale contexts.

**Also fix here:** Razorpay treats `subscription.pending` as a hard payment failure (`razorpay.ts:176`). Fanned out across 20 client accounts, that is catastrophic. Covered by Phase D4 for the single-workspace case; verify it holds for parents.

---

## F-b3 · Cancellation and downgrade for 20 workspaces *(formerly F5)*

| | |
|---|---|
| **Goal** | Agency cancellation and downgrade are guided, not automatic |
| **Repo** | Backend |
| **Files touched** | `src/services/billingSubscription.ts:236-251`, plus the parent-aware branches from F-b2. `WorkspaceStatus.SUSPENDED` is now a live value (written by `src/services/adminWorkspaceMutations.ts`) and is the natural vehicle for read-only state; `SubscriptionStatus.PAUSED` is genuinely dead (zero references) and available |
| **Config-only vs new code** | New code |
| **Migration required** | **Possibly Y** (a retention/grace timestamp) |
| **PREVIEW-ONLY** | **YES if a migration is introduced** |
| **Dependencies** | **F-b1, F-b2, F-a2**; **A1**; **D4** |
| **Rollback** | Reverse migration; revert commit |
| **How to verify** | Cancelling a parent puts all 20 into read-only, preserves data for 30 days, and reverts to Free only after the window — with **only one** allowed to remain Free (V4 §24.7) |
| **Safe to ship independently** | **No** |

**V4 §24.7 is correct that this is the highest support-load path.** It must be a guided flow: present all workspaces with handle, lead count and automation count; the customer selects one to retain and its target tier; the other 19 go read-only for 30 days. Nothing is deleted without explicit confirmation.

**Interaction with A5:** only one Free workspace per login. Nineteen reverting workspaces cannot all become Free. They must be deleted or individually subscribed — which is why this is a flow, not a state transition.

---

## Phase F shipping order

Dependencies are stated at **stage** granularity, not phase granularity.

```
Track F-a  (not blocked — ships on the Phase A/C timeline)

   F-a1 ──┐
   C1 ────┼──▶ A5   (the create-cap; owned by Phase A)
          │
   A3 ────┴──▶ F-a2 (slot release)

   B0 ──▶ B1 ──▶ F-a3  (white-label capability rules)

Track F-b  (blocked — this is what gates self-serve Agency)

   0.10 ──▶ F-b1 ──▶ F-b2 ──▶ F-b3
                A2 ──┘         ▲
                     A1, D4 ───┤
                     F-a2 ─────┘
```

| Stage | Migration | PREVIEW-ONLY | Independent | External deps |
|---|---|---|---|---|
| F-a1 | N | No | **Yes** | — (pairs with C1) |
| F-a2 | N | No | No | **A3**, A5; F-b1 for the parent-aware branch |
| **F-a3** | **Y** | **YES** | No | **B0, B1** |
| F-b1 | **Y** | **YES** | Yes (inert) | Phase 0.10, F-a1 |
| F-b2 | N | No | No | F-b1, A2 |
| F-b3 | Possibly Y | Conditional | No | F-b1, F-b2, F-a2, A1, D4 |

### Launch position

**F-a1 can ship immediately**, and with C1 + A5 the 20-workspace entitlement is real — no F-b stage required. **F-a3 makes the white-label capabilities enforceable** and rides the Phase B timeline rather than this track's. F-b1 is safely additive. Everything from F-b2 onward depends on Phase A.

Until F-b1 and F-b2 land, Agency is sold **sales-assisted** with manual provisioning — which is what V4 §24.9 already recommends. The honest position for the marketing copy: the *entitlement* (20 workspaces, created on demand) is deliverable once F-a1 + C1 + A5 land; **"One subscription, one invoice, one renewal date"** (`liffio-pricing-v4.html:349`) is not, until F-b1/F-b2 do. See [`06-doc-corrections.md`](../06-doc-corrections.md) §2.
