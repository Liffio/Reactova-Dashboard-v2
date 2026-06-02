import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import { Country } from "country-state-city";
import { Logo } from "@/components/Logo";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useRegisterMutation } from "@/hooks/useAuth";
import {
  clearStoredReferralCode,
  getReferralPayloadForRegister,
  getStoredReferralCode
} from "@/lib/referralAttribution";
import { API_BASE } from "@/lib/api";
import { loginPathWithRedirect, sanitizeAuthRedirect } from "@/lib/authNavigation";

const allCountries = Country.getAllCountries();

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

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
            "flex w-full items-center justify-between rounded-md border border-input bg-input px-3 py-2 text-sm ring-offset-background",
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
                <Check className={cn("mr-2 h-4 w-4", value === country.isoCode ? "opacity-100" : "opacity-0")} />
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

export default function Register() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [cpw, setCpw] = useState("");
  const [pw, setPw] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [refValid, setRefValid] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const redirectTo = redirectParam ? sanitizeAuthRedirect(redirectParam) : "";
  const pendingPlanParam = searchParams.get("plan")?.toUpperCase() ?? null;
  const registerMutation = useRegisterMutation();
  const loginTo = redirectTo ? loginPathWithRedirect(redirectTo) : "/login";

  // Store pending plan when the page loads (from marketing site link)
  useEffect(() => {
    if (pendingPlanParam) {
      localStorage.setItem("pending_plan", pendingPlanParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const s = useMemo(() => strength(pw), [pw]);
  const segs = [0, 1, 2, 3];
  const strengthColor = s <= 1 ? "bg-destructive" : s === 2 ? "bg-warning" : s === 3 ? "bg-info" : "bg-success";

  const googleUrl = `${API_BASE}/api/v1/auth/google?redirect=${encodeURIComponent(redirectTo || "/dashboard")}&fe=${encodeURIComponent(window.location.origin)}`;

  useEffect(() => {
    const stored = getStoredReferralCode();
    if (stored) setReferralCode(stored);
  }, []);

  useEffect(() => {
    const code = referralCode.trim();
    if (!code) { setRefValid(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/affiliate/validate-code/${encodeURIComponent(code)}`);
        const data = (await res.json()) as { valid?: boolean };
        setRefValid(Boolean(data.valid));
      } catch {
        setRefValid(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [referralCode]);

  return (
    <AuthShell maxWidth="md">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <Logo size="lg" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-1">Free forever. No credit card required.</p>
      </div>

      {/* Google Sign Up */}
      <a
        href={googleUrl}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-muted/50 hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GoogleIcon />
        Continue with Google
      </a>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-3 text-muted-foreground">or register with email</span>
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
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
            localRef: refPayload.localRef
          });
          clearStoredReferralCode();
          const confirmEmail = redirectTo
            ? `/confirm-email?redirect=${encodeURIComponent(redirectTo)}`
            : "/confirm-email";
          navigate(confirmEmail);
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="bg-input border-border"
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
              className="bg-input border-border"
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
              className="bg-input border-border pr-10"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {pw.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {segs.map((i) => (
                <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < s ? strengthColor : "bg-border")} />
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
            className="bg-input border-border"
          />
          {pw !== cpw && cpw.length > 0 && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="referral">Referral code <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="referral"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            className="bg-input border-border"
            placeholder="Friend's code"
          />
          {refValid === true && <p className="text-xs text-success">Valid referral — 10% off your first payment</p>}
          {refValid === false && <p className="text-xs text-destructive">Referral code not found</p>}
        </div>

        <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
          <span>
            I agree to the{" "}
            <Link to="#" className="text-primary hover:underline">Terms of Service</Link>,{" "}
            <Link to="#" className="text-primary hover:underline">Privacy Policy</Link>, and{" "}
            <Link to="#" className="text-primary hover:underline">Creators Program Policy</Link>
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to={loginTo} className="text-primary font-medium hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
