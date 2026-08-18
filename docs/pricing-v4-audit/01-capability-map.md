# 01 — Per-Capability Delta Map

Every capability and limit named in V4 §10 (Complete Feature Matrix) and §11 (Complete Limit Matrix), mapped against the code.

## Legend

| Delta type | Meaning |
|---|---|
| `NONE` | Code already delivers exactly the V4 target |
| `CONFIG_ONLY` | Mechanism exists and works; only a configured value differs |
| `NEW_GATE` | Capability key exists **and the feature works**, but nothing enforces it per tier |
| `NEW_CODE` | Neither mechanism nor key exists; must be built |
| `NOT_IMPLEMENTED` | V4 sells it; no implementation of any kind |
| `MIS-SOLD` | The doc/HTML advertises it but the code **cannot deliver it** |

## ⚠️ Two facts govern this entire table

1. **There is no plan → capability mapping in the codebase.** The ceiling comes from the assigned *package* (`workspace_packages` → `packages` → `package_features`). `src/services/entitlement.ts` and `src/services/authzBuild.ts` never import `Plan` or `BILLING_PLANS`. With no package row, `applyEntitlement` returns the permission set untouched — **no ceiling at all** (`entitlement.ts:207`).
2. **📏 MEASURED: only 8 `capability_routes` rules exist, all enabled, covering 6 distinct capabilities.** Of **125** `child_modules` keys in production, **119 have zero gate sites.** Source: production SELECT, 2026-08-19. The committed snapshot (`src/generated/capabilityRoutes.ts:18-25`, `generated/modules.ts:247-372`) says 121 keys / 5 capabilities and is **4 keys stale** — reconcile in B3.

**📏 MEASURED AGAINST PRODUCTION 2026-08-19 — every "Gate today" cell below is verified.** `capability_routes` holds 8 rows, all enabled, covering 6 capabilities. **Nothing was added by operators via Superadmin → Module Registry, and nothing by plugins at activation** — the seed is the live state. The earlier "seed-derived, unverified against live" caveat is **withdrawn**; these are measurements, not floors. See `05-decisions.md` D9.

---

## 1. Automation (V4 §10.1)

| Capability | Key exists? | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| Comment keyword trigger | n/a (base) | ✅ | none | All tiers | `NONE` |
| Any-comment trigger | n/a | ✅ | none | All tiers | `NONE` |
| Public comment auto-reply | n/a | ✅ | none | All tiers | `NONE` |
| Post scope: all posts | n/a | ✅ | none | All tiers | `NONE` |
| Post scope: next / specific | `AutomationPostScope` enum `enums.ts` | ✅ | none | Starter+ | `NEW_GATE` |
| Excluded keywords | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| DM button + link | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| DM button click tracking | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Reply variants | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Follow-before-DM | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Structured trigger blocks | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| **DM follow-up sequences** | limit key `dmFollowUps` | ✅ | **write-time ✅** `planEnforcement.ts:63-71` | 0/2/5/5/5 | `CONFIG_ONLY` |
| Auto-retry & trust protection | n/a | ✅ `accountTrustService.ts` | none | All tiers | `NONE` |

> V4 §10.1 claims "All 15 automation capabilities" as a Starter boundary. **None of the 7 gateable ones are gated.** A Free workspace can use every one today.

## 2. DMs (V4 §10.2)

| Capability | Key exists? | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| **Automated DM sending — 500/mo on Free** | ✗ no limit key | ✅ sending works | **none — no meter exists** | Free 500/mo | **`NOT_IMPLEMENTED`** |
| DM retry with backoff | n/a | ✅ `sendDm.ts:111-114,220-223,260-263` | none | All tiers | `NONE` |
| Instagram trust-tier protection | n/a | ✅ `accountTrustService.ts` | none | All tiers | `NONE` |

## 3. Scheduler (V4 §10.3)

