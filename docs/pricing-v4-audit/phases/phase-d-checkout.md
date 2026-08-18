# Phase D — Checkout & Billing

Everything here touches **live money**. No stage may run against production providers before it has been verified in sandbox (`BILLING_MODE=sandbox`, `billingConfig.isSandbox` at `src/config/billing.config.ts:159`).

All stages are Backend-only.

> **Rule for this entire phase: never mutate an existing Stripe price or Razorpay plan object.** Create new ones and repoint the env SKU ids. Existing subscribers stay on their original object unless explicitly migrated, and that migration is a separate decision (D3 in `05-decisions.md`).

---

## D1 · Reconcile INR to one source of truth

| | |
|---|---|
| **Goal** | One INR number per plan, charged and advertised identically |
| **Repo** | Backend |
| **Files touched** | `src/config/billing.config.ts:184` (`usdToInrRate: 84`, comment `:181-183`), `scripts/setupRazorpayPlans.ts:52` (`amountPaise = usdCents × rate`), `src/config/marketing.config.ts:49,82,103` (advertised ₹499 / ₹2,499 / ₹9,999), `:54-55` (the unimplemented "₹49 first month"), `src/db/seeds/backfillPackagePrices.ts:150-151` (links Razorpay `package_prices` from `packages.monthly_price_inr_paise` — a **third** lineage), `src/services/marketing/marketingPlansService.ts:19,21-24` (`formatInr`, `ANNUAL_DISCOUNT = 0.8`) |
| **Config-only vs new code** | Config + **new code** (country/state capture) + **external provider objects** |
| **Migration required** | **Y** — persisting country + state against the subscription and surfacing both on `BillingInvoice` (see the hard requirement below). Razorpay plan objects must also be regenerated |
| **PREVIEW-ONLY** | **YES** — regenerating Razorpay plan objects is an external write |
| **Dependencies** | **Decision D4 is SETTLED — no longer blocked.** **C2** if Growth needs its own INR SKU |
| **Rollback** | Old Razorpay plan objects remain; repoint env SKU ids back. The country/state columns are additive and safe to leave |
| **How to verify** | For each plan: the price shown at checkout, the price in the Razorpay plan object, and the advertised marketing price are the same number, **and equal the literal in the price sheet below**. `scripts/setupRazorpayPlans.ts` idempotency check (`:57-62`) does not create duplicates on re-run. A completed INR checkout persists country **and state**, and both appear on the invoice |
| **Safe to ship independently** | **No** |

### ✅ SETTLED (Decision D4) — the INR price sheet is the source of truth

**An explicit per-plan INR price sheet with literal values from V4 §3. No FX derivation anywhere.**

| Plan | Monthly | Yearly |
|---|---:|---:|
| Free | ₹0 | ₹0 |
| Starter — launch | **₹499** | **₹4,999** |
| Starter — standard | **₹799** | **₹7,999** |
| Growth | **₹1,499** | **₹14,999** |
| Business | **₹2,499** | **₹24,999** |
| Agency | **₹22,999** | **₹2,29,999** |

**Required changes, in this stage:**

| # | Change | Where |
|---|---|---|
| 1 | **Delete the `usdCents × 84` path entirely** | `usdToInrRate` (`src/config/billing.config.ts:184`) and its application at `scripts/setupRazorpayPlans.ts:52` |
| 2 | **Reconcile `packages.monthly_price_inr_paise` to the same literals** so all three lineages converge | the third lineage is `src/db/seeds/backfillPackagePrices.ts:150-151`, which links Razorpay `package_prices` from that column rather than from the rate |
| 3 | **Remove the "₹49 first month" string** | `src/config/marketing.config.ts:54-55` — advertised with no implementation in any checkout path. **Remove, do not build** |
| 4 | Remove the `?? 84` frontend fallbacks | `Frontend/src/routes/checkout.tsx:97`, `src/routes/_app/billings.tsx:525` (also E3) |

