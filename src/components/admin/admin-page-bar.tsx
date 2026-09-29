import { createContext, useContext, type ReactNode } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { NotifyDeliveryControls } from "@/components/admin/notify-delivery-controls";
import { EmbeddedPageContext } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";

/**
 * Where "Back" goes from a superadmin page.
 *
 * The URL hierarchy is the navigation hierarchy on these screens (`/packages/:id` is an item of
 * `/packages`, `/admin/users/:id/billing` a tab of `/admin/users/:id`), so a nested page goes to its
 * parent URL — predictable, and it works on a deep link opened from Slack where there is no
 * history to go back through. A top-level section (`/packages`, `/admin/users`) has no parent
 * page, so it steps back through history instead. `/admin` alone is not a route, hence the deeper
 * floor for `admin/*` paths.
 */
function parentPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const floor = segments[0] === "admin" ? 2 : 1;
  if (segments.length <= floor) return null;
  return `/${segments.slice(0, -1).join("/")}`;
}

/** "Back to packages" when the parent reads as a name; plain "Back" when it's an id. */
function backLabel(parent: string | null): string {
  const last = parent?.split("/").filter(Boolean).pop();
  if (!last || !/^[a-z][a-z-]*$/.test(last)) return "Back";
  return `Back to ${last.replace(/-/g, " ")}`;
}

function BackButton() {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const parent = parentPath(pathname);

  const goBack = () => {
    if (parent) {
      void navigate({ to: parent });
    } else if (router.history.canGoBack()) {
      router.history.back();
    } else {
      void navigate({ to: "/dashboard" });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-full bg-background px-3 text-xs"
      onClick={goBack}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {backLabel(parent)}
    </Button>
  );
}

/**
 * True once an outer guard has rendered the bar. A nested route with its own guard (the workspace
 * drill-down renders inside the user-detail shell) must not render a second one — two notify bars
 * would each reset the shared choice on mount and fight over it.
 */
const AdminPageBarRendered = createContext(false);

/** The bar, then the page — or just the page when an outer guard already drew the bar. */
export function WithAdminPageBar({
  notifyDelivery,
  children,
}: {
  notifyDelivery: boolean;
  children: ReactNode;
}) {
  const alreadyRendered = useContext(AdminPageBarRendered);
  if (alreadyRendered) return <>{children}</>;
  return (
    <AdminPageBarRendered.Provider value>
      <AdminPageBar notifyDelivery={notifyDelivery} />
      {children}
    </AdminPageBarRendered.Provider>
  );
}

/**
 * The strip above every superadmin page: a Back button, and — on pages that can change someone's
 * access — the notification-channel controls. Rendered by `PlatformPermissionRoute`, so a page
 * added later gets both without opting in.
 */
function AdminPageBar({ notifyDelivery }: { notifyDelivery: boolean }) {
  // Inside a Settings tab the tab bar is the navigation; a Back button there would leave Settings.
  const embedded = useContext(EmbeddedPageContext);
  if (embedded && !notifyDelivery) return null;

  return (
    <div className="border-b bg-muted/30 px-4 py-2 sm:px-6 md:px-10">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {!embedded && <BackButton />}
        {notifyDelivery && <NotifyDeliveryControls />}
      </div>
    </div>
  );
}
