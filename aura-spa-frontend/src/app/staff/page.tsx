"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { staffService } from "@/lib/services/staff.service";
import { bookingService } from "@/lib/services/booking.service";
import { treatmentService } from "@/lib/services/treatment.service";
import {
  TODAY_APPOINTMENTS, ROOMS, CUSTOMER_HEALTH_RECORDS,
  getStatusColor, getStatusLabel, formatCurrency,
  AppointmentStatus,
} from "@/lib/mock-data";

function toLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const SCHEDULE_RANGE_DAYS = 6;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getScheduleRange(startDate = new Date()) {
  return {
    from: toLocalDateInput(startDate),
    to: toLocalDateInput(addDays(startDate, SCHEDULE_RANGE_DAYS)),
  };
}

function parseLocalDateInput(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayHeading(dateStr: string) {
  const today = toLocalDateInput(new Date());
  const tomorrow = toLocalDateInput(addDays(new Date(), 1));
  if (dateStr === today) return "Hôm nay";
  if (dateStr === tomorrow) return "Ngày mai";

  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toDateTimeLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dayDistanceFromToday(dateStr: string) {
  const today = new Date(`${toLocalDateInput(new Date())}T00:00:00`);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function daySortPriority(dateStr: string) {
  const distance = dayDistanceFromToday(dateStr);
  if (distance === 0) return 0;
  if (distance > 0) return distance;
  return 1000 + Math.abs(distance);
}

function dayChipLabel(dateStr: string) {
  const distance = dayDistanceFromToday(dateStr);
  if (distance === 0) return "Hôm nay";
  if (distance === 1) return "Ngày mai";
  if (distance < 0) return `${Math.abs(distance)} ngày trước`;
  return `+${distance} ngày`;
}

function normalizeErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("Room must be assigned before check-in")) {
    return "Cần chọn phòng trước khi check-in.";
  }
  if (raw.includes("Room is already assigned to another booking in this time slot")) {
    return "Phòng này đang được dùng trong khung giờ của lịch khác.";
  }
  if (raw.includes("Only confirmed bookings can be checked in")) {
    return "Chỉ lịch ở trạng thái Đã xác nhận mới được tiếp nhận.";
  }
  if (raw.includes("Cannot check in before the booking start time")) {
    return "Chưa đến giờ hẹn nên chưa thể tiếp nhận khách.";
  }
  if (raw.includes("not an active staff member at this branch")) {
    return "Tài khoản này không phải nhân viên đang hoạt động tại chi nhánh của lịch hẹn.";
  }
  if (raw.includes("Booking") && raw.includes("not found")) {
    return "Không tìm thấy lịch hẹn này. Hãy làm mới danh sách rồi thử lại.";
  }
  if (raw === "SESSION_EXPIRED") {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  return raw || "Không thể tiếp nhận khách do lỗi hệ thống.";
}

function getCheckInBlockReason(appt: any) {
  if (!appt) return "Không tìm thấy lịch hẹn cần tiếp nhận.";
  if (new Date(appt.startTime).getTime() > Date.now()) {
    return `Chưa thể tiếp nhận: lịch bắt đầu lúc ${formatDateTime(appt.startTime)}.`;
  }
  if (appt.status === "pending_payment") {
    return "Chưa thể tiếp nhận: khách vẫn đang chờ thanh toán cọc.";
  }
  if (appt.status === "checked_in" || appt.status === "in_service") {
    return "Lịch này đã được tiếp nhận trước đó.";
  }
  if (appt.status === "service_completed") {
    return "Dịch vụ đã xong, đang chờ tạo hóa đơn hoặc thanh toán.";
  }
  if (appt.status === "completed") {
    return "Lịch này đã hoàn thành.";
  }
  if (["cancelled", "no_show", "rescheduled", "transferred"].includes(appt.status)) {
    return `Không thể tiếp nhận vì lịch đang ở trạng thái: ${getStatusLabel(appt.status)}.`;
  }
  if (appt.status !== "confirmed") {
    return `Không thể tiếp nhận vì lịch đang ở trạng thái: ${getStatusLabel(appt.status)}.`;
  }
  return "";
}

function isRoomHoldingStatus(status: string) {
  return status === "confirmed" || status === "checked_in" || status === "in_service";
}

function appointmentsOverlap(first: any, second: any) {
  return new Date(first.startTime).getTime() < new Date(second.endTime).getTime()
    && new Date(first.endTime).getTime() > new Date(second.startTime).getTime();
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const [selectedAppt, setSelectedAppt] = useState<string | null>(null);
  const [appts, setAppts] = useState<any[]>([]);
  const [checkInSearch, setCheckInSearch] = useState("");
  const [checkInError, setCheckInError] = useState("");
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [liveHealthRecord, setLiveHealthRecord] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"personal" | "branch">("branch");
  const [roomPickerApptId, setRoomPickerApptId] = useState<string | null>(null);
  const [roomPickerValue, setRoomPickerValue] = useState("");
  const [roomPickerError, setRoomPickerError] = useState("");
  const [isAssigningRoom, setIsAssigningRoom] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState(() => toLocalDateInput(new Date()));
  const [treatmentNote, setTreatmentNote] = useState("");
  const [beforeImageUrls, setBeforeImageUrls] = useState("");
  const [afterImageUrls, setAfterImageUrls] = useState("");
  const [treatmentCareRecommendation, setTreatmentCareRecommendation] = useState("");
  const [treatmentNextRecommendedAt, setTreatmentNextRecommendedAt] = useState("");
  const [isSavingTreatmentProgress, setIsSavingTreatmentProgress] = useState(false);
  const scheduleRange = useMemo(() => getScheduleRange(parseLocalDateInput(rangeStartDate)), [rangeStartDate]);

  const mapBookingToAppt = (b: any, fallbackStaffName?: string) => {
    const mock = TODAY_APPOINTMENTS.find((a) => a.id === b.id);
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    const time = start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const duration = Math.round((end.getTime() - start.getTime()) / 60000);
    return {
      id: b.id,
      customerName: b.customer?.fullName || b.customerName || mock?.customerName || "Khách hàng",
      customerPhone: b.customer?.phone || b.customerPhone || mock?.customerPhone || "",
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      time: time,
      duration: duration > 0 ? duration : (mock?.duration ?? 60),
      service: b.services?.[0]?.service?.name || b.service || mock?.service || "Dịch vụ trị liệu",
      price: b.subtotalAmount || b.price || mock?.price || 500000,
      technicianName: b.technician?.fullName || b.technicianName || mock?.technicianName || fallbackStaffName || "Kỹ thuật viên",
      room: b.room || mock?.room || "Chưa phân phòng",
      date: toLocalDateInput(start),
      customerId: b.customerId || mock?.customerId || "",
      technicianId: b.technicianId || mock?.technicianId || "",
      treatmentSession: b.treatmentSession ?? null,
    };
  };

  const loadTimetable = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      if (!user?.branchId) {
        throw new Error("Không xác định được chi nhánh của tài khoản.");
      }
      const bookings = await bookingService.getBranchBookings(
        user.branchId,
        undefined,
        scheduleRange.from,
        scheduleRange.to,
        200,
      );
      const visibleBookings = viewMode === "personal"
        ? (bookings || []).filter((booking) => String(booking.technicianId) === String(user.id))
        : (bookings || []);
      const appointments = visibleBookings.map((booking) => mapBookingToAppt(booking, user.name));
      setAppts(appointments);
      setSelectedAppt((current) =>
        current && appointments.some((appointment) =>
          appointment.id === current
          && appointment.date >= scheduleRange.from
          && appointment.date <= scheduleRange.to
        )
          ? current
          : appointments
              .slice()
              .filter((appointment) => appointment.date >= scheduleRange.from && appointment.date <= scheduleRange.to)
              .sort((a, b) => {
                const dayDelta = daySortPriority(a.date) - daySortPriority(b.date);
                return dayDelta || new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
              })
              .find((appointment) => appointment.date === toLocalDateInput(new Date()))?.id
              ?? appointments
                .slice()
                .filter((appointment) => appointment.date >= scheduleRange.from && appointment.date <= scheduleRange.to)
                .sort((a, b) => {
                  const dayDelta = daySortPriority(a.date) - daySortPriority(b.date);
                  return dayDelta || new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                })
                .find((appointment) => new Date(appointment.startTime).getTime() >= Date.now())?.id
              ?? appointments.find((appointment) => appointment.date >= scheduleRange.from && appointment.date <= scheduleRange.to)?.id
              ?? null
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không tải được lịch hẹn staff");
    } finally {
      setIsLoading(false);
    }
  }, [scheduleRange.from, scheduleRange.to, user, viewMode]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadTimetable(), 0);
    return () => window.clearTimeout(id);
  }, [loadTimetable]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const performCheckin = async (id: string) => {
    await staffService.checkInBooking(id);
    setAppts((prev) =>
      prev.map((a) => a.id === id ? { ...a, status: "checked_in" as AppointmentStatus } : a)
    );
    setCheckInError("");
    showToast("✓ Đã tiếp nhận khách hàng thành công");
    loadTimetable();
  };

  const handleCheckin = async (id: string) => {
    const appt = appts.find((item) => item.id === id);
    const blockedReason = getCheckInBlockReason(appt);
    if (blockedReason) {
      setCheckInError(blockedReason);
      showToast(blockedReason);
      return;
    }

    if (!appt.room || appt.room === "Chưa phân phòng") {
      setSelectedAppt(id);
      setRoomPickerApptId(id);
      setRoomPickerValue("");
      setRoomPickerError("Chọn phòng trước khi check-in.");
      showToast("Chọn phòng trước khi check-in.");
      return;
    }

    const roomConflict = getRoomBlockedBy(appt.room, appt);
    if (roomConflict) {
      const message = `Phòng ${appt.room} đang được giữ bởi lịch ${roomConflict.time} - ${roomConflict.customerName}.`;
      setSelectedAppt(id);
      setRoomPickerApptId(id);
      setRoomPickerValue("");
      setRoomPickerError(message);
      showToast(message);
      return;
    }

    try {
      await performCheckin(id);
    } catch (err) {
      const message = normalizeErrorMessage(err);
      setCheckInError(message);
      showToast(message);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await staffService.completeServiceBooking(id);
      setAppts((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: "service_completed" as AppointmentStatus, room: "Chưa phân phòng" } : a)
      );
      showToast("Dịch vụ đã xong, chuyển sang chờ thanh toán");
      loadTimetable();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể cập nhật trạng thái dịch vụ.");
    }
  };

  const handleSearchCheckin = () => {
    if (!checkInSearch.trim()) { setCheckInError("Vui lòng nhập tên, SĐT hoặc mã đặt lịch."); return; }
    const found = appts.find(
      (a) => a.customerName.toLowerCase().includes(checkInSearch.toLowerCase()) ||
             a.customerPhone.includes(checkInSearch) ||
             a.id.toLowerCase().includes(checkInSearch.toLowerCase())
    );
    if (!found) {
      setCheckInError(
        viewMode === "personal"
          ? "Không tìm thấy lịch trong Lịch của tôi. Nếu khách được gán cho kỹ thuật viên khác, hãy chuyển sang Lịch chi nhánh rồi thử lại."
          : "Không tìm thấy lịch trong danh sách chi nhánh đang tải. Hãy kiểm tra mã lịch, tên hoặc số điện thoại."
      );
      return;
    }
    const blockedReason = getCheckInBlockReason(found);
    if (blockedReason) { setCheckInError(blockedReason); return; }
    setCheckInError("");
    void handleCheckin(found.id);
    setCheckInSearch("");
  };

  const selectedApptData = appts.find((a) => a.id === selectedAppt);
  const healthRecord = selectedApptData
    ? CUSTOMER_HEALTH_RECORDS.find((r) => r.customerId === selectedApptData.customerId)
    : null;

  useEffect(() => {
    const treatmentSession = selectedApptData?.treatmentSession;
    setTreatmentNote(treatmentSession?.progressNote ?? "");
    setBeforeImageUrls((treatmentSession?.beforeImages ?? []).join(", "));
    setAfterImageUrls((treatmentSession?.afterImages ?? []).join(", "));
    setTreatmentCareRecommendation(treatmentSession?.careRecommendation ?? "");
    setTreatmentNextRecommendedAt(toDateTimeLocalInput(treatmentSession?.nextRecommendedAt));
  }, [selectedApptData?.id, selectedApptData?.treatmentSession]);

  const parseImageUrls = (value: string) =>
    value
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);

  const handleSaveTreatmentProgress = async () => {
    const sessionId = selectedApptData?.treatmentSession?.id;
    if (!sessionId || isSavingTreatmentProgress) return;

    setIsSavingTreatmentProgress(true);
    try {
      const updatedSession = await treatmentService.updateSessionProgress(sessionId, {
        progressNote: treatmentNote,
        beforeImages: parseImageUrls(beforeImageUrls),
        afterImages: parseImageUrls(afterImageUrls),
        careRecommendation: treatmentCareRecommendation,
        nextRecommendedAt: fromDateTimeLocalInput(treatmentNextRecommendedAt),
      });

      setAppts((prev) =>
        prev.map((appointment) =>
          appointment.id === selectedApptData.id
            ? { ...appointment, treatmentSession: { ...appointment.treatmentSession, ...updatedSession } }
            : appointment
        )
      );
      showToast("Đã lưu ghi chú tiến trình liệu trình.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể lưu tiến trình liệu trình.");
    } finally {
      setIsSavingTreatmentProgress(false);
    }
  };

  useEffect(() => {
    if (!selectedApptData?.customerId) {
      const timer = setTimeout(() => {
        setLiveHealthRecord(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    let isMounted = true;
    staffService.getHealthRecords(selectedApptData.customerId)
      .then((records) => {
        if (isMounted) {
          setLiveHealthRecord(records && records.length > 0 ? records[0] : null);
        }
      })
      .catch((err) => {
        console.error("Lỗi lấy thông tin sức khỏe:", err);
        if (isMounted) {
          setLiveHealthRecord(null);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [selectedApptData?.customerId]);

  const timeToMinutes = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const myAppts = useMemo(
    () => appts.filter((appointment) => appointment.date >= scheduleRange.from && appointment.date <= scheduleRange.to),
    [appts, scheduleRange.from, scheduleRange.to]
  );
  const roomPickerAppt = roomPickerApptId ? myAppts.find((a) => a.id === roomPickerApptId) : null;

  const getRoomBlockedBy = useCallback((roomName: string, targetAppt: any) => {
    return myAppts.find((appt) =>
      appt.id !== targetAppt.id
      && appt.room === roomName
      && isRoomHoldingStatus(appt.status)
      && appointmentsOverlap(appt, targetAppt)
    );
  }, [myAppts]);

  const getRoomOptions = useCallback((targetAppt: any) => {
    if (!targetAppt) return [];
    return ROOMS.map((room) => ({
      ...room,
      blockedBy: getRoomBlockedBy(room.name, targetAppt),
    }));
  }, [getRoomBlockedBy]);

  const selectedRoomOptions = useMemo(() => getRoomOptions(selectedApptData), [getRoomOptions, selectedApptData]);
  const roomPickerOptions = useMemo(() => getRoomOptions(roomPickerAppt), [getRoomOptions, roomPickerAppt]);

  const handleAssignRoomAndCheckin = async () => {
    if (!roomPickerAppt) return;
    if (!roomPickerValue) {
      setRoomPickerError("Vui lòng chọn phòng trước khi check-in.");
      return;
    }

    const blockedBy = getRoomBlockedBy(roomPickerValue, roomPickerAppt);
    if (blockedBy) {
      setRoomPickerError(`Phòng ${roomPickerValue} đang được giữ bởi lịch ${blockedBy.time} - ${blockedBy.customerName}.`);
      return;
    }

    try {
      setIsAssigningRoom(true);
      await bookingService.assignRoom(roomPickerAppt.id, roomPickerValue);
      setAppts((prev) =>
        prev.map((a) => (a.id === roomPickerAppt.id ? { ...a, room: roomPickerValue } : a))
      );
      setRoomPickerApptId(null);
      setRoomPickerValue("");
      setRoomPickerError("");
      await performCheckin(roomPickerAppt.id);
    } catch (err) {
      const message = normalizeErrorMessage(err);
      setRoomPickerError(message);
      showToast(message);
    } finally {
      setIsAssigningRoom(false);
    }
  };

  const sortedAppts = useMemo(() => {
    return [...myAppts].sort((a, b) => {
      const dayDelta = daySortPriority(a.date) - daySortPriority(b.date);
      return dayDelta || timeToMinutes(a.time) - timeToMinutes(b.time);
    });
  }, [myAppts]);

  const groupedAppts = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const appt of sortedAppts) {
      const group = groups.get(appt.date) ?? [];
      group.push(appt);
      groups.set(appt.date, group);
    }
    return Array.from(groups.entries()).map(([date, appointments]) => ({ date, appointments }));
  }, [sortedAppts]);

  const todayDate = toLocalDateInput(new Date());
  const todayAppts = useMemo(
    () => sortedAppts.filter((appointment) => appointment.date === todayDate),
    [sortedAppts, todayDate]
  );
  const nextTodayAppt = useMemo(
    () => todayAppts.find((appointment) => new Date(appointment.endTime).getTime() >= Date.now()) ?? todayAppts[0],
    [todayAppts]
  );
  const visibleDayChips = groupedAppts.slice(0, 8);

  const shiftRange = (days: number) => {
    setRangeStartDate((current) => toLocalDateInput(addDays(parseLocalDateInput(current), days)));
  };

  const resetRangeToToday = () => {
    setRangeStartDate(toLocalDateInput(new Date()));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
          {toast}
        </div>
      )}

      {roomPickerAppt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl border border-outline-variant/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Chọn phòng check-in</h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  {roomPickerAppt.time} - {roomPickerAppt.customerName} - {roomPickerAppt.service}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRoomPickerApptId(null);
                  setRoomPickerValue("");
                  setRoomPickerError("");
                }}
                className="rounded-full p-1.5 hover:bg-surface-container-high"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roomPickerOptions.map((room) => {
                const isBlocked = Boolean(room.blockedBy);
                const isSelected = roomPickerValue === room.name;
                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={isBlocked}
                    onClick={() => {
                      setRoomPickerValue(room.name);
                      setRoomPickerError("");
                    }}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-on-primary"
                        : isBlocked
                          ? "border-outline-variant/20 bg-surface-container text-on-surface-variant opacity-60"
                          : "border-outline-variant/40 bg-white hover:border-primary"
                    }`}
                  >
                    <span className="block text-sm font-bold">{room.name}</span>
                    <span className="block text-[11px] opacity-80">
                      {isBlocked ? `Đang dùng ${room.blockedBy.time}` : `${room.type} - còn trống`}
                    </span>
                  </button>
                );
              })}
            </div>

            {roomPickerError && (
              <p className="mt-3 rounded-xl border border-error/30 bg-error-container/10 px-3 py-2 text-xs text-error font-bold">
                {roomPickerError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRoomPickerApptId(null);
                  setRoomPickerValue("");
                  setRoomPickerError("");
                }}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleAssignRoomAndCheckin()}
                disabled={isAssigningRoom}
                className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-60"
              >
                {isAssigningRoom ? "Đang xử lý..." : "Chọn phòng & check-in"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-outline-variant/30 min-h-0">
        
        {/* Left Column: Timeline view */}
        <section className="lg:col-span-2 flex flex-col min-h-0 bg-surface-container-lowest">
          <div className="p-4 border-b border-outline-variant/20 bg-surface flex flex-col xl:flex-row xl:items-start justify-between gap-4 shrink-0">
            <div className="min-w-0 max-w-md">
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold leading-tight">Lịch hẹn & Điều phối phòng</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Quản lý tiếp nhận khách hàng và xếp phòng trị liệu.</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap xl:justify-end">
              {/* View Mode Toggle */}
              <div className="flex bg-surface-container-high rounded-full p-0.5 border border-outline-variant/10 text-[10px] uppercase font-bold shrink-0">
                <button
                  onClick={() => setViewMode("branch")}
                  className={`px-3 py-1.5 rounded-full transition-colors ${viewMode === "branch" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                >
                  Lịch chi nhánh
                </button>
                <button
                  onClick={() => setViewMode("personal")}
                  className={`px-3 py-1.5 rounded-full transition-colors ${viewMode === "personal" ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                >
                  Lịch của tôi
                </button>
              </div>

              <button
                type="button"
                onClick={() => shiftRange(-7)}
                className="border border-outline-variant p-1.5 rounded-full hover:bg-surface-container transition-all flex items-center justify-center bg-white"
                title="Tuần trước"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <label className="relative flex cursor-pointer items-center gap-2 rounded-full border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container focus-within:ring-2 focus-within:ring-primary/30">
                <span className="whitespace-nowrap">{formatShortDate(scheduleRange.from)} - {formatShortDate(scheduleRange.to)}</span>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">calendar_month</span>
                <input
                  type="date"
                  value={rangeStartDate}
                  onChange={(event) => {
                    if (event.target.value) setRangeStartDate(event.target.value);
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Chọn ngày bắt đầu tuần"
                />
              </label>
              <button
                type="button"
                onClick={() => shiftRange(7)}
                className="border border-outline-variant p-1.5 rounded-full hover:bg-surface-container transition-all flex items-center justify-center bg-white"
                title="Tuần sau"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
              <button
                type="button"
                onClick={resetRangeToToday}
                className="rounded-full border border-outline-variant bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container transition-all"
              >
                Hôm nay
              </button>
              <button
                onClick={() => void loadTimetable()}
                className="border border-outline-variant p-1.5 rounded-full hover:bg-surface-container transition-all flex items-center justify-center bg-white"
                title="Làm mới"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {!isLoading && !loadError && sortedAppts.length > 0 && (
              <div className="rounded-2xl border border-primary/20 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>today</span>
                    </div>
                    <div>
                      <p className="font-label-md text-label-md font-bold text-primary">
                        Hôm nay - {todayAppts.length} lịch hẹn
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {nextTodayAppt
                          ? `${nextTodayAppt.time} - ${nextTodayAppt.customerName} - ${nextTodayAppt.service}`
                          : "Chưa có lịch hẹn nào trong hôm nay"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 xl:max-w-[460px] xl:pb-0">
                    {visibleDayChips.map((group) => (
                      <button
                        key={group.date}
                        type="button"
                        onClick={() => setSelectedAppt(group.appointments[0]?.id ?? null)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-left transition-colors ${
                          group.date === todayDate
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:border-primary/50"
                        }`}
                      >
                        <span className="block text-[11px] font-bold leading-tight">{dayChipLabel(group.date)}</span>
                        <span className="block text-[10px] opacity-80">{group.appointments.length} lịch - {formatShortDate(group.date)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="text-center py-10 text-on-surface-variant">Đang tải lịch hẹn...</div>
            ) : loadError ? (
              <div className="text-center py-10 text-error">{loadError}</div>
            ) : sortedAppts.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-2 text-outline font-light">calendar_today</span>
                <p className="font-label-md text-label-md font-bold">
                  {viewMode === "personal" ? "Bạn chưa được phân công lịch hẹn nào" : "Không có lịch hẹn nào"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs">
                  {viewMode === "personal"
                    ? `${user?.name ?? "Nhân viên"} không có lịch được gán trong khoảng ${formatShortDate(scheduleRange.from)} - ${formatShortDate(scheduleRange.to)}.`
                    : `Chi nhánh không có lịch trong khoảng ${formatShortDate(scheduleRange.from)} - ${formatShortDate(scheduleRange.to)}.`}
                </p>
              </div>
            ) : (
              groupedAppts.map((group) => (
                <div key={group.date} className="space-y-3">
                  <div className="sticky top-0 z-10 -mx-1 bg-surface-container-lowest/95 px-1 py-1 backdrop-blur">
                    <div className="flex items-center justify-between rounded-xl border border-outline-variant/20 bg-white px-4 py-2 shadow-sm">
                      <div>
                        <p className="font-label-md text-label-md text-primary font-bold">{formatDayHeading(group.date)}</p>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase">{group.appointments.length} lịch hẹn</p>
                      </div>
                      <span className="text-xs text-on-surface-variant font-medium">{formatShortDate(group.date)}</span>
                    </div>
                  </div>

                  {group.appointments.map((appt) => {
                    const isSelected = appt.id === selectedAppt;
                    const blockReason = getCheckInBlockReason(appt);
                    const canCheckIn = appt.status === "confirmed" && !blockReason;
                    const needsRoom = !appt.room || appt.room === "Chưa phân phòng";
                    return (
                  <div
                    key={appt.id}
                    onClick={() => setSelectedAppt(appt.id)}
                    className={`bg-white rounded-2xl p-4 border-2 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected
                        ? "border-primary shadow-sm"
                        : "border-outline-variant/30 hover:border-outline-variant"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-16 text-center shrink-0 border-r border-outline-variant/20 pr-3">
                        <p className="font-label-md text-label-md text-primary font-bold">{appt.time}</p>
                        <p className="font-label-sm text-label-sm text-on-surface-variant text-[10px] uppercase font-bold mt-0.5">{appt.duration} Phút</p>
                      </div>
                      
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-label-md text-label-md text-on-surface font-bold">{appt.customerName}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(appt.status)}`}>
                            {getStatusLabel(appt.status)}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant font-medium">{appt.service}</p>
                        {appt.treatmentSession && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-bold text-primary">
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>timeline</span>
                            Liệu trình {appt.treatmentSession.sessionNumber}/{appt.treatmentSession.totalSessions}
                          </span>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-on-surface-variant font-medium flex-wrap">
                          <span className="flex items-center gap-0.5"><span className="material-symbols-outlined" style={{ fontSize: 12 }}>meeting_room</span>{appt.room}</span>
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>person</span>
                            {appt.technicianName}
                            {String(appt.technicianId) === String(user?.id) && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-bold text-primary">Bạn</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {appt.status === "confirmed" && (
                        <button
                          title={blockReason || "Tiếp nhận khách"}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleCheckin(appt.id);
                          }}
                          className={`px-4 py-2 rounded-full font-label-sm text-label-sm transition-opacity font-bold shadow-sm ${
                            canCheckIn
                              ? "bg-primary text-on-primary hover:opacity-90"
                              : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                          }`}
                        >
                          {canCheckIn ? (needsRoom ? "Chọn phòng" : "Check-in") : "Chưa đến giờ"}
                        </button>
                      )}
                      {(appt.status === "checked_in" || appt.status === "in_service") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleComplete(appt.id);
                          }}
                          className="bg-green-600 text-white px-4 py-2 rounded-full font-label-sm text-label-sm hover:opacity-90 transition-opacity font-bold shadow-sm"
                        >
                          Xong dịch vụ
                        </button>
                      )}
                    </div>
                  </div>
                );
                  })}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Column: Detail, Check-in Search & Health Record */}
        <section className="flex flex-col min-h-0 bg-surface">
          <div className="p-4 border-b border-outline-variant/20 bg-surface shrink-0">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Tiếp nhận nhanh</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Tìm và check-in nhanh khách hàng.</p>
            
            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={checkInSearch}
                onChange={(e) => setCheckInSearch(e.target.value)}
                placeholder="Tên, SĐT hoặc Mã đặt lịch..."
                className="flex-1 border border-outline-variant rounded-full px-3.5 py-2 text-xs focus:outline-none focus:border-primary bg-surface-container-lowest"
                onKeyDown={(e) => e.key === "Enter" && handleSearchCheckin()}
              />
              <button
                onClick={handleSearchCheckin}
                className="bg-primary text-on-primary p-2 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center shadow-sm"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
              </button>
            </div>
            {checkInError && <p className="text-[10px] text-error font-bold mt-1.5 pl-2">{checkInError}</p>}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between min-h-0 bg-surface-container-lowest">
            {selectedApptData && (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">Chi tiết buổi hẹn</h4>
                    <p className="text-[10px] text-on-surface-variant font-mono">Mã: {selectedApptData.id}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getStatusColor(selectedApptData.status)}`}>
                    {getStatusLabel(selectedApptData.status)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold mb-1">Khách hàng</p>
                      <p className="font-label-md text-label-md text-on-surface font-bold">{selectedApptData.customerName}</p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold mb-1">Số điện thoại</p>
                      <p className="font-label-md text-label-md text-on-surface">{selectedApptData.customerPhone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold mb-1">Dịch vụ</p>
                      <p className="font-label-md text-label-md text-primary font-bold">{selectedApptData.service}</p>
                      {selectedApptData.treatmentSession && (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Liệu trình</p>
                          <p className="text-xs text-on-surface font-semibold">
                            Buổi {selectedApptData.treatmentSession.sessionNumber}/{selectedApptData.treatmentSession.totalSessions}
                            {" "}· Còn {selectedApptData.treatmentSession.remainingSessions} buổi
                          </p>
                          {selectedApptData.treatmentSession.progressNote && (
                            <p className="text-xs text-on-surface-variant mt-1 italic">
                              {selectedApptData.treatmentSession.progressNote}
                            </p>
                          )}
                          {selectedApptData.treatmentSession.careRecommendation && (
                            <div className="mt-2 rounded-md bg-surface-container-low px-3 py-2">
                              <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
                                Khuyen nghi sau buoi
                              </p>
                              <p className="text-xs text-on-surface-variant mt-1">
                                {selectedApptData.treatmentSession.careRecommendation}
                              </p>
                            </div>
                          )}
                          {selectedApptData.treatmentSession.nextRecommendedAt && (
                            <p className="text-xs text-primary mt-2 font-semibold">
                              Goi y buoi tiep theo: {formatDateTime(selectedApptData.treatmentSession.nextRecommendedAt)}
                            </p>
                          )}
                          <div className="mt-3 space-y-2">
                            <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                              Ghi chú tiến trình
                            </label>
                            <textarea
                              value={treatmentNote}
                              onChange={(event) => setTreatmentNote(event.target.value)}
                              placeholder="VD: Khách giảm căng cơ rõ, cần tập trung thêm vùng vai trái ở buổi sau."
                              className="w-full min-h-20 rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                            />
                            <input
                              value={beforeImageUrls}
                              onChange={(event) => setBeforeImageUrls(event.target.value)}
                              placeholder="Ảnh trước buổi trị liệu, cách nhau bằng dấu phẩy"
                              className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                            />
                            <input
                              value={afterImageUrls}
                              onChange={(event) => setAfterImageUrls(event.target.value)}
                              placeholder="Ảnh sau buổi trị liệu, cách nhau bằng dấu phẩy"
                              className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                            />
                            <textarea
                              value={treatmentCareRecommendation}
                              onChange={(event) => setTreatmentCareRecommendation(event.target.value)}
                              placeholder="Khuyen nghi cham soc sau buoi: uong nuoc, nghi ngoi, tranh xong hoi..."
                              className="w-full min-h-16 rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                            />
                            <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                              Goi y thoi diem buoi tiep theo
                            </label>
                            <input
                              type="datetime-local"
                              value={treatmentNextRecommendedAt}
                              onChange={(event) => setTreatmentNextRecommendedAt(event.target.value)}
                              className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveTreatmentProgress()}
                              disabled={isSavingTreatmentProgress}
                              className="w-full rounded-full bg-primary px-3 py-2 text-xs font-bold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSavingTreatmentProgress ? "Đang lưu..." : "Lưu tiến trình liệu trình"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold mb-1">Kỹ thuật viên</p>
                      <p className="font-label-md text-label-md text-on-surface">{selectedApptData.technicianName}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold mb-1">Thời gian</p>
                      <p className="font-label-md text-label-md text-on-surface">{selectedApptData.time}</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{formatShortDate(selectedApptData.date)}</p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold mb-1">Phòng</p>
                      <select
                        value={selectedApptData.room}
                        onChange={async (e) => {
                          const newRoom = e.target.value;
                          const roomValue = newRoom === "Chưa phân phòng" ? null : newRoom;
                          try {
                            if (roomValue) {
                              const blockedBy = getRoomBlockedBy(roomValue, selectedApptData);
                              if (blockedBy) {
                                showToast(`Phòng ${roomValue} đang được giữ bởi lịch ${blockedBy.time} - ${blockedBy.customerName}.`);
                                return;
                              }
                            }
                            await bookingService.assignRoom(selectedApptData.id, roomValue);
                            setAppts((prev) =>
                              prev.map((a) => (a.id === selectedApptData.id ? { ...a, room: newRoom } : a))
                            );
                            showToast(`✓ Đã xếp khách vào ${newRoom}`);
                          } catch (err) {
                            showToast("Lỗi phân phòng.");
                          }
                        }}
                        className="w-full text-xs text-on-surface border border-outline-variant rounded-md px-1.5 py-1 bg-white focus:outline-none focus:border-primary font-medium"
                      >
                        <option value="Chưa phân phòng">Chưa phân phòng</option>
                        {selectedRoomOptions.map((r) => (
                          <option
                            key={r.id}
                            value={r.name}
                            disabled={Boolean(r.blockedBy) && r.name !== selectedApptData.room}
                          >
                            {r.name} ({r.type}){r.blockedBy ? ` - đang dùng ${r.blockedBy.time}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold mb-1">Giá</p>
                      <p className="font-label-md text-label-md text-primary font-bold">{formatCurrency(selectedApptData.price)}</p>
                    </div>
                  </div>

                  {selectedApptData.status === "confirmed" && getCheckInBlockReason(selectedApptData) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 font-medium">
                      {getCheckInBlockReason(selectedApptData)}
                    </div>
                  )}

                  {liveHealthRecord ? (
                    <div className="p-3 rounded-xl bg-error-container/10 border border-error-container/30">
                      <p className="font-label-md text-label-md text-error mb-1 flex items-center gap-1 font-bold">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                        Lưu ý sức khỏe
                      </p>
                      {liveHealthRecord.skinType && <p className="text-xs text-on-surface-variant font-semibold">Da: {liveHealthRecord.skinType}</p>}
                      {liveHealthRecord.allergies && <p className="text-xs text-error font-medium">Dị ứng: {liveHealthRecord.allergies}</p>}
                      {liveHealthRecord.medicalConditions && <p className="text-xs text-on-surface-variant">Bệnh lý: {liveHealthRecord.medicalConditions}</p>}
                      {liveHealthRecord.contraindications && <p className="text-xs text-red-500 font-medium">Chống chỉ định: {liveHealthRecord.contraindications}</p>}
                      {liveHealthRecord.notes && <p className="text-xs text-on-surface-variant italic mt-1">{liveHealthRecord.notes}</p>}
                    </div>
                  ) : healthRecord ? (
                    <div className="p-3 rounded-xl bg-error-container/10 border border-error-container/30">
                      <p className="font-label-md text-label-md text-error mb-1 flex items-center gap-1 font-bold">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                        Lưu ý sức khỏe (Mẫu)
                      </p>
                      <p className="text-xs text-on-surface-variant italic mb-1">{healthRecord.allergies}</p>
                      <p className="text-xs text-on-surface-variant">{healthRecord.medicalNotes}</p>
                      <p className="text-xs text-primary mt-1 font-bold">{healthRecord.preferences}</p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-surface-container text-center">
                      <p className="text-xs text-on-surface-variant">Chưa có hồ sơ sức khỏe</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 mt-4 shrink-0">
              {[
                { label: "Chờ check-in", value: myAppts.filter((a) => a.status === "confirmed").length, color: "text-primary" },
                { label: "Đang trị liệu", value: myAppts.filter((a) => a.status === "checked_in" || a.status === "in_service").length, color: "text-secondary" },
                { label: "Chờ thanh toán", value: myAppts.filter((a) => a.status === "service_completed").length, color: "text-amber-600" },
                { label: "Hoàn thành", value: myAppts.filter((a) => a.status === "completed").length, color: "text-green-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3 border border-outline-variant/20 text-center shadow-sm">
                  <p className={`font-headline-sm text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant text-[10px] mt-1 uppercase font-bold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
