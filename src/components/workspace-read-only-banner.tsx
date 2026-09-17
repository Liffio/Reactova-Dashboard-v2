import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApp } from "@/state/app-context";
import { getSwitcher } from "@/lib/api/workspace-switcher-api";

/**
 * The banner an expired workspace shows above every page.
 *
 * Reads the same `["workspace-switcher"]` query the switcher does, so on any page where the
 * switcher has already loaded this costs nothing — and `readOnly` cannot disagree between the
 * banner and the chip in the sidebar, which would be the obvious way for this to look broken.
 *
 * Renders nothing at all when the workspace is fine. A banner slot that is always present but
 * usually empty pushes the page down by a few pixels for every customer to serve the few whose
 * plan has lapsed.
 */
export function WorkspaceReadOnlyBanner() {
  const { current } = useApp();

  const { data } = useQuery({ queryKey: ["workspace-switcher"], queryFn: getSwitcher });

  const row =
    data?.workspaces.find((w) => w.id === current.id) ??
    data?.groups.flatMap((g) => g.workspaces).find((w) => w.id === current.id) ??
    null;

  if (!row?.readOnly) return null;

  const group = data?.groups.find((g) => g.workspaces.some((w) => w.id === current.id)) ?? null;
  const when = row.expiredAt
    ? new Date(row.expiredAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div
      role="status"
      // Its own spacing, because the mount point renders it unwrapped. Returning null then costs
      // the page nothing at all.
      className="mx-4 mb-1 mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/10 px-3.5 py-3 text-destructive md:mx-6"
    >
      <Lock aria-hidden className="size-4 shrink-0" />
      <p className="m-0 min-w-[220px] flex-1 text-sm">
        <b>
          {group ? `${group.name}'s plan expired` : "Plan expired"}
          {when ? ` on ${when}` : ""}.
        </b>{" "}
        {group
          ? "Every workspace in this agency is read-only. Automations are paused and you can't create anything new until it's renewed."
          : "This workspace is read-only. Automations are paused and you can't create anything new until you renew."}
      </p>
      <Button asChild size="sm" variant="destructive" className="shrink-0">
        <Link to="/billings">
          <RefreshCw aria-hidden className="size-4" />
          Renew to resume
        </Link>
      </Button>
    </div>
  );
}
