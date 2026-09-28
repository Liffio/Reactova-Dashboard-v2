import { createFileRoute, redirect } from "@tanstack/react-router";

/** Moved into Settings → Developer (plan/settings-revamp.md). */
export const Route = createFileRoute("/_app/api-docs")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/developer", replace: true });
  },
});
