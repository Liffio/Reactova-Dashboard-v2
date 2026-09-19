import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Pencil, Plus, Ticket, Trash2, Users } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  activateDiscountCode,
  createDiscountCode,
  deactivateDiscountCode,
  deleteDiscountCode,
  listDiscountCodes,
  type AdminDiscountCode,
  type CreateDiscountCodeInput,
  type DiscountCodeKind,
} from "@/lib/api/discount-codes-api";
import { DiscountCodeEditor } from "@/components/admin/discount-code-editor";
import { DiscountCodeRedemptions } from "@/components/admin/discount-code-redemptions";
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

/**
 * Same permission as package management. Creating a code is a billing action with a direct revenue
 * effect, and anyone who can reprice a package can already do strictly more.
 */
const PACKAGE_MANAGE = "platform:package_manage";

export const Route = createFileRoute("/_app/discount-codes")({
  head: () => ({ meta: [{ title: "Discount codes — Admin" }] }),
  component: DiscountCodesRoute,
});

function DiscountCodesRoute() {
  return (
    <PlatformPermissionRoute permission={PACKAGE_MANAGE}>
      <DiscountCodesPage />
    </PlatformPermissionRoute>
  );
}

const money = (minor: number | null, currency: string | null) =>
  minor == null ? "—" : `${currency === "USD" ? "$" : "₹"}${(minor / 100).toFixed(2)}`;

function describe(code: AdminDiscountCode): string {
  if (code.kind === "PERCENT") {
    const cap = code.maxDiscountMinor
      ? `, up to ${money(code.maxDiscountMinor, code.currency ?? "INR")}`
      : "";
    return `${(code.percentBps ?? 0) / 100}% off${cap}`;
  }
  return `${money(code.amountMinor, code.currency)} off`;
}

/**
 * The badge for a code's live state. (R7)
 *
 * The status itself is computed by the server, so two screens cannot disagree about one code. This
 * only decides how it looks. A falsy status means an older server that does not send one, in which
 * case `isActive` is the best available answer.
 */
