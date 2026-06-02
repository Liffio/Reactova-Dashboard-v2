import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Code2, Globe, Eye, Smartphone, Monitor, RefreshCw, Upload, Trash2, CheckCircle, Lock, ChevronRight, AlertTriangle } from "lucide-react";
import Editor from "@monaco-editor/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  useEmailTemplatesQuery,
  useEmailTemplateCodeHtmlQuery,
  useEmailTemplateBrevoHtmlQuery,
  useSaveCodeHtmlMutation,
  useDeleteCodeOverrideMutation,
  useBrevoSyncMutation,
  usePublishMutation,
  type EmailTemplateEntry,
  type ActiveEmailSource
} from "@/hooks/useEmailTemplates";
import { API_BASE } from "@/lib/api";

// ── Preview iframe ────────────────────────────────────────────────────────────

function EmailPreview({ html, view }: { html: string; view: "desktop" | "mobile" }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  return (
    <div className={cn(
      "mx-auto border border-border rounded-xl overflow-hidden bg-muted/30 transition-all duration-300",
      view === "mobile" ? "max-w-[390px]" : "max-w-full"
    )}>
      <iframe
        ref={iframeRef}
        title="Email preview"
        className="w-full border-0"
        style={{ height: view === "mobile" ? "680px" : "560px" }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

// ── Variable chip ─────────────────────────────────────────────────────────────

function VarChip({ name }: { name: string }) {
  return (
    <code
      className="inline-flex items-center px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-mono border border-violet-200 dark:border-violet-800 cursor-pointer select-all"
      title={`Click to copy {{${name}}}`}
      onClick={() => {
        void navigator.clipboard.writeText(`{{${name}}}`);
        toast.success(`Copied {{${name}}}`);
      }}
    >
      {`{{${name}}}`}
    </code>
  );
}

// ── Template list item ────────────────────────────────────────────────────────

function TemplateListItem({
  template,
  isSelected,
  onClick
}: {
  template: EmailTemplateEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 rounded-lg transition-colors duration-150 flex items-start gap-3 group",
        isSelected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/60 border border-transparent"
      )}
    >
      <div className="mt-0.5 shrink-0">
        {template.isOtpLocked ? (
          <Lock className="h-4 w-4 text-amber-500" />
        ) : (
          <Mail className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{template.label}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {template.category}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-4",
              template.activeSource === "brevo"
                ? "border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400"
                : "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400"
            )}
          >
            {template.activeSource === "brevo" ? "Brevo" : "Code"}
          </Badge>
          {template.hasCodeOverride && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400">
              override
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 mt-1 text-muted-foreground transition-transform", isSelected && "rotate-90")} />
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function TemplateDetail({ template }: { template: EmailTemplateEntry }) {
  const [editorTab, setEditorTab] = useState<"code" | "brevo">("code");
  const [previewView, setPreviewView] = useState<"desktop" | "mobile">("desktop");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [editorHtml, setEditorHtml] = useState<string>("");
  const [brevoFetchEnabled, setBrevoFetchEnabled] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const codeHtmlQuery = useEmailTemplateCodeHtmlQuery(template.ref);
  const brevoHtmlQuery = useEmailTemplateBrevoHtmlQuery(template.ref, brevoFetchEnabled);

  const saveCodeMutation = useSaveCodeHtmlMutation();
  const deleteOverrideMutation = useDeleteCodeOverrideMutation();
  const brevoSyncMutation = useBrevoSyncMutation();
  const publishMutation = usePublishMutation();

  // Load code HTML into editor when template or tab changes
  useEffect(() => {
    if (editorTab === "code" && codeHtmlQuery.data?.html) {
      setEditorHtml(codeHtmlQuery.data.html);
      setIsDirty(false);
    }
  }, [codeHtmlQuery.data, editorTab]);

  useEffect(() => {
    if (editorTab === "brevo" && brevoHtmlQuery.data?.html) {
      setEditorHtml(brevoHtmlQuery.data.html);
      setIsDirty(false);
    }
  }, [brevoHtmlQuery.data, editorTab]);

  // Reset when switching templates
  useEffect(() => {
    setEditorTab("code");
    setPreviewSrc(null);
    setIsDirty(false);
    setBrevoFetchEnabled(false);
  }, [template.ref]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    setEditorHtml(value ?? "");
    setIsDirty(true);
  }, []);

  const refreshPreview = () => {
    setPreviewSrc(editorHtml || codeHtmlQuery.data?.html || "");
  };

  const handleLivePreview = () => {
    // Open the server-rendered preview in a new tab (uses sample vars)
    const [category, key] = template.ref.split(".");
    window.open(`${API_BASE}/api/v1/admin/email-templates/${category}/${key}/preview`, "_blank");
  };

  const handleSaveDraft = async () => {
    if (!isDirty) return;
    if (editorTab === "code") {
      await saveCodeMutation.mutateAsync({ ref: template.ref, html: editorHtml });
      toast.success("Draft saved — will be used for Code source sends");
      setIsDirty(false);
    } else {
      // Brevo tab — just update local state (push happens on publish)
      toast.info("Brevo edits will be pushed when you click Publish");
    }
  };

  const handleRevertOverride = async () => {
    await deleteOverrideMutation.mutateAsync(template.ref);
    await codeHtmlQuery.refetch();
    toast.success("Override removed — using base code render");
  };

  const handleSyncToBrevo = async () => {
    try {
      const result = await brevoSyncMutation.mutateAsync(template.ref);
      toast.success(`Synced to Brevo (template ID ${(result as { templateId?: number }).templateId ?? ""})`);
    } catch {
      toast.error("Brevo sync failed — check BREVO_API_KEY and server logs");
    }
  };

  const handlePublish = async () => {
    const source: ActiveEmailSource = editorTab === "brevo" ? "brevo" : "code";

    if (template.isOtpLocked && source === "brevo") {
      toast.error("OTP templates are always sent via Code — source cannot be changed");
      return;
    }

    try {
      const htmlToPublish = isDirty ? editorHtml : undefined;
      await publishMutation.mutateAsync({ ref: template.ref, source, html: htmlToPublish });
      setIsDirty(false);
      toast.success(`Published — active source set to ${source === "brevo" ? "Brevo" : "Code"}`);
    } catch (err) {
      toast.error((err as Error).message ?? "Publish failed");
    }
  };

  const isLoading = codeHtmlQuery.isLoading;
  const isBusy =
    saveCodeMutation.isPending ||
    deleteOverrideMutation.isPending ||
    brevoSyncMutation.isPending ||
    publishMutation.isPending;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{template.label}</h2>
            {template.isOtpLocked && (
              <Badge variant="outline" className="border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400 gap-1">
                <Lock className="h-3 w-3" />
                OTP locked
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono">{template.ref}</p>
        </div>

        {/* Active source indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">Active source:</span>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 font-medium",
              template.activeSource === "brevo"
                ? "border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400"
                : "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400"
            )}
          >
            {template.activeSource === "brevo" ? (
              <><Globe className="h-3 w-3" />Brevo</>
            ) : (
              <><Code2 className="h-3 w-3" />Code</>
            )}
          </Badge>
          {template.hasCodeOverride && (
            <Badge variant="outline" className="border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400 text-xs">
              override active
            </Badge>
          )}
        </div>
      </div>

      {/* Variables */}
      <div className="rounded-xl border border-border bg-muted/20 p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Available variables (click to copy)</p>
        <div className="flex flex-wrap gap-1.5">
          {template.variables.map((v) => <VarChip key={v} name={v} />)}
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="grid xl:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Editor */}
        <div className="flex flex-col gap-3 min-h-0">
          <Tabs value={editorTab} onValueChange={(v) => {
            setEditorTab(v as "code" | "brevo");
            if (v === "brevo") setBrevoFetchEnabled(true);
          }}>
            <div className="flex items-center justify-between">
              <TabsList className="h-8">
                <TabsTrigger value="code" className="text-xs gap-1.5">
                  <Code2 className="h-3 w-3" />Code HTML
                </TabsTrigger>
                <TabsTrigger value="brevo" className="text-xs gap-1.5" disabled={!template.templateId && !template.isOtpLocked}>
                  <Globe className="h-3 w-3" />Brevo HTML
                  {!template.templateId && <span className="text-[10px] text-muted-foreground ml-1">(not synced)</span>}
                </TabsTrigger>
              </TabsList>

              {isDirty && (
                <span className="text-xs text-orange-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Unsaved
                </span>
              )}
            </div>

            <TabsContent value="code" className="mt-2 flex-1">
              {isLoading ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden" style={{ height: "360px" }}>
                  <Editor
                    language="html"
                    value={editorHtml}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: "on",
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2
                    }}
                  />
                </div>
              )}
              {template.hasCodeOverride && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground mt-1.5 h-7 gap-1"
                  disabled={isBusy}
                  onClick={handleRevertOverride}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove override (revert to base render)
                </Button>
              )}
            </TabsContent>

            <TabsContent value="brevo" className="mt-2 flex-1">
              {brevoHtmlQuery.isLoading ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                  Fetching from Brevo...
                </div>
              ) : brevoHtmlQuery.isError ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 text-amber-400" />
                  <p>{!template.templateId ? "This template hasn't been synced to Brevo yet." : "Could not load Brevo HTML."}</p>
                  {!template.isOtpLocked && (
                    <Button variant="outline" size="sm" onClick={handleSyncToBrevo} disabled={isBusy}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Sync to Brevo first
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden" style={{ height: "360px" }}>
                  <Editor
                    language="html"
                    value={editorHtml}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: "on",
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2
                    }}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleLivePreview} className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Open preview
            </Button>

            {editorTab === "code" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSaveDraft()}
                disabled={!isDirty || isBusy}
                className="gap-1.5"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Save draft
              </Button>
            )}

            {!template.isOtpLocked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSyncToBrevo()}
                disabled={isBusy}
                className="gap-1.5"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", brevoSyncMutation.isPending && "animate-spin")} />
                Sync to Brevo
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => void handlePublish()}
              disabled={isBusy || (template.isOtpLocked && editorTab === "brevo")}
              className="gap-1.5 ml-auto"
            >
              <Upload className="h-3.5 w-3.5" />
              {publishMutation.isPending ? "Publishing..." : "Publish & activate"}
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Preview</p>
            <div className="flex items-center gap-1">
              <Button
                variant={previewView === "desktop" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setPreviewView("desktop")}
              >
                <Monitor className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={previewView === "mobile" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setPreviewView("mobile")}
              >
                <Smartphone className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={refreshPreview}
                title="Refresh preview with current editor content"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {previewSrc !== null ? (
            <EmailPreview html={previewSrc} view={previewView} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-dashed border-border rounded-xl text-muted-foreground text-sm min-h-[400px]">
              <Eye className="h-8 w-8 opacity-40" />
              <p>Click the refresh button to render a preview</p>
              <Button variant="outline" size="sm" onClick={refreshPreview} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Render preview
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* OTP notice */}
      {template.isOtpLocked && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 flex gap-2 text-sm text-amber-700 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <p>This is an OTP template. It always renders from code at send time — Brevo source is not available. You can still edit and save the HTML override which will be used instead of the base code render.</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmailTemplates() {
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const listQuery = useEmailTemplatesQuery();
  const templates = listQuery.data?.templates ?? [];

  const filtered = templates.filter(
    (t) =>
      !search ||
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.ref.toLowerCase().includes(search.toLowerCase())
  );

  const security = filtered.filter((t) => t.category === "security");
  const notifications = filtered.filter((t) => t.category === "notifications");

  const selectedTemplate = templates.find((t) => t.ref === selectedRef) ?? null;

  return (
    <DashboardLayout
      title="Email Templates"
      subtitle="Manage transactional email templates — edit HTML, preview, and choose Code or Brevo source per template."
    >
      <div className="grid lg:grid-cols-[280px_1fr] gap-4 h-full min-h-[600px]">
        {/* Left: template list */}
        <aside className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2 overflow-y-auto">
          <input
            className="w-full h-8 px-3 rounded-lg border border-input bg-background text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {listQuery.isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          )}

          {security.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mt-2">Security</p>
              {security.map((t) => (
                <TemplateListItem
                  key={t.ref}
                  template={t}
                  isSelected={t.ref === selectedRef}
                  onClick={() => setSelectedRef(t.ref)}
                />
              ))}
            </>
          )}

          {notifications.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mt-3">Notifications</p>
              {notifications.map((t) => (
                <TemplateListItem
                  key={t.ref}
                  template={t}
                  isSelected={t.ref === selectedRef}
                  onClick={() => setSelectedRef(t.ref)}
                />
              ))}
            </>
          )}
        </aside>

        {/* Right: detail panel */}
        <section className="rounded-xl border border-border bg-card p-5 overflow-y-auto">
          {selectedTemplate ? (
            <TemplateDetail key={selectedTemplate.ref} template={selectedTemplate} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Mail className="h-12 w-12 opacity-30" />
              <p className="text-sm">Select a template to view and edit</p>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
