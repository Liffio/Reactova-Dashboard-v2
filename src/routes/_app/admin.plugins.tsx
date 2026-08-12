import { useEffect, useRef, useState, Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, MoreHorizontal, Plug, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { CopyableKey, EmptyState } from "@/components/admin/form-page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useDebounced } from "@/hooks/use-debounced";
import { ApiError } from "@/lib/api/http";
import {
  activatePlugin,
  attachPluginToPackage,
  deactivatePlugin,
  detachPluginFromPackage,
  getPlugin,
  getPluginGrants,
  listPlugins,
  purgePluginData,
  rollbackPlugin,
  setPluginExposure,
  setUserGrant,
  setWorkspaceGrant,
  uninstallPlugin,
  uploadPluginZip,
  type PluginExposure,
  type PluginGrantEffect,
  type PluginRow,
  type PluginStatus,
} from "@/lib/api/plugins-admin-api";
import {
  listAssignableWorkspaces,
  listPackages,
  type AssignableWorkspace,
} from "@/lib/api/registry-api";
import { searchAccessUsers, type AccessUser } from "@/lib/api/access-api";

const PLUGIN_MANAGE = "platform:plugin_manage";
const PLUGINS_QUERY_KEY = "admin-plugins";
const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/admin/plugins")({
  head: () => ({ meta: [{ title: "Plugins — Admin" }] }),
  component: PluginsRoute,
});

function PluginsRoute() {
  return (
    <PlatformPermissionRoute permission={PLUGIN_MANAGE}>
      <PluginsPage />
    </PlatformPermissionRoute>
  );
}

type LifecycleAction = "activate" | "deactivate" | "rollback" | "uninstall" | "purge-data";

type PendingAction = { action: LifecycleAction; plugin: PluginRow };

const ACTION_COPY: Record<
  LifecycleAction,
  {
    title: string;
    confirmLabel: string;
    pendingLabel: string;
    destructive: boolean;
    description: (p: PluginRow) => string;
    success: (p: PluginRow) => string;
  }
> = {
  activate: {
    title: "Activate plugin?",
    confirmLabel: "Activate",
    pendingLabel: "Activating…",
    destructive: false,
    description: (p) =>
      `Runs ${p.name}'s migrations, registers its modules and routes, and starts serving it live in both the API and the worker.`,
    success: (p) => `${p.name} activated`,
  },
  deactivate: {
    title: "Deactivate plugin?",
    confirmLabel: "Deactivate",
    pendingLabel: "Deactivating…",
    destructive: false,
    description: (p) =>
      `${p.name} stops answering immediately. Its data and files stay in place, and it can be re-activated later.`,
    success: (p) => `${p.name} deactivated`,
  },
  rollback: {
    title: "Roll back plugin?",
    confirmLabel: "Roll back",
    pendingLabel: "Rolling back…",
    destructive: false,
    description: (p) => `Reverts ${p.name} to its previous version and re-activates it.`,
    success: (p) => `${p.name} rolled back`,
  },
  uninstall: {
    title: "Uninstall plugin?",
    confirmLabel: "Uninstall",
    pendingLabel: "Uninstalling…",
    destructive: true,
    description: (p) =>
      `Removes ${p.name}'s registry entries, grants and files. Its data tables remain until purged. This is recorded in the audit log.`,
    success: (p) => `${p.name} uninstalled`,
  },
  "purge-data": {
    title: "Purge plugin data?",
    confirmLabel: "Purge data",
    pendingLabel: "Purging…",
    destructive: true,
    description: (p) =>
      `Permanently drops every database table ${p.name} created. This cannot be undone and is recorded in the audit log.`,
    success: (p) => `${p.name} data purged`,
  },
};

