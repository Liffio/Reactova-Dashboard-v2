import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileKey,
  Info,
  Plus,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { EmptyState, Field, FormSection } from "@/components/admin/form-page";
import { ConfirmCodeField, useConfirmCode } from "@/components/admin/confirm-code";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformAuthz } from "@/hooks/use-platform-authz";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import {
  generatePluginSigningKey,
  getPluginSigningKeys,
  installPluginSigningKey,
  revokePluginSigningKey,
  type GenerateSigningKeyResponse,
  type SigningKeyStatusResponse,
  type SigningKeyView,
} from "@/lib/api/plugins-admin-api";

const PLUGIN_MANAGE = "platform:plugin_manage";
const QUERY_KEY = ["plugin-signing-keys"] as const;

/** Label cap and PEM cap are the server's — mirrored so the input stops rather than the request. */
const LABEL_MAX = 120;
const PEM_MAX = 4000;

/** Swapping the key invalidates every archive signed with the old one. Said the same way everywhere. */
const REPLACE_WARNING =
  "This replaces the current key. Archives signed with the old key will stop verifying — re-sign and re-upload anything you still need to install.";

export const Route = createFileRoute("/_app/admin/plugins_/signing-keys")({
  head: () => ({ meta: [{ title: "Plugin signing keys — Admin" }] }),
  component: PluginSigningKeysRoute,
});

function PluginSigningKeysRoute() {
  return (
    <PlatformPermissionRoute permission={PLUGIN_MANAGE}>
      <PluginSigningKeysPage />
    </PlatformPermissionRoute>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                */
/* -------------------------------------------------------------------------- */

/** Copies `value`, falling back to showing it when the clipboard is unavailable (insecure origin,
 *  embedded webview) so the operator can select it by hand instead of pressing a dead button. */
function copyToClipboard(value: string, label: string, onCopied?: () => void) {
  void navigator.clipboard.writeText(value).then(
    () => {
      onCopied?.();
      toast.success(`${label} copied`);
    },
    () => toast.message(value, { description: "Copy manually — clipboard unavailable." }),
  );
}

/**
 * A 64-hex-char fingerprint, truncated for reading and copyable in full.
 *
 * The full value is the point: comparing it against `liffio-plugin fingerprint <key.pem>` is what
 * separates "wrong key" from "bad archive" when an upload is rejected. So the copy always carries
 * all 64 characters even when only the first 12 are on screen.
 */
function Fingerprint({ value, chars = 12 }: { value: string; chars?: number }) {
  const [copied, setCopied] = useState(false);
  const truncated = value.length > chars ? `${value.slice(0, chars)}…` : value;

  return (
    <button
      type="button"
      onClick={() =>
        copyToClipboard(value, "Fingerprint", () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        })
      }
      title={value}
      aria-label={`Copy full fingerprint ${value}`}
      className="group inline-flex max-w-full items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-xs transition-colors hover:bg-muted/70"
    >
      <span className="truncate">{truncated}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-80" />
      )}
    </button>
  );
}

/** PEM is multi-line and the newlines are load-bearing — never collapse them. */
function PemBlock({ value, className = "" }: { value: string; className?: string }) {
  return (
    <pre
      className={`max-h-56 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed ${className}`}
      style={{ whiteSpace: "pre" }}
    >
      {value}
    </pre>
  );
}

/** Form-level error slot for whatever `useConfirmCode` didn't claim as a code problem. */
function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      {/* Verbatim: for INVALID_PUBLIC_KEY the server's wording is what tells the operator the key
          they just sent should be treated as compromised. Paraphrasing would lose that. */}
      <AlertDescription className="whitespace-pre-wrap">{message}</AlertDescription>
    </Alert>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