| Capability | Key | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| Feed posts | `scheduler:post_feed` | ✅ | **GATED** `capabilityRoutes.ts` (predicate `body.type=="FEED"`) | Starter+ | `NEW_GATE` (tier binding only) |
| Reels | `scheduler:post_reel` | ✅ | **GATED** | Starter+ | `NEW_GATE` (tier binding only) |
| Carousels | `scheduler:post_carousel` | ✅ | **GATED** | Starter+ | `NEW_GATE` (tier binding only) |
| Instagram music | `scheduler:music` | ✅ | **GATED** ×3 rules | Starter+ | `NEW_GATE` (tier binding only) |
| Trial reels, collaborators, first comment | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Alt text, cover selection, thumbnail offset | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Location tag, timezone scheduling | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Media library | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| **Best-time-to-post heatmap** | ✗ **no key** | ✅ `schedulerAnalytics.ts:611,641` → `scheduler.ts:1001` | none | Growth+ | `NEW_GATE` + **new key** |
| **Caption templates** | `scheduler:caption_templates` `featurePermissions.ts:156` | ✅ | none | Growth+ | `NEW_GATE` |
| **Hashtag groups** | `scheduler:hashtag_groups` `:157` | ✅ | none | Growth+ | `NEW_GATE` |
| **Posting schedule templates** | `scheduler:schedule_templates` `:158` | ✅ | none | Growth+ | `NEW_GATE` |
| **Bulk upload** | `scheduler:bulk_upload` `:159` | ✅ | none | Growth+ | `NEW_GATE` |
| **Approval workflow** | `scheduler:approval_workflow` `:154` | ✅ | none | Business+ | `NEW_GATE` |
| **Approve posts** | `scheduler:approve_posts` `:155` | ✅ | **GATED** `capabilityRoutes.ts:18` (`POST /scheduler/posts/:id/publish-now`) | Business+ | `NEW_GATE` (tier binding only) |
| **Post activity log** | `scheduler:activity_log` `:161` | ✅ | none | Business+ | `NEW_GATE` |
| **Stories** | `scheduler:post_story` `:143` | ❌ **server rejects every schedule/publish** | **GATED** `capabilityRoutes.ts:24` | not sold in V4 | **`MIS-SOLD`** |

> **Stories detail:** creation as DRAFT or PENDING_APPROVAL succeeds; scheduling throws (`scheduledPosts.ts:702-705`), updating to SCHEDULED throws (`:939-944`), publish-now returns 400 (`scheduler.ts:573`), and the queue job terminal-fails (`publishScheduledPost.ts:239-244`). A package that grants `scheduler:post_story` charges for a capability that cannot complete.

## 4. Bio link & short links (V4 §10.4)

| Capability | Key exists? | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| Bio link page, items, socials, ordering | ✅ | ✅ | none | All tiers | `NONE` |
| Bio link custom slug, icons, thumbnails, visibility | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Bio link click analytics | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| **Remove "Powered by Liffio" badge** | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Short links + custom slug + edit destination | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Short link click tracking | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Short link lead attribution | ✅ | ✅ | none | Starter+ | `NEW_GATE` |

## 5. Leads (V4 §10.5)

| Capability | Key exists? | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| Lead capture + dedupe | ✅ | ✅ | none | All tiers | `NONE` |
| Lead identity (username) | ✅ | ✅ | none | All tiers | `NONE` |
| Lead email addresses | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Click state, follow state | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Source media, trigger provenance | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| **Lead CSV export** | ✅ | ✅ but **unbounded** `leads.ts:69-77` | only `requirePermission("lead","read")` | Starter+ | `NEW_GATE` + perf fix |

## 6. Analytics (V4 §10.6)

| Capability | Key | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| Overview (DMs, leads, clicks, automations) | ✅ | ✅ | `analytics:read` only | All tiers | `NONE` |
| Time-series charts (30d / 90d) | — | ✅ | **not plan-gated**; custom range accepts 366d `adminDashboardMetrics.ts:134` | 7/30/90/90/90 | `NEW_GATE` |
| Conversion rate | ✅ | ⚠️ mislabelled (V4 §25.12) | none | Starter+ | `NEW_GATE` |
| **Post metrics** | `analytics:post_metrics` `featurePermissions.ts:204` | ✅ synced hourly | **none** | Growth+ | `NEW_GATE` |
| **Video metrics** | `analytics:video_metrics` `:205` | ✅ | **none** | Growth+ | `NEW_GATE` |
| **Profile outcomes** | `analytics:profile_outcomes` `:207` | ✅ | **none** | Growth+ | `NEW_GATE` |
| **Per-automation attribution** | `analytics:automation_attribution` `:208` | ⚠️ funnel stages 1–2 both = lead count; "Sale attributed" hardcoded 0 (V4 §25.12) | **none** | Business+ | `NEW_GATE` + correctness fix |
| **Analytics export** | `analytics:export_data` `:212` | ✅ | **none** | Business+ | `NEW_GATE` |
| Historical post performance | — | ❌ `post_analytics_snapshots` never written; `post_analytics` upserted in place | — | not sold in V4 | correctly excluded |

