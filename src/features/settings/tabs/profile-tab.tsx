import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Country } from "country-state-city";
import { Loader2, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { accountApi } from "@/lib/api/account-api";
import { setAccountCountry } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/http";
import { useAuthState } from "@/lib/auth/auth-store";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { SettingRow, SettingsCard, StatusChip, shortDate } from "../components";

/** Upload limits mirror the server's (`avatarService.AVATAR_MAX_BYTES`); the server re-checks. */
const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

/** IANA zones from the runtime — never a hardcoded list. */
function supportedTimezones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  const zones = intl.supportedValuesOf?.("timeZone") ?? [];
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

function tzLabel(tz: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return part ? `${tz.replace(/_/g, " ")} (${part})` : tz;
  } catch {
    return tz;
  }
}

/** Longest dialling code that prefixes the stored E.164 number. */
function splitPhone(
  e164: string | null | undefined,
  codes: string[],
): { code: string; number: string } {
  if (!e164) return { code: "", number: "" };
  const digits = e164.replace(/^\+/, "");
  const code =
    [...codes].sort((a, b) => b.length - a.length).find((c) => digits.startsWith(c)) ?? "";
  return { code, number: digits.slice(code.length) };
}

export function ProfileTab() {
  const user = useAuthState((s) => s.user);
  const role = useAuthState((s) => s.role);
  const mfaEnabled = useAuthState((s) => s.mfaEnabled);
  const emailVerified = useAuthState((s) => s.emailVerified);
  const queryClient = useQueryClient();

  const countries = useMemo(() => Country.getAllCountries(), []);
  const dialCodes = useMemo(
    () =>
      Array.from(
        new Set(
          countries.map((c) => c.phonecode.replace(/^\+/, "").split(/[ -]/)[0]).filter(Boolean),
        ),
      ),
    [countries],
  );
  const timezones = useMemo(() => supportedTimezones(), []);
  const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const initial = useMemo(() => {
    const phone = splitPhone(user?.phoneNumber, dialCodes);
    const countryDial =
      countries.find((c) => c.isoCode === user?.country)?.phonecode.replace(/^\+/, "") ?? "";
    return {
      name: user?.name ?? "",
      timezone: user?.timezone ?? (timezones.includes(browserTz) ? browserTz : ""),
      country: user?.country ?? "",
      phoneCode: phone.code || countryDial,
      phoneNumber: phone.number,
    };
  }, [user, dialCodes, countries, timezones, browserTz]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [countryLocked, setCountryLocked] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => setForm(initial), [initial]);

  if (!user) return null;

  const storedPhone = user.phoneNumber ?? "";
  const nextPhone = form.phoneNumber
    ? `+${form.phoneCode}${form.phoneNumber.replace(/\D/g, "")}`
    : "";
  const dirty = {
    name: form.name.trim() !== (user.name ?? ""),
    timezone: form.timezone !== (user.timezone ?? "") && form.timezone !== "",
    country: form.country !== (user.country ?? "") && form.country !== "",
    phone: nextPhone !== storedPhone,
  };
  const isDirty = Object.values(dirty).some(Boolean);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["auth-me"] });

  const save = async () => {
    setSaving(true);
    try {
      if (dirty.name || dirty.timezone) {
        await accountApi.updateProfile({
          ...(dirty.name ? { name: form.name.trim() } : {}),
          ...(dirty.timezone ? { timezone: form.timezone } : {}),
        });
      }
      if (dirty.phone) await accountApi.updatePhone(nextPhone);
      if (dirty.country) {
        try {
          await setAccountCountry(form.country);
        } catch (e) {
          if (e instanceof ApiError && e.code === "COUNTRY_LOCKED") {
            setCountryLocked(e.message);
            setForm((f) => ({ ...f, country: user.country ?? "" }));
          }
          throw e;
        }
      }
      toast.success("Profile saved");
    } catch (e) {
      toast.error(getUserErrorMessage(e));
    } finally {
      await refresh();
      setSaving(false);
    }
  };

  const onPickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarBusy(true);
    try {
      await accountApi.uploadAvatar(file);
      await refresh();
      toast.success("Photo updated");
    } catch (e) {
      toast.error(getUserErrorMessage(e));
    } finally {
      setAvatarBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await accountApi.removeAvatar();
      await refresh();
    } catch (e) {
      toast.error(getUserErrorMessage(e));
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-soft sm:flex-row sm:items-center">
        <UserAvatar
          userId={user.id}
          name={user.name}
          avatarUrl={user.avatarUrl}
          size={72}
          animate
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">{user.name}</h2>
            {role && <StatusChip tone="muted">{role}</StatusChip>}
          </div>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          {user.createdAt && (
            <p className="text-xs text-muted-foreground">
              Member since {shortDate(user.createdAt)}
            </p>
          )}
        </div>
        <Link
          to="/settings/security"
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:border-primary/40"
        >
          <ShieldCheck className={mfaEnabled ? "h-4 w-4 text-success" : "h-4 w-4 text-warning"} />
          {mfaEnabled ? "Account protected · 2FA on" : "Turn on 2FA"}
        </Link>
      </div>

      <SettingsCard
        title="Personal info"
        description="How you show up to your team in every workspace."
      >
        <SettingRow
          label="Profile photo"
          hint="No photo? You get your own blob, and it never changes."
        >
          <input
            ref={fileInput}
            type="file"
            accept={AVATAR_ACCEPT}
            className="hidden"
            onChange={(e) => void onPickAvatar(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={avatarBusy}
            onClick={() => fileInput.current?.click()}
          >
            {avatarBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload photo
          </Button>
          {user.avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              disabled={avatarBusy}
              onClick={() => void removeAvatar()}
            >
              Remove
            </Button>
          )}
          <p className="w-full text-right text-xs text-muted-foreground">
            JPG, PNG or WebP, up to 5 MB.
          </p>
        </SettingRow>

        <SettingRow
          label="Full name"
          hint="Shown to teammates and on invoices."
          htmlFor="profile-name"
        >
          <Input
            id="profile-name"
            className="sm:max-w-xs"
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </SettingRow>

        <SettingRow label="Email" hint="Used to sign in and for account alerts.">
          <span className="truncate text-sm">{user.email}</span>
          <StatusChip tone={emailVerified ? "success" : "warning"}>
            {emailVerified ? "Verified" : "Not verified"}
          </StatusChip>
          <Link
            to="/settings/security"
            className="text-sm font-medium text-primary hover:underline"
          >
            Change in Security
          </Link>
        </SettingRow>

        <SettingRow
          label="Phone"
          hint="Optional. For account recovery once SMS is live."
          htmlFor="profile-phone"
        >
          <Select
            value={form.phoneCode}
            onValueChange={(v) => setForm((f) => ({ ...f, phoneCode: v }))}
          >
            <SelectTrigger className="w-24" aria-label="Country code">
              <SelectValue placeholder="+" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {dialCodes.map((code) => (
                <SelectItem key={code} value={code}>
                  +{code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="profile-phone"
            className="w-40"
            inputMode="tel"
            placeholder="9876543210"
            value={form.phoneNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, phoneNumber: e.target.value.replace(/[^\d]/g, "") }))
            }
          />
          {user.phoneNumber && (
            <StatusChip tone={user.phoneVerified ? "success" : "muted"}>
              {user.phoneVerified ? "Verified" : "Not verified"}
            </StatusChip>
          )}
          <StatusChip tone="muted">SMS verification coming soon</StatusChip>
        </SettingRow>

        <SettingRow
          label="Country"
          hint={
            countryLocked ?? "Sets your billing currency. Locked while a subscription is active."
          }
        >
          <Select
            value={form.country}
            disabled={Boolean(countryLocked)}
            onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
          >
            <SelectTrigger className="sm:w-64" aria-label="Country">
              <SelectValue placeholder="Choose your country" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {countries.map((c) => (
                <SelectItem key={c.isoCode} value={c.isoCode}>
                  {c.flag} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="Timezone"
          hint={
            user.timezone ? "Used for dates across Liffio." : "We picked this from your browser."
          }
        >
          <Select
            value={form.timezone}
            onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
          >
            <SelectTrigger className="sm:w-72" aria-label="Timezone">
              <SelectValue placeholder="Choose a timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {timezones.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tzLabel(tz)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsCard>

      {isDirty && (
        <div className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg md:bottom-6">
          <span className="text-sm">You have unsaved changes</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => setForm(initial)}>
              Discard
            </Button>
            <Button size="sm" disabled={saving || !form.name.trim()} onClick={() => void save()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
