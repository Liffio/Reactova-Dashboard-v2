import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in">
        <div className="flex flex-col items-center mb-7">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground mt-3">Sign in to your workspace</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            navigate("/dashboard");
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@brand.com" required className="bg-input border-border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} placeholder="••••••••" required className="bg-input border-border pr-10" />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full">Sign In</Button>

          <div className="text-right">
            <Link to="#" className="text-xs text-muted-foreground hover:text-primary">Forgot password?</Link>
          </div>
        </form>

        <div className="my-6 h-px bg-border" />

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
