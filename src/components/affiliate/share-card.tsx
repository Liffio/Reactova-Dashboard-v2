import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Mail, Pencil, Share2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  setCustomAffiliateCode,
  type AffiliateLinks,
  type AffiliateProfile,
} from "@/lib/api/affiliate-api";

export function ShareCard({
  profile,
  links,
  onCodeSaved,
}: {
  profile: AffiliateProfile;
  links: AffiliateLinks | undefined;
  onCodeSaved: () => void;
}) {
  const terms = profile.programTerms;
  // Homepage link is the primary one: it is what copy, the share sheet and the social intents use.
  const url = links?.homeCustomLink ?? links?.homeRandomLink ?? "";
  const signupUrl = links?.customLink ?? links?.randomLink ?? "";
  const cut = url.indexOf("?");
  const [copied, setCopied] = useState(false);
  const [copiedSignup, setCopiedSignup] = useState(false);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(profile.customCode ?? "");

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Referral link copied");
    setTimeout(() => setCopied(false), 1800);
  };

  const copySignup = async () => {
    if (!signupUrl) return;
    await navigator.clipboard.writeText(signupUrl);
    setCopiedSignup(true);
    toast.success("Sign-up link copied");
    setTimeout(() => setCopiedSignup(false), 1800);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Liffio", url });
        return;
      } catch {
        // Dismissed share sheet: nothing to do.
        return;
      }
    }
    await copy();
  };

  const saveCode = useMutation({
    mutationFn: () => setCustomAffiliateCode(code),
    onSuccess: () => {
      toast.success("Custom code saved");
      setEditing(false);
      onCodeSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const text = encodeURIComponent("I use Liffio to automate Instagram. Try it with my link:");
  const enc = encodeURIComponent(url);
  const intents = [
    { label: "WhatsApp", href: `https://wa.me/?text=${text}%20${enc}` },
    { label: "X", href: `https://x.com/intent/post?text=${text}&url=${enc}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}` },
  ];

  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft sm:p-[22px]">
      <h2 className="font-display text-[17px] font-semibold tracking-tight">Share and earn</h2>
      {terms?.commissionRatePercent !== undefined && (
        <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
          You earn {terms.commissionRatePercent}% of every payment from workspaces that sign up with
          your link.
        </p>
      )}

      <div className="flex min-w-0 items-center rounded-xl border bg-background py-1 pl-3 pr-1">
        <div className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium">
          {cut > 0 ? (
            <>
              {url.slice(0, cut)}
              <span className="text-muted-foreground">{url.slice(cut)}</span>
            </>
          ) : (
            url
          )}
        </div>
        <button
          onClick={copy}
          className={`inline-flex h-[34px] flex-none items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition-colors ${
            copied ? "bg-success text-white" : "bg-foreground text-background"
          }`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      {signupUrl && (
        <div className="mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-dashed px-3 py-1.5">
          <span className="flex-none text-[12px] font-medium text-muted-foreground">
            Sign-up page link
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{signupUrl}</span>
          <button
            onClick={copySignup}
            aria-label="Copy sign-up page link"
            className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copiedSignup ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2.5 px-0.5">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
          Code
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-medium text-foreground">
            {profile.customCode ?? profile.randomCode}
          </span>
        </div>
        <button
          className="inline-flex items-center gap-1.5 text-[13px] font-medium underline decoration-border underline-offset-[3px] hover:decoration-current"
          onClick={() => setEditing((v) => !v)}
        >
          <Pencil className="h-3.5 w-3.5" />
          {profile.customCode ? "Change code" : "Custom code"}
        </button>
      </div>

      {editing && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveCode.mutate();
          }}
        >
          <div className="flex w-full overflow-hidden rounded-[10px] border bg-card">
            <span className="flex items-center border-r bg-muted px-2.5 font-mono text-[12.5px] text-muted-foreground">
              ?ref=
            </span>
            <input
              autoFocus
              aria-label="Custom referral code"
              className="h-9 min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[13px] outline-none"
              placeholder="yourname"
              maxLength={20}
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            3 to 20 characters. Your current link keeps working.
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" type="submit" disabled={code.length < 3 || saveCode.isPending}>
              Save code
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <ol
        className="mb-4 mt-4 grid grid-cols-3 gap-3 text-[12.5px] leading-snug text-muted-foreground"
        aria-label="How you get paid"
      >
        {[
          ["They sign up", "with your link or code"],
          [
            "They pay",
            terms?.commissionRatePercent !== undefined
              ? `you earn ${terms.commissionRatePercent}% of it`
              : "you earn a share of it",
          ],
          [
            terms?.holdDays ? `${terms.holdDays} days later` : "After the hold",
            "it's ready to withdraw",
          ],
        ].map(([title, sub], i) => (
          <li key={title}>
            <b className="mb-0.5 flex items-center gap-1.5 font-medium text-foreground">
              <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full border font-display text-[10.5px] font-semibold">
                {i + 1}
              </span>
              {title}
            </b>
            {sub}
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-border/60 pt-4">
        <div className="hidden flex-wrap gap-1.5 sm:flex">
          {intents.map((i) => (
            <Button key={i.label} asChild size="sm" variant="outline">
              <a href={i.href} target="_blank" rel="noopener noreferrer">
                {i.label}
              </a>
            </Button>
          ))}
          <Button asChild size="sm" variant="outline" aria-label="Share by email">
            <a href={`mailto:?subject=${encodeURIComponent("Try Liffio")}&body=${text}%20${enc}`}>
              <Mail className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <Button size="sm" variant="outline" className="sm:hidden" onClick={share}>
          <Share2 className="h-4 w-4" />
          Share link
        </Button>
        <div className="text-[13px] text-muted-foreground">
          {profile.totalReferrals ? (
            <>
              <b className="font-semibold text-foreground">{profile.totalReferrals}</b> referred,{" "}
              <b className="font-semibold text-foreground">{profile.activeReferrals}</b> active
            </>
          ) : (
            "No referrals yet"
          )}
        </div>
      </div>
    </div>
  );
}
