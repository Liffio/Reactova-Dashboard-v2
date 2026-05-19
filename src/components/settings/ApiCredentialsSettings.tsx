import { useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
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
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { CopyButton, CopyField } from "@/components/CopyButton";
import { PlanGate } from "@/components/PlanGate";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/components/ui/sonner";
import { useApp } from "@/state/AppContext";
import {
  useApiCredentialsQuery,
  useCreateApiCredentialMutation,
  usePlanCatalogQuery,
  useRevokeApiCredentialMutation,
  useUpdateApiCredentialMutation
} from "@/hooks/useApiCredentials";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border space-y-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

const planMeetsStarter = (plan: string) =>
  ["Starter", "Pro", "Business", "Agency"].includes(plan);

export function ApiCredentialsSettings() {
  const { current } = useApp();
  const { data, isLoading } = useApiCredentialsQuery(current.id);
  const { data: catalogData } = usePlanCatalogQuery();
  const createMutation = useCreateApiCredentialMutation(current.id);
  const updateMutation = useUpdateApiCredentialMutation(current.id);
  const revokeMutation = useRevokeApiCredentialMutation(current.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [neverExpires, setNeverExpires] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  if (!planMeetsStarter(current.plan)) {
    return (
      <PlanGate
        requiredPlan="Starter"
        message="API credentials are available on Starter ($9) and higher plans."
        className="min-h-[280px]"
      />
    );
  }

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Enter a name for this API key");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        name: newKeyName.trim(),
        neverExpires
      });
      setRevealedSecret(result.secretKey);
      setCreateOpen(false);
      setSecretOpen(true);
      setNewKeyName("");
      setNeverExpires(false);
      toast.success("API key created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    }
  };

  const formatExpiry = (expiresAt: string | null, never: boolean) => {
    if (never || !expiresAt) return "Never";
    return new Date(expiresAt).toLocaleDateString();
  };

  return (
    <div className="space-y-5">
      <Card title="Your plan & API limits">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Workspace plan</span>
              <p className="font-semibold">{current.plan}</p>
            </div>
            {data?.limits && (
              <>
                <div>
                  <span className="text-muted-foreground">Active keys allowed</span>
                  <p className="font-semibold">{data.limits.maxApiCredentials}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Scheduled posts / day</span>
                  <p className="font-semibold">
                    {data.limits.schedulerPostsPerDay >= 999999 ? "Unlimited" : data.limits.schedulerPostsPerDay}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Automations / day</span>
                  <p className="font-semibold">
                    {data.limits.automationsPerDay >= 999999 ? "Unlimited" : data.limits.automationsPerDay}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <Card title="API credentials">
        <p className="text-sm text-muted-foreground">
          Keys are tied to your account and only work for scheduling posts and creating automations.
          Default expiry is 30 days — you can set a key to never expire after creation.
        </p>
        <div className="space-y-2">
          <Label>Workspace ID</Label>
          <p className="text-xs text-muted-foreground">
            Send this as the <span className="font-mono">x-workspace-id</span> header with every API request.
          </p>
          <CopyField value={current.id} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreateOpen(true)} disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" />
            Create API key
          </Button>
          <Button variant="outline" asChild>
            <a href="/docs/api" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              API documentation
            </a>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2">Last used</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.credentials ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No API keys yet
                  </td>
                </tr>
              ) : (
                data?.credentials.map((cred) => (
                  <tr key={cred.id} className="stripe-row">
                    <td className="px-3 py-2 font-medium">{cred.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <span className="truncate max-w-[220px] inline-block">{cred.maskedKey}</span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={
                          cred.status === "active"
                            ? "active"
                            : cred.status === "revoked"
                              ? "failed"
                              : "paused"
                        }
                        label={
                          cred.status === "active"
                            ? "Active"
                            : cred.status === "revoked"
                              ? "Revoked"
                              : "Expired"
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatExpiry(cred.expiresAt, cred.neverExpires)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {cred.lastUsedAt ? new Date(cred.lastUsedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1 justify-end">
                        {cred.status === "active" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updateMutation.isPending}
                              onClick={() => {
                                void updateMutation
                                  .mutateAsync({ id: cred.id, neverExpires: !cred.neverExpires })
                                  .then(() =>
                                    toast.success(
                                      cred.neverExpires ? "Key set to 30-day expiry" : "Key set to never expire"
                                    )
                                  )
                                  .catch((e) => toast.error(e instanceof Error ? e.message : "Request failed"));
                              }}
                            >
                              {cred.neverExpires ? "30-day expiry" : "Never expire"}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This cannot be undone. Integrations using this key will stop working immediately.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => {
                                      void revokeMutation
                                        .mutateAsync(cred.id)
                                        .then(() => toast.success("API key revoked"))
                                        .catch((e) => toast.error(e instanceof Error ? e.message : "Request failed"));
                                    }}
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {catalogData?.plans && (
        <Card title="Plan comparison (API)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Monthly</th>
                  <th className="px-3 py-2">API keys</th>
                  <th className="px-3 py-2">Posts/day</th>
                  <th className="px-3 py-2">Workflows/day</th>
                </tr>
              </thead>
              <tbody>
                {catalogData.plans.map((p) => (
                  <tr key={p.plan} className="stripe-row">
                    <td className="px-3 py-2 font-medium">{p.displayName}</td>
                    <td className="px-3 py-2 font-mono">${p.monthlyPriceUsd}</td>
                    <td className="px-3 py-2">{p.apiEnabled ? p.maxApiCredentials : "—"}</td>
                    <td className="px-3 py-2">
                      {p.apiEnabled
                        ? p.schedulerPostsPerDay >= 999999
                          ? "∞"
                          : p.schedulerPostsPerDay
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {p.apiEnabled
                        ? p.automationsPerDay >= 999999
                          ? "∞"
                          : p.automationsPerDay
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give this key a label so you can identify it later. The secret is shown once after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Postman production"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Never expire</Label>
                <p className="text-xs text-muted-foreground">Otherwise expires in 30 days</p>
              </div>
              <Switch checked={neverExpires} onCheckedChange={setNeverExpires} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={secretOpen}
        onOpenChange={(open) => {
          setSecretOpen(open);
          if (!open) setRevealedSecret(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your API key now</DialogTitle>
            <DialogDescription>
              This is the only time you will see the full key. Store it securely — you cannot view it again.
            </DialogDescription>
          </DialogHeader>
          {revealedSecret && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-input border border-border">
              <span className="flex-1 text-sm font-mono break-all">{revealedSecret}</span>
              <CopyButton value={revealedSecret} label="Copy" />
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setSecretOpen(false);
                setRevealedSecret(null);
              }}
            >
              I have saved this key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

