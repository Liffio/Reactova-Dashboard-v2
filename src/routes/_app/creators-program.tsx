import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Gift, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyToCreatorProgram,
  getCreatorProgramStatus,
  type CreatorFollowerRange,
  type CreatorNiche,
  type CreatorProgramStatus,
} from "@/lib/api/creator-program-api";

type MemberStatus = Extract<CreatorProgramStatus, { state: "member" }>;

export const Route = createFileRoute("/_app/creators-program")({
  head: () => ({ meta: [{ title: "Creator Program — Liffio" }] }),
  component: CreatorsProgramRoute,
});

function CreatorsProgramRoute() {
  return (
    <ProtectedRoute>
      <CreatorsProgramPage />
    </ProtectedRoute>
  );
}

const FOLLOWER_RANGES: Array<{ value: CreatorFollowerRange; label: string }> = [
  { value: "UNDER_5K", label: "Under 5K" },
  { value: "R5K_10K", label: "5K – 10K" },
  { value: "R10K_50K", label: "10K – 50K" },
  { value: "R50K_100K", label: "50K – 100K" },
  { value: "OVER_100K", label: "100K+" },
];

const NICHES: Array<{ value: CreatorNiche; label: string }> = [
  { value: "BUSINESS", label: "Business" },
  { value: "MARKETING", label: "Marketing" },
  { value: "FITNESS", label: "Fitness" },
  { value: "CREATOR", label: "Creator / Influencer" },
  { value: "ECOMMERCE", label: "E-commerce" },
  { value: "COACHING", label: "Coaching" },
  { value: "BEAUTY", label: "Beauty" },
  { value: "FOOD", label: "Food" },
  { value: "TRAVEL", label: "Travel" },
  { value: "OTHER", label: "Other" },
];

const ELIGIBILITY_CHECKLIST = [
  "5,000–100,000 Instagram followers",
  "Engagement rate above 3%",
  "Posts at least once per week",
  "Already drives comment engagement on posts",
  "Actively sells products, courses, or services",
];

function CreatorsProgramPage() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["creator-program-status"], queryFn: getCreatorProgramStatus });
  const status = statusQuery.data;

  if (statusQuery.isLoading) {
    return (
      <div className="p-10 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Grow with Liffio"
        title="Creator Program"
        description="An application-based program for creators who are ready to scale — unlimited automations, full analytics, and priority support."
      />
      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {!status || status.state === "none" ? (
          <ApplicationForm onSubmitted={() => void queryClient.invalidateQueries({ queryKey: ["creator-program-status"] })} />
        ) : status.state === "pending" ? (
          <PendingBanner submittedAt={status.submittedAt} />
        ) : status.state === "rejected" ? (
          <RejectedBanner reapplyAt={status.reapplyAt} />
        ) : status.state === "removed" ? (
          <RemovedBanner alumniCode={status.alumniDiscountCode} />
        ) : (
          <MemberView status={status} />
        )}
      </div>
    </div>
  );
}

