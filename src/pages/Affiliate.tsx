import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AffiliateConsentDialog } from "@/components/affiliate/AffiliateConsentDialog";
import { AffiliateOnboarding } from "@/components/affiliate/AffiliateOnboarding";
import { AffiliateProgramDashboard } from "@/components/affiliate/AffiliateProgramDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAffiliateProfile } from "@/hooks/useAffiliate";

export default function Affiliate() {
  const profileQuery = useAffiliateProfile();
  const [consentOpen, setConsentOpen] = useState(false);

  const hasConsent = Boolean(profileQuery.data?.hasProgramConsent);
  const loading = profileQuery.isLoading;

  return (
    <DashboardLayout
      title="Affiliate Program"
      subtitle={
        hasConsent
          ? "Earn 50% lifetime recurring commission on every referred paying customer."
          : "Learn how the program works, then join with one-time consent."
      }
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : hasConsent ? (
        <AffiliateProgramDashboard />
      ) : (
        <>
          <AffiliateOnboarding onGetStarted={() => setConsentOpen(true)} />
          <AffiliateConsentDialog
            open={consentOpen}
            onOpenChange={setConsentOpen}
            onAccepted={() => {
              void profileQuery.refetch();
            }}
          />
        </>
      )}
    </DashboardLayout>
  );
}
