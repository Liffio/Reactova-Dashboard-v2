import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * DM send rate for the workspace's connected Instagram account (spec §12/§13/§15).
 *
 * The slider is a **ceiling the customer sets, not a guarantee.** Two things can pull the
 * effective rate below it — a hard per-account cap, and a temporary automatic safety reduction —
 * and `limitedBy` says which is binding so the UI can explain it rather than leaving the customer
 * to notice slow sends and open a ticket.
 *
 * What this response deliberately never carries, per §15: any indication that the Instagram
 * account is connected to another workspace, email or tenant. No shared-bucket meter, no count of
 * other consumers, no "blocked by another consumer" state. Throughput is already a side channel —
 * a workspace whose sends slow with no error can infer another consumer exists — and while that
 * cannot be eliminated, it must not be amplified.
 */

/** Which layer is currently binding. All four are properties of the customer's own account. */
export type SendRateLimitedBy = "slider" | "global_cap" | "safety_cap" | "ramp";

export type SendRateSettings = {
  connected: boolean;
  /** What the customer chose. */
  sliderPerHour: number;
  /** What they will actually get right now. Absent when no account is connected. */
  effectivePerHour?: number;
  options: readonly number[];
  limitedBy?: SendRateLimitedBy;
  /** Set while an automatic safety reduction is active. */
  safetyCapPerHour?: number | null;
  /**
   * A true statement about the platform, not about other tenants — the only thing we are
   * permitted to say about why throughput may fall short of the chosen rate.
   */
  caveat: string;
};

export type SendRateUpdate = {
  sliderPerHour: number;
  effectivePerHour: number;
  limitedBy: SendRateLimitedBy;
  caveat: string;
};

export function getSendRate(workspaceId?: string) {
  return apiRequest<SendRateSettings>(apiUri.sendRate.get, { workspaceId });
}

export function setSendRate(sliderPerHour: number, workspaceId?: string) {
  return apiRequest<SendRateUpdate>(apiUri.sendRate.set, {
    method: "PUT",
    body: { sliderPerHour },
    workspaceId,
  });
}
