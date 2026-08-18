# 06 — Document Corrections

Where `PRICING_PACKAGES_V4.md` and `liffio-pricing-v4.html` are **wrong about the code**. Neither file was modified.

Corrections are ordered by consequence: errors that invalidate a commercial argument first, then factual errors, then stale line references.

---

## 1. The baseline error — §2.4, §19, §28 argue from prices that are not in the codebase

**Severity: invalidates the doc's central revenue argument.**

V4's framing throughout is that it *raises* Business and Agency:

> §2.4 — *"Raises the Business anchor… That is a **20% ARPU increase on every Business customer**"*
> §2.4 — *"a $10 Business increase lifts Agency from $449 to $549 — a **22% increase on the highest-value segment**"*
> §28 — *"Up from V3's $49 because Growth now occupies the middle."*

**The configured prices are different, and the direction of change reverses:**

| Plan | Doc's stated V3 baseline | **Actually configured** | V4 target | **Real delta** |
|---|---:|---:|---:|---|
| Starter | $9 | $9 (`src/config/billing.config.ts:81`) | $9 launch | none |
| Growth / PRO | — (new) | **$29** (`:101`) | $29 | **exact match** |
| Business | $49 | **$79** (`:121`) | $59 | **−$20 — a price CUT** |
| Agency | $449 | **$299** (`:141`) | $549 | **+$250 — an 84% RISE** |

**Consequences:**
- The "+20% ARPU on every Business customer" is actually a **−25% cut** against what Business is configured at.
- The "+22% on the highest-value segment" is actually **+84%**.
- §19.1's sensitivity table derives every Agency option from "Business is $59/mo × 20 = $1,180". Against the configured $79, twenty Business subscriptions are **$1,580**, and every discount percentage in that table is wrong.
- §19.2's cannibalisation analysis ("Small studio 5 accounts → $295") is computed at $59; at the configured $79 it is $395, which moves the Agency crossover point.
- §20 and §28's revenue reasoning inherit all of the above.

**What is still sound:** the *ladder shape* argument (1.93× then 2.03×) is about the target prices only and survives intact. The reasoning for why Growth should exist does not depend on the baseline.

### ✅ SETTLED — Decision D2: keep the targets, discard the reasoning

**The prices ship as written.** $9 launch / $15 standard · $29 · $59 · $549.

**Why they survive the baseline error.** They anchor to **competitors**, not to our configured baseline: Growth at $29 is exactly ManyChat Pro; Business at $59 undercuts ManyChat Business ($69, with AI charged extra) by 14%. A wrong V3 baseline does not move a competitor's price, so it does not move the target.

**What is discarded — explicitly:**

| Discarded | Why |
|---|---|
| §2.4's ARPU arithmetic | Computed against $49 Business, which is not in the code |
| §19.1's sensitivity table | Every row derives from "Business is $59 × 20 = $1,180"; the configured $79 makes it $1,580 |
| §19.2's cannibalisation analysis | Same defect — the Agency crossover point moves |
| §28's revenue reasoning | Inherits all of the above |

**Kept:** the ladder-shape argument (1.93× then 2.03×), which depends only on the target prices.

**So the correction to the doc is the second option, not the first.** Do not restate §2.4/§19/§28 against the configured baseline — **delete the revenue arithmetic and state that V4's numbers are absolute, competitor-anchored targets** for which the V3 comparison is not evidence. Rewriting the arithmetic against $79/$299 would produce a *correct* calculation of an argument nobody is relying on.

### ✅ 📏 D3 also settled — measured 2026-08-19

What happens to *existing* Business and Agency subscribers was the last open question here. **It is answered: there are four of them.**

| Plan | Status | Count |
|---|---|---:|
| AGENCY | ACTIVE | **3** |
| BUSINESS | ACTIVE | **1** |
| STARTER | ACTIVE | **1** |
| BUSINESS | CANCELED | 2 |

**5 active subscriptions · 4 active paying workspaces.** Reprice directly and notify each customer individually; the "migrate Business down / grandfather Agency at $299" rule is withdrawn as unnecessary at this scale.

