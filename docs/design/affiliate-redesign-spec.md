# Liffio Affiliate Program: Redesign Spec

Reference build: `liffio-affiliate-redesign.html` (open it in a browser, use the "Preview state" menu bottom right).
This doc explains what the page does, in the order you'd build it.

---

## 1. What changed and why

The old page had four equal stat cards, a floating "Request payout" button, a plain link box, and a table with one row that left the screen mostly empty. Nothing told the affiliate what to do next.

The new page answers three questions in order:

1. How much can I withdraw, and what's stopping me?
2. How do I share my link?
3. What's happening with my referrals, commissions, payouts and verification?

---

## 2. Page layout

### 2.1 Header
- Title "Affiliate Program" and one line of copy.
- Three chips on the right, all from `programTerms`: `50% recurring commission`, `20-day hold`, `$50 minimum payout`.
- No "Account" eyebrow, no all-caps labels.

### 2.2 Balance card (left, wider)
- Label "Available to withdraw", big number = `spendableBalance`, small `USD` suffix.
- If `clawbackDebt > 0`: red line under the number, "$X earned, minus $Y from reversed commissions".
- Payout button top right, with one helper line under it (see section 3).
- Progress bar (brand gradient, the only place the gradient is used):
  - Below minimum: "Progress to your first withdrawal", `$X of $50`.
  - At or above minimum: full bar, "Above the $50 payout minimum", `$pending more clearing soon`.
  - Hidden when suspended or when debt is larger than the available balance.
- In-flight notice (only when a payout is `REQUESTED`, `APPROVED` or `PROCESSING`): "$60.00 payout processing · requested Sep 12, 2026" + "View" (jumps to Payouts tab).
- Bottom row, 3 columns: Total earned, On hold (`pendingBalance`, "Clears after 20 days"), Lifetime paid ("Last paid {date}" or "No payouts yet").

### 2.3 Share and earn card (right)
- Title + "You earn 50% of every payment from workspaces that sign up with your link."
- Link box in mono font, query string dimmed, dark "Copy link" button that turns green "Copied" for 1.8s plus a toast.
- "Code `LFFPJQek`" + "Custom code" (or "Change code" if one exists). Clicking opens an inline field: `?ref=` prefix, 3 to 20 chars, "Your current link keeps working."
- 3-step strip: They sign up / They pay (you earn 50%) / 20 days later (ready to withdraw).
- Share row:
  - Desktop: WhatsApp, X, LinkedIn, Email (intent URLs, no backend).
  - Mobile: one "Share link" button using `navigator.share`, falls back to copy.
- "5 referred, 4 active" on the right.

### 2.4 Activity card (tabs)
One card, underline tabs: Referrals (count), Commissions (count), Payouts (count), Verification (red dot when action is needed).

---

## 3. Payout button states

Checked in this exact order. First match wins. This mirrors `requestPayout` guards plus the new payout details check.

| # | Condition | Button | Helper text |
|---|---|---|---|
| 1 | `isSuspended` | "Payouts paused" (disabled) | Your affiliate account is suspended. Contact support to restore payouts. |
| 2 | `availableBalance - clawbackDebt < 0` | "Request payout" (disabled) | A $X commission reversal has to clear before you can withdraw. |
| 3 | `spendableBalance < minPayoutUsd` | "Request payout" (disabled) | Payouts unlock at $50.00. You need $X more. |
| 4 | No saved payout details | "Add payout details" | Tell us where to send your $X. It takes two minutes. |
| 5 | KYC required, status `pending_review` | "Verification in review" (disabled) | We're checking your documents. You can withdraw once they're approved. |
| 6 | KYC required, status `null` or `rejected` | "Verify to withdraw" / "Fix verification" | Upload N documents to withdraw $X. |
| 7 | Otherwise | "Request payout" | Withdraw up to $X to {method} {masked}. |

Button 4 opens the payout details dialog. Button 6 switches to the Verification tab and scrolls to it. Button 7 opens the request dialog.

---

## 4. Tabs

