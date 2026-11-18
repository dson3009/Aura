"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Clock3,
  CreditCard,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { bookingService } from "@/lib/services/booking.service";
import { spaService } from "@/lib/services/spa.service";
import type { Booking, Branch, DepositPayment, SpaService } from "@/lib/types";

function toNumber(value: number | string | null | undefined) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatCountdown(expiresAt: string) {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return "Đã hết hạn";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Chờ chuyển khoản",
    paid: "Đã thanh toán",
    expired: "Đã hết hạn",
    failed: "Thanh toán lỗi",
    cancelled: "Đã hủy",
  };
  return labels[status] ?? status;
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={muted ? "text-on-surface-variant" : "text-on-surface"}>{label}</span>
      <span className="shrink-0 font-semibold text-on-surface">{value}</span>
    </div>
  );
}

export default function DepositPaymentPage() {
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId;
  const discountError = searchParams.get("discountError") === "1";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<SpaService[]>([]);
  const [depositPayment, setDepositPayment] = useState<DepositPayment | null>(null);
  const [countdown, setCountdown] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookingStatus = booking?.status;
  const depositPaymentStatus = depositPayment?.paymentStatus;

  const loadPaymentData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [bookingData, branchData, serviceData] = await Promise.all([
        bookingService.getById(bookingId),
        spaService.getBranches(),
        spaService.getServices(),
      ]);

      setBooking(bookingData);
      setBranches(branchData);
      setServices(serviceData);

      if (bookingData.status === "pending_payment") {
        const payment = await bookingService.createDepositPayment(bookingId);
        setDepositPayment(payment);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được thông tin thanh toán.");
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPaymentData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPaymentData]);

  useEffect(() => {
    if (!depositPayment?.expiresAt || depositPayment.paymentStatus !== "pending") {
      const timer = window.setTimeout(() => setCountdown(""), 0);
      return () => window.clearTimeout(timer);
    }

    const tick = () => setCountdown(formatCountdown(depositPayment.expiresAt));
    const firstTick = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);

    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
    };
  }, [depositPayment?.expiresAt, depositPayment?.paymentStatus]);

  useEffect(() => {
    if (depositPaymentStatus !== "pending") return;

    const interval = window.setInterval(async () => {
      try {
        const latest = await bookingService.getDepositPayment(bookingId);
        setDepositPayment(latest);

        if (latest.paymentStatus === "paid" || latest.bookingStatus === "confirmed") {
          const updatedBooking = await bookingService.getById(bookingId);
          setBooking(updatedBooking);
        }
      } catch {
        // Keep the QR visible; transient polling errors should not break payment.
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [bookingId, depositPaymentStatus]);

  const branch = useMemo(
    () => branches.find((item) => item.id === booking?.branchId),
    [branches, booking?.branchId],
  );

  const service = useMemo(() => {
    const serviceId = booking?.services[0]?.serviceId;
    return serviceId ? services.find((item) => item.id === serviceId) : undefined;
  }, [booking?.services, services]);

  const subtotal = toNumber(booking?.subtotalAmount);
  const discount = toNumber(booking?.discountAmount);
  const paid = toNumber(booking?.paidAmount);
  const depositAmount = depositPayment?.amount ?? toNumber(booking?.depositRequiredAmount);
  const payableNow = Math.max(0, depositAmount - paid);
  const remainingAtCounter = Math.max(0, subtotal - discount - Math.max(paid, depositAmount));
  const isPendingPayment = bookingStatus === "pending_payment";
  const isPaymentPaid = depositPaymentStatus === "paid" || bookingStatus === "confirmed";
  const isQrExpired = depositPaymentStatus === "expired" || countdown === "Đã hết hạn";

  async function handleRenewQr() {
    try {
      setIsCreatingPayment(true);
      setError(null);
      const payment = await bookingService.createDepositPayment(bookingId);
      setDepositPayment(payment);
    } catch (renewError) {
      setError(renewError instanceof Error ? renewError.message : "Không tạo lại được mã QR thanh toán.");
    } finally {
      setIsCreatingPayment(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 pt-28">
        <div className="flex items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-5 py-4 text-on-surface-variant shadow-sm">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          <p>Đang tải thông tin thanh toán...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 pt-28">
        <div className="max-w-md rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-sm">
          <p className="mb-5 text-error">{error || "Không tìm thấy lịch hẹn."}</p>
          <Link href="/customer/bookings" className="btn-primary inline-flex">
            Về lịch hẹn
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-28 text-on-surface">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/customer/bookings"
          className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Quay lại lịch hẹn
        </Link>

        <header className="mb-8 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface-container-lowest px-3 py-1 text-xs font-bold uppercase text-secondary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Thanh toán cọc SePay
            </div>
            <h1 className="font-headline-lg text-4xl text-primary md:text-5xl">
              Chuyển khoản để giữ lịch
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-on-surface-variant">
              Quét mã VietQR hoặc chuyển khoản đúng số tiền và nội dung. Trạng thái lịch hẹn sẽ tự cập nhật khi SePay xác nhận giao dịch.
            </p>
          </div>

          <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm shadow-sm">
            <p className="text-on-surface-variant">Mã lịch hẹn</p>
            <p className="font-semibold text-primary">#{booking.id}</p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
            <div className="grid divide-y divide-outline-variant/20 md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="p-5">
                <p className="mb-1 text-sm text-on-surface-variant">Dịch vụ</p>
                <p className="font-semibold">{service?.name || "Dịch vụ spa"}</p>
              </div>
              <div className="p-5">
                <p className="mb-1 text-sm text-on-surface-variant">Chi nhánh</p>
                <p className="font-semibold">{branch?.name || `Chi nhánh #${booking.branchId}`}</p>
              </div>
              <div className="p-5">
                <p className="mb-1 text-sm text-on-surface-variant">Thời gian</p>
                <p className="font-semibold">{formatDateTime(booking.startTime)}</p>
              </div>
            </div>

            <div className="border-t border-outline-variant/20 p-5 md:p-7">
              {isPendingPayment && depositPayment ? (
                <div className="grid gap-7 xl:grid-cols-[340px_1fr]">
                  <div>
                    <div className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm">
                      {depositPayment.qrImageUrl ? (
                        <Image
                          src={depositPayment.qrImageUrl}
                          alt={`QR thanh toán ${depositPayment.referenceCode}`}
                          width={320}
                          height={320}
                          unoptimized
                          className="aspect-square w-full object-contain"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-surface-container-low text-sm text-on-surface-variant">
                          Chưa có mã QR
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-center text-sm text-on-surface-variant">
                      Mã QR hết hạn sau <span className="font-semibold text-primary">{countdown || "..."}</span>
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-col justify-between">
                    <div>
                      <div className="mb-6 border-b border-outline-variant/20 pb-6">
                        <p className="mb-2 text-sm font-semibold uppercase text-secondary">Số tiền cần chuyển</p>
                        <p className="break-words font-headline-md text-5xl text-primary">
                          {formatCurrency(depositPayment.amount)}
                        </p>
                      </div>

                      <div className="mb-5">
                        <p className="mb-2 text-sm text-on-surface-variant">Nội dung chuyển khoản</p>
                        <div className="flex flex-col gap-3 rounded-lg border border-outline-variant/30 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                          <code className="min-w-0 break-all font-mono text-xl font-bold text-primary">
                            {depositPayment.referenceCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(depositPayment.referenceCode)}
                            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-outline-variant/40 px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary"
                          >
                            <Clipboard className="h-4 w-4" aria-hidden="true" />
                            Sao chép
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-outline-variant/20 px-4 py-3">
                          <div className="mb-2 flex items-center gap-2 text-sm text-on-surface-variant">
                            <CreditCard className="h-4 w-4" aria-hidden="true" />
                            Trạng thái
                          </div>
                          <p className="font-semibold">{paymentStatusLabel(depositPayment.paymentStatus)}</p>
                        </div>
                        <div className="rounded-lg border border-outline-variant/20 px-4 py-3">
                          <div className="mb-2 flex items-center gap-2 text-sm text-on-surface-variant">
                            <Clock3 className="h-4 w-4" aria-hidden="true" />
                            Thời gian còn lại
                          </div>
                          <p className="font-semibold">{countdown || "..."}</p>
                        </div>
                      </div>
                    </div>

                    {isQrExpired && !isPaymentPaid && (
                      <button
                        type="button"
                        onClick={handleRenewQr}
                        disabled={isCreatingPayment}
                        className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${isCreatingPayment ? "animate-spin" : ""}`} aria-hidden="true" />
                        {isCreatingPayment ? "Đang tạo lại QR..." : "Tạo lại mã QR"}
                      </button>
                    )}
                  </div>
                </div>
              ) : isPaymentPaid ? (
                <div className="flex items-start gap-4 rounded-lg border border-green-200 bg-green-50 p-5 text-green-800">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-bold">Thanh toán đã được ghi nhận</p>
                    <p className="mt-1">Lịch hẹn của bạn đã được xác nhận.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-outline-variant/30 bg-surface p-5 text-on-surface-variant">
                  Lịch hẹn này không cần thanh toán cọc hoặc không còn ở trạng thái chờ thanh toán.
                </div>
              )}

              {discountError && (
                <div className="mt-5 rounded-lg border border-secondary/20 bg-secondary-container/20 px-4 py-3 text-sm text-on-surface-variant">
                  Mã giảm giá không hợp lệ hoặc đã hết hạn. Lịch hẹn đã được tạo và bạn vẫn có thể thanh toán cọc.
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-lg border border-error-container bg-error-container/30 px-4 py-3 text-sm text-error">
                  {error}
                </div>
              )}
            </div>
          </section>

          <aside className="h-fit rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-sm lg:sticky lg:top-28">
            <div className="border-b border-outline-variant/20 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
                  <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-headline-sm text-2xl text-primary">Tóm tắt thanh toán</p>
                  <p className="text-sm text-on-surface-variant">Thanh toán cọc giữ lịch</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <SummaryRow label="Tạm tính" value={formatCurrency(subtotal)} muted />
                <SummaryRow label="Giảm giá" value={`-${formatCurrency(discount)}`} muted />
                <SummaryRow label="Đã thanh toán" value={formatCurrency(paid)} muted />
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5 rounded-lg bg-primary px-5 py-4 text-on-primary">
                <p className="mb-1 text-sm opacity-85">Cọc cần thanh toán</p>
                <p className="break-words font-headline-md text-4xl">{formatCurrency(payableNow)}</p>
              </div>

              <SummaryRow label="Còn lại tại quầy" value={formatCurrency(remainingAtCounter)} />

              <div className="mt-6 border-t border-outline-variant/20 pt-5">
                <p className="mb-2 font-semibold">Lưu ý</p>
                <p className="text-sm leading-6 text-on-surface-variant">
                  Không đóng trang trong khi chuyển khoản. Nếu đã chuyển đúng nội dung, trạng thái sẽ tự cập nhật sau vài giây.
                </p>
              </div>

              {isPaymentPaid ? (
                <Link href="/customer/bookings" className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Xem lịch đã xác nhận
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadPaymentData()}
                  className="btn-ghost mt-6 inline-flex w-full items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Làm mới trang
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
