"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { staffService } from "@/lib/services/staff.service";
import type { ScheduleRequest, TimetableDay } from "@/lib/types";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const formatTimeOnly = (value: string) =>
  new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const statusClass = (status: string) => {
  if (status === "approved") return "bg-green-50 text-green-700 border border-green-200/50";
  if (status === "rejected") return "bg-rose-50 text-rose-700 border border-rose-200/50";
  if (status === "cancelled") return "bg-stone-50 text-stone-500 border border-stone-200/50";
  return "bg-amber-50 text-amber-800 border border-amber-200/50";
};

const statusDotClass = (status: string) => {
  if (status === "approved") return "bg-green-600";
  if (status === "rejected") return "bg-rose-600";
  if (status === "cancelled") return "bg-stone-400";
  return "bg-amber-500";
};

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    cancelled: "Đã hủy",
  };
  return labels[status] ?? status;
};

const getNextWeekDays = () => {
  const days = [];
  const now = new Date();
  const currentDay = now.getDay();
  const daysUntilNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilNextMonday);

  for (let i = 0; i < 7; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    days.push(d);
  }
  return days;
};

const SHIFTS = [
  { id: "morning", label: "Ca sáng (08:00 - 14:00)", start: "08:00", end: "14:00", type: "work_shift" },
  { id: "afternoon", label: "Ca chiều (14:00 - 20:00)", start: "14:00", end: "20:00", type: "work_shift" },
  { id: "full", label: "Cả ngày (08:00 - 20:00)", start: "08:00", end: "20:00", type: "work_shift" },
  { id: "leave", label: "Nghỉ phép", start: "08:00", end: "17:00", type: "leave" },
];

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const apiErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error) return err.message;
  return (err as ApiError).response?.data?.message || fallback;
};

