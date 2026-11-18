"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { managerService } from "@/lib/services/manager.service";
import ConfirmModal from "@/components/ui/ConfirmModal";

// Types matching backend models
interface StaffMember {
  id: string;
  staffCode: string | null;
  position: string;
  status: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  };
}

interface ShiftItem {
  id: string;
  staffId: string;
  staffName: string;
  dateKey: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  type: "work_shift" | "day_off" | "leave";
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason?: string;
}

type ToastState = {
  message: string;
  tone: "success" | "error" | "info";
};

type DeleteShiftTarget = {
  id: string;
  staffName: string;
  dateKey: string;
  startTime: string;
  endTime: string;
};

type ScheduleRequestRow = {
  id: string;
  staffId: string;
  staffFullName?: string;
  requestedStart: string;
  requestedEnd: string;
  requestType: ShiftItem["type"];
  status: ShiftItem["status"];
  reason?: string;
};

// Helpers
const toLocalYYYYMMDD = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const PRESETS = [
  { label: "Ca Sáng (08:00 - 14:00)", start: "08:00", end: "14:00" },
  { label: "Ca Chiều (14:00 - 20:00)", start: "14:00", end: "20:00" },
  { label: "Cả Ngày (08:00 - 20:00)", start: "08:00", end: "20:00" },
  { label: "Tùy chỉnh", start: "", end: "" },
];