**This strengthens the correction above rather than weakening it.** §19.1's sensitivity table and §19.2's cannibalisation analysis were not merely computed from a wrong baseline — they model a subscriber population that does not exist. Twenty Business subscriptions is not a rounding error against reality; **there is one.** Delete the arithmetic; do not repair it.

---

## 2. Agency — the blocker is the *billing*, not the workspace count

**Severity: the marketing contract advertises a mechanism that does not exist — but a narrower one than this audit first claimed.**

### 🔴 This section's own earlier claim was wrong — Decision D10

**Wrong (previously stated here and in `03-plan.md`):** *"'20 workspaces' Agency — architecturally impossible."*

**Accurate:** one provider subscription backing 20 workspace entitlements is blocked by the `providerSubscriptionId` UNIQUE constraint (`src/entities/billing/WorkspaceSubscription.entity.ts:24`), and payment-state fan-out to 20 children does not exist. **The 20-workspace entitlement itself is a config change.**

The two halves separate cleanly:

| Half | Blocked? | Delivered by |
|---|---|---|
| **The 20-workspace grant** — Agency gets 20 slots, workspaces created on demand against the cap | **No** | C1 (`workspacesIncluded` → 20) + F-a1 (`agency.ts`) + A5 (enforcement) |
| **One subscription backing 20 workspaces** — one invoice, one renewal, payment state fanned out | **Yes** | F-b1 + F-b2 |

> **📏 MEASURED 2026-08-19: there are 3 ACTIVE Agency subscriptions** — 2 Stripe monthly, 1 Razorpay monthly — and **one of the three carries a synthetic `provider_subscription_id`**. Track F-b is therefore not purely forward-looking work: a synthetic-id row already exists against a paying Agency customer, and Phase 0.10 must cover the **Razorpay** path before it can be cancelled or synced cleanly.

V4 §4.2 and §25.2 are **correct about the constraint**. §26.3's *"Agency cannot be sold self-serve until §23 ships"* and §24.9's sales-assisted recommendation both stand — but they are true because of the **billing** half, not because 20 workspaces cannot be granted.

**The HTML does not carry the caveat at all.** It presents Agency as a live, purchasable product:

| HTML | Line | Reality | Blocked by |
|---|---|---|---|
| `"20 workspaces"` flag badge | `liffio-pricing-v4.html:340` | **Deliverable** once C1 + F-a1 + A5 land — Agency is configured at `workspacesIncluded: 999999` today | F-a track (not blocked) |
| `"Slot-based allocation — create workspaces as you win clients"` | `:350` | No slot mechanism exists; `workspacesIncluded` is resolved and checked nowhere | A5 (create) + F-a2 (release) |
| `"One subscription, one invoice, one renewal date"` | `:349` | **Genuinely blocked** — requires the F-b1 parent table | **F-b1, F-b2** |
| `"Slots left — 10 of 20"` calculator readout | `:442,653` | Computed client-side from a number the backend cannot enforce | A5, F-a2 |
| `"Workspaces per subscription — 1/1/1/1/20"` matrix row | `:754` | Configured `999999` | C1 + F-a1 |
| CTA `"See the maths"` → interactive calculator | `:345,399-448` | Sells a purchase decision on a product that cannot yet be **provisioned as one subscription** | **F-b1, F-b2** |

**Correction needed:** the HTML must carry the §24.9 caveat — Agency as "contact sales" rather than a self-serve CTA — **until F-b1 and F-b2 land**, not until the whole of Track F lands. The single line that must not ship as written is `:349` *"One subscription, one invoice, one renewal date."* The 20-workspace count is honest as soon as F-a ships.

**Compounding:** the codebase contains a **third** Agency workspace count. `src/api/routes/agency.ts:108` hardcodes `const included = 30;` with `extraMeteredRate: 9` (`:122`) — a metered-overage rate with no billing implementation, while V4 §9 explicitly excludes *"Metered overage billing beyond 20 workspaces"*. Three numbers in play: **20** (V4) / **30** (`agency.ts`) / **999999** (`billing.config.ts`). Per D10 the rate is **dead copy and is removed**, not decided — stage F-a1.


