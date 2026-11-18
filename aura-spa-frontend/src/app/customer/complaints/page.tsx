"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { bookingService } from "@/lib/services/booking.service";
import { complaintService } from "@/lib/services/complaint.service";
import { spaService } from "@/lib/services/spa.service";
import type { Booking, Branch, Complaint } from "@/lib/types";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatBookingLabel(booking: Booking, branch?: Branch) {
  const serviceName = booking.services[0]?.service?.name ?? "Dịch vụ spa";
  const branchName = branch?.name ?? `Chi nhánh #${booking.branchId}`;
  return `${serviceName} - ${formatDate(booking.startTime)} - ${branchName}`;
}

function getStatusLabel(status: Complaint["status"]) {
  if (status === "open") return "Mới";
  if (status === "in_progress") return "Đang xử lý";
  if (status === "resolved") return "Đã giải quyết";
  if (status === "rejected") return "Từ chối";
  if (status === "closed") return "Đã đóng";
  return status;
}

function getStatusClass(status: Complaint["status"]) {
  if (status === "resolved") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "in_progress") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

export default function CustomerComplaintsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("bookingId") ?? "";
  });
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("branchId") ?? "";
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId),
    [bookings, selectedBookingId]
  );
  const effectiveBranchId = selectedBooking?.branchId ?? selectedBranchId;
  const filteredBookings = useMemo(
    () => bookings.filter((booking) => booking.branchId === selectedBranchId),
    [bookings, selectedBranchId]
  );
  const isBookingComplaint = Boolean(selectedBooking);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        const [bookingData, branchData, complaintData] = await Promise.all([
          bookingService.getMyBookings(),
          spaService.getBranches(),
          complaintService.getMyComplaints(),
        ]);

        if (ignore) return;
        let nextBookings = bookingData;
        setBranches(branchData);
        setComplaints(complaintData);
        const queryParams = new URLSearchParams(window.location.search);
        const queryBookingId = queryParams.get("bookingId");
        const queryBranchId = queryParams.get("branchId");
        if (queryBookingId) {
          let queryBooking = nextBookings.find((booking) => booking.id === queryBookingId);
          if (!queryBooking) {
            try {
              queryBooking = await bookingService.getById(queryBookingId);
              nextBookings = [queryBooking, ...nextBookings.filter((booking) => booking.id !== queryBookingId)];
            } catch {
              queryBooking = undefined;
            }
          }

          if (queryBooking) {
            setSelectedBookingId(queryBooking.id);
            setSelectedBranchId(queryBooking.branchId);
          } else if (queryBranchId) {
            setSelectedBookingId("");
            setSelectedBranchId(queryBranchId);
          } else {
            setSelectedBookingId("");
          }
        } else if (queryBranchId) {
          setSelectedBranchId(queryBranchId);
        }
        setBookings(nextBookings);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Không tải được dữ liệu khiếu nại.");
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (selectedBooking) {
      const id = window.setTimeout(() => {
        setSelectedBranchId(selectedBooking.branchId);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [selectedBooking]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!title.trim() || !description.trim()) {
      setError("Vui lòng nhập tiêu đề và nội dung khiếu nại.");
      return;
    }

    if (!selectedBookingId && !effectiveBranchId) {
      setError("Vui lòng chọn lịch hẹn hoặc chi nhánh liên quan.");
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await complaintService.create({
        bookingId: selectedBookingId || undefined,
        branchId: selectedBookingId ? undefined : effectiveBranchId,
        title: title.trim(),
        description: description.trim(),
      });

      setComplaints((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setMessage("Đã gửi khiếu nại. Quản lý chi nhánh sẽ xử lý trong thời gian sớm nhất.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được khiếu nại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <div className="mx-auto max-w-5xl px-gutter">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-label-md text-secondary tracking-[0.2em] uppercase mb-2">AuraSpa</p>
            <h1
              className="text-primary mb-3"
              style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, lineHeight: "52px" }}
            >
              Khiếu nại của tôi
            </h1>
            <p className="text-on-surface-variant">
              Gửi phản ánh về lịch hẹn, dịch vụ hoặc trải nghiệm tại chi nhánh để quản lý xử lý trực tiếp.
            </p>
          </div>
          <Link href="/customer/bookings" className="btn-ghost w-fit">
            Xem lịch hẹn
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-10 text-center text-on-surface-variant">
            Đang tải dữ liệu...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            <form onSubmit={handleSubmit} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="font-headline-sm text-headline-sm text-primary mb-2">Gửi khiếu nại mới</h2>
                <p className="text-sm font-medium leading-6 text-on-surface">
                  Nếu khiếu nại liên quan đến một lịch hẹn cụ thể, hãy chọn lịch hẹn đó để hệ thống gửi đúng chi nhánh.
                </p>
              </div>

              {message && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              )}
              {error && (
                <div className="mb-4 rounded-lg border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest block mb-2 font-bold">
                    Chi nhánh tiếp nhận
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(event) => {
                      setSelectedBranchId(event.target.value);
                      setSelectedBookingId("");
                    }}
                    disabled={isBookingComplaint}
                    className="custom-input w-full font-semibold text-on-surface disabled:opacity-100 disabled:bg-surface-container-low disabled:text-on-surface"
                  >
                    <option value="">Chọn chi nhánh</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} - {branch.district || branch.city}
                      </option>
                    ))}
                  </select>
                  {isBookingComplaint && (
                    <p className="mt-1 text-xs font-medium text-on-surface-variant">
                      Chi nhánh được lấy tự động từ lịch hẹn đã chọn.
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest block mb-2 font-bold">
                    Lịch hẹn liên quan
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(event) => setSelectedBookingId(event.target.value)}
                    disabled={!selectedBranchId || isBookingComplaint}
                    className="custom-input w-full font-semibold text-on-surface disabled:opacity-100 disabled:bg-surface-container-low disabled:text-on-surface"
                  >
                    <option value="">
                      {selectedBranchId ? "Không gắn với lịch hẹn cụ thể" : "Chọn chi nhánh trước"}
                    </option>
                    {filteredBookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {formatBookingLabel(booking, branchMap.get(booking.branchId))}
                      </option>
                    ))}
                  </select>
                  {isBookingComplaint && (
                    <p className="mt-1 text-xs font-medium text-on-surface-variant">
                      Lịch hẹn đã được chọn từ trang booking. Dịch vụ sử dụng nằm trong dòng lịch hẹn này.
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest block mb-2 font-bold">
                    Tiêu đề
                  </label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="custom-input w-full font-semibold text-on-surface placeholder:font-normal"
                    maxLength={255}
                    placeholder="Ví dụ: Thời gian chờ quá lâu"
                  />
                </div>

                <div>
                  <label className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest block mb-2 font-bold">
                    Nội dung khiếu nại
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="custom-input min-h-36 w-full resize-none font-semibold text-on-surface placeholder:font-normal"
                    placeholder="Mô tả cụ thể trải nghiệm, thời gian, chi nhánh hoặc nhân viên liên quan..."
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Đang gửi..." : "Gửi khiếu nại"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle("");
                    setDescription("");
                    setMessage(null);
                    setError(null);
                  }}
                  className="btn-ghost flex-1"
                >
                  Xóa nội dung
                </button>
              </div>
            </form>

            <aside className="rounded-xl border border-outline-variant/30 bg-white p-5 shadow-sm">
              <h2 className="font-headline-sm text-headline-sm text-primary mb-4">Lịch sử khiếu nại</h2>
              {complaints.length === 0 ? (
                <p className="rounded-lg bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
                  Bạn chưa gửi khiếu nại nào.
                </p>
              ) : (
                <div className="space-y-3">
                  {complaints.map((complaint) => (
                    <div key={complaint.id} className="rounded-lg border border-outline-variant/20 p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="font-bold text-sm text-on-surface">{complaint.title}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusClass(complaint.status)}`}>
                          {getStatusLabel(complaint.status)}
                        </span>
                      </div>
                      <p className="mb-2 line-clamp-3 text-xs leading-5 text-on-surface-variant">{complaint.description}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {formatDate(complaint.createdAt)} - {branchMap.get(complaint.branchId)?.name ?? `Chi nhánh #${complaint.branchId}`}
                      </p>
                      {complaint.resolutionNote && (
                        <div className="mt-3 rounded-lg bg-green-50 p-3 text-xs leading-5 text-green-800">
                          <strong>Phản hồi:</strong> {complaint.resolutionNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
