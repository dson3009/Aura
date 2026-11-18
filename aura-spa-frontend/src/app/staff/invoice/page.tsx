"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { staffService } from "@/lib/services/staff.service";
import { bookingService } from "@/lib/services/booking.service";
import type { Booking, Invoice, InvoicePaymentQr, Payment } from "@/lib/types";
import { formatCurrency } from "@/lib/mock-data";

type PayMethod = "cash" | "bank_transfer";
type InvoiceAppointment = {
  id: string;
  customerId?: string;
  customerName: string;
  customerPhone: string | null;
  startTime: string;
  endTime: string;
  status: Booking["status"];
};

const READY_FOR_CHECK_IN_STATUSES: Booking["status"][] = ["confirmed"];
const INVOICEABLE_STATUSES: Booking["status"][] = ["checked_in", "in_service", "service_completed", "completed"];
const BILLING_WORKFLOW_STATUSES: Booking["status"][] = [
  ...READY_FOR_CHECK_IN_STATUSES,
  ...INVOICEABLE_STATUSES,
];

function toLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StaffInvoice() {
  const { user } = useAuth();
  const branchId = user?.branchId;
  const [appointments, setAppointments] = useState<InvoiceAppointment[]>([]);
  const [directAppointment, setDirectAppointment] = useState<InvoiceAppointment | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoiceQr, setInvoiceQr] = useState<InvoicePaymentQr | null>(null);
  const [amount, setAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isCreatingQr, setIsCreatingQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "";
    const date = new Date(timeString);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  const appointmentStatusLabel = (status: string) => {
    switch (status) {
      case "pending_payment": return "Chờ thanh toán";
      case "confirmed": return "Đã xác nhận";
      case "checked_in": return "Đã tiếp nhận";
      case "service_completed": return "Chờ thanh toán";
      case "in_service": return "Đang thực hiện";
      case "completed": return "Hoàn thành";
      case "cancelled": return "Đã hủy";
      default: return status;
    }
  };

function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function isSameLocalDate(value: string, date: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return toLocalDateInput(parsed) === date;
}

  const mapBookingToAppointment = (booking: Booking): InvoiceAppointment => ({
    id: booking.id,
    customerId: booking.customerId,
    customerName: booking.customer?.fullName ?? `Khách hàng #${booking.customerId}`,
    customerPhone: booking.customer?.phone ?? null,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
  });

  const loadAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const today = toLocalDateInput(new Date());
      const [days, branchBookings] = await Promise.all([
        staffService.getTimetable(today, today),
        branchId ? bookingService.getBranchBookings(branchId, today) : Promise.resolve([]),
      ]);
      const byId = new Map<string, InvoiceAppointment>();

      for (const appointment of days.flatMap((day) => day.appointments ?? [])) {
        if (BILLING_WORKFLOW_STATUSES.includes(appointment.status)) {
          byId.set(appointment.id, appointment);
        }
      }

      for (const booking of branchBookings) {
        if (
          isSameLocalDate(booking.startTime, today) &&
          BILLING_WORKFLOW_STATUSES.includes(booking.status)
        ) {
          byId.set(booking.id, mapBookingToAppointment(booking));
        }
      }

      const invoiceable = Array.from(byId.values()).sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      setAppointments(invoiceable);
      setSelectedBookingId((current) => current ?? invoiceable[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách lịch cần thanh toán.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadAppointments(), 0);
    return () => window.clearTimeout(id);
  }, [loadAppointments]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const param = new URLSearchParams(window.location.search).get("bookingId");
      if (param) {
        setSelectedBookingId(param);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [branchId]);

  useEffect(() => {
    if (!selectedBookingId) {
      const id = window.setTimeout(() => setDirectAppointment(null), 0);
      return () => window.clearTimeout(id);
    }

    if (appointments.some((appointment) => appointment.id === selectedBookingId)) {
      const id = window.setTimeout(() => setDirectAppointment(null), 0);
      return () => window.clearTimeout(id);
    }

    const bookingId = selectedBookingId;
    let cancelled = false;

    async function loadDirectBooking() {
      try {
        const booking = await staffService.getBooking(bookingId);
        if (cancelled) return;

        if (!BILLING_WORKFLOW_STATUSES.includes(booking.status)) {
          setDirectAppointment(null);
          setError("Lịch này chưa ở trạng thái có thể tạo hóa đơn. Hãy check-in khách trước.");
          return;
        }

        const appointment = mapBookingToAppointment(booking);
        setDirectAppointment(appointment);
        setAppointments((current) =>
          current.some((item) => item.id === appointment.id) ? current : [appointment, ...current]
        );
      } catch (err) {
        if (!cancelled) {
          setDirectAppointment(null);
          setError(err instanceof Error ? err.message : "Không tải được lịch vãng lai vừa tạo.");
        }
      }
    }

    void loadDirectBooking();

    return () => {
      cancelled = true;
    };
  }, [appointments, selectedBookingId]);

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === selectedBookingId) ?? directAppointment,
    [appointments, directAppointment, selectedBookingId]
  );
  const selectedNeedsCheckIn = selectedAppointment
    ? READY_FOR_CHECK_IN_STATUSES.includes(selectedAppointment.status)
    : false;

  const subtotalAmount = toNumber(invoice?.subtotalAmount);
  const discountAmount = toNumber(invoice?.discountAmount);
  const paidAmount = toNumber(invoice?.paidAmount);
  const remainingAmount = invoice ? Math.max(0, subtotalAmount - discountAmount - paidAmount) : 0;

  const handleSelectAppointment = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setDirectAppointment(null);
    setInvoice(null);
    setPayment(null);
    setInvoiceQr(null);
    setAmount("");
    setError(null);
  };

  const handleGenerateInvoice = async () => {
    if (!selectedBookingId) return;

    try {
      setIsGenerating(true);
      setError(null);
      setPayment(null);
      setInvoiceQr(null);
      const generated = await staffService.generateInvoice(selectedBookingId, "Counter invoice generated by staff");
      setInvoice(generated);
      const computedRemaining = Math.max(0, toNumber(generated.subtotalAmount) - toNumber(generated.discountAmount) - toNumber(generated.paidAmount));
      setAmount(String(computedRemaining));
      if (computedRemaining > 0) {
        setPayMethod("bank_transfer");
      }
      showToast("Đã tạo hóa đơn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được hóa đơn.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedBookingId) return;

    try {
      setIsGenerating(true);
      setError(null);
      const checkedIn = await staffService.checkInBooking(selectedBookingId);
      const appointment = mapBookingToAppointment(checkedIn);
      setAppointments((current) =>
        current.map((item) => (item.id === appointment.id ? { ...item, ...appointment } : item))
      );
      setDirectAppointment((current) =>
        current?.id === appointment.id ? { ...current, ...appointment } : current
      );
      setPayment(null);
      setInvoiceQr(null);
      const generated = await staffService.generateInvoice(selectedBookingId, "Counter invoice generated by staff");
      setInvoice(generated);
      const computedRemaining = Math.max(0, toNumber(generated.subtotalAmount) - toNumber(generated.discountAmount) - toNumber(generated.paidAmount));
      setAmount(String(computedRemaining));
      if (computedRemaining > 0) {
        setPayMethod("bank_transfer");
      }
      showToast("Da check-in khach va tao hoa don.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong check-in duoc lich hen.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePay = async () => {
    if (!invoice) return;

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Vui lòng nhập số tiền thanh toán hợp lệ.");
      return;
    }

    try {
      setIsPaying(true);
      setError(null);
      const recorded = await staffService.processInvoicePayment(invoice.id, {
        paymentMethod: payMethod,
        amount: numericAmount,
        paymentType: numericAmount >= remainingAmount ? "full_payment" : "remaining_payment",
      });
      setPayment(recorded);
      setInvoiceQr(null);
      setInvoice((current) =>
        current
          ? {
              ...current,
              paidAmount: toNumber(current.paidAmount) + numericAmount,
              remainingAmount: Math.max(0, remainingAmount - numericAmount),
              status: numericAmount >= remainingAmount ? "paid" : "partially_paid",
            }
          : current
      );
      showToast("Đã ghi nhận thanh toán");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không ghi nhận được thanh toán.";
      if (message.includes("Payment can only be recorded")) {
        try {
          const latestInvoice = await staffService.getInvoice(invoice.id);
          setInvoice(latestInvoice);
          const latestRemaining = Math.max(
            0,
            toNumber(latestInvoice.subtotalAmount) - toNumber(latestInvoice.discountAmount) - toNumber(latestInvoice.paidAmount)
          );
          setAmount(String(latestRemaining));
          setInvoiceQr(null);
          setError(null);
          showToast("Hóa đơn đã được ghi nhận thanh toán.");
          return;
        } catch {
          setError(message);
          return;
        }
      }
      setError(message);
    } finally {
      setIsPaying(false);
    }
  };

  const handleCreateQr = async () => {
    if (!invoice) return;

    try {
      setIsCreatingQr(true);
      setError(null);
      const qr = await staffService.createInvoicePaymentQr(invoice.id);
      setInvoiceQr(qr);
      showToast("Đã tạo QR SePay");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được QR SePay cho hóa đơn.");
    } finally {
      setIsCreatingQr(false);
    }
  };

  const reset = () => {
    setSelectedBookingId(null);
    setDirectAppointment(null);
    setInvoice(null);
    setPayment(null);
    setInvoiceQr(null);
    setAmount("");
    setError(null);
    void loadAppointments();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">Tạo hóa đơn & Thanh toán</h1>
          <p className="text-sm text-on-surface-variant mt-1">Chọn lịch hẹn đã tiếp nhận/hoàn thành để thanh toán dịch vụ tại quầy.</p>
        </div>
        <button
          onClick={loadAppointments}
          className="border border-outline-variant px-4 py-2 rounded-full text-sm hover:bg-surface-container font-medium flex items-center gap-1 font-bold"
        >
          <span className="material-symbols-outlined text-sm">refresh</span> Làm mới
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-error-container bg-error-container/30 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h3 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">
            Lịch cần thanh toán
          </h3>

          {isLoading ? (
            <div className="bg-white rounded-xl p-8 border border-outline-variant/20 text-on-surface-variant">
              Đang tải danh sách...
            </div>
          ) : appointments.length === 0 ? (
            <div className="bg-white rounded-xl p-8 border border-outline-variant/20 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl block mb-2 text-outline">event_busy</span>
              <p className="font-label-md text-label-md">Không có lịch hẹn nào cần thanh toán hôm nay</p>
            </div>
          ) : (
            <div className="space-y-2">
              {appointments.map((appointment) => (
                <button
                  key={appointment.id}
                  onClick={() => handleSelectAppointment(appointment.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedBookingId === appointment.id
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/30 bg-white hover:border-outline-variant"
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface font-bold">{appointment.customerName}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                        {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                      </p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">
                        SĐT: {appointment.customerPhone || "Chưa có"}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-primary-fixed text-primary uppercase">
                      {appointmentStatusLabel(appointment.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          {selectedAppointment ? (
            <div className="bg-white rounded-2xl border border-outline-variant/20 p-6 space-y-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Chi tiết hóa đơn</h3>
                  <p className="text-on-surface-variant text-sm mt-1">
                    Lịch hẹn #{selectedAppointment.id} · {selectedAppointment.customerName}
                  </p>
                </div>
                {!invoice && (
                  <button
                    onClick={selectedNeedsCheckIn ? handleCheckIn : handleGenerateInvoice}
                    disabled={isGenerating}
                    className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-label-md text-label-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                  >
                    {isGenerating ? "Đang tạo..." : "Tạo hóa đơn"}
                  </button>
                )}
              </div>

              {!invoice ? (
                <div className="bg-surface-container-low rounded-xl p-8 text-center text-on-surface-variant border border-dashed border-outline-variant">
                  Chọn “Tạo hóa đơn” để lấy chi tiết dịch vụ, tiền cọc và số tiền cần thanh toán.
                </div>
              ) : (
                <>
                  <div className="bg-surface-container-low rounded-xl p-4 space-y-3 border border-outline-variant/10">
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">Mã số hóa đơn</span>
                      <span className="font-bold text-on-surface">{invoice.invoiceNumber}</span>
                    </div>
                    {invoice.items && invoice.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm gap-4">
                        <span className="text-on-surface-variant">{item.description} x{item.quantity}</span>
                        <span className="font-bold text-on-surface">{formatCurrency(toNumber(item.lineTotal ?? item.finalAmount ?? item.unitPrice))}</span>
                      </div>
                    ))}
                    <div className="border-t border-outline-variant/20 pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Tạm tính</span>
                        <span>{formatCurrency(toNumber(invoice.subtotalAmount))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Giảm giá</span>
                        <span>-{formatCurrency(toNumber(invoice.discountAmount))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Đã thanh toán/đặt cọc</span>
                        <span>{formatCurrency(toNumber(invoice.paidAmount))}</span>
                      </div>
                      <div className="flex justify-between font-bold text-primary text-lg border-t border-outline-variant/20 pt-2">
                        <span>Còn lại phải thu</span>
                        <span>{formatCurrency(remainingAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {remainingAmount > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2 font-bold">
                          Số tiền thu tại quầy (VND)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={remainingAmount}
                          className="w-full border border-outline-variant rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary bg-white text-sm"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                        />
                      </div>

                      <div>
                        <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2 font-bold">
                          Phương thức thanh toán
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: "cash", label: "Tiền mặt" },
                            { key: "bank_transfer", label: "QR tại quầy" },
                          ].map((method) => (
                            <button
                              key={method.key}
                              onClick={() => setPayMethod(method.key as PayMethod)}
                              className={`py-3 rounded-lg border-2 font-label-md text-label-md text-sm transition-all ${
                                payMethod === method.key
                                  ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                                  : "border-outline-variant/40 text-on-surface-variant bg-white hover:border-outline-variant"
                              }`}
                            >
                              {method.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {payMethod === "bank_transfer" && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-label-md text-label-md text-primary font-bold">QR SePay</p>
                              <p className="text-xs text-on-surface-variant">
                                Khách quét QR hoặc chuyển khoản tại quầy. Sau khi thấy tiền vào, bấm xác nhận bên dưới để ghi nhận doanh thu.
                              </p>
                            </div>
                            <button
                              onClick={handleCreateQr}
                              disabled={isCreatingQr}
                              className="shrink-0 border border-primary text-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/10 disabled:opacity-40"
                            >
                              {isCreatingQr ? "Đang tạo..." : invoiceQr ? "Tạo lại QR" : "Tạo QR"}
                            </button>
                          </div>

                          {invoiceQr ? (
                            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-center">
                              <div className="bg-white rounded-xl border border-outline-variant/30 p-3 flex justify-center">
                                <img
                                  src={invoiceQr.qrImageUrl}
                                  alt={`QR thanh toán ${invoiceQr.referenceCode}`}
                                  className="w-36 h-36 object-contain"
                                />
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between gap-3">
                                  <span className="text-on-surface-variant">Mã nội dung</span>
                                  <span className="font-bold text-on-surface">{invoiceQr.referenceCode}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-on-surface-variant">Số tiền</span>
                                  <span className="font-bold text-primary">{formatCurrency(toNumber(invoiceQr.amount))}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-on-surface-variant">Trạng thái</span>
                                  <span className={`font-bold ${invoiceQr.paymentStatus === "paid" ? "text-green-700" : "text-on-surface"}`}>
                                    {invoiceQr.paymentStatus === "paid" ? "Đã thanh toán" : invoiceQr.paymentStatus === "expired" ? "Hết hạn" : "Đang chờ"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-outline-variant/50 bg-white/70 px-4 py-5 text-sm text-on-surface-variant text-center">
                              Bấm “Tạo QR” để khách quét thanh toán phần còn lại.
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handlePay}
                        disabled={isPaying}
                        className="w-full bg-primary text-on-primary py-4 rounded-full font-label-md text-label-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                      >
                        {isPaying ? "Đang xử lý..." : `Xác nhận đã thu ${formatCurrency(toNumber(amount || remainingAmount))}`}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 p-4 font-label-md text-label-md font-bold">
                      ✓ Hóa đơn đã được thanh toán đầy đủ.
                    </div>
                  )}

                  {payment && (
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
                      <p className="font-label-md text-label-md text-primary font-bold">✓ Ghi nhận thanh toán thành công</p>
                      <p className="text-xs text-on-surface-variant">
                        Mã giao dịch #{payment.id} · Số tiền {formatCurrency(toNumber(payment.amount))} · Hình thức: {payment.paymentMethod === "cash" ? "Tiền mặt" : "QR tại quầy"}
                      </p>
                      <button onClick={reset} className="mt-2 w-full border border-primary text-primary hover:bg-primary/5 py-3 rounded-full font-label-md text-label-md font-bold transition-all">
                        Tạo hóa đơn mới
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-outline-variant/20 text-center text-on-surface-variant shadow-sm">
              <span className="material-symbols-outlined text-5xl block mb-2 text-outline">receipt</span>
              <p className="font-label-md text-label-md">Chọn một lịch hẹn ở danh sách bên trái để thanh toán</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
