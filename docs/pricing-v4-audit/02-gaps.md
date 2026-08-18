# 02 — Gaps, Severity-Ranked

Severity reflects **risk to correctness, revenue or customers**, not effort. "Blocks launch" means the V4 model cannot be sold honestly until it is closed.

| Key | Meaning |
|---|---|
| 🔴 | Blocks launch |
| 🟡 | Blocks a specific V4 claim, or is a live bug |
| 🟢 | Should fix, does not block |

## 🔴 📏 THE TOP GAP — the package ladder is inverted (measured 2026-08-19)

**Read this before G1.** The audit's original framing — *"V4 is a gate-layer build, not a config exercise"* — named the right kind of work but the wrong broken layer.

| Package | Features | `team` | `api` | `post_story` |
|---|---:|---:|---:|---|
| Agency | 146 | 6 | 9 | yes |
| **Free** | **140** | **6** | **9** | yes |
| Starter | 113 | 0 | 0 | yes |
| **Business** | **94** | **0** | **0** | yes |
| Pro | 92 | 0 | 0 | yes |
| Growth | **1** | 0 | 0 | no |

**A FREE workspace holds strictly more capability than a paying BUSINESS workspace.**

**V4 is a gate-layer build AND a package-authoring build — and the package layer is the one currently inverted.** G2 below says the route layer has no enforcement points; **G54 says the entitlement layer those points consult grants nearly everything, in the wrong order.** A capability rule cannot deny a key the package grants, so gating stages seeded against these packages would gate nothing.

**Fixed by the new stage B0**, which must precede B1. See G54 and [`07-paywall-coverage.md`](07-paywall-coverage.md).

---

## 📏 Coverage numbers in this file are MEASURED against production (2026-08-19)

**Decision D9 is settled by measurement, and the earlier "seed-derived, unverified" caveat is withdrawn.**

| | Measured in production | Previously assumed from the seed |
|---|---:|---|
| `capability_routes` rows | **8**, all enabled | 8 |
| Distinct capabilities covered | **6** | 5 |
| `child_modules` rows | **125** | 121 (codegen snapshot) |
| **Capability keys with no gate site** | **119 of 125** | 116 of 121 |

**The seed IS the live state.** Nothing was added by operators via Superadmin → Module Registry, and nothing by plugins at activation. The scenario the caveat guarded against did not happen.

**Two corrections follow:**
1. **Coverage is 119 ungated of 125, not 116 of 121.** Reconcile against `child_modules` (125), **not** the codegen snapshot (121) — **the snapshot is 4 keys stale**. Noted in stage B3, which already owns the codegen reconciliation.
2. **6 capabilities are gated, not 5.** One more than the snapshot implied.

**The number moved slightly against us and is now certain.** The hoped-for outcome — live coverage better than the seed — did not materialise.

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

## 🔴 Blocks launch

### G1 · No plan → capability mapping exists
**Blast radius:** every paid capability, every tier — the whole of V4 §10.
The capability ceiling derives from the assigned *package*, never from the plan. `src/services/entitlement.ts` and `src/services/authzBuild.ts` do not import `Plan` or `BILLING_PLANS`. With no `workspace_packages` row, `applyEntitlement` returns permissions untouched (`entitlement.ts:207`).
**Blocks launch:** YES. Nothing in the V4 matrix can be enforced by tier without this.
**📏 MEASURED 2026-08-19: 72 of 74 live workspaces have no package row** — `workspace_packages` holds **2 rows in total**. The stale comment at `entitlement.ts:15-17` estimated 35–45; the real figure is nearly double, and the ceiling is inert **platform-wide**.
**All 4 paying workspaces are among the unpackaged** — 3 AGENCY ACTIVE, 1 BUSINESS ACTIVE, 1 STARTER ACTIVE. B1 therefore turns the ceiling on for **100% of paying customers simultaneously**; there is no partial rollout available. See `04-risks.md` SB1.

