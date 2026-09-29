import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The authenticated shell — sidebar, top bar, page — drawn as a skeleton.
 *
 * ## Why this exists
 *
 * `ProtectedRoute` wraps the whole `_app` layout, and it has to hold while it can't yet answer
 * "may this session see the app?": before the client mounts (the SSR pass renders signed-out),
 * while `auth/me` is in flight, and while the onboarding check resolves. It used to hold with a
 * content-only skeleton, so on every page load the sidebar and top bar vanished and then snapped
 * back in — the layout itself appeared to load, not just the page.
 *
 * So the hold renders the shell's own frame. The real `AppSidebar` / `TopBar` can't be used here:
 * they read the session and workspace, which is exactly what isn't ready yet. Instead this mirrors
 * their geometry — `SidebarProvider` always starts expanded (16rem, hidden below `md`), the top bar
 * is 60px, phones get the bottom tab bar — so the swap to the real shell moves nothing.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <SidebarSkeleton />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBarSkeleton />
        <main className="flex flex-1 flex-col pb-[92px] md:pb-0">
          <PageSkeleton />
        </main>
      </div>
      <MobileTabBarSkeleton />
    </div>
  );
}

/** Rows per group — roughly the shape of a typical tenant sidebar, so the real one lands close. */
const SIDEBAR_GROUPS = [5, 4, 3];

function SidebarSkeleton() {
  return (
    <div className="hidden md:block" aria-hidden>
      {/* The gap the real sidebar reserves in the flex row, then the fixed panel itself. */}
      <div className="w-64" />
      <div className="fixed inset-y-0 left-0 z-10 flex h-svh w-64 flex-col border-r bg-sidebar">
        <div className="px-3 py-4">
          <Logo size="sm" />
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-hidden px-2 pt-1">
          {SIDEBAR_GROUPS.map((rows, g) => (
            <div key={g} className="space-y-1">
              <Skeleton className="mx-2 mb-2 h-2.5 w-16" />
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex h-8 items-center gap-2 px-2">
                  <Skeleton className="h-4 w-4 shrink-0 rounded" />
                  <Skeleton
                    className="h-3 rounded"
                    style={{ width: `${55 + ((g + i) % 3) * 12}%` }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="p-3">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function TopBarSkeleton() {
  return (
    <header
      aria-hidden
      style={{ top: "var(--liffio-imp-banner-h, 0px)" }}
      className="sticky z-20 flex h-[60px] items-center gap-3 border-b bg-topbar px-4 backdrop-blur-md md:px-6"
    >
      <Skeleton className="hidden h-7 w-7 rounded-md md:block" />
      <div className="hidden h-5 w-px bg-border md:block" />
      <Skeleton className="h-4 w-32 rounded" />
      <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
        <Skeleton className="h-9 w-full max-w-md rounded-lg" />
      </div>
      <div className="min-w-0 flex-1 md:hidden" />
      <div className="ml-auto flex items-center gap-2">
        <Skeleton className="hidden h-9 w-9 rounded-full md:block" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full sm:w-36" />
      </div>
    </header>
  );
}

/** The generic page body — header band plus a card grid, like most pages open with. */
export function PageSkeleton() {
  return (
    <div aria-hidden>
      <div className="border-b px-6 py-7 md:px-10">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="mt-3 h-8 w-56 rounded-lg" />
        <Skeleton className="mt-3 h-4 w-full max-w-md rounded" />
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-6 md:p-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function MobileTabBarSkeleton() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t bg-topbar md:hidden"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-2 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}
