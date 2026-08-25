import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSendRate } from "@/lib/api/send-rate-api";

/**
 * Persistent notice while an automatic safety reduction is active (spec §13).
 *
 * Deliberately a banner and not only a toast. Silent throttling produces exactly the "your tool
 * is slow" ticket this work exists to prevent, and someone who misses the toast and later
 * notices slow sends is precisely the ticket being avoided — so the notice has to still be there
 * when they go looking.
 *
 * Four things make the copy work, and all four are load-bearing: the cause is attributed to
 * Instagram, the reason is framed as protection rather than punishment, the new number is
 * stated, and it says temporary and automatic so nobody opens a ticket.
 *
 * What it must never say (§15): why Instagram is throttling. If the cause were the workspace's
 * own volume that would be fair to tell them, but from our side a workspace's own volume and a
 * co-tenant's on the same Instagram account are indistinguishable — and guessing wrong is worse
 * than staying general.
 */
export function SendRateBanner() {
  const { data } = useQuery({
    queryKey: ["send-rate"],
    queryFn: () => getSendRate(),
    // The reduction lifts on its own, so the banner has to be able to disappear without a
    // reload. Cheap enough to poll: one small row read.
    refetchInterval: 5 * 60_000,
  });

  if (!data?.connected || data.limitedBy !== "safety_cap") return null;

  const rate = data.safetyCapPerHour ?? data.effectivePerHour;

  return (
    <Alert className="border-warning/30 bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">Send rate temporarily reduced</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        Instagram has been rate-limiting this account, so we&apos;ve lowered your send rate
        {rate ? ` to ${rate}/hr` : ""} to protect it from restrictions. This lifts automatically
        once delivery stabilises — no action needed.{" "}
        <Link to="/settings" className="font-medium underline underline-offset-2">
          Send rate settings
        </Link>
      </AlertDescription>
    </Alert>
  );
}
