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
  setWorkspaceCancelAtPeriodEnd,
  syncWorkspaceSubscriptionAdmin,
  type AdminBillingPlan,
  type AdminWorkspaceSubscriptionDetail,
} from "@/lib/api/admin-workspaces-api";
import type { BillingInvoiceRow } from "@/lib/api/billing-api";

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
 * Subscription card — plan/status/period + Comp / Cancel-at-period-end / Sync / Stripe link-out.
 * ---------------------------------------------------------------------- */

/** External link-out to the Stripe dashboard for actual money movement — spec-mandated (task-21-
 *  brief.md item 3): this console never talks to Stripe directly for refunds/manual charges, it
 *  only reads/comps/cancels/syncs the local mirror. */
function stripeDashboardUrl(billing: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}): string | null {
  if (billing.stripeCustomerId) {
    return `https://dashboard.stripe.com/customers/${encodeURIComponent(billing.stripeCustomerId)}`;
  }
  if (billing.stripeSubscriptionId) {
    return `https://dashboard.stripe.com/subscriptions/${encodeURIComponent(billing.stripeSubscriptionId)}`;
  }
  return null;
}

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
            Stripe/Razorpay subscription.
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
          description: res.viaStripe
            ? "Applied via Stripe."
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

  const stripeUrl = subscription ? stripeDashboardUrl(subscription.billing) : null;
  const hasSubscriptionRow = subscription?.subscription != null;

  return (
    <FormSection
      title="Subscription"
      description="Per-workspace plan, status, and billing period."
      actions={
        <>
          {stripeUrl && (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={stripeUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open in Stripe
              </a>
            </Button>
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

function InvoiceRow({ invoice }: { invoice: BillingInvoiceRow }) {
  const downloadUrl = invoice.hostedInvoiceUrl ?? invoice.pdfUrl;
  return (
    <TableRow>
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
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Open invoice"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </TableCell>
    </TableRow>
  );
}

function InvoicesTable({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState(1);
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
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
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