---

## 3. §11's enforcement key is applied incorrectly to API keys

**Severity: sells a Business-exclusive feature that Starter already has.**

§11 marks API keys **"✅ Enforced today (0 / 0 / — / 10)"** — the doc's own key for *"mechanism exists **and** the configured value already matches this recommendation"*.

**Actual configured values:** `maxApiCredentials` = **0 / 2 / 5 / 10 / 50** (`src/config/billing.config.ts:67,87,107,127,147`).

Starter has **2** API credentials and PRO/Growth has **5** — both of which V4 §10.9 and the HTML matrix (`liffio-pricing-v4.html:761`) show as `—` / not included. Agency has **50**, not 10.

**Worse, the feature gate opens at Starter, not Business:** `gates: { api: Plan.STARTER }` on every plan (`:73,93,113,133,153`) and `apiEnabled: true` from Starter up (`:92`).

**Correction needed:** this row is not `✅ Enforced today`. It is a **config change plus a gate change** — and shipping V4's API-as-Business-feature without it means selling Business on a capability Starter customers already hold.

---

## 4. §21.3's rate-limiter blocker was already fixed

**Severity: a 🔴 blocker in §25.15 that does not exist.**

> §21.3 — *"🔴 **All six Redis limiters collide on one key.** `redisStore(prefix)` ignores its `prefix` argument (`middleware/rateLimiter.ts:6-9`), so every limiter writes to `rl:<userId>`. A user's affiliate API calls consume their Lyra AI allowance."*

**Refuted.** `src/api/middleware/rateLimiter.ts:17-21` forwards `prefix` into `RedisStore`'s options at line 19. The block comment at `:7-16` documents this as a bug that was **already fixed**, and a regression test asserts distinct keyspaces (`src/api/middleware/rateLimiter.test.ts:75`). Every limiter has its own prefix: `rl:lyra-api:`, `rl:affiliate-api:`, `rl:invite-create:`, etc.

**Correction needed:** remove from §21.3, and remove "fix the rate-limiter Redis key collision" from §25.15's launch-critical list. The Lyra 20/min budget **can** be modelled as independent, contrary to the doc's warning.

**Still true from the same section:** `apiRateLimiter` does use the in-memory store (`:36-41`) and does become 120/min × N on scale-out. `creatorProgramApiLimiter` is defined and never mounted (`:73-81`).

---

## 5. §21.1 and §21.5's worker counts are wrong

**Severity: low — the capacity conclusion is unaffected.**

| Doc claim | Actual |
|---|---|
| §21.5 *"**41 total** across 18 BullMQ workers"* | **43 slots across 20 workers** (`src/queue/worker.ts:129-254`, array at `:256-277`), **plus 2 per active plugin** (`src/plugins/queue.ts:154-156`) |

**Where "18" comes from:** only 18 workers receive `bindWorkerEvents` (`worker.ts:348-365`). `schedulerAnalyticsSyncWorker` and `inviteExpirySweepWorker` are omitted — so those two queues emit no completed/failed logs and no Sentry capture. That is a real **observability** finding the doc missed, not a capacity figure. Separately, the startup log enumerates only 15 of 20 queues (`:370-389`).

**Why it matters more than the number:** §21.4 builds the entire commercial case for gating post analytics at Growth on the analytics-sync job's cost — and that job is one of the two that fails silently.

---

## 6. §4.2's entitlement claim is the doc's most consequential error

**Severity: high — it asserts as ✅ Enforced the thing that makes V4 unenforceable.**

> §4.2 — *"Entitlement ceiling is per workspace | `workspace_packages.workspace_id` UNIQUE | ✅ **Enforced**"*

The UNIQUE constraint is real (`src/entities/registry/WorkspacePackage.entity.ts:13`). But the doc infers from it that a ceiling *is applied*. It is not, in two ways:

