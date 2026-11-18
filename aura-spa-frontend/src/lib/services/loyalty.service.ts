import { api } from "@/lib/api";

export interface LoyaltyTransaction {
  id: string;
  bookingId: string | null;
  paymentId: string | null;
  type: string;
  points: number;
  source: string;
  description: string | null;
  createdAt: string;
}

export interface LoyaltySummary {
  tier: string;
  pointsBalance: number;
  lifetimePoints: number;
  earnRateVnd: number;
  redeemValueVnd: number;
  nextTier: string | null;
  nextTierPoints: number | null;
  transactions: LoyaltyTransaction[];
}

export interface RedeemPointsResponse {
  pointsRedeemed: number;
  valueVnd: number;
  pointsBalance: number;
  tier: string;
}

export const loyaltyService = {
  getMine: () => api.get<LoyaltySummary>("/loyalty/me"),
  redeem: (points: number, description?: string) =>
    api.post<RedeemPointsResponse>("/loyalty/redeem", { points, description }),
};
