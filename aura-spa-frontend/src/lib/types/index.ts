export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  gender: string;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  address: string | null;
  notificationEnabled?: boolean;
  branchId?: string | null;
  branchCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface SpaService {
  id: string;
  code: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  defaultDurationMinutes: number;
  defaultPrice: number | string;
  status: string;
  isMultiSession: boolean;
  totalSessions: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  district: string | null;
  latitude: number | string;
  longitude: number | string;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchTechnician {
  id: string;
  staffCode: string | null;
  position: "technician" | string;
  status: "active" | string;
  startDate: string;
  endDate: string | null;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    gender: string;
    status: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BookingServiceItem {
  id: string;
  serviceId: string;
  service?: {
    id: string;
    name: string;
    category: string | null;
  };
  quantity: number;
  durationMinutes: number;
  unitPrice: number | string;
  discountAmount: number | string;
  finalAmount: number | string;
}

export interface Booking {
  id: string;
  customerId: string;
  branchId: string;
  technicianId: string | null;
  startTime: string;
  endTime: string;
  status:
    | "pending_payment"
    | "confirmed"
    | "checked_in"
    | "in_service"
    | "service_completed"
    | "completed"
    | "cancelled"
    | "no_show"
    | "rescheduled"
    | "transferred";
  source: "online" | "walk_in" | string;
  subtotalAmount: number | string;
  discountAmount: number | string;
  depositRequiredAmount: number | string;
  paidAmount: number | string;
  remainingAmount: number | string;
  notes: string | null;
  customer?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
  technician?: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
  services: BookingServiceItem[];
  treatmentSession?: {
    id: string;
    treatmentCourseId: string;
    sessionNumber: number;
    totalSessions: number;
    usedSessions: number;
    remainingSessions: number;
    status: string;
    progressNote: string | null;
    beforeImages: string[] | null;
    afterImages: string[] | null;
    careRecommendation: string | null;
    nextRecommendedAt: string | null;
    reminderSentAt: string | null;
  } | null;
  room?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  remainingCapacity: number;
  maxCapacity: number;
}

export interface AvailableSlots {
  branchId: string;
  serviceId: string;
  date: string;
  serviceDurationMinutes: number;
  slots: TimeSlot[];
}

export interface Review {
  id: string;
  customerId: string;
  bookingId: string;
  serviceId: string | null;
  branchId: string;
  technicianId: string | null;
  rating: number;
  comment: string | null;
  status: "published" | "hidden" | string;
  replyText: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Complaint {
  id: string;
  customerId: string;
  branchId: string;
  bookingId: string | null;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "rejected" | "closed" | string;
  assignedTo: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  customer?: {
    id: string;
    fullName: string;
    email: string | null;
  };
  createdAt: string;
  updatedAt: string;
}
export interface TreatmentSession {
  id: string;
  sessionNumber: number;
  status: "planned" | "booked" | "in_progress" | "completed" | "skipped" | "cancelled" | string;
  bookingId: string | null;
  staffId: string | null;
  progressNote: string | null;
  beforeImages: string[] | null;
  afterImages: string[] | null;
  careRecommendation: string | null;
  nextRecommendedAt: string | null;
  reminderSentAt: string | null;
  completedAt: string | null;
}

export interface TreatmentCourse {
  id: string;
  customerId: string;
  serviceId: string;
  branchId: string | null;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  status: "active" | "completed" | "expired" | "cancelled" | "paused" | string;
  startedAt: string | null;
  expiresAt: string | null;
  sessions: TreatmentSession[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffShift {
  id: string;
  branchId: string;
  scheduleType: string;
  status: string;
  startTime: string;
  endTime: string;
}

export interface TimetableAppointment {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  startTime: string;
  endTime: string;
  status: Booking["status"];
}

export interface TimetableDay {
  date: string;
  shifts: StaffShift[];
  appointments: TimetableAppointment[];
}

export interface HealthRecord {
  id: string;
  customerId: string;
  branchId: string | null;
  skinType: string | null;
  allergies: string | null;
  medicalConditions: string | null;
  pregnancyStatus: string | null;
  contraindications: string | null;
  notes: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number | string;
  discountAmount: number | string;
  finalAmount?: number | string;
  lineTotal?: number | string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string | null;
  customerId: string;
  branchId: string;
  status: string;
  subtotalAmount: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  paidAmount: number | string;
  remainingAmount: number | string;
  issuedAt: string | null;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string | null;
  bookingId: string | null;
  customerId: string;
  branchId: string;
  paymentType: "deposit" | "full_payment" | "remaining_payment" | string;
  paymentMethod: "cash" | "card" | "bank_transfer" | "e_wallet" | "online_gateway" | string;
  status: string;
  amount: number | string;
  paidAt: string | null;
  receivedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepositPayment {
  paymentTransactionId: string;
  bookingId: string;
  referenceCode: string;
  amount: number;
  paymentStatus: "pending" | "paid" | "expired" | "failed" | "cancelled" | string;
  bookingStatus: Booking["status"] | string;
  qrImageUrl: string;
  expiresAt: string;
  paidAt: string | null;
}

export interface InvoicePaymentQr {
  paymentTransactionId: string;
  invoiceId: string;
  bookingId: string | null;
  referenceCode: string;
  amount: number;
  paymentStatus: "pending" | "paid" | "expired" | "failed" | "cancelled" | string;
  invoiceStatus: string;
  qrImageUrl: string;
  expiresAt: string;
  paidAt: string | null;
}

export interface ScheduleRequest {
  id: string;
  staffId: string;
  branchId: string;
  requestType: "work_shift" | "leave" | string;
  requestedStart: string;
  requestedEnd: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | string;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  staffFullName?: string;
  staffEmail?: string | null;
}

export interface Conversation {
  id: string;
  customerId: string | null;
  branchId: string | null;
  assignedStaffId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  subject: string | null;
  status: "open" | "assigned" | "closed" | string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderType: "guest" | "customer" | "staff" | "system" | string;
  senderRole?: string | null;
  senderUserId: string | null;
  message: string;
  createdAt: string;
}
