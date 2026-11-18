import { api } from "@/lib/api";
import type { ScheduleRequest } from "@/lib/types";

type ApiPayload = Record<string, unknown>;
type ApiRecord = Record<string, unknown>;

export const managerService = {
  getScheduleRequests: (branchId: string, status?: string) =>
    api.get<ScheduleRequest[]>(
      `/schedule-requests/branch/${encodeURIComponent(branchId)}${status ? `?status=${encodeURIComponent(status)}` : ""}`
    ),

  approveScheduleRequest: (requestId: string) =>
    api.patch<ScheduleRequest>(`/schedule-requests/${requestId}/approve`),

  rejectScheduleRequest: (requestId: string) =>
    api.patch<ScheduleRequest>(`/schedule-requests/${requestId}/reject`),

  // Staff Management
  getStaff: (branchId: string) =>
    api.get<ApiRecord[]>(`/branches/${encodeURIComponent(branchId)}/staff`),

  createStaff: (branchId: string, payload: ApiPayload) =>
    api.post<ApiRecord>(`/branches/${encodeURIComponent(branchId)}/staff`, payload),

  updateStaff: (branchId: string, userId: string, payload: ApiPayload) =>
    api.patch<ApiRecord>(`/branches/${encodeURIComponent(branchId)}/staff/${encodeURIComponent(userId)}`, payload),

  deactivateStaff: (branchId: string, userId: string) =>
    api.patch<ApiRecord>(`/branches/${encodeURIComponent(branchId)}/staff/${encodeURIComponent(userId)}/deactivate`),

  // Slot Config Management
  getSlotConfigs: (branchId: string) =>
    api.get<ApiRecord[]>(`/branches/${encodeURIComponent(branchId)}/slot-configs`),

  updateSlotConfig: (branchId: string, id: string, payload: ApiPayload) =>
    api.patch<ApiRecord>(`/branches/${encodeURIComponent(branchId)}/slot-configs/${encodeURIComponent(id)}`, payload),

  // Complaints Management
  getComplaints: (branchId: string, status?: string) =>
    api.get<ApiRecord[]>(`/complaints/branch/${encodeURIComponent(branchId)}${status ? `?status=${encodeURIComponent(status)}` : ""}`),

  resolveComplaint: (id: string, payload: { resolutionNote?: string }) =>
    api.patch<ApiRecord>(`/complaints/${encodeURIComponent(id)}/resolve`, payload),

  rejectComplaint: (id: string, payload: { resolutionNote?: string }) =>
    api.patch<ApiRecord>(`/complaints/${encodeURIComponent(id)}/reject`, payload),

  setInProgressComplaint: (id: string) =>
    api.patch<ApiRecord>(`/complaints/${encodeURIComponent(id)}/start-processing`),

  // Inventory Management
  getInventory: (branchId: string) =>
    api.get<ApiRecord[]>(`/inventory/branch/${encodeURIComponent(branchId)}`),

  importInventory: (branchId: string, payload: { inventoryItemId: string; quantity: number; reason?: string }) =>
    api.post<ApiRecord>(`/inventory/branch/${encodeURIComponent(branchId)}/import`, payload),

  consumeInventory: (branchId: string, payload: { inventoryItemId: string; quantity: number; bookingId?: string; serviceId?: string; reason?: string }) =>
    api.post<ApiRecord>(`/inventory/branch/${encodeURIComponent(branchId)}/consume`, payload),

  stockCheckInventory: (branchId: string, payload: { inventoryItemId: string; actualQuantity: number; reason?: string }) =>
    api.post<ApiRecord>(`/inventory/branch/${encodeURIComponent(branchId)}/stock-check`, payload),

  getInventoryRequirements: () =>
    api.get<ApiRecord[]>("/inventory/requirements"),

  // Branch Performance Reports
  getBranchPerformance: (branchId: string, from: string, to: string) =>
    api.get<ApiRecord>(`/reports/branch/${encodeURIComponent(branchId)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  getManagerDashboard: (branchId: string) =>
    api.get<ApiRecord>(`/reports/manager-dashboard/${encodeURIComponent(branchId)}`),

  getActiveStaff: (branchId: string) =>
    api.get<ApiRecord[]>(`/schedule-requests/active-staff/${encodeURIComponent(branchId)}`),

  assignShift: (payload: { staffId: string; branchId: string; date: string; startTime: string; endTime: string }) =>
    api.post<ScheduleRequest>("/schedule-requests/assign", payload),

  deleteShift: (shiftId: string) =>
    api.delete<ApiRecord>(`/schedule-requests/${encodeURIComponent(shiftId)}`),

  batchApproveScheduleRequests: (ids: string[]) =>
    api.post<ApiRecord>("/schedule-requests/batch-approve", { ids }),
};
