import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { AutomationBuilder } from "@/components/automations/automation-builder";
import { automationToBuilderForm } from "@/components/automations/automation-form";
import { getAutomation } from "@/lib/api/automations-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { useApp } from "@/state/app-context";

/**
 * Edit an existing automation.
 *
 * Same builder as `/automations/new`, with the post/reel target rendered read-only: the post an
 * automation runs on is fixed once it exists, because its leads, DM jobs and analytics are all
 * attributed to the automation rather than to the post. The API enforces the same rule with a 400,
 * so this is the courtesy, not the control.
 */
export const Route = createFileRoute("/_app/automations/$automationId/edit")({
  head: () => ({ meta: [{ title: "Edit automation — Liffio" }] }),
  component: EditAutomationRoute,
});

function EditAutomationRoute() {
  return (
    <ProtectedRoute module="automation" action="update">
      <InstagramRequired feature="Automations">
        <EditAutomation />
      </InstagramRequired>
    </ProtectedRoute>
  );
}

function EditAutomation() {
  const { automationId } = Route.useParams();
  const { current } = useApp();
  const workspaceId = current.id;

  const automation = useQuery({
    queryKey: ["automation", workspaceId, automationId],
    queryFn: () => getAutomation(workspaceId, automationId),
    enabled: isWorkspaceReady(workspaceId),
    retry: false,
  });

  if (automation.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (automation.isError || !automation.data) {
    return (
      <div>
        <PageHeader
          eyebrow="Automations"
          title="Automation not found"
          description={
            automation.error instanceof Error
              ? automation.error.message
              : "It may have been deleted, or it belongs to another workspace."
          }
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/automations">
                <ArrowLeft className="h-4 w-4" /> Back to automations
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <AutomationBuilder
      // The builder seeds its state once, on mount. Keying by id makes navigating straight from
      // one automation's editor to another's remount rather than keep the first one's form.
      key={automation.data.id}
      mode="edit"
      automationId={automation.data.id}
      initialForm={automationToBuilderForm(automation.data)}
      lockTarget
    />
  );
}
