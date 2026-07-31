// Central place for input length limits + validators used across every form in the app.
// Keep UI maxLength attributes and these constants in sync — changing a limit here
// does not change the maxLength prop on the input, both must be updated together.

export const LIMITS = {
  workspaceName: { min: 2, max: 20 },
  displayName: { min: 1, max: 15 },
  email: { max: 254 },
  password: { min: 8, max: 128 },
  apiKeyName: { min: 2, max: 60 },
  automationName: { min: 1, max: 120 },
  dmMessage: { min: 1, max: 900 },
  replyMessage: { max: 140 },
  followUpMessage: { max: 900 },
  buttonLabel: { max: 30 },
  buttonUrl: { max: 500 },
  keyword: { max: 40 },
  bioLinkBio: { max: 160 },
  bioLinkSlug: { min: 3, max: 40 },
  linkTitle: { min: 1, max: 60 },
  url: { max: 2048 },
  socialLabel: { min: 1, max: 40 },
  shortLinkSlug: { min: 3, max: 60 },
  shortLinkDestination: { max: 2048 },
  emailSubject: { min: 1, max: 150 },
  emailBody: { min: 1, max: 50000 },
  genericName: { min: 1, max: 100 },
  genericNote: { max: 500 },
  postCaption: { max: 2200 },
} as const;

// RFC 5321-ish practical email check — deliberately not fully compliant with the
// email spec (nobody's inbox needs quoted-string local parts); this catches the
// typos and garbage that matter for a signup/invite form.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= LIMITS.email.max && EMAIL_RE.test(v);
}

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Email is required.";
  if (v.length > LIMITS.email.max) return `Email must be ${LIMITS.email.max} characters or fewer.`;
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

// Providers that ignore dots in the local part and/or treat "+tag" as an alias
// of the base address. Only providers with *documented* alias behavior are
// listed — normalizing dots/plus for an arbitrary domain would falsely merge
// two genuinely different mailboxes.
const DOT_INSENSITIVE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const PLUS_ALIAS_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "protonmail.com",
  "proton.me",
  "fastmail.com",
  "icloud.com",
]);

/**
 * Canonicalizes an email so provider-level aliasing (gmail dots, "+tag" on
 * most major providers) collapses to one identity — e.g. bhesaniaom@gmail.com,
 * bhesania+1@gmail.com, and bhesania.om@gmail.com all normalize to the same
 * string. Use this for duplicate detection (invites, member lists), never as
 * the value actually sent to an API — the user's literal input still has to
 * be delivered to.
 */
export function canonicalizeEmail(value: string): string {
  const v = value.trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at < 0) return v;
  const domain = v.slice(at + 1);
  let local = v.slice(0, at);
  if (PLUS_ALIAS_DOMAINS.has(domain)) {
    const plus = local.indexOf("+");
    if (plus >= 0) local = local.slice(0, plus);
  }
  if (DOT_INSENSITIVE_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

export function isSameEmail(a: string, b: string): boolean {
  return canonicalizeEmail(a) === canonicalizeEmail(b);
}

/**
 * Given a candidate email and a list of already-used emails, returns an error
 * if the candidate is an alias (dot/plus variant) of one already in the list.
 */
export function duplicateAliasError(value: string, existing: string[]): string | null {
  const canonical = canonicalizeEmail(value);
  const match = existing.find((e) => canonicalizeEmail(e) === canonical);
  if (match && match.trim().toLowerCase() !== value.trim().toLowerCase()) {
    return `This looks like an alias of an email already on this workspace (${match}) — "+" and "." variants count as the same address.`;
  }
  if (match) return `This email is already on this workspace.`;
  return null;
}

export function isValidUrl(value: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function urlError(
  value: string,
  opts: { required?: boolean; max?: number } = {},
): string | null {
  const v = value.trim();
  if (!v) return opts.required ? "URL is required." : null;
  const max = opts.max ?? LIMITS.url.max;
  if (v.length > max) return `URL must be ${max} characters or fewer.`;
  if (!isValidUrl(v)) return "Enter a valid URL starting with http:// or https://.";
  return null;
}

export function lengthError(
  value: string,
  label: string,
  { min = 0, max }: { min?: number; max: number },
): string | null {
  const v = value.trim();
  if (v.length < min) {
    return min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`;
  }
  if (v.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}
