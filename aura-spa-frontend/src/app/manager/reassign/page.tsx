"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { bookingService } from "@/lib/services/booking.service";
import { managerService } from "@/lib/services/manager.service";
import { getStatusColor, getStatusLabel } from "@/lib/mock-data";
import type { Booking } from "@/lib/types";

export default function ManagerReassign() {
  const { user } = useAuth();
  const [branchId, setBranchId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newTech, setNewTech] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ tech?: string; reason?: string }>({});
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setBranchId(user?.branchId || "");
  }, [user]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadData = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      const [bookingsData, staffData] = await Promise.all([
        bookingService.getBranchBookings(branchId),
        managerService.getStaff(branchId),
      ]);
      // Filter active appointments
      const activeAppts = (bookingsData || []).filter(
        (a) => ["confirmed", "checked_in", "in_service", "pending_payment"].includes(a.status)
      );
      setBookings(activeAppts);
      setStaffList(staffData || []);

      // Check if URL contains bookingId
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const bookingIdParam = urlParams.get("bookingId");
        if (bookingIdParam && activeAppts.some((a) => a.id === bookingIdParam)) {
          setSelected(bookingIdParam);
        }
      }
    } catch (err) {
      console.error("Lỗi tải thông tin điều phối:", err);
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(id);
  }, [loadData]);

  const selectedAppt = useMemo(() => bookings.find((a) => a.id === selected), [bookings, selected]);

  // Active technicians in this branch
  const activeTechs = useMemo(() => {
    return staffList.filter((s) => {
      const role = s.position ?? s.role ?? s.user?.role;
      const status = s.status ?? s.user?.status;
      return (role === "technician" || role === "staff") && status === "active";
    });
  }, [staffList]);

  // Technicians that can be reassigned to (excluding current technician)
  const availableTechs = useMemo(() => {
    if (!selectedAppt) return [];
    return activeTechs.filter((t) => {
      const tId = t.userId ?? t.user?.id ?? t.id;
      return tId !== selectedAppt.technicianId;
    });
  }, [activeTechs, selectedAppt]);

  // Check if technician is deactivated or missing
  const isTechnicianIssue = (booking: Booking) => {
    if (!booking.technicianId) return true;
    // Find technician in current staff list
    const found = staffList.find((s) => (s.userId ?? s.user?.id ?? s.id) === booking.technicianId);
    if (!found) return true; // Removed
    const status = found.status ?? found.user?.status;
    return status !== "active"; // Deactivated
  };

  const handleReassign = async () => {
    if (!selected) return;
    const e: { tech?: string; reason?: string } = {};
    if (!newTech) e.tech = "Vui lòng chọn kỹ thuật viên mới.";
    if (!reason.trim()) e.reason = "Vui lòng nhập lý do phân công lại.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    try {
      await bookingService.reassignTechnician(selected, newTech);
      const tech = staffList.find((s) => (s.userId ?? s.user?.id ?? s.id) === newTech);
      const techName = tech?.user?.fullName ?? tech?.fullName ?? "Kỹ thuật viên mới";
      
      showToast(`✓ Đã phân công lại cho ${techName}. Khách hàng đã được thông báo.`);
      setSelected(null);
      setNewTech("");
      setReason("");
      setErrors({});
      void loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Phân công lại kỹ thuật viên thất bại.");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="font-headline-md text-headline-md text-primary">Điều phối kỹ thuật viên</h1>
        <button
          onClick={() => void loadData()}
          className="border border-outline-variant px-4 py-2 rounded-full text-sm hover:bg-surface-container"
        >
          Làm mới
        </button>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant mb-6">
        Sử dụng khi kỹ thuật viên vắng mặt, bị ngừng hoạt động hoặc cần điều phối khẩn cấp.
      </p>

      {isLoading ? (
        <div className="bg-white rounded-xl p-12 border border-outline-variant/20 text-center text-on-surface-variant">
          Đang tải dữ liệu lịch hẹn và kỹ thuật viên...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Appointment list */}
          <div>
            <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">
              Lịch hẹn cần xử lý ({bookings.length})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {bookings.map((a) => {
                const customerName = a.customer?.fullName ?? `Khách đặt lịch #${a.id}`;
                const primaryService = a.services?.[0]?.service?.name ?? "Dịch vụ Spa";
                const techName = a.technician?.fullName ?? "Chưa phân công KTV";
                const techIssue = isTechnicianIssue(a);
                const isSelected = selected === a.id;

                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setSelected(a.id);
                      setNewTech("");
                      setReason("");
                      setErrors({});
                    }}
                    className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary shadow-md"
                        : techIssue
                        ? "border-error/40 hover:border-error"
                        : "border-outline-variant/30 hover:border-outline-variant"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <p className="font-label-md text-label-md text-on-surface font-bold truncate">{customerName}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${getStatusColor(a.status)}`}>
                        {getStatusLabel(a.status)}
                      </span>
                    </div>
                    
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {new Date(a.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · {primaryService}
                    </p>

                    {techIssue ? (
                      <div className="mt-2 flex items-center gap-1 text-xs text-error font-bold bg-error-container/20 border border-error-container/40 px-2 py-1 rounded-md">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                        KTV vắng mặt hoặc ngừng hoạt động!
                      </div>
                    ) : (
                      <p className="font-label-sm text-label-sm text-primary font-bold mt-1.5 flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                        KTV hiện tại: {techName}
                      </p>
                    )}
                  </div>
                );
              })}
              {bookings.length === 0 && (
                <div className="bg-white rounded-xl p-8 border border-outline-variant/20 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl block mb-2">event_available</span>
                  <p className="font-label-md text-label-md">Không có lịch hẹn cần phân công lại</p>
                </div>
              )}
            </div>
          </div>

          {/* Reassign panel */}
          <div>
            {selectedAppt ? (
              <div className="bg-white rounded-2xl border border-outline-variant/20 p-6 space-y-5">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface mb-1">Phân công lại</h2>
                  <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    {selectedAppt.customer?.fullName ?? "Khách"} · {new Date(selectedAppt.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                {/* Current technician */}
                <div className="bg-error-container/10 border border-error-container/30 rounded-xl p-3">
                  <p className="font-label-sm text-label-sm text-error font-bold mb-1">KTV hiện tại (sẽ được thay thế)</p>
                  <p className="font-label-md text-label-md text-on-surface font-semibold">
                    {selectedAppt.technician?.fullName ?? "Chưa có kỹ thuật viên"}
                  </p>
                </div>

                {/* Select new technician */}
                <div>
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2 font-bold">
                    Kỹ thuật viên thay thế *
                  </label>
                  {availableTechs.length === 0 ? (
                    <div className="p-3 bg-error-container/10 border border-error-container/30 rounded-xl">
                      <p className="text-error text-sm font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                        Không có KTV nào khác khả dụng.
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">Hãy xem xét tuyển thêm KTV hoặc đổi lịch hẹn của khách.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {availableTechs.map((t) => {
                        const tId = t.userId ?? t.user?.id ?? t.id;
                        const tName = t.user?.fullName ?? t.fullName ?? "Tên KTV";
                        const isSelected = newTech === tId;
                        return (
                          <label
                            key={tId}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-outline-variant/30 hover:border-outline-variant"
                            }`}
                          >
                            <input
                              type="radio"
                              name="tech"
                              className="sr-only"
                              value={tId}
                              checked={isSelected}
                              onChange={() => {
                                setNewTech(tId);
                                setErrors((p) => ({ ...p, tech: "" }));
                              }}
                            />
                            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs shrink-0">
                              {tName.split(" ").pop()?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-label-md text-label-md text-on-surface font-bold truncate">{tName}</p>
                              <p className="text-xs text-on-surface-variant truncate">{t.specialization ?? "Massage & Skincare"}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-secondary flex items-center justify-end gap-0.5">
                                <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>star</span>
                                {t.rating ?? "4.8"}
                              </p>
                              <p className="text-xs text-green-600 font-bold">Khả dụng</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {errors.tech && <p className="text-error text-xs mt-1 font-medium">{errors.tech}</p>}
                </div>

                {/* Reason */}
                <div>
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2 font-bold">
                    Lý do phân công lại *
                  </label>
                  <textarea
                    rows={3}
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none ${
                      errors.reason ? "border-error" : "border-outline-variant"
                    }`}
                    placeholder="VD: KTV Minh Anh nghỉ ốm đột xuất, đổi sang KTV Hương Ly..."
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setErrors((p) => ({ ...p, reason: "" }));
                    }}
                  />
                  {errors.reason && <p className="text-error text-xs mt-1 font-medium">{errors.reason}</p>}
                </div>

                <p className="text-xs text-on-surface-variant flex items-center gap-1 italic">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                  Khách hàng sẽ nhận được thông báo về việc thay đổi kỹ thuật viên.
                </p>

                <button
                  onClick={handleReassign}
                  disabled={availableTechs.length === 0}
                  className="w-full bg-primary text-on-primary py-3.5 rounded-full font-label-md text-label-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                >
                  Xác nhận phân công lại
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-outline-variant/20 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl block mb-2 text-outline">swap_horiz</span>
                <p className="font-label-md text-label-md">Chọn một lịch hẹn ở bên trái để điều phối KTV mới</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
