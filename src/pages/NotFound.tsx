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
    <AuthShell maxWidth="sm">
      <header className="mb-6 border-b border-border/60 pb-5">
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">404</p>
        <h1 className="mt-2 text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          This URL does not exist or may have been moved.
        </p>
      </header>
      <Button asChild className="w-full h-10">
        <Link to="/dashboard">Return to dashboard</Link>
      </Button>
    </AuthShell>
  );
};

export default NotFound;