function PluginSigningKeysPage() {
  const queryClient = useQueryClient();
  const { authz } = usePlatformAuthz();
  const canMutate = authz.isSuperAdmin;

  const [installOpen, setInstallOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [revoking, setRevoking] = useState<SigningKeyView | null>(null);
  const [generated, setGenerated] = useState<GenerateSigningKeyResponse | null>(null);

  const statusQuery = useQuery({ queryKey: QUERY_KEY, queryFn: getPluginSigningKeys });
  const status = statusQuery.data;

  const refetch = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Plugin signing keys"
        description="The Ed25519 public key every plugin upload is verified against. Exactly one key is in force at a time."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!canMutate}
              title={canMutate ? undefined : "Super admin access required"}
              onClick={() => setInstallOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              Install public key
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
              disabled={!canMutate}
              title={canMutate ? undefined : "Super admin access required"}
              onClick={() => setGenerateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Generate keypair
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        {/* A scoped PLUGIN_MANAGE operator can read this panel but not change anything. Saying so
            up front beats letting them fill in a dialog and collecting a 403 on submit. */}
        {!canMutate && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Read-only</AlertTitle>
            <AlertDescription>
              Installing, generating and revoking signing keys requires super admin access. You can
              see the key in force and the full history here.
            </AlertDescription>
          </Alert>
        )}

        {statusQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : statusQuery.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Couldn&apos;t load signing keys</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{(statusQuery.error as Error).message}</span>
              <Button size="sm" variant="outline" onClick={() => void statusQuery.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : status ? (
          <>
            <StatusCard status={status} />
            <HistoryCard
              status={status}
              canMutate={canMutate}
              onRevoke={(key) => setRevoking(key)}
            />
            <VerifyNote />
          </>
        ) : null}
      </div>

      <InstallKeyDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        hasActiveKey={Boolean(status?.activeFingerprint)}
        onInstalled={() => {
          setInstallOpen(false);
          void refetch();
        }}
      />

      <GenerateKeyDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        hasActiveKey={Boolean(status?.activeFingerprint)}
        onGenerated={(result) => {
          setGenerateOpen(false);
          // Straight into the one-shot modal — the private key exists nowhere else.
          setGenerated(result);
          void refetch();
        }}
      />

      <RevokeKeyDialog
        keyToRevoke={revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        onSettledRefetch={refetch}
        onRevoked={() => {
          setRevoking(null);
          void refetch();
        }}
      />

      <GeneratedKeyModal result={generated} onDismiss={() => setGenerated(null)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What is verifying uploads right now.
 *
 * Driven by `source`, never by `active` being non-null: an env-sourced key is in force with no
 * database row behind it, so `active: null` there is a healthy state and not an empty one.
 */
function StatusCard({ status }: { status: SigningKeyStatusResponse }) {
  if (status.source === "none") {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Plugin uploads are being rejected</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            No signing key is configured — neither installed here nor present in the{" "}
            <code className="font-mono text-[11px]">PLUGIN_PUBLIC_KEY</code> environment variable.
            Every plugin upload fails signature verification until a key is in place.
          </p>
          <p>Generate a keypair or install the public key your build machine already signs with.</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (status.source === "env") {
    return (
      <FormSection
        title="Key in force"
        description="Loaded from the environment. This is the legacy path and it works."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">From environment</Badge>
            <span className="text-xs text-muted-foreground">No database row behind this key.</span>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Fingerprint</p>
            {status.activeFingerprint ? (
              <Fingerprint value={status.activeFingerprint} chars={64} />
            ) : (
              // A malformed env key answers `activeFingerprint: null` while still reporting
              // `source: "env"` — worth calling out, since uploads will fail against it.
              <p className="text-xs text-destructive">
                The environment key could not be parsed, so no fingerprint is available. Uploads
                signed against it will not verify — install a key here to replace it.
              </p>
            )}
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This key comes from the{" "}
              <code className="font-mono text-[11px]">PLUGIN_PUBLIC_KEY</code> environment variable
              and changes only with a redeploy. Installing a key here takes over from it and
              survives redeploys.
            </AlertDescription>
          </Alert>
        </div>
      </FormSection>
    );
  }

  const active = status.active;
  return (
    <FormSection title="Key in force" description="Installed here, and it survives redeploys.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">
            Active
          </Badge>
          {active && (
            <Badge variant="outline">
              {active.generated ? "Generated by platform" : "Uploaded by operator"}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Fingerprint</p>
            {status.activeFingerprint && (
              <Fingerprint value={status.activeFingerprint} chars={64} />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Label</p>
            <p className="text-sm">
              {active?.label ?? <span className="text-muted-foreground">No label</span>}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="text-sm">{formatDateTime(active?.createdAt)}</p>
          </div>
        </div>

        {active && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Public key</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
                onClick={() => copyToClipboard(active.publicKeyPem, "Public key")}
              >
                <Copy className="h-3 w-3" />
                Copy PEM
              </Button>
            </div>
            <PemBlock value={active.publicKeyPem} />
          </div>
        )}
      </div>
    </FormSection>
  );
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

function HistoryCard({
  status,
  canMutate,
  onRevoke,
}: {
  status: SigningKeyStatusResponse;
  canMutate: boolean;
  onRevoke: (key: SigningKeyView) => void;
}) {
  return (
    <FormSection
      title="Key history"
      description="Every key ever installed or generated, newest first. Revoked keys are read-only history."
    >
      {status.keys.length === 0 ? (
        <EmptyState icon={FileKey} title="No keys installed">
          {status.source === "env"
            ? "The key in force comes from the environment. Nothing has been installed through this panel yet."
            : "Generate a keypair or install a public key to get started."}
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border">
          {status.keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Fingerprint value={key.fingerprint} />
                  {key.active ? (
                    <Badge className="border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Revoked</Badge>
                  )}
                  <Badge variant="outline">{key.generated ? "Generated" : "Uploaded"}</Badge>
                </div>
                <p className="text-sm">
                  {key.label ?? <span className="text-muted-foreground">No label</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {formatDateTime(key.createdAt)}
                  {key.revokedAt ? ` · Revoked ${formatDateTime(key.revokedAt)}` : ""}
                </p>
              </div>
              {key.active && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={!canMutate}
                  title={canMutate ? undefined : "Super admin access required"}
                  onClick={() => onRevoke(key)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}

function VerifyNote() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Confirming a key matches your build machine</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            liffio-plugin fingerprint &lt;your key.pem&gt;
          </code>{" "}
          and compare its output with the fingerprint above. It prints exactly this value, and works
          on either half of the pair.
        </p>
        <p className="text-muted-foreground">
          That comparison is what tells you whether a rejected upload is the wrong key or a bad
          archive.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

/** Detects a private key pasted into the public-key box, before it leaves the browser.
 *  The server rejects these too — and tells the operator to treat the key as compromised — but
 *  the best outcome is that the private half was never transmitted at all. */
const PRIVATE_KEY_MARKER = /-----BEGIN[A-Z ]*PRIVATE KEY-----/;

function InstallKeyDialog({
  open,
  onOpenChange,
  hasActiveKey,
  onInstalled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasActiveKey: boolean;
  onInstalled: () => void;
}) {
  const [pem, setPem] = useState("");
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pemError, setPemError] = useState<string | null>(null);
  const confirmCode = useConfirmCode();

  useEffect(() => {
    if (!open) return;
    setPem("");
    setLabel("");
    setFormError(null);
    setPemError(null);
    confirmCode.reset();
    // Resetting is keyed on the dialog opening; `confirmCode` is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      installPluginSigningKey({
        publicKeyPem: pem,
        label: label.trim() || null,
        confirmCode: confirmCode.code,
      }),
    onSuccess: (key) => {
      toast.success("Signing key installed", {
        description: `Uploads are now verified against ${key.fingerprint.slice(0, 12)}…`,
      });
      onInstalled();
    },
    onError: (err) => setFormError(confirmCode.applyError(err)),
  });

  const submit = () => {
    setFormError(null);
    setPemError(null);
    if (PRIVATE_KEY_MARKER.test(pem)) {
      setPemError(
        "That is a private key. Paste the public half only — the private key must never leave your build machine.",
      );
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Install public key</DialogTitle>
          <DialogDescription>
            Paste the public half of the keypair your build machine signs plugin archives with.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasActiveKey && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>A key is already active</AlertTitle>
              <AlertDescription>{REPLACE_WARNING}</AlertDescription>
            </Alert>
          )}

          <Field
            label="Public key (PEM)"
            required
            error={pemError}
            hint="Include the BEGIN/END lines and keep the line breaks intact."
          >
            <Textarea
              value={pem}
              onChange={(e) => {
                // Bound to the raw value: trimming or normalising would strip the newlines the
                // server needs to parse the PEM.
                setPem(e.target.value);
                setPemError(null);
              }}
              rows={8}
              maxLength={PEM_MAX}
              spellCheck={false}
              placeholder={"-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----"}
              className="font-mono text-[11px]"
            />
          </Field>

          <Field label="Label" hint={`Optional. How you'll recognise this key. Max ${LABEL_MAX}.`}>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={LABEL_MAX}
              placeholder="build-box"
            />
          </Field>

          <ConfirmCodeField state={confirmCode} disabled={mutation.isPending} />
          <FormError message={formError} />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending || pem.trim().length === 0 || !confirmCode.isComplete}
          >
            {mutation.isPending ? "Installing…" : "Install key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Generate                                                                   */
/* -------------------------------------------------------------------------- */

function GenerateKeyDialog({
  open,
  onOpenChange,
  hasActiveKey,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasActiveKey: boolean;
  onGenerated: (result: GenerateSigningKeyResponse) => void;
}) {
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const confirmCode = useConfirmCode();

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setFormError(null);
    confirmCode.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      generatePluginSigningKey({ label: label.trim() || null, confirmCode: confirmCode.code }),
    onSuccess: onGenerated,
    onError: (err) => setFormError(confirmCode.applyError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate keypair</DialogTitle>
          <DialogDescription>
            The platform mints an Ed25519 pair, keeps the public half, and hands you the private
            half once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasActiveKey && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>A key is already active</AlertTitle>
              <AlertDescription>{REPLACE_WARNING}</AlertDescription>
            </Alert>
          )}

          <Field label="Label" hint={`Optional. How you'll recognise this key. Max ${LABEL_MAX}.`}>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={LABEL_MAX}
              placeholder="build-box 2026-08"
            />
          </Field>

          <ConfirmCodeField state={confirmCode} disabled={mutation.isPending} />
          <FormError message={formError} />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !confirmCode.isComplete}
          >
            {mutation.isPending ? "Generating…" : "Generate keypair"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The private key, shown once.
 *
 * This modal is the only place this value will ever exist: it is not stored server-side, not
 * audited, and no later request returns it. So it cannot be dismissed by accident — no backdrop
 * click, no Escape, no close button — and the operator has to say they've saved it. Nothing here
 * logs, reports or persists the key; it lives in component state and dies with the modal.
 */
function GeneratedKeyModal({
  result,
  onDismiss,
}: {
  result: GenerateSigningKeyResponse | null;
  onDismiss: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (result) {
      setAcknowledged(false);
      setDownloaded(false);
    }
  }, [result]);

  const filename = useMemo(
    () =>
      result
        ? `plugin-signing-key-${result.key.fingerprint.slice(0, 12)}.pem`
        : "plugin-signing-key.pem",
    [result],
  );

  if (!result) return null;

  const download = () => {
    const blob = new Blob([result.privateKeyPem], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    // Firefox only follows the click for an anchor that is in the document, and revoking the
    // object URL in the same tick can cancel the download before it starts.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        // The built-in close button is the last direct child of the content.
        className="max-h-[90vh] max-w-2xl overflow-y-auto [&>button:last-child]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Save your private key now</DialogTitle>
          <DialogDescription>
            This is the only time this key is shown. It is not stored anywhere on the platform and
            cannot be recovered — if you lose it you'll have to generate a new pair and re-sign
            every archive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{result.warning}</AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button onClick={download} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {downloaded ? "Download again" : "Download .pem"}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => copyToClipboard(result.privateKeyPem, "Private key")}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Private key ({filename})</p>
            <PemBlock value={result.privateKeyPem} />
          </div>

          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Public key — now active, fingerprint {result.key.fingerprint.slice(0, 12)}…
            </p>
            <Fingerprint value={result.key.fingerprint} chars={64} />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              I've saved the private key somewhere safe. I understand it can't be shown again.
            </span>
          </label>
          {!downloaded && (
            <p className="text-[11px] text-muted-foreground">
              Downloading is the copy that survives a closed tab — a clipboard doesn't.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onDismiss} disabled={!acknowledged}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Revoke                                                                     */
/* -------------------------------------------------------------------------- */

function RevokeKeyDialog({
  keyToRevoke,
  onOpenChange,
  onRevoked,
  onSettledRefetch,
}: {
  keyToRevoke: SigningKeyView | null;
  onOpenChange: (open: boolean) => void;
  onRevoked: () => void;
  /** For the two errors that mean "your list is stale" — refetching is the fix. */
  onSettledRefetch: () => Promise<void> | void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const confirmCode = useConfirmCode();
  const open = Boolean(keyToRevoke);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    confirmCode.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => revokePluginSigningKey(keyToRevoke!.id, { confirmCode: confirmCode.code }),
    onSuccess: () => {
      toast.success("Signing key revoked", {
        description: "Plugin uploads now fall back to the PLUGIN_PUBLIC_KEY environment variable.",
      });
      onRevoked();
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "KEY_NOT_FOUND" || code === "ALREADY_REVOKED") {
        // Someone else got there first, or this row is stale. The list is the answer.
        toast.message(err instanceof Error ? err.message : "This key is already gone", {
          description: "Refreshing the key list.",
        });
        void onSettledRefetch();
        onOpenChange(false);
        return;
      }
      setFormError(confirmCode.applyError(err));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revoke this signing key?</DialogTitle>
          <DialogDescription>
            Revoking retires the key without installing a replacement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Uploads may stop working entirely</AlertTitle>
            <AlertDescription>
              Verification falls back to the{" "}
              <code className="font-mono text-[11px]">PLUGIN_PUBLIC_KEY</code> environment variable.
              If that is empty, <strong>every plugin upload is rejected</strong> until a new key is
              installed.
            </AlertDescription>
          </Alert>

          {keyToRevoke && (
            <div className="space-y-1.5 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {keyToRevoke.label ?? "No label"}
              </p>
              <Fingerprint value={keyToRevoke.fingerprint} chars={64} />
            </div>
          )}

          <ConfirmCodeField state={confirmCode} disabled={mutation.isPending} />
          <FormError message={formError} />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !confirmCode.isComplete}
          >
            {mutation.isPending ? "Revoking…" : "Revoke key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
