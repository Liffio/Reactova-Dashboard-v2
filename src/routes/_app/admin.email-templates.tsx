import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2, Eye, Mail, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformAdminRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createEmailTemplate,
  deleteEmailTemplateCodeOverride,
  getEmailTemplateBrevoHtml,
  getEmailTemplateCodeHtml,
  getEmailTemplateRenderedBase,
  listEmailTemplates,
  publishEmailTemplate,
  saveEmailTemplateCodeHtml,
  setEmailTemplateSource,
  syncEmailTemplateBrevo,
  type EmailTemplateEntry,
} from "@/lib/api/admin-email-templates-api";

export const Route = createFileRoute("/_app/admin/email-templates")({
  head: () => ({ meta: [{ title: "Email Templates — Admin" }] }),
  component: EmailTemplatesRoute,
});

function EmailTemplatesRoute() {
  return (
    <PlatformAdminRoute>
      <EmailTemplatesPage />
    </PlatformAdminRoute>
  );
}

const categoryStyles: Record<string, string> = {
  security: "border-destructive/30 bg-destructive/10 text-destructive",
  notifications: "border-primary/30 bg-primary/10 text-primary",
  custom: "border-success/30 bg-success/10 text-success",
};

function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const [previewRef, setPreviewRef] = useState<string | null>(null);
  const [editorRef, setEditorRef] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"security" | "notifications" | "custom">("security");

  const templatesQuery = useQuery({
    queryKey: ["email-templates"],
    queryFn: listEmailTemplates,
  });

  const templates = templatesQuery.data?.templates ?? [];
  const filtered = templates.filter((t) => t.category === activeTab);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
  const editorTemplate = templates.find((t) => t.ref === editorRef);

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Email Templates"
        description="Manage transactional email templates across the platform."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {templatesQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="security">
                Security ({templates.filter((t) => t.category === "security").length})
              </TabsTrigger>
              <TabsTrigger value="notifications">
                Notifications ({templates.filter((t) => t.category === "notifications").length})
              </TabsTrigger>
              <TabsTrigger value="custom">
                Custom ({templates.filter((t) => t.category === "custom").length})
              </TabsTrigger>
            </TabsList>

            {(["security", "notifications", "custom"] as const).map((cat) => (
              <TabsContent key={cat} value={cat}>
                <div className="rounded-2xl border bg-card shadow-soft">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-6 py-3 font-medium">Template</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium hidden md:table-cell">Source</th>
                          <th className="px-4 py-3 font-medium hidden lg:table-cell">Variables</th>
                          <th className="px-6 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates
                          .filter((t) => t.category === cat)
                          .map((tmpl) => (
                            <TemplateRow
                              key={tmpl.ref}
                              template={tmpl}
                              onPreview={() => setPreviewRef(tmpl.ref)}
                              onEdit={() => setEditorRef(tmpl.ref)}
                              onSuccess={invalidate}
                            />
                          ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                              No {cat} templates.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {previewRef && <PreviewDialog ref_={previewRef} onClose={() => setPreviewRef(null)} />}
      {editorRef && editorTemplate && (
        <TemplateEditorDialog template={editorTemplate} onClose={() => setEditorRef(null)} onSuccess={invalidate} />
      )}
      {createOpen && <CreateTemplateDialog onClose={() => setCreateOpen(false)} onSuccess={() => { setCreateOpen(false); invalidate(); }} />}
    </div>
  );
}

function TemplateRow({
  template,
  onPreview,
  onEdit,
  onSuccess,
}: {
  template: EmailTemplateEntry;
  onPreview: () => void;
  onEdit: () => void;
  onSuccess: () => void;
}) {
  const syncMutation = useMutation({
    mutationFn: () => syncEmailTemplateBrevo(template.ref),
    onSuccess: () => {
      toast.success("Synced to Brevo");
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishEmailTemplate(template.ref, template.activeSource),
    onSuccess: () => {
      toast.success("Template published");
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">{template.label}</p>
            <code className="text-[10px] text-muted-foreground">{template.ref}</code>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <Badge
          variant="outline"
          className={categoryStyles[template.category] ?? ""}
        >
          {template.category}
        </Badge>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        <Badge
          variant="outline"
          className={
            template.activeSource === "brevo"
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-muted text-muted-foreground"
          }
        >
          {template.activeSource}
        </Badge>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {template.variables.slice(0, 3).map((v) => (
            <code key={v} className="rounded bg-muted px-1 py-0.5 text-[10px]">
              {v}
            </code>
          ))}
          {template.variables.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{template.variables.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-2">
          <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted" title="Preview" onClick={onPreview}>
            <Eye className="h-4 w-4" />
          </button>
          <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted" title="Edit HTML" onClick={onEdit}>
            <Code2 className="h-4 w-4" />
          </button>
          <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted" title="Sync to Brevo" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          </button>
          <button className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-muted" title="Publish" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
            <Send className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function PreviewDialog({ ref_, onClose }: { ref_: string; onClose: () => void }) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const previewQuery = useQuery({
    queryKey: ["email-template-preview", ref_],
    queryFn: () => getEmailTemplateRenderedBase(ref_),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 pr-8">
            <span>Preview: {ref_}</span>
            <div className="flex gap-1">
              {(["desktop", "mobile"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded px-2 py-0.5 text-xs capitalize ${view === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{v}</button>
              ))}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <div className={`rounded-lg border bg-white overflow-hidden transition-all ${view === "mobile" ? "w-[375px] h-[600px]" : "w-full h-[500px]"}`}>
            {previewQuery.isLoading ? (
              <div className="flex h-full items-center justify-center"><Skeleton className="h-full w-full" /></div>
            ) : previewQuery.data?.html ? (
              <iframe srcDoc={previewQuery.data.html} className="h-full w-full border-0" title="Email preview" sandbox="allow-same-origin" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No preview available.</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditorDialog({ template, onClose, onSuccess }: { template: EmailTemplateEntry; onClose: () => void; onSuccess: () => void }) {
  const [editorTab, setEditorTab] = useState<"code" | "brevo">("code");
  const [html, setHtml] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const codeHtmlQuery = useQuery({
    queryKey: ["email-template-code-html", template.ref],
    queryFn: () => getEmailTemplateCodeHtml(template.ref),
  });

  const brevoHtmlQuery = useQuery({
    queryKey: ["email-template-brevo-html", template.ref],
    queryFn: () => getEmailTemplateBrevoHtml(template.ref),
    enabled: editorTab === "brevo",
  });

  useEffect(() => {
    if (codeHtmlQuery.data?.html) setHtml(codeHtmlQuery.data.html);
  }, [codeHtmlQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => saveEmailTemplateCodeHtml(template.ref, html),
    onSuccess: () => { toast.success("Template saved"); onSuccess(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: () => deleteEmailTemplateCodeOverride(template.ref),
    onSuccess: () => { toast.success("Override deleted — using default template"); setDeleteOpen(false); onSuccess(); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const sourceMutation = useMutation({
    mutationFn: (source: "code" | "brevo") => setEmailTemplateSource(template.ref, source),
    onSuccess: () => { toast.success("Active source updated"); onSuccess(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4 pr-8">
              <span>Edit: {template.label}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Active source:</span>
                <div className="flex gap-1">
                  {(["code", "brevo"] as const).map((src) => (
                    <button key={src} onClick={() => sourceMutation.mutate(src)} disabled={sourceMutation.isPending} className={`rounded px-2 py-0.5 uppercase transition-colors ${template.activeSource === src ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{src}</button>
                  ))}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as typeof editorTab)}>
            <TabsList className="mb-2">
              <TabsTrigger value="code">Code HTML</TabsTrigger>
              <TabsTrigger value="brevo">Brevo HTML</TabsTrigger>
            </TabsList>
            <TabsContent value="code">
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className="w-full h-80 rounded-lg border bg-muted/20 font-mono text-xs p-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="<!DOCTYPE html>..."
                spellCheck={false}
              />
            </TabsContent>
            <TabsContent value="brevo">
              {brevoHtmlQuery.isLoading ? (
                <Skeleton className="h-80 rounded-lg" />
              ) : brevoHtmlQuery.data?.html ? (
                <div className="h-80 overflow-hidden rounded-lg border bg-white">
                  <iframe srcDoc={brevoHtmlQuery.data.html} className="h-full w-full border-0" title="Brevo template" sandbox="allow-same-origin" />
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center rounded-lg border text-sm text-muted-foreground">No Brevo template available.</div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            {template.hasCodeOverride && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive mr-auto gap-1" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete override
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saveMutation.isPending || editorTab !== "code"} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save HTML"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete code override?</AlertDialogTitle>
            <AlertDialogDescription>The template will revert to its default compiled HTML.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteOverrideMutation.isPending} onClick={() => deleteOverrideMutation.mutate()}>
              {deleteOverrideMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateTemplateDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [label, setLabel] = useState("");
  const [subject, setSubject] = useState("");
  const [slug, setSlug] = useState("");
  const [variables, setVariables] = useState("");

  const createMutation = useMutation({
    mutationFn: () => createEmailTemplate({
      label,
      subject,
      slug: slug || undefined,
      variables: variables.split(",").map((v) => v.trim()).filter(Boolean),
    }),
    onSuccess: () => { toast.success("Template created"); onSuccess(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New email template</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Label</Label><Input placeholder="My Custom Template" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="space-y-2"><Label>Subject</Label><Input placeholder="Subject line" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-2"><Label>Slug (optional)</Label><Input placeholder="my-template" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></div>
          <div className="space-y-2"><Label>Variables (comma-separated)</Label><Input placeholder="name, email, link" value={variables} onChange={(e) => setVariables(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={createMutation.isPending || !label.trim() || !subject.trim()} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? "Creating…" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
