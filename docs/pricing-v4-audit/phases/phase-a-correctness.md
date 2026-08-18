# Phase A — Correctness

Entitlement leaks and enforcement gaps. **Nothing in Phases B–F may ship before this phase lands.** These stages close revenue bypasses and entitlement leaks that exist regardless of which pricing model you choose — they are worth shipping even if V4 is abandoned.

All stages are Backend-only.

> ## 📏 Production measured 2026-08-19 — two changes to this phase
>
> | Stage | Change |
> |---|---|
> | **A4** | **No longer blocked.** 0 active API credentials, 0 ever used → immediate enforcement, no window, no comms. Risk SB5 struck |
> | **A1** | **The leak has a live instance** — a CANCELED BUSINESS workspace still holds its package row today |
>
> **A3** is quantified: exactly **3** soft-deleted workspaces exist. **A4 can now ship alongside A1/A2/A3** rather than waiting on a decision.

---

## A1 · Close the cancellation entitlement leak

| | |
|---|---|
| **Goal** | A cancelled, downgraded or payment-failed workspace loses its paid capability ceiling and raised limits |
| **Repo** | Backend |
| **Files touched** | `src/services/billingSubscription.ts:245-251` (`finalizeCancellation` — deletes only the subscription row, and sets `Workspace.status = ACTIVE` at `:247-250`), `:236-243` (`scheduleCancelAtPeriodEnd`), `:223-234` (`markPaymentFailed`). **Reuse** `clearWorkspacePackage` (`src/services/workspacePackages.ts:178-213`, `repo.delete` at `:198`) — do not write a new deleter |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No — the code path writes only when a cancellation actually occurs |
| **Dependencies** | None to write; **A2 must land for the effect to be observable** within 300s |
| **Rollback** | Revert commit. No schema change, no backfill |
| **How to verify** | Cancel a sandbox subscription → `loadWorkspaceEntitlement(workspaceId)` returns `null`, `resolveWorkspaceLimits` returns FREE defaults, and `workspace_packages` has no row. Also assert `Workspace.status` is **not** forced to ACTIVE when it was `PAYMENT_FAILED`. **Plus the live production case below** |
| **Safe to ship independently** | **Yes** |

### 🔴 📏 The leak is not hypothetical — there is a live instance

**MEASURED 2026-08-19:** the **CANCELED BUSINESS** workspace still holds its `workspace_packages` row. It is one of only **2** package rows in the entire database, so of the two workspaces carrying a capability ceiling at all, **one is a cancelled customer who should not have one.**

**Required verification case for this stage:** after A1 ships, **that specific workspace must have zero rows in `workspace_packages`.** Name it in the PR and check it explicitly — a passing sandbox test does not prove the production row was cleared, because A1 fixes the *forward* path and does not retroactively clean existing rows.

> **This implies a one-off cleanup alongside A1.** A1 stops the leak from recurring; it does not undo the instance that already leaked. Clearing that single row is a `clearWorkspacePackage` call against one workspace — flag it as a **PREVIEW-ONLY** write for you to execute, not something A1's code path does automatically.

**Two sub-decisions to settle in review:**
- Should the package be cleared at `scheduleCancelAtPeriodEnd` (immediately) or only at `finalizeCancellation` (period end)? V4 §24.6 implies period end with a 30-day read-only window. Recommend **period end** — clearing at schedule-time would revoke a customer who has paid through the period.
- `finalizeCancellation` currently resets `Workspace.status = ACTIVE`, clearing a `PAYMENT_FAILED` block. That is a separate bug in the same function; fix it here.

---

## A2 · Invalidate workspace context on every billing transition

| | |
|---|---|
| **Goal** | No stale `plan` / `billingStatus` after an upgrade, downgrade, payment failure or cancellation |
| **Repo** | Backend |
| **Files touched** | **Reuse** `invalidateWorkspaceCtx` (`src/api/middleware/workspace.ts:21-22`) and `workspacePackages.refresh` (`src/services/workspacePackages.ts:19-37`). Add calls in `src/services/billingSubscription.ts` — `applyWorkspaceEntitlements:154-178`, `markWorkspacePaid:180-221`, `markPaymentFailed:223-234`, `scheduleCancelAtPeriodEnd:236-243`, `finalizeCancellation:245-251` — and in `assignWorkspacePackage` (`src/services/workspacePackages.ts`) |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Change a plan via webhook, then immediately issue an authenticated request → `req.workspace.plan` reflects the new plan within the same request, not after 300s. Existing pattern to copy: `src/api/routes/adminRbac.ts:379` with its explanatory comment at `:377-378` |
| **Safe to ship independently** | **Yes** |

