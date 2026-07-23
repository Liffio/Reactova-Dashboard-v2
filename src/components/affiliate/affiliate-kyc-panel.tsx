import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAffiliateKycSubmissionStatus,
  submitAffiliateKyc,
  type KycTier,
} from "@/lib/api/affiliate-api";

const TIER_LABEL: Record<KycTier, string> = {
  L1: "Tier 1 — Basic",
  L2: "Tier 2 — Mid",
  L3: "Tier 3 — Full",
};

const TIER_DOCS: Record<
  KycTier,
  Array<{ key: "pan" | "aadhaar" | "bankAccount"; label: string }>
> = {
  L1: [{ key: "pan", label: "PAN card" }],
  L2: [
    { key: "pan", label: "PAN card" },
    { key: "aadhaar", label: "Aadhaar card" },
  ],
  L3: [
    { key: "pan", label: "PAN card" },
    { key: "aadhaar", label: "Aadhaar card" },
    { key: "bankAccount", label: "Bank account proof" },
  ],
};

const statusStyles: Record<string, string> = {
  PENDING_REVIEW: "border-warning/30 bg-warning/10 text-warning",
  APPROVED: "border-success/30 bg-success/10 text-success",
  REJECTED: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function AffiliateKycPanel() {
  const queryClient = useQueryClient();
  const [tier, setTier] = useState<KycTier>("L1");
  const [panNumber, setPanNumber] = useState("");
  const [files, setFiles] = useState<Partial<Record<"pan" | "aadhaar" | "bankAccount", File>>>({});

  const statusQuery = useQuery({
    queryKey: ["affiliate-kyc-status"],
    queryFn: getAffiliateKycSubmissionStatus,
  });

  const mutation = useMutation({
    mutationFn: () =>
      submitAffiliateKyc({
        tier,
        panNumber: panNumber || undefined,
        pan: files.pan,
        aadhaar: files.aadhaar,
        bankAccount: files.bankAccount,
      }),
    onSuccess: () => {
      toast.success("KYC submitted for review");
      setFiles({});
      void queryClient.invalidateQueries({ queryKey: ["affiliate-kyc-status"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (statusQuery.isLoading) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  const latest = statusQuery.data?.latestSubmission;
  const requiredDocs = TIER_DOCS[tier];
  const canSubmit = requiredDocs.every((d) => files[d.key]) && !mutation.isPending;
  const isPending = latest?.status === "PENDING_REVIEW";

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4.5 w-4.5" />
            KYC verification
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Required before requesting larger payouts. Choose the tier that matches your target
            payout amount.
          </p>
        </div>
        {latest && (
          <Badge variant="outline" className={statusStyles[latest.status] ?? ""}>
            {latest.status === "PENDING_REVIEW" && <Clock className="mr-1 h-3 w-3" />}
            {latest.status === "APPROVED" && <CheckCircle2 className="mr-1 h-3 w-3" />}
            {latest.status === "REJECTED" && <XCircle className="mr-1 h-3 w-3" />}
            {latest.status.replace("_", " ").toLowerCase()}
          </Badge>
        )}
      </div>

      {!latest && (
        <p className="text-sm text-muted-foreground">You haven't submitted KYC documents yet.</p>
      )}

      {latest?.status === "REJECTED" && latest.rejectionReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Rejected: {latest.rejectionReason}
        </div>
      )}

      {latest?.status === "APPROVED" ? (
        <p className="text-sm text-success">Your {TIER_LABEL[latest.tier]} KYC is verified.</p>
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">
          Your {TIER_LABEL[latest!.tier]} submission is under review. We'll notify you once it's
          decided.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Verification tier</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TIER_LABEL) as KycTier[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    tier === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>PAN number</Label>
            <Input
              placeholder="ABCDE1234F"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 20))}
              maxLength={20}
            />
          </div>

          {requiredDocs.map((doc) => (
            <div key={doc.key} className="space-y-2">
              <Label>{doc.label}</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) =>
                  setFiles((f) => ({ ...f, [doc.key]: e.target.files?.[0] ?? undefined }))
                }
              />
            </div>
          ))}

          <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      )}
    </div>
  );
}
