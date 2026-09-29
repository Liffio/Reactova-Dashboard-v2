import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Globe2,
  History,
  Laptop,
  MapPin,
  Monitor,
  Smartphone,
  XCircle,
} from "lucide-react";

import { CopyableKey, FormSection } from "@/components/admin/form-page";
import { CountryFlag, countryName } from "@/components/country-flag";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/features/settings/components";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getAdminUserInsights,
  type AdminUserInsights,
  type AdminUserIpRecord,
} from "@/lib/api/admin-users-api";

/**
 * The superadmin user Overview's "everything else": where the account connects from (every IP,
 * geolocated server-side to a country), the rest of the account record, and how they found us.
 *
 * Fetched separately from the page shell's detail query (`GET /admin/users/:id/insights`), so the
 * header never waits on the IP aggregation.
 */

function useUserInsights(userId: string) {
  return useQuery({
    queryKey: ["admin-user", userId, "insights"],
    queryFn: () => getAdminUserInsights(userId),
  });
}

/* ─── User agent → something a person can read ───────────────────────────────────────────── */

type Device = { label: string; kind: "mobile" | "desktop" | "unknown" };

/**
 * "Chrome on Windows". Deliberately coarse — enough to tell "their phone" from "their laptop"
 * and spot an odd one out; the raw string is in the tooltip for anyone who needs the rest.
 * Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
 */
function describeUserAgent(ua: string | null | undefined): Device {
  if (!ua) return { label: "Unknown device", kind: "unknown" };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : /okhttp|axios|node-fetch|curl|python/i.test(ua)
                ? "API client"
                : "Browser";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  const mobile = /Mobi|iPhone|Android.*Mobile/.test(ua);
  return {
    label: os ? `${browser} on ${os}` : browser,
    kind: mobile ? "mobile" : os ? "desktop" : "unknown",
  };
}

function DeviceIcon({ kind, className }: { kind: Device["kind"]; className?: string }) {
  const Icon = kind === "mobile" ? Smartphone : kind === "desktop" ? Laptop : Monitor;
  return <Icon className={className} />;
}

/* ─── Network ─────────────────────────────────────────────────────────────────────────────── */

/**
 * Where the account connects from. Two headline tiles (latest and earliest known location), the
 * countries it has been seen in, then every IP as a row — Stripe-Radar-style: flag and country
 * first, because "which country" is the question, and the IP second, because it's the evidence.
 */
export function NetworkSection({
  userId,
  profileCountry,
}: {
  userId: string;
  profileCountry: string | null;
}) {
  const query = useUserInsights(userId);

  if (query.isLoading) {
    return (
      <FormSection title="Location & network">
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="mt-3 h-40 rounded-xl" />
      </FormSection>
    );
  }
  if (query.isError || !query.data) {
    return (
      <FormSection title="Location & network">
        <p className="text-sm text-muted-foreground">Couldn't load network history.</p>
      </FormSection>
    );
  }

  const { network } = query.data;
  const mismatch =
    profileCountry &&
    network.lastIp?.country &&
    network.lastIp.country !== profileCountry.toUpperCase();

  return (
    <FormSection
      title="Location & network"
      description={`Every IP this account signed in or acted from (sessions, plus the last ${network.lookbackDays} days of activity).`}
    >
      {network.ips.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Globe2 className="mx-auto mb-2 h-5 w-5" />
          No IP addresses recorded for this account yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <LocationTile
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Last seen from"
              record={network.lastIp}
              when={network.lastIp ? timeAgo(network.lastIp.lastSeenAt) : null}
            />
            <LocationTile
              icon={<History className="h-3.5 w-3.5" />}
              label="Earliest known location"
              record={network.signupIp}
              when={network.signupIp ? formatDateTime(network.signupIp.firstSeenAt) : null}
            />
          </div>

          {mismatch && (
            <p className="flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Profile country is {countryName(profileCountry)} but the latest IP is in{" "}
              {countryName(network.lastIp!.country)}. Often just travel or a VPN — worth a look if
              billing currency is in question.
            </p>
          )}

          {network.distinctCountries.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">
                Seen in {network.distinctCountries.length}{" "}
                {network.distinctCountries.length === 1 ? "country" : "countries"}
              </span>
              {network.distinctCountries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs"
                >
                  <CountryFlag code={c} />
                  {countryName(c)}
                </span>
              ))}
            </div>
          )}

          <ul className="divide-y overflow-hidden rounded-xl border">
            {network.ips.map((r) => (
              <IpRow key={r.ip} record={r} isLatest={r.ip === network.lastIp?.ip} />
            ))}
          </ul>

          <p className="text-[10px] text-muted-foreground">
            IP geolocation is country-level, from{" "}
            <a
              href="https://www.nro.net/"
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              NRO
            </a>{" "}
            data (CC BY 4.0), looked up on our server. Private and VPN-exit addresses may not
            reflect where the person actually is.
          </p>
        </div>
      )}
    </FormSection>
  );
}