**Note:** `workspacePackages.refresh` drops entitlement, authz and limits caches but **not** `ws_ctx`. Both must be called. The `ws_ctx` cache key is `ws_ctx:v1:${workspaceId}` with TTL 300s (`workspace.ts:19`, `src/lib/cache.ts:120`).

---

## A3 · Filter `deletedAt` in workspace resolution

| | |
|---|---|
| **Goal** | A soft-deleted workspace is unreachable via `x-workspace-id` and via API key |
| **Repo** | Backend |
| **Files touched** | `src/api/middleware/workspace.ts:38-46` (`resolveWorkspaceMembership` — no `deletedAt` clause), `src/api/middleware/apiKeyWorkspace.ts:41-49` (same omission) |
| **Config-only vs new code** | New code (two WHERE clauses) |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Soft-delete a workspace → requests carrying its `x-workspace-id` 404; an API key scoped to it 404s. Sibling queries already filtering correctly: `src/api/routes/workspaces.ts:35,53,154,293` and `src/services/freeWorkspaceLimit.ts:13` |
| **Safe to ship independently** | **Yes** |

> ⚠️ **📏 MEASURED 2026-08-19: 3 soft-deleted workspaces exist**, against 74 live. All 3 resolve today via `x-workspace-id` and via API key.
>
> **Confirm before shipping that none of the 3 is in active use.** This is now a bounded, three-row check rather than an open investigation — and with the count known there is no reason to ship A3 without doing it. If one *is* in use, that is a conversation with whoever is using it, not a reason to change the fix. See `04-risks.md` DL2.

**Prerequisite for:** Track **F-a2** (Agency slot release is meaningless while deleted workspaces stay live — a "released" slot whose workspace still resolves via `x-workspace-id` is not actually free). Named explicitly per Decision D10.

---

## A4 · Bring the external API under RBAC and the capability wall

| | |
|---|---|
| **Goal** | `/api/v1/external` **and `/api/v1/liffio/<lyra>`** enforce RBAC, ABAC, the package ceiling and capability rules — the same as the internal API |
| **Repo** | Backend |
| **Files touched** | `src/api/router.ts:156-159` (mount — currently `requireApiKey, apiKeyWorkspaceMiddleware` only; add `loadAuthorizationContext` and `requireCapabilityFromRegistry`), `src/api/middleware/apiKeyWorkspace.ts:70-78` (sets only `req.workspace`; must populate the authz context), `src/api/routes/externalApi.ts` — 11 handlers at `:199,228,265,287,361,433,451,468,493,596,758`. **Plus the Lyra surface:** `src/api/router.ts:155`, `src/api/routes/lyra.ts:33` (stack), `:64-73`, `:77`, `:138` (unconditional metering) |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **None. Unblocked — D7 is settled on measured data (2026-08-19).** |
| **Rollback** | Revert the mount change — single-line revert restores current behaviour |
| **How to verify** | A VIEWER-scoped API key must 403 on `DELETE` of an automation (today it succeeds and cascades to DM jobs, follow-ups and leads). A key on a package excluding `scheduler:post_reel` must 403 on reel creation |
| **Safe to ship independently** | **Yes — and it breaks nobody.** See below |

### ✅ 📏 D7 settled: ship with IMMEDIATE enforcement

**MEASURED 2026-08-19: `api_credentials` — 0 active, 0 ever used.** `last_used_at` is null across the board.

| | |
|---|---|
| Deprecation window | **None** |
| Log-only phase | **None** |
| Customer comms | **None** |

**The D7 gate is removed from this stage entirely.** The agreed rule was "effectively unused → immediate enforcement"; the table is not merely underused, it is **empty**.

**Risk SB5 — "Phase A4 breaks every existing API key holder" — is STRUCK.** There are no key holders. It is also removed from the risk-to-stage matrix in `04-risks.md`.