### G2 · 📏 119 of 125 capability keys have no gate site — **MEASURED**
**Blast radius:** the entire feature matrix.
**📏 MEASURED 2026-08-19:** `capability_routes` holds **8 rules, all enabled, covering 6 distinct capabilities**. `child_modules` holds **125** rows. **119 keys have no gate site of any kind.** The codebase says so too: `capabilityReconciler.ts:11-15` — *"most capabilities are enforced nowhere and the capability wall fails open on a miss."*
**Aggravating:** the wall fails open on **three** paths — no rule match (`requireCapability.ts:168`), no `req.authz` (`:173-179`), and any thrown exception (`:192-200`).
**Codegen drift:** the committed snapshot (`src/generated/capabilityRoutes.ts:18-25` / `generated/modules.ts:247-372`) reports **121** keys and 5 capabilities. Production has **125** and **6**. **The snapshot is stale by 4 keys** — reconcile in B3.
**Blocks launch:** YES. Six gated capabilities cannot enforce a 90-row feature matrix.

### G3 · Entitlement leak on cancellation
**Blast radius:** every cancelled, downgraded or payment-failed workspace, permanently.
`finalizeCancellation` (`billingSubscription.ts:245-251`) deletes the subscription row only. The `workspace_packages` row survives, so the workspace reads as FREE (`billing.ts:156`) while retaining the paid package's full capability set and raised limits. The only deleter, `clearWorkspacePackage`, is called solely from `adminRegistry.ts:467`.
**Aggravating:** `finalizeCancellation` also sets `Workspace.status = ACTIVE` (`:247-250`), clearing any prior `PAYMENT_FAILED` block. And Razorpay package checkout assigns the package *before payment settles* (`packageCheckout.ts:199-205`), so an abandoned checkout leaves a permanent grant.
**🔴 📏 THE LEAK HAS A LIVE INSTANCE (measured 2026-08-19).** One **CANCELED BUSINESS** workspace **still holds its `workspace_packages` row today**. It is one of only 2 package rows in the entire database — so of the two workspaces that carry a ceiling at all, **one is a cancelled customer who should not have it**. This is not hypothetical and not a modelled scenario; it is a row you can select right now.
**Verification case for A1:** after A1 ships, that specific workspace must have **zero** package rows. See `phases/phase-a-correctness.md` A1.
**Blocks launch:** YES — customers can cancel and keep everything, and one already has.

### G4 · External API has no RBAC, no capability wall, no `req.authz`
**Blast radius:** 11 routes; every API-key holder.
`router.ts:157` mounts only `requireApiKey, apiKeyWorkspaceMiddleware`. Neither sets `req.authz`. Zero permission checks across 791 lines of `externalApi.ts`. A VIEWER-scoped key can hard-delete automations, cascading to DM jobs, follow-ups and leads. Quotas are recorded on only 2 of 11 endpoints.
**📏 MEASURED 2026-08-19: 0 active API credentials, 0 ever used** (`last_used_at` null across the board). **The hole has never been exercised because no key has ever existed.**
**This makes A4 free to ship.** No deprecation window, no log-only phase, no customer comms — risk **SB5 is struck**. **Close it before the first key is issued**; the cost of this fix rises the moment someone creates one.
**Blocks launch:** YES if API is sold as a Business capability — the control being sold does not exist.

### G5 · Workspace creation completely uncapped
**Blast radius:** total revenue bypass under per-workspace pricing.
`workspaces.ts:228-281` performs no plan check and no count check. `freeWorkspaceLimit.ts` implements the correct rule and has **zero callers**. `workspacesIncluded` is resolved and never read by anything.
**Blocks launch:** YES.

### G6 · No DM metering of any kind
**Blast radius:** the Free tier's headline limit.
No limit key, no counter, no throw path. The HTML sells "500 DMs/month" on the Free card and in the matrix.
**Blocks launch:** YES — it is an advertised number with no implementation.

### G7 · Stories are mis-sold
**Blast radius:** refund risk on any package granting `scheduler:post_story`.
The capability is defined and gated, the composer offers it, a 9:16 preview renderer exists — and the server rejects every schedule and publish (`scheduledPosts.ts:702-705`, `:939-944`, `publishScheduledPost.ts:239-244`).
**Blocks launch:** YES for package authoring. The V4 HTML does not sell Stories, so this is a "must not appear in any package" constraint rather than a copy fix.

### G8 · `invalidateWorkspaceCtx` called from exactly one place
**Blast radius:** up to 300s of stale plan/billingStatus after every real billing transition.
Sole production caller is `adminRbac.ts:379`. Neither webhook, neither checkout, nor any of `applyWorkspaceEntitlements` / `markPaymentFailed` / `scheduleCancelAtPeriodEnd` / `finalizeCancellation` / `assignWorkspacePackage` invalidates it. `workspacePackages.refresh` drops entitlement/authz/limits caches but **not** `ws_ctx`.
**Blocks launch:** YES — it makes G3's fix unobservable and every upgrade laggy.