> **This is the Growth tier's entire headline value, and none of it is gated.** Post analytics is the boundary V4 §7 is built on. Today a Free workspace sees it.

## 7. Lyra AI (V4 §10.7)

| Capability | Key exists? | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| AI Insights (dashboard, analytics, scheduler) | ✅ | ✅ | none | All tiers | `NONE` |
| Zero-token quick answers | ✅ | ✅ | none | All tiers | `NONE` |
| Caption / hashtag / content-idea assist | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Media analyze (summary, OCR, vision) | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Automation Copilot + keyword suggest | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| DM message assist, bio text assist | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| Creator Assistant | ✅ | ✅ | none | Starter+ | `NEW_GATE` |
| **Proactive AI growth alerts** | ✗ **no key** | ✅ `lyraGrowthAlert` worker `worker.ts:188-191` | none | Business+ | `NEW_GATE` + **new key** |
| Monthly tokens per workspace | DB `ai_token_plan_configs` | ✅ **enforced** | 1000/5000/20000/75000/**-1** → 1000/10000/30000/75000/75000 | | `CONFIG_ONLY` (DB rows) |
| **AI token rollover** | `rolloverEnabled` `AiTokenPlanConfig.entity.ts:19` | mechanism ✅, off by default | — / — / — / 25k / 25k | | `CONFIG_ONLY` (DB rows) |

## 8. Team, permissions & approval (V4 §10.8)

| Capability | Key | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| View members | `team:view_members` `featurePermissions.ts:252` | ✅ | none | All tiers | `NONE` |
| **Invite / remove members, assign roles** | `team:assign_roles`, `team:remove_members` `:255-256` | ✅ | **none** — `team.ts:406,412` uses `requirePermission("workspace","update")` + role checks | Business+ | `NEW_GATE` |
| **Resend / revoke invites** | `team:resend_invite`, `team:revoke_invite` `:253-254` | ✅ | **none** | Business+ | `NEW_GATE` |
| **Per-user × per-module × per-action access control** | RBAC subsystem | ✅ | not tier-gated | Business+ | `NEW_GATE` |
| **Per-capability overrides (user + workspace)** | ✅ `authzBuild.ts:204-219` | ✅ | not tier-gated | Business+ | `NEW_GATE` |
| **ABAC policies** | ✅ | ✅ | not tier-gated | Business+ | `NEW_GATE` |
| **Approval workflow** | `scheduler:approval_workflow` | ✅ | none | Business+ | `NEW_GATE` |

> Note `teamEnabled: true` on **every** plan including FREE (`billing.config.ts:72`). V4 makes team management a Business boundary; the code gives it to everyone.

## 9. API (V4 §10.9)

| Capability | Key | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|---|
| **API key create / view / revoke** | `api:create_keys`, `api:view_keys`, `api:revoke_keys` `featurePermissions.ts:261-263` | ✅ | **none** — `/api/v1/api-credentials` mounted **outside the wall** with no `loadAuthorizationContext` (`router.ts:137`) | Business+ | `NEW_GATE` |
| **API docs access, usage stats, key expiry** | `api:docs_access`, `api:usage_stats`, `api:key_expiry` `:264-266` | ✅ | **none** | Business+ | `NEW_GATE` |
| Underlying feature gate | `gates.api` | — | **opens at `Plan.STARTER`** `billing.config.ts:73,93,113,133,153` | Business+ | `CONFIG_ONLY` + `NEW_GATE` |
| External API RBAC | — | ❌ **no `req.authz` at all** | none — 11 routes unprotected | Business+ | **`NEW_CODE`** |

> V4 §10.9 sells API as Business-exclusive. Today `apiEnabled: true` from Starter, `maxApiCredentials` = 2 (Starter) / 5 (Pro), and the external API enforces no RBAC whatsoever. Selling this as a Business feature without Phase A4 would be selling a control that does not exist.

## 10. Account, notifications & programmes (V4 §10.10)

| Capability | Feature works? | Gate today 📏 | V4 target | Delta |
|---|---|---|---|---|
| IG connect, workspace rename, workspace switch | ✅ | none | All tiers | `NONE` |
| Drafts autosave | ✅ | none | All tiers | `NONE` |
| In-app notifications | ✅ | none | All tiers | `NONE` |
| Two-factor authentication | ✅ | none | All tiers | `NONE` |
| Billing self-service | ✅ | none | All tiers | `NONE` |
| Affiliate programme (50% recurring) | ✅ | none | All tiers | `NONE` |
| Creator Program eligibility | ✅ | none | All tiers | `NONE` |
| **Support tiering** | ❌ no mechanism | — | Community/Email/Email/Priority/Priority | `NOT_IMPLEMENTED` (operational promise; V4 §10 already concedes this) |

---

## 11. Limit matrix (V4 §11)

Source of truth: `src/config/billing.config.ts:54-155`. Resolution order: plan defaults → `package_limits` → `workspace_config.limit_overrides` (`src/services/workspaceLimits.ts:99`).

| Limit | Configured F/S/**PRO**/B/A | V4 target F/S/**G**/B/A | Enforcement today | Delta |
|---|---|---|---|---|
| `workflows` | 10 / 999 / 999 / 999 / 999 `:63,83,103,123,143` | 3 / 25 / 75 / 150 / 150 | write-time, internal only; **short-circuits at `>=999`** `planEnforcement.ts:76` | `CONFIG_ONLY` ⚠️ activates dormant code |
| `dmFollowUps` | 0 / 3 / 3 / 3 / 3 `:64,84,104,124,144` | 0 / 2 / 5 / 5 / 5 | write-time ✅ (3 call sites) | `CONFIG_ONLY` |
| `teamMembers` | 2 / 5 / 10 / 20 / 50 `:65,85,105,125,145` | 1 / 3 / 5 / 15 / 15 | advisory at invite `team.ts:423`; binding at accept `workspaceInviteAccept.ts:139` | `CONFIG_ONLY` |
| `maxApiCredentials` | 0 / **2** / **5** / 10 / **50** `:67,87,107,127,147` | 0 / 0 / 0 / 10 / 10 | write-time ✅ but **counts per-user not per-workspace** `apiCredentials.ts:87-89` | `CONFIG_ONLY` + bug fix |
| `apiRequestsPerDay` | 1 / 100 / 500 / 2000 / 10000 `:68,88,108,128,148` | 0 / 0 / 0 / 5000 / 5000 | external only; **counts posts+automations, not requests** `externalApiUsage.ts:51` | `CONFIG_ONLY` + `NEW_CODE` |
| `schedulerPostsPerDay` | 5 / 10 / 50 / 200 / 999999 `:69,89,109,129,149` | 3 / 30 / 100 / 200 / 200 | **external API only** `externalApi.ts:306` | `CONFIG_ONLY` + `NEW_GATE` |
| `automationsPerDay` | 5 / 5 / 25 / 100 / 999999 `:70,90,110,130,150` | 3 / 25 / 75 / 150 / 150 | **external API only** `externalApi.ts:505` | `CONFIG_ONLY` + `NEW_GATE` |
| `workspacesIncluded` | 1 / 1 / 1 / 1 / **999999** `:66,86,106,126,146` | 1 / 1 / 1 / 1 / **20** | **never enforced anywhere** — no call site exists. **A missing call site, not an architectural block** (D10): the value change is C1, the enforcement point is **A5** | `NEW_CODE` |
| **DMs per month** | — no key — | 500 / ∞ / ∞ / ∞ / ∞ | **none** | **`NOT_IMPLEMENTED`** |
| **Free workspaces per login** | `FREE_WORKSPACE_LIMIT_PER_USER = 1` `freeWorkspaceLimit.ts:6` | 1 | **zero callers** — dead module | `NEW_GATE` (wire-up only) |
| **IG accounts per workspace** | — | 1 each | enforced by connect flow only `instagramConnectionService.ts:16-32`, not by DB | `NEW_GATE` (as V4 §4.2 concedes) |
| Analytics history | fixed 7/30/90 for all plans | 7 / 30 / 90 / 90 / 90 | not plan-gated; custom range up to **366 days** | `NEW_GATE` |
| AI tokens/month | 1000 / 5000 / 20000 / 75000 / **-1** (DB seed) | 1000 / 10000 / 30000 / 75000 / **75000** | enforced ✅ | `CONFIG_ONLY` (DB rows) |
| AI token rollover | off everywhere, cap null | — / — / — / 25k / 25k | flag exists `AiTokenPlanConfig.entity.ts:19` | `CONFIG_ONLY` (DB rows) |
| Lead storage | unlimited | unlimited | n/a | `NONE` |

