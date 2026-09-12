import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getBrandingConfig,
  getWorkspaceUsage,
  listWorkspaces,
  updateWorkspace,
  type BrandingConfig,
  type WorkspaceApi,
  type WorkspaceUsage,
} from "@/lib/api/workspaces-api";
import {
  compactPatch,
  parseOnboardingState,
  type OnboardingPatch,
  type OnboardingState,
} from "@/lib/onboarding/onboarding-state";
import { useAuthState } from "@/lib/auth/auth-store";

/**
 * Everything the onboarding flow and the dashboard read out of `workspace.onboarding_state`.
 *
 * Reads ride the **same** `["workspaces", token]` query the app shell already runs, so opening
 * onboarding costs zero extra requests and a save updates every consumer at once. That matters
 * more than it sounds: the suggestion card, the checklist and the "skipped" note all derive from
 * this one object, and three independent fetches of it would be three chances to render three
 * different answers on the same screen.
 */
export function useOnboardingState(workspaceId: string | null | undefined): {
  state: OnboardingState;
  workspace: WorkspaceApi | null;
  isLoading: boolean;
} {
  const accessToken = useAuthState((s) => s.accessToken);
  const { data, isLoading } = useQuery({
    queryKey: ["workspaces", accessToken],
    queryFn: () => listWorkspaces(),
    enabled: Boolean(accessToken),
  });

  return useMemo(() => {
    const workspace = data?.find((w) => w.id === workspaceId) ?? null;
    return {
      state: parseOnboardingState(workspace?.onboardingState),
      workspace,
      isLoading,
    };
  }, [data, workspaceId, isLoading]);
}

/**
 * Save an answer. **Never blocks the user, and never surfaces a failure.**
 *
 * The spec is explicit: *"answers save after each screen. If a save fails, keep going and retry
 * quietly. Never block the user on it."* The reason is that nothing here is load-bearing —
 * `role` and `goal` reorder some options and pick a suggestion; losing one costs a slightly worse
 * default on a screen the user is about to leave anyway. Weighed against that, a spinner or an
 * error toast between two taps of an onboarding flow is a much larger cost than the thing it is
 * reporting.
 *
 * So:
 *
 * - the mutation is fired and not awaited by callers;
 * - it writes the new value into the workspaces cache **immediately**, so the next screen renders
 *   from the answer even if the request is still in flight (or never lands);
 * - failures retry twice and are then swallowed, with nothing shown; and
 * - on success the server's row replaces the optimistic one, so a rejected key corrects itself
 *   rather than lingering as a local fiction.
 *
 * ⚠️ The one save that genuinely matters is `suggestedTemplate.skippedAt` — it is what stops the
 * app asking the user to set up an automation after they said no. That still is not worth blocking
 * on, but it *is* worth the retries: a skip that silently fails means the app nags someone who
 * already declined, which is the single most annoying failure this flow has.
 */
export function useSaveOnboarding(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const accessToken = useAuthState((s) => s.accessToken);
  const queryKey = useMemo(() => ["workspaces", accessToken], [accessToken]);

  const mutation = useMutation({
    mutationFn: (input: { onboarding?: OnboardingPatch; isOnboarded?: boolean }) => {
      if (!workspaceId) {
        return Promise.reject(new Error("No workspace"));
      }
      return updateWorkspace(workspaceId, {
        ...(input.onboarding ? { onboarding: compactPatch(input.onboarding) } : {}),
        ...(input.isOnboarded != null ? { isOnboarded: input.isOnboarded } : {}),
      });
    },
    retry: 2,
    retryDelay: (attempt) => 500 * 2 ** attempt,
    onMutate: (input) => {
      // Optimistic, and deliberately not rolled back on error: if the write never lands, the
      // local value is still the best answer we have for this session, and reverting it mid-flow
      // would make the UI forget something the user just told us.
      queryClient.setQueryData<WorkspaceApi[]>(queryKey, (previous) =>
        previous?.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                onboardingState: {
                  ...(workspace.onboardingState ?? {}),
                  ...(input.onboarding ?? {}),
                  ...(input.isOnboarded != null ? { isOnboarded: input.isOnboarded } : {}),
                },
              }
            : workspace,
        ),
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<WorkspaceApi[]>(queryKey, (previous) =>
        previous?.map((workspace) =>
          workspace.id === updated.id
            ? { ...workspace, onboardingState: updated.onboardingState }
            : workspace,
        ),
      );
    },
    onError: () => {
      // Intentionally silent. See the note above.
    },
  });

  const save = useCallback(
    (onboarding: OnboardingPatch) => {
      mutation.mutate({ onboarding });
    },
    [mutation],
  );

  /** Reaching the dashboard ends onboarding, connected or not. */
  const markOnboarded = useCallback(() => {
    mutation.mutate({ isOnboarded: true });
  }, [mutation]);

  return { save, markOnboarded, saveWithFlags: mutation.mutate };
}

/**
 * The workspace's real automation/seat usage. Every "x of 3 on Free" reads from here.
 *
 * `staleTime` is deliberately non-zero: the numbers change only when the user creates something,
 * and the mutations that do so invalidate this key. Without it, each of the three components that
 * show a count would refetch on mount and the dashboard would fire three identical requests.
 */
export function useWorkspaceUsage(workspaceId: string | null | undefined) {
  return useQuery<WorkspaceUsage>({
    queryKey: ["workspace-usage", workspaceId],
    queryFn: () => getWorkspaceUsage(workspaceId!),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

/**
 * The Free-tier DM branding strings, from the server. (handoff item 7)
 *
 * Cached for the session: they are env-driven and change on deploy, not per request. Every DM
 * preview in the app renders from this — the demo, the "Set it up" live preview — so that what we
 * show is what we will actually send.
 */
export function useBrandingConfig() {
  return useQuery<BrandingConfig>({
    queryKey: ["branding-config"],
    queryFn: () => getBrandingConfig(),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
