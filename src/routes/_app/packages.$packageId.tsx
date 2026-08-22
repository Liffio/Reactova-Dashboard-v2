import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package as PackageIcon, Zap } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BackLink,
  CopyableKey,
  EmptyState,
  Field,
  FormActions,
  FormSection,
  SaveCancel,
  ToggleRow,
} from "@/components/admin/form-page";
import { PackageFeaturePicker } from "@/components/admin/package-feature-picker";
import { PackageLimitsEditor } from "@/components/admin/package-limits-editor";
import { PackagePublish } from "@/components/admin/package-publish";
import {
  summarise,
  usePackageFeatureSelection,
  type FeatureSelection,
} from "@/hooks/use-package-features";
import {
  applyPackageLive,
  getPackage,
  getPackageAudit,
  setPackageFeatures,
  setPackageLimits,
  updatePackage,
  type PackageDetail,
  type PackageLimit,
} from "@/lib/api/registry-api";
import { AuditTimeline } from "@/components/admin/audit-timeline";
import { ConfirmCodeDialog, useConfirmCode } from "@/components/admin/confirm-code";
import {
  PACKAGE_STEP_UP_FIELD_LABELS,
  buildPackagePatch,
  packageStepUpFieldsIn,
  type PackagePatchValues,
} from "@/lib/admin/package-step-up";
import { useTouched } from "@/hooks/use-touched";
import { lengthError } from "@/lib/validation";

/** Optional price field: blank is fine; a present value must be a non-negative number. */
function priceError(value: string): string | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return "Enter a number.";
  if (n < 0) return "Price can't be negative.";
  return null;
}

const PACKAGE_MANAGE = "platform:package_manage";

export const Route = createFileRoute("/_app/packages/$packageId")({
  head: () => ({ meta: [{ title: "Package — Admin" }] }),
  component: PackageDetailRoute,
});

function PackageDetailRoute() {
  return (
    <PlatformPermissionRoute permission={PACKAGE_MANAGE}>
      <PackageDetailLoader />
    </PlatformPermissionRoute>
  );
}

