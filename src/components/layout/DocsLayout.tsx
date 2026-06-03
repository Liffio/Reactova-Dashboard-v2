import { Link, Outlet, useLocation } from "react-router-dom";
import { BookOpen, ExternalLink, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppShellBackdrop } from "@/components/layout/AppShellBackdrop";

const nav = [
  { href: "/docs/api", label: "Overview" },
  { href: "/docs/api#authentication", label: "Authentication" },
  { href: "/docs/api#rate-limits", label: "Rate limits" },
  { href: "/docs/api#schedule-post", label: "Schedule post" },
  { href: "/docs/api#create-automation", label: "Create automation" },
  { href: "/docs/api#errors", label: "Errors" }
];

export function DocsLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <AppShellBackdrop />
      <header className="sticky top-0 z-40 glass-header">
        <div className="container h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-md hover:bg-muted/50"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/docs/api" className="flex items-center gap-2 font-semibold text-primary">
              <BookOpen className="h-5 w-5" />
              Liffio API
            </Link>
            <span className="hidden sm:inline glass-pill text-xs text-muted-foreground px-2 py-0.5">
              v1
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="glass-pill border-0" />
            <a
              href="/settings?tab=API"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Manage keys <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a href="/login" className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Sign in
            </a>
          </div>
        </div>
      </header>

      <div className="relative z-10 container flex-1 flex gap-8 py-8">
        <aside
          className={cn(
            "lg:block w-56 shrink-0",
            mobileOpen ? "block fixed inset-0 top-14 z-30 glass-sidebar p-4 border-r" : "hidden"
          )}
        >
          <nav className="space-y-1 sticky top-24">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-lg text-sm transition-colors",
                  location.pathname === item.href.split("#")[0]
                    ? "bg-primary/10 text-primary font-medium border border-primary/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 max-w-3xl mx-auto lg:mx-0">
          <div className="glass-surface rounded-xl p-6 sm:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <footer className="relative z-10 glass-header mt-auto">
        <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Liffio. API documentation.</span>
          <div className="flex gap-4">
            <a href="https://liffio.com" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
              liffio.com
            </a>
            <a href="/settings?tab=API" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">
              API credentials
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
