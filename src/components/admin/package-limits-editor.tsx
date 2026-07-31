import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PACKAGE_LIMIT_KEYS, type PackageLimit } from "@/lib/api/registry-api";

/**
 * Editing a package's numeric quotas.
 *
 * A package overrides a limit or inherits it. An unlisted key means "use the plan's value" — the
 * same "unassigned means unchanged" rule the entitlement ceiling follows — so the editor sends only
 * the keys that are actually overridden. `-1` is unlimited; the resolver turns it into a number
 * above every enforcement threshold.
 */

const LABELS: Record<(typeof PACKAGE_LIMIT_KEYS)[number], { label: string; hint: string }> = {
  workflows: { label: "Automation workflows", hint: "Total active automations." },
  dmFollowUps: { label: "DM follow-ups", hint: "Follow-up messages per automation." },
  teamMembers: { label: "Team members", hint: "Seats in the workspace." },
  workspacesIncluded: { label: "Workspaces included", hint: "For agency plans." },
  maxApiCredentials: { label: "API credentials", hint: "Active API keys." },
  apiRequestsPerDay: { label: "API requests / day", hint: "External API calls." },
  schedulerPostsPerDay: { label: "Scheduled posts / day", hint: "Via the external API." },
  automationsPerDay: { label: "Automations / day", hint: "Created via the external API." },
};

export function PackageLimitsEditor({
  value,
  onChange,
}: {
  value: PackageLimit[];
  onChange: (next: PackageLimit[]) => void;
}) {
  const byKey = new Map(value.map((l) => [l.key, l.value]));

  const setKey = (key: string, next: number | null) => {
    const others = value.filter((l) => l.key !== key);
    onChange(next === null ? others : [...others, { key, value: next }]);
  };

  return (
    <div className="divide-y rounded-lg border">
      {PACKAGE_LIMIT_KEYS.map((key) => {
        const overridden = byKey.has(key);
        const raw = byKey.get(key);
        const unlimited = raw === -1;
        const meta = LABELS[key];

        return (
          <div key={key} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm">{meta.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch
                  checked={overridden}
                  onCheckedChange={(on) => setKey(key, on ? 0 : null)}
                  aria-label={`Override ${meta.label}`}
                />
                Override
              </label>

              {overridden && (
                <>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    disabled={unlimited}
                    value={unlimited ? "" : String(raw ?? 0)}
                    placeholder={unlimited ? "∞" : "0"}
                    onChange={(e) => setKey(key, e.target.value === "" ? 0 : Number(e.target.value))}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch
                      checked={unlimited}
                      onCheckedChange={(on) => setKey(key, on ? -1 : 0)}
                      aria-label={`Unlimited ${meta.label}`}
                    />
                    ∞
                  </label>
                </>
              )}

              {!overridden && (
                <span className="text-xs text-muted-foreground">Inherits plan</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
