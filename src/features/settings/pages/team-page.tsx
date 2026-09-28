import { UserAvatar } from "@/components/user-avatar";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Download,
  Loader2,
  Lock,
  MailWarning,
  MoreHorizontal,
  Pencil,
  Send,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { toast } from "@/lib/toast";

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
import {
  createTeamInvite,
  getGrantableAccess,
  listTeamInvites,
  removeTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
  type TeamMember,
  type WorkspaceInvite,
} from "@/lib/api/team-api";
import { apiUri } from "@/lib/api/apiUri";
import { inviteDeliveryBadge, inviteDeliveryMessage } from "@/lib/invite-delivery";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { useServerList } from "@/hooks/use-server-list";
import { useApp } from "@/state/app-context";
import { cn } from "@/lib/utils";
import { getTeamOverview, type TeamOverview, type TeamOverviewMember } from "@/lib/api/team-api";
import { TeamAccessDialog } from "@/components/team/team-access-dialog";
import {
  CardNote,
  IconButton,
  PlainCard,
  SelectField,
  SettingsButton,
  SettingsCard,
  SettingsPanel,
  SettingsTable,
  StatusChip,
  Td,
  TextField,
  Th,
  dayMonth,
  shortDate,
  textLinkClass,
} from "../components";

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

const INVITE_STATUS_TONE: Record<WorkspaceInvite["status"], "success" | "muted" | "warning"> = {
  PENDING: "warning",
  ACCEPTED: "success",
  REVOKED: "muted",
  EXPIRED: "muted",
};

/** Deliberately loose: the server validates the address; this only gates the button. */
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

type RemovingMember = { userId: string; name: string };

