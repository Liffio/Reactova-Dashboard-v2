import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import { Country } from "country-state-city";

import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleIcon } from "@/components/auth/google-icon";
import { useMounted } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useRegisterMutation } from "@/hooks/use-auth";
import { googleAuthUrl } from "@/lib/api/auth-api";
import { validateAffiliateCode } from "@/lib/api/affiliate-api";
import {
  clearStoredReferralCode,
  getReferralPayloadForRegister,
  getStoredReferralCode,
} from "@/lib/referral-attribution";
import { sanitizeAuthRedirect } from "@/lib/auth/auth-navigation";

type RegisterSearch = {
  redirect?: string;
  plan?: string;
};

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
  }),
  head: () => ({ meta: [{ title: "Create account — Liffio" }] }),
  component: RegisterPage,
});

const allCountries = Country.getAllCountries();

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => allCountries.find((c) => c.isoCode === value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {selected ? `${selected.flag} ${selected.name}` : "Select your country…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country…" />
          <CommandEmpty>No country found.</CommandEmpty>
          <CommandGroup className="max-h-60 overflow-y-auto">
            {allCountries.map((country) => (
              <CommandItem
                key={country.isoCode}
                value={country.name}
                onSelect={() => {
                  onChange(country.isoCode === value ? "" : country.isoCode);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === country.isoCode ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="mr-1.5">{country.flag}</span>
                {country.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function RegisterPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const mounted = useMounted();
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [pw, setPw] = useState("");
  const [cpw, setCpw] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [refValid, setRefValid] = useState<boolean | null>(null);

  const redirectTo = search.redirect ? sanitizeAuthRedirect(search.redirect) : "";
  const pendingPlanParam = search.plan?.toUpperCase() ?? null;
  const registerMutation = useRegisterMutation();

  // Store pending plan when the page loads (from marketing site link)
  useEffect(() => {
    if (pendingPlanParam) {
      localStorage.setItem("pending_plan", pendingPlanParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = useMemo(() => strength(pw), [pw]);
  const segs = [0, 1, 2, 3];
  const strengthColor =
    s <= 1 ? "bg-destructive" : s === 2 ? "bg-warning" : s === 3 ? "bg-primary" : "bg-success";

  const googleUrl = mounted
    ? googleAuthUrl(redirectTo || "/dashboard", window.location.origin)
    : "#";

  useEffect(() => {
    const stored = getStoredReferralCode();
    if (stored) setReferralCode(stored);
  }, []);

  useEffect(() => {
    const code = referralCode.trim();
    if (!code) {
      setRefValid(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await validateAffiliateCode(code);
        setRefValid(Boolean(data.valid));
      } catch {
        setRefValid(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [referralCode]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pw !== cpw) return;
    const refPayload = getReferralPayloadForRegister();
    await registerMutation.mutateAsync({
      name,
      email,
      password: pw,
      country: country || undefined,
      referralCode: referralCode.trim() || refPayload.referralCode,
      clientRef: refPayload.clientRef,
      sessionRef: refPayload.sessionRef,
      localRef: refPayload.localRef,
    });
    clearStoredReferralCode();
    void navigate({
      to: "/confirm-email",
      search: redirectTo ? { redirect: redirectTo } : {},
    });
  };

  return (
    <AuthShell maxWidth="md">
      <header className="mb-6 border-b pb-5">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Create your workspace
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Free forever · Connect Instagram in minutes · No card required
        </p>
      </header>

      <a
        href={googleUrl}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GoogleIcon />
        Continue with Google
      </a>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="rounded-full bg-card px-3 py-0.5 text-muted-foreground">or email</span>
        </div>
      </div>

      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Alex Morgan"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
              placeholder="you@brand.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Country</Label>
          <CountrySelect value={country} onChange={setCountry} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pw">Password</Label>
          <div className="relative">
            <Input
              id="pw"
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              autoComplete="new-password"
              className="pr-10"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {pw.length > 0 && (
            <div className="mt-1.5 flex gap-1">
              {segs.map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < s ? strengthColor : "bg-border"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cpw">Confirm password</Label>
          <Input
            id="cpw"
            value={cpw}
            onChange={(e) => setCpw(e.target.value)}
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
          />
          {pw !== cpw && cpw.length > 0 && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="referral">
            Referral code <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="referral"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="Friend's code"
          />
          {refValid === true && (
            <p className="text-xs text-success">Valid referral — 10% off your first payment</p>
          )}
          {refValid === false && <p className="text-xs text-destructive">Referral code not found</p>}
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
          <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
          <span>
            I agree to the <span className="text-primary">Terms of Service</span>,{" "}
            <span className="text-primary">Privacy Policy</span>, and{" "}
            <span className="text-primary">Creators Program Policy</span>
          </span>
        </label>

        {registerMutation.error && (
          <p className="text-xs text-destructive">{(registerMutation.error as Error).message}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={!agreed || pw !== cpw || pw.length < 8 || registerMutation.isPending}
        >
          {registerMutation.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          search={redirectTo ? { redirect: redirectTo } : {}}
          className="font-semibold text-brand-gradient hover:opacity-90"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
