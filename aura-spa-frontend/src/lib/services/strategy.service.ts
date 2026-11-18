import { api } from "@/lib/api";

export interface Strategy {
  id: string;
  title: string;
  description: string;
  badge: string;
  priority: "high" | "medium" | "low";
  status: "proposed" | "active" | "completed";
  source: "manual" | "ai_generated";
  aiConfidence: number | null;
  supportingData?: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStrategyPayload {
  title: string;
  description: string;
  badge: string;
  priority?: "high" | "medium" | "low";
  status?: "proposed" | "active" | "completed";
}

export type UpdateStrategyPayload = Partial<CreateStrategyPayload>;

/** api.ts already unwraps { success, data } responses; keep fallbacks for direct data. */
function asList(r: Strategy[] | { data?: Strategy[] } | undefined): Strategy[] {
  if (Array.isArray(r)) return r;
  if (r && Array.isArray((r as { data?: Strategy[] }).data)) return (r as { data: Strategy[] }).data;
  return [];
}

function asOne(r: Strategy | { data?: Strategy } | undefined): Strategy {
  if (r && typeof r === "object" && "data" in r && (r as { data?: Strategy }).data) {
    return (r as { data: Strategy }).data;
  }
  return r as Strategy;
}

export const strategyService = {
  getAll: () => api.get<Strategy[] | { data: Strategy[] }>("/strategies").then(asList),
  getOne: (id: string) => api.get<Strategy | { data: Strategy }>(`/strategies/${id}`).then(asOne),
  create: (payload: CreateStrategyPayload) =>
    api.post<Strategy | { data: Strategy }>("/strategies", payload).then(asOne),
  update: (id: string, payload: UpdateStrategyPayload) =>
    api.patch<Strategy | { data: Strategy }>(`/strategies/${id}`, payload).then(asOne),
  remove: (id: string) => api.delete(`/strategies/${id}`),
};
