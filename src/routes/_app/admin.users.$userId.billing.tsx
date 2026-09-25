import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CreditCard,
  ExternalLink,
  FileText,
  RefreshCw,
  Download,
  Eye,
  FileCheck,
  Loader2,
  Send,
} from "lucide-react";

import { EmptyState, FormSection, ToggleRow } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http";
import { formatDate, formatMoneyCents } from "@/lib/format";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import {
  getAdminUserWorkspaces,
  type AdminUserWorkspaceMembership,
} from "@/lib/api/admin-users-api";
import {
  BILLING_PLANS,
  compWorkspacePlan,
  getWorkspaceSubscriptionAdmin,
  listWorkspaceInvoicesAdmin,
  fetchInvoicePdfAdmin,
  fetchInvoiceViewAdmin,
  resendInvoiceAdmin,
  reissueInvoiceAdmin,
  setWorkspaceCancelAtPeriodEnd,
  syncWorkspaceSubscriptionAdmin,
  type AdminBillingPlan,
  type AdminWorkspaceSubscriptionDetail,
} from "@/lib/api/admin-workspaces-api";
import type { BillingInvoiceRow } from "@/lib/api/billing-api";
import { saveBlob, invoiceFileName } from "@/lib/api/billing-api";

/**
 * "Billing" tab (Task 21) — spec §6.8–§6.9. Same workspace-selector shape as the AI & API tab
 * (`admin.users.$userId.ai-api.tsx`) — duplicated locally rather than shared, matching this
 * codebase's per-file small-helper convention (see that file's own doc comment, and
 * `agency.tsx`/`billings.tsx`/`admin.users.tsx`'s independently-duplicated status maps).
 * `platform:billing_manage` gates the whole surface, reads included (task-20-report.md §4 — the
 * catalogue has only this one key for both), so the panel itself — not just its mutations — is
 * hidden without it.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/billing")({
  head: () => ({ meta: [{ title: "Billing — User — Admin" }] }),
  component: BillingTab,
});

const BILLING_MANAGE = "platform:billing_manage";

/** Same vocabulary/styling as `admin.users.$userId.workspaces.tsx`'s own copies. */
const WORKSPACE_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAUSED: "border-warning/30 bg-warning/10 text-warning",
  SUSPENDED: "border-destructive/30 bg-destructive/10 text-destructive",
  PAYMENT_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  INSTAGRAM_DISCONNECTED: "border-warning/30 bg-warning/10 text-warning",
};

const BILLING_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAID: "border-success/30 bg-success/10 text-success",
  PAST_DUE: "border-warning/30 bg-warning/10 text-warning",
  PAYMENT_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELED: "border-border bg-muted text-muted-foreground",
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  paid: "border-success/30 bg-success/10 text-success",
  open: "border-warning/30 bg-warning/10 text-warning",
  void: "border-border bg-muted text-muted-foreground",
  uncollectible: "border-destructive/30 bg-destructive/10 text-destructive",
};

function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function errorToast(err: unknown, fallback: string) {
  const requestId = err instanceof ApiError ? err.requestId : undefined;
  toast.error(err instanceof Error ? err.message : fallback, {
    description: requestId ? `Request ID: ${requestId}` : undefined,
  });
}

