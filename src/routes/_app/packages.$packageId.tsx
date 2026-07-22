import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package as PackageIcon } from "lucide-react";
import { toast } from "sonner";

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
import {
  summarise,
  usePackageFeatureSelection,
  type FeatureSelection,
} from "@/hooks/use-package-features";
import {
  getPackage,
  setPackageFeatures,
  updatePackage,
  type PackageDetail,
} from "@/lib/api/registry-api";

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

  // Re-seed the checklist when a refetch brings new contents, so a save elsewhere is reflected
  // rather than silently overwritten by this page's stale sets on the next save.
  useEffect(() => {
    featureState.reset(pkg.features);
    setSelection(pkg.features);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg.features]);

  const detailsDirty =
    name !== pkg.name ||
    description !== (pkg.description ?? "") ||
    usd !== (pkg.monthlyPriceUsdCents ? String(pkg.monthlyPriceUsdCents / 100) : "") ||
    inr !== (pkg.monthlyPriceInrPaise != null ? String(pkg.monthlyPriceInrPaise / 100) : "") ||
    badge !== (pkg.badge ?? "") ||
    isPublic !== pkg.isPublic ||
    isActive !== pkg.isActive;

  const sortFeatures = (f: FeatureSelection[]) =>
    [...f]
      .map((x) => `${x.parentKey}:${x.childKey ?? ""}`)
      .sort()
      .join("|");
  const featuresDirty = sortFeatures(selection) !== sortFeatures(pkg.features);
  const dirty = detailsDirty || featuresDirty;

  /**
   * Saves details and contents together, skipping whichever is unchanged.
   *
   * Details go first: if contents then fail, the package is left with correct pricing and stale
   * contents, which is the less confusing half to be wrong — and the error names which half it was.
   */
  const save = useMutation({
    mutationFn: async () => {
      if (detailsDirty) {
        await updatePackage(pkg.id, {
          name: name.trim(),
          description: description.trim() || null,
          monthlyPriceUsdCents: usd ? Math.round(Number(usd) * 100) : 0,
          monthlyPriceInrPaise: inr ? Math.round(Number(inr) * 100) : null,
          badge: badge.trim() || null,
          isPublic,
          isActive,
        });
      }
      if (featuresDirty) {
        await setPackageFeatures(pkg.id, selection);
      }
    },
    onSuccess: () => {
      toast.success("Package saved");
      void queryClient.invalidateQueries({ queryKey: ["packages"] });
      void queryClient.invalidateQueries({ queryKey: ["package-detail", pkg.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

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
      />

      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 md:p-10">
        <FormSection title="Details">
          <div className="space-y-4">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who this package is for."
              />
            </Field>
            <Field label="Badge">
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
            dirty
              ? "Unsaved changes"
              : `${counts.features} feature${counts.features === 1 ? "" : "s"} across ${counts.modules} module${counts.modules === 1 ? "" : "s"}`
          }
        >
          <SaveCancel
            onCancel={() => void navigate({ to: "/packages" })}
            onSave={() => save.mutate()}
            saving={save.isPending}
            disabled={!dirty || !name.trim()}
          />
        </FormActions>
      </div>
    </div>
  );
}