### G9 · Soft-deleted workspaces remain fully usable
**Blast radius:** deleted workspaces keep consuming entitlement; Agency slot release is impossible.
`workspaceMiddleware` (`workspace.ts:38-46`) and `apiKeyWorkspaceMiddleware` (`apiKeyWorkspace.ts:41-49`) omit `deletedAt` filtering — inconsistent with every sibling query in `workspaces.ts` (`:35,53,154,293`), which all filter correctly. Delete is `softDelete` (`:321`) and cascades nothing: subscription, package assignment, `platform_accounts` and memberships all survive.
**📏 MEASURED 2026-08-19: 3 soft-deleted workspaces exist**, against 74 live, and all 3 resolve today. Before A3 ships, confirm none of the 3 is in active use — a 3-row check, not an open investigation. See `04-risks.md` DL2.
**Blocks launch:** YES for Agency; serious regardless.

### G10 · INR is defined twice and the definitions disagree
**Blast radius:** live money on every Indian transaction.

| Plan | Advertised `marketing.config.ts` | Charged (`usdCents × 84`) | Gap |
|---|---:|---:|---:|
| Starter | ₹499 (`:49`) | ₹756 | +51% |
| Business | ₹2,499 (`:82`) | ₹6,636 | +166% |
| Agency | ₹9,999 (`:103`) | ₹25,116 | +151% |

A **third** lineage exists: `backfillPackagePrices.ts:150-151` links Razorpay `package_prices` from `packages.monthly_price_inr_paise` (the marketing lineage), not the ×84 rate. Same plan, same currency, different amount depending on the path. The "₹49 first month" offer (`marketing.config.ts:54-55`) has no checkout implementation at all.
**Blocks launch:** YES for INR.

### G11 · No geo routing to Razorpay
**Blast radius:** every V4 India price is unreachable by default.
`resolveProviderForCountry` hardcodes `"stripe"` (`billing.config.ts:192`); `resolveCheckoutProvider` accepts `country` and never reads it (`billing.ts:127-135`). Razorpay is reachable only if the client explicitly posts `provider:"razorpay"`. `lib/pricingRegion.ts` has working IP/profile geo detection (`IN → india`) wired only into marketing display, not checkout.
**Blocks launch:** YES for the India column of the pricing page.

### G12 · No payment grace period
**Blast radius:** every subscriber, on first failed invoice.
`markPaymentFailed` (`billingSubscription.ts:223-234`) sets `PAYMENT_FAILED` immediately; `planEnforcement.ts:30-35` then 403s every gated route. No dunning window, no attempt counter. Razorpay is harsher: `payment.failed`, `subscription.halted` **and** `subscription.pending` all route to the same call (`razorpay.ts:174-178`) — a merely pending subscription is treated as a hard failure.
**Blocks launch:** YES for Agency (20 client accounts stop at once); severe for everyone.

---

## 🟡 Blocks a specific V4 claim, or is a live bug

### Live bugs — present today, independent of V4

