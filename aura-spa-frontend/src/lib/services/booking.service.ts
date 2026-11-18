import { api } from "@/lib/api";
import type { AvailableSlots, Booking, DepositPayment } from "@/lib/types";

export interface CreateBookingPayload {
  branchId: string;
  serviceId: string;
  startTime: string;
  technicianId?: string;
  notes?: string;
  discountCode?: string;
  treatmentCourseId?: string;
}

export interface RescheduleBookingPayload {
  startTime: string;
  technicianId?: string;
}

export interface TransferBookingPayload {
  targetBranchId: string;
  startTime: string;
  technicianId?: string;
}

export interface PayDepositPayload {
  paymentMethod?: "cash" | "card" | "bank_transfer" | "e_wallet" | "online_gateway";
}

export const bookingService = {
  create: (payload: CreateBookingPayload) =>
    api.post<Booking>("/bookings", payload),

  getMyBookings: () => api.get<Booking[]>("/bookings/my"),

  getById: (bookingId: string) => api.get<Booking>(`/bookings/${bookingId}`),

  cancel: (bookingId: string, cancelReason?: string) =>
    api.patch<Booking>(`/bookings/${bookingId}/cancel`, { cancelReason }),

  reschedule: (bookingId: string, payload: RescheduleBookingPayload) =>
    api.patch<Booking>(`/bookings/${bookingId}/reschedule`, payload),

  transfer: (bookingId: string, payload: TransferBookingPayload) =>
    api.patch<Booking>(`/bookings/${bookingId}/transfer`, payload),

  applyDiscount: (bookingId: string, code: string) =>
    api.patch<Booking>(`/bookings/${bookingId}/apply-discount`, { code }),

  payDeposit: (bookingId: string, payload: PayDepositPayload = { paymentMethod: "e_wallet" }) =>
    api.post<Booking>(`/bookings/${bookingId}/pay-deposit`, payload),

  createDepositPayment: (bookingId: string) =>
    api.post<DepositPayment>(`/bookings/${bookingId}/deposit-payment`),

  getDepositPayment: (bookingId: string) =>
    api.get<DepositPayment>(`/bookings/${bookingId}/deposit-payment`),

  getAvailability: (branchId: string, serviceId: string, date: string, technicianId?: string) =>
    api.get<AvailableSlots>(
      `/bookings/availability?branchId=${encodeURIComponent(branchId)}&serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}${
        technicianId ? `&technicianId=${encodeURIComponent(technicianId)}` : ""
      }`
    ),

  getBranchBookings: (branchId: string, date?: string, startDate?: string, endDate?: string, limit?: number) => {
    const url = `/bookings/branch/${encodeURIComponent(branchId)}`;
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (limit) params.append("limit", String(limit));
    const queryString = params.toString();
    return api.get<Booking[]>(queryString ? `${url}?${queryString}` : url);
  },

  reassignTechnician: (bookingId: string, newTechnicianId: string) =>
    api.patch<Booking>(`/bookings/${bookingId}/reassign-technician`, { newTechnicianId }),

  assignRoom: (bookingId: string, room: string | null) =>
    api.patch<Booking>(`/bookings/${bookingId}/assign-room`, { room }),

  checkIn: (bookingId: string) =>
    api.patch<Booking>(`/bookings/${bookingId}/check-in`),
};