**Close it before the first key is issued.** The hole is real — a VIEWER-scoped key can hard-delete automations, cascading to DM jobs, follow-ups and leads (G4). It has never been exploited because nothing has ever held a key. **This fix is free today and stops being free the moment a customer creates one**, which is a reason to move A4 *earlier*, not later.

### 🔴 Scope extension — bring Lyra AI inside the wall, and make its metering unconditional

**Two defects on the same surface, found by the paywall sweep** ([`07-paywall-coverage.md`](../07-paywall-coverage.md) §2.1, §3.3). Both are the same class of problem A4 already solves for `/api/v1/external`: a paid surface reachable outside the enforcement envelope.

| # | Defect | Evidence |
|---|---|---|
| 1 | **`/api/v1/liffio/<LYRA_NAME>` is mounted without `loadAuthorizationContext`.** `req.authz` never exists, so the capability wall calls `next()` unconditionally (`requireCapability.ts:173-179`). **V4 §10.7 sells Lyra per tier; that surface cannot enforce a tier at all** | Mount `src/api/router.ts:155`; stack `src/api/routes/lyra.ts:33` — `requireAuth, impersonationWriteGuard, lyraApiLimiter` only |
| 2 | **AI token metering is bypassable by omitting a header.** `workspaceId` stays `undefined` when `x-workspace-id` is absent (`lyra.ts:64-73`), so `:77` skips `checkTokenBalance` and the completion handler returns at `:138` before `consumeTokens`. **The LLM call still executes** | `lyra.ts:64-73`, `:77`, `:138-145` |

**Fix both here.** Add `loadAuthorizationContext` (and `workspaceMiddleware`, so the route stops resolving membership itself at `:67`), and **require a resolvable workspace for every metered task** — reject with 400 rather than treating "no workspace" as "no charge".

**Verification:** a Lyra call with no `x-workspace-id` returns **400**, not 200. A workspace with zero tokens returns **402**. A Growth workspace is denied a Business-only Lyra task once B2b's rules exist.

**Scope note:** capability rules are written against internal paths (e.g. `/api/v1/scheduler/posts`). Either add parallel rules for `/api/v1/external/...` **and `/api/v1/liffio/...`** or normalise the path before matching. Decide in design; the trie is at `requireCapability.ts:159-167`.

**Also fix here:** `apiKeyWorkspaceMiddleware` does not filter `deletedAt` — covered by A3, but verify both middlewares after A3 lands.

---

## A5 · Enforce workspace creation limits

| | |
|---|---|
| **Goal** | One Free workspace per login; `workspacesIncluded` respected on create |
| **Repo** | Backend |
| **Files touched** | `src/api/routes/workspaces.ts:228-281` (the create handler — currently zero checks). **Reuse** `assertCanCreateFreeWorkspace` (`src/services/freeWorkspaceLimit.ts:21-33`, returns a discriminated result rather than throwing) and `countOwnedFreeWorkspaces` (`:8-19`) |
| **Config-only vs new code** | New code (wiring an existing, tested-by-design module that has never been called) |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Creating a second Free workspace returns 403 with a clear message. A paid-plan owner can still create up to `workspacesIncluded` |
| **Safe to ship independently** | **Yes** |

**Implementation constraint:** the route is mounted **without** `workspaceMiddleware` (`src/api/router.ts:136`), so `req.workspace` is undefined and no plan is in scope. The owner's plan must be resolved explicitly inside the handler — do not assume `req.workspace`.

**Open sub-question:** `FREE_WORKSPACE_LIMIT_PER_USER = 1` is a hardcoded constant independent of `workspacesIncluded` (`freeWorkspaceLimit.ts:6`). Decide whether Free's cap should read from `billing.config.ts` instead, so it is configurable alongside every other limit. Recommend yes, but that couples this stage to Phase C1 — keep the constant for now and note the follow-up.

### A5 is the sole enforcement point for `workspacesIncluded`

Per Decision D10, **A5 owns the create-cap for every plan, including Agency's 20.** It is the only place `workspacesIncluded` is checked. The old "F4 · Enforce `workspacesIncluded`" stage claimed the same file and the same limit key and has been **removed** — see [`phase-f-agency.md`](phase-f-agency.md) for what Track F contributes instead (slot *release* semantics, cooling-off, and parent-status-aware delete guards, none of which are create-path concerns).

