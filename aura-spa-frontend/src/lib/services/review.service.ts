import { api } from "@/lib/api";
import type { Review } from "@/lib/types";

export interface CreateReviewPayload {
  bookingId: string;
  rating: number;
  comment?: string;
}

export const reviewService = {
  create: (payload: CreateReviewPayload) =>
    api.post<Review>("/reviews", payload),

  getMyReviews: () => api.get<Review[]>("/reviews/my"),
};
