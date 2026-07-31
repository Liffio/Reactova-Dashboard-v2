import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Lock, Search, ShieldAlert, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuthState } from "@/lib/auth/auth-store";
import { useDebounced } from "@/hooks/use-debounced";
import {
  getPlatformPermissionCatalogue,
  grantPlatformAdmin,
  listPlatformAdmins,
  lookupPlatformUsers,
  revokePlatformAdmin,
  updatePlatformAdminScope,
  type PlatformAdmin,
  type PlatformPermissionMeta,
  type PlatformUserSuggestion,
} from "@/lib/api/platform-api";

const ADMIN_MANAGE = "platform:admin_manage";
const ADMINS_QUERY_KEY = "platform-admins";

export const Route = createFileRoute("/_app/platform-admins")({
  head: () => ({ meta: [{ title: "Platform Admins — Admin" }] }),
  component: PlatformAdminsRoute,
});

function PlatformAdminsRoute() {
  return (
    <PlatformPermissionRoute permission={ADMIN_MANAGE}>
      <PlatformAdminsPage />
    </PlatformPermissionRoute>
  );
}

function PlatformAdminsPage() {
  const queryClient = useQueryClient();
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [search, setSearch] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformAdmin | null>(null);
  const [revoking, setRevoking] = useState<PlatformAdmin | null>(null);

  // Search runs server-side; the client never filters a fetched array.
  const debouncedSearch = useDebounced(search);
  const adminsQuery = useQuery({
    queryKey: [ADMINS_QUERY_KEY, includeRevoked, debouncedSearch],
    queryFn: () => listPlatformAdmins(includeRevoked, debouncedSearch || undefined),
    placeholderData: keepPreviousData,
  });

  const catalogueQuery = useQuery({
    queryKey: ["platform-permission-catalogue"],
    queryFn: getPlatformPermissionCatalogue,
    staleTime: Infinity,
  });

  const catalogue = catalogueQuery.data?.permissions ?? [];
  const refresh = () => void queryClient.invalidateQueries({ queryKey: [ADMINS_QUERY_KEY] });

  const items = adminsQuery.data?.items ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Platform Admins"
        description="Everyone with platform-level access, and exactly what each of them can do."
        actions={
          <Button
            size="sm"
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            onClick={() => setGrantOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Grant access
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 md:p-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by email or name…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={includeRevoked} onCheckedChange={setIncludeRevoked} />
            Show revoked
          </label>
        </div>

        {adminsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No platform admins match this view.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((admin) => (
              <AdminCard
                key={admin.userId}
                admin={admin}
                catalogue={catalogue}
                onEdit={() => setEditing(admin)}
                onRevoke={() => setRevoking(admin)}
              />
            ))}
          </div>
        )}
      </div>

      <GrantDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        catalogue={catalogue}
        onSuccess={refresh}
      />
      <EditScopeDialog
        admin={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        catalogue={catalogue}
        onSuccess={refresh}
      />
      <RevokeDialog
        admin={revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        onSuccess={refresh}
      />
    </div>
  );
}

const SOURCE_BADGE: Record<
  PlatformAdmin["source"],
  { label: string; className: string; hint: string }
> = {
  env: {
    label: "Environment",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    hint: "Configured in SUPER_ADMIN_EMAILS — cannot be changed from here.",
  },
  grant: {
    label: "Granted",
    className: "border-primary/40 bg-primary/10 text-primary",
    hint: "Granted through this page.",
  },
  legacy_config: {
    label: "Legacy",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    hint: "From the old user_config flag. Re-grant to manage its scope here.",
  },
};

function AdminCard({
  admin,
  catalogue,
  onEdit,
  onRevoke,
}: {
  admin: PlatformAdmin;
  catalogue: PlatformPermissionMeta[];
  onEdit: () => void;
  onRevoke: () => void;
}) {
  const currentUserId = useAuthState((s) => s.user?.id);
  // You can't edit or revoke your own access — the server enforces this; hiding the buttons
  // just avoids offering an action that will always fail.
  const isSelf = admin.userId === currentUserId;
  const badge = SOURCE_BADGE[admin.source];
  const isRevoked = !!admin.revokedAt;
  const labelFor = (key: string) => catalogue.find((c) => c.key === key)?.label ?? key;

  return (
    <div
      className={`rounded-2xl border bg-card p-4 shadow-soft sm:p-5 ${isRevoked ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold break-all">{admin.email}</span>
            {admin.isSuperAdmin ? (
              <Badge
                className="gap-1 border-primary/40 bg-primary/10 text-primary"
                variant="outline"
              >
                <ShieldAlert className="h-3 w-3" />
                Super admin
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <KeyRound className="h-3 w-3" />
                {admin.permissions.length} permission{admin.permissions.length === 1 ? "" : "s"}
              </Badge>
            )}
            <Badge variant="outline" className={badge.className} title={badge.hint}>
              {badge.label}
            </Badge>
            {admin.isImmutable && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" />
                Protected
              </Badge>
            )}
            {isRevoked && <Badge variant="outline">Revoked</Badge>}
          </div>

          {admin.name && <p className="mt-1 text-sm text-muted-foreground">{admin.name}</p>}

          {!admin.isSuperAdmin && admin.permissions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {admin.permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {labelFor(p)}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            {admin.grantedAt
              ? `Granted ${new Date(admin.grantedAt).toLocaleDateString()}${
                  admin.grantedByEmail ? ` by ${admin.grantedByEmail}` : ""
                }`
              : badge.hint}
            {isRevoked && ` · Revoked ${new Date(admin.revokedAt!).toLocaleDateString()}`}
          </p>
          {admin.notes && admin.source === "grant" && (
            <p className="mt-1 text-xs italic text-muted-foreground">{admin.notes}</p>
          )}
        </div>

        {!isRevoked && !admin.isImmutable && !isSelf && (
          <div className="flex shrink-0 gap-2">
            {admin.source === "grant" && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                Edit scope
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={onRevoke}
            >
              Revoke
            </Button>
          </div>
        )}
        {isSelf && !isRevoked && (
          <span className="shrink-0 text-xs text-muted-foreground">This is you</span>
        )}
      </div>
    </div>
  );
}

/** Shared scope editor — a superadmin holds everything, so the checkbox grid collapses. */
function ScopeEditor({
  isSuperAdmin,
  onIsSuperAdminChange,
  permissions,
  onPermissionsChange,
  catalogue,
}: {
  isSuperAdmin: boolean;
  onIsSuperAdminChange: (v: boolean) => void;
  permissions: string[];
  onPermissionsChange: (v: string[]) => void;
  catalogue: PlatformPermissionMeta[];
}) {
  const toggle = (key: string) =>
    onPermissionsChange(
      permissions.includes(key) ? permissions.filter((k) => k !== key) : [...permissions, key],
    );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/40 p-3">
        <div>
          <Label className="text-sm">Full super admin</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Holds every platform permission, including granting access to others.
          </p>
        </div>
        <Switch checked={isSuperAdmin} onCheckedChange={onIsSuperAdminChange} />
      </div>

      {!isSuperAdmin && (
        <div className="space-y-2">
          <Label className="text-sm">Permissions</Label>
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {catalogue.map((perm) => (
              <label
                key={perm.key}
                className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={permissions.includes(perm.key)}
                  onCheckedChange={() => toggle(perm.key)}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{perm.label}</span>
                  <span className="block text-xs text-muted-foreground">{perm.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GrantDialog({
  open,
  onOpenChange,
  catalogue,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogue: PlatformPermissionMeta[];
  onSuccess: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<PlatformUserSuggestion | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(null);
      setIsSuperAdmin(false);
      setPermissions([]);
      setNotes("");
    }
  }, [open]);

  const suggestionsQuery = useQuery({
    queryKey: ["platform-user-lookup", debounced],
    queryFn: () => lookupPlatformUsers(debounced),
    enabled: open && debounced.length >= 2 && !selected,
  });

  const mutation = useMutation({
    mutationFn: () =>
      grantPlatformAdmin({
        userId: selected!.id,
        isSuperAdmin,
        permissions,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success(`Platform access granted to ${selected?.email}`);
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit = !!selected && (isSuperAdmin || permissions.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant platform access</DialogTitle>
          <DialogDescription>
            Platform access spans every workspace on Liffio. Grant the narrowest scope that does the
            job.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">User</Label>
            {selected ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <span className="min-w-0 break-all text-sm">{selected.email}</span>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-9"
                    placeholder="Search by email or name…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {debounced.length >= 2 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border">
                    {suggestionsQuery.isLoading ? (
                      <p className="p-3 text-xs text-muted-foreground">Searching…</p>
                    ) : (suggestionsQuery.data?.items.length ?? 0) === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">No matching users.</p>
                    ) : (
                      suggestionsQuery.data!.items.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => setSelected(u)}
                        >
                          <span className="break-all">{u.email}</span>
                          {u.name && (
                            <span className="text-xs text-muted-foreground">{u.name}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <ScopeEditor
            isSuperAdmin={isSuperAdmin}
            onIsSuperAdminChange={setIsSuperAdmin}
            permissions={permissions}
            onPermissionsChange={setPermissions}
            catalogue={catalogue}
          />

          <div className="space-y-2">
            <Label className="text-sm">Reason / notes</Label>
            <Textarea
              rows={2}
              maxLength={1000}
              placeholder="Why does this person need platform access?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Granting…" : "Grant access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditScopeDialog({
  admin,
  onOpenChange,
  catalogue,
  onSuccess,
}: {
  admin: PlatformAdmin | null;
  onOpenChange: (open: boolean) => void;
  catalogue: PlatformPermissionMeta[];
  onSuccess: () => void;
}) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (admin) {
      setIsSuperAdmin(admin.isSuperAdmin);
      setPermissions(admin.isSuperAdmin ? [] : admin.permissions);
    }
  }, [admin]);

  const mutation = useMutation({
    mutationFn: () => updatePlatformAdminScope(admin!.userId, { isSuperAdmin, permissions }),
    onSuccess: () => {
      toast.success("Scope updated");
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={!!admin} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit scope</DialogTitle>
          <DialogDescription className="break-all">{admin?.email}</DialogDescription>
        </DialogHeader>

        <ScopeEditor
          isSuperAdmin={isSuperAdmin}
          onIsSuperAdminChange={setIsSuperAdmin}
          permissions={permissions}
          onPermissionsChange={setPermissions}
          catalogue={catalogue}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || (!isSuperAdmin && permissions.length === 0)}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save scope"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({
  admin,
  onOpenChange,
  onSuccess,
}: {
  admin: PlatformAdmin | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (admin) setReason("");
  }, [admin]);

  const mutation = useMutation({
    mutationFn: () => revokePlatformAdmin(admin!.userId, reason.trim() || undefined),
    onSuccess: () => {
      toast.success("Platform access revoked");
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AlertDialog open={!!admin} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke platform access?</AlertDialogTitle>
          <AlertDialogDescription className="break-all">
            {admin?.email} will immediately lose access to every control-plane surface. This is
            recorded in the audit log.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label className="text-sm">Reason (optional)</Label>
          <Input
            value={reason}
            maxLength={500}
            placeholder="e.g. left the team"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Revoking…" : "Revoke access"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