function StatusBadge({ code }: { code: AdminDiscountCode }) {
  const status = code.status ?? (code.isActive ? "live" : "paused");
  const tone: Record<string, string> = {
    live: "border-success/30 bg-success/10 text-success",
    paused: "border-warning/30 bg-warning/10 text-warning",
    scheduled: "border-border bg-muted text-muted-foreground",
    expired: "border-border bg-muted text-muted-foreground",
    exhausted: "border-border bg-muted text-muted-foreground",
    deleted: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  const label: Record<string, string> = {
    live: "Live",
    paused: "Paused",
    scheduled: "Scheduled",
    expired: "Expired",
    exhausted: "All used",
    deleted: "Deleted",
  };
  return (
    <Badge variant="outline" className={tone[status] ?? ""}>
      {label[status] ?? status}
    </Badge>
  );
}

function DiscountCodesPage() {
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<{
    code: string;
    kind: DiscountCodeKind;
    value: string;
    currency: "INR" | "USD";
    maxRedemptions: string;
    perUserLimit: string;
    validUntil: string;
    note: string;
  }>({
    code: "",
    kind: "PERCENT",
    value: "",
    currency: "INR",
    maxRedemptions: "",
    perUserLimit: "",
    validUntil: "",
    note: "",
  });

  const [editing, setEditing] = useState<AdminDiscountCode | null>(null);
  const [viewingRedemptions, setViewingRedemptions] = useState<AdminDiscountCode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminDiscountCode | null>(null);

  const codesQuery = useQuery({
    queryKey: ["admin-discount-codes", showInactive],
    queryFn: () => listDiscountCodes(showInactive),
  });

  const create = useMutation({
    mutationFn: (body: CreateDiscountCodeInput) => createDiscountCode(body),
    onSuccess: () => {
      toast.success("Code created");
      setForm((f) => ({
        ...f,
        code: "",
        value: "",
        maxRedemptions: "",
        perUserLimit: "",
        validUntil: "",
        note: "",
      }));
      void queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not create that code"),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateDiscountCode(id),
    onSuccess: () => {
      toast.success("Code deactivated");
      void queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not deactivate that code"),
  });

  const activate = useMutation({
    mutationFn: (id: string) => activateDiscountCode(id),
    onSuccess: () => {
      toast.success("Code resumed");
      void queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not resume that code"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDiscountCode(id),
    onSuccess: () => {
      toast.success("Code deleted");
      setConfirmDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not delete that code"),
  });

  const submit = () => {
    const numeric = Number(form.value);
    if (!form.code.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Enter a code and a positive value");
      return;
    }
    create.mutate({
      code: form.code.trim(),
      kind: form.kind,
      // Percent is entered as a human percentage and sent as basis points; a fixed amount is
      // entered in rupees or dollars and sent in minor units. Neither conversion belongs in the
      // input itself, where a half-typed number would round on every keystroke.
      ...(form.kind === "PERCENT"
        ? { percentBps: Math.round(numeric * 100) }
        : { amountMinor: Math.round(numeric * 100), currency: form.currency }),
      ...(form.maxRedemptions ? { maxRedemptions: Number(form.maxRedemptions) } : {}),
      // Omitted means unlimited, which is what the server stores as NULL.
      ...(form.perUserLimit ? { perUserLimit: Number(form.perUserLimit) } : {}),
      ...(form.validUntil ? { validUntil: new Date(form.validUntil).toISOString() } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    });
  };

  const codes = codesQuery.data?.codes ?? [];

  return (
    <div>
      <PageHeader
        title="Discount codes"
        description="Codes a customer can enter at checkout. They reduce the first payment only."
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? "Hide inactive" : "Show inactive"}
          </Button>
        }
      />

      {/*
        🔴 Stated on the page, not just in the code. An operator who believes they are creating
        "3 months half price" and gets one discounted payment will find out from a customer.
        Razorpay offers CAN run for several cycles, but only when built by hand in Razorpay's own
        dashboard — there is no API to create one, so nothing made here can reach cycle two.
      */}
      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <p className="font-medium">Codes apply to the first payment only</p>
        <p className="text-muted-foreground">
          Every following renewal is charged the full plan price. Discounts that last several
          billing cycles have to be created in the Razorpay dashboard, which has no API.
        </p>
      </div>

      <div className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" /> New code
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Code</label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="LAUNCH20"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Type</label>
            <div className="flex gap-2">
              {(["PERCENT", "FIXED"] as const).map((k) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={form.kind === k ? "default" : "outline"}
                  onClick={() => setForm({ ...form, kind: k })}
                >
                  {k === "PERCENT" ? "Percentage" : "Flat"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              {form.kind === "PERCENT" ? "Percent off" : "Amount off"}
            </label>
            <div className="flex gap-2">
              <Input
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.kind === "PERCENT" ? "20" : "200"}
                inputMode="decimal"
              />
              {form.kind === "FIXED" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({ ...form, currency: form.currency === "INR" ? "USD" : "INR" })
                  }
                >
                  {form.currency}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Max uses (optional)</label>
            <Input
              value={form.maxRedemptions}
              onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
              placeholder="Unlimited"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Uses per person (optional)</label>
            <Input
              value={form.perUserLimit}
              onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
              placeholder="Unlimited"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Expires (optional)</label>
            <Input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Note (optional)</label>
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Which campaign this is for"
            />
          </div>
        </div>
        <Separator className="my-4" />
        <Button onClick={submit} disabled={create.isPending} size="sm">
          {create.isPending ? "Creating…" : "Create code"}
        </Button>
      </div>

      {codesQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : codes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Ticket className="mx-auto mb-2 h-5 w-5" />
          No discount codes yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Per person</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Valid</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">
                    <span className="font-mono">{c.code}</span>
                    {c.note && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{describe(c)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                      onClick={() => setViewingRedemptions(c)}
                    >
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {c.redemptionCount}
                      {c.maxRedemptions ? ` of ${c.maxRedemptions}` : ""}
                    </button>
                  </td>
                  {/* Null is unlimited, and is spelled out rather than shown as a dash. */}
                  <td className="px-4 py-3">{c.perUserLimit == null ? "Unlimited" : c.perUserLimit}</td>
                  <td className="px-4 py-3">
                    <StatusBadge code={c} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.validFrom ? `From ${new Date(c.validFrom).toLocaleDateString()}` : "No start"}
                    <br />
                    {c.validUntil ? `Until ${new Date(c.validUntil).toLocaleDateString()}` : "No end"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.deletedAt ? null : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit ${c.code}`}
                            onClick={() => setEditing(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                          {c.isActive ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={deactivate.isPending}
                              onClick={() => deactivate.mutate(c.id)}
                            >
                              <Pause className="mr-1 h-3.5 w-3.5" aria-hidden />
                              Pause
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={activate.isPending}
                              onClick={() => activate.mutate(c.id)}
                            >
                              <Play className="mr-1 h-3.5 w-3.5" aria-hidden />
                              Resume
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${c.code}`}
                            onClick={() => setConfirmDelete(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DiscountCodeEditor
        code={editing}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
      />

      <DiscountCodeRedemptions
        code={viewingRedemptions}
        open={viewingRedemptions !== null}
        onOpenChange={(next) => !next && setViewingRedemptions(null)}
      />

      {/*
        Deleting is soft and the dialog says so, because "delete" usually is not. The row stays as
        the referent for every redemption and for the invoices that cite it; what changes is that
        nobody can redeem it again.
      */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => !next && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops working immediately and nobody can redeem it again. The{" "}
              {confirmDelete?.redemptionCount ?? 0} redemption
              {confirmDelete?.redemptionCount === 1 ? "" : "s"} it already has are kept, and so are
              the invoices that refer to it. Pause it instead if you might want it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