### 4.1 Referrals
- Tally row: Signed up (`totalReferrals`), Active (`activeReferrals`), With an earning workspace (count of referrals with at least one `isEligible` workspace, worked out on the client).
- Search box (email or workspace handle), filters rows without re-rendering.
- Columns: Referral (avatar initial, masked email, "via {code}", "· used your discount" if `discountUsed`), Status (Active green / Inactive grey), Workspaces (chips, green dot = eligible, grey = not eligible, "No workspace yet" if empty), Referred (date + relative time).
- Footer: "N of M referrals" and "Emails are partly hidden to protect your referrals' privacy".
- Empty: "No referrals yet" + Copy referral link button.

### 4.2 Commissions
- Status filter pills: All, On hold, Available, Paid out, Reversed (uses the existing `?status=` query).
- Columns: Commission amount, Status, Payment ("$29.00 payment · available in 18 days" for PENDING, "held while we review this referral" for WITHHELD), Date.
- Pagination: Previous / Next with "Showing X to Y of Z".
- Status labels:

| Backend | Label | Color |
|---|---|---|
| PENDING | On hold | amber |
| AVAILABLE | Available | green |
| PAID | Paid out | grey |
| REJECTED | Rejected | red |
| CLAWED_BACK | Reversed | red |
| WITHHELD | Under review | amber |
| DISPUTED | Disputed | amber |

- Empty: "No commissions yet" + explains 50% and the 20-day hold.

### 4.3 Payouts
- Top strip:
  - With details: "Paying to UPI aa••••@okaxis", second line "Name · +91 98•••• 3210 · City, State", "Edit details" button.
  - Without details: amber strip "Add where you want to get paid" + "Add payout details" button.
- Columns: Payout amount, Status, Method (+ "paid {date}"), Requested.
- Status labels: REQUESTED Requested, APPROVED Approved, PROCESSING Processing (all amber), PAID Paid (green), REJECTED / FAILED (red).
- Empty: explains the $50 minimum, or offers the payout button when balance is ready.

### 4.4 Verification
Left: status block + document list + action. Right: "Why we ask" and "Who sees your documents".

| State | Title | Action |
|---|---|---|
| Not required | No verification needed yet | none |
| Required, no payout details | Verify your identity to withdraw (step 1: tell us where you live) | Add payout details |
| Required, not submitted | Verify your identity to withdraw | Upload documents |
| pending_review | Verification in review | none, docs shown as Submitted |
| rejected | Verification needs changes + red reason box | Upload documents again |
| verified | You're verified | none |

"Why we ask" copy changes by residency:
- India: Indian tax rules require ID above set yearly amounts.
- International: Liffio is an Indian company, tax residency documents let us apply the treaty rate instead of default Indian withholding.

---

## 5. Payout details dialog (new)

3 steps with a progress bar. Desktop = centered dialog. Mobile = bottom sheet, full-width primary button.

### Step 1: You
- "Where do you live?" radio cards: **India** (UPI or bank transfer) / **Outside India** (international bank transfer).
- Outside India: "Country you live in" select.
- Full legal name ("As it appears on your bank account").

### Step 2: Contact
- Phone: India locks to +91 and needs a 10-digit mobile starting 6 to 9. International gets a country code select (auto-set from country) and 6 to 14 digits.
- Address line 1 (required), line 2 (optional).
- City + State (India: dropdown of all 36 states and UTs; others: free text labelled State / Province / County, County optional for UK).
- PIN code (India, 6 digits) / ZIP code (US) / Postal code (others). Country shown read-only.

### Step 3: Payout method
**India**
- Radio: UPI / Bank account.
- UPI: UPI ID (`name@bank` format).
- Bank: account holder (prefilled from legal name), account number (masked input, 9 to 18 digits), confirm account number (must match), IFSC (auto-uppercase, `AAAA0XXXXXX`), account type Savings / Current.

**International** (fields change by country)

| Scheme | Countries | Fields |
|---|---|---|
| IBAN | EU, UK-style IBAN countries, UAE, Saudi, Qatar, Kuwait, Bahrain, Turkey, Israel, Egypt, Pakistan, Brazil, Switzerland, Nordics, Poland | IBAN (mod-97 checked) + SWIFT/BIC (required) |
| US | United States | Routing number (9 digits) + Checking/Savings + account number + SWIFT (optional) |
| UK | United Kingdom | Sort code (6 digits) + account number (8 digits) + SWIFT (optional) |
| AU | Australia | BSB (6 digits) + account number + SWIFT (optional) |
| CA | Canada | Institution (3) + Transit (5) + account number + SWIFT (optional) |
| SWIFT | Everyone else | Account number + SWIFT/BIC (required) |