1. **The ceiling derives from the package, never from the plan.** `src/services/entitlement.ts` and `src/services/authzBuild.ts` do not import `Plan` or `BILLING_PLANS`. There is no plan → capability mapping anywhere in the codebase.
2. **With no package row, there is no ceiling at all.** `applyEntitlement` returns permissions untouched — `if (!entitlement) return permissions;` (`entitlement.ts:207`). The file's own header estimated 35–45 workspaces in exactly that state (`:15-17`); **📏 the measured figure is 72 of 74 live workspaces**, with only 2 `workspace_packages` rows platform-wide.

Combined with only 8 capability-route rules covering **6** capabilities (📏 measured 2026-08-19), **119 of 125 capability keys have no enforcement of any kind**. The codebase says so: `src/services/capabilityReconciler.ts:11-15` — *"most capabilities are enforced nowhere and the capability wall fails open on a miss."*

**📏 The measurement makes this correction stronger, not weaker.** §4.2 asserts the ceiling is ✅ Enforced. In production, **97% of workspaces have no ceiling at all — including every paying customer.**

**Correction needed:** §4.2's row should read 🔴, not ✅. §22's feature-gating table describes an intent, not a mechanism. This correction reframes V4 from a configuration exercise into **a gate-layer build — and, 📏 once production was measured, a package-authoring build as well.** See `01-capability-map.md`, where **44 rows are `NEW_GATE`**, and [`07-paywall-coverage.md`](07-paywall-coverage.md) §1.2: the entitlement layer §4.2 points at not only fails to enforce a ceiling, it grants **Free more than Business** (140 features vs 94).

---

## 7. §3, §16 and the HTML sell India via Razorpay; no routing exists

**Severity: high — the entire India column is unreachable by default.**

> §3 — *"India (INR — billed via Razorpay)"* · §16 — *"Global via Stripe, India via Razorpay"* · HTML `:505` — *"Global billing via Stripe, India via Razorpay"* · HTML `:587` — *"India prices exclusive of GST, billed via Razorpay"*

**No geo routing exists.** `resolveProviderForCountry` hardcodes `"stripe"` with an underscore-prefixed, unread parameter (`src/config/billing.config.ts:192`). `resolveCheckoutProvider` accepts `country` and never reads it (`src/services/billing.ts:127-135`). `User.country` is read at `src/api/routes/billing.ts:98,111,115` and discarded. The package-checkout path hardcodes `"stripe"` outright (`billing.ts:157`).

Razorpay is reachable **only** if the client explicitly posts `provider: "razorpay"` — a manual toggle, not routing.

**Ironically, the capability exists and is unused:** `src/lib/pricingRegion.ts` performs real IP/profile geo detection (`IN → "india"`) and feeds **only** the marketing display service, never checkout.

**Correction needed:** §16's "billed via Razorpay" describes an intent. Until D3 ships, an Indian buyer reaching checkout is charged in USD via Stripe.

---

## 8. §16's INR reconciliation understates the problem

**Severity: high — there are three sources, not two.**

§16 correctly identifies that INR is defined twice and the definitions disagree, and its numbers are right (₹499 vs ₹756, ₹2,499 vs ₹6,636, ₹9,999 vs ₹25,116 — all confirmed at `src/config/marketing.config.ts:49,82,103` and `scripts/setupRazorpayPlans.ts:52`).

**It misses a third lineage:** `src/db/seeds/backfillPackagePrices.ts:150-151` links Razorpay `package_prices` from `packages.monthly_price_inr_paise` — the marketing lineage — **not** from the ×84 rate. So the amount charged depends on **which checkout path** the buyer takes: plan checkout (`POST /checkout`) uses the Razorpay plan objects built at ×84; package checkout (`POST /billing/package-checkout`) uses `package_prices`.

**Correction needed:** §16's two-column table should be three. And §25.4's severity is right but its scope is too narrow.

### ✅ SETTLED — Decision D4: an explicit price sheet, no FX derivation

All three lineages converge on **literal per-plan INR values from V4 §3**. There is no conversion rate anywhere in the resolved design.

| Plan | Monthly | Yearly |
|---|---:|---:|
| Free | ₹0 | ₹0 |
| Starter — launch | ₹499 | ₹4,999 |
| Starter — standard | ₹799 | ₹7,999 |
| Growth | ₹1,499 | ₹14,999 |
| Business | ₹2,499 | ₹24,999 |
| Agency | ₹22,999 | ₹2,29,999 |

