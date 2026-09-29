import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Country } from "country-state-city";
import {
  Camera,
  ChevronDown,
  Clock,
  Dices,
  Globe,
  Loader2,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { accountApi } from "@/lib/api/account-api";
import { setAccountCountry } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/http";
import { useAuthState } from "@/lib/auth/auth-store";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  OkChip,
  SelectField,
  SettingRow,
  SettingsButton,
  SettingsCard,
  SettingsPanel,
  StatusChip,
  TextField,
  textLinkClass,
} from "../components";

/** How many times Save rolls a fresh blob when the chosen one turns out to belong to someone else. */
const BLOB_SAVE_ATTEMPTS = 5;

/** A seed for a brand-new blob. The server fingerprints what it draws and enforces uniqueness. */
const randomBlobSeed = () => crypto.randomUUID();

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
    return part ? `${tz} (${part})` : tz;
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

function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function ProfileTab() {
  const user = useAuthState((s) => s.user);
  const role = useAuthState((s) => s.role);
  const mfaEnabled = useAuthState((s) => s.mfaEnabled);
  const emailVerified = useAuthState((s) => s.emailVerified);
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ["account-sessions"], queryFn: accountApi.listSessions });

  const countries = useMemo(() => Country.getAllCountries(), []);
  const dialCodes = useMemo(
    () =>
      Array.from(
        new Set(
          countries.map((c) => c.phonecode.replace(/^\+/, "").split(/[ -]/)[0]).filter(Boolean),
        ),
      ).sort((a, b) => Number(a) - Number(b)),
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
  /** A generated blob being previewed; null = showing the saved one. */
  const [previewSeed, setPreviewSeed] = useState<string | null>(null);
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
    blob: previewSeed !== null && previewSeed !== (user.avatarSeed || user.id),
  };
  const isDirty = Object.values(dirty).some(Boolean);
  const sessionCount = sessions.data?.sessions.length;
  const since = memberSince(user.createdAt);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["auth-me"] });
  /** While previewing, show the new blob (even over a photo) so the user can see what they'd get. */
  const shownSeed = previewSeed ?? user.avatarSeed;
  const shownPhoto = previewSeed ? null : user.avatarUrl;

  /**
   * Persist the previewed blob. The server refuses a blob another account owns (409 BLOB_TAKEN);
   * then we roll a new one, show it, and try again — so Save always ends on a blob that is yours.
   */
  const saveBlob = async (first: string) => {
    let seed = first;
    for (let attempt = 1; attempt <= BLOB_SAVE_ATTEMPTS; attempt++) {
      try {
        await accountApi.setAvatarSeed(seed);
        if (seed !== first) toast.info("That blob was already taken, so you got a fresh one");
        return;
      } catch (e) {
        if (!(e instanceof ApiError && e.code === "BLOB_TAKEN") || attempt === BLOB_SAVE_ATTEMPTS) {
          throw e;
        }
        seed = randomBlobSeed();
        setPreviewSeed(seed);
      }
    }
  };

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
      if (dirty.blob && previewSeed) await saveBlob(previewSeed);
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
      setPreviewSeed(null);
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

  const pickPhoto = () => fileInput.current?.click();

  return (
    <SettingsPanel>
      <input
        ref={fileInput}
        type="file"
        accept={AVATAR_ACCEPT}
        className="hidden"
        onChange={(e) => void onPickAvatar(e.target.files?.[0])}
      />

      {/* Identity hero */}
      <section className="relative overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_1px_2px_rgba(22,10,8,0.04),0_12px_32px_-16px_rgba(22,10,8,0.12)]">
        <div className="relative h-[88px] bg-brand-gradient">
          <svg
            width="100%"
            height="88"
            viewBox="0 0 1000 88"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0"
          >
            <path d="M0 64 Q 250 18 500 56 T 1000 36 V88 H0z" fill="#FFFFFF" fillOpacity="0.10" />
            <path d="M0 78 Q 312 46 625 74 T 1000 64 V88 H0z" fill="#FFFFFF" fillOpacity="0.12" />
          </svg>
        </div>
        <div className="relative -mt-10 flex flex-col gap-5 px-5 pb-[22px] sm:px-[26px] lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-[18px] sm:flex-row sm:items-end">
            <div
              className={cn(
                "relative self-start",
                // A photo keeps the white frame; the bare blob stands on its own.
                shownPhoto
                  ? "rounded-[30px] bg-card p-1 shadow-[0_6px_20px_-8px_rgba(178,13,143,0.35)]"
                  : "p-1",
              )}
            >
              <UserAvatar
                userId={user.id}
                name={user.name}
                avatarUrl={shownPhoto}
                seed={shownSeed}
                size={104}
                bare
              />
              <button
                type="button"
                aria-label="Change profile photo"
                disabled={avatarBusy}
                onClick={pickPhoto}
                className="absolute -bottom-1 -right-1 flex size-8 cursor-pointer items-center justify-center rounded-full border-[3px] border-card bg-[#160A08] p-0 text-white disabled:cursor-wait dark:bg-foreground dark:text-background"
              >
                {avatarBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5" strokeWidth={2} />
                )}
              </button>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 pb-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em] text-foreground">
                  {user.name}
                </h2>
                {role && <StatusChip tone="brand">{role}</StatusChip>}
              </div>
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{user.email}</span>
                </span>
                {since && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" strokeWidth={1.8} />
                    Member since {since}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link
            to="/settings/security"
            className={cn(
              "flex items-center gap-2.5 self-start rounded-[12px] px-3.5 py-2.5 no-underline lg:self-auto",
              mfaEnabled
                ? "bg-[#D5F1D5] text-[#012D07] hover:text-[#012D07] dark:bg-success-wash dark:text-success"
                : "bg-[#FDF1D6] text-[#8A5A00] hover:text-[#8A5A00] dark:bg-warning-wash dark:text-warning",
            )}
          >
            {mfaEnabled ? (
              <ShieldCheck className="size-[18px]" strokeWidth={2} />
            ) : (
              <ShieldAlert className="size-[18px]" strokeWidth={2} />
            )}
            <div className="flex flex-col">
              <span className="text-[13px] font-bold">
                {mfaEnabled ? "Account protected" : "Protect your account"}
              </span>
              <span className="text-xs">
                {mfaEnabled ? "2FA on" : "Turn on 2FA"}
                {sessionCount !== undefined &&
                  ` · ${sessionCount} active session${sessionCount === 1 ? "" : "s"}`}
              </span>
            </div>
          </Link>
        </div>
      </section>

      <SettingsCard
        title="Personal info"
        description="How you show up to your team in every workspace."
      >
        <SettingRow
          label="Profile photo"
          hint={
            user.avatarUrl && previewSeed
              ? "Your photo is shown instead of your blob. Remove the photo to use this blob."
              : "No photo? You get your own blob, and no one else has the same one. Roll a new one any time."
          }
        >
          <div className="flex flex-wrap items-center gap-[18px]">
            <UserAvatar
              key={shownSeed ?? user.id}
              userId={user.id}
              name={user.name}
              avatarUrl={shownPhoto}
              seed={shownSeed}
              size={76}
              bare
            />
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-2">
                <SettingsButton disabled={avatarBusy} onClick={pickPhoto}>
                  {avatarBusy ? <Loader2 className="animate-spin" /> : <Upload />}
                  <span>Upload photo</span>
                </SettingsButton>
                <SettingsButton
                  variant="ghost"
                  disabled={avatarBusy || !user.avatarUrl}
                  onClick={() => void removeAvatar()}
                >
                  <Trash2 />
                  <span>Remove</span>
                </SettingsButton>
                <SettingsButton
                  disabled={saving}
                  onClick={() => setPreviewSeed(randomBlobSeed())}
                  title="Generate a new blob. Save to keep it."
                >
                  <Dices />
                  <span>{previewSeed ? "Another one" : "New blob"}</span>
                </SettingsButton>
              </div>
              <span className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB.</span>
            </div>
          </div>
        </SettingRow>

        <SettingRow
          label="Full name"
          hint="Shown to teammates and on invoices."
          htmlFor="profile-name"
        >
          <TextField
            id="profile-name"
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </SettingRow>

        <SettingRow
          label="Email"
          hint="Used to sign in and for account alerts."
          htmlFor="profile-email"
        >
          <TextField
            id="profile-email"
            readOnly
            value={user.email}
            trailing={
              emailVerified ? (
                <OkChip>Verified</OkChip>
              ) : (
                <StatusChip tone="warning">Not verified</StatusChip>
              )
            }
          />
          <Link to="/settings/security" className={textLinkClass}>
            Change email in Security
          </Link>
        </SettingRow>

        <SettingRow
          label="Phone"
          hint="Optional. For account recovery once SMS is live."
          htmlFor="profile-phone"
        >
          <TextField
            id="profile-phone"
            inputMode="tel"
            placeholder="98765 43210"
            value={form.phoneNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, phoneNumber: e.target.value.replace(/[^\d]/g, "") }))
            }
            leading={
              <span className="relative flex h-[42px] shrink-0 items-center gap-1.5 border-r border-border px-3 text-sm font-medium text-foreground">
                {form.phoneCode ? `+${form.phoneCode}` : "+"}
                <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
                <select
                  aria-label="Country code"
                  value={form.phoneCode}
                  onChange={(e) => setForm((f) => ({ ...f, phoneCode: e.target.value }))}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  <option value="" disabled>
                    Code
                  </option>
                  {dialCodes.map((code) => (
                    <option key={code} value={code}>
                      +{code}
                    </option>
                  ))}
                </select>
              </span>
            }
          />
          <div className="flex flex-wrap gap-2">
            {user.phoneNumber && user.phoneVerified ? (
              <OkChip>Verified</OkChip>
            ) : (
              <StatusChip tone="muted">Not verified</StatusChip>
            )}
            <StatusChip tone="warning" icon={<Sparkles />}>
              SMS verification coming soon
            </StatusChip>
          </div>
        </SettingRow>

        <SettingRow
          label="Country"
          hint={
            countryLocked ?? "Sets your billing currency. Locked while a subscription is active."
          }
          htmlFor="profile-country"
        >
          <SelectField
            id="profile-country"
            icon={<Globe aria-hidden />}
            value={form.country}
            disabled={Boolean(countryLocked)}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          >
            <option value="" disabled>
              Choose your country
            </option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </SettingRow>

        <SettingRow
          label="Timezone"
          hint={
            user.timezone ? "Used for dates across Liffio." : "We picked this from your browser."
          }
          htmlFor="profile-timezone"
        >
          <SelectField
            id="profile-timezone"
            icon={<Clock aria-hidden />}
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          >
            <option value="" disabled>
              Choose a timezone
            </option>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tzLabel(tz)}
              </option>
            ))}
          </SelectField>
        </SettingRow>
      </SettingsCard>

      {isDirty && (
        <div className="sticky bottom-24 z-30 flex flex-col gap-3 rounded-[14px] bg-[#160A08] py-3.5 pl-5 pr-4 text-white shadow-[0_16px_40px_-16px_rgba(22,10,8,0.45)] sm:flex-row sm:items-center sm:justify-between md:bottom-4 dark:border dark:border-border dark:bg-card dark:text-foreground">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="inline-block size-2 rounded-full bg-[#FF7C49]" />
            You have unsaved changes
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setForm(initial);
                setPreviewSeed(null);
              }}
              className="h-10 cursor-pointer rounded-[10px] border border-[#3A2C29] bg-transparent px-4 text-sm font-semibold text-inherit hover:bg-white/5 disabled:opacity-45 dark:border-border"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving || !form.name.trim()}
              onClick={() => void save()}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-[#E8103F] px-[18px] text-sm font-semibold text-white hover:bg-[#C20F3B] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      )}
    </SettingsPanel>
  );
}
