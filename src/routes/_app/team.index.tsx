import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Lock,
  MailPlus,
  MailWarning,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  listTeamInvites,
  removeTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
  type TeamMember,
} from "@/lib/api/team-api";
import { apiUri } from "@/lib/api/apiUri";
import { inviteDeliveryBadge, inviteDeliveryMessage } from "@/lib/invite-delivery";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { useServerList } from "@/hooks/use-server-list";
import { useApp } from "@/state/app-context";
import { useAuthState } from "@/lib/auth/auth-store";
import { cn } from "@/lib/utils";
import { getTeamOverview, type TeamOverview, type TeamOverviewMember } from "@/lib/api/team-api";
import { TeamAccessDialog } from "@/components/team/team-access-dialog";

/** Initials for the round person avatar. People, not workspaces, so a circle is right here. */
function initialsOf(nameOrEmail: string): string {
  const parts = nameOrEmail
    .trim()
    .split(/[\s@.]+/)
    .filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

/**
 * What the Access column says. (U5, spec 5.7)
 *
 * "Everything" for the owner, "Whole group" for a whole-group grant, the workspaces by NAME for a
 * selection, and "This workspace" for a plain membership. Naming them matters: "3 workspaces" tells
 * an owner how many they granted but not which, which is the question they opened the page to ask.
 */
function accessLabel(member: TeamOverviewMember, overview: TeamOverview | null): string {
  if (member.isOwner) return "Everything";
  if (member.source !== "GROUP") return "This workspace";
  if (member.scope === "GROUP") return "Whole group";

  const names = member.selectedWorkspaceIds
    .map((id) => overview?.group?.workspaces.find((w) => w.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const count = member.selectedWorkspaceIds.length;
  const noun = count === 1 ? "workspace" : "workspaces";
  return names.length > 0 ? `${count} ${noun}: ${names.join(", ")}` : `${count} ${noun}`;
}

export const Route = createFileRoute("/_app/team/")({
  head: () => ({ meta: [{ title: "Team — Liffio" }] }),
  component: TeamRoute,
});

function TeamRoute() {
  return (
    <ProtectedRoute module="workspace">
      <TeamPage />
    </ProtectedRoute>
  );
}

const inviteStatusStyles: Record<string, string> = {
  PENDING: "border-warning/30 bg-warning/10 text-warning",
  ACCEPTED: "border-success/30 bg-success/10 text-success",
  REVOKED: "border-border bg-muted text-muted-foreground",
  EXPIRED: "border-border bg-muted text-muted-foreground",
};

function TeamPage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = useAuthState((s) => s.user?.id);
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);

  /**
   * Paged server-side. The old endpoint resolved every member's full permission set — roles,
   * grants, overrides and ABAC — for the whole workspace on every load, to render this list.
   */
  const memberList = useServerList<TeamMember>({
    path: apiUri.team.membersSearch,
    queryKey: "team-members",
    workspaceId,
    defaultSort: { key: "createdAt", dir: "asc" },
    defaultLimit: 25,
    enabled: isWorkspaceReady(workspaceId),
  });

  const invitesQuery = useQuery({
    queryKey: ["team-invites", workspaceId],
    queryFn: () => listTeamInvites(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeTeamInvite(workspaceId, inviteId),
    onSuccess: () => {
      toast.success("Invite revoked");
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => resendTeamInvite(workspaceId, inviteId),
    /**
     * A resend reports the same way an invite does, from the same field. (R3b)
     *
     * This used to say "Invite resent" whatever came back, which is the same defect the invite page
     * had: the token really was rotated, so the write succeeded, but the owner pressed the button
     * BECAUSE the email had not arrived and was told the thing they were trying to fix had worked.
     * The row's own badge, refreshed by the invalidate below, is the durable half of this answer.
     */
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
      if (result.emailSent !== false) {
        toast.success("The invite email is on its way.");
        return;
      }
      const message = inviteDeliveryMessage(result.deliveryIssue);
      toast.error(message.headline, { description: message.detail });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeTeamMember(workspaceId, userId),
    onSuccess: () => {
      toast.success("Member removed");
      setRemovingMember(null);
      // Key prefix only — the hook appends workspace and request state, so a scoped key would
      // miss every page but the first.
      void queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const members = memberList.items;
  const invites = invitesQuery.data ?? [];

  /**
   * Everything the reference's Team page renders, in one call. (U5)
   *
   * Separate from the paged member search above, which is a permissions console: it answers "who
   * holds what permission", page by page. This answers "who can open this workspace, how, and how
   * much of the plan's allowance that uses", which is a different question with a different shape.
   */
  const overviewQuery = useQuery({
    queryKey: ["team-overview", workspaceId],
    queryFn: () => getTeamOverview(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });
  const overview = overviewQuery.data ?? null;
  const teamMembers = overview?.members ?? [];
  const atLimit = Boolean(overview && overview.used >= overview.limit);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamOverviewMember | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Team"
        /*
          The count the reference shows, and it is not the length of this table: it includes the
          owner and counts a whole-group member in every workspace of the group (T3). The limit is
          the RESOLVED one, so a package or admin override is reflected rather than the plan default
          the pricing page advertises.
        */
        description={
          overview
            ? `${overview.used} of ${overview.limit} team members in this workspace${
                atLimit ? ". Limit reached" : ""
              }`
            : "Manage team members and workspace invitations."
        }
        actions={
          // Owner only (spec 2.7), and disabled at the limit rather than failing on submit.
          overview?.viewerIsOwner ? (
            <Button
              size="sm"
              disabled={atLimit}
              className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
              onClick={() => {
                // A grouped workspace invites through the agency, because the grant is a group
                // grant: scope, role and the invoice permission. A standalone one keeps the
                // existing per-workspace invite flow.
                if (overview.group) setInviteOpen(true);
                else void navigate({ to: "/team/invite" });
              }}
            >
              <MailPlus className="h-4 w-4" />
              Invite
            </Button>
          ) : null
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <Tabs defaultValue="members">
          <TabsList className="mb-4">
            <TabsTrigger value="members" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {/* The workspace total from the server, not the page length. */}
              {/*
               * The count has to be the count of the table under it. (U8)
               *
               * `memberList.total` is the old `workspace_members` page count, which excludes the
               * owner and every whole-group member, so an agency workspace showing three people
               * had a tab reading "Members (1)" directly under a header reading "3 of 15".
               * `overview.used` is the same number T3 enforces the limit against.
               */}
              Members ({overview ? overview.used : memberList.total})
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-1.5">
              <MailPlus className="h-3.5 w-3.5" />
              Invites ({invites.filter((i) => i.status === "PENDING").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            {/*
              The reference's table, not a permissions console. (U5, spec 5.7)

              Person, Role, Access, Invoices, and a pencil for the owner. The Access column is the
              one that did not exist and could not: until T1 there was no way to say "whole group"
              or "these three workspaces", because access was a row per workspace with nothing
              recording what had been granted.
            */}
            {overviewQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card shadow-soft">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                        <th className="px-5 py-3">Person</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Access</th>
                        <th className="px-4 py-3">Invoices</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => (
                        <tr key={member.userId} className="border-b last:border-0">
                          <td className="px-5 py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              {/* Round, deliberately: these are people, not workspaces. */}
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground">
                                {initialsOf(member.name ?? member.email)}
                              </span>
                              <span className="grid min-w-0 leading-tight">
                                <span className="truncate text-[13.5px] font-semibold">
                                  {member.name ?? member.email}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {member.email}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">
                              {member.isOwner ? "Owner" : member.roleName}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[12.5px] text-muted-foreground">
                            {accessLabel(member, overview)}
                          </td>
                          <td className="px-4 py-3">
                            {member.isOwner ? null : (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs",
                                  member.canDownloadInvoices
                                    ? "text-success"
                                    : "text-muted-foreground",
                                )}
                              >
                                {member.canDownloadInvoices ? (
                                  <Download aria-hidden className="size-3.5" />
                                ) : (
                                  <Lock aria-hidden className="size-3.5" />
                                )}
                                Invoices {member.canDownloadInvoices ? "on" : "off"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {/* Owner only, and only for a group grant: a standalone member's role
                                is edited through the existing member flow. */}
                            {overview?.viewerIsOwner &&
                            !member.isOwner &&
                            member.source === "GROUP" ? (
                              <button
                                type="button"
                                onClick={() => setEditingMember(member)}
                                aria-label={`Edit access for ${member.name ?? member.email}`}
                                className="grid size-[30px] place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                              >
                                <Pencil aria-hidden className="size-4" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/*
              The read-only half of spec 2.7: a member SEES the team, and is told why they cannot
              change it. Not a hidden page, and not a page whose buttons fail when pressed.
            */}
            {overview && !overview.viewerIsOwner ? (
              <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
                Only the owner can invite people or change access.
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="invites">
            {invitesQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card shadow-soft">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium hidden md:table-cell">Expires</th>
                        <th className="px-6 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-6 py-3.5 font-medium">{inv.email}</td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">
                            {inv.baseRole.name}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={inviteStatusStyles[inv.status] ?? ""}
                              >
                                {inv.status.toLowerCase()}
                              </Badge>
                              {/*
                                A pending invite whose email went nowhere, marked so the owner can
                                see it without having to remember the moment they created it. (R3b)

                                `=== false` on purpose: `null` means nothing was recorded, which is
                                every invite from before this was tracked, and those must not be
                                accused of failing.
                              */}
                              {inv.status === "PENDING" && inv.lastDeliveryOk === false && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                  title={inviteDeliveryMessage(inv.lastDeliveryIssue).headline}
                                >
                                  <MailWarning aria-hidden className="size-3" />
                                  {inviteDeliveryBadge(inv.lastDeliveryIssue)}
                                </Badge>
                              )}
                            </div>
                            {inv.status === "PENDING" && inv.lastDeliveryOk === false && (
                              <p className="mt-1 max-w-xs text-[11.5px] leading-relaxed text-muted-foreground">
                                {inviteDeliveryMessage(inv.lastDeliveryIssue).detail}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground hidden md:table-cell">
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3.5">
                            {inv.status === "PENDING" && (
                              <div className="flex items-center gap-3">
                                {/*
                                  Resend is offered on every pending invite as before, and spelled
                                  out on one whose email failed. An icon alone is a thing you notice
                                  when you already know what you are looking for. (R3b)

                                  `recipient_opted_out` gets no button: the person has turned these
                                  emails off, so every resend would fail the same way, and offering
                                  one would be busywork dressed as a fix.
                                */}
                                {inv.lastDeliveryOk === false &&
                                inviteDeliveryMessage(inv.lastDeliveryIssue).canRetry ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1.5 px-2 text-xs"
                                    disabled={resendMutation.isPending}
                                    onClick={() => resendMutation.mutate(inv.id)}
                                  >
                                    <RefreshCw
                                      aria-hidden
                                      className={`size-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`}
                                    />
                                    Resend
                                  </Button>
                                ) : inv.lastDeliveryOk === false ? null : (
                                  <button
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                                    title="Resend"
                                    disabled={resendMutation.isPending}
                                    onClick={() => resendMutation.mutate(inv.id)}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  className="text-muted-foreground hover:text-destructive"
                                  title="Revoke"
                                  onClick={() => revokeMutation.mutate(inv.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {invites.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-8 text-center text-sm text-muted-foreground"
                          >
                            No invites sent yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {overview ? (
          <TeamAccessDialog
            open={inviteOpen || Boolean(editingMember)}
            onOpenChange={(next) => {
              if (next) return;
              setInviteOpen(false);
              setEditingMember(null);
            }}
            overview={overview}
            editing={editingMember}
            workspaceId={workspaceId}
          />
        ) : null}
      </div>

      <AlertDialog
        open={Boolean(removingMember)}
        onOpenChange={(o) => !o && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removingMember?.user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this workspace immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={() => removingMember && removeMutation.mutate(removingMember.user.id)}
            >
              {removeMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
