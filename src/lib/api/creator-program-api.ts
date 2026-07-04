import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type CreatorFollowerRange = "UNDER_5K" | "R5K_10K" | "R10K_50K" | "R50K_100K" | "OVER_100K";
export type CreatorNiche =
  | "BUSINESS"
  | "MARKETING"
  | "FITNESS"
  | "CREATOR"
  | "ECOMMERCE"
  | "COACHING"
  | "BEAUTY"
  | "FOOD"
  | "TRAVEL"
  | "OTHER";

export const CREATOR_PROGRAM_CONSENT_VERSION = "1.0";

export type CreatorApplyInput = {
  name: string;
  email: string;
  country: string;
  instagramUsername: string;
  followerRange: CreatorFollowerRange;
  niche: CreatorNiche;
  otherNiche?: string;
  asksForComments: boolean;
  whyJoin?: string;
};

export type CreatorProgramStatus =
  | { state: "none" }
  | { state: "pending"; submittedAt: string }
  | { state: "rejected"; reapplyAt: string | null }
  | {
      state: "member";
      memberStatus: string;
      joinedAt: string;
      dmCount: number;
      dmTarget: number;
      campaignCount: number;
      campaignTarget: number;
      alumniDiscountCode: string | null;
    }
  | {
      state: "removed";
      memberStatus: string;
      joinedAt: string;
      dmCount: number;
      dmTarget: number;
      campaignCount: number;
      campaignTarget: number;
      alumniDiscountCode: string | null;
    };

export function applyToCreatorProgram(input: CreatorApplyInput) {
  return apiRequest<{ id: string; status: string }>(apiUri.creators.apply, {
    method: "POST",
    body: { ...input, consentVersion: CREATOR_PROGRAM_CONSENT_VERSION },
  });
}

export function getCreatorProgramStatus() {
  return apiRequest<CreatorProgramStatus>(apiUri.creators.status);
}