**The code already anticipated this.** `src/config/billing.config.ts:181-183` reads: *"Replace with a real INR price sheet if INR pricing ever diverges from a straight conversion."* **It has diverged** — currently by up to **+166%** on Business (₹2,499 advertised vs ₹6,636 charged). Act on the comment.

**For reference, the three sources this replaces:**

| Plan | Advertised (`marketing.config.ts`) | Charged (`usdCents × 84`) | `package_prices` lineage |
|---|---:|---:|---|
| Starter | ₹499 | ₹756 | from `monthly_price_inr_paise` (marketing lineage) |
| Business | ₹2,499 | ₹6,636 | same |
| Agency | ₹9,999 | ₹25,116 | same |

All three are superseded by the price sheet above. Note Agency moves to **₹22,999**, which matches none of them.

### 🔴 HARD REQUIREMENT inside D1 (Decision D5) — country + state capture

**INR ships. Prices stay exclusive of GST. Customer country *and state* capture at checkout is a hard requirement inside this stage — not deferred to a later one.**

**Why it cannot wait.** Place of supply determines **IGST vs CGST/SGST**, and B2B customers **cannot claim input tax credit** without a compliant invoice. Capturing the data late means the early cohort's invoices can never be reconstructed correctly — the information simply was not collected at the time of supply.

**In scope for D1:**

| Requirement | Current state |
|---|---|
| Persist customer **country** against the subscription | `User.country` is read at `src/api/routes/billing.ts:98,111,115` and **discarded** |
| Persist customer **state** against the subscription | **Not captured at all** |
| Surface **both** on `BillingInvoice` | `src/entities/billing/BillingInvoice.entity.ts` has no tax, place-of-supply or GSTIN field; `upsertInvoice` at `src/services/billingSubscription.ts:253-304` |

**Out of scope — flag, do not implement:**
- GST **rate calculation**
- **Filing** logic
- GSTIN validation and B2B/B2C determination

**Anything beyond capture gets flagged for a tax specialist rather than guessed.** This audit cannot advise on Indian tax obligations; it records only that the system currently cannot produce a compliant invoice. If a requirement in review starts to look like rate logic, stop and flag it — do not ship a tax guess.

### Also settle here
- `marketingPlansService.ts:10` applies `ANNUAL_DISCOUNT = 0.8` as a **display-only** per-month figure that does not match the real yearly SKUs (Starter shows `$9 × 0.8 = $7.20` while `yearlyUsdCents: 8900` = $7.42/mo). Derive from the SKU rather than a constant. **With the price sheet settled, the yearly INR literals above are authoritative — do not compute yearly from monthly either.**

---

## D2 · Price changes and provider SKUs

| | |
|---|---|
| **Goal** | Stripe prices and Razorpay plans exist for the V4 ladder |
| **Repo** | Backend + external providers |
| **Files touched** | `src/config/billing.config.ts:61,81,101,121,141` (`pricing` blocks), `:215-241` / `:243-269` (env SKU maps), `src/env.ts:104-115` (Stripe keys), `:119-130` (Razorpay keys), `scripts/setupRazorpayPlans.ts` |
| **Config-only vs new code** | Config + **external provider setup** |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | **YES** — creating provider price objects is a live write |
| **Dependencies** | **C2** (Growth must exist), **D1** (INR reconciled). **📏 UNBLOCKED — D2 and D3 both settled** on the 2026-08-19 measurement |
| **Rollback** | Repoint env SKU ids to the previous objects. Never delete a price object that has subscribers |
| **How to verify** | In sandbox first: each plan × interval resolves a non-null SKU (`resolveProviderPriceIds`, `billing.config.ts:271-277`); `planFromStripePriceId` (`:299-301`) reverse-maps every new price id correctly. **All 15+15 env keys default to `""` (`src/env.ts:104-130`) and an empty value makes checkout throw (`billing.ts:222-225`) — verify none is left blank** |
| **Safe to ship independently** | **No** |

