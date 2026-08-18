# Phase 0 — Live Bugs

Defects that are harming customers **today**, independent of V4. None depends on any pricing decision. All are safe to ship before Stage A1.

> Ship this phase first. It depends on no decision — and as of the **2026-08-19 production measurement, all ten decisions are settled** and no stage anywhere in the plan is blocked on one.
>
> **📏 Two stages in this phase changed on measured data:** **0.10** has a confirmed live instance (an ACTIVE Agency subscription carrying a synthetic provider id) and rises in priority; **0.5** loses its caveat entirely (0 API credentials exist).

---

## 0.1 · Checkout renders the wrong plan's feature list

| | |
|---|---|
| **Goal** | `/checkout?plan=STARTER` must show Starter's name, price and features — not Pro's |
| **Repo** | Frontend |
| **Files touched** | `src/routes/checkout.tsx:31-33` (`validateSearch` accepts any string), `:38-42` (`PLAN_LABELS` — no FREE/STARTER), `:44-69` (`PLAN_HIGHLIGHTS` — no FREE/STARTER), `:82` (defaults to PRO), `:212` (falls back to PRO highlights), `:213`, `:232` (renders the raw uppercase key as a heading) |
| **Config-only vs new code** | New code (small) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Visit `/checkout?plan=STARTER` → heading reads "Starter", features are Starter's, price is $9. Visit `/checkout?plan=NONSENSE` → rejected or redirected, not rendered as a plan |
| **Safe to ship independently** | **Yes** |

**Why it matters:** STARTER is a real purchasable plan (`Backend/src/api/routes/billing.ts:23`, $9/mo). Today a Starter buyer is shown Pro's six feature bullets under the heading "Complete your STARTER setup". This is active mis-selling.

---

## 0.2 · Annual checkout displays a yearly total as a monthly price

| | |
|---|---|
| **Goal** | A $279/year charge must not render as "$279/mo" |
| **Repo** | Frontend |
| **Files touched** | `src/routes/checkout.tsx:151-157` (`usdForInterval()` returns the interval total), `:159-166` (`priceDisplay()` unconditionally suffixes `/mo`), `:235-237` (the `billed {interval}` sub-line does not correct it) |
| **Config-only vs new code** | New code (small) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Select yearly on PRO → renders "$279/yr" (or "$23.25/mo equivalent"), never "$279/mo" |
| **Safe to ship independently** | **Yes** |

**Reference implementation already in repo:** `src/routes/_app/billings.tsx:397` switches the suffix correctly. Reuse that logic rather than writing new.

---

## 0.3 · Agency navigation gated on a display string

| | |
|---|---|
| **Goal** | Agency nav visibility must key off the plan key `AGENCY`, not the human label `"Agency"` |
| **Repo** | Frontend |
| **Files touched** | `src/components/app-sidebar.tsx:238-240`; compare against `src/state/app-context.tsx:82-92` (`mapPlan()` produces the display name) |
| **Config-only vs new code** | New code (one-line) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Agency-plan login sees the Agency section; changing the display string in `mapPlan()` does not hide it |
| **Safe to ship independently** | **Yes** |

**Why it matters:** any copy change to `mapPlan()` silently removes paid navigation for Agency customers.

---

## 0.4 · Permanently closed capability gate

| | |
|---|---|
| **Goal** | `useCan(CS.BULK_EXPORT)` must pass an action |
| **Repo** | Frontend |
| **Files touched** | `src/routes/_app/module-registry.docs.tsx:171`; signature at `src/hooks/use-auth.ts:152-155` |
| **Config-only vs new code** | New code (one-line) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | The permission string resolves to `"<module>:<action>"`, not `"<key>:undefined"`; a user holding the permission sees the control |
| **Safe to ship independently** | **Yes** |

**Note:** confirm the intended capability before fixing — the current call may be masking a feature nobody has been able to reach. Consider whether it should be gated at all.

---

## 0.5 · `maxApiCredentials` counted per user, not per workspace

