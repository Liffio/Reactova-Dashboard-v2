import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, Star } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  chatbotTemplatesAdminApi,
  chatbotTemplatesAdminKeys,
  type AdminTemplateCategory,
  type TemplatePatch,
} from "@/lib/api/chatbot-templates-admin-api";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * The chatbot template library (`platform:module_manage`): metadata and visibility. A template's
 * flow comes from "Save as template" in a chatbot's … menu and is never edited here, so the admin
 * panel needs no graph editor. Nothing here needs a deploy.
 */
export const Route = createFileRoute("/_app/admin/chatbot-templates")({
  component: () => (
    <PlatformPermissionRoute permission="platform:module_manage" notifyDelivery={false}>
      <TemplatesAdminPage />
    </PlatformPermissionRoute>
  ),
});

function TemplatesAdminPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const library = useQuery({
    queryKey: chatbotTemplatesAdminKeys.all,
    queryFn: chatbotTemplatesAdminApi.list,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: chatbotTemplatesAdminKeys.all });

  const quick = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TemplatePatch }) =>
      chatbotTemplatesAdminApi.update(id, patch),
    onSuccess: refresh,
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't update the template.")),
  });

  const templates = library.data?.templates ?? [];
  const categories = library.data?.categories ?? [];

  return (
    <div>
      <PageHeader
        title="Chatbot templates"
        description="What people see under New chatbot. To add one, build it as a chatbot and use Save as template in its … menu."
      />

      {library.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[2fr_1.3fr_auto_auto_auto_auto]">
              <span>Template</span>
              <span className="max-sm:hidden">Category</span>
              <span className="max-sm:hidden">Steps</span>
              <span className="max-sm:hidden">Installs</span>
              <span className="max-sm:hidden">Featured</span>
              <span>On</span>
            </div>
            {templates.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No templates yet.
              </p>
            )}
            {templates.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[2fr_1.3fr_auto_auto_auto_auto]"
              >
                <button
                  type="button"
                  onClick={() => setEditing(t.id)}
                  className="flex min-w-0 items-center gap-2.5 text-left"
                >
                  <span className="text-lg">{t.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium hover:underline">
                      {t.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.description || "No description yet"}
                    </span>
                  </span>
                  {t.problem && (
                    <Badge variant="destructive" className="shrink-0 gap-1" title={t.problem}>
                      <AlertTriangle className="h-3 w-3" /> Needs attention
                    </Badge>
                  )}
                </button>
                <span className="truncate text-sm text-muted-foreground max-sm:hidden">
                  {t.categoryLabel ?? "—"}
                </span>
                <span className="text-sm tabular-nums max-sm:hidden">{t.stepCount}</span>
                <span className="text-sm tabular-nums max-sm:hidden">{t.installCount}</span>
                <button
                  type="button"
                  aria-label={t.featured ? "Unfeature" : "Feature"}
                  aria-pressed={t.featured}
                  onClick={() => quick.mutate({ id: t.id, patch: { featured: !t.featured } })}
                  className="max-sm:hidden"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      t.featured ? "fill-primary text-primary" : "text-muted-foreground",
                    )}
                  />
                </button>
                <Switch
                  checked={t.isEnabled}
                  aria-label={t.isEnabled ? "Switch off" : "Switch on"}
                  onCheckedChange={(on) => quick.mutate({ id: t.id, patch: { isEnabled: on } })}
                />
              </div>
            ))}
          </section>

          <CategoriesPanel categories={categories} onChanged={refresh} />
        </div>
      )}

      <TemplateSheet
        id={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}

