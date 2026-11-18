import { api } from "@/lib/api";
import type { Complaint } from "@/lib/types";

export interface CreateComplaintPayload {
  bookingId?: string;
  branchId?: string;
  title: string;
  description: string;
}

export const complaintService = {
  create: (payload: CreateComplaintPayload) =>
    api.post<Complaint>("/complaints", payload),

  createComplaint: (payload: CreateComplaintPayload) =>
    api.post<Complaint>("/complaints", payload),

  getMyComplaints: () =>
    api.get<Complaint[]>("/complaints/customer/my"),

  getComplaintDetail: (id: string) =>
    api.get<Complaint>(`/complaints/${encodeURIComponent(id)}`),
};