| | |
|---|---|
| **Goal** | Count active credentials in the workspace the limit was resolved for |
| **Repo** | Backend |
| **Files touched** | `src/services/apiCredentials.ts:87-89` (`activeCount` scoped by `ac.userId`), context `:77-80`, `:83`, `:90-92` |
| **Config-only vs new code** | New code (query scope change) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | A user owning two workspaces can create the full quota in each; a single workspace still blocks at its own cap |
| **Safe to ship independently** | **Yes — freely.** 📏 See below |

**📏 MEASURED 2026-08-19: 0 API credentials exist, and none has ever been used.** The caveat that this fix **loosens** a limit for multi-workspace users is therefore **theoretical — there is nobody to loosen a limit for.** 0.5 no longer needs to land together with C1's value changes, and no longer needs a decision about whether the loosening is acceptable. Ship it whenever convenient.

---

## 0.6 · `apiRequestsPerDay` does not count requests

| | |
|---|---|
| **Goal** | The limit named "API requests per day" should meter API requests |
| **Repo** | Backend |
| **Files touched** | `src/services/externalApiUsage.ts:51` (counts `schedulerPosts + automations`), `:52`, `:76-80` (increment); call sites `src/api/routes/externalApi.ts:306`, `:505` |
| **Config-only vs new code** | New code |
| **Migration required** | Likely N (reuse the existing usage table); **Y if a new counter column is needed** |
| **PREVIEW-ONLY** | **Yes, if a migration is introduced** |
| **Dependencies** | Best sequenced with Phase A4 (which puts all 11 external routes under middleware where metering can be applied uniformly) |
| **Rollback** | Revert commit; drop the added column |
| **How to verify** | Issue N read-only external requests → counter increments by N; today it increments by 0 |
| **Safe to ship independently** | Yes, but **defer to A4** — metering all 11 routes is trivial once they share middleware, and awkward before |

---

## 0.7 · Two workers emit no lifecycle events

| | |
|---|---|
| **Goal** | `schedulerAnalyticsSyncWorker` and `inviteExpirySweepWorker` must log completed/failed and report to Sentry |
| **Repo** | Backend |
| **Files touched** | `src/queue/worker.ts:348-365` (`bindWorkerEvents` list — 18 of 20 workers); also `:370-389` (startup log enumerates only 15 of 20 queues) |
| **Config-only vs new code** | New code (two lines + log list) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Force an analytics-sync failure → a `failed` log and a Sentry event appear |
| **Safe to ship independently** | **Yes** |

**Why it matters now:** the analytics sync is the job V4 §21.4 builds its entire Growth-tier cost argument on, and it currently fails silently. You cannot validate that argument without this.

---

## 0.8 · `creatorProgramApiLimiter` never mounted

| | |
|---|---|
| **Goal** | Mount the limiter, or delete it |
| **Repo** | Backend |
| **Files touched** | `src/api/middleware/rateLimiter.ts:73-81` (defined, exported, imported by nothing); creator-program routes under `src/api/router.ts:152-153` |
| **Config-only vs new code** | New code (one mount line) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Remove the mount |
| **How to verify** | 31 requests in 60s from one user → 429 on the 31st |
| **Safe to ship independently** | **Yes** |

---

## 0.9 · Stripe webhook failures are never retried

| | |
|---|---|
| **Goal** | A handler error must not leave the event marked processed |
| **Repo** | Backend |
| **Files touched** | `src/api/webhooks/stripe.ts:151-158` (`recordEvent` before handling), `:160-163` (duplicate short-circuit), `:294-298` (error path stamps the row and returns 500) |
| **Config-only vs new code** | New code |
| **Migration required** | N (unless a `processed` flag is added — then **Y**) |
| **PREVIEW-ONLY** | **Yes, if a migration is introduced** |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | Force a handler throw → Stripe's retry re-executes the handler rather than short-circuiting as a duplicate |
| **Safe to ship independently** | **Yes** |

**Why it matters:** this is silent billing data loss. A transient DB error during `invoice.paid` currently means the payment is never applied, and the retry is discarded.

---

## 0.10 · Synthetic provider ids are passed to Stripe

