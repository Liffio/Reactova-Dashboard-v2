import { useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Hourglass,
  Info,
  Instagram,
  ShieldCheck,
  Trophy,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import { getMetaOAuthStartUrl, isWorkspaceInstagramConnected } from "@/lib/api/integrations-api";
import { ApiError } from "@/lib/api/http";
import { useApp } from "@/state/app-context";
import {
  applyToCreatorProgram,
  getCreatorProfile,
  getCreatorStatus,
  getCreatorThresholds,
  type ApplyOutcome,
  type CreatorProfile,
  type CreatorStatus,
  type CreatorThresholds,
} from "@/lib/api/creator-eligibility-api";
import { reasonLabel, resolutionCopy } from "@/lib/creator-eligibility-copy";

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

const STATUS_KEY = ["creator-eligibility-status"];
const PROFILE_KEY = ["creator-eligibility-profile"];

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function hasCooldown(
  status: Extract<CreatorStatus, { state: "Eligible" }>,
): status is Extract<CreatorStatus, { state: "Eligible"; cooldown: unknown }> {
  return "cooldown" in status;
}

function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/**
 * ENDPOINT-CONTRACT.md §3.2 only documents `instagramUsername`/`followerCount`
 * on the creator-facing `/profile` response — no `followingCount`/`postCount`
 * (camelCase or snake_case) is specified there today (those exist only on the
 * admin-only metrics shape, §2.7). Read defensively rather than typed/assumed:
 * if the live response happens to include them anyway, they render; if not,
 * this returns null and the caller hides that stat rather than showing 0/—.
 */
function readOptionalCount(obj: unknown, ...keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Same defensive-read pattern as readOptionalCount, for string fields. */
function readOptionalString(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

// Exact plain-English copy for the "Not eligible yet" box — scoped to
// NotEligibleReason specifically (distinct from the shared reasonLabel/
// resolutionCopy pairing used by NeedsAttention, which covers a different
// reason enum with its own established copy).
function notEligibleReasonText(reason: string | null | undefined, minPosts: number): string {
  switch (reason) {
    case "InstagramNotConnected":
      return "Connect your Instagram account to continue.";
    case "PrivateAccount":
      return "Your account is set to private.";
    case "PersonalAccount":
      return "Your account needs to be Business or Creator type.";
    case "InsufficientContent":
      return `Your account needs at least ${minPosts} posts.`;
    case "InactiveAccount":
      return "Your account hasn't posted in the last 30 days.";
    default:
      return "Your account doesn't meet the requirements yet.";
  }
}

const RECONNECT_REASONS = new Set(["InstagramNotConnected", "InstagramDisconnected"]);

function CreatorsProgramPage() {
  const { current } = useApp();
  const queryClient = useQueryClient();
  const [justApplied, setJustApplied] = useState<ApplyOutcome | null>(null);

  const statusQuery = useQuery({
    queryKey: STATUS_KEY,
    queryFn: getCreatorStatus,
    refetchInterval: (query) => {
      const data = query.state.data as CreatorStatus | undefined;
      // Poll while a decision is pending — waitlisted apps auto-promote, and
      // pending-review apps get decided by an admin, with no push channel
      // (ENDPOINT-CONTRACT.md §5: polling is the documented interim pattern).
      if (data?.state === "Eligible" && "latestApplication" in data) {
        return 20_000;
      }
      return false;
    },
  });
  // ENDPOINT-CONTRACT.md §3.2 — flatter, single-shape alternative to /status; drives
  // page state + dashboard data. Not a replacement for /status, which is still the
  // only source for cooldown/application-in-flight detail on the Eligible sub-state.
  // A 404 here (no CreatorProfile yet) is expected and not worth retrying.
  const profileQuery = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: getCreatorProfile,
    retry: false,
  });
  const thresholdsQuery = useQuery({
    queryKey: ["creator-eligibility-thresholds"],
    queryFn: getCreatorThresholds,
  });

  const applyMutation = useMutation({
    mutationFn: applyToCreatorProgram,
    onSuccess: (outcome) => {
      setJustApplied(outcome);
      void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const applyError = applyMutation.isError ? (applyMutation.error as Error).message : null;

  const status = statusQuery.data;
  const profile = profileQuery.data;
  const noProfile = profileQuery.isError && isNotFound(profileQuery.error);

  if (statusQuery.isLoading || profileQuery.isLoading) {
    return (
      <div>
        <PageHeader
          eyebrow="Grow with Liffio"
          title="Creator Program"
          description="An eligibility-based program for creators who are ready to scale."
        />
        <div className="space-y-4 p-4 sm:p-6 md:p-10">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[35%_1fr]">
            <Skeleton className="h-96 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const retryAll = () => {
    void statusQuery.refetch();
    void profileQuery.refetch();
  };

  // Any failure other than the profile's expected 404 (no CreatorProfile yet) is a
  // real error state — including a missing/errored /status response.
  if (statusQuery.isError || !status || (profileQuery.isError && !noProfile)) {
    return (
      <div>
        <PageHeader eyebrow="Grow with Liffio" title="Creator Program" />
        <div className="p-4 sm:p-6 md:p-10">
          <ErrorCard
            message={
              (statusQuery.error as Error)?.message || (profileQuery.error as Error)?.message
            }
            onRetry={retryAll}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Grow with Liffio"
        title="Creator Program"
        description="An eligibility-based program for creators who are ready to scale — unlimited automations, full analytics, and priority support."
      />
      <div className="p-4 sm:p-6 md:p-10">
        {justApplied ? (
          <JustAppliedCard outcome={justApplied} onContinue={() => setJustApplied(null)} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[35%_1fr]">
            <div className="min-w-0">
              <InstagramCard
                profile={profile}
                noProfile={noProfile}
                workspaceInstagramConnected={Boolean(current.instagramConnected)}
                status={status}
                onApply={() => applyMutation.mutate()}
                applyPending={applyMutation.isPending}
                applyError={applyError}
              />
            </div>
            <div className="min-w-0">
              <ProgramInfoCard
                thresholds={thresholdsQuery.data}
                profile={profile}
                noProfile={noProfile}
                status={status}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
      <XCircle className="mx-auto h-8 w-8 text-destructive" />
      <p className="mt-3 text-sm text-muted-foreground">
        {message || "We couldn't load your Creator Program status."}
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function ConnectInstagramButton({
  label = "Connect Instagram",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { current, refreshAuth } = useApp();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const result = await openMetaOAuthPopup(
        async () => {
          const { url } = await getMetaOAuthStartUrl(current.id, "settings");
          return url;
        },
        {
          oauthWorkspaceId: current.id,
          checkConnected: () => isWorkspaceInstagramConnected(current.id),
          verifyConnected: () => isWorkspaceInstagramConnected(current.id),
        },
      );
      if (result.meta === "connected") {
        toast.success(result.igHandle ? `Connected as @${result.igHandle}` : "Instagram connected");
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
        void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
        void refreshAuth();
      } else if (result.reason && result.reason !== "user_canceled") {
        toast.error("Instagram connect failed. Please try again.");
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(
        msg.includes("Popup blocked")
          ? "Popup blocked — allow popups and try again."
          : msg || "Instagram connect failed.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Button className={className} disabled={isConnecting} onClick={() => void handleConnect()}>
      {isConnecting ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Instagram className="h-4 w-4" />
      )}
      {isConnecting ? "Connecting…" : label}
    </Button>
  );
}

// The Instagram-brand gradient ring around a real photo — a double-background
// trick (inner white fill on padding-box, gradient ring on border-box) that
// can't be expressed as a plain Tailwind utility, so it's inline CSS.
const IG_GRADIENT_RING_STYLE: CSSProperties = {
  border: "3px solid transparent",
  background:
    "linear-gradient(#fff, #fff) padding-box, linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888) border-box",
};

/**
 * ENDPOINT-CONTRACT.md §3.2's `/profile` doesn't document a `profilePictureUrl`
 * field as of this writing (checked — not present in the spec's example
 * response or field notes), despite that being asked for here. Read it
 * defensively at runtime rather than assume the documented contract is stale:
 * if the live API does send it, it renders with the IG gradient ring; if not
 * (or it's null), this falls back to the gradient icon, same as before.
 */
function ProfilePhoto({ url }: { url: string | null }) {
  if (url) {
    return (
      <div
        className="mx-auto h-20 w-20 overflow-hidden rounded-full"
        style={IG_GRADIENT_RING_STYLE}
      >
        <img
          src={url}
          alt="Instagram profile"
          className="h-full w-full rounded-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white ring-4 ring-primary/10">
      <Instagram className="h-9 w-9" />
    </div>
  );
}

function InstagramCard({
  profile,
  noProfile,
  workspaceInstagramConnected,
  status,
  onApply,
  applyPending,
  applyError,
}: {
  profile: CreatorProfile | undefined;
  noProfile: boolean;
  workspaceInstagramConnected: boolean;
  status: CreatorStatus;
  onApply: () => void;
  applyPending: boolean;
  applyError: string | null;
}) {
  const connected = profile ? profile.instagramConnected : noProfile && workspaceInstagramConnected;

  const stats: Array<{ label: string; value: number }> = [];
  if (profile && profile.followerCount !== null && profile.followerCount !== undefined) {
    stats.push({ label: "Followers", value: profile.followerCount });
  }
  const following = readOptionalCount(profile, "followingCount", "following_count");
  if (following !== null) stats.push({ label: "Following", value: following });
  const posts = readOptionalCount(profile, "postCount", "post_count");
  if (posts !== null) stats.push({ label: "Posts", value: posts });
  const photoUrl = readOptionalString(profile, "profilePictureUrl", "profile_picture_url");

  return (
    <div className="rounded-2xl border bg-card p-6 text-center shadow-soft">
      <ProfilePhoto url={photoUrl} />
      <p className="mt-4 font-display text-lg font-semibold">
        {profile?.instagramUsername
          ? `@${profile.instagramUsername}`
          : connected
            ? "Instagram account"
            : "Not connected"}
      </p>

      {stats.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-xl font-bold tabular-nums">
                {formatCompactCount(s.value)}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* "Basic Stats" (engagement rate / avg likes / avg comments) intentionally
          omitted — ENDPOINT-CONTRACT.md has no insights/engagement fields on the
          creator-facing /profile endpoint at all (only on the admin-only metrics
          shape, and even there engagementRate is always null pending Phase 3's
          media-insights work). Nothing to gate on; nothing to show. */}

      <div className="mt-6">
        {connected ? (
          <div className="w-full rounded-md border border-success/30 bg-success/10 py-2 text-sm font-medium text-success">
            Connected ✓
          </div>
        ) : (
          <ConnectInstagramButton className="w-full" />
        )}
      </div>

      <div className="mt-3">
        <LeftCardAction
          profile={profile}
          status={status}
          onApply={onApply}
          applyPending={applyPending}
        />
      </div>

      {applyError && <p className="mt-3 text-sm text-destructive">{applyError}</p>}
    </div>
  );
}

function LeftCardAction({
  profile,
  status,
  onApply,
  applyPending,
}: {
  profile: CreatorProfile | undefined;
  status: CreatorStatus;
  onApply: () => void;
  applyPending: boolean;
}) {
  if (!profile) return null;

  switch (profile.state) {
    case "NotEligible":
      return (
        <Button disabled variant="outline" className="w-full">
          Not eligible yet
        </Button>
      );
    case "Eligible": {
      const eligibleStatus = status.state === "Eligible" ? status : null;
      if (eligibleStatus && !hasCooldown(eligibleStatus)) {
        return (
          <p className="text-sm text-muted-foreground">
            {eligibleStatus.latestApplication.isWaitlisted
              ? "You're on the waitlist"
              : "Application under review"}
          </p>
        );
      }
      if (eligibleStatus && hasCooldown(eligibleStatus) && eligibleStatus.cooldown.active) {
        return (
          <Button disabled variant="outline" className="w-full">
            Reapply on {fmtDate(eligibleStatus.cooldown.reapplyAt)}
          </Button>
        );
      }
      return (
        <Button className="w-full gap-2" disabled={applyPending} onClick={onApply}>
          {applyPending && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {applyPending ? "Checking eligibility…" : "Submit Application"}
        </Button>
      );
    }
    case "Active":
    case "NeedsAttention":
    case "Paused":
      return null;
  }
}

function InfoSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display font-semibold mb-2 flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-primary" /> {title}
      </h3>
      {children}
    </div>
  );
}

function ProgramInfoCard({
  thresholds,
  profile,
  noProfile,
  status,
}: {
  thresholds: CreatorThresholds | undefined;
  profile: CreatorProfile | undefined;
  noProfile: boolean;
  status: CreatorStatus;
}) {
  const minPosts = thresholds?.minPosts ?? 15;
  const maxDays = thresholds?.maxDaysSinceLastPost ?? 30;
  const minAutomations = thresholds?.minActiveAutomations ?? 2;
  const minDms = thresholds?.minMonthlyDms ?? 300;

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <InfoSection icon={Info} title="What the Creator Program is">
          <p className="text-sm text-muted-foreground">
            An eligibility-based program for creators who use Liffio to grow their audience. If you
            qualify, you get free access to the full Business plan — unlimited automations, full
            analytics, and priority support.
          </p>
        </InfoSection>

        <InfoSection icon={UserCheck} title="What we look for">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Business/Creator account (not Personal)</li>
            <li>• Public account</li>
            <li>• At least {minPosts} posts</li>
            <li>• Active in the last {maxDays} days</li>
          </ul>
        </InfoSection>

        <InfoSection icon={Trophy} title="What you get">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Unlimited automated DMs</li>
            <li>• Full analytics</li>
            <li>• Priority support</li>
            <li>• Early access to new features</li>
            <li>• Creator badge</li>
          </ul>
        </InfoSection>

        <InfoSection icon={History} title="What's asked in return">
          <p className="text-sm text-muted-foreground">
            The Creator Program is free. In return, every automation includes a short recommendation
            for Liffio, helping us grow the platform and continue offering Creator accounts at no
            cost.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            <li>• Run at least {minAutomations} active automations per month</li>
            <li>• Send at least {minDms} automated DMs per month</li>
          </ul>
        </InfoSection>
      </div>

      <EligibilityStatusBox
        profile={profile}
        noProfile={noProfile}
        status={status}
        minPosts={minPosts}
      />
    </div>
  );
}

const STATUS_BOX_TONE: Record<string, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  primary: "border-primary/30 bg-primary/10 text-primary",
  neutral: "border-border bg-muted/30 text-muted-foreground",
};

function EligibilityStatusBox({
  profile,
  noProfile,
  status,
  minPosts,
}: {
  profile: CreatorProfile | undefined;
  noProfile: boolean;
  status: CreatorStatus;
  minPosts: number;
}) {
  if (noProfile) {
    return (
      <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.neutral}`}>
        <p className="font-medium">Creator Program isn't open on your account yet</p>
        <p className="mt-1 text-sm">We'll let you know the moment it is.</p>
      </div>
    );
  }

  if (!profile) return null;

  switch (profile.state) {
    case "NotEligible": {
      const canReconnect = RECONNECT_REASONS.has(profile.primaryReason ?? "");
      return (
        <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.warning}`}>
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Not eligible yet
          </div>
          <p className="mt-1 text-sm">{notEligibleReasonText(profile.primaryReason, minPosts)}</p>
          {canReconnect && (
            <div className="mt-3">
              <ConnectInstagramButton />
            </div>
          )}
          <p className="mt-3 text-xs opacity-90">
            Resolve the issue above to become eligible. We recheck automatically.
          </p>
        </div>
      );
    }
    case "Eligible": {
      const eligibleStatus = status.state === "Eligible" ? status : null;
      if (eligibleStatus && !hasCooldown(eligibleStatus)) {
        const app = eligibleStatus.latestApplication;
        if (app.isWaitlisted) {
          return (
            <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.primary}`}>
              <div className="flex items-center gap-2 font-medium">
                <Hourglass className="h-4 w-4" /> You're on the waitlist
              </div>
              <p className="mt-1 text-sm">
                You qualify! A spot will open up soon — you'll be approved automatically.
              </p>
            </div>
          );
        }
        return (
          <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.primary}`}>
            <div className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4" /> Application under review
            </div>
            <p className="mt-1 text-sm">Our team will follow up shortly.</p>
          </div>
        );
      }
      if (eligibleStatus && hasCooldown(eligibleStatus) && eligibleStatus.cooldown.active) {
        return (
          <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.warning}`}>
            <div className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4" /> Not approved last time
            </div>
            <p className="mt-1 text-sm">
              You meet the requirements again — you can reapply on{" "}
              {fmtDate(eligibleStatus.cooldown.reapplyAt)}.
            </p>
          </div>
        );
      }
      return (
        <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.success}`}>
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4" /> You're eligible!
          </div>
          <p className="mt-1 text-sm">
            Your account meets all requirements. Submit your application below.
          </p>
        </div>
      );
    }
    case "Active":
      return (
        <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.success}`}>
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" /> You're in the Creator Program
          </div>
          <p className="mt-1 text-sm">Creator since {fmtDate(profile.approvedAt)}.</p>
          <div className="mt-4 space-y-3">
            <MonthlyProgressBars profile={profile} />
          </div>
        </div>
      );
    case "NeedsAttention": {
      const canReconnect =
        RECONNECT_REASONS.has(profile.primaryReason ?? "") && !profile.instagramConnected;
      return (
        <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.warning}`}>
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Needs attention
          </div>
          <p className="mt-1 text-sm">{reasonLabel(profile.primaryReason)}</p>
          <p className="mt-1 text-sm opacity-90">{resolutionCopy(profile.primaryReason)}</p>
          {canReconnect && (
            <div className="mt-3">
              <ConnectInstagramButton />
            </div>
          )}
          <div className="mt-4 space-y-3">
            <MonthlyProgressBars profile={profile} />
          </div>
        </div>
      );
    }
    case "Paused":
      return (
        <div className={`rounded-xl border p-4 ${STATUS_BOX_TONE.neutral}`}>
          <p className="font-medium">Your Creator Program access is paused</p>
          <p className="mt-1 text-sm">
            This requires a review from our team. Reach out to support if you have questions.
          </p>
        </div>
      );
  }
}

function MonthlyProgressBars({ profile }: { profile: CreatorProfile }) {
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs opacity-90">
          <span>Automated DMs</span>
          <span className="tabular-nums">
            {profile.monthlyDms} / {profile.minMonthlyDms}
          </span>
        </div>
        <Progress
          value={Math.min(100, (profile.monthlyDms / Math.max(1, profile.minMonthlyDms)) * 100)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs opacity-90">
          <span>Active automations</span>
          <span className="tabular-nums">
            {profile.activeAutomations} / {profile.minActiveAutomations}
          </span>
        </div>
        <Progress
          value={Math.min(
            100,
            (profile.activeAutomations / Math.max(1, profile.minActiveAutomations)) * 100,
          )}
        />
      </div>
    </>
  );
}

function JustAppliedCard({
  outcome,
  onContinue,
}: {
  outcome: ApplyOutcome;
  onContinue: () => void;
}) {
  let content: { icon: typeof CheckCircle2; tone: string; title: string; body: string };

  if (outcome.outcome === "blocked_by_cooldown") {
    content = {
      icon: Clock,
      tone: "warning",
      title: "You're still in your cooldown period",
      body: `You can reapply on ${fmtDate(outcome.reapplyAt)}.`,
    };
  } else if (outcome.outcome === "rejected_eligibility_changed") {
    content = {
      icon: XCircle,
      tone: "destructive",
      title: "Something changed since you last qualified",
      body: "Your account no longer meets the requirements it did a moment ago. Check the details below for what to fix.",
    };
  } else {
    switch (outcome.decision) {
      case "auto_approved":
        content = {
          icon: ShieldCheck,
          tone: "success",
          title: "You're in!",
          body: "Creator Plan is now active.",
        };
        break;
      case "waitlisted":
        content = {
          icon: Hourglass,
          tone: "primary",
          title: "You qualify — you're on the waitlist",
          body: "We're at capacity right now — you're on the waitlist and will be approved automatically as soon as a spot opens.",
        };
        break;
      case "queued_for_review":
        content = {
          icon: Clock,
          tone: "warning",
          title: "Application submitted",
          body: "Our team is reviewing your application — we'll follow up shortly.",
        };
        break;
      case "already_submitted":
        content = {
          icon: Clock,
          tone: "warning",
          title: "You already have an application in progress",
          body: "We found your existing submission — no need to apply again.",
        };
        break;
      case "auto_rejected":
      default:
        content = {
          icon: XCircle,
          tone: "destructive",
          title: "Not approved this time",
          body: "Your application didn't meet our current bar. Continue below to see when you can reapply.",
        };
        break;
    }
  }

  const Icon = content.icon;
  const toneClasses: Record<string, string> = {
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    primary: "border-primary/30 bg-primary/10 text-primary",
  };

  return (
    <div className={`rounded-2xl border p-6 ${toneClasses[content.tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <h2 className="font-display text-lg font-semibold">{content.title}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{content.body}</p>
      <Button variant="outline" size="sm" className="mt-5" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
