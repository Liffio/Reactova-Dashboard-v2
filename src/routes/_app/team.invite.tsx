import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MailPlus } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InviteAccessMatrix } from "@/components/team/invite-access-matrix";
import { getGrantableAccess, createTeamInvite } from "@/lib/api/team-api";
import { useApp } from "@/state/app-context";
import { LIMITS, emailError } from "@/lib/validation";

export const Route = createFileRoute("/_app/team/invite")({
  head: () => ({ meta: [{ title: "Invite member — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="workspace">
      <InvitePage />
    </ProtectedRoute>
  ),
});

function InvitePage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const grantableQuery = useQuery({
    queryKey: ["team-grantable", workspaceId],
    queryFn: () => getGrantableAccess(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<string>("");
  const [customize, setCustomize] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());

  const grantable = grantableQuery.data;
  const roles = grantable?.roles ?? [];

  // Default to the first assignable role once loaded.
  useEffect(() => {
    if (!roleKey && roles.length > 0) setRoleKey(roles[0].key);
  }, [roles, roleKey]);

  const roleGrantKeys = useMemo(
    () => new Set(roles.find((r) => r.key === roleKey)?.grantKeys ?? []),
    [roles, roleKey]
  );

  // Whenever the role changes or customization is switched on, seed the matrix from the role's grants
  // so the deltas are visibly deltas.
  useEffect(() => {
    if (customize) {
      setSelected(new Set(roleGrantKeys));
      setSelectedPolicies(new Set());
    }
  }, [customize, roleGrantKeys]);

  const toggle = (key: string, next: boolean) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(key);
      else s.delete(key);
      return s;
    });

  const togglePolicy = (key: string, next: boolean) =>
    setSelectedPolicies((prev) => {
      const s = new Set(prev);
      if (next) s.add(key);
      else s.delete(key);
      return s;
    });

  const inviteMutation = useMutation({
    mutationFn: () =>
      createTeamInvite(workspaceId, {
        email: email.trim(),
        roleKey,
        customizeAccess: customize,
        moduleAccess: [],
        permissionKeys: customize ? [...selected] : [],
        policyKeys: customize ? [...selectedPolicies] : [],
        expiresInDays: 7,
      }),
    onSuccess: () => {
      toast.success("Invite sent");
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
      void navigate({ to: "/team" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const error = email ? emailError(email) : null;
  const seats = grantable?.seats;
  const seatFull = seats?.remaining !== null && seats?.remaining !== undefined && seats.remaining <= 0;

  return (
    <TooltipProvider>
      <div>
        <PageHeader
          eyebrow="Team"
          title="Invite member"
          description="Choose a role and, if you like, the exact access this person will have."
          actions={
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void navigate({ to: "/team" })}>
              <ArrowLeft className="h-4 w-4" />
              Back to team
            </Button>
          }
        />

        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 md:p-10">
          {grantableQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {seats && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    seatFull ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {seats.limit === null
                    ? `${seats.members} member(s), ${seats.pendingInvites} pending invite(s) — unlimited seats.`
                    : `${seats.members} of ${seats.limit} seats used, ${seats.pendingInvites} pending invite(s). ${
                        seatFull ? "No seats remaining — accepting will be blocked." : `${seats.remaining} left.`
                      }`}
                </div>
              )}

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
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={roleKey} onValueChange={setRoleKey}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Customize access</p>
                  <p className="text-xs text-muted-foreground">
                    Start from the role's access, then add or remove specific permissions.
                  </p>
                </div>
                <Switch checked={customize} onCheckedChange={setCustomize} />
              </div>

              {customize && grantable && (
                <InviteAccessMatrix
                  grantable={grantable}
                  roleGrantKeys={roleGrantKeys}
                  selected={selected}
                  selectedPolicies={selectedPolicies}
                  onToggle={toggle}
                  onTogglePolicy={togglePolicy}
                />
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => void navigate({ to: "/team" })}>
                  Cancel
                </Button>
                <Button
                  className="gap-1.5"
                  disabled={!email || Boolean(error) || !roleKey || inviteMutation.isPending}
                  onClick={() => inviteMutation.mutate()}
                >
                  <MailPlus className="h-4 w-4" />
                  {inviteMutation.isPending ? "Sending…" : "Send invite"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