| | |
|---|---|
| **Goal** | `checkout_…` and `invoice_…` ids must never reach the Stripe API |
| **Repo** | Backend |
| **Files touched** | `src/services/billing.ts:361-366` (cancel), `src/services/billingSubscription.ts:195-196` (`subscriptions.retrieve`); pattern to copy: `src/services/adminBillingMutations.ts:158-160` (the only site that defends, against `manual_`) |
| **Config-only vs new code** | New code (guard) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | None |
| **Rollback** | Revert commit |
| **How to verify** | A workspace whose `providerSubscriptionId` starts `checkout_`/`invoice_`/`manual_` can be cancelled locally without a provider API call. **Verify against the live Agency row below** |
| **Safe to ship independently** | **Yes** |

### 🔴 📏 CONFIRMED LIVE — this is not a latent risk

**MEASURED 2026-08-19: one of the three ACTIVE AGENCY subscriptions carries a synthetic `provider_subscription_id` today.**

**Cancelling that workspace right now calls the provider with an id the provider never issued.** It is a paying Agency customer — one of only four paying workspaces on the platform — and the failure would surface at the worst possible moment, during a cancellation or a billing sync.

### ⚠️ The live instance is **Razorpay**, and this stage only names Stripe

Every call site listed above is a Stripe path. **The Razorpay cancel and sync paths must be checked too**, or the fix will not cover the one case that actually exists in production. Specifically:

| Path | Currently named here | Needs checking |
|---|---|---|
| Stripe cancel (`billing.ts:361-366`) | ✅ | — |
| Stripe `subscriptions.retrieve` (`billingSubscription.ts:195-196`) | ✅ | — |
| **Razorpay cancel** | ❌ | **Yes — this is where the live row will break** |
| **Razorpay subscription fetch/sync** | ❌ | **Yes** |

**Recommendation:** extract one `isSyntheticSubscriptionId()` helper covering all three prefixes and use it at **every** call site in **both** provider paths, rather than three separate `startsWith` checks on the Stripe side only.

> **Priority.** This was ordered second in the phase, behind the mis-selling fixes. With a live Agency subscription in the broken state, treat it as **jointly first** — the customer cannot be cleanly cancelled or synced until it lands.

---

# Live false claims in checkout copy — promoted from E7 (Correction P6)

Three rows previously sitting inside **E7** are not V4 drift. They are **false today, against the current backend**, and they are shown to customers at the moment of purchase. They do not depend on C1, on the V4 numbers, or on any pricing decision — so they do not belong behind a C1 gate.