**Note Agency: ₹22,999 matches none of the three current sources** (advertised ₹9,999, charged ₹25,116, `package_prices` ₹9,999). It is a new number, not a reconciliation of old ones.

**The `usdCents × 84` path is deleted**, not corrected — `usdToInrRate` (`billing.config.ts:184`) and its application (`scripts/setupRazorpayPlans.ts:52`). `packages.monthly_price_inr_paise` is reconciled to the same literals so the third lineage converges too. **`billing.config.ts:181-183` already anticipated this** — *"Replace with a real INR price sheet if INR pricing ever diverges from a straight conversion"* — and it has diverged by up to +166%. Stage **D1**.

**"₹49 first month" (`marketing.config.ts:54-55`): REMOVE the string.** Settled as removal, not as build-or-remove.

### ✅ SETTLED — Decision D5: ship INR, capture place of supply

INR ships. **Prices stay exclusive of GST**, as the HTML already states (`:505`, `:587`). Customer **country and state capture is a hard requirement inside D1** — not a later stage.

Place of supply determines IGST vs CGST/SGST, and B2B customers cannot claim input tax credit without a compliant invoice. In scope: persist country + state against the subscription (today `User.country` is read at `src/api/routes/billing.ts:98,111,115` and **discarded**; state is never captured), and surface both on `BillingInvoice`. **Out of scope: rate calculation and filing logic** — flag anything beyond capture for a tax specialist rather than shipping a guess.

---

## 9. Stale or incorrect file references

| Doc reference | Correction |
|---|---|
| `config/env.ts:203,205,207-212,215-218,222` (§21.2) | **File does not exist.** It is `src/env.ts`. Line numbers within it are correct |
| `queue/worker.ts:124-127` (send-dm, §21.1) | `src/queue/worker.ts:129-132` — concurrency 5 is correct |
| `queue/worker.ts:217-221` (analytics concurrency, §21.4) | `src/queue/worker.ts:222-226` — concurrency 1 is correct |
| `queue/worker.ts:305` (hourly schedule, §21.4) | `src/queue/worker.ts:323-325` — `"0 * * * *"` is correct |
| `middleware/rateLimiter.ts:103-111` (Lyra limiter, §21.2) | `src/api/middleware/rateLimiter.ts:119-127` — 20/min is correct |
| `middleware/rateLimiter.ts:6-9` (§21.3) | See §4 above — describes pre-fix state |
| `PackagePrice.entity.ts` / `PackageLimit.entity.ts` | Neither exists. `package_prices` / `package_limits` are raw-SQL tables (`src/db/migrations/1785400000000-AddPackageBillingCatalog.ts:46,85`) accessed via `AppDataSource.query` |
| Plan allowances in `src/lib/aiTokens/` (§21.2) | Not there — that directory holds only `tokenFormula.ts`. Allowances live in `ai_token_plan_configs`, seeded at `src/db/migrations/1783500000000-AddAiTokenMetering.ts:54-61` |
| `webhooks/stripe.ts:66-72` *"returns one arbitrary row"* (§23.4) | The `findOne` is real (`:67`), but `providerSubscriptionId` is UNIQUE — at most one row can match. It is also the **4th** of six resolution strategies (`:36-109`), not the first |
| `WorkspaceStatus.SUSPENDED` is a dead enum value (§24.6) | No longer dead — written by `setWorkspaceStatus` (`src/services/adminWorkspaceMutations.ts`) in the recently-landed admin control plane. **`SubscriptionStatus.PAUSED` is genuinely dead** (zero references) |
| Basis commits (header) | `749f3f6` and `a43352f` both exist, but HEAD is **+76 / +59 commits**. `workspaceLimits.ts`, `workspacePackages.ts`, `aiTokenService.ts`, `worker.ts` and `rateLimiter.ts` have all changed materially since |

---

## 10. Claims the HTML makes that the code cannot support

