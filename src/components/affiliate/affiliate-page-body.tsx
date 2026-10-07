import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAffiliateKycStatus,
  getAffiliateKycSubmissionStatus,
  getAffiliateLinks,
  getPayoutAccount,
  getPayoutAccountConfig,
  listAffiliatePayouts,
  listAffiliateReferrals,
  type AffiliateProfile,
} from "@/lib/api/affiliate-api";
import { CommissionsPanel, PayoutsPanel, ReferralsPanel } from "./activity-panels";
import { OPEN_PAYOUT_STATUSES } from "./affiliate-format";
import { BalanceCard } from "./balance-card";
import { PayoutAccountDialog } from "./payout-account-dialog";
import { getPayoutState, usd } from "./payout-state";
import { RequestPayoutDialog } from "./request-payout-dialog";
import { HeroArt } from "./illustrations";
import { ShareCard } from "./share-card";
import { KycUploadDialog, VerificationPanel } from "./verification-panel";

type Tab = "referrals" | "commissions" | "payouts" | "verification";

/** Every query the page reads, so a mutation can refresh exactly what it changed. */
const KEYS = {
  profile: ["affiliate-profile"],
  links: ["affiliate-links"],
  referrals: ["affiliate-referrals"],
  payouts: ["affiliate-payouts"],
  kyc: ["affiliate-kyc-requirement"],
  kycSubmission: ["affiliate-kyc-status"],
  account: ["affiliate-payout-account"],
  config: ["affiliate-payout-config"],
} as const;