### Sentinel warning
`AGENCY` uses the literal `999999` in `billing.config.ts:146,149,150`. `-1` is the authoring sentinel for `package_limits` / `limit_overrides` only, converted to `UNLIMITED = 999_999_999` at `workspaceLimits.ts:56`. The AI-token table separately uses `-1` as its own unlimited sentinel (`aiTokenService.ts:23`). **Three conventions; do not mix them.**

---

## 12. Rollup

| Delta type | Count (capability rows) | Notes |
|---|---|---|
| `NONE` | 18 | Base features correctly free at every tier |
| `NEW_GATE` | **44** | Key exists, feature works, nothing enforces the tier |
| `CONFIG_ONLY` | 9 | Pure value changes in `billing.config.ts` or `ai_token_plan_configs` |
| `NEW_CODE` | 3 | `workspacesIncluded` enforcement, external-API RBAC, request counting |
| `NOT_IMPLEMENTED` | 2 | DM monthly metering; support routing |
| `MIS-SOLD` | 1 | Stories |
| **New capability keys required** | 2 | best-time-to-post; proactive AI alerts |

**The work is overwhelmingly `NEW_GATE`.** V4 reads as a configuration exercise; **it is a gate-layer build — and, 📏 as production measurement showed, a package-authoring build underneath it.** The features exist and work; almost nothing restricts them by tier; and the packages that are supposed to express the tier ladder currently express an **inverted** one (Free 140 features, Business 94). See [`07-paywall-coverage.md`](07-paywall-coverage.md) §1.2 and stage **B0**.