| # | Gap | Blast radius | Evidence |
|---|---|---|---|
| G13 | **`/checkout?plan=STARTER` renders Pro's feature list** under a raw "STARTER" heading. `validateSearch` accepts any string, so `?plan=NONSENSE` does the same with price "—" | Every Starter checkout — a live mis-selling bug | `checkout.tsx:31-33,38-42,213,232` |
| G14 | **Yearly checkout renders "$279/mo"** for a $279/**year** charge — `usdForInterval()` returns the interval total, `priceDisplay()` unconditionally suffixes `/mo` | Every annual purchase | `checkout.tsx:151-166` |
| G15 | `checkout.tsx` BUSINESS advertises **"5 team member seats"**; backend gives 20 | Business checkout copy wrong today | `checkout.tsx:53-60` vs `billing.config.ts:125` · **→ Phase 0.13** |
| G16 | `checkout.tsx` advertises **per-plan Instagram account limits** (5 / 10 / Unlimited). **No such limit exists anywhere in the backend** | Unenforceable marketing claim | `checkout.tsx:46,54,62`; no `maxInstagramAccounts` in `PlanLimits` · **→ Phase 0.12** |
| G17 | `checkout.tsx` advertises **"50,000 automated DMs/month"** on PRO. No monthly DM cap exists | Unenforceable claim | `checkout.tsx:47,55` · **→ Phase 0.11** |
| G18 | **Agency nav gated on the display string `"Agency"`**, not the plan key `AGENCY` — renaming the display string silently hides Agency nav for paying customers | All Agency customers | `app-sidebar.tsx:238-240` vs `app-context.tsx:88-89` |
| G19 | `module-registry.docs.tsx:171` calls `useCan()` with one arg against a two-arg signature → permission string `"<key>:undefined"` — **a permanently closed gate** | That feature is unreachable for everyone | `module-registry.docs.tsx:171`, `use-auth.ts:152-155` |
| G20 | `maxApiCredentials` counted **per user across all workspaces**, while the limit is resolved per workspace | Multi-workspace users blocked early / single-workspace users under-limited. **📏 0 credentials exist — the "loosens a limit" concern is theoretical; 0.5 can ship freely** | `apiCredentials.ts:87-89` |
| G21 | `apiRequestsPerDay` counts `schedulerPosts + automations`, **not requests** | The limit does not measure what it is named for | `externalApiUsage.ts:51` |
| G22 | Two workers (`schedulerAnalyticsSync`, `inviteExpirySweep`) never receive `bindWorkerEvents` — no completed/failed logs, no Sentry capture | Silent failure of the analytics sync | `worker.ts:348-365` |
| G23 | `creatorProgramApiLimiter` defined, exported, imported by nothing — creator-program routes are unlimited | Abuse surface | `rateLimiter.ts:73-81` |
| G24 | `apiRateLimiter` uses the **in-memory** store with no `keyGenerator` — 120/min per process, per IP; all traffic behind one NAT shares a bucket | Becomes 120×N on scale-out | `rateLimiter.ts:36-41`, mounted `index.ts:191` |
| G25 | Stripe webhook errors return 500 **after** `recordEvent`, so the retry is classified as a duplicate and short-circuits — failed work is never re-attempted | Silent billing data loss | `stripe.ts:151-163,294-298` |
| G26 | `checkout_`/`invoice_` synthetic ids are guarded nowhere and will be passed to `stripe.subscriptions.update()`/`.retrieve()` | **📏 LIVE INSTANCE: one ACTIVE AGENCY subscription (Razorpay) carries a synthetic provider id today.** Cancelling it now calls the provider with an id it never issued. **The live case is Razorpay — 0.10 names only Stripe call sites** | `billing.ts:361-366`; only `manual_` defended at `adminBillingMutations.ts:158` |
| G27 | Legacy metadata migration hardcodes `plan: Plan.STARTER` regardless of what was purchased | Mis-assigned plans on migrated rows | `billingSubscription.ts:360-361` |
| G28 | Razorpay webhook resolves via `notes.workspaceId` only, no fallback — externally-created subscriptions silently dropped with 200 | Lost payments | `razorpay.ts:83-88` |
| G29 | Razorpay idempotency key falls back to a `Date.now()`-suffixed string when `event.id` is absent, defeating duplicate detection | Double-processing | `razorpay.ts:101` |

### Blocks a specific V4 claim

| # | Gap | Blast radius | Evidence |
|---|---|---|---|
| G30 | `workspacesIncluded` never enforced — no call site exists | Agency's 20-workspace model has no floor. **This is a missing call site, not an architectural block — see the D10 note below** | grep: definitions and echoes only · **→ A5** |
| G31 | Daily caps (`schedulerPostsPerDay`, `automationsPerDay`) bite on the external API only | Internal UI is uncapped on both | `externalApiUsage.ts:56,60` |
| G32 | Analytics history not plan-gated; custom range accepts **366 days** on any plan | V4's 7/30/90 tiering is unenforceable | `adminDashboardMetrics.ts:134,152-155` |
| G33 | `followUpScheduler.ts:61` reads `BILLING_PLANS[plan].limits.dmFollowUps` directly, bypassing package and override resolution | A package that raises `dmFollowUps` is honoured at write time and ignored at send time | `followUpScheduler.ts:61` |
| G34 | `planEnforcement.ts:76` short-circuits at `limit >= 999` | Lowering `workflows` below 999 activates dormant enforcement against customers already over it | `planEnforcement.ts:74-92` |
| G35 | `api-docs-content.tsx:70-74` hardcodes the full price table ($0/$9/$29/$79/$299) | Any reprice makes API docs contradict the billing page on the same login | `api-docs-content.tsx:69-74` |
| G36 | `settings.tsx:640-644` duplicates `teamMembers` client-side | Drifts the moment seats change server-side | `settings.tsx:640-644` |
| G37 | `agency.ts:108` hardcodes `included = 30` and `extraMeteredRate: 9`, while `billing.config.ts:146` sets `workspacesIncluded: 999999` | Three conflicting Agency workspace counts (20 / 30 / 999999) | both files |
| G38 | `db/seed.ts:148-176` seeds `plan_catalog` with a **third** price/limit set, disagreeing with `BILLING_PLANS` | Virgin installs get wrong numbers | `db/seed.ts:148-176` |
| G39 | `planCatalogService.ensureSeeded`'s `orUpdate` omits `max_team_members`, `max_automations`, `max_workspaces` — the documented cause of `plan_catalog` staleness | Stale catalog forever | `planCatalog.ts:73-80` |
| G40 | `usdToInrRate ?? 84` hardcoded in two frontend files | Users quoted an FX rate from a client constant if the API omits it | `checkout.tsx:97`, `billings.tsx:525` |
| G41 | `billings.tsx:352` hardcodes "Yearly (save ~20%)"; real discounts are 18–22% by plan | Minor mis-statement | `billings.tsx:352` |
| G42 | Backend `highlights` contradict `limits` in the same object — FREE "1 workflow" vs `workflows: 10`; STARTER "Unlimited workflows" vs `999`; AGENCY "Unlimited workspaces" vs `999999` | `/billings` and `/checkout` show contradictory feature lists | `billing.config.ts:60,63,80,83,140,146` |
| G43 | Lead CSV export unbounded (`getMany()`, no limit) — a paid feature from Starter up | Will time out at volume | `leads.ts:69-77` |
| G44 | Analytics sync has **no plan filter** — Free workspaces swept identically to Agency | Undermines V4 §21.4's entire cost argument | `schedulerAnalyticsSync.ts:28-39` |
| G45 | No downgrade reconciliation — nothing deactivates the 12th automation when the cap drops to 3 | Every limit reduction in Phase C lands on over-limit workspaces with undefined behaviour | no such code |
| G46 | `POST /billing/package-checkout` implemented with no frontend caller; `getMarketingPlans()` (region-aware pricing) also has no callers | The two pieces V4 needs are built and unwired | `billing.ts:128`; `marketing-api.ts:15-17` |

### 🔴 Correction — G30 and G37 are not an architectural block (Decision D10)

An earlier framing of these two gaps — carried into `03-plan.md` and `phases/phase-f-agency.md` — described the Agency model as *"'20 workspaces' — architecturally impossible."* **That was wrong, and it hid a config change behind a schema problem.**

**Accurate:** one provider subscription backing 20 workspace entitlements is blocked by the `providerSubscriptionId` UNIQUE constraint (`src/entities/billing/WorkspaceSubscription.entity.ts:24`), and payment-state fan-out to 20 children does not exist. **The 20-workspace entitlement itself is a config change.**

| Gap | What it actually is | Delivered by |
|---|---|---|
| **G30** — `workspacesIncluded` never enforced | A **missing call site**. The limit is resolved, cached and exposed already | **A5** (the single enforcement point) |
| **G37** — three conflicting counts (20 / 30 / 999999) | A **config reconciliation**. `extraMeteredRate: 9` is dead copy and is removed, not decided | **C1** (`billing.config.ts:146` → 20) + **F-a1** (`agency.ts:108` → 20) |
| *Not listed as a gap here* — one subscription, one invoice, one renewal | **The genuine architectural block** | **F-b1** + **F-b2** |

**Consequence for sequencing:** the 20-workspace grant ships on the Phase A/C timeline and needs no Track F-b stage. Only *"One subscription, one invoice, one renewal date"* (`liffio-pricing-v4.html:349`) has to wait. See `06-doc-corrections.md` §2.

### 🔴 Gaps found by the paywall completeness sweep — see [`07-paywall-coverage.md`](07-paywall-coverage.md)

These are not new defects in the code; they are **gaps in the plan's coverage of the code**, found by auditing the stage list against the live registry.

| # | Gap | Blast radius | Evidence |
|---|---|---|---|
| **G54** | 🔴 **The package ladder is INVERTED — 📏 measured.** Free grants **140** features including all 6 `team:*` and all 9 `api:*`; Business grants **94** and none of either. `GATED_MODULES` withholds only 4 parent modules all-or-nothing, and `team`/`scheduler` are never actually withheld because their flags are true on every plan | **The audit's top finding.** A capability rule cannot deny what the package grants, so every gating stage is inert until packages are authored. And B1 run against these contents would **grant** 68 Free workspaces more than a paying Business workspace holds | 📏 `package_features` by package; `src/db/seeds/backfillPackages.ts:51-64`, `:157-171`, comment `:45-48` |
| **G54b** | 🟢 **A half-built `Growth` package exists and is ORPHANED** — 1 feature; zero rows in `workspace_packages`, `package_prices`, `package_limits`, `package_products`. Hand-created 69 minutes before the real packages, then abandoned | **Settled: B0 deletes and recreates it.** C2's `PRO → GROWTH` rename is then collision-free | 📏 `packages` + the four referencing tables |
| **G54c** | 🟡 **The inversion came from ONE write run, not legacy drift** — 📏 all five real packages created within **126 ms**. **But the writer is unidentified:** production code at an unknown commit | **B0(a) — replacing the contents — is unaffected and ships.** **B0(b) — preventing a future write from reproducing it — is a requirement with an unscoped implementation.** Local `Backend/` (`62b4177`) is not established to be the deployed release, so a fix aimed at local `backfillPackages.ts` may target a program that never ran | 📏 `packages.created_at`: 22:06:34.815 → .941 |
| **G54d** | 🟡 **The mechanism cannot be established from local source, and tracing it there is not worth the effort.** An all-or-nothing parent gate cannot produce 21 scheduler rows for Business and 28 for Free — but that reasoning describes **local** code that may not be what ran | **The one step that survives the provenance rule is a data question:** read `package_features.created_at` to see whether the feature rows were written with the packages or amended later. **The durable safeguard is the writer-agnostic monotonicity assertion**, which catches an inverted ladder whatever produces it | 📏 production data; provenance rule in `00-findings.md` |
| **G55** | 🔴 **No plan stage gates the Starter boundary** — `automation` (8), `biolink` (6), `lead` (6), `shortlink` (5), `scheduler` (9), `analytics:conversion_rate` | The Free→Starter conversion boundary is unenforced after the plan ships | `01-capability-map.md` vs `03-plan.md` B2a/B2b scope |
| **G56** | 🔴 **Lyra AI is unmetered when `x-workspace-id` is omitted.** `workspaceId` stays undefined, so the balance check is skipped and `consumeTokens` returns early — **the LLM call still runs** | Unlimited free AI for any authenticated user, on any tier | `src/api/routes/lyra.ts:64-73`, `:77`, `:138` |
| **G57** | 🔴 **`/api/v1/liffio/<lyra>` is mounted without `loadAuthorizationContext`** | `req.authz` never exists, so the capability wall fails open (`requireCapability.ts:173-179`). V4 sells Lyra per tier; that surface can never enforce a tier | `src/api/router.ts:155`; `src/api/routes/lyra.ts:33` |
| **G58** | 🟡 **`lyraGrowthAlert` has no plan predicate** — selects on `status = ACTIVE AND deletedAt IS NULL` + active Instagram account | Same shape as G44's analytics sync: a daily AI scan runs for every workspace including FREE. Gating the capability hides the output, not the cost | `src/queue/jobs/lyraGrowthAlert.ts:24-33` |
| **G59** | 🟡 **`analytics:story_metrics` is granted by every package** while Stories cannot publish. 📏 **And all five real packages grant `scheduler:post_story`** — B7 has five live targets, not a hypothetical | Same defect as G7, missed by B7's strip list | 📏 `package_features`; `src/generated/modules.ts`; rejection at `scheduledPosts.ts:702-705` |
| **G60** | 🟡 **`features.teamEnabled` and `features.whiteLabel` have no runtime consumer** — `teamEnabled` is read only by the package seed; `whiteLabel` by nothing at all | Flipping `teamEnabled` to Business changes nothing without G54's fix. `whiteLabel` is dead config | `src/services/*` — grep returns `backfillPackages.ts:58` only |
| **G61** | 🟡 **Three further mounts lack `loadAuthorizationContext`**: `/api/creator/v1`, `/api/v1/billing`, `/api/v1/affiliate` | No paid capability leaks today (all three surfaces are all-tier), but each is a permanent fail-open if a gated capability is ever added there | `src/api/router.ts:136,148,153` |
| **G62** | 🟡 **The outage fallback is the 8 seeded rules.** `FALLBACK_CAPABILITY_RULES` is a committed snapshot; no stage re-runs the codegen after seeding new rules | A Redis/Postgres blip degrades the wall to **today's** coverage, un-gating everything Phase B added | `src/generated/capabilityRoutes.ts`; `requireCapability.ts:192-200` |

**G54 and G55 block launch** on the same terms as G1 and G2 — the V4 matrix cannot be enforced without them. **G54 is now the audit's top finding**, ahead of G2: G2 says the route layer has no enforcement points; G54 says the layer those points consult is inverted.

**All three are now covered by stages** — **B0** (G54, G54b, G54c), **B2c** (G55), **F-a3**, plus scope extensions to A4, B2a and B7. See [`03-plan.md`](03-plan.md).

---

## 🟢 Should fix, does not block

| # | Gap | Evidence |
|---|---|---|
| G47 | Support tiering is an operational promise with no product mechanism | V4 §10 concedes this |
| G48 | `packages.is_default` column exists in migration + service code but **not on the entity** — TypeORM unaware | `1785900000000-AddPackageIsDefault.ts:34`; `defaultPackage.ts:36` |
| G49 | `src/utils/planLimits.ts` exports `PLAN_LIMITS` with zero importers | `planLimits.ts:11-26` |
| G50 | `capabilityResolver.ts` and `modules/registry.ts` are a complete second gating mechanism with zero production callers | `capabilityResolver.ts:45,68` |
| G51 | `SubscriptionStatus.TRIALING`, `SubscriptionStatus.PAUSED` and `BillingStatus.CANCELED` are declared and never assigned | `enums.ts:73,76,82` |
| G52 | `worker.ts:370-389` startup log enumerates only 15 of 20 queues | `worker.ts:370-389` |
| G53 | `upsertWorkspaceSubscription` coerces absent periods to `null`, erasing a previously stored `currentPeriodStart` on a partial sync | `billingSubscription.ts:131-132,146-147` |

---

## Launch-blocking rollup

| Category | Count | Must close before |
|---|---|---|
| 🔴 Blocks launch | 12 (G1–G12) | Any V4 tier is sold |
| 🟡 Live bugs | 17 (G13–G29) | G13/G14 before **any** checkout traffic — they mis-sell today |
| 🟡 Blocks a V4 claim | 17 (G30–G46) | The specific claim ships |
| 🟢 Non-blocking | 7 (G47–G53) | — |
| 🔴🟡 **Plan-coverage gaps** | **9 (G54–G62)** | **G54 + G55 before any tier is sold** — see [`07-paywall-coverage.md`](07-paywall-coverage.md) |

**The shortest honest path to selling V4:** G1, G2, G3, G8 (make the matrix real), then G5, G6 (make the Free tier real), then G10, G11 (make INR real). G13/G14 should ship immediately regardless of V4 — they are mis-selling customers today.

**Five live-bug gaps now carry a Phase 0 stage:** G13 → 0.1 · G14 → 0.2 · **G17 → 0.11** · **G16 → 0.12** · **G15 → 0.13**. The last three were promoted out of E7 because they are false against the **current** backend, not merely stale against V4's targets (Correction P6).

### 📏 What production measurement changed in this file (2026-08-19)

| Gap | Change |
|---|---|
| **G2** | **119 of 125 ungated — measured**, not 116 of 121 estimated. Codegen snapshot is 4 keys stale |
| **G1** | **72 of 74 live workspaces have no package row.** The ceiling is inert platform-wide, and **all 4 paying workspaces are among them** |
| **G3** | **The leak has a live instance** — a CANCELED BUSINESS workspace still holds its `workspace_packages` row today |
| **G4** | Still real, but **0 API credentials exist and none has ever been used** — the hole is unexploited and free to close. Risk SB5 struck |
| **G26** | **One ACTIVE Agency subscription carries a synthetic provider id today** — the guard is a live fix, not a precaution |
| **G9** | **3 soft-deleted workspaces** exist and are reachable |

**None of these downgrades a 🔴.** G1–G12 all still block launch; the measurements changed how expensive they are to close, not whether they must be.