export function AffiliatePageBody({ profile }: { profile: AffiliateProfile }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("referrals");
  const [dialog, setDialog] = useState<"account" | "request" | "kyc" | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const links = useQuery({ queryKey: KEYS.links, queryFn: getAffiliateLinks });
  const referrals = useQuery({ queryKey: KEYS.referrals, queryFn: listAffiliateReferrals });
  const payouts = useQuery({ queryKey: KEYS.payouts, queryFn: listAffiliatePayouts });
  const kyc = useQuery({ queryKey: KEYS.kyc, queryFn: getAffiliateKycStatus });
  const kycSubmission = useQuery({
    queryKey: KEYS.kycSubmission,
    queryFn: getAffiliateKycSubmissionStatus,
  });
  const account = useQuery({ queryKey: KEYS.account, queryFn: getPayoutAccount });
  const config = useQuery({
    queryKey: KEYS.config,
    queryFn: getPayoutAccountConfig,
    staleTime: Infinity,
  });

  const refresh = (...keys: Array<readonly string[]>) =>
    keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));

  const payoutList = payouts.data ?? [];
  const accountData = account.data ?? null;
  const hasOpenPayout = payoutList.some((p) => OPEN_PAYOUT_STATUSES.includes(p.status));
  const payoutState = getPayoutState({
    profile,
    account: accountData,
    kyc: kyc.data ?? null,
    hasOpenPayout,
  });
  const spendable = profile.spendableBalance ?? profile.availableBalance;
  const terms = profile.programTerms;
  const kycNeedsAction =
    !!kyc.data?.kycRequired &&
    kyc.data.kycStatus !== "verified" &&
    kyc.data.kycStatus !== "pending_review";

  const goTo = (t: Tab) => {
    setTab(t);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onPayoutAction = () => {
    if (payoutState.action === "setup") setDialog("account");
    else if (payoutState.action === "verification") goTo("verification");
    else if (payoutState.action === "request") setDialog("request");
  };

  const copyLink = async () => {
    const url = links.data?.homeCustomLink ?? links.data?.homeRandomLink;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Referral link copied");
  };

  const loading = payouts.isLoading || account.isLoading || kyc.isLoading;
  // A payout that needs KYC decides the tier; otherwise an early upload uses the residency's base tier.
  const required = !!kyc.data?.kycRequired && !!kyc.data.tier;
  const uploadTier = required ? kyc.data!.tier : (kycSubmission.data?.voluntary?.tier ?? null);
  const uploadDocs = required
    ? (kyc.data?.documentsNeeded ?? [])
    : (kycSubmission.data?.voluntary?.documents ?? []);
  const uploadIntl = uploadTier === "INTL";

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 md:px-8 md:pt-7">
      <div className="relative mb-5 flex flex-col gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.08] via-card to-card px-5 py-5 sm:px-6 md:min-h-[150px] md:flex-row md:items-end md:justify-between md:gap-6 md:py-6">
        <HeroArt className="absolute -top-1 right-0 hidden h-[150px] w-auto opacity-90 lg:block xl:right-6" />
        <div className="relative">
          <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">
            Affiliate Program
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-sm text-muted-foreground">
            Share your link, earn on every workspace you bring in, and withdraw once your balance
            clears.
          </p>
        </div>
        {terms && (
          <div className="relative -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:justify-end md:px-0 [scrollbar-width:none]">
            {[
              terms.commissionRatePercent !== undefined && [
                `${terms.commissionRatePercent}%`,
                "recurring commission",
              ],
              terms.holdDays && [`${terms.holdDays}-day`, "hold"],
              terms.minPayoutUsd !== undefined && [
                usd(terms.minPayoutUsd).replace(/\.00$/, ""),
                "minimum payout",
              ],
            ]
              .filter((c): c is [string, string] => Array.isArray(c))
              .map(([strong, rest]) => (
                <span
                  key={rest}
                  className="inline-flex h-7 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-2.5 text-[12.5px]"
                >
                  <strong className="font-semibold">{strong}</strong> {rest}
                </span>
              ))}
          </div>
        )}
      </div>

      <section className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {loading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : (
          <BalanceCard
            profile={profile}
            payouts={payoutList}
            payoutState={payoutState}
            onPayoutAction={onPayoutAction}
            onViewPayouts={() => goTo("payouts")}
          />
        )}
        <ShareCard
          profile={profile}
          links={links.data}
          onCodeSaved={() => refresh(KEYS.profile, KEYS.links)}
        />
      </section>

      <section
        ref={tabsRef}
        className="scroll-mt-4 overflow-hidden rounded-2xl border bg-card shadow-soft"
        aria-label="Referral activity"
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 px-3 sm:px-5 [scrollbar-width:none]">
            {(
              [
                ["referrals", "Referrals", profile.totalReferrals],
                ["commissions", "Commissions", null],
                ["payouts", "Payouts", payoutList.length],
                ["verification", "Verification", null],
              ] as const
            ).map(([value, label, count]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="group relative gap-2 rounded-none px-2.5 pb-3 pt-3.5 text-[13.5px] text-muted-foreground shadow-none after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-foreground"
              >
                {label}
                {count !== null && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1.5 text-[11.5px] tabular-nums group-data-[state=active]:bg-foreground group-data-[state=active]:text-background">
                    {count}
                  </span>
                )}
                {value === "verification" && kycNeedsAction && (
                  <span
                    className="h-[7px] w-[7px] rounded-full bg-primary"
                    aria-label="Action needed"
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="referrals" className="mt-0">
            {referrals.isLoading ? (
              <Skeleton className="m-5 h-40" />
            ) : (
              <ReferralsPanel
                referrals={referrals.data ?? []}
                totalReferrals={profile.totalReferrals}
                activeReferrals={profile.activeReferrals}
                onCopyLink={copyLink}
              />
            )}
          </TabsContent>
          <TabsContent value="commissions" className="mt-0">
            <CommissionsPanel terms={terms} />
          </TabsContent>
          <TabsContent value="payouts" className="mt-0">
            <PayoutsPanel
              payouts={payoutList}
              account={accountData}
              minPayoutUsd={terms?.minPayoutUsd}
              canRequest={payoutState.action === "request"}
              onEditAccount={() => setDialog("account")}
              onRequest={() => setDialog("request")}
            />
          </TabsContent>
          <TabsContent value="verification" className="mt-0">
            <VerificationPanel
              kyc={kyc.data}
              submission={kycSubmission.data}
              account={accountData}
              labels={config.data?.documentLabels ?? {}}
              onAddDetails={() => setDialog("account")}
              onUpload={() => setDialog("kyc")}
            />
          </TabsContent>
        </Tabs>
      </section>

      <PayoutAccountDialog
        open={dialog === "account"}
        onOpenChange={(o) => setDialog(o ? "account" : null)}
        account={accountData}
        config={config.data}
        onSaved={() => refresh(KEYS.account, KEYS.kyc, KEYS.profile)}
      />
      <RequestPayoutDialog
        open={dialog === "request"}
        onOpenChange={(o) => setDialog(o ? "request" : null)}
        spendable={spendable}
        account={accountData}
        onChangeAccount={() => setDialog("account")}
        onRequested={() => refresh(KEYS.profile, KEYS.payouts, KEYS.kyc)}
      />
      <KycUploadDialog
        open={dialog === "kyc"}
        onOpenChange={(o) => setDialog(o ? "kyc" : null)}
        tier={uploadTier}
        docs={uploadDocs}
        documentSets={kycSubmission.data?.documentSets}
        region={kycSubmission.data?.region}
        askRegion={!required && !kycSubmission.data?.region?.residency}
        intl={uploadIntl}
        labels={config.data?.documentLabels ?? {}}
        onSubmitted={() => refresh(KEYS.kyc, KEYS.kycSubmission, KEYS.profile)}
      />
    </div>
  );
}