export default function StaffSchedule() {
  const { user } = useAuth();
  const branchId = user?.branchId || "";
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [timetable, setTimetable] = useState<TimetableDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"calendar" | "register" | "history">("calendar");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Filters for History Tab
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const nextWeekDays = getNextWeekDays();
  const [weekSelections, setWeekSelections] = useState(() =>
    nextWeekDays.map((date) => ({
      date,
      shiftId: "none",
      reason: "",
    }))
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const monday = getMonday(currentDate);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const fromStr = monday.toISOString().split("T")[0];
      const toStr = sunday.toISOString().split("T")[0];

      const [requestsData, timetableData] = await Promise.all([
        staffService.getMyScheduleRequests(),
        staffService.getTimetable(fromStr, toStr),
      ]);

      setRequests(requestsData || []);
      setTimetable(timetableData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lịch làm việc.");
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    const id = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  const handleSubmitWeekly = async () => {
    if (!branchId.trim()) {
      setError("Thiếu mã chi nhánh làm việc.");
      return;
    }

    const selectionsToSubmit = weekSelections.filter((s) => s.shiftId !== "none");
    if (selectionsToSubmit.length === 0) {
      setError("Vui lòng chọn ít nhất một ca làm việc hoặc ngày nghỉ phép trong tuần.");
      return;
    }

    const missingReason = selectionsToSubmit.find((s) => s.shiftId === "leave" && !s.reason.trim());
    if (missingReason) {
      const formattedDate = missingReason.date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
      setError(`Vui lòng điền lý do nghỉ phép cho ngày ${formattedDate}.`);
      return;
    }

    setIsSubmitting(true);
    setError("");
    let successCount = 0;

    try {
      for (const selection of selectionsToSubmit) {
        const shiftInfo = SHIFTS.find((s) => s.id === selection.shiftId);
        if (!shiftInfo) continue;

        const year = selection.date.getFullYear();
        const month = String(selection.date.getMonth() + 1).padStart(2, "0");
        const day = String(selection.date.getDate()).padStart(2, "0");
        
        const startStr = `${year}-${month}-${day}T${shiftInfo.start}:00`;
        const endStr = `${year}-${month}-${day}T${shiftInfo.end}:00`;

        await staffService.createScheduleRequest({
          branchId: branchId.trim(),
          requestType: shiftInfo.type as "work_shift" | "leave",
          requestedStart: new Date(startStr).toISOString(),
          requestedEnd: new Date(endStr).toISOString(),
          reason: selection.reason.trim() || undefined,
        });
        successCount++;
      }
      showToast(`✓ Đăng ký thành công ${successCount} ngày làm việc/nghỉ.`);
      setWeekSelections((prev) =>
        prev.map((s) => ({ ...s, shiftId: "none", reason: "" }))
      );
      void loadData();
      setActiveTab("history"); // Auto switch to request history to see feedback
    } catch (err) {
      setError(apiErrorMessage(err, "Đăng ký lịch làm thất bại"));
      void loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await staffService.cancelScheduleRequest(requestId);
      showToast("✓ Đã hủy yêu cầu đăng ký ca");
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Hủy yêu cầu thất bại");
    }
  };

  const updateSelection = (index: number, key: "shiftId" | "reason", value: string) => {
    setWeekSelections((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const statusMatch = statusFilter === "all" || req.status === statusFilter;
    const typeMatch = typeFilter === "all" || req.requestType === typeFilter;
    return statusMatch && typeMatch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-bold text-xs select-none">
          {toast}
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-stone-900 font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">badge</span>
            Lịch làm việc & Ca trực của tôi
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Đăng ký ca trực tuần tới, theo dõi phản hồi phê duyệt của quản lý và lịch phân khách hàng hàng ngày.
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          className="border border-stone-200 hover:border-primary/50 text-stone-600 hover:text-primary px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-start"
        >
          <span className="material-symbols-outlined text-sm font-bold">refresh</span>
          Làm mới
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 font-bold">
          {error}
        </div>
      )}

      {/* Tabs Navigator */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab("calendar")}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "calendar"
              ? "border-primary text-primary"
              : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          <span className="material-symbols-outlined text-sm">event_note</span>
          Lịch trực & Phân ca
        </button>
        <button
          onClick={() => setActiveTab("register")}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "register"
              ? "border-primary text-primary"
              : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          <span className="material-symbols-outlined text-sm">edit_calendar</span>
          Đăng ký ca tuần sau
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-stone-500 hover:text-stone-700"
          }`}
        >
          <span className="material-symbols-outlined text-sm">history</span>
          Lịch sử & Phản hồi
        </button>
      </div>

      {/* TAB 1: CALENDAR & BOOKINGS TIMETABLE */}
      {activeTab === "calendar" && (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200/60 rounded-3xl p-6 shadow-sm">
            
            {/* Week Selector Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-100">
              <div>
                <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Bảng lịch biểu tuần
                </h2>
                <p className="text-[11px] text-stone-500 mt-1 font-semibold">
                  Từ {getMonday(currentDate).toLocaleDateString("vi-VN")} đến {(() => {
                    const sun = new Date(getMonday(currentDate));
                    sun.setDate(sun.getDate() + 6);
                    return sun.toLocaleDateString("vi-VN");
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-center">
                <button
                  onClick={() => {
                    const prev = new Date(currentDate);
                    prev.setDate(prev.getDate() - 7);
                    setCurrentDate(prev);
                  }}
                  className="p-1.5 border border-stone-200 hover:border-primary/50 text-stone-600 hover:text-primary rounded-xl cursor-pointer hover:bg-stone-50 transition-all flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-sm font-bold">chevron_left</span>
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1.5 border border-stone-200 hover:border-primary/50 text-stone-600 hover:text-primary rounded-xl cursor-pointer hover:bg-stone-50 transition-all text-[10px] font-bold uppercase tracking-wider"
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => {
                    const next = new Date(currentDate);
                    next.setDate(next.getDate() + 7);
                    setCurrentDate(next);
                  }}
                  className="p-1.5 border border-stone-200 hover:border-primary/50 text-stone-600 hover:text-primary rounded-xl cursor-pointer hover:bg-stone-50 transition-all flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-stone-400">Đang tải lịch làm việc...</div>
            ) : (
              (() => {
                const mon = getMonday(currentDate);
                const weekDays = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(mon);
                  d.setDate(mon.getDate() + i);
                  return d;
                });

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
                    {weekDays.map((date) => {
                      const dateStr = date.toISOString().split("T")[0];
                      const dayData = timetable.find((t) => t.date === dateStr) || {
                        date: dateStr,
                        shifts: [],
                        appointments: [],
                      };
                      
                      const isToday = dateStr === new Date().toISOString().split("T")[0];
                      const hasLeave = dayData.shifts.some((s) => s.scheduleType === "leave" || s.scheduleType === "day_off");
                      const workingShifts = dayData.shifts.filter((s) => s.scheduleType === "work_shift" || s.scheduleType === "working");

                      return (
                        <div
                          key={dateStr}
                          className={`border rounded-2xl p-4 flex flex-col min-h-[320px] transition-all ${
                            isToday
                              ? "border-primary bg-primary/[0.02] shadow-sm"
                              : "border-stone-200/60 bg-white hover:shadow-xs"
                          }`}
                        >
                          {/* Day Header */}
                          <div className="border-b border-stone-100 pb-2 mb-3 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className={`text-[10px] font-extrabold uppercase ${isToday ? "text-primary" : "text-stone-400"}`}>
                                {date.toLocaleDateString("vi-VN", { weekday: "short" })}
                              </span>
                              <span className={`text-xs font-extrabold mt-0.5 ${isToday ? "text-primary" : "text-stone-700"}`}>
                                {date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                              </span>
                            </div>
                            {isToday && (
                              <span className="bg-primary text-on-primary text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90 origin-right">
                                Hôm nay
                              </span>
                            )}
                          </div>

                          {/* Shifts section */}
                          <div className="mb-3">
                            {hasLeave ? (
                              <div className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1.5 rounded-xl text-center">
                                Nghỉ phép
                              </div>
                            ) : workingShifts.length > 0 ? (
                              <div className="space-y-1">
                                {workingShifts.map((s, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/15 px-2 py-1.5 rounded-xl text-center"
                                  >
                                    ⏱ {formatTimeOnly(s.startTime)} - {formatTimeOnly(s.endTime)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[9px] font-medium text-stone-400 bg-stone-50 border border-stone-100/50 px-2 py-1.5 rounded-xl text-center italic">
                                Không có ca trực
                              </div>
                            )}
                          </div>

                          {/* Appointments list */}
                          <div className="flex-1 flex flex-col justify-start">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[8px] font-extrabold uppercase tracking-wider text-stone-400">
                                Đơn phục vụ ({dayData.appointments.length})
                              </span>
                            </div>
                            {dayData.appointments.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center border border-dashed border-stone-200/50 rounded-xl p-3 bg-stone-50/20 min-h-[60px]">
                                <span className="text-[9px] text-stone-400 italic text-center">
                                  Trống đơn
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {dayData.appointments.map((apt) => (
                                  <div
                                    key={apt.id}
                                    className="bg-stone-50/50 border border-stone-150 rounded-xl p-2.5 transition-all text-[10px] space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between border-b border-stone-100/60 pb-1.5">
                                      <span className="font-bold text-stone-800">
                                        ⏱ {formatTimeOnly(apt.startTime)} - {formatTimeOnly(apt.endTime)}
                                      </span>
                                      <span className={`text-[8px] font-extrabold px-1 rounded-sm uppercase ${
                                        apt.status === "completed"
                                          ? "bg-green-50 text-green-700"
                                          : apt.status === "checked_in"
                                          ? "bg-primary/15 text-primary"
                                          : "bg-amber-50 text-amber-800"
                                      }`}>
                                        {apt.status === "completed"
                                          ? "Đã xong"
                                          : apt.status === "checked_in"
                                          ? "Check-in"
                                          : "Sắp tới"}
                                      </span>
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-stone-600 font-semibold truncate">
                                        Khách: <span className="text-stone-950 font-bold">{apt.customerName}</span>
                                      </p>
                                      {apt.customerPhone && (
                                        <p className="text-stone-500 font-medium tracking-tight">
                                          SĐT: {apt.customerPhone}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REGISTER NEW SHIFTS */}
      {activeTab === "register" && (
        <div className="grid grid-cols-1 gap-6">
          <section className="bg-white rounded-3xl border border-stone-200/60 p-6 shadow-sm h-fit">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Đăng ký lịch làm việc tuần tới
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Chi nhánh trực:</span>
                <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                  {user?.branchCode || user?.branchId || "Chưa xác định"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-stone-100 text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      <th className="py-3 px-2">Ngày</th>
                      <th className="py-3 px-2">Ca đăng ký</th>
                      <th className="py-3 px-2">Lý do (nếu nghỉ phép)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {weekSelections.map((selection, index) => {
                      const dateStr = selection.date.toLocaleDateString("vi-VN", {
                        weekday: "long",
                        day: "2-digit",
                        month: "2-digit",
                      });
                      return (
                        <tr key={index} className="hover:bg-stone-50/20 transition-colors">
                          <td className="py-4 px-2 font-bold text-xs text-stone-800">
                            {dateStr}
                          </td>
                          <td className="py-4 px-2">
                            <select
                              value={selection.shiftId}
                              onChange={(e) => updateSelection(index, "shiftId", e.target.value)}
                              className="text-xs border border-stone-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-primary w-full max-w-[240px] font-semibold text-stone-700"
                            >
                              <option value="none">Không đăng ký</option>
                              {SHIFTS.map((s) => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-4 px-2">
                            <input
                              type="text"
                              value={selection.reason}
                              disabled={selection.shiftId !== "leave"}
                              onChange={(e) => updateSelection(index, "reason", e.target.value)}
                              placeholder={selection.shiftId === "leave" ? "Nhập lý do xin nghỉ phép..." : "Không yêu cầu"}
                              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary disabled:bg-stone-50 disabled:opacity-50 font-medium"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => void handleSubmitWeekly()}
                disabled={isSubmitting}
                className="w-full bg-primary text-on-primary py-3.5 rounded-2xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-colors shadow-md shadow-primary/25 cursor-pointer"
              >
                {isSubmitting ? "Đang gửi yêu cầu đăng ký..." : "Gửi phiếu đăng ký ca làm cả tuần"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: REQUEST HISTORY & MANAGER FEEDBACK STATUS */}
      {activeTab === "history" && (
        <section className="bg-white rounded-3xl border border-stone-200/60 overflow-hidden shadow-sm h-fit">
          <div className="px-6 py-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Lịch sử yêu cầu đã gửi & Trạng thái từ Quản lý
            </h2>

            {/* Filter Panel */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1.5">Loại:</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-[10px] border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-primary font-bold text-stone-700"
                >
                  <option value="all">Tất cả</option>
                  <option value="work_shift">Ca làm việc</option>
                  <option value="leave">Nghỉ phép</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1.5">Trạng thái:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-[10px] border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-primary font-bold text-stone-700"
                >
                  <option value="all">Tất cả</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Từ chối</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-stone-400 text-xs animate-pulse">Đang tải lịch sử...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-stone-400">
              <span className="material-symbols-outlined text-4xl opacity-30 block mb-2">history_toggle_off</span>
              <p className="text-xs">Không tìm thấy yêu cầu đăng ký nào khớp với bộ lọc.</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                    request.status === "pending" ? "bg-amber-50/10" : "hover:bg-stone-50/10"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
                        request.status === "pending"
                          ? "bg-amber-50 border-amber-200 text-amber-600"
                          : request.status === "approved"
                          ? "bg-green-50 border-green-200 text-green-600"
                          : "bg-rose-50 border-rose-200 text-rose-600"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm font-bold">
                        {request.requestType === "leave" ? "free_cancellation" : "work_history"}
                      </span>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-stone-800">
                          {request.requestType === "leave" ? "Đăng ký Nghỉ phép" : "Đăng ký Ca trực"}
                        </span>
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-bold px-2 py-0.5 rounded-full ${statusClass(request.status)}`}>
                          <span className={`h-1 w-1 rounded-full ${statusDotClass(request.status)}`} />
                          {statusLabel(request.status)}
                        </span>
                      </div>
                      
                      {/* Range time */}
                      <p className="text-[11px] text-stone-500 font-semibold">
                        Lịch: {formatDateTime(request.requestedStart)} - {formatDateTime(request.requestedEnd)}
                      </p>

                      {/* Staff reason */}
                      {request.reason && (
                        <p className="text-xs text-stone-600 italic">Lý do của tôi: {request.reason}</p>
                      )}

                      {/* Manager response feedback notes if approved/rejected */}
                      {request.reviewedAt && (
                        <div className="mt-2 text-[10px] bg-stone-50 border border-stone-200/50 rounded-lg p-2.5 space-y-1">
                          <p className="text-stone-500 font-bold">
                            📝 Phản hồi từ quản lý ({new Date(request.reviewedAt).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}):
                          </p>
                          <p className={`font-medium ${request.status === "approved" ? "text-green-700" : "text-rose-700"}`}>
                            {request.status === "approved" ? "✓ Ca đăng ký của bạn đã được quản lý phê duyệt." : "⚠️ Ca đăng ký của bạn bị từ chối. Vui lòng liên hệ quản lý để điều chỉnh."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {request.status === "pending" && (
                    <button
                      onClick={() => void handleCancel(request.id)}
                      className="border border-rose-200 text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer shrink-0"
                      title="Hủy đăng ký"
                    >
                      Hủy đăng ký
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
