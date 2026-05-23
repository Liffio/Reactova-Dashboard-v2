import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useRegisterMutation } from "@/hooks/useAuth";
import {
  clearStoredReferralCode,
  getReferralPayloadForRegister,
  getStoredReferralCode
} from "@/lib/referralAttribution";
import { API_BASE } from "@/lib/api";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0..4
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
  const registerMutation = useRegisterMutation();
  const s = useMemo(() => strength(pw), [pw]);
  const segs = [0, 1, 2, 3];
  const color = s <= 1 ? "bg-destructive" : s === 2 ? "bg-warning" : s === 3 ? "bg-info" : "bg-success";

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
        const res = await fetch(
          `${API_BASE}/api/v1/affiliate/validate-code/${encodeURIComponent(code)}`
        );
        const data = (await res.json()) as { valid?: boolean };
        setRefValid(Boolean(data.valid));
      } catch {
        setRefValid(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [referralCode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <ThemeToggle className="fixed top-4 right-4 p-2 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-card transition-colors z-20" />
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground mt-3">Create your free account</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw !== cpw) {
              return;
            }
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
            navigate("/onboarding");
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-input border-border"
              placeholder="Alex Morgan"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="bg-input border-border"
              placeholder="you@brand.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referral">Referral code (optional)</Label>
            <Input
              id="referral"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="bg-input border-border"
              placeholder="Friend's code"
            />
            {refValid === true && (
              <p className="text-xs text-success">Valid referral — 10% off your first payment</p>
            )}
            {refValid === false && (
              <p className="text-xs text-destructive">Referral code not found</p>
            )}
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
            <div className="flex gap-1 mt-1.5">
              {segs.map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < s ? color : "bg-border"
                  )}
                />
              ))}
            </div>
          </div>
            <div className="space-y-1.5">
            <Label htmlFor="cpw">Confirm Password</Label>
            <Input
              id="cpw"
              value={cpw}
              onChange={(e) => setCpw(e.target.value)}
              type={show ? "text" : "password"}
              required
              className="bg-input border-border"
            />
            </div>
            <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className="bg-input border-border"
              placeholder="United States"
            />
            </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
            <span>
              I agree to the{" "}
              <Link to="#" className="text-primary hover:underline">Terms of Service</Link>,{" "}
              <Link to="#" className="text-primary hover:underline">Privacy Policy</Link>, and{" "}
              <Link to="#" className="text-primary hover:underline">Creators Program Policy</Link>
            </span>
          </label>

          {pw !== cpw && cpw.length > 0 && <p className="text-xs text-destructive">Passwords do not match</p>}
          {registerMutation.error && (
            <p className="text-xs text-destructive">{(registerMutation.error as Error).message}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!agreed || pw !== cpw || registerMutation.isPending}
          >
            {registerMutation.isPending ? "Creating..." : "Create Account"}
          </Button>
        </form>

        <div className="my-6 h-px bg-border" />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
