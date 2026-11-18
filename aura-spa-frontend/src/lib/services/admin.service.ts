import { api } from "@/lib/api";
import type { Branch, SpaService } from "@/lib/types";

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  branchId: string | null;
  discountType: "percentage" | "fixed_amount" | string;
  discountValue: number | string;
  maxDiscountAmount: number | string | null;
  minOrderAmount: number | string | null;
  usageLimitTotal: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  startsAt: string;
  endsAt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueDashboard {
  periodFrom: string;
  periodTo: string;
  granularity: string;
  totalRevenue: number;
  systemProfit?: number | null;
  totalMaterialCost?: number | null;
  profitMargin?: number | null;
  totalCompletedBookings: number;
  totalCancelledBookings: number;
  averageBookingValue: number | null;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    totalRevenue: number;
    completedBookings: number;
    cancelledBookings: number;
    averageBookingValue: number | null;
  }>;
  trend: Array<{
    period: string;
    revenue: number;
    completedBookings: number;
  }>;
}

export interface RankingResponse<T> {
  periodFrom: string;
  periodTo: string;
  rankings: T[];
}

export const adminService = {
  getServices: () => api.get<SpaService[]>("/services/all"),
  getBranches: () => api.get<Branch[]>("/branches/all"),
  getPromotions: () => api.get<Promotion[]>("/promotions/all"),
  getRevenueDashboard: (from: string, to: string, granularity = "day") =>
    api.get<RevenueDashboard>(
      `/reports/revenue-dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=${encodeURIComponent(granularity)}`
    ),
  getOwnerDashboard: (from: string, to: string) =>
    api.get<RevenueDashboard>(
      `/reports/revenue-dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=month`
    ),
  getPendingScheduleRequests: () => api.get<any[]>("/schedule-requests/all-pending"),
  getBranchPerformance: (branchId: string, from: string, to: string) =>
    api.get<any>(
      `/reports/branch/${encodeURIComponent(branchId)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ),
  getBranchStaff: (branchId: string) => api.get<any[]>(`/branches/${branchId}/staff`),
  approveScheduleRequest: (id: string) => api.patch<any>(`/schedule-requests/${id}/approve`, {}),
  rejectScheduleRequest: (id: string) => api.patch<any>(`/schedule-requests/${id}/reject`, {}),
  getStaffRankings: (from: string, to: string, limit = 10) =>
    api.get<RankingResponse<{
      rank: number;
      staffId: string;
      staffName: string;
      completedServices: number;
      averageRating: number | null;
      reviewCount: number;
      revenueGenerated: number;
    }>>(`/reports/rankings/staff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`),
  getServiceRankings: (from: string, to: string, limit = 10) =>
    api.get<RankingResponse<{
      rank: number;
      serviceId: string;
      serviceName: string;
      category: string | null;
      bookingCount: number;
      totalRevenue: number;
    }>>(`/reports/rankings/services?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`),
  getBranchRankings: (from: string, to: string, limit = 10) =>
    api.get<RankingResponse<{
      rank: number;
      branchId: string;
      branchName: string;
      totalRevenue: number;
      completedBookings: number;
      cancelledBookings: number;
      averageBookingValue: number | null;
    }>>(`/reports/rankings/branches?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`),

  createBranch: (payload: any) => api.post<Branch>("/branches", payload),
  updateBranch: (id: string, payload: any) => api.patch<Branch>(`/branches/${id}`, payload),
  deleteBranch: (id: string) => api.delete(`/branches/${id}`),

  createPromotion: (payload: any) => api.post<Promotion>("/promotions", payload),
  updatePromotion: (id: string, payload: any) => api.patch<Promotion>(`/promotions/${id}`, payload),
  deletePromotion: (id: string) => api.delete(`/promotions/${id}`),

  createService: (payload: any) => api.post<SpaService>("/services", payload),
  updateService: (id: string, payload: any) => api.patch<SpaService>(`/services/${id}`, payload),
  deleteService: (id: string) => api.delete(`/services/${id}`),

  getActiveStaff: (branchId: string) =>
    api.get<any[]>(`/schedule-requests/active-staff/${encodeURIComponent(branchId)}`),

  // Staff CRUD
  createStaff: (branchId: string, payload: {
    fullName: string; email: string; phone?: string;
    gender?: string; position: string; startDate?: string;
  }) => api.post<any>(`/branches/${branchId}/staff`, payload),
  updateStaff: (branchId: string, userId: string, payload: any) =>
    api.patch<any>(`/branches/${branchId}/staff/${userId}`, payload),
  deactivateStaff: (branchId: string, userId: string) =>
    api.patch<any>(`/branches/${branchId}/staff/${userId}/deactivate`, {}),

  // Manager CRUD
  getBranchManagers: (branchId: string) =>
    api.get<any[]>(`/branches/${branchId}/managers`),
  createManager: (branchId: string, payload: {
    fullName: string; email: string; phone?: string;
    gender?: string; startDate?: string;
  }) => api.post<any>(`/branches/${branchId}/managers`, payload),
  updateManager: (branchId: string, userId: string, payload: any) =>
    api.patch<any>(`/branches/${branchId}/managers/${userId}`, payload),
  deactivateManager: (branchId: string, userId: string) =>
    api.patch<any>(`/branches/${branchId}/managers/${userId}/deactivate`, {}),
  transferManager: (sourceBranchId: string, userId: string, targetBranchId: string) =>
    api.patch<any>(`/branches/${sourceBranchId}/managers/${userId}/transfer`, { targetBranchId }),

  // Service Inventory Requirements CRUD for Owner
  getAllInventoryItems: () => api.get<any[]>("/inventory/items"),
  getInventoryRequirements: () => api.get<any[]>("/inventory/requirements"),
  createServiceRequirement: (payload: { serviceId: string; inventoryItemId: string; quantityPerService: number }) =>
    api.post<any>("/inventory/requirements", payload),
  updateServiceRequirement: (id: string, payload: { quantityPerService: number }) =>
    api.patch<any>(`/inventory/requirements/${id}`, payload),
  deleteServiceRequirement: (id: string) =>
    api.delete(`/inventory/requirements/${id}`),
};