The HTML is the marketing contract. These rows must not ship as stated — cross-referenced to the blocking stage in [`03-plan.md`](03-plan.md).

| HTML claim | Line | Blocker | Stage |
|---|---|---|---|
| Free `"DMs / month — 500"` | `:249`, `:757` | **No DM metering of any kind exists** | B5 |
| Every ✓/— in the 90-row feature matrix | `:666-775` | **📏 119 of 125** capability keys ungated (measured) | B2a/B2b |
| Growth `"Instagram post analytics"` as the tier boundary | `:293`, `:723-725` | No gate — Free workspaces see it today | B2a |
| Growth `"Best-time-to-post heatmap"` | `:295`, `:694` | Feature exists and is ungated; **no capability key at all** | B3 → B2a |
| Business `"Team management"`, `"External API — 10 keys, 5,000 requests/day"` | `:320`, `:325`, `:743-751`, `:761-762` | `team:*` and `api:*` ungated; API opens at **Starter** | B2b |
| Business `"AI token rollover up to 25,000"` | `:327`, `:739` | Flag exists, off by default, **null cap = uncapped rollover** | C3 |
| Agency `"20 workspaces"` | `:340`, `:754` | Configured `999999`; **not** architecturally blocked — see §2 | C1 + F-a1 + A5 |
| Agency `"Slot-based allocation"`, `"Slots left"` | `:350`, `:442` | No slot mechanism — create-cap and release both unbuilt | A5 + F-a2 |
| Agency `"One subscription, one invoice, one renewal date"` | `:349` | **Genuinely blocked** by the UNIQUE constraint + missing fan-out — see §2 | F-b1, F-b2 |
| Agency `"AI tokens 75,000 × 20"` | `:360`, `:738` | Agency is configured `-1` (unlimited) | C3 |
| India ₹ column (currency toggle) | `:204`, `:519-525` | No geo routing; three disagreeing INR sources | D1, D3 |
| `"India prices exclusive of GST"` | `:505`, `:587` | No GST, no place of supply, no tax field on invoices | D1 / Decision D5 |
| Launch box: `"come back to Starter within 12 months and it's restored"` | `:372`, `:377` | Restoration rule **will not be built** — D5 ships the cohort marker only. **Must be removed from the HTML — see §11** | **removal, not a stage** |
| `"Analytics history — 7/30/90 days"` by tier | `:763` | Not plan-gated; custom range accepts **366 days** on any plan | B6 |
| `"Automations — 3/25/75/150/150"` | `:756` | Configured 10/999/999/999/999; enforcement short-circuits at ≥999 | C1 |
| `"Team seats — 1/3/5/15/15"` | `:759` | Configured 2/5/10/20/50 | C1 |
| `"Scheduled posts per day — 3/30/100/200/200"` | `:760` | Configured 5/10/50/200/999999; enforced on external API only | C1 + B4 |
| `"Support — Community/Email/Email/Priority/Priority"` | `:774` | No support routing mechanism exists (V4 §10 concedes this) | — |

**Not a problem:** the HTML correctly does **not** sell Instagram Stories, which the server rejects (V4 §27.3). That restraint should be preserved — see `02-gaps.md` G7. **But `analytics:story_metrics` is still granted by every package** — metrics for a feature that cannot publish. B7's strip list must cover it (`07-paywall-coverage.md` K4).

### The known-unenforceable list lives in `07-paywall-coverage.md` §5

Claims that **cannot be enforced even after every stage ships** are enumerated there with dispositions. Cross-reference:

| Claim | §5 id | Where it appears above |
|---|---|---|
| Per-plan Instagram account limits | **K1** | Phase 0.12 — arithmetically impossible, not merely unbuilt |
| Support tiering | **K2** | §10's support row — an operational promise, never a product feature |
| "50,000 automated DMs/month" | **K3** | Phase 0.11 — B5 builds Free's meter only, no paid-tier ceiling |
| Instagram Stories + story metrics | **K4** | This note — B7 |
| Historical post performance | **K5** | Correctly excluded from V4; keep it excluded |
| Agency "one subscription, one invoice" | **K6** | §2 — F-b1/F-b2 |
| "AI token rollover up to 25,000" | **K7** | §10's rollover row — **enforceable, but only if C3 writes both columns.** A null cap means *uncapped* rollover |

