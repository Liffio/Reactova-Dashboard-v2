import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Skeleton } from "@/components/ui/skeleton";
import { AffiliateOnboarding } from "@/components/affiliate/affiliate-onboarding";
import { AffiliateConsentDialog } from "@/components/affiliate/affiliate-consent-dialog";
import { AffiliatePageBody } from "@/components/affiliate/affiliate-page-body";
import { getAffiliateProfile } from "@/lib/api/affiliate-api";

export const Route = createFileRoute("/_app/affiliate")({
  head: () => ({ meta: [{ title: "Affiliate Program — Liffio" }] }),
  component: AffiliateRoute,
});

function AffiliateRoute() {
  return (
    <ProtectedRoute module="affiliate">
      <AffiliatePage />
    </ProtectedRoute>
  );
}

/**
 * The commission rate is configured server-side (`AFFILIATE_COMMISSION_RATE`) and
 * surfaced on the affiliate profile. If the API did not report it we omit the
 * number rather than printing a stale literal.
 */
const commissionHeadline = (ratePercent: number | undefined) =>
  ratePercent === undefined
    ? "Earn a recurring commission for every customer you refer."
    : `Earn ${ratePercent}% recurring commission for every customer you refer.`;

function AffiliatePage() {
  const queryClient = useQueryClient();
  const [consentOpen, setConsentOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["affiliate-profile"],
    queryFn: getAffiliateProfile,
  });
  const profile = profileQuery.data;

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-4 p-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <p className="p-10 text-sm text-muted-foreground">
        Couldn't load your affiliate account. Refresh the page to try again.
      </p>
    );
  }

  if (!profile.hasProgramConsent) {
    return (
      <div>
        <PageHeader
          title="Affiliate Program"
          description={commissionHeadline(profile.programTerms?.commissionRatePercent)}
        />
        <div className="p-4 sm:p-6 md:p-10">
          <AffiliateOnboarding onGetStarted={() => setConsentOpen(true)} />
        </div>
        <AffiliateConsentDialog
          open={consentOpen}
          onOpenChange={setConsentOpen}
          onAccepted={() => void queryClient.invalidateQueries({ queryKey: ["affiliate-profile"] })}
        />
      </div>
    );
  }

  return <AffiliatePageBody profile={profile} />;
}