function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm">
      <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-destructive" />
      <p className="font-medium text-destructive">{message}</p>
      {requestId && (
        <p className="mt-1 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span>
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

function RestrictedPanel({ title, permission }: { title: string; permission: string }) {
  return (
    <FormSection title={title}>
      <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        You don't have <span className="font-mono text-xs">{permission}</span> — this section is
        hidden.
      </div>
    </FormSection>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function StatBlockBadge({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: Record<string, string>;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <Badge
        variant="outline"
        className={cn("mt-0.5 text-[10px]", styles[value.toUpperCase()] ?? "")}
      >
        {humanizeEnum(value || "—")}
      </Badge>
    </div>
  );
}

function useInvalidateBilling(workspaceId: string) {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-workspace", workspaceId, "billing"] });
}

function WorkspaceSelect({
  workspaces,
  value,
  onChange,
}: {
  workspaces: AdminUserWorkspaceMembership[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (workspaces.length <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((w) => (
            <SelectItem key={w.workspaceId} value={w.workspaceId}>
              {w.workspaceName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BillingTab() {
  const { userId } = Route.useParams();

  const workspacesQuery = useQuery({
    queryKey: ["admin-user", userId, "workspaces"],
    queryFn: () => getAdminUserWorkspaces(userId),
  });

  if (workspacesQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-soft">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (workspacesQuery.isError) {
    return (
      <ErrorNote error={workspacesQuery.error} onRetry={() => void workspacesQuery.refetch()} />
    );
  }

  const workspaces = workspacesQuery.data?.items ?? [];

  if (workspaces.length === 0) {
    return (
      <EmptyState icon={Building2} title="No workspace memberships">
        This user doesn't belong to any workspace, so there's no billing to show.
      </EmptyState>
    );
  }

  return <BillingTabContent key={userId} workspaces={workspaces} />;
}

function BillingTabContent({ workspaces }: { workspaces: AdminUserWorkspaceMembership[] }) {
  const [selectedWs, setSelectedWs] = useState<string | undefined>(undefined);
  const activeWsId = selectedWs ?? workspaces[0].workspaceId;

  return (
    <div className="space-y-4">
      <WorkspaceSelect workspaces={workspaces} value={activeWsId} onChange={setSelectedWs} />
      <BillingPanel key={activeWsId} workspaceId={activeWsId} />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Subscription card — plan/status/period + Comp / Cancel-at-period-end / Sync / provider link-out.
 * ---------------------------------------------------------------------- */

/**
 * External link-out to the provider dashboard for actual money movement — spec-mandated (task-21-
 * brief.md item 3): this console never talks to the gateway directly for refunds or manual charges,
 * it only reads/comps/cancels/syncs the local mirror.
 *
 * ⚠️ **Deliberately the subscriptions LIST, not a deep link to the subscription.** Razorpay's
 * dashboard deep-link format is not documented anywhere this codebase can verify, and an invented
 * URL that 404s is worse than one extra search — the operator following this link is usually
 * mid-refund. The provider subscription id is rendered beside the button to paste into the
 * dashboard's own search. Replace this with a deep link once the format is confirmed.
 */
const RAZORPAY_SUBSCRIPTIONS_URL = "https://dashboard.razorpay.com/app/subscriptions";

function CompPlanDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [plan, setPlan] = useState<AdminBillingPlan>("PRO");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateBilling(workspaceId);

  const reset = () => {
    setPlan("PRO");
    setUntil("");
    setReason("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      compWorkspacePlan(workspaceId, {
        plan,
        until: new Date(until).toISOString(),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success(`Comp'd to ${plan}.`);
      onOpenChange(false);
      reset();
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to comp this plan."),
  });

  const reasonTrimmed = reason.trim();
  const valid = Boolean(until) && reasonTrimmed.length >= 1 && reasonTrimmed.length <= 1000;

  // See `admin.users.$userId.ai-api.tsx`'s `GrantTokensDialog` `handleClose` doc comment — a
  // plain Cancel `<Button onClick>` doesn't go through Radix's `onOpenChange`, so it must call
  // this directly rather than the raw `onOpenChange` prop, or the typed plan/until/reason would
  // survive a Cancel and repopulate the next time this (always-mounted) dialog opens.
  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) {
          onOpenChange(next);
        } else {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comp a plan</DialogTitle>
          <DialogDescription>
            Grants this plan directly, bypassing checkout — a local-only override, not a real
            Razorpay subscription.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as AdminBillingPlan)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_PLANS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-until">Until</Label>
            <Input
              id="comp-until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-reason">Reason</Label>
            <Textarea
              id="comp-reason"
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this plan being comp'd?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Comp plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelAtPeriodEndToggle({ workspaceId, value }: { workspaceId: string; value: boolean }) {
  const [confirmValue, setConfirmValue] = useState<boolean | null>(null);
  const invalidate = useInvalidateBilling(workspaceId);

  const mutation = useMutation({
    mutationFn: (next: boolean) => setWorkspaceCancelAtPeriodEnd(workspaceId, next),
    onSuccess: (res) => {
      toast.success(
        res.cancelAtPeriodEnd ? "Will cancel at period end." : "Cancellation cleared — will renew.",
        {
          description: res.viaProvider
            ? "Applied at the payment provider."
            : "Applied locally (no live provider subscription attached).",
        },
      );
      setConfirmValue(null);
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "SUBSCRIPTION_NOT_FOUND") {
        toast.error("No subscription record exists for this workspace yet.");
        setConfirmValue(null);
        return;
      }
      errorToast(err, "Failed to update cancellation.");
      setConfirmValue(null);
    },
  });

  return (
    <>
      <ToggleRow
        label="Cancel at period end"
        description="When on, this subscription will not renew after the current billing period."
      >
        <Switch
          checked={value}
          onCheckedChange={(v) => setConfirmValue(v)}
          disabled={mutation.isPending}
        />
      </ToggleRow>
      <AlertDialog
        open={confirmValue !== null}
        onOpenChange={(next) => !mutation.isPending && !next && setConfirmValue(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmValue ? "Cancel at period end?" : "Clear cancellation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmValue
                ? "This workspace's subscription will not renew after the current billing period ends. Access continues until then."
                : "This workspace's subscription will renew normally at the end of the current billing period."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmValue !== null) mutation.mutate(confirmValue);
              }}
            >
              {mutation.isPending ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SubscriptionCard({
  workspaceId,
  subscription,
}: {
  workspaceId: string;
  subscription: AdminWorkspaceSubscriptionDetail | null;
}) {
  const [compOpen, setCompOpen] = useState(false);
  const invalidate = useInvalidateBilling(workspaceId);

  const syncMutation = useMutation({
    mutationFn: () => syncWorkspaceSubscriptionAdmin(workspaceId),
    onSuccess: () => {
      toast.success("Subscription synced from the provider.");
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "BILLING_SYNC_FAILED") {
        toast.error(
          err.message || "Sync failed — no provider subscription found for this workspace.",
        );
        return;
      }
      errorToast(err, "Failed to sync subscription.");
    },
  });

  /**
   * The provider's own subscription id, for pasting into the Razorpay dashboard.
   *
   * `subscription.subscription` is the raw `WorkspaceSubscription` row the endpoint serialises, and
   * the client types it as `Record<string, unknown>` — so this is narrowed rather than asserted. A
   * `manual_`-prefixed id (a comped plan) is a local placeholder with nothing behind it at the
   * provider, so it is deliberately not offered as something to look up.
   */
  const rawProviderId = subscription?.subscription?.providerSubscriptionId;
  const providerSubscriptionId =
    typeof rawProviderId === "string" && !rawProviderId.startsWith("manual_")
      ? rawProviderId
      : null;
  const hasSubscriptionRow = subscription?.subscription != null;

  return (
    <FormSection
      title="Subscription"
      description="Per-workspace plan, status, and billing period."
      actions={
        <>
          {providerSubscriptionId && (
            <>
              <code
                className="rounded bg-muted px-1.5 py-1 font-mono text-[11px] text-muted-foreground"
                title="Paste into the Razorpay dashboard search"
              >
                {providerSubscriptionId}
              </code>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={RAZORPAY_SUBSCRIPTIONS_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Open Razorpay
                </a>
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
            Sync
          </Button>
          <Button size="sm" onClick={() => setCompOpen(true)}>
            Comp plan
          </Button>
        </>
      }
    >
      {!subscription ? (
        <EmptyState icon={CreditCard} title="No billing record">
          This workspace has never had a subscription row created.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBlock label="Plan" value={subscription.displayName || subscription.plan} />
          <StatBlockBadge
            label="Status"
            value={subscription.status}
            styles={WORKSPACE_STATUS_STYLES}
          />
          <StatBlockBadge
            label="Billing status"
            value={subscription.billingStatus}
            styles={BILLING_STATUS_STYLES}
          />
          <StatBlock
            label="Period ends"
            value={subscription.billingCycleEnd ? formatDate(subscription.billingCycleEnd) : "—"}
          />
        </div>
      )}

      {hasSubscriptionRow && subscription && (
        <div className="mt-4">
          <CancelAtPeriodEndToggle
            workspaceId={workspaceId}
            value={subscription.cancelAtPeriodEnd}
          />
        </div>
      )}

      <CompPlanDialog workspaceId={workspaceId} open={compOpen} onOpenChange={setCompOpen} />
    </FormSection>
  );
}

/* -------------------------------------------------------------------------
 * Invoices table — paginated (limit/offset).
 * ---------------------------------------------------------------------- */

const INVOICE_PAGE_SIZE = 10;

/**
 * One invoice, with the three things support actually needs: read it, save it, send it again.
 *
 * 🔴 The previous control here was `<a href={invoice.hostedInvoiceUrl}>`, which could not work.
 * `hostedInvoiceUrl` is the TENANT route (`/billing/invoices/:id/view`) — it needs a workspace
 * context the admin does not have, and a bare `<a>` navigation attaches no `Authorization` header
 * either. Both documents are fetched from the admin routes instead and handed over as blobs.
 *
 * `hasDocument` / `hasPdf` arrive on the list payload as existence checks on the stored columns —
 * the same columns the endpoints 404 on — so a control is only enabled when it will actually work.
 * Invoices issued before the PDF renderer was fixed have HTML and no PDF; those show a disabled
 * button with a reason rather than no button at all, so the absence is explained.
 */
function InvoiceRow({
  invoice,
  workspaceId,
  canManage,
  onResend,
  onReissue,
}: {
  invoice: BillingInvoiceRow;
  workspaceId: string;
  canManage: boolean;
  onResend: (invoice: BillingInvoiceRow) => void;
  onReissue: (invoice: BillingInvoiceRow) => void;
}) {
  /**
   * A captured charge with no invoice number is an amount-only fallback row: issuance failed when
   * it was paid, so the customer has nothing to download. The only row shape the reissue route
   * accepts, so the only one offered the control.
   */
  const needsIssuing = !invoice.invoiceNumber && invoice.status?.toLowerCase() === "captured";
  const [busy, setBusy] = useState<"view" | "pdf" | null>(null);

  const openDocument = async () => {
    setBusy("view");
    try {
      const blob = await fetchInvoiceViewAdmin(workspaceId, invoice.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Revoked on a delay, not immediately: the new tab still has to read from it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open invoice");
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const blob = await fetchInvoicePdfAdmin(workspaceId, invoice.id);
      saveBlob(blob, invoiceFileName(invoice, "pdf"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download invoice");
    } finally {
      setBusy(null);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{invoice.invoiceNumber ?? "—"}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] capitalize",
            INVOICE_STATUS_STYLES[invoice.status?.toLowerCase()] ?? "",
          )}
        >
          {invoice.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {formatMoneyCents(invoice.amountCents, invoice.currency.toUpperCase())}
      </TableCell>
      <TableCell className="text-sm">{invoice.plan ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {invoice.periodStart ? formatDate(invoice.periodStart) : "—"}
        {invoice.periodEnd ? ` – ${formatDate(invoice.periodEnd)}` : ""}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {invoice.paidAt ? formatDate(invoice.paidAt) : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!invoice.hasDocument || busy !== null}
            onClick={() => void openDocument()}
            title={invoice.hasDocument ? "View the issued invoice" : "No document was issued"}
          >
            {busy === "view" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!invoice.hasPdf || busy !== null}
            onClick={() => void downloadPdf()}
            title={invoice.hasPdf ? "Download the PDF" : "No PDF is available for this invoice"}
          >
            {busy === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
          {needsIssuing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canManage}
              onClick={() => onReissue(invoice)}
              title={
                canManage
                  ? "No invoice was issued for this payment. Issue it now"
                  : "You cannot issue invoices"
              }
            >
              <FileCheck className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canManage}
            onClick={() => onResend(invoice)}
            title={canManage ? "Resend this invoice by email" : "You cannot resend invoices"}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Resend dialog.
 *
 * A reason is required every time, and the recipient defaults to the address on the invoice. The
 * override exists because support genuinely needs "send it to our accounts team instead" — but an
 * invoice carries the customer legal name, registered address and GSTIN, so redirecting one
 * discloses all of that to a third party. The copy says so, and the server records both addresses
 * on the audit row.
 */
function ResendInvoiceDialog({
  invoice,
  workspaceId,
  onClose,
}: {
  invoice: BillingInvoiceRow | null;
  workspaceId: string;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  const resend = useMutation({
    mutationFn: () =>
      resendInvoiceAdmin(workspaceId, invoice!.id, {
        ...(to.trim() ? { to: to.trim() } : {}),
        reason: reason.trim(),
      }),
    onSuccess: (result) => {
      // Names where it actually went, rather than a generic "sent".
      toast.success(`Invoice queued for ${result.sentTo}`);
      setTo("");
      setReason("");
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not resend this invoice");
    },
  });

  return (
    <Dialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resend invoice</DialogTitle>
          <DialogDescription>
            {invoice?.invoiceNumber
              ? `${invoice.invoiceNumber} will be emailed again.`
              : "This invoice will be emailed again."}{" "}
            The document is not regenerated, so the customer receives exactly what was issued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="resend-to">Send to</Label>
            <Input
              id="resend-to"
              type="email"
              placeholder="Leave blank to use the address on the invoice"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Fill this in only to send somewhere other than the billing address on record. An
              invoice shows the customer legal name, address and GSTIN, so any override is recorded
              in the audit log.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resend-reason">Reason</Label>
            <Textarea
              id="resend-reason"
              rows={2}
              placeholder="Why is this being resent?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={reason.trim().length === 0 || resend.isPending}
            onClick={() => resend.mutate()}
          >
            {resend.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Resend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Issue the missing tax invoice for a payment that only has an amount-only row.
 *
 * The server gives the row a number, dated at the original payment, and renders its PDF. It does
 * NOT email the customer: support looks at the document first and sends it with Resend. The copy
 * says both, so nobody expects the customer to have received anything yet.
 */
function ReissueInvoiceDialog({
  invoice,
  workspaceId,
  onClose,
}: {
  invoice: BillingInvoiceRow | null;
  workspaceId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const reissue = useMutation({
    mutationFn: () => reissueInvoiceAdmin(workspaceId, invoice!.id, { reason: reason.trim() }),
    onSuccess: (result) => {
      toast.success(`Issued ${result.invoiceNumber}. Check it, then use Resend to email it.`);
      setReason("");
      void queryClient.invalidateQueries({
        queryKey: ["admin-workspace", workspaceId, "billing", "invoices"],
      });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not issue this invoice");
    },
  });

  return (
    <Dialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue invoice</DialogTitle>
          <DialogDescription>
            This payment
            {invoice
              ? ` of ${formatMoneyCents(invoice.amountCents, invoice.currency.toUpperCase())}`
              : ""}
            {invoice?.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""} has no invoice number, so
            the customer has nothing to download. Issuing it assigns the next number, dates it at
            the payment and prepares the PDF. The customer is not emailed. Use Resend once you have
            checked it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reissue-reason">Reason</Label>
          <Textarea
            id="reissue-reason"
            rows={2}
            placeholder="Why is this invoice being issued now?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={reason.trim().length === 0 || reissue.isPending}
            onClick={() => reissue.mutate()}
          >
            {reissue.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Issue invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoicesTable({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState(1);
  /** The invoice whose resend dialog is open, or null. */
  const [resendTarget, setResendTarget] = useState<BillingInvoiceRow | null>(null);
  /** The fallback row whose issue dialog is open, or null. */
  const [reissueTarget, setReissueTarget] = useState<BillingInvoiceRow | null>(null);
  const canManage = usePlatformCan(BILLING_MANAGE);
  const invoicesQuery = useQuery({
    queryKey: ["admin-workspace", workspaceId, "billing", "invoices", page],
    queryFn: () =>
      listWorkspaceInvoicesAdmin(workspaceId, {
        limit: INVOICE_PAGE_SIZE,
        offset: (page - 1) * INVOICE_PAGE_SIZE,
      }),
  });

  const invoices = invoicesQuery.data?.invoices ?? [];
  const total = invoicesQuery.data?.total ?? 0;

  return (
    <FormSection title="Invoices">
      {invoicesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : invoicesQuery.isError ? (
        <ErrorNote error={invoicesQuery.error} onRetry={() => void invoicesQuery.refetch()} />
      ) : invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices">
          Nothing has been billed for this workspace yet.
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    workspaceId={workspaceId}
                    canManage={canManage}
                    onResend={setResendTarget}
                    onReissue={setReissueTarget}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3">
            <PaginationBar
              page={page}
              pages={Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE))}
              total={total}
              limit={INVOICE_PAGE_SIZE}
              onPageChange={setPage}
              label="invoices"
            />
          </div>
        </>
      )}

      <ResendInvoiceDialog
        invoice={resendTarget}
        workspaceId={workspaceId}
        onClose={() => setResendTarget(null)}
      />
      <ReissueInvoiceDialog
        invoice={reissueTarget}
        workspaceId={workspaceId}
        onClose={() => setReissueTarget(null)}
      />
    </FormSection>
  );
}

function BillingPanel({ workspaceId }: { workspaceId: string }) {
  const canManage = usePlatformCan(BILLING_MANAGE);
  const subQuery = useQuery({
    queryKey: ["admin-workspace", workspaceId, "billing", "subscription"],
    queryFn: () => getWorkspaceSubscriptionAdmin(workspaceId),
    enabled: canManage,
  });

  if (!canManage) {
    return <RestrictedPanel title="Billing" permission={BILLING_MANAGE} />;
  }

  if (subQuery.isLoading) {
    return <Skeleton className="h-56 w-full rounded-2xl" />;
  }

  if (subQuery.isError) {
    return <ErrorNote error={subQuery.error} onRetry={() => void subQuery.refetch()} />;
  }

  const subscription = subQuery.data?.subscription ?? null;

  return (
    <div className="space-y-4">
      <SubscriptionCard workspaceId={workspaceId} subscription={subscription} />
      <InvoicesTable workspaceId={workspaceId} />
    </div>
  );
}