---

## 11. 🔴 MANDATORY REMOVAL — the price-lock restoration promise must come out of the HTML

**Severity: the HTML promises a mechanic that the plan explicitly does not build.**

**Decision D6 settled the scope of the launch price-lock as *minimum viable*:**

| | |
|---|---|
| **BUILD** | A flag/timestamp on the subscription marking GA-window cohort membership, so the founding cohort is recoverable later |
| **DO NOT BUILD** | The 12-month upgrade-restoration rule from V4 §17 |
| **DO NOT REBUILD** | The pinning half — `package_prices.is_current` + `packagePriceId` already holds a subscriber at the price they bought (`src/services/billing/packageCheckout.ts:232-235`) |

**Consequence — mandatory, not optional.** These two lines describe the mechanic that will not exist, and must be removed from `liffio-pricing-v4.html` before launch:

| Line | Text to remove |
|---|---|
| `:372` | *"Trying Growth doesn't cost you the lock — it's suspended, not lost."* |
| `:377` | *"If you upgrade → Lock suspended; come back to Starter within 12 months and it's restored"* |

**What remains true and may stay.** Founding subscribers **do** keep $9 for as long as they hold the plan — the pinning half exists and works. Only the *upgrade-and-return* path is unsupported: a founding subscriber who moves to Growth and comes back gets the then-current Starter price.

**Why removal rather than a caveat.** The promise is load-bearing on a purchase decision — it exists specifically to remove the customer's fear of upgrading. A footnote does not neutralise it. When the restoration rule ships, the copy can return; the cohort marker built in D5 is what makes that possible.

**This correction is not conditional on any pending data.** D6 is settled.

---

## Summary

| Correction | Severity | Effect | Status |
|---|---|---|---|
| §1 baseline error | **Critical** | Invalidates the revenue arithmetic in §2.4, §19, §20, §28 | **Settled (D2)** — targets kept, reasoning discarded |
| §6 entitlement claim | **Critical** | Reframes V4 from configuration to gate-layer build | Standing |
| §11 price-lock restoration | **High** | HTML promises a mechanic D5 will not build | **Settled (D6)** — mandatory removal. 📏 Only 1 of 7 subscription rows is price-pinned today |
| §2 Agency in the HTML | **High** | Marketing contract sells one-subscription-for-20 self-serve | **Corrected (D10)** — narrower than first claimed |
| §7 India via Razorpay | **High** | Entire India column unreachable by default | Standing — stage D3 |
| §8 INR — three sources | **High** | Customers charged up to +166% over advertised | **Settled (D4/D5)** — explicit price sheet, no FX |
| §3 API keys "enforced" | **High** | Business sold on a capability Starter already has | Standing |
| §4 rate-limiter blocker | Medium | Removes a phantom 🔴 from the launch-critical list | Standing |
| §5 worker counts | Low | Conclusion unaffected; surfaces a real observability gap | Standing |
| §9 stale references | Low | Navigational only | Standing |

**Two corrections in this file were made against this audit's own earlier claims,** not against V4: §2 (the Agency blocker is narrower than "architecturally impossible") and §1's resolution (the fix is to delete the revenue arithmetic, not to recompute it).

### 📏 What the 2026-08-19 production measurement added

| § | Change |
|---|---|
| **§1** | D3 settled — **4 active paying workspaces**. The discarded revenue arithmetic models a population that does not exist |
| **§2** | 3 ACTIVE Agency subscriptions; one carries a synthetic provider id |
| **§10** | The DM row (B5) is unchanged, but its stage is now sequenced behind Jira LF-66 |
| **§11** | Only **1 of 7** subscription rows is price-pinned — the primitive is not load-bearing yet, so D5's marker is cheap to add now |

**No correction in this file was withdrawn by the measurements.** Every claim the V4 doc and HTML get wrong about the code, they still get wrong. What changed is the *cost of fixing them*, not whether they are wrong.