The rest of E7 (copy that is merely *stale relative to V4's targets*) stays gated behind C1 — see [`phase-e-frontend.md`](phase-e-frontend.md) E7.

| Promoted | Claim | Why it is false **today** | Old gap |
|---|---|---|---|
| **0.11** | "50,000 automated DMs/month" | No monthly DM cap exists anywhere in the backend | G17 |
| **0.12** | Per-plan Instagram account limits (5 / 10 / Unlimited) | No such field exists in `PlanLimits` at all | G16 |
| **0.13** | Business "5 team member seats" | Backend gives Business **20** | G15 |

---

## 0.11 · "50,000 automated DMs/month" — a cap that does not exist

| | |
|---|---|
| **Goal** | Checkout must not advertise a monthly DM allowance the backend has no concept of |
| **Repo** | Frontend |
| **Files touched** | `src/routes/checkout.tsx:47` (PRO bullet), `:55` (BUSINESS bullet) |
| **Config-only vs new code** | New code (copy removal) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **None.** Independent of C1 and of every pricing decision |
| **Rollback** | Revert commit |
| **How to verify** | Grep `checkout.tsx` for `DMs/month` returns nothing; no checkout bullet states a monthly DM figure |
| **Safe to ship independently** | **Yes** |

**Why it is a live false claim, not V4 drift.** There is **no monthly DM metering of any kind** in the backend: no `LIMIT_KEYS` entry, no field on `PlanDefinition.limits`, no counter, no throw path (`00-findings.md` C21). The number is not merely wrong — the quantity it names is not measured. A customer cannot exceed it, and a customer cannot be shown a remaining balance.

**Do not "fix" it by writing a different number.** Any monthly DM figure is unenforceable until **B5** builds the meter. Remove the claim; B5 is where a real one can be re-introduced.

---

## 0.12 · Per-plan Instagram account limits — no backend field exists

| | |
|---|---|
| **Goal** | Checkout must not advertise per-plan Instagram-account limits that no backend field expresses |
| **Repo** | Frontend |
| **Files touched** | `src/routes/checkout.tsx:46` (PRO), `:54` (BUSINESS), `:62` (AGENCY) — "5 / 10 / Unlimited Instagram accounts" |
| **Config-only vs new code** | New code (copy removal) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **None** |
| **Rollback** | Revert commit |
| **How to verify** | Grep the backend for `maxInstagramAccounts` / `instagramAccounts` returns nothing; no checkout bullet names a per-plan account count |
| **Safe to ship independently** | **Yes** |

**Why it is a live false claim.** `PlanLimits` (`Backend/src/config/billing.config.ts:33-42`) has **no such field**, and a repo-wide grep returns no limit key. The only constraint that exists is one Instagram account **per workspace**, enforced by the connect flow (`instagramConnectionService.ts:16-32`) — which V4 §4.2 itself concedes is not a DB constraint.

**This one is unenforceable in principle, not merely unbuilt.** With one account per workspace and `workspacesIncluded` at 1 for every non-Agency plan, "5 Instagram accounts on PRO" cannot be delivered by any configuration change. Removing the claim is the only correct action; there is no later stage that makes it true.

---

## 0.13 · Business "5 team member seats" — backend gives 20

| | |
|---|---|
| **Goal** | The seat count at checkout matches what the backend actually grants |
| **Repo** | Frontend |
| **Files touched** | `src/routes/checkout.tsx:53-60` (the BUSINESS highlight block) |
| **Config-only vs new code** | New code (copy) |
| **Migration required** | N |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **None.** See the sequencing note below |
| **Rollback** | Revert commit |
| **How to verify** | The Business checkout seat figure equals `resolveWorkspaceLimits(...).teamMembers` for BUSINESS — **20** today |
| **Safe to ship independently** | **Yes** |

**Why it is a live false claim.** `billing.config.ts:125` sets Business `teamMembers: 20`. Checkout says **5**. This is not a V4-target mismatch — it contradicts the value the server enforces right now, and it **understates** what the customer receives, which is the rarer and less-damaging direction but still a false statement at the point of sale.

**Sequencing note — the only one of the three that interacts with C1.** C1 will change Business `teamMembers` to **15**. Two acceptable ships:
- **Preferred:** make the figure server-driven in this stage (read the resolved limit), and it stays correct through C1 automatically. This is the E3 pattern, applied to one field.
- **Acceptable:** hardcode **20** now and re-touch at C1.

Do not defer the fix to C1 on the grounds that the number will change again — the copy is false in the meantime.

---

## Phase 0 shipping order

1. **0.1, 0.2, 0.11, 0.12, 0.13** — mis-selling, ship immediately. All five are `checkout.tsx` copy/logic and can land in one commit
2. **0.10** — 📏 **raised in priority: a live ACTIVE Agency subscription carries a synthetic provider id today.** Must cover the Razorpay path, not just Stripe
3. **0.9** — billing correctness
4. **0.7** — observability, needed to validate Phase B/C decisions
5. **0.3, 0.4, 0.8** — small correctness
6. **0.5** — 📏 **now unconditional.** 0 API credentials exist, so the "loosens a limit" concern is void
7. **0.6** — defer to Phase A4 (which is itself now unblocked)

**13 stages. Nothing in this phase requires a DB write except the optional migrations in 0.6 and 0.9, both flagged PREVIEW-ONLY.**

**0.11–0.13 were promoted out of E7** (Correction P6). They are false against the current backend rather than stale against V4's targets, so they carry no C1 dependency. The remainder of E7 stays behind C1.