function EligibilityChecklist() {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold mb-3">Who this is for</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        This is a guideline, not a hard gate — apply even if you're borderline. Our team reviews every
        application manually.
      </p>
      <ul className="space-y-2">
        {ELIGIBILITY_CHECKLIST.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");
  const [followerRange, setFollowerRange] = useState<CreatorFollowerRange | "">("");
  const [niche, setNiche] = useState<CreatorNiche | "">("");
  const [otherNiche, setOtherNiche] = useState("");
  const [asksForComments, setAsksForComments] = useState(false);
  const [whyJoin, setWhyJoin] = useState("");
  const [consented, setConsented] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      applyToCreatorProgram({
        name,
        email,
        country,
        instagramUsername,
        followerRange: followerRange as CreatorFollowerRange,
        niche: niche as CreatorNiche,
        otherNiche: niche === "OTHER" ? otherNiche : undefined,
        asksForComments,
        whyJoin: whyJoin || undefined,
      }),
    onSuccess: () => {
      toast.success("Application submitted — we'll review it within 48–72 hours");
      onSubmitted();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit =
    name.trim() &&
    email.trim() &&
    country.trim() &&
    instagramUsername.trim() &&
    followerRange &&
    niche &&
    (niche !== "OTHER" || otherNiche.trim()) &&
    consented &&
    !mutation.isPending;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-5">
        <h2 className="font-display text-lg font-semibold">Apply to the Creator Program</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Instagram username</Label>
            <Input
              value={instagramUsername}
              onChange={(e) => setInstagramUsername(e.target.value)}
              placeholder="@yourhandle"
              maxLength={100}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Follower range</Label>
            <Select value={followerRange} onValueChange={(v) => setFollowerRange(v as CreatorFollowerRange)}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {FOLLOWER_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Content niche</Label>
            <Select value={niche} onValueChange={(v) => setNiche(v as CreatorNiche)}>
              <SelectTrigger>
                <SelectValue placeholder="Select niche" />
              </SelectTrigger>
              <SelectContent>
                {NICHES.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {niche === "OTHER" && (
          <div className="space-y-2">
            <Label>Describe your niche</Label>
            <Input value={otherNiche} onChange={(e) => setOtherNiche(e.target.value)} maxLength={255} />
          </div>
        )}

        <div className="flex items-start gap-2">
          <Checkbox
            id="asks-for-comments"
            checked={asksForComments}
            onCheckedChange={(v) => setAsksForComments(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="asks-for-comments" className="font-normal">
            I already ask followers to comment on posts
          </Label>
        </div>

        <div className="space-y-2">
          <Label>Why do you want to join? (optional)</Label>
          <Textarea value={whyJoin} onChange={(e) => setWhyJoin(e.target.value.slice(0, 2000))} maxLength={2000} rows={4} />
        </div>

        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
          <Checkbox
            id="consent"
            checked={consented}
            onCheckedChange={(v) => setConsented(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="consent" className="font-normal text-xs leading-relaxed">
            I accept the Terms of Service, Privacy Policy, and the Creator Program Policy.
          </Label>
        </div>

        <Button
          className="w-full bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Submitting…" : "Submit application"}
        </Button>
      </div>

      <EligibilityChecklist />
    </div>
  );
}

function PendingBanner({ submittedAt }: { submittedAt: string }) {
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6">
      <div className="flex items-center gap-2 text-warning">
        <Clock className="h-5 w-5" />
        <h2 className="font-display text-lg font-semibold">Application pending</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Submitted on {new Date(submittedAt).toLocaleDateString()}. Reviews typically take 48–72 hours.
      </p>
    </div>
  );
}

function RejectedBanner({ reapplyAt }: { reapplyAt: string | null }) {
  const daysLeft = reapplyAt
    ? Math.max(0, Math.ceil((new Date(reapplyAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
      <div className="flex items-center gap-2 text-destructive">
        <XCircle className="h-5 w-5" />
        <h2 className="font-display text-lg font-semibold">Application not approved</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {daysLeft > 0
          ? `You can reapply in ${daysLeft} day(s).`
          : "You're eligible to reapply now."}
      </p>
    </div>
  );
}

function RemovedBanner({ alumniCode }: { alumniCode: string | null }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Your Creator Program membership ended</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account and data are unaffected — you've moved to a standard paid plan.
      </p>
      {alumniCode && (
        <div className="mt-4 rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">Alumni discount code</p>
          <p className="font-mono text-sm font-medium">{alumniCode}</p>
        </div>
      )}
    </div>
  );
}

function MemberView({ status }: { status: MemberStatus }) {
  const dmOnTrack = status.dmCount >= status.dmTarget;
  const campaignOnTrack = status.campaignCount >= status.campaignTarget;
  const onTrack = dmOnTrack && campaignOnTrack;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-success/30 bg-success/10 p-6">
        <div className="flex items-center gap-2 text-success">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="font-display text-lg font-semibold">You're a Creator Program member</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Member since {new Date(status.joinedAt).toLocaleDateString()}. Unlimited automations, full
          analytics, branded short links, advanced bio link customization, and 5 team seats are active.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="DMs sent this month"
          value={`${status.dmCount}/${status.dmTarget}`}
          icon={Sparkles}
          hint={dmOnTrack ? "On track" : "At risk"}
        />
        <StatCard
          label="Active campaigns"
          value={`${status.campaignCount}/${status.campaignTarget}`}
          icon={Sparkles}
          hint={campaignOnTrack ? "On track" : "At risk"}
        />
      </section>

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold">Monthly requirement status</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              300 automated DMs and 2 active campaigns are required every month to stay in the program.
            </p>
          </div>
          <Badge
            variant="outline"
            className={onTrack ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}
          >
            {onTrack ? "You're on track" : "You're at risk"}
          </Badge>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Keep the "Powered by @Liffio" badge visible on your bio link page — it's a program requirement.
        </p>
      </div>
    </div>
  );
}