export default function ManagerShifts() {
  const { user } = useAuth();
  const branchId = user?.branchId || "";
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [presetIndex, setPresetIndex] = useState(0);
  const [customStart, setCustomStart] = useState("08:00");
  const [customEnd, setCustomEnd] = useState("14:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteShiftTarget | null>(null);
  const [isDeletingShift, setIsDeletingShift] = useState(false);

  const showToast = (message: string, tone: ToastState["tone"] = "info") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const getErrorMessage = (err: unknown, fallback: string) => (
    err instanceof Error && err.message ? err.message : fallback
  );

  const loadData = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      const [staffData, requestsData] = await Promise.all([
        managerService.getStaff(branchId),
        managerService.getScheduleRequests(branchId),
      ]);

      // Only include active technicians and receptionists
      const activeStaff = (staffData as unknown as StaffMember[]).filter((s) => s.status === "active");
      setStaffList(activeStaff);

      // Map requests to cells
      const mappedShifts: ShiftItem[] = (requestsData as unknown as ScheduleRequestRow[]).map((req) => {
        const startDate = new Date(req.requestedStart);
        const endDate = new Date(req.requestedEnd);
        return {
          id: req.id,
          staffId: req.staffId,
          staffName: req.staffFullName || "Nhân viên",
          dateKey: toLocalYYYYMMDD(startDate),
          startTime: startDate.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          endTime: endDate.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          type: req.requestType,
          status: req.status,
          reason: req.reason,
        };
      });

      setShifts(mappedShifts);
    } catch {
      showToast("Lỗi khi tải dữ liệu phân lịch");
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Week configuration
  const monday = getMonday(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(currentDate.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + 7);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Assign shift directly from grid cell
  const openAssignModal = (staff: StaffMember, date: string) => {
    setSelectedStaff(staff);
    setSelectedDate(date);
    setPresetIndex(0);
    setCustomStart("08:00");
    setCustomEnd("14:00");
    setModalOpen(true);
  };

  const submitAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !selectedDate) return;

    let start = "";
    let end = "";
    if (presetIndex === PRESETS.length - 1) {
      start = customStart;
      end = customEnd;
    } else {
      start = PRESETS[presetIndex].start;
      end = PRESETS[presetIndex].end;
    }

    if (!start || !end) {
      showToast("Vui lòng nhập giờ làm việc hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      await managerService.assignShift({
        staffId: selectedStaff.user.id,
        branchId,
        date: selectedDate,
        startTime: start,
        endTime: end,
      });
      showToast(`Đã phân công thành công cho ${selectedStaff.user.fullName}`, "success");
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, "Lỗi khi phân công ca làm việc"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove/Delete a shift
  const openDeleteShiftModal = (shift: ShiftItem, staffName: string) => {
    setDeleteTarget({
      id: shift.id,
      staffName,
      dateKey: shift.dateKey,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
  };

  const confirmDeleteShift = async () => {
    if (!deleteTarget) return;

    setIsDeletingShift(true);
    try {
      await managerService.deleteShift(deleteTarget.id);
      showToast("Đã hủy ca làm việc", "success");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, "Lỗi khi hủy ca làm việc"), "error");
    } finally {
      setIsDeletingShift(false);
    }
  };

  // Approval requests quick actions
  const handleApprove = async (id: string) => {
    try {
      await managerService.approveScheduleRequest(id);
      showToast("Đã phê duyệt yêu cầu ca làm", "success");
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, "Lỗi khi duyệt yêu cầu."), "error");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await managerService.rejectScheduleRequest(id);
      showToast("Đã từ chối yêu cầu.", "success");
      await loadData();
    } catch (err) {
      showToast(getErrorMessage(err, "Lỗi khi từ chối yêu cầu."), "error");
    }
  };

  const pendingRequests = shifts.filter((s) => s.status === "pending");

  const currentWeekPendingRequests = pendingRequests.filter((req) => {
    return weekDays.some((day) => toLocalYYYYMMDD(day) === req.dateKey);
  });

  const handleBatchApprove = async () => {
    const ids = currentWeekPendingRequests.map((r) => r.id);
    if (ids.length === 0) return;

    if (
      !confirm(
        `Bạn có chắc chắn muốn duyệt nhanh toàn bộ ${ids.length} yêu cầu đăng ký ca làm trong tuần này?`
      )
    )
      return;

    try {
      await managerService.batchApproveScheduleRequests(ids);
      showToast(`✓ Đã duyệt nhanh thành công ${ids.length} ca làm`);
      await loadData();
    } catch {
      showToast("Lỗi khi duyệt nhanh ca làm");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-24 right-6 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-xl shadow-stone-900/10 select-none">
          <span
            className={`material-symbols-outlined mt-0.5 text-[20px] ${
              toast.tone === "success"
                ? "text-emerald-600"
                : toast.tone === "error"
                  ? "text-rose-600"
                  : "text-primary"
            }`}
          >
            {toast.tone === "success" ? "check_circle" : toast.tone === "error" ? "error" : "info"}
          </span>
          <div>
            <p className="font-bold text-stone-900">
              {toast.tone === "success" ? "Thành công" : toast.tone === "error" ? "Không thể thực hiện" : "Thông báo"}
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-stone-600">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-stone-900 font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">calendar_month</span>
            Phân công ca làm việc
          </h1>
          <p className="text-xs text-stone-500 mt-1 font-semibold">
            Thời gian xem: <span className="text-primary font-bold">{weekDays[0].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} - {weekDays[6].toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentWeekPendingRequests.length > 0 && (
            <button
              onClick={handleBatchApprove}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-emerald-600/10 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 animate-pulse"
            >
              <span className="material-symbols-outlined text-sm font-bold">task_alt</span>
              Duyệt nhanh tuần này ({currentWeekPendingRequests.length})
            </button>
          )}

          {/* Action Panel */}
          <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-2xl shrink-0">
            <button
              onClick={handlePrevWeek}
              className="p-2 hover:bg-white rounded-xl transition-all text-stone-600 hover:text-primary cursor-pointer flex items-center shrink-0"
              title="Tuần trước"
            >
              <span className="material-symbols-outlined text-lg font-bold">chevron_left</span>
            </button>
            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 bg-white text-stone-800 rounded-xl text-xs font-bold shadow-sm hover:text-primary transition-all cursor-pointer shrink-0"
            >
              Hôm nay
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-white rounded-xl transition-all text-stone-600 hover:text-primary cursor-pointer flex items-center shrink-0"
              title="Tuần sau"
            >
              <span className="material-symbols-outlined text-lg font-bold">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Legend bar */}
      <div className="bg-white px-5 py-4 border border-stone-200/60 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
          Danh mục trạng thái ca làm
        </span>
        <div className="flex gap-4 text-xs font-semibold text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary/20 border border-primary/40 inline-block" /> Ca làm việc
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-100 border border-rose-250 inline-block" /> Nghỉ phép
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-100 border border-amber-300 inline-block" /> Chờ phê duyệt
          </span>
        </div>
      </div>

      {/* Main shift grid scheduler */}
      <div className="bg-white border border-stone-200/60 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr className="bg-stone-50/70 border-b border-stone-100">
                <th className="py-5 px-6 text-left text-xs font-bold text-stone-500 uppercase tracking-wider w-56 border-r border-stone-100">
                  Nhân viên
                </th>
                {weekDays.map((day, idx) => {
                  const isToday = toLocalYYYYMMDD(day) === toLocalYYYYMMDD(new Date());
                  return (
                    <th
                      key={idx}
                      className={`py-4 px-3 text-center text-xs font-bold uppercase tracking-wider border-r border-stone-100 last:border-r-0 ${
                        isToday ? "bg-primary/5 text-primary" : "text-stone-500"
                      }`}
                    >
                      <span className="block font-bold">
                        {day.toLocaleDateString("vi-VN", { weekday: "short" })}
                      </span>
                      <span className={`inline-block mt-1 font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                        isToday ? "bg-primary text-on-primary font-bold" : "text-stone-400"
                      }`}>
                        {day.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, rIdx) => (
                  <tr key={rIdx}>
                    <td className="py-4 px-6 border-r border-stone-100 animate-pulse bg-stone-50/30">
                      <div className="h-4 bg-stone-200 rounded w-2/3" />
                    </td>
                    {Array.from({ length: 7 }).map((_, cIdx) => (
                      <td key={cIdx} className="py-4 px-3 border-r border-stone-100 last:border-r-0">
                        <div className="h-10 bg-stone-100 rounded-xl animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-stone-400">
                    Không tìm thấy nhân viên nào đang hoạt động tại chi nhánh này.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-stone-50/20 transition-colors">
                    {/* Staff Profile Row Label */}
                    <td className="py-4 px-6 border-r border-stone-100 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-xs text-stone-700 shrink-0">
                          {staff.user.fullName.split(" ").pop()?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-stone-900 truncate">
                            {staff.user.fullName}
                          </p>
                          <p className="text-[10px] text-stone-400 font-medium capitalize mt-0.5">
                            {staff.position === "technician" ? "Kỹ thuật viên" : "Lễ tân"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Weekly Days Cell Grid */}
                    {weekDays.map((day, dIdx) => {
                      const dateStr = toLocalYYYYMMDD(day);
                      // Filter shifts for this staff and this day
                      const dayShifts = shifts.filter(
                        (s) => s.staffId === staff.user.id && s.dateKey === dateStr
                      );

                      return (
                        <td
                          key={dIdx}
                          className="p-3 text-center border-r border-stone-100 last:border-r-0 align-middle min-h-[70px]"
                        >
                          {dayShifts.length > 0 ? (
                            <div className="space-y-1.5">
                              {dayShifts.map((sh) => {
                                if (sh.status === "rejected" || sh.status === "cancelled") return null;

                                // Approved Work Shift
                                if (sh.status === "approved" && sh.type === "work_shift") {
                                  return (
                                    <div
                                      key={sh.id}
                                      className="group relative bg-primary/5 border border-primary/20 text-primary rounded-xl px-2.5 py-2 text-[10px] font-bold shadow-sm flex flex-col items-center justify-center"
                                    >
                                      <span>{sh.startTime} - {sh.endTime}</span>
                                      <button
                                        onClick={() => openDeleteShiftModal(sh, staff.user.fullName)}
                                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-4 h-4 items-center justify-center hidden group-hover:flex shadow hover:bg-rose-600 cursor-pointer"
                                        title="Hủy ca"
                                      >
                                        <span className="material-symbols-outlined text-[10px] font-bold">close</span>
                                      </button>
                                    </div>
                                  );
                                }

                                // Approved Leave / Day Off
                                if (sh.status === "approved") {
                                  return (
                                    <div
                                      key={sh.id}
                                      className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-2.5 py-2 text-[10px] font-bold shadow-sm flex flex-col items-center justify-center"
                                      title={sh.reason || "Nghỉ phép"}
                                    >
                                      <span>Nghỉ phép</span>
                                    </div>
                                  );
                                }

                                // Pending Request
                                if (sh.status === "pending") {
                                  return (
                                    <div
                                      key={sh.id}
                                      className="bg-amber-50 border-2 border-dashed border-amber-300 text-amber-800 rounded-xl p-2 text-[10px] font-bold shadow-sm flex flex-col items-center"
                                    >
                                      <span className="block mb-1">{sh.type === "work_shift" ? "Ca đăng ký" : "Xin nghỉ"}</span>
                                      <span className="block text-[9px] font-medium opacity-90">{sh.startTime} - {sh.endTime}</span>
                                      <div className="flex gap-1.5 mt-2">
                                        <button
                                          onClick={() => handleApprove(sh.id)}
                                          className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[9px] hover:bg-emerald-700 font-bold transition-colors cursor-pointer"
                                        >
                                          Duyệt
                                        </button>
                                        <button
                                          onClick={() => handleReject(sh.id)}
                                          className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[9px] hover:bg-rose-600 font-bold transition-colors cursor-pointer"
                                        >
                                          Từ chối
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                return null;
                              })}
                            </div>
                          ) : (
                            // Free Cell - Show Direct Assign Trigger Button
                            <button
                              onClick={() => openAssignModal(staff, dateStr)}
                              className="w-full py-3.5 border border-dashed border-stone-200 hover:border-primary/50 text-stone-400 hover:text-primary rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">add</span> Phân công
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standalone pending requests sidepanel details for reference */}
      {pendingRequests.length > 0 && (
        <div className="bg-stone-50 border border-stone-200/60 rounded-3xl p-5 shadow-sm">
          <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">notifications_active</span>
            Danh sách yêu cầu ca làm đang chờ ({pendingRequests.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map((sh) => (
              <div key={sh.id} className="bg-white rounded-2xl p-4 border border-stone-200/50 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-xs text-stone-800">{sh.staffName}</p>
                  <p className="text-[10px] text-stone-500 font-medium mt-1">
                    Ngày:{" "}
                    <span className="text-stone-700 font-bold">
                      {new Date(sh.dateKey).toLocaleDateString("vi-VN", {
                        weekday: "long",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>{" "}
                    — Lịch đăng ký:{" "}
                    <span className="text-primary font-bold">
                      {sh.type === "work_shift" ? `${sh.startTime} - ${sh.endTime}` : "Nghỉ phép"}
                    </span>
                  </p>
                  {sh.reason && <p className="text-[9px] text-stone-400 italic mt-1">Lý do: {sh.reason}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleApprove(sh.id)}
                    className="bg-primary text-on-primary px-3 py-1.5 rounded-full text-[10px] font-bold hover:opacity-90 cursor-pointer shadow-sm"
                  >
                    Duyệt
                  </button>
                  <button
                    onClick={() => handleReject(sh.id)}
                    className="border border-stone-200 text-stone-600 px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-stone-50 cursor-pointer"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        icon="event_busy"
        title="Hủy ca làm việc?"
        description={
          deleteTarget
            ? `Ca của ${deleteTarget.staffName} sẽ được gỡ khỏi lịch phân công.`
            : undefined
        }
        bullets={
          deleteTarget
            ? [
                `Ngày ${new Date(deleteTarget.dateKey).toLocaleDateString("vi-VN")} · ${deleteTarget.startTime} - ${deleteTarget.endTime}`,
                "Thao tác này chỉ xóa ca khỏi lịch phân công, không tự hủy lịch hẹn của khách nếu đã có.",
              ]
            : []
        }
        confirmLabel="Hủy ca"
        variant="danger"
        isLoading={isDeletingShift}
        onConfirm={confirmDeleteShift}
        onCancel={() => {
          if (!isDeletingShift) setDeleteTarget(null);
        }}
      />

      {/* Assign Shift Modal */}
      {modalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-stone-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-stone-100 flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-stone-900">Phân công ca làm việc</h3>
                <p className="text-[10px] text-stone-400 font-medium mt-0.5">
                  Thiết lập giờ trực cho {selectedStaff.user.fullName}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-all cursor-pointer flex items-center"
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={submitAssignShift} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                  Ngày làm việc
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                  Khung ca trực
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPresetIndex(idx)}
                      className={`p-2.5 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${
                        presetIndex === idx
                          ? "bg-primary border-primary text-on-primary shadow-sm"
                          : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {presetIndex === PRESETS.length - 1 && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                      Giờ bắt đầu
                    </label>
                    <input
                      type="time"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      required
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                      Giờ kết thúc
                    </label>
                    <input
                      type="time"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      required
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-primary transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-xs font-bold hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl text-xs font-bold hover:opacity-90 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/25 disabled:opacity-50"
                >
                  {isSubmitting ? "Đang phân công..." : "Xác nhận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
