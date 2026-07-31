import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CreditCard, Plus, RefreshCw, XCircle } from "lucide-react";
import { toast } from "@/lib/toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FormSection } from "@/components/admin/form-page";
import {
  getPublishStatus,
  publishPackage,
  type BillingProvider,
  type PublishStatus,
  type PublishStatusAction,
  type ProviderSyncStatus,
} from "@/lib/api/registry-api";

/**
 * Publishing a package's prices to Stripe and Razorpay.
 *
 * Deliberately its own action, never fired on save (decision B4): editing a description must not be
 * able to create a Stripe object. It also cannot pretend a price was *changed* — the providers only
 * ever create-new + archive-old, so a reprice leaves existing subscribers exactly where they are.
 * This surface names how many that is before anyone confirms (B1), and never offers to move them in
 * the same click (B3.3).
 */

const PROVIDER_LABEL: Record<BillingProvider, string> = {
  STRIPE: "Stripe",
  RAZORPAY: "Razorpay",
};

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", INR: "₹" };

function money(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${symbol}${(amount / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const intervalLabel = (interval: string): string =>
  interval.charAt(0) + interval.slice(1).toLowerCase();

const isReprice = (a: PublishStatusAction): boolean =>
  a.kind === "create" && a.replacesPriceId != null;
const isRetiring = (a: PublishStatusAction): boolean => a.kind === "archive" || isReprice(a);
const isPending = (a: PublishStatusAction): boolean => a.kind !== "unchanged";

/** Subscribers who stay on a retiring price, summed across a provider's actions. */
const grandfatheredCount = (actions: PublishStatusAction[]): number =>
  actions.reduce((sum, a) => sum + (isRetiring(a) ? (a.grandfatheredSubscribers ?? 0) : 0), 0);

export function PackagePublish({
  packageId,
  packageKey,
}: {
  packageId: string;
  packageKey: string;
}) {
  const queryClient = useQueryClient();
  const [confirmProvider, setConfirmProvider] = useState<BillingProvider | null>(null);

  const statusQuery = useQuery({
    queryKey: ["package-publish-status", packageId],
    queryFn: () => getPublishStatus(packageId),
  });

  const publish = useMutation({
    mutationFn: (provider: BillingProvider) => publishPackage(packageId, [provider]),
    onSuccess: (res, provider) => {
      const parts = [
        res.created && `${res.created} created`,
        res.repriced && `${res.repriced} repriced`,
        res.archived && `${res.archived} archived`,
      ].filter(Boolean);
      toast.success(
        parts.length
          ? `Published to ${PROVIDER_LABEL[provider]}: ${parts.join(", ")}.`
          : `${PROVIDER_LABEL[provider]} already in sync.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["package-publish-status", packageId] });
      setConfirmProvider(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (statusQuery.isLoading) {
    return (
      <FormSection title="Payment providers">
        <Skeleton className="h-40 rounded-xl" />
      </FormSection>
    );
  }

  const status = statusQuery.data;
  if (!status) {
    return (
      <FormSection title="Payment providers">
        <p className="text-sm text-muted-foreground">Couldn't load provider status.</p>
      </FormSection>
    );
  }

  return (
    <FormSection
      title="Payment providers"
      description="Publish this package's prices to Stripe and Razorpay. Saving never touches a provider — this is the deliberate step."
    >
      <div className="space-y-3">
        {status.providers.map((provider) => (
          <ProviderCard
            key={provider.provider}
            provider={provider}
            actions={status.actions.filter((a) => a.provider === provider.provider)}
            onPublish={() => setConfirmProvider(provider.provider)}
          />
        ))}
      </div>

      {confirmProvider && (
        <PublishConfirmDialog
          open
          onOpenChange={(v) => !v && setConfirmProvider(null)}
          provider={confirmProvider}
          packageKey={packageKey}
          actions={status.actions.filter((a) => a.provider === confirmProvider && isPending(a))}
          pending={publish.isPending}
          onConfirm={() => publish.mutate(confirmProvider)}
        />
      )}
    </FormSection>
  );
}

function ProviderCard({
  provider,
  actions,
  onPublish,
}: {
  provider: ProviderSyncStatus;
  actions: PublishStatusAction[];
  onPublish: () => void;
}) {
  const pending = actions.filter(isPending);
  const inSync = pending.length === 0;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{PROVIDER_LABEL[provider.provider]}</span>
          {provider.configured ? (
            <Badge variant={provider.mode === "live" ? "default" : "secondary"}>
              {provider.mode}
            </Badge>
          ) : (
            <Badge variant="outline">not configured</Badge>
          )}
        </div>
        {provider.configured && !provider.modeMismatch && (
          <Button
            type="button"
            size="sm"
            variant={inSync ? "outline" : "default"}
            disabled={inSync}
            onClick={onPublish}
          >
            {inSync ? "In sync" : `Publish to ${PROVIDER_LABEL[provider.provider]}`}
          </Button>
        )}
      </div>

      {!provider.configured && (
        <p className="mt-2 text-xs text-muted-foreground">
          No key on this environment, so nothing publishes here. A package live on one provider and
          not the other is expected, not an error.
        </p>
      )}

      {provider.modeMismatch && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Published in <strong>{provider.storedMode}</strong> mode, but the current key is{" "}
            <strong>{provider.mode}</strong>. Publishing is blocked — switch keys or re-publish
            deliberately from the other environment.
          </span>
        </p>
      )}

      {provider.configured && !provider.modeMismatch && (
        <ul className="mt-3 space-y-1.5">
          {inSync ? (
            <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Every price is in sync with {PROVIDER_LABEL[provider.provider]}.
            </li>
          ) : (
            pending.map((action, i) => <ActionRow key={i} action={action} />)
          )}
        </ul>
      )}
    </div>
  );
}

function ActionRow({ action }: { action: PublishStatusAction }) {
  const label = intervalLabel(action.interval);
  const stranded = action.grandfatheredSubscribers ?? 0;

  if (isReprice(action)) {
    return (
      <li className="flex items-start gap-1.5 text-xs">
        <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span>
          <strong>{label}</strong>{" "}
          {action.previousAmount != null && (
            <span className="text-muted-foreground line-through">
              {money(action.previousAmount, action.currency)}
            </span>
          )}{" "}
          → {money(action.amount, action.currency)}
          {stranded > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {stranded} subscriber{stranded === 1 ? "" : "s"} stay on the old price
            </span>
          )}
        </span>
      </li>
    );
  }

  if (action.kind === "archive") {
    return (
      <li className="flex items-start gap-1.5 text-xs">
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <span>
          Remove <strong>{label}</strong> {money(action.amount, action.currency)}
          {stranded > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {stranded} subscriber{stranded === 1 ? "" : "s"} stay on it
            </span>
          )}
        </span>
      </li>
    );
  }

  // first-time create
  return (
    <li className="flex items-start gap-1.5 text-xs">
      <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
      <span>
        New <strong>{label}</strong> {money(action.amount, action.currency)}
      </span>
    </li>
  );
}

/**
 * Confirmation before a publish. When nothing is retired it is a plain confirm; when a price is
 * repriced or removed it names the grandfathered subscribers and requires the package key typed, so
 * a money-affecting change can't be a stray click.
 */
function PublishConfirmDialog({
  open,
  onOpenChange,
  provider,
  packageKey,
  actions,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider: BillingProvider;
  packageKey: string;
  actions: PublishStatusAction[];
  pending: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const stranded = useMemo(() => grandfatheredCount(actions), [actions]);
  const requiresTyped = actions.some(isRetiring);
  const confirmed = !requiresTyped || typed.trim() === packageKey;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish to {PROVIDER_LABEL[provider]}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
                {actions.map((action, i) => (
                  <ActionRow key={i} action={action} />
                ))}
              </ul>

              {requiresTyped && (
                <p>
                  {stranded > 0 ? (
                    <>
                      {stranded} active subscription{stranded === 1 ? "" : "s"} stay on the current
                      price. Publishing does <strong>not</strong> move them — repricing an existing
                      customer is a separate, deliberate action.
                    </>
                  ) : (
                    "This retires a published price. Existing subscriptions, if any, keep the price they were sold."
                  )}
                </p>
              )}

              {requiresTyped && (
                <p>
                  Type <code className="font-mono font-semibold">{packageKey}</code> to confirm.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requiresTyped && (
          <Input
            className="font-mono"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={packageKey}
            aria-label="Type the package key to confirm"
          />
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!confirmed || pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "Publishing…" : `Publish to ${PROVIDER_LABEL[provider]}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
