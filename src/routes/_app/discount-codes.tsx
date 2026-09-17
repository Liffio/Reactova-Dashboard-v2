import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Ticket } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  createDiscountCode,
  deactivateDiscountCode,
  listDiscountCodes,
  type AdminDiscountCode,
  type CreateDiscountCodeInput,
  type DiscountCodeKind,
} from "@/lib/api/discount-codes-api";

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

function DiscountCodesPage() {
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<{
    code: string;
    kind: DiscountCodeKind;
    value: string;
    currency: "INR" | "USD";
    maxRedemptions: string;
    validUntil: string;
    note: string;
  }>({
    code: "",
    kind: "PERCENT",
    value: "",
    currency: "INR",
    maxRedemptions: "",
    validUntil: "",
    note: "",
  });

  const codesQuery = useQuery({
    queryKey: ["admin-discount-codes", showInactive],
    queryFn: () => listDiscountCodes(showInactive),
  });

  const create = useMutation({
    mutationFn: (body: CreateDiscountCodeInput) => createDiscountCode(body),
    onSuccess: () => {
      toast.success("Code created");
      setForm((f) => ({ ...f, code: "", value: "", maxRedemptions: "", validUntil: "", note: "" }));
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
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">
                    <span className="font-mono">{c.code}</span>
                    {!c.isActive && (
                      <Badge variant="outline" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                    {c.note && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{describe(c)}</td>
                  <td className="px-4 py-3">
                    {c.redemptionCount}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.isActive && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={deactivate.isPending}
                        onClick={() => deactivate.mutate(c.id)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