function actionsFor(row: PluginRow): LifecycleAction[] {
  const actions: LifecycleAction[] = [];
  if (row.status === "installed" || row.status === "disabled" || row.status === "failed") {
    actions.push("activate");
  }
  if (row.status === "active") {
    actions.push("deactivate");
  }
  if (row.status === "installed") {
    actions.push("rollback");
  }
  if (row.status === "disabled" || row.status === "installed" || row.status === "failed") {
    actions.push("uninstall");
  }
  if (row.status === "uninstalled") {
    actions.push("purge-data");
  }
  return actions;
}

const STATUS_BADGE: Record<
  PluginStatus,
  { label: string; variant: "secondary" | "destructive" | "outline"; className?: string }
> = {
  uploaded: { label: "Uploaded", variant: "outline" },
  installed: { label: "Installed", variant: "secondary" },
  active: {
    label: "Active",
    variant: "outline",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  disabled: { label: "Disabled", variant: "outline", className: "text-muted-foreground" },
  failed: { label: "Failed", variant: "destructive" },
  uninstalled: { label: "Uninstalled", variant: "outline" },
};

function StatusBadge({ status }: { status: PluginStatus }) {
  const badge = STATUS_BADGE[status];
  return (
    <Badge variant={badge.variant} className={badge.className}>
      {badge.label}
    </Badge>
  );
}

function PluginsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [grantsFor, setGrantsFor] = useState<PluginRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search runs server-side; the client never filters a fetched array.
  const debouncedSearch = useDebounced(search);
  // Searching resets to page 1: staying on page 4 of the old result set would show an empty page.
  useEffect(() => setPage(1), [debouncedSearch]);

  const pluginsQuery = useQuery({
    queryKey: [PLUGINS_QUERY_KEY, debouncedSearch, page],
    queryFn: () => listPlugins({ q: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: [PLUGINS_QUERY_KEY] });

  const upload = useMutation({
    mutationFn: (file: File) => uploadPluginZip(file),
    onSuccess: (row) => {
      toast.success(`${row.name} ${row.version} uploaded`);
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const exposureMutation = useMutation({
    mutationFn: (input: { key: string; exposure: PluginExposure }) =>
      setPluginExposure(input.key, input.exposure),
    onSuccess: () => {
      toast.success("Exposure updated");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const data = pluginsQuery.data;

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Plugins"
        description="Zip-delivered extensions that attach to the running platform. Upload, activate and expose them here — every lifecycle change is TOTP-confirmed and audited."
        actions={
          <>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload.mutate(file);
              }}
            />
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link to="/admin/plugins/docs">
                <BookOpen className="h-3.5 w-3.5" />
                Developer guide
              </Link>
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
              disabled={upload.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {upload.isPending ? "Uploading…" : "Upload plugin"}
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search plugins…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {pluginsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Plug}
            title={debouncedSearch ? "No plugins match that search." : "No plugins yet."}
          >
            {!debouncedSearch && "Upload a signed plugin zip to get started."}
          </EmptyState>
        ) : (
          <div className="rounded-2xl border bg-card shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Provides</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Exposure</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.items.map((row) => {
                  const rowActions = actionsFor(row);
                  return (
                    <Fragment key={row.key}>
                      <TableRow className={row.status === "failed" ? "border-b-0" : undefined}>
                        <TableCell>
                          <CopyableKey value={row.key} />
                        </TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="font-mono text-xs">{row.version}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {row.provides.map((p) => (
                              <Badge key={p} variant="outline" className="px-1.5 text-[10px]">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.exposure}
                            onValueChange={(v) =>
                              exposureMutation.mutate({
                                key: row.key,
                                exposure: v as PluginExposure,
                              })
                            }
                            disabled={row.status !== "active" || exposureMutation.isPending}
                          >
                            <SelectTrigger className="h-8 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hidden">Hidden</SelectItem>
                              <SelectItem value="restricted">Restricted</SelectItem>
                              <SelectItem value="released">Released</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {(rowActions.length > 0 || row.status === "active") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="rounded-md p-1 hover:bg-muted"
                                  aria-label={`Actions for ${row.name}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {row.status === "active" && (
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => setGrantsFor(row)}
                                  >
                                    Grants…
                                  </DropdownMenuItem>
                                )}
                                {rowActions.map((action) => (
                                  <DropdownMenuItem
                                    key={action}
                                    className={
                                      ACTION_COPY[action].destructive
                                        ? "cursor-pointer text-destructive focus:text-destructive"
                                        : "cursor-pointer"
                                    }
                                    onClick={() => setPending({ action, plugin: row })}
                                  >
                                    {ACTION_COPY[action].confirmLabel}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                      {row.status === "failed" && row.error && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="pt-0">
                            <p
                              className="max-w-2xl truncate text-xs text-destructive"
                              title={row.error}
                            >
                              {row.error}
                            </p>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <PaginationBar
            page={data.page}
            pages={Math.max(1, Math.ceil(data.total / data.limit))}
            total={data.total}
            limit={data.limit}
            onPageChange={setPage}
            label="plugins"
          />
        )}
      </div>

      <LifecycleDialog
        pending={pending}
        onOpenChange={(open) => !open && setPending(null)}
        onDone={refresh}
      />

      <GrantsDialog plugin={grantsFor} onOpenChange={(open) => !open && setGrantsFor(null)} />
    </div>
  );
}

function LifecycleDialog({
  pending,
  onOpenChange,
  onDone,
}: {
  pending: PendingAction | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (pending) setCode("");
  }, [pending]);

  const copy = pending ? ACTION_COPY[pending.action] : null;
  const needsDetail = pending?.action === "activate" || pending?.action === "rollback";

  // Activate shows what the plugin requests; rollback needs the previous-version pointer.
  const detailQuery = useQuery({
    queryKey: [PLUGINS_QUERY_KEY, pending?.plugin.key],
    queryFn: () => getPlugin(pending!.plugin.key),
    enabled: !!pending && needsDetail,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const key = pending!.plugin.key;
      switch (pending!.action) {
        case "activate":
          return activatePlugin(key, code);
        case "deactivate":
          return deactivatePlugin(key, code);
        case "rollback":
          return rollbackPlugin(key, code);
        case "uninstall":
          return uninstallPlugin(key, code);
        case "purge-data":
          return purgePluginData(key, code);
      }
    },
    onSuccess: () => {
      toast.success(copy!.success(pending!.plugin));
      onOpenChange(false);
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "TOTP_REQUIRED") {
        toast.error("Authenticator required", {
          description:
            "Your account has no authenticator app enrolled. Set one up under Settings → Security, then retry.",
        });
        return;
      }
      toast.error((e as Error).message);
    },
  });

  const uses = detailQuery.data?.manifest.uses ?? [];
  const rollbackBlocked =
    pending?.action === "rollback" && detailQuery.isSuccess && !detailQuery.data.previousVersion;
  const canConfirm = code.length === 6 && !mutation.isPending && !rollbackBlocked;

  return (
    <Dialog open={!!pending} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>
            {pending && copy ? copy.description(pending.plugin) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pending?.action === "activate" && (
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-xs font-medium">This plugin requests:</p>
              {detailQuery.isLoading ? (
                <Skeleton className="mt-2 h-6 rounded-md" />
              ) : uses.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {uses.map((u) => (
                    <span
                      key={u}
                      className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No platform services — it only serves its own routes.
                </p>
              )}
            </div>
          )}

          {pending?.action === "rollback" &&
            (rollbackBlocked ? (
              <p className="text-xs text-destructive">
                No previous version recorded — there is nothing to roll back to.
              </p>
            ) : (
              detailQuery.data?.previousVersion && (
                <p className="text-xs text-muted-foreground">
                  Rolls back to{" "}
                  <span className="font-mono">{detailQuery.data.previousVersion}</span>.
                </p>
              )
            ))}

          <div className="space-y-2">
            <Label className="text-sm">Authenticator code</Label>
            <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v.replace(/\D/g, ""))}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p className="text-[11px] text-muted-foreground">
              Lifecycle changes require the 6-digit code from your authenticator app.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={copy?.destructive ? "destructive" : "default"}
            disabled={!canConfirm}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? copy?.pendingLabel : copy?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Grants ───────────────────────────────────────────────────────────────────
// A grant covers ALL of a plugin's capabilities as a unit. Three surfaces:
// workspace override (what makes a `restricted` plugin visible to a tenant),
// per-user override (beats the workspace decision), and package attachment
// (rides the entitlement ceiling once the plugin is `released`).

function EffectBadge({ effect }: { effect: PluginGrantEffect }) {
  return effect === "ALLOW" ? (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      Allow
    </Badge>
  ) : (
    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
      Deny
    </Badge>
  );
}

/** Search-and-pick over workspaces; renders the selection as a clearable chip. */
function WorkspacePicker({
  value,
  onChange,
}: {
  value: AssignableWorkspace | null;
  onChange: (workspace: AssignableWorkspace | null) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);

  const results = useQuery({
    queryKey: ["plugin-grants-workspace-search", debounced],
    queryFn: () => listAssignableWorkspaces({ q: debounced || undefined, page: 1, limit: 6 }),
    enabled: !value,
    placeholderData: keepPreviousData,
  });

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 text-sm">
        <span className="truncate">{value.name}</span>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          aria-label="Clear workspace"
          onClick={() => onChange(null)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        placeholder="Search workspaces…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {(results.data?.items.length ?? 0) > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-md border">
          {results.data!.items.map((w) => (
            <button
              key={w.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => onChange(w)}
            >
              <span className="truncate">{w.name}</span>
              {w.humanId && (
                <code className="shrink-0 text-[10px] text-muted-foreground">{w.humanId}</code>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Search-and-pick over users by email/name; selection shown as a clearable chip. */
function UserPicker({
  value,
  onChange,
}: {
  value: AccessUser | null;
  onChange: (user: AccessUser | null) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);

  const results = useQuery({
    queryKey: ["plugin-grants-user-search", debounced],
    queryFn: () => searchAccessUsers(debounced),
    enabled: !value,
    placeholderData: keepPreviousData,
  });

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 text-sm">
        <span className="truncate">{value.email}</span>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          aria-label="Clear user"
          onClick={() => onChange(null)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        placeholder="Search users by email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {(results.data?.items.length ?? 0) > 0 && (
        <div className="max-h-36 overflow-y-auto rounded-md border">
          {results.data!.items.map((u) => (
            <button
              key={u.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => onChange(u)}
            >
              <span className="truncate">{u.email}</span>
              {u.name && (
                <span className="shrink-0 text-[10px] text-muted-foreground">{u.name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GrantsDialog({
  plugin,
  onOpenChange,
}: {
  plugin: PluginRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const key = plugin?.key ?? null;

  // Workspace-grant form.
  const [wsTarget, setWsTarget] = useState<AssignableWorkspace | null>(null);
  const [wsEffect, setWsEffect] = useState<PluginGrantEffect>("ALLOW");
  const [wsReason, setWsReason] = useState("");
  const [wsExpiry, setWsExpiry] = useState("");
  // User-grant form.
  const [userTarget, setUserTarget] = useState<AccessUser | null>(null);
  const [userWsTarget, setUserWsTarget] = useState<AssignableWorkspace | null>(null);
  const [userEffect, setUserEffect] = useState<PluginGrantEffect>("ALLOW");
  // Package form.
  const [attachPackageId, setAttachPackageId] = useState("");

  useEffect(() => {
    // A fresh dialog per plugin — nothing may leak from the previous target.
    setWsTarget(null);
    setWsEffect("ALLOW");
    setWsReason("");
    setWsExpiry("");
    setUserTarget(null);
    setUserWsTarget(null);
    setUserEffect("ALLOW");
    setAttachPackageId("");
  }, [plugin]);

  const grantsQuery = useQuery({
    queryKey: [PLUGINS_QUERY_KEY, key, "grants"],
    queryFn: () => getPluginGrants(key!),
    enabled: !!key,
  });

  const packagesQuery = useQuery({
    queryKey: ["packages", "all-for-plugin-grants"],
    queryFn: () => listPackages({ page: 1, limit: 100 }),
    enabled: !!key,
    staleTime: 5 * 60 * 1000,
  });

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: [PLUGINS_QUERY_KEY, key, "grants"] });

  const workspaceGrantMutation = useMutation({
    mutationFn: (input: {
      workspaceId: string;
      effect: PluginGrantEffect | null;
      reason?: string | null;
      expiresAt?: string | null;
    }) => setWorkspaceGrant(key!, input),
    onSuccess: (_data, vars) => {
      toast.success(vars.effect === null ? "Workspace grant removed" : "Workspace grant saved");
      setWsTarget(null);
      setWsReason("");
      setWsExpiry("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const userGrantMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      workspaceId: string;
      effect: PluginGrantEffect | null;
    }) => setUserGrant(key!, input),
    onSuccess: (_data, vars) => {
      toast.success(vars.effect === null ? "User grant removed" : "User grant saved");
      setUserTarget(null);
      setUserWsTarget(null);
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const attachMutation = useMutation({
    mutationFn: (packageId: string) => attachPluginToPackage(key!, packageId),
    onSuccess: () => {
      toast.success("Package attached");
      setAttachPackageId("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const detachMutation = useMutation({
    mutationFn: (packageId: string) => detachPluginFromPackage(key!, packageId),
    onSuccess: () => {
      toast.success("Package detached");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const grants = grantsQuery.data;
  const attachedIds = new Set(grants?.packages.map((p) => p.packageId) ?? []);
  const attachablePackages = (packagesQuery.data?.items ?? []).filter(
    (p) => !attachedIds.has(p.id),
  );
  const busy =
    workspaceGrantMutation.isPending ||
    userGrantMutation.isPending ||
    attachMutation.isPending ||
    detachMutation.isPending;

  return (
    <Dialog open={!!plugin} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Grants — {plugin?.name}</DialogTitle>
          <DialogDescription>
            Who can see and use this plugin while it is restricted, and which packages carry it. A
            grant always covers the whole plugin, and DENY wins over role grants.
          </DialogDescription>
        </DialogHeader>

        {grantsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : grantsQuery.isError ? (
          <p className="text-sm text-destructive">{(grantsQuery.error as Error).message}</p>
        ) : grants ? (
          <div className="space-y-6">
            {/* ── Workspace grants ─────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Workspace grants</h3>
              {grants.workspace.length > 0 ? (
                <div className="rounded-xl border">
                  <Table>
                    <TableBody>
                      {grants.workspace.map((g) => (
                        <TableRow key={g.workspaceId}>
                          <TableCell className="font-medium">{g.workspaceName}</TableCell>
                          <TableCell>
                            <EffectBadge effect={g.effect} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {g.expiresAt
                              ? `until ${new Date(g.expiresAt).toLocaleString()}`
                              : "no expiry"}
                          </TableCell>
                          <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                            {g.reason ?? ""}
                          </TableCell>
                          <TableCell className="w-10 text-right">
                            <button
                              type="button"
                              className="rounded-md p-1 text-destructive hover:bg-muted"
                              aria-label={`Remove grant for ${g.workspaceName}`}
                              disabled={busy}
                              onClick={() =>
                                workspaceGrantMutation.mutate({
                                  workspaceId: g.workspaceId,
                                  effect: null,
                                })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No workspace grants.</p>
              )}

              <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Workspace</Label>
                  <WorkspacePicker value={wsTarget} onChange={setWsTarget} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Effect</Label>
                  <Select
                    value={wsEffect}
                    onValueChange={(v) => setWsEffect(v as PluginGrantEffect)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALLOW">Allow</SelectItem>
                      <SelectItem value="DENY">Deny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expires (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={wsExpiry}
                    onChange={(e) => setWsExpiry(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Reason (optional, audited)</Label>
                  <Input
                    value={wsReason}
                    maxLength={500}
                    placeholder="e.g. beta cohort"
                    onChange={(e) => setWsReason(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    size="sm"
                    disabled={!wsTarget || busy}
                    onClick={() =>
                      workspaceGrantMutation.mutate({
                        workspaceId: wsTarget!.id,
                        effect: wsEffect,
                        reason: wsReason.trim() || null,
                        expiresAt: wsExpiry ? new Date(wsExpiry).toISOString() : null,
                      })
                    }
                  >
                    {workspaceGrantMutation.isPending ? "Saving…" : "Apply workspace grant"}
                  </Button>
                </div>
              </div>
            </section>

            {/* ── User grants ──────────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">User grants</h3>
              {grants.user.length > 0 ? (
                <div className="rounded-xl border">
                  <Table>
                    <TableBody>
                      {grants.user.map((g) => (
                        <TableRow key={`${g.userId}:${g.workspaceId}`}>
                          <TableCell className="font-medium">{g.email}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {g.workspaceName}
                          </TableCell>
                          <TableCell>
                            <EffectBadge effect={g.effect} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {g.expiresAt
                              ? `until ${new Date(g.expiresAt).toLocaleString()}`
                              : "no expiry"}
                          </TableCell>
                          <TableCell className="w-10 text-right">
                            <button
                              type="button"
                              className="rounded-md p-1 text-destructive hover:bg-muted"
                              aria-label={`Remove grant for ${g.email}`}
                              disabled={busy}
                              onClick={() =>
                                userGrantMutation.mutate({
                                  userId: g.userId,
                                  workspaceId: g.workspaceId,
                                  effect: null,
                                })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No user grants.</p>
              )}

              <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">User</Label>
                  <UserPicker value={userTarget} onChange={setUserTarget} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Workspace (must be a member)</Label>
                  <WorkspacePicker value={userWsTarget} onChange={setUserWsTarget} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Effect</Label>
                  <Select
                    value={userEffect}
                    onValueChange={(v) => setUserEffect(v as PluginGrantEffect)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALLOW">Allow</SelectItem>
                      <SelectItem value="DENY">Deny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    disabled={!userTarget || !userWsTarget || busy}
                    onClick={() =>
                      userGrantMutation.mutate({
                        userId: userTarget!.id,
                        workspaceId: userWsTarget!.id,
                        effect: userEffect,
                      })
                    }
                  >
                    {userGrantMutation.isPending ? "Saving…" : "Apply user grant"}
                  </Button>
                </div>
              </div>
            </section>

            {/* ── Packages ─────────────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Packages</h3>
              {grants.packages.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {grants.packages.map((p) => (
                    <span
                      key={p.packageId}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                    >
                      {p.packageName}
                      <button
                        type="button"
                        className="rounded p-0.5 text-destructive hover:bg-muted"
                        aria-label={`Detach ${p.packageName}`}
                        disabled={busy}
                        onClick={() => detachMutation.mutate(p.packageId)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Not part of any package — once released, only granted workspaces keep access.
                </p>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Attach to package</Label>
                  <Select value={attachPackageId} onValueChange={setAttachPackageId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select a package" />
                    </SelectTrigger>
                    <SelectContent>
                      {attachablePackages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={!attachPackageId || busy}
                  onClick={() => attachMutation.mutate(attachPackageId)}
                >
                  {attachMutation.isPending ? "Attaching…" : "Attach"}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
