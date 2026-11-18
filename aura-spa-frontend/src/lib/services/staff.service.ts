import { api } from "@/lib/api";
import type {
  Booking,
  Conversation,
  ConversationMessage,
  HealthRecord,
  Invoice,
  InvoicePaymentQr,
  Payment,
  ScheduleRequest,
  TimetableDay,
} from "@/lib/types";

export interface CreateScheduleRequestPayload {
  branchId: string;
  requestType: "work_shift" | "leave";
  requestedStart: string;
  requestedEnd: string;
  reason?: string;
}

export interface CreateWalkInPayload {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  branchId: string;
  serviceId: string;
  technicianId?: string;
  startTime: string;
  notes?: string;
}

export interface UpsertHealthRecordPayload {
  branchId: string;
  skinType?: string;
  allergies?: string;
  medicalConditions?: string;
  pregnancyStatus?: string;
  contraindications?: string;
  notes?: string;
}

export interface ProcessInvoicePaymentPayload {
  paymentMethod: "cash" | "card" | "bank_transfer" | "e_wallet";
  amount: number;
  paymentType?: "deposit" | "full_payment" | "remaining_payment";
}

export const staffService = {
  getTimetable: (from: string, to: string) =>
    api.get<TimetableDay[]>(
      `/schedule-requests/timetable?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ),

  checkInBooking: (bookingId: string) =>
    api.patch<Booking>(`/bookings/${bookingId}/check-in`),

  completeServiceBooking: (bookingId: string) =>
    api.patch<Booking>(`/bookings/${bookingId}/complete-service`),

  getBooking: (bookingId: string) =>
    api.get<Booking>(`/bookings/${bookingId}`),

  generateInvoice: (bookingId: string, notes?: string) =>
    api.post<Invoice>("/invoices", { bookingId, notes }),

  getInvoice: (invoiceId: string) =>
    api.get<Invoice>(`/invoices/${invoiceId}`),

  processInvoicePayment: (invoiceId: string, payload: ProcessInvoicePaymentPayload) =>
    api.post<Payment>(`/invoices/${invoiceId}/pay`, payload),

  createInvoicePaymentQr: (invoiceId: string) =>
    api.post<InvoicePaymentQr>(`/invoices/${invoiceId}/payment-qr`),

  getInvoicePaymentQr: (invoiceId: string) =>
    api.get<InvoicePaymentQr>(`/invoices/${invoiceId}/payment-qr`),

  getMyScheduleRequests: () =>
    api.get<ScheduleRequest[]>("/schedule-requests/my"),

  createScheduleRequest: (payload: CreateScheduleRequestPayload) =>
    api.post<ScheduleRequest>("/schedule-requests", payload),

  cancelScheduleRequest: (requestId: string) =>
    api.patch<ScheduleRequest>(`/schedule-requests/${requestId}/cancel`),

  createWalkInBooking: (payload: CreateWalkInPayload) =>
    api.post<Booking>("/bookings/walk-in", payload),

  getHealthRecords: (customerId: string) =>
    api.get<HealthRecord[]>(`/health-records/customer/${customerId}`),

  upsertHealthRecord: (customerId: string, payload: UpsertHealthRecordPayload) =>
    api.put<HealthRecord>(`/health-records/customer/${customerId}`, payload),

  getConversations: (status?: string) =>
    api.get<Conversation[]>(
      status ? `/conversations?status=${encodeURIComponent(status)}` : "/conversations"
    ),

  getConversationMessages: (conversationId: string) =>
    api.get<ConversationMessage[]>(`/conversations/${conversationId}/messages`),

  replyConversation: (conversationId: string, message: string) =>
    api.post<ConversationMessage>(`/conversations/${conversationId}/reply`, { message }),

  updateConversation: (conversationId: string, payload: Partial<Conversation>) =>
    api.patch<Conversation>(`/conversations/${conversationId}`, payload),
};