### 📏 These counts are MEASURED against production (2026-08-19)

**Decision D9 is settled.** `capability_routes` = **8 rows, all enabled, 6 distinct capabilities**. `child_modules` = **125 rows**. Nothing was added by operators or plugins — **the seed is the live state**, so the "plan against the floor" instruction is withdrawn and these figures are exact.

| | Measured | Codegen snapshot |
|---|---:|---:|
| Capability keys | **125** | 121 |
| Capabilities gated | **6** | 5 |
| **Keys with no gate site** | **119** | 116 |

**Reconcile against 125, not 121.** The snapshot is **4 keys stale**, which is itself a finding: `capabilityReconciler.ts:11` already says 125 while `generated/modules.ts:247-372` lists 121 — the DB is right. **Stage B3 owns the fix**, since it already runs `npm run modules:codegen` and reconciles that discrepancy.

**The gap is 3 keys larger than the audit estimated, and now certain.** The hoped-for outcome — operators having added gates that the seed does not show — did not happen.

**The 44 `NEW_GATE` rows stand** as the size of Phase B's gate-layer build; they were derived per-capability from V4's matrix, not from the 121/125 total.

### 🔴 This map says what SHOULD be gated. It does not say what the plan gates.

[`07-paywall-coverage.md`](07-paywall-coverage.md) audits the stage list against this map and finds that **the plan covers only part of it**:

| Boundary | Covered by | Status |
|---|---|---|
| Growth (analytics + scheduler templates) | B2a | ✅ Planned |
| Business (team + API) | B2b | ✅ Planned |
| **Starter** (automation, biolink, lead, shortlink, 9 scheduler keys) | — | **🔴 NO STAGE** |
| **Agency** (`agency:*`, 7 keys) | — | **🔴 NO STAGE** |

**And a prior problem underneath all four:** every package currently grants every capability in this table, because `GATED_MODULES` (`backfillPackages.ts:51-64`) withholds only 4 parent modules. **A `NEW_GATE` row cannot become gated by adding a route rule alone** — the package must stop granting the key. See `07` §1.2.
