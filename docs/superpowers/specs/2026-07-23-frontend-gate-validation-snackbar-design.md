# Frontend: package feature gate, field-level validation, MUI snackbar

**Date:** 2026-07-23
**Status:** Approved (design)
**Repo:** `Client-v2` (frontend), with a supporting audit in `server`.

Three independent units delivered together (user's explicit choice). Each is separately
buildable and verifiable; they are sequenced so the snackbar lands first because the other two
surface notifications through it.

---

## Unit 1 — MUI Snackbar (replaces sonner)

### Problem
`toast()` from `sonner` is called in 48 files; the user finds the current toast poor and wants MUI
Snackbar. The app is otherwise shadcn/ui + Tailwind v4. (Tradeoff flagged and accepted: MUI adds a
second design system; it will be theme-matched to minimise the clash.)

### Design
- Add deps: `@mui/material`, `@emotion/react`, `@emotion/styled`, `notistack`. Raw MUI `<Snackbar>`
  shows one at a time; `notistack` is MUI-based and stacks, which this app needs.
- New `src/lib/toast.tsx`:
  - A `SnackbarProvider` (notistack) mounted at the app root, wrapped in an MUI `ThemeProvider`
    whose palette/shape mirror the app's light/dark CSS tokens so snackbars match the theme.
  - Exports a `toast` object whose methods (`success`, `error`, `warning`, `message`/`info`) match
    the **sonner call signatures already in use**, so call sites do not change.
- Migrate the 48 `from "sonner"` imports to `from "@/lib/toast"` (one line each). Remove the sonner
  `<Toaster>` from the root layout; mount the new provider there.
- Snackbars: bottom-right, stacked, auto-hide (~4s, longer for errors), dismissible, with an action
  slot.

### Decisions
- **notistack** for stacking (pure MUI Snackbar cannot stack).
- **Keep the `toast.*` API** rather than rewriting 48 call sites to `enqueueSnackbar`.

### Verification
- Every existing `toast.*` call renders an MUI snackbar; light/dark themed; stacks; dismissible.
- `grep` shows no remaining `from "sonner"` imports outside the removed Toaster.
- Client `tsc` clean for touched files; build succeeds.

---

## Unit 2 — Field-level validation on touch

### Problem
Forms hand-roll validation and mostly show errors only on submit. The user wants errors to appear
as a user leaves a field (on touch), with proper field-level UI.

### Design
- Use the existing (currently unused) shadcn `<Form>` primitive (`components/ui/form.tsx`, built on
  react-hook-form — already a dependency) with **`mode: "onTouched"`** and `zodResolver` (zod is
  already a dependency). Errors then show on blur and on submit.
- Reuse `FormField` / `FormMessage` / the `Field` error slot already present; fold the rules in
  `lib/validation` (`emailError`, `lengthError`, `duplicateAliasError`, `LIMITS`) into per-form zod
  schemas.
- Form-level submit errors surface through the Unit 1 snackbar.

### Scope (targeted, not every input)
- Package create/edit (`packages.new.tsx`, `packages.$packageId.tsx` details fields).
- Workspace rename + team invite (`settings.tsx` General + Team tabs).
- Auth forms: login, register, reset-password.

### Decisions
- **react-hook-form `onTouched`** over a hand-rolled touched-state hook (RHF is already a dep and
  the shadcn Form wrapper already exists).
- Scoped to the high-traffic forms above; the pattern is reusable for others later.

### Verification
- On each targeted form, an invalid field shows its error after blur (not before touch) and on
  submit; a valid field shows none; submit is blocked while invalid.
- Client `tsc` clean; build succeeds.

---

## Unit 3 — Feature gate + wall (lock + upgrade hint)

### Problem
Features should be walled by the workspace's package, presented as **locked + upgrade hint** (not
hidden), and update in real time when the package changes.

### What already exists (no rework)
- Package entitlement filters the resolved permission set server-side (`applyEntitlement`).
- `useCan(module, action)` (`hooks/use-auth.ts`) reflects that filtered set.
- `access:changed` socket refetches permissions live on a package change, so any component using
  `useCan` re-renders automatically. **Real-time is already wired.**

### Design
- New `src/components/access/feature-gate.tsx`:
  - `useFeatureGate(module, action)` → `{ allowed, packageName }`, built on `useCan` + app context.
  - `<FeatureGate module="scheduler" action="bulk_upload">…</FeatureGate>`: when allowed, renders
    children unchanged; when not, renders them dimmed/`pointer-events-none` under a lock overlay with
    a tooltip ("Not included in your {package} plan — upgrade to unlock", linking to billing).
  - Imperative use for buttons/mutations: `const { allowed } = useFeatureGate(...)` to disable a
    control or block a handler and fire a snackbar.
- **Server wall (the real one):** audit that the routes behind the gated features enforce
  `requirePermission(module, action)` so a locked capability is refused by the API, not merely
  hidden. Close any gaps found. The UI gate is UX; the server check is the security boundary.

### Rollout (pragmatic, honest)
- Ship the primitive + apply it across the **main feature surfaces**: scheduler options (bulk
  upload, music, approval workflow, templates…), automation features, biolink item controls,
  shortlink options, analytics export, api-key management.
- Wiring literally all ~108 capabilities in one pass is out of scope; the primitive + a documented
  pattern make the long tail mechanical.

### Decisions
- **Lock + upgrade hint** presentation (user's choice).
- Real-time reuses the existing `access:changed` path — no new socket code.
- Rollout is "primitive + main surfaces + documented pattern," not exhaustive.

### Verification
- With a package that omits a capability assigned to a test workspace: the gated control renders
  locked with the tooltip; performing the action is refused by the API (server check).
- Editing the package to add the capability pushes `access:changed`; the gate unlocks live without
  reload.
- Client `tsc` clean; build succeeds; server `tsc` clean if routes were touched.

---

## Cross-cutting

- **Deploy:** merges to `main` on both repos auto-deploy via Docker + GitHub Actions.
- **Risk (accepted):** MUI is a second design system; largest single change is the 48-file import
  swap (mechanical). Gate rollout is bounded to main surfaces.
- **Non-goals:** exhaustive gating of every capability; converting every form to RHF; replacing
  shadcn with MUI beyond snackbars.
