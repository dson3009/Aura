"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bookingService } from "@/lib/services/booking.service";
import { reviewService } from "@/lib/services/review.service";
import { spaService } from "@/lib/services/spa.service";
import type { Booking, Branch, Review, SpaService, TimeSlot } from "@/lib/types";

type BookingTab = "upcoming" | "completed" | "cancelled";

function toNumber(value: number | string) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getBookingService(booking: Booking, serviceMap: Map<string, SpaService>) {
  const item = booking.services[0];
  return item ? serviceMap.get(item.serviceId) : undefined;
}

function getBookingServiceId(booking: Booking) {
  return booking.services[0]?.serviceId;
}

function getBookingPrice(booking: Booking) {
  const item = booking.services[0];
  return toNumber(item?.finalAmount ?? booking.remainingAmount ?? booking.subtotalAmount);
}

function getBookingTotal(booking: Booking) {
  const subtotal = toNumber(booking.subtotalAmount);
  const discount = toNumber(booking.discountAmount);
  const total = Math.max(0, subtotal - discount);
  return total || getBookingPrice(booking);
}

function getBookingPaid(booking: Booking) {
  return toNumber(booking.paidAmount);
}

function getBookingRemaining(booking: Booking) {
  const explicitRemaining = toNumber(booking.remainingAmount);
  if (explicitRemaining > 0 || getBookingPaid(booking) > 0) {
    return explicitRemaining;
  }

  return getBookingTotal(booking);
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function getPaymentSummaryLabel(booking: Booking) {
  const paid = getBookingPaid(booking);
  if (booking.status === "pending_payment") return "Chưa thanh toán cọc";
  if (paid > 0) return "Đã thanh toán cọc";
  if (booking.status === "service_completed") return "Dịch vụ đã xong, chờ thanh toán";
  if (booking.status === "completed") return "Đã hoàn tất dịch vụ";
  return "Chưa ghi nhận thanh toán";
}

function PaymentSummary({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const total = getBookingTotal(booking);
  const depositRequired = toNumber(booking.depositRequiredAmount);
  const paid = getBookingPaid(booking);
  const remaining = getBookingRemaining(booking);
  const isDepositPaid = paid > 0 && booking.status !== "pending_payment";

  return (
    <div className={`rounded-lg border ${isDepositPaid ? "border-green-200 bg-green-50" : "border-outline-variant/30 bg-surface-container-low"} ${compact ? "p-4" : "p-5"}`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-on-surface-variant">Thanh toán</p>
          <p className={`font-semibold ${isDepositPaid ? "text-green-800" : "text-primary"}`}>
            {getPaymentSummaryLabel(booking)}
          </p>
        </div>
        {isDepositPaid && (
          <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
            Cọc đã nhận
          </span>
        )}
      </div>

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-3"}`}>
        <div>
          <p className="text-sm text-on-surface-variant">Tổng tiền</p>
          <p className="font-semibold text-on-surface">{formatCurrency(total)}</p>
        </div>
        <div>
          <p className="text-sm text-on-surface-variant">
            {paid > 0 ? "Đã thanh toán cọc" : "Cọc cần thanh toán"}
          </p>
          <p className={paid > 0 ? "font-semibold text-green-800" : "font-semibold text-on-surface"}>
            {formatCurrency(paid > 0 ? paid : depositRequired)}
          </p>
        </div>
        <div>
          <p className="text-sm text-on-surface-variant">Còn lại khi làm xong</p>
          <p className="font-semibold text-primary">{formatCurrency(remaining)}</p>
        </div>
      </div>
    </div>
  );
}

function getBookingDuration(booking: Booking, service?: SpaService) {
  return booking.services[0]?.durationMinutes ?? service?.defaultDurationMinutes ?? 0;
}

function getStatusLabel(status: Booking["status"]) {
  if (status === "completed") return "Đã hoàn thành";
  if (status === "cancelled") return "Đã hủy";
  if (status === "no_show") return "Không đến";
  if (status === "rescheduled") return "Đã đổi lịch";
  if (status === "transferred") return "Đã chuyển chi nhánh";
  if (status === "checked_in") return "Đã check-in";
  if (status === "service_completed") return "Chờ thanh toán";
  if (status === "in_service") return "Đang phục vụ";
  if (status === "pending_payment") return "Chờ thanh toán";
  return "Đã xác nhận";
}

function getTabForBooking(booking: Booking): BookingTab {
  if (booking.status === "completed") return "completed";
  if (["cancelled", "no_show", "rescheduled", "transferred"].includes(booking.status)) return "cancelled";
  return "upcoming";
}

function canRescheduleBooking(booking: Booking) {
  return (
    ["pending_payment", "confirmed"].includes(booking.status) &&
    new Date(booking.startTime).getTime() > Date.now()
  );
}

function canCancelBooking(booking: Booking) {
  return (
    ["pending_payment", "confirmed"].includes(booking.status) &&
    new Date(booking.startTime).getTime() > Date.now()
  );
}

function getCancelErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  const normalized = raw.toLowerCase();

  if (normalized.includes("already started") || normalized.includes("start time")) {
    return "Lịch hẹn đã bắt đầu nên không thể hủy trên website. Vui lòng liên hệ chi nhánh để được hỗ trợ.";
  }

  if (normalized.includes("only confirmed") || normalized.includes("status")) {
    return "Lịch hẹn hiện không ở trạng thái có thể hủy.";
  }

  return "Không hủy được lịch hẹn. Vui lòng thử lại hoặc liên hệ chi nhánh để được hỗ trợ.";
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildStartTime(date: string, time: string) {
  return `${date}T${time}:00+07:00`;
}

function getDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      value: formatDateForApi(date),
      label: date.toLocaleDateString("vi-VN", { weekday: "short" }),
      day: date.getDate(),
    };
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-outline-variant/20 pb-3">
      <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      <span className="font-label-md text-label-md text-on-surface text-right">{value}</span>
    </div>
  );
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<SpaService[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(formatDateForApi(new Date()));
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [transferBooking, setTransferBooking] = useState<Booking | null>(null);
  const [transferBranchId, setTransferBranchId] = useState<string>("");
  const [transferDate, setTransferDate] = useState(formatDateForApi(new Date()));
  const [transferTime, setTransferTime] = useState<string | null>(null);
  const [transferSlots, setTransferSlots] = useState<TimeSlot[]>([]);
  const [isLoadingTransferSlots, setIsLoadingTransferSlots] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const days = useMemo(() => getDays(10), []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const refreshBookings = useCallback(async () => {
    try {
      setError(null);

      const [bookingData, branchData, serviceData, reviewData] = await Promise.all([
        bookingService.getMyBookings(),
        spaService.getBranches(),
        spaService.getServices(),
        reviewService.getMyReviews(),
      ]);

      setBookings(bookingData);
      setBranches(branchData);
      setServices(serviceData);
      setReviews(reviewData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không tải được lịch hẹn.";
      setError(message);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadInitialBookings() {
      try {
        const [bookingData, branchData, serviceData] = await Promise.all([
          bookingService.getMyBookings(),
          spaService.getBranches(),
          spaService.getServices(),
        ]);

        if (ignore) return;

        setBookings(bookingData);
        setBranches(branchData);
        setServices(serviceData);

        // Load reviews separately — failure is non-critical (only affects review button state)
        reviewService.getMyReviews()
          .then((reviewData) => { if (!ignore) setReviews(reviewData); })
          .catch(() => { if (!ignore) setReviews([]); });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Không tải được lịch hẹn.";
        if (!ignore) setError(message);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadInitialBookings();

    return () => {
      ignore = true;
    };
  }, []);

  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);
  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const reviewedBookingIds = useMemo(() => new Set(reviews.map((review) => review.bookingId)), [reviews]);
  const availableTransferBranches = useMemo(
    () =>
      branches.filter(
        (branch) =>
          branch.status === "active" &&
          (!transferBooking || branch.id !== transferBooking.branchId)
      ),
    [branches, transferBooking]
  );

  const filteredBookings = useMemo(
    () => bookings.filter((booking) => getTabForBooking(booking) === activeTab),
    [activeTab, bookings]
  );

  useEffect(() => {
    let ignore = false;

    async function loadSlots() {
      if (!rescheduleBooking) return;

      const serviceId = getBookingServiceId(rescheduleBooking);
      if (!serviceId) {
        setRescheduleError("Không tìm thấy dịch vụ của lịch hẹn này.");
        return;
      }

      try {
        setIsLoadingSlots(true);
        setRescheduleError(null);
        const result = await bookingService.getAvailability(
          rescheduleBooking.branchId,
          serviceId,
          rescheduleDate,
          rescheduleBooking.technicianId ?? undefined
        );

        if (ignore) return;

        setRescheduleSlots(result.slots);
        setRescheduleTime(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Không tải được giờ trống.";
        if (!ignore) {
          setRescheduleSlots([]);
          setRescheduleError(message);
        }
      } finally {
        if (!ignore) setIsLoadingSlots(false);
      }
    }

    loadSlots();

    return () => {
      ignore = true;
    };
  }, [rescheduleBooking, rescheduleDate]);

  useEffect(() => {
    let ignore = false;

    async function loadTransferSlots() {
      if (!transferBooking || !transferBranchId) return;

      const serviceId = getBookingServiceId(transferBooking);
      if (!serviceId) {
        setTransferError("Không tìm thấy dịch vụ của lịch hẹn này.");
        return;
      }

      try {
        setIsLoadingTransferSlots(true);
        setTransferError(null);
        const result = await bookingService.getAvailability(transferBranchId, serviceId, transferDate);

        if (ignore) return;

        setTransferSlots(result.slots);
        setTransferTime(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Không tải được giờ trống tại chi nhánh mới.";
        if (!ignore) {
          setTransferSlots([]);
          setTransferError(message);
        }
      } finally {
        if (!ignore) setIsLoadingTransferSlots(false);
      }
    }

    loadTransferSlots();

    return () => {
      ignore = true;
    };
  }, [transferBooking, transferBranchId, transferDate]);

  const handleCancelBooking = async (bookingId: string) => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (booking && !canCancelBooking(booking)) {
      setError("Lịch hẹn đã bắt đầu nên không thể hủy trên website. Vui lòng liên hệ chi nhánh để được hỗ trợ.");
      return;
    }

    try {
      setCancellingId(bookingId);
      setError(null);
      const updatedBooking = await bookingService.cancel(bookingId, "Khách hàng hủy lịch từ website");
      setBookings((current) =>
        current.map((booking) => (booking.id === bookingId ? updatedBooking : booking))
      );
      setActiveTab("cancelled");
      showToast("Đã hủy lịch hẹn. Thông báo đã được gửi tới chi nhánh.");
    } catch (err) {
      setError(getCancelErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  };

  const openRescheduleModal = (booking: Booking) => {
    setSelectedBooking(null);
    setRescheduleBooking(booking);
    setRescheduleDate(formatDateForApi(new Date(booking.startTime)));
    setRescheduleTime(null);
    setRescheduleError(null);
    setRescheduleSlots([]);
  };

  const closeRescheduleModal = () => {
    setRescheduleBooking(null);
    setRescheduleTime(null);
    setRescheduleError(null);
    setRescheduleSlots([]);
  };

  const handleReschedule = async () => {
    if (!rescheduleBooking || !rescheduleTime) return;

    try {
      setIsRescheduling(true);
      setRescheduleError(null);
      await bookingService.reschedule(rescheduleBooking.id, {
        startTime: buildStartTime(rescheduleDate, rescheduleTime),
      });

      await refreshBookings();
      closeRescheduleModal();
      setActiveTab("upcoming");
      showToast("Đã đổi lịch hẹn. Thông báo đã được gửi tới chi nhánh.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không đổi được lịch. Vui lòng chọn giờ khác.";
      setRescheduleError(message);
    } finally {
      setIsRescheduling(false);
    }
  };

  const openTransferModal = (booking: Booking) => {
    const firstTargetBranch = branches.find(
      (branch) => branch.status === "active" && branch.id !== booking.branchId
    );

    setSelectedBooking(null);
    setTransferBooking(booking);
    setTransferBranchId(firstTargetBranch?.id ?? "");
    setTransferDate(formatDateForApi(new Date(booking.startTime)));
    setTransferTime(null);
    setTransferError(firstTargetBranch ? null : "Hiện chưa có chi nhánh khác để chuyển lịch.");
    setTransferSlots([]);
  };

  const closeTransferModal = () => {
    setTransferBooking(null);
    setTransferBranchId("");
    setTransferTime(null);
    setTransferError(null);
    setTransferSlots([]);
  };

  const handleTransfer = async () => {
    if (!transferBooking || !transferBranchId || !transferTime) return;

    try {
      setIsTransferring(true);
      setTransferError(null);
      await bookingService.transfer(transferBooking.id, {
        targetBranchId: transferBranchId,
        startTime: buildStartTime(transferDate, transferTime),
      });

      await refreshBookings();
      closeTransferModal();
      setActiveTab("upcoming");
      showToast("Đã chuyển chi nhánh. Thông báo đã được gửi tới chi nhánh liên quan.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không chuyển được chi nhánh. Vui lòng chọn chi nhánh hoặc giờ khác.";
      setTransferError(message);
    } finally {
      setIsTransferring(false);
    }
  };

  const openReviewModal = (booking: Booking) => {
    setReviewBooking(booking);
    setReviewRating(5);
    setReviewComment("");
    setReviewError(null);
  };

  const closeReviewModal = () => {
    setReviewBooking(null);
    setReviewComment("");
    setReviewError(null);
  };

  const handleSubmitReview = async () => {
    if (!reviewBooking) return;

    try {
      setIsSubmittingReview(true);
      setReviewError(null);
      const createdReview = await reviewService.create({
        bookingId: reviewBooking.id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });

      setReviews((current) => [createdReview, ...current]);
      closeReviewModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không gửi được đánh giá.";
      setReviewError(message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex items-center justify-center">
        <p className="font-body-md text-on-surface-variant">Đang tải lịch hẹn...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      {toast && (
        <div className="fixed right-6 top-20 z-[60] rounded-xl bg-primary px-5 py-3 font-label-md text-label-md text-on-primary shadow-lg">
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-gutter">
        <div className="mb-10">
          <p className="font-label-md text-secondary tracking-[0.2em] uppercase mb-2">AuraSpa</p>

          <h1
            className="text-primary mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 44,
              lineHeight: "52px",
            }}
          >
            Lịch hẹn của tôi
          </h1>

          <p className="text-on-surface-variant">
            Theo dõi và quản lý các lịch hẹn bạn đã đặt.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-error">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-8 border-b border-outline-variant/20">
          {[
            { key: "upcoming", label: "Sắp tới" },
            { key: "completed", label: "Đã hoàn thành" },
            { key: "cancelled", label: "Đã hủy" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as BookingTab)}
              className={`px-4 py-3 font-label-md transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "text-primary border-primary"
                  : "text-on-surface-variant border-transparent hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-10 text-center">
            <h2
              className="text-primary mb-2"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 28,
              }}
            >
              Chưa có lịch hẹn nào
            </h2>

            <p className="text-on-surface-variant mb-6">
              Các lịch hẹn của bạn sẽ hiển thị tại đây sau khi đặt lịch.
            </p>

            <Link href="/booking">
              <button className="btn-primary">Đặt lịch ngay</button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const branch = branchMap.get(booking.branchId);
              const service = getBookingService(booking, serviceMap);
              const total = getBookingTotal(booking);
              const duration = getBookingDuration(booking, service);

              return (
                <div
                  key={booking.id}
                  className={`bg-surface-container-lowest border rounded-xl p-6 transition-all ${
                    getTabForBooking(booking) === "cancelled"
                      ? "border-outline-variant/20 opacity-70"
                      : "border-outline-variant/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                    <div>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${
                          getTabForBooking(booking) === "cancelled"
                            ? "bg-error-container text-error"
                            : booking.status === "completed"
                            ? "bg-surface-dim text-on-surface-variant"
                            : "bg-primary-fixed text-primary"
                        }`}
                      >
                        {getStatusLabel(booking.status)}
                      </span>

                      <h2
                        className="text-on-surface mb-1"
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: 26,
                        }}
                      >
                        {service?.name || "Dịch vụ spa"}
                      </h2>

                      <p className="text-on-surface-variant">{duration} phút</p>
                    </div>

                    <p className="text-primary font-semibold text-xl">
                      {formatCurrency(total)}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-6 text-on-surface-variant">
                    <div>
                      <p className="text-sm mb-1">Ngày hẹn</p>
                      <p className="text-on-surface">{formatDate(booking.startTime)}</p>
                    </div>

                    <div>
                      <p className="text-sm mb-1">Giờ hẹn</p>
                      <p className="text-on-surface">{formatTime(booking.startTime)}</p>
                    </div>

                    <div>
                      <p className="text-sm mb-1">Therapist</p>
                      <p className="text-on-surface">
                        {booking.technician?.fullName || "Hệ thống tự phân công"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm mb-1">Chi nhánh</p>
                      <p className="text-on-surface">{branch?.name || `Chi nhánh #${booking.branchId}`}</p>
                    </div>
                  </div>

                  <PaymentSummary booking={booking} compact />

                  <div className="mt-6 space-y-3">
                    {getTabForBooking(booking) === "upcoming" && booking.status === "pending_payment" && (
                      <Link
                        href={`/customer/payment/${booking.id}`}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:opacity-90"
                      >
                        <span className="material-symbols-outlined text-[18px]">payments</span>
                        Thanh toán cọc
                      </Link>
                    )}

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <button onClick={() => setSelectedBooking(booking)} className="btn-ghost min-h-11">
                        Chi tiết
                      </button>

                      <Link
                        href={`/customer/complaints?bookingId=${encodeURIComponent(booking.id)}&branchId=${encodeURIComponent(booking.branchId)}`}
                        className="btn-ghost min-h-11 flex items-center justify-center"
                      >
                        Khiếu nại
                      </Link>

                      {getTabForBooking(booking) === "upcoming" && (
                        <>
                          {canRescheduleBooking(booking) && (
                            <button onClick={() => openRescheduleModal(booking)} className="btn-ghost min-h-11">
                              Đổi lịch
                            </button>
                          )}

                          <button onClick={() => openTransferModal(booking)} className="btn-ghost min-h-11">
                            Chuyển chi nhánh
                          </button>

                          {canCancelBooking(booking) && (
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              disabled={cancellingId === booking.id}
                              className="btn-ghost min-h-11 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {cancellingId === booking.id ? "Đang hủy..." : "Hủy lịch"}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {booking.status === "completed" && (
                      reviewedBookingIds.has(booking.id) ? (
                        <button disabled className="btn-ghost flex-1 opacity-50 cursor-not-allowed">
                          Đã đánh giá
                        </button>
                      ) : (
                        <button onClick={() => openReviewModal(booking)} className="btn-primary flex-1">
                          Đánh giá
                        </button>
                      )
                    )}
                  </div>

                  {getTabForBooking(booking) === "cancelled" && (
                    <p className="text-on-surface-variant italic mt-4">
                      Lịch hẹn này không còn hiệu lực.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-surface p-6 shadow-xl border border-outline-variant/30">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-1">
                  Chi tiết lịch hẹn
                </p>
                <h2 className="font-headline-sm text-headline-sm text-primary">
                  {getBookingService(selectedBooking, serviceMap)?.name || "Dịch vụ spa"}
                </h2>
              </div>

              <button
                onClick={() => setSelectedBooking(null)}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <DetailRow label="Trạng thái" value={getStatusLabel(selectedBooking.status)} />
              <DetailRow
                label="Chi nhánh"
                value={branchMap.get(selectedBooking.branchId)?.name || `Chi nhánh #${selectedBooking.branchId}`}
              />
              <DetailRow label="Ngày hẹn" value={formatDate(selectedBooking.startTime)} />
              <DetailRow
                label="Giờ hẹn"
                value={`${formatTime(selectedBooking.startTime)} - ${formatTime(selectedBooking.endTime)}`}
              />
              <DetailRow
                label="Therapist"
                value={selectedBooking.technicianId ? `Mã nhân viên ${selectedBooking.technicianId}` : "Hệ thống tự phân công"}
              />
              {selectedBooking.notes && <DetailRow label="Ghi chú" value={selectedBooking.notes} />}
            </div>

            <div className="mt-5">
              <PaymentSummary booking={selectedBooking} />
            </div>

            <div className="mt-6 space-y-3">
              {getTabForBooking(selectedBooking) === "upcoming" && selectedBooking.status === "pending_payment" && (
                <Link
                  href={`/customer/payment/${selectedBooking.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  Thanh toán cọc
                </Link>
              )}

              <div className="grid grid-cols-2 gap-3">
                {getTabForBooking(selectedBooking) === "upcoming" && (
                  <>
                    {canRescheduleBooking(selectedBooking) && (
                      <button onClick={() => openRescheduleModal(selectedBooking)} className="btn-ghost min-h-11">
                        Đổi lịch
                      </button>
                    )}
                    <button onClick={() => openTransferModal(selectedBooking)} className="btn-ghost min-h-11">
                      Chuyển chi nhánh
                    </button>
                  </>
                )}
                <Link
                  href={`/customer/complaints?bookingId=${encodeURIComponent(selectedBooking.id)}&branchId=${encodeURIComponent(selectedBooking.branchId)}`}
                  className="btn-ghost min-h-11 flex items-center justify-center"
                >
                  Khiếu nại
                </Link>
                <button onClick={() => setSelectedBooking(null)} className="btn-ghost min-h-11">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-surface p-6 shadow-xl border border-outline-variant/30">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-1">
                  Đổi lịch hẹn
                </p>
                <h2 className="font-headline-sm text-headline-sm text-primary">
                  {getBookingService(rescheduleBooking, serviceMap)?.name || "Dịch vụ spa"}
                </h2>
                <p className="text-on-surface-variant mt-1">
                  {branchMap.get(rescheduleBooking.branchId)?.name || `Chi nhánh #${rescheduleBooking.branchId}`}
                </p>
              </div>

              <button
                onClick={closeRescheduleModal}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-6">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
                Chọn ngày mới
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => setRescheduleDate(day.value)}
                    className={`flex-shrink-0 w-16 h-20 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${
                      rescheduleDate === day.value
                        ? "bg-primary text-on-primary border-primary"
                        : "border-outline-variant text-on-surface hover:border-primary"
                    }`}
                  >
                    <span className="font-label-sm text-label-sm" style={{ fontSize: 11 }}>
                      {day.label}
                    </span>
                    <span className="font-label-md text-label-md">{day.day}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
                Chọn giờ mới
              </p>

              {isLoadingSlots && (
                <p className="text-on-surface-variant mb-3">Đang tải giờ trống...</p>
              )}

              {rescheduleError && (
                <div className="mb-4 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-error">
                  {rescheduleError}
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {rescheduleSlots.map((slot) => (
                  <button
                    key={slot.startTime}
                    disabled={!slot.available}
                    onClick={() => setRescheduleTime(slot.startTime)}
                    className={`py-3 rounded-lg font-label-md text-label-md border transition-all ${
                      !slot.available
                        ? "border-outline-variant/30 text-on-surface-variant/30 cursor-not-allowed"
                        : rescheduleTime === slot.startTime
                        ? "bg-primary text-on-primary border-primary"
                        : "border-outline-variant text-on-surface hover:border-primary"
                    }`}
                  >
                    {slot.startTime}
                  </button>
                ))}
              </div>

              {!isLoadingSlots && rescheduleSlots.length === 0 && !rescheduleError && (
                <p className="text-on-surface-variant mt-3">Không có giờ trống cho ngày này.</p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={closeRescheduleModal} className="btn-ghost flex-1">
                Hủy
              </button>
              <button
                onClick={handleReschedule}
                disabled={!rescheduleTime || isRescheduling}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRescheduling ? "Đang đổi lịch..." : "Xác nhận đổi lịch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {transferBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-surface p-6 shadow-xl border border-outline-variant/30">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-1">
                  Chuyển chi nhánh
                </p>
                <h2 className="font-headline-sm text-headline-sm text-primary">
                  {getBookingService(transferBooking, serviceMap)?.name || "Dịch vụ spa"}
                </h2>
                <p className="text-on-surface-variant mt-1">
                  Từ {branchMap.get(transferBooking.branchId)?.name || `Chi nhánh #${transferBooking.branchId}`}
                </p>
              </div>

              <button
                onClick={closeTransferModal}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-6">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest block mb-3">
                Chi nhánh mới
              </label>
              <select
                value={transferBranchId}
                onChange={(event) => {
                  setTransferBranchId(event.target.value);
                  setTransferTime(null);
                  setTransferSlots([]);
                }}
                className="custom-input w-full"
              >
                {availableTransferBranches.length === 0 ? (
                  <option value="">Chưa có chi nhánh khác</option>
                ) : (
                  availableTransferBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} - {branch.district || branch.city}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mb-6">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
                Chọn ngày tại chi nhánh mới
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => setTransferDate(day.value)}
                    className={`flex-shrink-0 w-16 h-20 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${
                      transferDate === day.value
                        ? "bg-primary text-on-primary border-primary"
                        : "border-outline-variant text-on-surface hover:border-primary"
                    }`}
                  >
                    <span className="font-label-sm text-label-sm" style={{ fontSize: 11 }}>
                      {day.label}
                    </span>
                    <span className="font-label-md text-label-md">{day.day}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
                Chọn giờ còn trống
              </p>

              {isLoadingTransferSlots && (
                <p className="text-on-surface-variant mb-3">Đang tải giờ trống...</p>
              )}

              {transferError && (
                <div className="mb-4 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-error">
                  {transferError}
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {transferSlots.map((slot) => (
                  <button
                    key={slot.startTime}
                    disabled={!slot.available}
                    onClick={() => setTransferTime(slot.startTime)}
                    className={`py-3 rounded-lg font-label-md text-label-md border transition-all ${
                      !slot.available
                        ? "border-outline-variant/30 text-on-surface-variant/30 cursor-not-allowed"
                        : transferTime === slot.startTime
                        ? "bg-primary text-on-primary border-primary"
                        : "border-outline-variant text-on-surface hover:border-primary"
                    }`}
                  >
                    {slot.startTime}
                  </button>
                ))}
              </div>

              {!isLoadingTransferSlots && transferSlots.length === 0 && !transferError && transferBranchId && (
                <p className="text-on-surface-variant mt-3">Không có giờ trống tại chi nhánh này trong ngày đã chọn.</p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={closeTransferModal} className="btn-ghost flex-1">
                Hủy
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferBranchId || !transferTime || isTransferring}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isTransferring ? "Đang chuyển..." : "Xác nhận chuyển chi nhánh"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl border border-outline-variant/30">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-1">
                  Đánh giá dịch vụ
                </p>
                <h2 className="font-headline-sm text-headline-sm text-primary">
                  {getBookingService(reviewBooking, serviceMap)?.name || "Dịch vụ spa"}
                </h2>
              </div>

              <button
                onClick={closeReviewModal}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-6">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
                Mức hài lòng
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all ${
                      star <= reviewRating
                        ? "bg-primary text-on-primary border-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary"
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest block mb-3">
                Nhận xét
              </label>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                className="custom-input w-full min-h-28 resize-none"
                placeholder="Chia sẻ trải nghiệm của bạn..."
              />
            </div>

            {reviewError && (
              <div className="mb-4 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-error">
                {reviewError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={closeReviewModal} className="btn-ghost flex-1">
                Hủy
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmittingReview ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
