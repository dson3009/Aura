import { api } from "@/lib/api";

export interface EligibleDiscountCode {
  id: string;
  code: string;
  promotionId: string;
  promotionName: string;
  description: string | null;
  branchId: string | null;
  discountType: "percentage" | "fixed_amount" | string;
  discountValue: number | string;
  maxDiscountAmount: number | string | null;
  minOrderAmount: number | string | null;
  eligibleCustomerTier: string | null;
  minPointsBalance: number | null;
  firstBookingOnly: boolean;
  endsAt: string;
}

export const promotionService = {
  getEligibleCodes: (branchId?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    const query = params.toString();
    return api.get<EligibleDiscountCode[]>(`/promotions/eligible-codes${query ? `?${query}` : ""}`);
  },
};