All international: account holder, bank name, note "Your bank may charge a fee to receive international transfers."

Everyone: checkbox "This account is in my name ({legal name}) and the details are correct." Required.

Validation shows inline red text under each field on Continue, scrolls to and focuses the first error.

---

## 6. Request payout dialog (new)
- Big amount input with `$` and a Max button, prefilled with the full `spendableBalance`.
- Errors: "Enter an amount", "You can request up to $X".
- "Pay to" box shows the saved method, masked, with a "Change" link (opens payout details).
- Footer: Cancel / "Request $X" (label updates as you type).
- On success: toast, balance updates, in-flight notice appears.

## 7. Verification upload dialog (new)
- India: PAN number field (`ABCDE1234F`, auto-uppercase) + one upload row per required document.
- International: upload rows only.
- Each row: document name, one-line instruction, "Choose file" button. After a file is picked: green tick, filename, button becomes "Replace".
- Rules: JPG, PNG or PDF, max 10 MB (same as `kycUpload.ts`).
- Submit stays disabled until every document is attached and PAN is valid.

| Key | Name | Instruction |
|---|---|---|
| PAN | PAN card | Front side, all four corners visible |
| AADHAAR | Aadhaar | Front and back, as one PDF or two images merged |
| BANK_ACCOUNT | Bank proof | Cancelled cheque or a recent bank statement |
| GOVT_ID | Passport or national ID | Photo page, all four corners visible |
| ADDRESS_PROOF | Proof of address | Utility bill or bank statement from the last 3 months |
| TRC | Tax residency certificate | Issued by your country's tax authority for the current year |
| FORM_10F | Form 10F | Filed on the Indian income tax portal |
| NO_PE | No PE declaration | Signed statement that you have no fixed place of business in India |

---

## 8. Responsive rules
- **Desktop (1100px and up):** sidebar, balance and share side by side.
- **Tablet (641 to 1100px):** sidebar hidden, hamburger shown, cards stack, verification aside moves below.
- **Mobile (640px and down):**
  - Terms chips scroll sideways.
  - Payout button is full width, 44px tall.
  - Ledger becomes 2 columns + 1.
  - Tabs scroll sideways.
  - Tables turn into stacked rows (amount or email + badge on top, details below).
  - Dialogs become bottom sheets.
- No horizontal page scroll at 390px (verified).

## 9. Visual rules
- Tokens from `src/styles.css` only. Space Grotesk for headings and numbers (tabular), Inter for text, JetBrains Mono only for links, codes and account numbers.
- Brand gradient only on the progress bar. Primary coral only on primary buttons and the verification dot.
- Status badges use tinted backgrounds (success, warning, destructive at low opacity) with a small dot.
- Sentence case everywhere. No em dashes in copy.

---

## 10. Backend gaps (must be built)

1. **Payout account storage.** Nothing stores residency, country, phone, address or payout method. Needs a table and GET/PUT endpoints, with bank, UPI and IBAN data encrypted like `panNumberEnc`.
2. **`POST /payouts/request`** still takes `payoutMethod` and `payoutDetails` from the client. It should use the saved account and only accept `amount`.
3. **International KYC.** `kyc.ts` only has PAN / AADHAAR / BANK_ACCOUNT tiers, and `/kyc/submit` only accepts `pan`, `aadhaar`, `bankAccount` upload fields.
4. **Document names differ.** `payout.ts` returns "Aadhaar" and "Bank Account", while `kyc.ts` uses `AADHAAR` and `BANK_ACCOUNT`.
5. **Link mismatch.** The current UI shows `liffio.com/register/?ref=`, while `/links` builds `/?ref=` and `/r/{code}`.
6. **No time-series data**, so there's no earnings chart. Add a chart only once an endpoint exists.

## 11. Decisions still open
- When international KYC is required (before first payout, or at a threshold). Confirm with the CA.
- The exact international document list (TRC, Form 10F, no-PE). Confirm with the CA.
- USD to INR conversion for UPI and Indian bank payouts.
- Whether editing payout details should need an OTP or a cooldown before the next payout.