export function TeamPage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const [removingMember, setRemovingMember] = useState<RemovingMember | null>(null);

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
      void queryClient.invalidateQueries({ queryKey: ["team-overview", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

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
  // A negative limit is the catalogue's "no cap" sentinel — never "at the limit".
  const seatsUnlimited = Boolean(overview && overview.limit < 0);
  const atLimit = Boolean(overview && !seatsUnlimited && overview.used >= overview.limit);
  const seatPct =
    overview && overview.limit > 0
      ? Math.min(100, Math.round((overview.used / overview.limit) * 100))
      : 0;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamOverviewMember | null>(null);

  const canEditMember = (member: TeamOverviewMember) =>
    Boolean(overview?.viewerIsOwner) && !member.isOwner && member.source === "GROUP";
  const canRemoveMember = (member: TeamOverviewMember) =>
    Boolean(overview?.viewerIsOwner) && !member.isOwner && member.source === "MEMBER";

  return (
    <SettingsPanel>
      {/* Owner only (spec 2.7), and disabled at the limit rather than failing on submit. */}
      {overview?.viewerIsOwner ? (
        overview.group ? (
          /*
            A grouped workspace invites through the agency, because the grant is a group grant:
            scope, role and the invoice permission. The dialog carries all three.
          */
          <PlainCard className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-foreground">Invite by email</span>
              <span className="text-[13px] text-muted-foreground">
                {overview.group.name} invites through the agency, so you can choose which workspaces
                they reach.
              </span>
            </div>
            <SettingsButton
              variant="primary"
              className="h-11"
              disabled={atLimit}
              onClick={() => setInviteOpen(true)}
            >
              <Send />
              <span>Send invite</span>
            </SettingsButton>
          </PlainCard>
        ) : (
          <InviteBar workspaceId={workspaceId} atLimit={atLimit} />
        )
      ) : null}

      {/*
        The reference's table, not a permissions console. (U5, spec 5.7)

        Person, Role, Access, Invoices, and an actions menu for the owner. The Access column is the
        one that did not exist and could not: until T1 there was no way to say "whole group" or
        "these three workspaces", because access was a row per workspace with nothing recording
        what had been granted.
      */}
      <SettingsCard
        title="Members"
        /*
          The count is not the length of this table: it includes the owner and counts a whole-group
          member in every workspace of the group (T3). The limit is the RESOLVED one, so a package or
          admin override is reflected rather than the plan default the pricing page advertises.
        */
        description={
          overview
            ? seatsUnlimited
              ? `${overview.used} seats used · ∞ on this plan.`
              : `${overview.used} of ${overview.limit} seats used${atLimit ? ". Limit reached" : ""}.`
            : `${memberList.total} members in this workspace.`
        }
        actions={
          overview && overview.limit > 0 ? (
            <div className="flex w-[180px] items-center gap-2.5">
              <div className="h-1.5 flex-grow rounded-full bg-muted">
                <div
                  className={cn(
                    "h-1.5 rounded-full",
                    atLimit ? "bg-[#F5184C]" : "bg-[#160A08] dark:bg-foreground",
                  )}
                  style={{ width: `${seatPct}%` }}
                />
              </div>
              <span className="text-[13px] font-semibold text-foreground">
                {overview.used}/{overview.limit}
              </span>
            </div>
          ) : undefined
        }
      >
        {overviewQuery.isLoading ? (
          <CardNote>Loading members…</CardNote>
        ) : overviewQuery.error ? (
          <CardNote tone="danger">{(overviewQuery.error as Error).message}</CardNote>
        ) : (
          <SettingsTable>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Access</Th>
                <Th>Invoices</Th>
                <Th className="w-[50px]" />
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => {
                const label = member.name ?? member.email;
                const editable = canEditMember(member);
                const removable = canRemoveMember(member);
                return (
                  <tr key={member.userId}>
                    <Td>
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          userId={member.userId}
                          name={label}
                          avatarUrl={member.avatarUrl}
                          size={34}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold">{label}</span>
                          <span className="truncate text-[13px] text-muted-foreground">
                            {member.email}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {member.isOwner ? (
                        <StatusChip tone="brand">Owner</StatusChip>
                      ) : editable ? (
                        <button
                          type="button"
                          onClick={() => setEditingMember(member)}
                          aria-label={`Change role for ${label}`}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border border-border bg-transparent px-2.5 font-sans text-[13px] font-medium text-foreground hover:bg-muted"
                        >
                          {member.roleName}
                          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
                        </button>
                      ) : (
                        <span className="inline-flex h-8 items-center rounded-[8px] border border-border px-2.5 text-[13px] font-medium">
                          {member.roleName}
                        </span>
                      )}
                    </Td>
                    <Td className="text-[13px] text-muted-foreground">
                      {accessLabel(member, overview)}
                    </Td>
                    <Td>
                      {member.isOwner ? null : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 whitespace-nowrap text-[13px]",
                            member.canDownloadInvoices ? "text-success" : "text-muted-foreground",
                          )}
                        >
                          {member.canDownloadInvoices ? (
                            <Download aria-hidden className="size-3.5" />
                          ) : (
                            <Lock aria-hidden className="size-3.5" />
                          )}
                          {member.canDownloadInvoices ? "On" : "Off"}
                        </span>
                      )}
                    </Td>
                    <Td className="w-[50px]">
                      {editable || removable ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton label={`Actions for ${label}`}>
                              <MoreHorizontal />
                            </IconButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {editable && (
                              <DropdownMenuItem onSelect={() => setEditingMember(member)}>
                                <Pencil className="mr-2 size-4" /> Edit access
                              </DropdownMenuItem>
                            )}
                            {removable && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() =>
                                  setRemovingMember({ userId: member.userId, name: label })
                                }
                              >
                                <UserMinus className="mr-2 size-4" /> Remove from workspace
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </SettingsTable>
        )}
      </SettingsCard>

      {/*
        The read-only half of spec 2.7: a member SEES the team, and is told why they cannot change
        it. Not a hidden page, and not a page whose buttons fail when pressed.
      */}
      {overview && !overview.viewerIsOwner ? (
        <div className="-mt-2.5 flex items-center gap-2 text-[13px] text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
          Only the owner can invite people or change access.
        </div>
      ) : null}

      <SettingsCard
        title="Pending invites"
        description="Each invite link stops working after its expiry date."
      >
        {invitesQuery.isLoading ? (
          <CardNote>Loading invites…</CardNote>
        ) : invitesQuery.error ? (
          <CardNote tone="danger">{(invitesQuery.error as Error).message}</CardNote>
        ) : invites.length === 0 ? (
          <CardNote>No invites sent yet.</CardNote>
        ) : (
          <SettingsTable>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Sent</Th>
                <Th>Delivery</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const pending = inv.status === "PENDING";
                const failed = pending && inv.lastDeliveryOk === false;
                const delivery = failed ? inviteDeliveryMessage(inv.lastDeliveryIssue) : null;
                return (
                  <tr key={inv.id}>
                    <Td className="font-semibold">{inv.email}</Td>
                    <Td>{inv.baseRole.name}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      <span title={`Expires ${shortDate(inv.expiresAt)}`}>
                        {dayMonth(inv.createdAt)}
                      </span>
                    </Td>
                    <Td>
                      {/*
                        `=== false` on purpose: `null` means nothing was recorded, which is every
                        invite from before this was tracked, and those must not be accused of
                        failing. (R3b)
                      */}
                      {failed ? (
                        <div className="flex flex-col gap-1">
                          <StatusChip tone="danger" icon={<MailWarning />} className="self-start">
                            {inviteDeliveryBadge(inv.lastDeliveryIssue)}
                          </StatusChip>
                          <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                            {delivery?.detail}
                          </span>
                        </div>
                      ) : pending && inv.lastDeliveryOk === true ? (
                        <StatusChip tone="success" icon={<Check />}>
                          Delivered
                        </StatusChip>
                      ) : pending ? (
                        <StatusChip tone="warning">Pending</StatusChip>
                      ) : (
                        <StatusChip tone={INVITE_STATUS_TONE[inv.status]}>
                          {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                        </StatusChip>
                      )}
                    </Td>
                    <Td>
                      {pending && (
                        <div className="flex justify-end gap-1.5">
                          {/*
                            `recipient_opted_out` gets no button: the person has turned these emails
                            off, so every resend would fail the same way. (R3b)
                          */}
                          {!failed || delivery?.canRetry ? (
                            <SettingsButton
                              variant="ghost"
                              disabled={resendMutation.isPending}
                              onClick={() => resendMutation.mutate(inv.id)}
                            >
                              {resendMutation.isPending && resendMutation.variables === inv.id ? (
                                <Loader2 className="animate-spin" />
                              ) : null}
                              <span>Resend</span>
                            </SettingsButton>
                          ) : null}
                          <SettingsButton
                            variant="ghost"
                            disabled={revokeMutation.isPending}
                            onClick={() => revokeMutation.mutate(inv.id)}
                          >
                            <span>Revoke</span>
                          </SettingsButton>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </SettingsTable>
        )}
      </SettingsCard>

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

      <AlertDialog
        open={Boolean(removingMember)}
        onOpenChange={(o) => !o && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removingMember?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this workspace immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={() => removingMember && removeMutation.mutate(removingMember.userId)}
            >
              {removeMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPanel>
  );
}

/**
 * The reference's inline invite bar, for a standalone workspace. Roles come from the server's
 * grantable list (what THIS inviter may confer) — never a client-side list. Custom per-permission
 * access still lives on the full invite page, linked below the bar.
 */
function InviteBar({ workspaceId, atLimit }: { workspaceId: string; atLimit: boolean }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("");

  const grantableQuery = useQuery({
    queryKey: ["team-grantable", workspaceId],
    queryFn: () => getGrantableAccess(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });
  const roles = useMemo(() => grantableQuery.data?.roles ?? [], [grantableQuery.data]);
  const seats = grantableQuery.data?.seats;
  const seatFull =
    atLimit ||
    (seats?.remaining !== null && seats?.remaining !== undefined && seats.remaining <= 0);

  useEffect(() => {
    if (!roleKey && roles.length > 0) setRoleKey(roles[0].key);
  }, [roles, roleKey]);

  const invite = useMutation({
    mutationFn: () =>
      createTeamInvite(workspaceId, {
        email: email.trim(),
        roleKey,
        customizeAccess: false,
        moduleAccess: [],
        permissionKeys: [],
        policyKeys: [],
        expiresInDays: 7,
      }),
    /** The invite existing and the email arriving are two different events. (R3b) */
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["team-grantable", workspaceId] });
      const invitedEmail = created.email || email.trim();
      setEmail("");
      if (created.emailSent !== false) {
        toast.success(`Invite created. The email is on its way to ${invitedEmail}.`);
        return;
      }
      const message = inviteDeliveryMessage(created.deliveryIssue);
      toast.error(message.headline, { description: message.detail });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSend = looksLikeEmail(email) && Boolean(roleKey) && !seatFull && !invite.isPending;

  return (
    <PlainCard className="flex flex-col gap-3 px-6 py-5">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) invite.mutate();
        }}
      >
        <div className="flex flex-grow flex-col gap-2">
          <label htmlFor="inv-email" className="text-[13px] font-semibold text-foreground">
            Invite by email
          </label>
          <TextField
            id="inv-email"
            type="email"
            autoComplete="off"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:w-[180px]">
          <label htmlFor="inv-role" className="text-[13px] font-semibold text-foreground">
            Role
          </label>
          <SelectField
            id="inv-role"
            value={roleKey}
            disabled={roles.length === 0}
            onChange={(e) => setRoleKey(e.target.value)}
          >
            {roles.length === 0 && <option value="">Loading…</option>}
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </SelectField>
        </div>
        <SettingsButton type="submit" variant="primary" className="h-11" disabled={!canSend}>
          {invite.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          <span>Send invite</span>
        </SettingsButton>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
        <span>
          {seatFull
            ? "Every seat on this plan is taken. Remove someone or upgrade to invite more."
            : "They get the role's default access."}
        </span>
        <Link to="/team/invite" className={textLinkClass}>
          Customize access
        </Link>
      </div>
    </PlainCard>
  );
}