function PackageDetailLoader() {
  const { packageId } = useParams({ from: "/_app/packages/$packageId" });
  const navigate = useNavigate();

  const detailQuery = useQuery({
    queryKey: ["package-detail", packageId],
    queryFn: () => getPackage(packageId),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!detailQuery.data) {
    return (
      <div className="p-4 sm:p-6 md:p-10">
        <EmptyState icon={PackageIcon} title="Package not found">
          It may have been archived.
        </EmptyState>
        <div className="mt-4">
          <Button variant="outline" onClick={() => void navigate({ to: "/packages" })}>
            Back to Packages
          </Button>
        </div>
      </div>
    );
  }

  // Keyed on the record so the form state is rebuilt from scratch if the package changes
  // underneath, rather than merging old field values into a new record.
  return <PackageForm key={detailQuery.data.id} pkg={detailQuery.data} />;
}

function PackageForm({ pkg }: { pkg: PackageDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState(pkg.name);
  const [description, setDescription] = useState(pkg.description ?? "");
  const [usd, setUsd] = useState(
    pkg.monthlyPriceUsdCents ? String(pkg.monthlyPriceUsdCents / 100) : "",
  );
  const [inr, setInr] = useState(
    pkg.monthlyPriceInrPaise != null ? String(pkg.monthlyPriceInrPaise / 100) : "",
  );
  const [badge, setBadge] = useState(pkg.badge ?? "");
  const [isPublic, setIsPublic] = useState(pkg.isPublic);
  const [isActive, setIsActive] = useState(pkg.isActive);

  const featureState = usePackageFeatureSelection(pkg.features);
  const [selection, setSelection] = useState<FeatureSelection[]>(pkg.features);
  const [limits, setLimits] = useState<PackageLimit[]>(pkg.limits);

  const touched = useTouched();
  const nameErr = lengthError(name, "Name", { min: 1, max: 255 });
  const usdErr = priceError(usd);
  const inrErr = priceError(inr);
  const badgeErr = badge.trim().length > 64 ? "Badge must be 64 characters or fewer." : null;
  const isValid = !nameErr && !usdErr && !inrErr && !badgeErr;

  // Re-seed the checklist when a refetch brings new contents, so a save elsewhere is reflected
  // rather than silently overwritten by this page's stale sets on the next save.
  useEffect(() => {
    featureState.reset(pkg.features);
    setSelection(pkg.features);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg.features]);

  useEffect(() => {
    setLimits(pkg.limits);
  }, [pkg.limits]);

  /**
   * The details half as the server sees it, saved vs edited. The diff between the two IS the PATCH
   * body.
   *
   * It used to be a fixed object carrying name, description, both prices, badge, isPublic and
   * isActive on every save. Against S0.11's key-presence check that made a rename demand an
   * authenticator code, which is the reflex the guard exists to prevent. Sending only what changed
   * is what keeps the prompt honest.
   */
  const savedDetails: PackagePatchValues = {
    name: pkg.name,
    description: pkg.description ?? null,
    monthlyPriceUsdCents: pkg.monthlyPriceUsdCents,
    monthlyPriceInrPaise: pkg.monthlyPriceInrPaise,
    badge: pkg.badge ?? null,
    isPublic: pkg.isPublic,
    isActive: pkg.isActive,
  };
  const editedDetails: PackagePatchValues = {
    name: name.trim(),
    description: description.trim() || null,
    // Entered in major units, stored in minor units, so nothing rounds badly.
    monthlyPriceUsdCents: usd ? Math.round(Number(usd) * 100) : 0,
    monthlyPriceInrPaise: inr ? Math.round(Number(inr) * 100) : null,
    badge: badge.trim() || null,
    isPublic,
    isActive,
  };
  const patch = buildPackagePatch(savedDetails, editedDetails);

  const pricingDirty = "monthlyPriceUsdCents" in patch || "monthlyPriceInrPaise" in patch;

  const detailsDirty = Object.keys(patch).length > 0;

  const sortFeatures = (f: FeatureSelection[]) =>
    [...f]
      .map((x) => `${x.parentKey}:${x.childKey ?? ""}`)
      .sort()
      .join("|");
  const featuresDirty = sortFeatures(selection) !== sortFeatures(pkg.features);

  const sortLimits = (l: PackageLimit[]) =>
    [...l]
      .map((x) => `${x.key}=${x.value}`)
      .sort()
      .join("|");
  const limitsDirty = sortLimits(limits) !== sortLimits(pkg.limits);

  const dirty = detailsDirty || featuresDirty || limitsDirty;

  /**
   * What about this save the server will demand an authenticator code for.
   *
   * `PUT /features` and `PUT /limits` are guarded unconditionally; the PATCH only when the body
   * touches a structural field. Listing the reasons rather than just counting them is deliberate —
   * a dialog that says why teaches the rule; a dialog that just appears teaches the reflex.
   */
  const stepUpReasons: string[] = [
    ...packageStepUpFieldsIn(patch).map((field) => PACKAGE_STEP_UP_FIELD_LABELS[field]),
    ...(featuresDirty ? ["What is included"] : []),
    ...(limitsDirty ? ["Usage limits"] : []),
  ];
  const needsStepUp = stepUpReasons.length > 0;

  const stepUp = useConfirmCode();
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const closeStepUp = () => {
    setStepUpOpen(false);
    setSaveError(null);
    stepUp.reset();
  };

  /**
   * Saves details and contents together, skipping whichever is unchanged.
   *
   * Details go first: if contents then fail, the package is left with correct pricing and stale
   * contents, which is the less confusing half to be wrong — and the error names which half it was.
   *
   * **One code covers all three calls.** The server verifies TOTP statelessly —
   * `verifySync({ secret, token, epochTolerance: 1 })`, with nothing recording a code as spent — so
   * the same six digits satisfy every guarded call inside the window, and re-running the whole save
   * after a rejected code is safe: the PATCH is a diff, features and limits are whole-set replaces,
   * and all three are idempotent. That is what makes a wrong code a plain retry rather than a
   * partial state to unpick.
   */
  const save = useMutation({
    mutationFn: async (confirmCode: string | undefined) => {
      // Asserted, not assumed: the Save button only fires without a code when `needsStepUp` is
      // false. A regression here would post no code and come back as "Confirmation code required" —
      // the exact dead end this change exists to remove.
      if (needsStepUp && !confirmCode) {
        throw new Error("This save needs an authenticator code.");
      }
      const code = confirmCode ?? "";

      if (detailsDirty) {
        await updatePackage(pkg.id, patch, confirmCode);
      }
      if (featuresDirty) {
        await setPackageFeatures(pkg.id, selection, code);
      }
      if (limitsDirty) {
        await setPackageLimits(pkg.id, limits, code);
      }
    },
    onSuccess: () => {
      closeStepUp();
      toast.success("Package saved");
      void queryClient.invalidateQueries({ queryKey: ["packages"] });
      void queryClient.invalidateQueries({ queryKey: ["package-detail", pkg.id] });
      // So the publish diff below reflects the prices just saved, not the ones it loaded with.
      void queryClient.invalidateQueries({ queryKey: ["package-publish-status", pkg.id] });
    },
    onError: (err) => {
      const rest = stepUp.applyError(err);
      if (rest === null) {
        // The server answered about the code itself, and `applyError` has already put the message
        // under the field. Opening the dialog also covers the case where we did NOT think this save
        // needed one — i.e. this file's field list has drifted from the server's — so the operator
        // gets a way through instead of a toast they can do nothing about.
        setSaveError(null);
        setStepUpOpen(true);
        return;
      }
      if (stepUpOpen) {
        setSaveError(rest);
      } else {
        toast.error(rest);
      }
    },
  });

  const [confirmApplyLive, setConfirmApplyLive] = useState(false);
  const applyLiveCode = useConfirmCode();
  const [applyLiveError, setApplyLiveError] = useState<string | null>(null);

  /**
   * Forcing the saved contents live.
   *
   * Deliberately independent of the save mutation. Bundling them would make every save fan out to
   * every tenant on the package synchronously, which is exactly what the queued path exists to
   * avoid — and would make an ordinary description edit page a few thousand members.
   */
  const applyLive = useMutation({
    mutationFn: (confirmCode: string) => applyPackageLive(pkg.id, confirmCode),
    onSuccess: (r) => {
      if (r.workspacesUpdated === 0) {
        toast.info(`${r.packageName} has no workspaces assigned — nothing to apply.`);
      } else {
        toast.success(
          `${r.packageName} applied to ${r.workspacesUpdated} workspace${r.workspacesUpdated === 1 ? "" : "s"} · ${r.membersNotified} member${r.membersNotified === 1 ? "" : "s"} notified`,
        );
      }
      if (r.truncated) {
        toast.warning(
          "More workspaces are on this package than one run covers — the rest propagate in the background.",
        );
      }
      closeApplyLive();
    },
    onError: (err) => setApplyLiveError(applyLiveCode.applyError(err)),
  });

  const closeApplyLive = () => {
    setConfirmApplyLive(false);
    setApplyLiveError(null);
    applyLiveCode.reset();
  };

  const counts = summarise(selection);

  return (
    <div>
      <PageHeader
        eyebrow={<BackLink to="/packages">Packages</BackLink>}
        title={pkg.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CopyableKey value={pkg.humanId} />
            {pkg.isPublic && <Badge variant="outline">Public</Badge>}
            {!pkg.isActive && <Badge variant="outline">Inactive</Badge>}
          </span>
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={applyLive.isPending}
            onClick={() => setConfirmApplyLive(true)}
          >
            <Zap className="h-4 w-4" />
            {applyLive.isPending ? "Applying…" : "Apply live now"}
          </Button>
        }
      />

      <ConfirmCodeDialog
        open={confirmApplyLive}
        onOpenChange={(next) => !next && closeApplyLive()}
        title={`Apply ${pkg.name} live now?`}
        confirmLabel="Apply live"
        pendingLabel="Applying…"
        pending={applyLive.isPending}
        state={applyLiveCode}
        formError={applyLiveError}
        onConfirm={() => applyLive.mutate(applyLiveCode.code)}
        description={
          <>
            <p>
              Re-resolves entitlement for every workspace on this package and notifies their members
              immediately. Connected sessions refresh their permissions on the spot.
            </p>
            <p className="text-muted-foreground">
              Saving already propagates in the background and defers removals to each billing
              cycle&apos;s end. Use this when you need the saved contents to take hold now instead.
              It touches no payment provider — that is Publish.
            </p>
            <p className="font-medium">Unsaved edits on this page are not included.</p>
          </>
        }
      />

      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 md:p-10">
        <FormSection title="Details">
          <div className="space-y-4">
            <Field label="Name" required error={touched.visible("name") ? (nameErr ?? undefined) : undefined}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={touched.onBlur("name")}
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who this package is for."
              />
            </Field>
            <Field label="Badge" error={touched.visible("badge") ? (badgeErr ?? undefined) : undefined}>
              <Input
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                onBlur={touched.onBlur("badge")}
                placeholder="Most popular"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Pricing"
          description="Entered in whole currency; stored in minor units."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly (USD)" error={touched.visible("usd") ? (usdErr ?? undefined) : undefined}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
                onBlur={touched.onBlur("usd")}
                placeholder="49.00"
              />
            </Field>
            <Field label="Monthly (INR)" error={touched.visible("inr") ? (inrErr ?? undefined) : undefined}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={inr}
                onChange={(e) => setInr(e.target.value)}
                onBlur={touched.onBlur("inr")}
                placeholder="3999.00"
              />
            </Field>
          </div>
          <div className="mt-4 space-y-3">
            <ToggleRow
              label="Show on the public pricing page"
              description="Private packages can still be assigned by hand."
            >
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </ToggleRow>
            <ToggleRow
              label="Active"
              description="Inactive packages cannot be bought. Existing workspaces are unaffected."
            >
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </ToggleRow>
          </div>
        </FormSection>

        {pricingDirty && (
          <p className="-mt-2 px-1 text-xs text-amber-600 dark:text-amber-500">
            You have unsaved price changes. Publishing below acts on the saved package — save first
            for the change to appear here.
          </p>
        )}
        <PackagePublish packageId={pkg.id} packageKey={pkg.key} />

        <FormSection
          title="What's included"
          description="Ticking a sub-function includes its module automatically. Only enabled modules can be sold."
        >
          <PackageFeaturePicker
            parents={featureState.parents}
            setParents={featureState.setParents}
            children={featureState.children}
            setChildren={featureState.setChildren}
            onSelectionChange={setSelection}
          />
        </FormSection>

        <FormSection
          title="Usage limits"
          description="Numeric caps for this package. An overridden limit replaces the plan's; anything left to inherit uses the plan value. Changes roll out live to every workspace on this package."
        >
          <PackageLimitsEditor value={limits} onChange={setLimits} />
        </FormSection>

        <FormActions
          hint={
            dirty
              ? "Unsaved changes"
              : `${counts.features} feature${counts.features === 1 ? "" : "s"} across ${counts.modules} module${counts.modules === 1 ? "" : "s"}`
          }
        >
          <SaveCancel
            onCancel={() => void navigate({ to: "/packages" })}
            onSave={() => {
              touched.submit();
              if (!isValid) return;
              if (needsStepUp) {
                // The form stays mounted behind the dialog, so a rejected code costs nothing —
                // which matters most for the features checklist, a whole-set replace that would
                // otherwise have to be re-ticked from scratch.
                stepUp.reset();
                setSaveError(null);
                setStepUpOpen(true);
                return;
              }
              save.mutate(undefined);
            }}
            saving={save.isPending}
            disabled={!dirty}
          />
        </FormActions>

        <ConfirmCodeDialog
          open={stepUpOpen}
          onOpenChange={(next) => !next && closeStepUp()}
          title="Confirm this change"
          confirmLabel="Save package"
          pendingLabel="Saving…"
          pending={save.isPending}
          state={stepUp}
          formError={saveError}
          onConfirm={() => save.mutate(stepUp.code)}
          description={
            <>
              <p>These change what customers can buy, so they need a second factor:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {stepUpReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                Your edits stay on the page — a wrong code can be retyped here without losing them.
              </p>
            </>
          }
        />

        <FormSection
          title="Change history"
          description="Every change made to this package — who did it, when, and exactly what changed. Package-level edits only (features, limits, pricing, publish, archive)."
        >
          <PackageChangeHistory packageId={pkg.id} />
        </FormSection>
      </div>
    </div>
  );
}

const AUDIT_PAGE_SIZE = 25;

/** Package change history — same shared `<AuditTimeline>` the user Activity tab uses, scoped to
 *  this package's `audit_logs` rows. Keyset-paginated with a "Load more" button. */
function PackageChangeHistory({ packageId }: { packageId: string }) {
  const auditQuery = useInfiniteQuery({
    queryKey: ["package-audit", packageId],
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
      getPackageAudit(packageId, { limit: AUDIT_PAGE_SIZE, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entries = auditQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <AuditTimeline
      entries={entries}
      isLoading={auditQuery.isLoading}
      isError={auditQuery.isError}
      error={auditQuery.error}
      hasNextPage={auditQuery.hasNextPage}
      isFetchingNextPage={auditQuery.isFetchingNextPage}
      fetchNextPage={() => void auditQuery.fetchNextPage()}
      onRetry={() => void auditQuery.refetch()}
      emptyTitle="No changes yet"
      emptyHint="No edits have been recorded for this package."
    />
  );
}