### Price changes against **configured reality**, not the doc's baseline

| Plan | Configured today | V4 target | Real delta |
|---|---:|---:|---|
| FREE | $0 | $0 | — |
| STARTER | $9 (`:81`) | $9 launch / $15 standard | none at launch |
| PRO → Growth | **$29** (`:101`) | $29 | **exact match** |
| BUSINESS | **$79** (`:121`) | $59 | **−$20 — a price CUT** |
| AGENCY | **$299** (`:141`) | $549 | **+$250 — an 84% RISE** |

**✅ SETTLED (Decision D2): the absolute targets above are final.** They anchor to competitors — Growth at $29 is exactly ManyChat Pro; Business at $59 undercuts ManyChat Business ($69, AI extra) by 14% — **not** to our configured baseline, so the baseline error does not move them.

**What is discarded is the V4 doc's *reasoning*, not the numbers.** V4 §2.4, §19 and §28 argue from a V3 baseline of Business $49 / Agency $449; neither is in the codebase (configured: $79 / $299). Every ARPU percentage, the §19.1 sensitivity table and the §19.2 cannibalisation analysis derive from that wrong baseline and are discarded. The *ladder-shape* argument (1.93× then 2.03×) depends only on the target prices and survives. See `06-doc-corrections.md` §1.

### ✅ 📏 D3 SETTLED — reprice directly, no migration programme

**MEASURED 2026-08-19 — `workspace_subscriptions`, 7 rows total:**

| Plan | Status | Count | Provider / interval |
|---|---|---:|---|
| AGENCY | ACTIVE | **3** | 2 Stripe monthly, 1 Razorpay monthly |
| BUSINESS | ACTIVE | **1** | Razorpay, yearly |
| STARTER | ACTIVE | **1** | Razorpay, yearly |
| BUSINESS | CANCELED | 2 | Stripe, monthly |

**5 active subscriptions · 4 active paying workspaces.**

**Reprice directly. Notify the three or four affected customers individually.** The opposite-handling rule — migrate Business down, grandfather Agency at $299 — is **withdrawn**. It was designed for a population large enough that per-customer handling was impractical; at n=4 four emails do the job better than a policy.

**LM2 is downgraded critical → medium and LM3 high → medium** (`04-risks.md`). The Agency rise plus C3's token reduction is a conversation with **3 named customers**, not a churn event.

### ⚠️ What the measurement does NOT relax

| | |
|---|---|
| **LM1 — never mutate an existing price object** | **Unchanged and still critical.** Five active subscriptions point at live provider objects |
| **U8 — the live price-object inventory** | **Still open.** It needs a **provider dashboard export**, not a DB query. Do not create new SKUs without knowing which objects the 5 active subscriptions are attached to |
| **The synthetic-id defect** | One ACTIVE Agency subscription carries a **synthetic** `provider_subscription_id` (📏 measured). **Phase 0.10 must land first**, including the Razorpay path — otherwise repricing or cancelling that customer throws |

### Interval note
Plans support monthly/quarterly/yearly; **packages support monthly/yearly only** — `intervalToDb` throws `UNSUPPORTED_INTERVAL` on quarterly (`src/services/billing/packageCheckout.ts:48-52`). Quarterly is already `null` for FREE and AGENCY. Decide whether Growth carries a quarterly SKU.

---

## D3 · Route India to Razorpay

