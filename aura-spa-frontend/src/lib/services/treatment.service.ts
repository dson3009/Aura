import { api } from "@/lib/api";
import type { TreatmentCourse, TreatmentSession } from "@/lib/types";

export interface UpdateTreatmentSessionProgressPayload {
  progressNote?: string;
  beforeImages?: string[];
  afterImages?: string[];
  careRecommendation?: string;
  nextRecommendedAt?: string | null;
}

export const treatmentService = {
  getMyCourses: () => api.get<TreatmentCourse[]>("/treatment-courses/my"),
  getCourseById: (id: string) => api.get<TreatmentCourse>(`/treatment-courses/${id}`),
  getBranchCourses: (branchId: string) =>
    api.get<TreatmentCourse[]>(`/treatment-courses/branch/${encodeURIComponent(branchId)}`),
  updateSessionProgress: (sessionId: string, payload: UpdateTreatmentSessionProgressPayload) =>
    api.patch<TreatmentSession>(`/treatment-courses/sessions/${encodeURIComponent(sessionId)}/progress`, payload),
};