function LocationTile({
  icon,
  label,
  record,
  when,
}: {
  icon: ReactNode;
  label: string;
  record: AdminUserIpRecord | null;
  when: string | null;
}) {
  if (!record) return null;
  const device = describeUserAgent(record.lastUserAgent);
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="mt-2.5 flex items-center gap-3">
        {record.country ? (
          <CountryFlag code={record.country} className="!h-7 !w-10 rounded" />
        ) : (
          <span className="grid h-7 w-10 place-items-center rounded bg-muted text-muted-foreground">
            <Globe2 className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">
            {record.country ? countryName(record.country) : "Private or unknown network"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{when}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <CopyableKey value={record.ip} className="max-w-full" />
        <span
          className="inline-flex items-center gap-1 text-muted-foreground"
          title={record.lastUserAgent ?? undefined}
        >
          <DeviceIcon kind={device.kind} className="h-3.5 w-3.5" />
          {device.label}
        </span>
      </div>
    </div>
  );
}

function IpRow({ record, isLatest }: { record: AdminUserIpRecord; isLatest: boolean }) {
  const device = describeUserAgent(record.lastUserAgent);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-3 py-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-center gap-2.5">
        {record.country ? (
          <CountryFlag code={record.country} className="!h-4 !w-6" />
        ) : (
          <Globe2 className="h-4 w-6 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {record.country ? countryName(record.country) : "Private / unknown"}
            {isLatest && (
              <span className="ml-1.5 rounded-full bg-success/10 px-1.5 py-px text-[10px] font-medium text-success">
                Latest
              </span>
            )}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{record.ip}</p>
        </div>
      </div>
      <span
        className="hidden min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground sm:inline-flex"
        title={record.lastUserAgent ?? undefined}
      >
        <DeviceIcon kind={device.kind} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{device.label}</span>
      </span>
      <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
        {record.sessions > 0 && `${record.sessions} sign-in${record.sessions === 1 ? "" : "s"}`}
        {record.sessions > 0 && record.events > 0 && " · "}
        {record.events > 0 && `${record.events} action${record.events === 1 ? "" : "s"}`}
      </span>
      <span
        className="whitespace-nowrap text-right text-xs text-muted-foreground"
        title={`First seen ${formatDateTime(record.firstSeenAt)} · last seen ${formatDateTime(record.lastSeenAt)}`}
      >
        {timeAgo(record.lastSeenAt)}
      </span>
    </li>
  );
}

/* ─── Account record ──────────────────────────────────────────────────────────────────────── */

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

function YesNo({ value, yes = "Yes", no = "No" }: { value: boolean; yes?: string; no?: string }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-success">
      <CheckCircle2 className="h-3.5 w-3.5" /> {yes}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <XCircle className="h-3.5 w-3.5" /> {no}
    </span>
  );
}

const dt = (iso: string | null) => (iso ? formatDateTime(iso) : "—");

/** The rest of the `users` row — the fields support asks about that the header doesn't show. */
export function AccountFactsSection({ userId }: { userId: string }) {
  const query = useUserInsights(userId);
  if (query.isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (!query.data) return null;
  const a: AdminUserInsights["account"] = query.data.account;

  return (
    <FormSection title="Account & security">
      {a.deletionScheduledFor && (
        <p className="mb-3 flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          Account deletion requested {dt(a.deletionRequestedAt)} — scheduled for{" "}
          {dt(a.deletionScheduledFor)}.
        </p>
      )}
      <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
        <Fact label="Timezone">{a.timezone ?? "—"}</Fact>
        <Fact label="Phone verified">
          <YesNo value={a.phoneVerified} />
        </Fact>
        <Fact label="Google linked">
          <YesNo value={a.googleLinked} />
        </Fact>
        <Fact label="Terms accepted">{dt(a.termsAcceptedAt)}</Fact>
        <Fact label="Password changed">{dt(a.passwordChangedAt)}</Fact>
        <Fact label="MFA prompt answered">{dt(a.mfaOnboardingConsentAt)}</Fact>
        <Fact label="Pending email change">{a.pendingEmail ?? "—"}</Fact>
        <Fact label="Last workspace">
          {a.lastActiveWorkspace ? (
            <Link
              to="/admin/users/$userId/workspaces/$wsId"
              params={{ userId, wsId: a.lastActiveWorkspace.id }}
              className="hover:underline"
            >
              {a.lastActiveWorkspace.name}
            </Link>
          ) : (
            "—"
          )}
        </Fact>
        <Fact label="Device fingerprint">
          {a.deviceFingerprint ? (
            <CopyableKey value={a.deviceFingerprint} className="max-w-[12rem]" />
          ) : (
            "—"
          )}
        </Fact>
        <Fact label="Record updated">{dt(a.updatedAt)}</Fact>
      </dl>
    </FormSection>
  );
}

/* ─── Signup source ───────────────────────────────────────────────────────────────────────── */

/** `utm_source` → "Source". Unknown keys are shown as-is, prettified. */
function attributionLabel(key: string): string {
  const k = key.replace(/^utm_/, "");
  return (
    k.charAt(0).toUpperCase() +
    k
      .slice(1)
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
  );
}

/** First-touch attribution exactly as the signup form recorded it. */
export function SignupSourceSection({ userId }: { userId: string }) {
  const query = useUserInsights(userId);
  if (query.isLoading) return <Skeleton className="h-32 rounded-2xl" />;
  if (!query.data) return null;
  const entries = Object.entries(query.data.signupAttribution ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <FormSection title="Signup source" description="First-touch attribution recorded at signup.">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No attribution was recorded for this signup.
        </p>
      ) : (
        <dl className="grid gap-x-8 text-sm sm:grid-cols-2">
          {entries.map(([k, v]) => (
            <Fact key={k} label={attributionLabel(k)}>
              <span className={cn("break-all", typeof v !== "string" && "font-mono text-xs")}>
                {typeof v === "string" ? v : JSON.stringify(v)}
              </span>
            </Fact>
          ))}
        </dl>
      )}
    </FormSection>
  );
}
