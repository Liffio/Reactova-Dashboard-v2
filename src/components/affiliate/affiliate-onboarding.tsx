import { ArrowRight, CheckCircle2, Gift, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AffiliateProfitCalculator } from "@/components/affiliate/affiliate-profit-calculator";
import {
  AFFILIATE_BENEFITS,
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_HOW_IT_WORKS,
  AFFILIATE_REFERRAL_DISCOUNT,
} from "@/lib/affiliate-program-content";

type AffiliateOnboardingProps = {
  onGetStarted: () => void;
};

export function AffiliateOnboarding({ onGetStarted }: AffiliateOnboardingProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div className="p-6 sm:p-8 relative">
          <div className="absolute inset-0 bg-brand-gradient opacity-[0.06] pointer-events-none" />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Gift className="h-3.5 w-3.5" />
              Partner program
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Earn {AFFILIATE_COMMISSION_RATE * 100}% on every referral
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed">
              Join the Liffio affiliate program, share your link, and earn lifetime recurring
              commission when creators subscribe. Your referrals save{" "}
              {AFFILIATE_REFERRAL_DISCOUNT * 100}% on their first payment.
            </p>
            <Button
              size="lg"
              className="mt-6 h-11 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
              onClick={onGetStarted}
            >
              <Rocket className="h-4 w-4 mr-2" />
              Get started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        <section className="rounded-2xl border bg-card shadow-soft overflow-hidden">
          <div className="border-b px-4 py-3 sm:px-5">
            <h3 className="text-sm font-semibold">How it works</h3>
          </div>
          <ol className="p-4 sm:p-5 space-y-4">
            {AFFILIATE_HOW_IT_WORKS.map((item) => (
              <li key={item.step} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border bg-card shadow-soft overflow-hidden">
          <div className="border-b px-4 py-3 sm:px-5">
            <h3 className="text-sm font-semibold">What you get</h3>
          </div>
          <ul className="p-4 sm:p-5 space-y-3">
            {AFFILIATE_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex gap-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span className="text-muted-foreground leading-relaxed">{benefit}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <AffiliateProfitCalculator />
    </div>
  );
}