function TemplateSheet({
  id,
  categories,
  onClose,
  onSaved,
}: {
  id: string | null;
  categories: AdminTemplateCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const detail = useQuery({
    queryKey: chatbotTemplatesAdminKeys.detail(id ?? ""),
    queryFn: () => chatbotTemplatesAdminApi.get(id!),
    enabled: !!id,
  });
  const [form, setForm] = useState<{
    name: string;
    description: string;
    icon: string;
    categoryId: string;
    keywords: string;
    displayOrder: string;
  } | null>(null);

  useEffect(() => {
    const t = detail.data;
    if (!t) return;
    setForm({
      name: t.name,
      description: t.description,
      icon: t.icon,
      categoryId: t.categoryId ?? "",
      keywords: t.keywords.join(", "),
      displayOrder: String(t.displayOrder),
    });
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () =>
      chatbotTemplatesAdminApi.update(id!, {
        name: form!.name,
        description: form!.description,
        icon: form!.icon,
        categoryId: form!.categoryId || null,
        keywords: form!.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        displayOrder: Number(form!.displayOrder) || 0,
      }),
    onSuccess: () => {
      toast.success("Template saved");
      onSaved();
      void detail.refetch();
    },
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't save the template.")),
  });

  const t = detail.data;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t ? `${t.icon} ${t.name}` : "Template"}</SheetTitle>
          <SheetDescription>
            Name, description, category and search keywords. To change the flow itself, edit a
            chatbot and use Save as template, then replace this one.
          </SheetDescription>
        </SheetHeader>
        {!t || !form ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            {t.problem && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                Hidden from New chatbot: {t.problem}
              </p>
            )}
            <div className="grid grid-cols-[4rem_1fr] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-icon">Icon</Label>
                <Input
                  id="tpl-icon"
                  value={form.icon}
                  maxLength={16}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-name">Name</Label>
                <Input
                  id="tpl-name"
                  value={form.name}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-desc">One-line description</Label>
              <Textarea
                id="tpl-desc"
                rows={2}
                maxLength={140}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value.replace(/\n/g, " ") })
                }
              />
              <span className="text-[11px] text-muted-foreground">
                {form.description.length}/140. Needed to switch it on.
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-cat">Category</Label>
              <select
                id="tpl-cat"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">No category (can't be switched on)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-kw">Search keywords</Label>
              <Input
                id="tpl-kw"
                value={form.keywords}
                placeholder="coupon, promo, sale"
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              />
              <span className="text-[11px] text-muted-foreground">
                Comma-separated. Search also matches the name, category and description.
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-order">Display order</Label>
              <Input
                id="tpl-order"
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                className="w-28"
              />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="self-start">
              {save.isPending ? "Saving…" : "Save"}
            </Button>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Flow ({t.stepCount} steps, read-only)</h3>
              {t.requiredCapabilities.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Uses: {t.requiredCapabilities.join(", ")}
                </p>
              )}
              <ol className="flex flex-col gap-1.5">
                {t.preview.map((s) => (
                  <li key={s.key} className="rounded-lg border border-border p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {s.type}
                      </Badge>
                      <b className="font-medium">{s.name}</b>
                    </div>
                    {s.body && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-muted-foreground">
                        {s.body}
                      </p>
                    )}
                    {s.buttons.length > 0 && (
                      <p className="mt-1 text-muted-foreground">Buttons: {s.buttons.join(" · ")}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CategoriesPanel({
  categories,
  onChanged,
}: {
  categories: AdminTemplateCategory[];
  onChanged: () => void;
}) {
  const [label, setLabel] = useState("");
  const create = useMutation({
    mutationFn: () => chatbotTemplatesAdminApi.createCategory(label),
    onSuccess: () => {
      setLabel("");
      onChanged();
    },
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't add the category.")),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { label?: string; displayOrder?: number; isActive?: boolean };
    }) => chatbotTemplatesAdminApi.updateCategory(id, patch),
    onSuccess: onChanged,
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't update the category.")),
  });

  return (
    <section className="rounded-xl border border-border p-4">
      <h2 className="font-display text-base font-semibold">Categories</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        The chips under New chatbot. A category shows only while it has at least one template
        switched on.
      </p>
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_5rem_auto_auto] items-center gap-2">
            <Input
              defaultValue={c.label}
              aria-label={`Label for ${c.label}`}
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== c.label &&
                update.mutate({ id: c.id, patch: { label: e.target.value } })
              }
            />
            <Input
              type="number"
              min={0}
              defaultValue={c.displayOrder}
              aria-label={`Order for ${c.label}`}
              onBlur={(e) =>
                Number(e.target.value) !== c.displayOrder &&
                update.mutate({ id: c.id, patch: { displayOrder: Number(e.target.value) || 0 } })
              }
            />
            <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              {c.templateCount} template{c.templateCount === 1 ? "" : "s"}
            </span>
            <Switch
              checked={c.isActive}
              aria-label={c.isActive ? `Deactivate ${c.label}` : `Activate ${c.label}`}
              onCheckedChange={(on) => update.mutate({ id: c.id, patch: { isActive: on } })}
            />
          </div>
        ))}
        <form
          className="mt-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (label.trim()) create.mutate();
          }}
        >
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="New category, e.g. Pet Care"
            maxLength={80}
          />
          <Button type="submit" variant="outline" disabled={!label.trim() || create.isPending}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
      </div>
    </section>
  );
}
