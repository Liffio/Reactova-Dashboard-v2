export const postAuthLandingPath = (
  auth: { emailVerified: boolean; isOnboarded: boolean },
  fallback = "/dashboard"
): string => {
  if (!auth.emailVerified) {
    return "/confirm-email";
  }
  if (!auth.isOnboarded) {
    return "/onboarding";
  }
  return fallback;
};