| | |
|---|---|
| **Goal** | An Indian buyer reaches Razorpay and INR pricing without manual selection |
| **Repo** | Backend |
| **Files touched** | `src/services/billing.ts:127-135` (`resolveCheckoutProvider` — accepts `country`, never reads it), `src/config/billing.config.ts:192` (`resolveProviderForCountry` — hardcoded `"stripe"`, parameter underscore-prefixed). **Reuse** `src/lib/pricingRegion.ts` (`resolvePricingRegionFromRequest`, already maps `IN → "india"`) — it exists and is wired only into marketing display today. Also `src/api/routes/billing.ts:98,111,115` (reads `User.country` then discards it), `:157` (package checkout hardcodes `"stripe"`, bypassing `resolveCheckoutProvider` entirely) |
| **Config-only vs new code** | New code (wiring existing utilities) |
| **Migration required** | **N** |
| **PREVIEW-ONLY** | No |
| **Dependencies** | **D1** (INR must be correct before routing people to it) |
| **Rollback** | Revert commit — restores the hardcoded Stripe path |
| **How to verify** | A request with an Indian IP/profile reaches Razorpay with INR amounts; a US request reaches Stripe with USD. Explicit `provider` in the request body still overrides |
| **Safe to ship independently** | **Yes, after D1** |

**Do not miss** `billing.ts:157` — the package-checkout path hardcodes `"stripe"` and does not call `resolveCheckoutProvider` at all. Both paths need the fix.

---

## D4 · Payment grace period

| | |
|---|---|
| **Goal** | A failed payment does not instantly halt the workspace |
| **Repo** | Backend |
| **Files touched** | `src/services/billingSubscription.ts:223-234` (`markPaymentFailed`), `src/services/planEnforcement.ts:29-36` (`assertBillingActive` — 403s on both `PAYMENT_FAILED` and `PAST_DUE`), `src/api/webhooks/stripe.ts:282-283`, `src/api/webhooks/razorpay.ts:174-178` |
| **Config-only vs new code** | New code |
| **Migration required** | **Y** — a `grace_until` (or equivalent) column |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **A2** (transitions must invalidate cache to be observable) |
| **Rollback** | Reverse migration; revert commit. The column is additive and safe to leave |
| **How to verify** | First failed invoice → workspace continues running, banner shown, `grace_until` set 7 days out. After grace → `PAYMENT_FAILED`. A successful payment inside grace restores cleanly |
| **Safe to ship independently** | **Yes** |

**Two things to get right:**
- **Do not conflate with `affiliateGracePeriodService`** (`src/services/affiliate/gracePeriod.ts`, called from `billing.ts:410`). That is affiliate commission clawback grace — unrelated.
- **Razorpay is harsher than Stripe:** `payment.failed`, `subscription.halted` **and** `subscription.pending` all route to the same immediate failure (`razorpay.ts:174-178`). A merely *pending* subscription is treated as a hard failure today. Fix that here.

---

## D5 · Launch price-lock — **minimum viable only** (Decision D6)

| | |
|---|---|
| **Goal** | The GA-window founding cohort is **recoverable**, so the restoration mechanic can be built later against real membership data |
| **Repo** | Backend |
| **Files touched** | New: a flag or timestamp on the subscription marking **GA-window cohort membership**. **Reuse — do not rebuild** — the existing grandfathering primitive: `package_prices.is_current` with its partial unique index (`src/db/migrations/1785400000000-AddPackageBillingCatalog.ts:57,69-71`) and `workspace_subscriptions.packagePriceId` (`src/entities/billing/WorkspaceSubscription.entity.ts:35`), pinned at `src/services/billing/packageCheckout.ts:232-235` |
| **Config-only vs new code** | New code — **one column and its write path** |
| **Migration required** | **Y** — the cohort flag/timestamp |
| **PREVIEW-ONLY** | **YES** |
| **Dependencies** | **D2**. **Decision D6 is SETTLED — no longer blocked** |
| **📏 Measured context** | Only **1 of 7** subscription rows carries a `package_price_id` pin today |
| **Rollback** | Reverse migration; founding subscribers fall back to their pinned `package_price_id`, which already works and holds them at $9 regardless |
| **How to verify** | Every subscription created inside the GA window carries the cohort marker; a founding subscriber is still charged $9 after the standard price rises to $15; the cohort can be listed with one query |
| **Safe to ship independently** | **Yes** |

