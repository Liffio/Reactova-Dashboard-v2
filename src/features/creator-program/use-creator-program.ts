import { useQuery } from "@tanstack/react-query";

import { getCreatorStatus, getCreatorThresholds } from "@/lib/api/creator-eligibility-api";
import fixtures from "./status.fixtures.json";
import { deriveFrame } from "./contract";
import type { CreatorFrame, CreatorStatusResponse, CreatorThresholdsResponse } from "./contract";

export const CREATOR_STATUS_KEY = ["creator-eligibility-status"];
export const CREATOR_THRESHOLDS_KEY = ["creator-eligibility-thresholds"];

/**
 * Fixture keys are the twelve frames plus `Active_engagement_null`, which is
 * the *default* rendering at launch rather than an edge case —
 * instagram_business_manage_insights is still in review, so most accounts have
 * no engagement figure to show.
 */
type FixtureKey = Exclude<keyof typeof fixtures, "_readme" | "_thresholds">;

const FIXTURES = fixtures as unknown as Record<string, CreatorStatusResponse> & {
  _thresholds: CreatorThresholdsResponse;
};

export function isFixtureKey(value: string): value is FixtureKey {
  return !value.startsWith("_") && value in fixtures;
}

/**
 * `?mock=<frame>` renders any fixture without a backend, so all twelve frames
 * (and the two loading/error ones, via `?mock=Loading` / `?mock=Error`) are
 * reachable in a browser. DEV only — in a production build the parameter is
 * ignored entirely, so a shared URL can never show someone a fabricated
 * membership state.
 */
function readMockFrame(): string | null {
  if (!import.meta.env.DEV) return null;
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mock");
}

export type CreatorProgramData = {
  frame: CreatorFrame;
  status: CreatorStatusResponse | null;
  thresholds: CreatorThresholdsResponse | undefined;
  /** True while the page is showing a fixture rather than the live API. */
  isMocked: boolean;
  refetch: () => void;
};

export function useCreatorProgram(): CreatorProgramData {
  const mock = readMockFrame();
  const mockStatus = mock && isFixtureKey(mock) ? FIXTURES[mock] : null;
  // Loading and Error aren't API states, so they have no fixture — they're
  // requested by name and short-circuit the query instead.
  const mockFrame: CreatorFrame | null =
    mock === "Loading" ? "Loading" : mock === "Error" ? "Error" : null;
  const isMocked = Boolean(mockStatus || mockFrame);

  const statusQuery = useQuery({
    queryKey: CREATOR_STATUS_KEY,
    queryFn: getCreatorStatus,
    enabled: !isMocked,
    refetchInterval: (query) => {
      const data = query.state.data as CreatorStatusResponse | undefined;
      // Poll only while a decision is genuinely pending — a waitlisted
      // application is promoted automatically and a pending one is decided by
      // an admin, with no push channel to tell the page (ENDPOINT-CONTRACT.md
      // §5: polling is the documented interim pattern). Every other state is
      // static until the creator does something.
      const app = data?.latestApplication;
      if (
        data?.state === "Eligible" &&
        (app?.state === "PendingReview" || app?.state === "Submitted")
      ) {
        return 20_000;
      }
      return false;
    },
  });

  const thresholdsQuery = useQuery({
    queryKey: CREATOR_THRESHOLDS_KEY,
    queryFn: getCreatorThresholds,
    enabled: !isMocked,
    // Thresholds change about never; refetching them on every mount just adds a
    // request the page then waits on.
    staleTime: 10 * 60 * 1000,
  });

  const refetch = () => {
    void statusQuery.refetch();
    void thresholdsQuery.refetch();
  };

  if (mockFrame) {
    return {
      frame: mockFrame,
      status: null,
      thresholds: FIXTURES._thresholds,
      isMocked: true,
      refetch,
    };
  }
  if (mockStatus) {
    return {
      frame: deriveFrame(mockStatus),
      status: mockStatus,
      thresholds: FIXTURES._thresholds,
      isMocked: true,
      refetch,
    };
  }

  if (statusQuery.isPending) {
    return {
      frame: "Loading",
      status: null,
      thresholds: thresholdsQuery.data,
      isMocked: false,
      refetch,
    };
  }
  // `Error` is a client concern — /status returned non-2xx. Deliberately
  // distinct from MetricsUnavailable, which is a *successful* response
  // describing a known backend condition.
  if (statusQuery.isError || !statusQuery.data) {
    return {
      frame: "Error",
      status: null,
      thresholds: thresholdsQuery.data,
      isMocked: false,
      refetch,
    };
  }

  return {
    // Never branch on `state` directly — deriveFrame is the single mapping,
    // shared with the backend's copy of the contract file.
    frame: deriveFrame(statusQuery.data),
    status: statusQuery.data,
    thresholds: thresholdsQuery.data,
    isMocked: false,
    refetch,
  };
}
