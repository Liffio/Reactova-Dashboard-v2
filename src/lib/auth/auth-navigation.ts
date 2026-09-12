export const AFFILIATE_PROGRAM_PATH = "/affiliate";

const LIFFIO_ORIGIN: string =
  (import.meta.env.VITE_LIFFIO_URL as string | undefined) ?? "https://liffio.com";

export function isAffiliateProgramRedirect(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }
  try {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const pathname = new URL(normalized, "http://localhost").pathname;
    return pathname === AFFILIATE_PROGRAM_PATH || pathname.startsWith(`${AFFILIATE_PROGRAM_PATH}/`);
  } catch {
    return false;
  }
}

const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/confirm-email"];

/** Only allow same-origin relative paths (prevents open redirects and redirect loops). */
export function sanitizeAuthRedirect(
  path: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }
  // Never redirect back to auth-only pages — causes infinite loops
  const pathname = path.split("?")[0];
  if (AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return fallback;
  }
  return path;
}

export const postAuthLandingPath = (
  auth: { emailVerified: boolean; isOnboarded: boolean },
  fallback = "/dashboard",
): string => {
  const target = sanitizeAuthRedirect(fallback);

  if (!auth.emailVerified) {
    const confirm = "/confirm-email";
    if (target !== "/dashboard") {
      return `${confirm}?redirect=${encodeURIComponent(target)}`;
    }
    return confirm;
  }

  if (!auth.isOnboarded && !isAffiliateProgramRedirect(target)) {
    return "/onboarding";
  }

  return target;
};

/** Returns the liffio.com login URL with return path encoded. */
export function loginPathWithRedirect(returnTo: string): string {
  return `${LIFFIO_ORIGIN}/login?redirect=${encodeURIComponent(returnTo)}`;
}

/** Returns the liffio.com register URL. */
export function registerUrl(redirect?: string): string {
  const base = `${LIFFIO_ORIGIN}/register`;
  return redirect ? `${base}?redirect=${encodeURIComponent(redirect)}` : base;
}

/**
 * 🔴 REMOVED: `onboardingUrl(token)`.
 *
 * Onboarding is an in-app route (`/onboarding`) as of `plan/onboarding-revamp.md`. The function it
 * replaced built `liffio.com/onboarding?token=<access token>` — a redirect to another origin with
 * a bearer token in the query string, which lands in browser history, in the Referer header of the
 * next request that page makes, and in any log that records URLs.
 *
 * `postAuthLandingPath` already returns the bare path `/onboarding`, and `ProtectedRoute`
 * navigates to it directly. Nothing needs to build a cross-origin onboarding URL any more, so
 * nothing should be able to.
 */

/** Returns the liffio.com confirm-email URL, passing the token. */
export function confirmEmailUrl(token: string, redirectPath?: string): string {
  const base = `${LIFFIO_ORIGIN}/confirm-email?token=${encodeURIComponent(token)}`;
  return redirectPath ? `${base}&redirect=${encodeURIComponent(redirectPath)}` : base;
}