### ✅ SETTLED (Decision D6) — build the marker, not the mechanics

| | |
|---|---|
| **BUILD now** | A flag or timestamp on the subscription marking GA-window cohort membership, so the founding cohort is **recoverable later** |
| **DO NOT BUILD now** | The **12-month upgrade-restoration rule** from V4 §17 — the "trying Growth doesn't cost you the lock" mechanic |
| **DO NOT REBUILD** | The pinning half. `package_prices.is_current` + `packagePriceId` already holds a subscriber at the price they bought. It works |

**Founding subscribers keep $9 regardless** — that is the pinning half, and it exists. Only the *upgrade-and-return* path is unsupported.

### 🔴 CONSEQUENCE — mandatory copy change

**The restoration promise must come OUT of the HTML until it ships.** Affected lines in `liffio-pricing-v4.html`:

| Line | Text |
|---|---|
| `:372` | *"Trying Growth doesn't cost you the lock — it's suspended, not lost."* |
| `:377` | *"If you upgrade → Lock suspended; come back to Starter within 12 months and it's restored"* |

Both describe a mechanic that D5 explicitly does not build. Recorded in [`06-doc-corrections.md`](../06-doc-corrections.md) §11. **This is not optional and it is not a later cleanup** — the HTML is the marketing contract, and leaving the promise visible while shipping the reduced scope sells a mechanic that does not exist.

**What the cohort marker buys.** When the restoration rule is eventually built, it needs to know who was in the GA window. That membership is unrecoverable after the fact if it was never recorded — `package_prices.is_current` tells you what someone pays, not when they joined or under what offer. One column now avoids an unreconstructable gap later.

### 📏 The pinning primitive is not load-bearing yet — build the marker now

**MEASURED 2026-08-19: exactly 1 of the 7 subscription rows carries a `package_price_id` pin.**

Two consequences, pulling in the same direction:

| | |
|---|---|
| **Do not over-trust the pinning half** | "Founding subscribers keep $9 because pinning exists" is true of the *mechanism*, not of today's rows — 6 of 7 are unpinned. If pinning is meant to hold the current cohort, that is a backfill, not an existing state |
| **The cost of getting the marker wrong is near zero right now** | There is almost nothing in production to corrupt or migrate. **Build it while that is true.** Every month of delay adds rows a later marker has to be backfilled against |

---

## Phase D shipping order

Decisions D4, D5, D2 and D6 are **settled**. The only remaining decision-block in this phase is **D3**, which is blocked on data, not judgement.

```
D1 ──▶ D3            (D1 carries the INR price sheet AND country/state capture)
 │
 └──▶ D2 ──▶ D5      (D2 needs C2 + the D3 subscriber counts;
                      D5 = cohort marker only)
D4 (grace)  independent, needs A2
```

| Stage | Migration | PREVIEW-ONLY | Independent | Blocked on |
|---|---|---|---|---|
| D1 | **Y** (country/state) + external writes | **YES** | No | — *(D4, D5 settled)* |
| D2 | N (external writes) | **YES** | No | **D3 — data**; stages C2, D1 |
| D3 | N | No | Yes, after D1 | D1 |
| D4 | **Y** | **YES** | Yes | A2 |
| D5 | **Y** | **YES** | Yes | stage D2 *(D6 settled)* |

**Scope changes recorded in this phase:**
- **D1 grew** — it now carries the INR price sheet (D4), the deletion of the ×84 path, *and* country/state capture as a hard requirement (D5). It also gained a migration it did not have.
- **D5 shrank** — cohort marker only; the 12-month restoration rule is explicitly not built (D6), and the HTML promise must be withdrawn.

**Every stage in this phase either writes to a payment provider or changes what customers are charged. Nothing here ships without sandbox verification first.**
