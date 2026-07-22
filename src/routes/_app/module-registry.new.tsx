import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BackLink,
  Field,
  FormActions,
  FormSection,
  SaveCancel,
  ToggleRow,
} from "@/components/admin/form-page";
import { deriveKey, isValidKey } from "@/lib/module-key";
import { NAV_GROUPS } from "@/lib/registry-constants";
import { createParentModule } from "@/lib/api/registry-api";

const MODULE_MANAGE = "platform:module_manage";

export const Route = createFileRoute("/_app/module-registry/new")({
  head: () => ({ meta: [{ title: "New module — Admin" }] }),
  component: NewModuleRoute,
});

function NewModuleRoute() {
  return (
    <PlatformPermissionRoute permission={MODULE_MANAGE}>
      <NewModulePage />
    </PlatformPermissionRoute>
  );
}

function NewModulePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  // Once the operator edits the key themselves, the name stops driving it — otherwise their edit
  // would be silently overwritten by the next keystroke in the name field.
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [route, setRoute] = useState("");
  const [icon, setIcon] = useState("");
  const [navGroup, setNavGroup] = useState<string>("Workspace");
  const [requiredPermission, setRequiredPermission] = useState("");
  const [apiPrefix, setApiPrefix] = useState("");
  const [showInSidebar, setShowInSidebar] = useState(true);

  const effectiveKey = keyTouched ? key : deriveKey(name);
  const keyError =
    effectiveKey.length > 0 && !isValidKey(effectiveKey)
      ? "Lowercase letters, digits and underscores, starting with a letter."
      : null;

  const create = useMutation({
    mutationFn: () =>
      createParentModule({
        key: effectiveKey,
        name: name.trim(),
        description: description.trim() || null,
        route: route.trim() || null,
        icon: icon.trim() || null,
        navGroup,
        requiredPermission: requiredPermission.trim() || null,
        apiPrefix: apiPrefix.trim() || null,
        showInSidebar,
      }),
    onSuccess: (created) => {
      toast.success(`Module "${created.name}" created`);
      void queryClient.invalidateQueries({ queryKey: ["registry-parents"] });
      void queryClient.invalidateQueries({ queryKey: ["registry-tree"] });
      // Straight to the detail page: creating a module is never the whole task — its sub-functions
      // are, and that is where they live.
      void navigate({ to: "/module-registry/$parentId", params: { parentId: created.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSave = name.trim().length > 0 && effectiveKey.length > 0 && !keyError;
  const cancel = () => void navigate({ to: "/module-registry" });

  return (
    <div>
      <PageHeader
        eyebrow={<BackLink to="/module-registry">Module Registry</BackLink>}
        title="New module"
        description="A top-level product area. Sub-functions are added once it exists."
      />

      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6 md:p-10">
        <FormSection
          title="Identity"
          description="The key is what code, grants, mappings and packages all reference. It is derived from the name and cannot be changed after creation."
        >
          <div className="space-y-4">
            <Field label="Name" required>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Content Studio"
              />
            </Field>

            <Field
              label="Key"
              required
              error={keyError}
              hint={keyTouched ? "Set manually." : "Derived from the name — edit to override."}
            >
              <Input
                className="font-mono"
                value={effectiveKey}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(e.target.value);
                }}
                placeholder="content_studio"
              />
            </Field>

            <Field label="Description" hint="Shown to operators in this console, not to tenants.">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this product area covers."
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Navigation"
          description="Where this appears in a tenant's sidebar, and who sees it."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Route" hint="The page this opens, e.g. /content.">
                <Input
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="/content"
                />
              </Field>
              <Field label="Icon" hint="A lucide-react icon name, e.g. Sparkles.">
                <Input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="Sparkles"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sidebar group">
                <Select value={navGroup} onValueChange={setNavGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NAV_GROUPS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Required permission"
                hint="Leave blank and everyone sees the link. Usually <key>:read."
              >
                <Input
                  className="font-mono"
                  value={requiredPermission}
                  onChange={(e) => setRequiredPermission(e.target.value)}
                  placeholder={effectiveKey ? `${effectiveKey}:read` : "workspace:read"}
                />
              </Field>
            </div>

            <ToggleRow
              label="Show in sidebar"
              description="Presentation only. A hidden module still works — use Enabled to switch it off."
            >
              <Switch checked={showInSidebar} onCheckedChange={setShowInSidebar} />
            </ToggleRow>
          </div>
        </FormSection>

        <FormSection
          title="API surface"
          description="Everything under this path answers 404 while the module is disabled. Leave blank if the module owns no endpoints."
        >
          <Field
            label="API prefix"
            hint="Admin, auth, public and external paths are reserved and can never be masked."
          >
            <Input
              className="font-mono"
              value={apiPrefix}
              onChange={(e) => setApiPrefix(e.target.value)}
              placeholder="/api/v1/content"
            />
          </Field>
        </FormSection>

        <FormActions hint={canSave ? undefined : "Name and a valid key are required."}>
          <SaveCancel
            onCancel={cancel}
            onSave={() => create.mutate()}
            saving={create.isPending}
            disabled={!canSave}
            saveLabel="Create module"
            savingLabel="Creating…"
          />
        </FormActions>
      </div>
    </div>
  );
}
