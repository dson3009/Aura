import { api } from "@/lib/api";

export type RecommendItem = {
  serviceId: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  price: number;
  score: number;
  reasons: string[];
  caveats: string[];
  bookingDeepLink: string;
};

export type RecommendResponse = {
  recommendations: RecommendItem[];
  meta: {
    source: "openai" | "heuristic";
    personalized: boolean;
    healthFiltered: boolean;
    disclaimer: string;
    emptyReason?: string;
  };
};

export type UiAction = {
  type: "deep_link" | "quick_reply" | "confirm_booking" | "login" | "escalate_human";
  label: string;
  href?: string;
  payload?: Record<string, unknown>;
};

export type ConciergeMessage = { role: "user" | "assistant"; content: string };

export type ConciergeResponse = {
  assistantMessage: string;
  toolTrace: Array<{ name: string; ok: boolean; summary: string }>;
  uiActions: UiAction[];
  bookingDraft: {
    branchId: string;
    serviceId: string;
    startTime: string;
    technicianId?: string;
    notes?: string;
    branchName?: string;
    serviceName?: string;
    price?: number;
    durationMinutes?: number;
  } | null;
  bookingCreated: { id: string } | null;
  escalateToHuman: boolean;
  meta: { source: "openai" | "heuristic"; disclaimer: string };
};

export type AiStrategy = {
  id: string;
  title: string;
  description: string;
  badge: string;
  priority: "high" | "medium" | "low";
  status: "proposed" | "active" | "completed";
  source: "manual" | "ai_generated";
  aiConfidence: number | null;
  supportingData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function unwrap<T>(payload: T | { data: T }): T {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export const aiService = {
  recommend: (body: {
    needText?: string;
    budgetMax?: number;
    preferredDuration?: number;
    branchId?: string;
    locale?: string;
  }) =>
    api
      .post<RecommendResponse | { data: RecommendResponse }>("/ai/recommend-services", body)
      .then(unwrap),

  conciergeChat: (body: {
    messages: ConciergeMessage[];
    locale?: string;
    confirmBooking?: boolean;
    bookingDraft?: ConciergeResponse["bookingDraft"];
  }) =>
    api
      .post<ConciergeResponse | { data: ConciergeResponse }>("/ai/concierge/chat", body)
      .then(unwrap),

  generateStrategies: (body: { from?: string; to?: string; maxStrategies?: number } = {}) =>
    api
      .post<AiStrategy[] | { data: AiStrategy[] }>("/ai/strategies/generate", body)
      .then(unwrap),
};

export const aiFlags = {
  recommender: process.env.NEXT_PUBLIC_AI_RECOMMENDER !== "false",
  concierge: process.env.NEXT_PUBLIC_AI_CONCIERGE !== "false",
  strategy: process.env.NEXT_PUBLIC_AI_STRATEGY !== "false",
};
