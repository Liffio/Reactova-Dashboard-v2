import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformAdminRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  type AiFeatureRegistryRow,
  type AiTokenLedgerEntryType,
  type AiTokenPlanConfig,
  type UpdatedByUser,
  getAiTokenGlobalSettings,
  grantAiTokens,
  listAiFeatureRegistry,
  listAiTokenLedger,
  listAiTokenPlans,
  listAiTokenWorkspaceUsage,
  updateAiFeatureMetering,
  updateAiTokenGlobalSettings,
  updateAiTokenPlan,
} from "@/lib/api/ai-tokens-api";

function LastUpdatedBy({ user }: { user: UpdatedByUser | undefined }) {
  return <span className="text-xs text-muted-foreground">{user?.email ?? "—"}</span>;
}

const PAGE_SIZE = 20;

function Pagination({
  page,
  setPage,
  total,
  pageSize,
}: {
  page: number;
  setPage: (p: number) => void;
  total: number;
  pageSize: number;
}) {
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
      <span>
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= lastPage}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/ai-tokens-master")({
  head: () => ({ meta: [{ title: "AI Tokens — Admin" }] }),
  component: AiTokensMasterRoute,
});

function AiTokensMasterRoute() {
  return (
    <PlatformAdminRoute>
      <AiTokensMasterPage />
    </PlatformAdminRoute>
  );
}

