import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout route for `/admin/users`. This is a *pathless-content* parent: it renders nothing of its
 * own beyond an `<Outlet/>`, so its children mount in place.
 *
 * Why this file exists as a bare layout: the user LIST lives in the sibling index route
 * (`admin.users.index.tsx` → `/admin/users`), NOT here. Previously the list WAS this file, which
 * made it both the `/admin/users` leaf AND the implicit parent of every `admin.users.$userId.*`
 * route — but a parent route with no `<Outlet/>` silently swallows its children. The result was
 * that navigating to `/admin/users/:userId` matched the detail route (the tab title even updated)
 * yet kept rendering the list, so the detail page "never opened". Splitting the list into an index
 * route and leaving this layout to provide the `<Outlet/>` is the canonical TanStack fix.
 *
 * The per-route `PlatformPermissionRoute` guard stays on the index and detail routes themselves;
 * this layout is an unguarded pass-through so it never double-gates or flashes an access screen.
 */
export const Route = createFileRoute("/_app/admin/users")({
  component: AdminUsersLayout,
});

function AdminUsersLayout() {
  return <Outlet />;
}
