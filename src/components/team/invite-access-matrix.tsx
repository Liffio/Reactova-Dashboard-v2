import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { GrantableAccess, GrantableItem, GrantablePolicy, GrantReason } from "@/lib/api/team-api";

const REASON_LABEL: Record<GrantReason, string> = {
  not_held: "Outside your own access",
  not_entitled: "Not included in this workspace's package",
  module_disabled: "This module is disabled",
  protected: "Protected system permission",
};

/**
 * The invite access matrix. A ticked box is the invitee's EFFECTIVE permission (matrix semantics):
 * the selected role's grants are pre-ticked as the baseline, so unticking one expresses a DENY, and
 * ticking an extra grantable one expresses an ALLOW. Ungrantable cells are disabled with the reason
 * the server gave, so the UI never offers a control the server would reject.
 */
export function InviteAccessMatrix({
  grantable,
  roleGrantKeys,
  selected,
  selectedPolicies,
  onToggle,
  onTogglePolicy,
}: {
  grantable: GrantableAccess;
  roleGrantKeys: Set<string>;
  selected: Set<string>;
  selectedPolicies: Set<string>;
  onToggle: (key: string, next: boolean) => void;
  onTogglePolicy: (key: string, next: boolean) => void;
}) {
  const modules = useMemo(() => {
    const byModule = new Map<string, { key: string; permissions: GrantableItem[]; capabilities: GrantableItem[] }>();
    const ensure = (moduleKey: string) => {
      let m = byModule.get(moduleKey);
      if (!m) {
        m = { key: moduleKey, permissions: [], capabilities: [] };
        byModule.set(moduleKey, m);
      }
      return m;
    };
    for (const p of grantable.permissions) ensure(p.moduleKey).permissions.push(p);
    for (const c of grantable.capabilities) ensure(c.moduleKey).capabilities.push(c);
    return [...byModule.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [grantable]);

  return (
    <div className="space-y-4">
      {modules.map((mod) => (
        <div key={mod.key} className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-semibold capitalize">{mod.key.replace(/_/g, " ")}</p>

          {mod.permissions.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
              {mod.permissions.map((item) => (
                <Cell
                  key={item.key}
                  item={item}
                  label={item.action}
                  isRoleGrant={roleGrantKeys.has(item.key)}
                  checked={selected.has(item.key)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}

          {mod.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-3">
              {mod.capabilities.map((item) => (
                <Cell
                  key={item.key}
                  item={item}
                  label={item.label ?? item.action}
                  isRoleGrant={roleGrantKeys.has(item.key)}
                  checked={selected.has(item.key)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {grantable.policies.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Policies</p>
          <div className="flex flex-col gap-2">
            {grantable.policies.map((policy) => (
              <PolicyRow
                key={policy.key}
                policy={policy}
                checked={selectedPolicies.has(policy.key)}
                onToggle={onTogglePolicy}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({
  item,
  label,
  isRoleGrant,
  checked,
  onToggle,
}: {
  item: GrantableItem;
  label: string;
  isRoleGrant: boolean;
  checked: boolean;
  onToggle: (key: string, next: boolean) => void;
}) {
  // A role grant is always interactive (you may untick it to DENY). A non-role key is interactive
  // only if the inviter may grant it; otherwise it is shown disabled with the server's reason.
  const interactive = item.grantable || isRoleGrant;
  const control = (
    <label
      className={`flex items-center gap-2 text-sm ${interactive ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
    >
      <Checkbox
        checked={checked}
        disabled={!interactive}
        onCheckedChange={(v) => onToggle(item.key, v === true)}
      />
      <span className="capitalize">{label.replace(/_/g, " ")}</span>
      {isRoleGrant && (
        <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground">
          role
        </Badge>
      )}
    </label>
  );

  if (interactive) return control;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent>{item.reason ? REASON_LABEL[item.reason] : "Not available"}</TooltipContent>
    </Tooltip>
  );
}

function PolicyRow({
  policy,
  checked,
  onToggle,
}: {
  policy: GrantablePolicy;
  checked: boolean;
  onToggle: (key: string, next: boolean) => void;
}) {
  const control = (
    <label
      className={`flex items-center gap-2 text-sm ${policy.grantable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
    >
      <Checkbox
        checked={checked}
        disabled={!policy.grantable}
        onCheckedChange={(v) => onToggle(policy.key, v === true)}
      />
      <span>{policy.key}</span>
      <Badge variant="outline" className="h-4 px-1 text-[9px]">
        {policy.effect}
      </Badge>
    </label>
  );
  if (policy.grantable) return control;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent>{policy.reason ? REASON_LABEL[policy.reason] : "Not available"}</TooltipContent>
    </Tooltip>
  );
}
