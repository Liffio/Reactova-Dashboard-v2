import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BackLink,
  Field,
  FormActions,
  FormSection,
  SaveCancel,
  ToggleRow,
} from "@/components/admin/form-page";
import { PackageFeaturePicker } from "@/components/admin/package-feature-picker";
import { ConfirmCodeDialog, useConfirmCode } from "@/components/admin/confirm-code";
import {
  summarise,
  usePackageFeatureSelection,
  type FeatureSelection,
} from "@/hooks/use-package-features";
import { createPackage, setPackageFeatures, type PackageRow } from "@/lib/api/registry-api";
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

export const Route = createFileRoute("/_app/packages/new")({
  head: () => ({ meta: [{ title: "New package — Admin" }] }),
  component: NewPackageRoute,
});

function NewPackageRoute() {
  return (
    <PlatformPermissionRoute permission={PACKAGE_MANAGE}>
      <NewPackagePage />
    </PlatformPermissionRoute>
  );
}

function NewPackagePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [usd, setUsd] = useState("");
  const [inr, setInr] = useState("");
  const [badge, setBadge] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const featureState = usePackageFeatureSelection();
  const [selection, setSelection] = useState<FeatureSelection[]>([]);

  const touched = useTouched();
  const nameErr = lengthError(name, "Name", { min: 1, max: 255 });
  const usdErr = priceError(usd);
  const inrErr = priceError(inr);
  const badgeErr = badge.trim().length > 64 ? "Badge must be 64 characters or fewer." : null;
  const isValid = !nameErr && !usdErr && !inrErr && !badgeErr;

  /**
   * Creating with contents needs an authenticator code, because the second call is guarded.
   *
   * `POST /admin/packages` is not guarded, but `PUT /:id/features` is (S0.11) — so a package with
   * nothing ticked creates in one unguarded call, and a package with contents steps up. That split
   * is the server's, not a choice made here.
   */
  const stepUp = useConfirmCode();
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const needsStepUp = selection.length > 0;

  /**
   * The package, once it exists.
   *
   * Two calls, because creating a package and setting its contents are separate endpoints — and
   * the second one can be refused for a bad code while the first has already succeeded. Holding
   * the created row here makes the retry re-run only the half that failed; without it, a mistyped
   * code on the contents call would create a second package on the next attempt.
   */
  const [created, setCreated] = useState<PackageRow | null>(null);

  const create = useMutation({
    mutationFn: async (confirmCode: string | undefined) => {
      if (needsStepUp && !confirmCode) {
        throw new Error("Creating a package with contents needs an authenticator code.");
      }

      const row =
        created ??
        (await createPackage({
          name: name.trim(),
          description: description.trim() || null,
          // Entered in major units, stored in minor units, so nothing rounds badly.
          monthlyPriceUsdCents: usd ? Math.round(Number(usd) * 100) : 0,
          monthlyPriceInrPaise: inr ? Math.round(Number(inr) * 100) : null,
          badge: badge.trim() || null,
          isPublic,
        }));
      setCreated(row);

      if (selection.length > 0) {
        await setPackageFeatures(row.id, selection, confirmCode ?? "");
      }
      return row;
    },
    onSuccess: (row) => {
      setStepUpOpen(false);
      stepUp.reset();
      void queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast.success(`Package "${row.name}" created`);
      void navigate({ to: "/packages/$packageId", params: { packageId: row.id } });
    },
    onError: (err) => {
      const rest = stepUp.applyError(err);
      if (rest === null) {
        setCreateError(null);
        setStepUpOpen(true);
        return;
      }
      if (stepUpOpen) {
        setCreateError(rest);
      } else {
        toast.error(rest);
      }
    },
  });

  /**
   * Giving up after the package exists but before its contents saved.
   *
   * The row is already there, so leaving the operator on a form that looks untouched would invite
   * a second package. Same landing as the pre-existing partial-failure path: the edit page, with
   * the tick boxes to redo and a warning saying so.
   */
  const abandonStepUp = () => {
    setStepUpOpen(false);
    setCreateError(null);
    stepUp.reset();
    if (!created) return;
    void queryClient.invalidateQueries({ queryKey: ["packages"] });
    toast.warning(`"${created.name}" was created, but its contents were not saved.`);
    void navigate({ to: "/packages/$packageId", params: { packageId: created.id } });
  };

  const counts = summarise(selection);
  const canSave = name.trim().length > 0;

  return (
    <div>
      <PageHeader
        eyebrow={<BackLink to="/packages">Packages</BackLink>}
        title="New package"
        description="Name it, price it, and pick what is in it — all here. A readable package ID is assigned automatically."
      />

      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 md:p-10">
        <FormSection title="Details">
          <div className="space-y-4">
            <Field label="Name" required error={touched.visible("name") ? (nameErr ?? undefined) : undefined}>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={touched.onBlur("name")}
                placeholder="Growth Pro"
              />
            </Field>
            <Field label="Description" hint="Who this package is for.">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="For teams running more than one brand."
              />
            </Field>
            <Field
              label="Badge"
              hint="Optional ribbon on the pricing page, e.g. Most popular."
              error={touched.visible("badge") ? (badgeErr ?? undefined) : undefined}
            >
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
          <div className="mt-4">
            <ToggleRow
              label="Show on the public pricing page"
              description="Private packages can still be assigned by hand."
            >
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </ToggleRow>
          </div>
        </FormSection>

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

        <FormActions
          hint={
            canSave
              ? `${counts.features} feature${counts.features === 1 ? "" : "s"} across ${counts.modules} module${counts.modules === 1 ? "" : "s"}`
              : "A name is required."
          }
        >
          <SaveCancel
            onCancel={() => void navigate({ to: "/packages" })}
            onSave={() => {
              // Reveal every field's error at once, then only proceed if the form is valid.
              touched.submit();
              if (!isValid) return;
              if (needsStepUp) {
                stepUp.reset();
                setCreateError(null);
                setStepUpOpen(true);
                return;
              }
              create.mutate(undefined);
            }}
            saving={create.isPending}
            saveLabel="Create package"
            savingLabel="Creating…"
          />
        </FormActions>

        <ConfirmCodeDialog
          open={stepUpOpen}
          onOpenChange={(next) => !next && abandonStepUp()}
          title="Confirm the package contents"
          confirmLabel={created ? "Save contents" : "Create package"}
          pendingLabel="Creating…"
          pending={create.isPending}
          state={stepUp}
          formError={createError}
          onConfirm={() => create.mutate(stepUp.code)}
          description={
            <>
              <p>
                Setting what a package includes needs a second factor. Your ticks stay on the page —
                a wrong code can be retyped here without redoing them.
              </p>
              <p className="text-muted-foreground">
                {counts.features} feature{counts.features === 1 ? "" : "s"} across {counts.modules}{" "}
                module{counts.modules === 1 ? "" : "s"}.
              </p>
            </>
          }
        />
      </div>
    </div>
  );
}
