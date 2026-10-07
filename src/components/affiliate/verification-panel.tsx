import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Check,
  Clock,
  Globe,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  submitAffiliateKyc,
  type KycStatusResponse,
  kycRegionLabel,
  type KycEntityType,
  type KycRegion,
  type KycTier,
  type PayoutAccount,
  type PayoutKycStatus,
} from "@/lib/api/affiliate-api";
import { fmtDate, KYC_DOCUMENT_HINT, SHEET_DIALOG } from "./affiliate-format";
import { DocumentsArt, VerificationArt } from "./illustrations";
import { KycDocumentsCard } from "./kyc-documents";

type Tone = "ok" | "warn" | "bad" | "neutral";
const TONE: Record<Tone, string> = {
  ok: "bg-success/10 text-success",
  warn: "bg-warning/15 text-warning",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export function VerificationPanel({
  kyc,
  submission,
  account,
  labels,
  onAddDetails,
  onUpload,
}: {
  kyc: PayoutKycStatus | undefined;
  submission: KycStatusResponse | undefined;
  account: PayoutAccount | null;
  labels: Record<string, string>;
  onAddDetails: () => void;
  onUpload: () => void;
}) {
  const status = kyc?.kycStatus ?? null;
  const intl = (kyc?.residency ?? account?.residency ?? submission?.region?.residency) === "INTL";
  const docs = kyc?.documentsNeeded ?? [];
  const latest = submission?.latestSubmission ?? null;

  let tone: Tone = "neutral";
  let icon: ReactNode = <Shield />;
  let title = "No verification needed yet";
  let desc =
    "You can withdraw without ID for now. When documents are needed, you'll see exactly which ones here.";
  let action: ReactNode = null;
  let docState: string | null = null;

  if (status === "verified") {
    tone = "ok";
    icon = <ShieldCheck />;
    title = "You're verified";
    desc = `Your documents were approved${latest?.reviewedAt ? ` on ${fmtDate(latest.reviewedAt)}` : ""}. Nothing else is needed to receive payouts.`;
    docState = "Approved";
  } else if (status === "pending_review") {
    tone = "warn";
    icon = <Clock />;
    title = "Verification in review";
    desc = `We received your documents${latest ? ` on ${fmtDate(latest.submittedAt)}` : ""}. We'll email you when the review is done. Payouts that need verification wait until then.`;
    docState = "Submitted";
  } else if (status === "rejected") {
    tone = "bad";
    icon = <AlertCircle />;
    title = "Verification needs changes";
    desc = "Your last submission wasn't approved. Upload corrected documents to unlock payouts.";
    action = <Button onClick={onUpload}>Upload documents again</Button>;
  } else if (kyc?.kycRequired && !account) {
    tone = "warn";
    icon = <ShieldAlert />;
    title = "Verify your identity to withdraw";
    desc =
      "The documents we need depend on where you live. Add your payout details first and we'll show you exactly what to upload.";
    action = <Button onClick={onAddDetails}>Add payout details</Button>;
  } else if (kyc?.kycRequired) {
    tone = "warn";
    icon = <ShieldAlert />;
    title = "Verify your identity to withdraw";
    desc = intl
      ? "As an affiliate outside India, we need these documents before we can pay you and apply the right tax rate."
      : "Your payouts this financial year have reached the limit where ID is required by law. Upload the documents below.";
    action = <Button onClick={onUpload}>Upload documents</Button>;
  }

  const showDocs = docs.length > 0 && !(kyc?.kycRequired && !account && !status);
  // Upload is always offered except while a review is open (the server allows one pending at a time).
  const canUpload = status !== "pending_review" && latest?.status !== "PENDING_REVIEW";
  if (!action && canUpload) {
    action = (
      <Button variant="outline" className="gap-1.5" onClick={onUpload}>
        <Upload className="h-4 w-4" />
        {status === "verified" ? "Upload new documents" : "Add verification documents"}
      </Button>
    );
  }

  return (
    <div className="grid gap-7 px-4 pb-6 pt-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <div className="flex items-start gap-3.5">
          <div
            className={`grid h-10 w-10 flex-none place-items-center rounded-[11px] [&_svg]:h-5 [&_svg]:w-5 ${TONE[tone]}`}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-1 max-w-[56ch] text-sm text-muted-foreground">{desc}</p>
          </div>
        </div>

        {showDocs && (
          <ul className="mt-5 overflow-hidden rounded-xl border">
            {docs.map((d) => (
              <li
                key={d}
                className="flex items-center gap-3 border-b border-border/60 px-3.5 py-3 last:border-b-0"
              >
                <span
                  className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full border-[1.5px] ${
                    docState ? "border-success bg-success text-white" : "border-border"
                  }`}
                >
                  {docState && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{labels[d] ?? d}</div>
                  <div className="text-xs text-muted-foreground">{KYC_DOCUMENT_HINT[d]}</div>
                </div>
                <span className="ml-auto text-[12.5px] text-muted-foreground">
                  {docState ?? "Needed"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {status === "rejected" && latest?.rejectionReason && (
          <div className="mt-4 rounded-lg bg-destructive/10 px-3.5 py-3 text-[13px]" role="alert">
            <b className="text-destructive">Reason: </b>
            {latest.rejectionReason}
          </div>
        )}
        {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}

        <KycDocumentsCard
          documents={submission?.documents ?? []}
          canUpload={canUpload}
          onUpload={onUpload}
        />
      </div>

      <aside className="border-border/60 text-[13px] text-muted-foreground lg:border-l lg:pl-6">
        <VerificationArt
          state={
            status === "verified"
              ? "verified"
              : status === "pending_review"
                ? "pending"
                : status === "rejected"
                  ? "rejected"
                  : "none"
          }
          className="mb-4 h-[104px] w-auto"
        />
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Why we ask</h4>
        <p className="mb-3">
          {intl
            ? "Your US tax form tells us how to treat your payouts for US tax purposes, and proof of residence confirms where you live."
            : "Indian tax rules require ID for affiliate payouts above set yearly amounts. The documents we ask for depend on how much you've been paid this financial year."}
        </p>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Who sees your documents</h4>
        <p>
          Only you and Liffio's verification team. Files are stored privately and never shown on
          your referral link.
        </p>
      </aside>
    </div>
  );
}

const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.pdf";

export function KycUploadDialog({
  open,
  onOpenChange,
  tier: givenTier,
  docs: defaultDocs,
  documentSets,
  intl: givenIntl,
  region,
  askRegion,
  labels,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Required tier when a payout needs KYC, otherwise the residency's base tier (early upload). */
  tier: KycTier | null;
  docs: string[];
  /** Server's per-tier sets for an individual vs a business; falls back to `docs`. */
  documentSets?: Record<KycTier, Record<KycEntityType, string[]>>;
  intl: boolean;
  /** Where the lists come from (payout account, else the user's country). */
  region?: KycRegion;
  /** True when neither is known: the dialog asks India vs outside India. */
  askRegion: boolean;
  labels: Record<string, string>;
  onSubmitted: () => void;
}) {
  const [entity, setEntity] = useState<KycEntityType>("individual");
  const [pickedRegion, setPickedRegion] = useState<"IN" | "INTL">("IN");
  const tier: KycTier | null = askRegion ? (pickedRegion === "INTL" ? "INTL" : "L1") : givenTier;
  const intl = askRegion ? pickedRegion === "INTL" : givenIntl;
  const regionLine = askRegion ? null : kycRegionLabel(region);
  const docs = (tier && documentSets?.[tier]?.[entity]) || defaultDocs;
  const companyPan = docs.includes("COMPANY_PAN");
  const needsPan = docs.includes("PAN") || companyPan;
  const needsGstin = docs.includes("GSTIN_CERT");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const ready =
    !!tier &&
    docs.length > 0 &&
    docs.every((d) => files[d]) &&
    (!needsPan || PAN.test(pan)) &&
    (!needsGstin || GSTIN.test(gstin)) &&
    consent;

  const chooseRegion = (next: "IN" | "INTL") => {
    if (next === pickedRegion) return;
    setPickedRegion(next);
    setFiles({});
    setError(null);
  };

  const chooseEntity = (next: KycEntityType) => {
    if (next === entity) return;
    // Different document list: files picked for the other one no longer apply.
    setEntity(next);
    setFiles({});
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      submitAffiliateKyc({
        tier: tier!,
        entityType: entity,
        panNumber: needsPan ? pan : undefined,
        gstin: needsGstin ? gstin : undefined,
        files,
      }),
    onSuccess: () => {
      toast.success("Documents submitted for review");
      setFiles({});
      setPan("");
      setGstin("");
      setConsent(false);
      onSubmitted();
      onOpenChange(false);
    },
    onError: (e) => setError((e as Error).message),
  });

  const pick = (doc: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`${labels[doc] ?? doc} is larger than 10 MB.`);
      return;
    }
    setError(null);
    setFiles((f) => ({ ...f, [doc]: file }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_DIALOG}>
        <DialogHeader>
          <DialogTitle>
            {entity === "business"
              ? "Verify your business"
              : intl
                ? "Verify your tax status and residence"
                : "Verify your identity"}
          </DialogTitle>
          <DialogDescription>JPG, PNG or PDF, up to 10 MB each.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-dashed bg-primary/[0.04] px-3 py-2.5">
          <DocumentsArt className="h-14 w-auto flex-none" />
          <p className="text-[12.5px] leading-snug text-muted-foreground">
            Clear photos or scans, all four corners visible. We review most documents within 2
            business days.
          </p>
        </div>

        {regionLine && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Globe className="h-3.5 w-3.5" aria-hidden />
            {regionLine}
          </p>
        )}

        {askRegion && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Where are you based?</p>
            <div
              role="radiogroup"
              aria-label="Where are you based"
              className="inline-flex rounded-lg border p-0.5"
            >
              {(
                [
                  ["IN", "India"],
                  ["INTL", "Outside India"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={pickedRegion === value}
                  onClick={() => chooseRegion(value)}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    pickedRegion === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div role="radiogroup" aria-label="Verify as" className="grid grid-cols-2 gap-2">
          {(
            [
              ["individual", "Individual", "Creator or freelancer", UserRound],
              ["business", "Business", "Agency or company", Building2],
            ] as const
          ).map(([value, title, sub, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={entity === value}
              onClick={() => chooseEntity(value)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                entity === value
                  ? "border-primary bg-primary/[0.06] ring-1 ring-primary"
                  : "hover:bg-muted/60"
              }`}
            >
              <span
                className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${
                  entity === value ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{sub}</span>
              </span>
            </button>
          ))}
        </div>

        {needsPan && (
          <div className="space-y-1.5">
            <Label htmlFor="kyc-pan">{companyPan ? "Company PAN number" : "PAN number"}</Label>
            <Input
              id="kyc-pan"
              autoFocus
              className="font-mono"
              placeholder="ABCDE1234F"
              maxLength={10}
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            {pan.length === 10 && !PAN.test(pan) && (
              <p className="text-xs text-destructive" role="alert">
                Enter a valid PAN, like ABCDE1234F
              </p>
            )}
          </div>
        )}

        {needsGstin && (
          <div className="space-y-1.5">
            <Label htmlFor="kyc-gstin">GSTIN</Label>
            <Input
              id="kyc-gstin"
              className="font-mono"
              placeholder="22ABCDE1234F1Z5"
              maxLength={15}
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
            {gstin.length === 15 && !GSTIN.test(gstin) && (
              <p className="text-xs text-destructive" role="alert">
                Enter a valid GSTIN, like 22ABCDE1234F1Z5
              </p>
            )}
          </div>
        )}

        <ul className="overflow-hidden rounded-xl border">
          {docs.map((d) => (
            <li
              key={d}
              className="flex items-center gap-3 border-b border-border/60 px-3.5 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {files[d] && <Check className="h-4 w-4 text-success" />}
                  {labels[d] ?? d}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {files[d]?.name ?? KYC_DOCUMENT_HINT[d]}
                </div>
              </div>
              <input
                ref={(el) => {
                  inputs.current[d] = el;
                }}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => pick(d, e.target.files?.[0])}
              />
              <Button size="sm" variant="outline" onClick={() => inputs.current[d]?.click()}>
                {files[d] ? "Replace" : "Choose file"}
              </Button>
            </li>
          ))}
        </ul>

        <KycDataNotice intl={intl} />

        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug">
          <Checkbox
            id="kyc-consent"
            className="mt-0.5"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
          />
          <span>
            I agree to Liffio processing these documents to verify my identity and meet tax law.
          </span>
        </label>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!ready || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Submitting…" : "Submit for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** DPDP notice: why, who, where, how long. Shown before consent; bump KYC_CONSENT_VERSION when it changes. */
function KycDataNotice({ intl }: { intl: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
      <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        How we use your documents
      </p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <b className="font-medium text-foreground">Why:</b>{" "}
          {intl
            ? "to confirm your tax status and where you live before we pay you."
            : "Indian tax law needs your PAN for affiliate payouts. The other documents confirm the account is yours."}
        </li>
        <li>
          <b className="font-medium text-foreground">Who sees them:</b> you and Liffio's
          verification team. Every view is logged.
        </li>
        <li>
          <b className="font-medium text-foreground">Where:</b> a private, encrypted store. They're
          never public.
        </li>
        <li>
          <b className="font-medium text-foreground">How long:</b> while you're an affiliate, then
          for as long as tax law requires (currently up to 8 years). After that they're deleted.
        </li>
      </ul>
    </div>
  );
}