function AiTokensMasterPage() {
  const [activeTab, setActiveTab] = useState("plans");
  const [ledgerWorkspaceFilter, setLedgerWorkspaceFilter] = useState("");

  const viewLedgerForWorkspace = (workspaceId: string) => {
    setLedgerWorkspaceFilter(workspaceId);
    setActiveTab("ledger");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="AI Tokens"
        description="Configure Lyra AI token allocation, the char-to-token ratio, and which features draw against a workspace's allowance."
      />
      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="plans">Plan configuration</TabsTrigger>
            <TabsTrigger value="settings">Global settings</TabsTrigger>
            <TabsTrigger value="workspaces">Workspace usage</TabsTrigger>
            <TabsTrigger value="features">Feature metering</TabsTrigger>
            <TabsTrigger value="ledger">Usage ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="plans">
            <PlansTab />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
          <TabsContent value="workspaces">
            <WorkspacesTab onViewLedger={viewLedgerForWorkspace} />
          </TabsContent>
          <TabsContent value="features">
            <FeaturesTab />
          </TabsContent>
          <TabsContent value="ledger">
            <LedgerTab
              workspaceFilter={ledgerWorkspaceFilter}
              setWorkspaceFilter={setLedgerWorkspaceFilter}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Tab 1: Plan configuration ─────────────────────────────────────────────────

/** Lowering an allocation or turning rollover off reduces what a workspace can do —
 *  those get a confirmation step. Raising an allocation, adding rollover, etc. don't. */
function isReduction(original: AiTokenPlanConfig, patch: Partial<AiTokenPlanConfig>): boolean {
  const allocationLowered =
    patch.monthlyTokenAllocation !== undefined &&
    patch.monthlyTokenAllocation !== -1 &&
    (original.monthlyTokenAllocation === -1 ||
      patch.monthlyTokenAllocation < original.monthlyTokenAllocation);
  const rolloverDisabled = patch.rolloverEnabled === false && original.rolloverEnabled === true;
  return allocationLowered || rolloverDisabled;
}

function PlansTab() {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ["ai-token-plans"], queryFn: listAiTokenPlans });
  const [draft, setDraft] = useState<Record<string, Partial<AiTokenPlanConfig>>>({});
  const [pendingSave, setPendingSave] = useState<{
    planKey: string;
    body: Partial<AiTokenPlanConfig>;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: ({ planKey, body }: { planKey: string; body: Partial<AiTokenPlanConfig> }) =>
      updateAiTokenPlan(planKey, body),
    onSuccess: (_, { planKey }) => {
      toast.success("Plan updated");
      setDraft((prev) => {
        const next = { ...prev };
        delete next[planKey];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["ai-token-plans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (plansQuery.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  const save = (plan: AiTokenPlanConfig, body: Partial<AiTokenPlanConfig>) => {
    if (isReduction(plan, body)) {
      setPendingSave({ planKey: plan.planKey, body });
    } else {
      mutation.mutate({ planKey: plan.planKey, body });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Monthly allocation</TableHead>
            <TableHead>Chars/token override</TableHead>
            <TableHead>Rollover</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Last updated by</TableHead>
            <TableHead className="text-right">Save</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(plansQuery.data?.plans ?? []).map((plan) => {
            const d = draft[plan.planKey] ?? {};
            return (
              <TableRow key={plan.planKey}>
                <TableCell className="font-medium">{plan.planKey}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-32"
                    defaultValue={plan.monthlyTokenAllocation}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [plan.planKey]: {
                          ...prev[plan.planKey],
                          monthlyTokenAllocation: Number(e.target.value),
                        },
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-muted-foreground">-1 = unlimited</p>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-28"
                    placeholder="global default"
                    defaultValue={plan.charsPerTokenOverride ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [plan.planKey]: {
                          ...prev[plan.planKey],
                          charsPerTokenOverride:
                            e.target.value === "" ? null : Number(e.target.value),
                        },
                      }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    defaultChecked={plan.rolloverEnabled}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        [plan.planKey]: { ...prev[plan.planKey], rolloverEnabled: checked },
                      }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    defaultChecked={plan.isActive}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        [plan.planKey]: { ...prev[plan.planKey], isActive: checked },
                      }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <LastUpdatedBy user={plan.updatedByUser} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!d || Object.keys(d).length === 0 || mutation.isPending}
                    onClick={() => save(plan, d)}
                  >
                    Save
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog
        open={Boolean(pendingSave)}
        onOpenChange={(open) => !open && setPendingSave(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reduce {pendingSave?.planKey} access?</AlertDialogTitle>
            <AlertDialogDescription>
              This lowers the monthly token allocation or disables rollover for{" "}
              <span className="font-medium">{pendingSave?.planKey}</span> — workspaces on this plan
              will have less headroom starting next period. This can be changed back at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={mutation.isPending}
              onClick={() => {
                if (pendingSave) mutation.mutate(pendingSave);
                setPendingSave(null);
              }}
            >
              Confirm reduction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Tab 2: Global settings ─────────────────────────────────────────────────────

const settingsFieldSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .int("Must be a whole number");
const settingsSchema = z.object({
  defaultCharsPerToken: settingsFieldSchema.positive("Must be greater than 0"),
  minTokensPerGeneration: settingsFieldSchema.min(0, "Must be 0 or greater"),
  softLimitGraceTokens: settingsFieldSchema.min(0, "Must be 0 or greater"),
});

function SettingsTab() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["ai-token-settings"],
    queryFn: getAiTokenGlobalSettings,
  });
  const [form, setForm] = useState<{
    defaultCharsPerToken?: number;
    minTokensPerGeneration?: number;
    softLimitGraceTokens?: number;
  }>({});

  const mutation = useMutation({
    mutationFn: () => updateAiTokenGlobalSettings(form),
    onSuccess: () => {
      toast.success("Global settings updated");
      void queryClient.invalidateQueries({ queryKey: ["ai-token-settings"] });
      setForm({});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (settingsQuery.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }
  const settings = settingsQuery.data?.settings;

  const merged = {
    defaultCharsPerToken: form.defaultCharsPerToken ?? settings?.defaultCharsPerToken ?? 0,
    minTokensPerGeneration: form.minTokensPerGeneration ?? settings?.minTokensPerGeneration ?? 0,
    softLimitGraceTokens: form.softLimitGraceTokens ?? settings?.softLimitGraceTokens ?? 0,
  };
  const validation = settingsSchema.safeParse(merged);
  const fieldErrors = validation.success ? {} : validation.error.flatten().fieldErrors;

  return (
    <div className="max-w-md space-y-4 rounded-2xl border bg-card p-5">
      <div className="space-y-2">
        <Label>Default chars per token</Label>
        <Input
          type="number"
          defaultValue={settings?.defaultCharsPerToken}
          onChange={(e) => setForm((p) => ({ ...p, defaultCharsPerToken: Number(e.target.value) }))}
        />
        {fieldErrors.defaultCharsPerToken?.[0] && (
          <p className="text-xs text-destructive">{fieldErrors.defaultCharsPerToken[0]}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Used by any plan without a per-plan override. Applies on the next generation call — no
          deploy needed.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Min tokens per generation</Label>
        <Input
          type="number"
          defaultValue={settings?.minTokensPerGeneration}
          onChange={(e) =>
            setForm((p) => ({ ...p, minTokensPerGeneration: Number(e.target.value) }))
          }
        />
        {fieldErrors.minTokensPerGeneration?.[0] && (
          <p className="text-xs text-destructive">{fieldErrors.minTokensPerGeneration[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Soft-limit grace tokens</Label>
        <Input
          type="number"
          defaultValue={settings?.softLimitGraceTokens}
          onChange={(e) => setForm((p) => ({ ...p, softLimitGraceTokens: Number(e.target.value) }))}
        />
        {fieldErrors.softLimitGraceTokens?.[0] && (
          <p className="text-xs text-destructive">{fieldErrors.softLimitGraceTokens[0]}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Allows slight overage before a workspace is hard-blocked.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <Button
          disabled={Object.keys(form).length === 0 || !validation.success || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Save settings
        </Button>
        {settings?.updatedByUser && (
          <span className="text-xs text-muted-foreground">
            Last updated by {settings.updatedByUser.email}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Workspace usage ─────────────────────────────────────────────────────

function usagePercent(row: {
  allocatedTokens: number;
  consumedTokens: number;
  bonusTokens: number;
}): number | null {
  if (row.allocatedTokens === -1) return null;
  const total = row.allocatedTokens + row.bonusTokens;
  if (total <= 0) return 100;
  return Math.min(100, Math.round((row.consumedTokens / total) * 100));
}

function WorkspacesTab({ onViewLedger }: { onViewLedger: (workspaceId: string) => void }) {
  const queryClient = useQueryClient();
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [sortBy, setSortBy] = useState<"consumed" | "percent" | "remaining">("consumed");
  const [page, setPage] = useState(0);
  const usageQuery = useQuery({
    queryKey: ["ai-token-workspaces", workspaceFilter, sortBy, page],
    queryFn: () =>
      listAiTokenWorkspaceUsage({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sortBy,
        workspaceId: workspaceFilter.trim() || undefined,
      }),
  });
  const [grantTarget, setGrantTarget] = useState<string | null>(null);
  const [grantTokens, setGrantTokens] = useState("");
  const [grantNote, setGrantNote] = useState("");

  const grantMutation = useMutation({
    mutationFn: (workspaceId: string) =>
      grantAiTokens(workspaceId, { tokens: Number(grantTokens), note: grantNote }),
    onSuccess: () => {
      toast.success("Bonus tokens granted");
      void queryClient.invalidateQueries({ queryKey: ["ai-token-workspaces"] });
      setGrantTarget(null);
      setGrantTokens("");
      setGrantNote("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by workspace ID…"
          className="max-w-xs"
          value={workspaceFilter}
          onChange={(e) => {
            setWorkspaceFilter(e.target.value);
            setPage(0);
          }}
        />
        <Select
          value={sortBy}
          onValueChange={(v) => {
            setSortBy(v as typeof sortBy);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="consumed">Sort: most consumed</SelectItem>
            <SelectItem value="percent">Sort: % used</SelectItem>
            <SelectItem value="remaining">Sort: least remaining</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {usageQuery.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Consumed</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead className="w-40">% Used</TableHead>
                <TableHead>Period ends</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usageQuery.data?.workspaces ?? []).map((row) => {
                const pct = usagePercent(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.workspaceId}</TableCell>
                    <TableCell>{row.planKeySnapshot}</TableCell>
                    <TableCell>
                      {row.allocatedTokens === -1
                        ? "Unlimited"
                        : row.allocatedTokens.toLocaleString()}
                    </TableCell>
                    <TableCell>{row.consumedTokens.toLocaleString()}</TableCell>
                    <TableCell>{row.bonusTokens.toLocaleString()}</TableCell>
                    <TableCell>
                      {pct === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Progress
                            value={pct}
                            className={cn(
                              "h-1.5 w-20",
                              pct >= 80 && "bg-destructive/15 [&>div]:bg-destructive",
                            )}
                          />
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{new Date(row.periodEnd).toLocaleDateString()}</TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewLedger(row.workspaceId)}
                      >
                        View ledger
                      </Button>
                      <Button size="sm" onClick={() => setGrantTarget(row.workspaceId)}>
                        Grant bonus
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            setPage={setPage}
            total={usageQuery.data?.total ?? 0}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}

      <Dialog open={Boolean(grantTarget)} onOpenChange={(open) => !open && setGrantTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant bonus tokens</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tokens</Label>
              <Input
                type="number"
                value={grantTokens}
                onChange={(e) => setGrantTokens(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                placeholder="Reason for grant"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!grantTokens || !grantNote || grantMutation.isPending}
              onClick={() => grantTarget && grantMutation.mutate(grantTarget)}
            >
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Tab 4: Feature metering ─────────────────────────────────────────────────────

type FeatureListResponse = { features: AiFeatureRegistryRow[] };
const FEATURES_QUERY_KEY = ["ai-feature-registry"];

function FeaturesTab() {
  const queryClient = useQueryClient();
  const featuresQuery = useQuery({ queryKey: FEATURES_QUERY_KEY, queryFn: listAiFeatureRegistry });

  const mutation = useMutation({
    mutationFn: ({ featureKey, isMetered }: { featureKey: string; isMetered: boolean }) =>
      updateAiFeatureMetering(featureKey, { isMetered }),
    onMutate: async ({ featureKey, isMetered }) => {
      await queryClient.cancelQueries({ queryKey: FEATURES_QUERY_KEY });
      const previous = queryClient.getQueryData<FeatureListResponse>(FEATURES_QUERY_KEY);
      queryClient.setQueryData<FeatureListResponse>(FEATURES_QUERY_KEY, (old) =>
        old
          ? {
              features: old.features.map((f) =>
                f.featureKey === featureKey ? { ...f, isMetered } : f,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(FEATURES_QUERY_KEY, context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FEATURES_QUERY_KEY });
    },
  });

  if (featuresQuery.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  const bySurface = (featuresQuery.data?.features ?? []).reduce<
    Record<string, AiFeatureRegistryRow[]>
  >((acc, f) => {
    (acc[f.surface] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(bySurface).map(([surface, rows]) => (
        <div key={surface} className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{surface}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Metered</TableHead>
                <TableHead>Last updated by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.featureKey}>
                  <TableCell className="font-medium">{f.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">{f.description ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={f.isMetered}
                      onCheckedChange={(checked) =>
                        mutation.mutate({ featureKey: f.featureKey, isMetered: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <LastUpdatedBy user={f.updatedByUser} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}

// ── Tab 5: standalone cross-workspace usage ledger ─────────────────────────────

const LEDGER_ENTRY_TYPES: Array<AiTokenLedgerEntryType | "ALL"> = [
  "ALL",
  "CONSUMPTION",
  "MANUAL_GRANT",
  "PERIOD_RESET",
  "REFUND",
  "ADJUSTMENT",
];

function LedgerTab({
  workspaceFilter,
  setWorkspaceFilter,
}: {
  workspaceFilter: string;
  setWorkspaceFilter: (v: string) => void;
}) {
  const [entryType, setEntryType] = useState<AiTokenLedgerEntryType | "ALL">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const ledgerQuery = useQuery({
    queryKey: ["ai-token-ledger-all", workspaceFilter, entryType, from, to, page],
    queryFn: () =>
      listAiTokenLedger({
        workspaceId: workspaceFilter.trim() || undefined,
        entryType: entryType === "ALL" ? undefined : entryType,
        from: from || undefined,
        to: to || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Workspace ID</Label>
          <Input
            placeholder="Filter by workspace ID…"
            className="w-56"
            value={workspaceFilter}
            onChange={(e) => {
              setWorkspaceFilter(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Entry type</Label>
          <Select
            value={entryType}
            onValueChange={(v) => {
              setEntryType(v as AiTokenLedgerEntryType | "ALL");
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEDGER_ENTRY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "ALL" ? "All types" : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {ledgerQuery.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Balance after</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ledgerQuery.data?.ledger ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">{entry.workspaceId ?? "—"}</TableCell>
                  <TableCell>{entry.entryType}</TableCell>
                  <TableCell
                    className={entry.tokensDelta < 0 ? "text-destructive" : "text-success"}
                  >
                    {entry.tokensDelta > 0 ? "+" : ""}
                    {entry.tokensDelta}
                  </TableCell>
                  <TableCell>{entry.balanceAfter}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.note ?? "—"}</TableCell>
                  <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(ledgerQuery.data?.ledger ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No ledger entries match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            setPage={setPage}
            total={ledgerQuery.data?.total ?? 0}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}
    </>
  );
}
