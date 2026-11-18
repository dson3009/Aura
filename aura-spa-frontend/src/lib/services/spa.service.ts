import { api } from "@/lib/api";
import type { Branch, BranchTechnician, SpaService } from "@/lib/types";

export const spaService = {
  getServices: () => api.get<SpaService[]>("/services"),
  getServiceById: (id: string) => api.get<SpaService>(`/services/${id}`),
  getBranches: () => api.get<Branch[]>("/branches", { skipAuth: true }),
  getBranchById: (id: string) => api.get<Branch>(`/branches/${id}`),
  getBranchTechnicians: (branchId: string) =>
    api.get<BranchTechnician[]>(`/branches/${branchId}/technicians`),
};
