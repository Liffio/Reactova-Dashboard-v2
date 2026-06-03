import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AuthShell maxWidth="sm" variant="default">
      <header className="auth-form-header mb-6 pb-5 text-center">
        <p className="auth-ig-gradient-text text-4xl font-bold tabular-nums tracking-tight">404</p>
        <h1 className="mt-3 text-xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This URL does not exist or may have been moved.
        </p>
      </header>
      <Button asChild className="w-full h-11 rounded-xl">
        <Link to="/dashboard">Return to dashboard</Link>
      </Button>
    </AuthShell>
  );
};

export default NotFound;
