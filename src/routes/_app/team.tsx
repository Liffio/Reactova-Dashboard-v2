import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, MoreHorizontal, Search, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createTeamInvite,
  getTeamOptions,
  listTeamInvites,
  removeTeamMember,
  revokeTeamInvite,
  type TeamMember,
} from "@/lib/api/team-api";
import { apiUri } from "@/lib/api/apiUri";
import { useServerList } from "@/hooks/use-server-list";
import { useApp } from "@/state/app-context";
import { useAuthState } from "@/lib/auth/auth-store";
import { LIMITS, emailError, duplicateAliasError } from "@/lib/validation";

export const Route = createFileRoute("/_app/team")({
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
  const queryClient = useQueryClient();
  const currentUserId = useAuthState((s) => s.user?.id);
  const [inviteOpen, setInviteOpen] = useState(false);
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
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const invitesQuery = useQuery({
    queryKey: ["team-invites", workspaceId],
    queryFn: () => listTeamInvites(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const optionsQuery = useQuery({
    queryKey: ["team-options", workspaceId],
    queryFn: () => getTeamOptions(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeTeamInvite(workspaceId, inviteId),
    onSuccess: () => {
      toast.success("Invite revoked");
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
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

  const inviteMutation = useMutation({
    mutationFn: (email: string) =>
      createTeamInvite(workspaceId, {
        email,
        roleKey: optionsQuery.data?.roles[0]?.key ?? "MEMBER",
        moduleAccess: [],
        permissionKeys: [],
        policyKeys: [],
        expiresInDays: 7,
      }),
    onSuccess: () => {
      toast.success("Invite sent");
      setInviteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const members = memberList.items;
  const invites = invitesQuery.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Team"
        description="Manage team members and workspace invitations."
        actions={
          <Button
            size="sm"
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            onClick={() => setInviteOpen(true)}
          >
            <MailPlus className="h-4 w-4" />
            Invite member
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <Tabs defaultValue="members">
          <TabsList className="mb-4">
            <TabsTrigger value="members" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {/* The workspace total from the server, not the page length. */}
              Members ({memberList.total})
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-1.5">
              <MailPlus className="h-3.5 w-3.5" />
              Invites ({invites.filter((i) => i.status === "PENDING").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <div className="relative mb-4 w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search members by name or email…"
                value={memberList.search}
                onChange={(e) => memberList.setSearch(e.target.value)}
              />
            </div>

            {memberList.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card shadow-soft">
                <div className="divide-y">
                  {members.map((member) => {
                    const name = member.user.name;
                    const initials = name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    const isSelf = member.user.id === currentUserId;
                    return (
                      <div key={member.user.id} className="flex items-center gap-4 px-6 py-4">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-brand-gradient text-sm font-semibold text-primary-foreground">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{name}</p>
                            {isSelf && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                You
                              </span>
                            )}
                            {member.immutableSuperAdmin && (
                              <Badge variant="outline" className="text-[10px]">
                                Owner
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.user.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {member.role.name}
                        </Badge>
                        {!isSelf && !member.immutableSuperAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-md p-1 hover:bg-muted">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="cursor-pointer text-destructive focus:text-destructive"
                                onClick={() => setRemovingMember(member)}
                              >
                                <UserMinus className="mr-2 h-4 w-4" /> Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })}
                  {members.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      {memberList.isNarrowed
                        ? "No members match that search."
                        : "No team members yet."}
                    </div>
                  )}
                </div>
              </div>
            )}

            {memberList.total > 0 && (
              <div className="mt-4">
                <PaginationBar
                  page={memberList.page}
                  pages={memberList.pages}
                  total={memberList.total}
                  limit={memberList.limit}
                  onPageChange={memberList.setPage}
                  label="members"
                />
              </div>
            )}
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
                            <Badge
                              variant="outline"
                              className={inviteStatusStyles[inv.status] ?? ""}
                            >
                              {inv.status.toLowerCase()}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground hidden md:table-cell">
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3.5">
                            {inv.status === "PENDING" && (
                              <button
                                className="text-muted-foreground hover:text-destructive"
                                title="Revoke"
                                onClick={() => revokeMutation.mutate(inv.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        isPending={inviteMutation.isPending}
        onSubmit={(email) => inviteMutation.mutate(email)}
        existingEmails={[
          ...members.map((m) => m.user.email),
          ...invites.filter((i) => i.status === "PENDING").map((i) => i.email),
        ]}
      />

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

function InviteDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
  existingEmails = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (email: string) => void;
  existingEmails?: string[];
}) {
  const [email, setEmail] = useState("");
  const error = email ? emailError(email) || duplicateAliasError(email, existingEmails) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    onSubmit(email.trim());
    setEmail("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, LIMITS.email.max))}
              maxLength={LIMITS.email.max}
              aria-invalid={Boolean(error)}
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || Boolean(error)}>
              {isPending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