Agency needs no special case here: `resolveWorkspaceLimits` returns `workspacesIncluded: 20` after C1, and A5 enforces it like any other plan. Slots are consumed on demand; **no empty workspace rows are pre-created.**

---

## A6 · Stop granting entitlement before Razorpay payment settles

| | |
|---|---|
| **Goal** | A package is assigned only after payment is confirmed, matching the Stripe path |
| **Repo** | Backend |
| **Files touched** | `src/services/billing/packageCheckout.ts:199-205` (assigns the package synchronously at checkout creation, pre-payment), `:224-250` (`assignPackageForProviderPrice`, which pins `package_price_id` at `:232-235` then calls `assignWorkspacePackage` at `:237-242`). Move the assignment to the webhook confirmation path in `src/api/webhooks/razorpay.ts:118-171` (`subscription.charged` / `subscription.activated`), mirroring `src/api/webhooks/stripe.ts:168-193` |
| **Config-only vs new code** | New code |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None. Pairs naturally with A1 — A1 clears packages on exit, A6 stops granting them on a non-entry |
| **Rollback** | Revert commit. Restores the current pre-payment grant; no schema change |
| **How to verify** | Start a Razorpay package checkout and abandon it → **no** `workspace_packages` row is created and `loadWorkspaceEntitlement` returns `null`. Complete a checkout → the package is assigned on `subscription.charged`. Compare against the Stripe path, which already defers correctly |
| **Safe to ship independently** | **Yes** |

**Why this is its own stage.** An abandoned Razorpay checkout currently leaves a **permanent** package grant — the customer never pays and keeps the paid capability ceiling indefinitely, because nothing clears `workspace_packages` (that is A1). It is a revenue leak with a self-serve trigger: anyone can open checkout, close the tab, and keep the entitlement.

**Sequencing note:** A1 alone does not fix this. A1 clears packages on *cancellation*, but an abandoned checkout never produces a subscription to cancel, so the A1 code path never fires. This needs its own fix. Recorded in `04-risks.md` LM6.

**Also confirm here:** whether the Stripe package path has the same defect. `packageCheckout.ts` defers to the webhook for Stripe, but verify `assignPackageForProviderPrice` has no other pre-payment caller.

---

## Phase A shipping order

```
A2 ──▶ A1          (A1's effect is invisible without A2)

A3   (independent)
A4   (independent — UNBLOCKED, ship early)
A5   (independent)
A6   (independent; pairs with A1)
```

**📏 Revised ordering advice on measured data.** A4 was the only gated stage in this phase and is now free. **Ship A4 early in the phase, not late** — it is a breaking change for nobody, and its cost only rises once API keys start existing. That also removes the awkward dependency on B2b, which needed A4 for the external-API surface.

**A3 does not feed A1.** A3 is independent of the cancellation path entirely — it filters `deletedAt` in request-time workspace resolution. It *is* a prerequisite for Track F-a's slot release, and for A5 being meaningful (a soft-deleted workspace that still resolves would otherwise count against, or escape, the create-cap).

| Stage | Migration | PREVIEW-ONLY | Independent | Blocked on |
|---|---|---|---|---|
| A1 | N | No | Yes (after A2 to observe) | — |
| A2 | N | No | Yes | — |
| A3 | N | No | Yes ⚠️ verify the **3** soft-deleted workspaces first | — |
| A4 | N | No | **Yes — breaks nobody (0 credentials)** | — *(D7 settled)* |
| A5 | N | No | Yes | — |
| A6 | N | No | Yes | — |

**No stage in Phase A requires a migration or a DB write** — with one measured exception: **A1 should be accompanied by a one-off `clearWorkspacePackage` against the single leaked row**, which is a PREVIEW-ONLY write for you to execute. The code changes remain fully reversible by revert.

**Downstream dependencies on this phase:** A2 → B1, F-b2 · A3 → F-a2 · A5 → F-a · A1 → F-b3 · **A4 → B2b** (the external-API surface).

> **Note the one edge that does NOT run through this phase.** **B0** — authoring per-tier package contents — has no Phase A dependency and can ship in parallel. It is nonetheless the prerequisite for all of Phase B: 📏 the package ladder is currently inverted (Free grants 140 features, Business 94), so B1 must not run before it. See [`phase-b-enforceable-matrix.md`](phase-b-enforceable-matrix.md) B0.
