import { createFileRoute, redirect } from "@tanstack/react-router";

/** Moved into Settings → Team (plan/settings-revamp.md). */
export const Route = createFileRoute("/_app/team/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/team", replace: true });
  },
});
