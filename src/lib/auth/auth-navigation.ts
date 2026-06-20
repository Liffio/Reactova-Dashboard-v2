export const AFFILIATE_PROGRAM_PATH = "/affiliate";

export function isAffiliateProgramRedirect(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }
  try {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const pathname = new URL(normalized, "http://localhost").pathname;
    return (
      pathname === AFFILIATE_PROGRAM_PATH || pathname.startsWith(`${AFFILIATE_PROGRAM_PATH}/`)
    );
  } catch {
    return false;
  }
}

const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/confirm-email"];

/** Only allow same-origin relative paths (prevents open redirects and redirect loops). */
export function sanitizeAuthRedirect(
  path: string | null | undefined,
  fallback = "/dashboard"
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
  fallback = "/dashboard"
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

export function loginPathWithRedirect(returnTo: string): string {
  const pathname = returnTo.split("?")[0];
  if (AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return "/login";
  }
  return `/login?redirect=${encodeURIComponent(returnTo)}`;
}
