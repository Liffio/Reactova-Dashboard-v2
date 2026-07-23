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
import {
  summarise,
  usePackageFeatureSelection,
  type FeatureSelection,
} from "@/hooks/use-package-features";
import { createPackage, setPackageFeatures } from "@/lib/api/registry-api";

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

  /**
   * Two calls, because creating a package and setting its contents are separate endpoints.
   *
   * If the contents call fails the package still exists, so the operator is sent to its edit page
   * with an explicit warning rather than being left on a form that looks like it did nothing —
   * pressing Create again would make a second package.
   */
  const create = useMutation({
    mutationFn: async () => {
      const created = await createPackage({
        name: name.trim(),
        description: description.trim() || null,
        // Entered in major units, stored in minor units, so nothing rounds badly.
        monthlyPriceUsdCents: usd ? Math.round(Number(usd) * 100) : 0,
        monthlyPriceInrPaise: inr ? Math.round(Number(inr) * 100) : null,
        badge: badge.trim() || null,
        isPublic,
      });

      if (selection.length > 0) {
        try {
          await setPackageFeatures(created.id, selection);
        } catch (err) {
          return { created, featuresError: (err as Error).message };
        }
      }
      return { created, featuresError: null as string | null };
    },
    onSuccess: ({ created, featuresError }) => {
      void queryClient.invalidateQueries({ queryKey: ["packages"] });
      if (featuresError) {
        toast.error(`Package created, but its contents did not save: ${featuresError}`);
      } else {
        toast.success(`Package "${created.name}" created`);
      }
      void navigate({ to: "/packages/$packageId", params: { packageId: created.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

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
            <Field label="Name" required>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
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
            <Field label="Badge" hint="Optional ribbon on the pricing page, e.g. Most popular.">
              <Input
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
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
            <Field label="Monthly (USD)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
                placeholder="49.00"
              />
            </Field>
            <Field label="Monthly (INR)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={inr}
                onChange={(e) => setInr(e.target.value)}
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
            onSave={() => create.mutate()}
            saving={create.isPending}
            disabled={!canSave}
            saveLabel="Create package"
            savingLabel="Creating…"
          />
        </FormActions>
      </div>
    </div>
  );
}
