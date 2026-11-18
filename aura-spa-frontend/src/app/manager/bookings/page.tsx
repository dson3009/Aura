"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { bookingService } from "@/lib/services/booking.service";
import { managerService } from "@/lib/services/manager.service";
import { ROOMS, formatCurrency, getStatusColor, getStatusLabel, AppointmentStatus } from "@/lib/mock-data";

export default function ManagerBookings() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Get local date string in YYYY-MM-DD format (defaulting to Vietnam timezone matching local 2026-07-05)
  const getLocalDateString = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  };

  const todayStr = getLocalDateString(new Date());

  // Date filters
  const [quickDateFilter, setQuickDateFilter] = useState<"today" | "all" | "range">("today");
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadBookings = useCallback(async () => {
    const resolvedBranchId = user?.branchId;
    if (!resolvedBranchId) return;
    setIsLoading(true);
    try {
      let bookingsData;
      if (quickDateFilter === "today") {
        const [bData, staffData] = await Promise.all([
          bookingService.getBranchBookings(resolvedBranchId, todayStr),
          managerService.getStaff(resolvedBranchId),
        ]);
        bookingsData = bData;
        setStaff(staffData || []);
      } else if (quickDateFilter === "all") {
        const [bData, staffData] = await Promise.all([
          bookingService.getBranchBookings(resolvedBranchId),
          managerService.getStaff(resolvedBranchId),
        ]);
        bookingsData = bData;
        setStaff(staffData || []);
      } else {
        // range filter
        const [bData, staffData] = await Promise.all([
          bookingService.getBranchBookings(resolvedBranchId, undefined, startDate || undefined, endDate || undefined),
          managerService.getStaff(resolvedBranchId),
        ]);
        bookingsData = bData;
        setStaff(staffData || []);
      }

      const mapped = (bookingsData || []).map((b) => {
        const start = new Date(b.startTime);
        const end = new Date(b.endTime);
        const time = start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const duration = Math.round((end.getTime() - start.getTime()) / 60000);
        return {
          id: b.id,
          customerName: b.customer?.fullName || "Khách hàng",
          customerPhone: b.customer?.phone || "",
          time: time,
          date: start.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
          duration: duration,
          service: b.services?.[0]?.service?.name || "Dịch vụ trị liệu",
          technicianName: b.technician?.fullName || "Kỹ thuật viên",
          technicianId: b.technicianId,
          room: b.room || "Chưa phân phòng",
          price: b.subtotalAmount,
          status: b.status,
          raw: b,
        };
      });
      setAppts(mapped);
      setSelected((curr) => curr && mapped.some((x) => x.id === curr) ? curr : mapped[0]?.id ?? null);
    } catch (err) {
      console.error("Failed to load manager bookings:", err);
      showToast("Không thể tải danh sách lịch hẹn.");
    } finally {
      setIsLoading(false);
    }
  }, [user, quickDateFilter, startDate, endDate]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const filtered = appts.filter((a) => {
    const matchFilter = filter === "all" || a.status === filter;
    const matchSearch = !search || a.customerName.toLowerCase().includes(search.toLowerCase()) || a.customerPhone.includes(search) || a.id.includes(search);
    return matchFilter && matchSearch;
  });

  const selectedAppt = appts.find((a) => a.id === selected);

  const stats = {
    all: appts.length,
    confirmed: appts.filter((a) => a.status === "confirmed").length,
    checked_in: appts.filter((a) => a.status === "checked_in").length,
    service_completed: appts.filter((a) => a.status === "service_completed").length,
    completed: appts.filter((a) => a.status === "completed").length,
    cancelled: appts.filter((a) => a.status === "cancelled").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && <div className="fixed top-20 right-6 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-lg font-label-md text-label-md">{toast}</div>}

      <h1 className="font-headline-md text-headline-md text-primary mb-6">Quản lý lịch hẹn chi nhánh</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { key: "all", label: "Tất cả", color: "text-on-surface" },
          { key: "confirmed", label: "Đã xác nhận", color: "text-blue-600" },
          { key: "checked_in", label: "Đang thực hiện", color: "text-primary" },
          { key: "service_completed", label: "Chờ thanh toán", color: "text-amber-600" },
          { key: "completed", label: "Hoàn thành", color: "text-green-600" },
          { key: "cancelled", label: "Đã hủy", color: "text-error" },
        ].map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`p-3 rounded-xl border-2 text-center transition-all ${filter === s.key ? "border-primary bg-primary/5" : "border-outline-variant/30 bg-white hover:border-outline-variant"}`}>
            <p className={`font-headline-sm text-2xl font-bold ${s.color}`}>{stats[s.key as keyof typeof stats]}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Date Filters & Search */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Quick Date Options Tabs */}
          <div className="flex bg-surface-container-low p-1.5 rounded-full border border-outline-variant/30 self-start sm:self-center shrink-0">
            {[
              { key: "today", label: "Lịch hôm nay", icon: "today" },
              { key: "all", label: "Tất cả các lịch", icon: "calendar_month" },
              { key: "range", label: "Lọc theo khoảng ngày", icon: "date_range" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setQuickDateFilter(opt.key as any)}
                className={`px-5 py-2 rounded-full font-label-md text-xs font-bold transition-all flex items-center gap-2 ${
                  quickDateFilter === opt.key
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 20 }}>search</span>
            <input 
              className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl bg-white focus:outline-none focus:border-primary transition-colors text-sm shadow-sm"
              placeholder="Tìm theo tên khách, SĐT hoặc mã lịch hẹn..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
        </div>

        {/* Custom Date Range Panel (only visible when "range" filter is selected) */}
        {quickDateFilter === "range" && (
          <div className="flex flex-wrap items-center gap-3 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant text-sm font-medium">Từ ngày:</span>
              <input
                type="date"
                className="bg-white border border-outline-variant rounded-xl px-3 py-1.5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary cursor-pointer shadow-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant text-sm font-medium">Đến ngày:</span>
              <input
                type="date"
                className="bg-white border border-outline-variant rounded-xl px-3 py-1.5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary cursor-pointer shadow-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            
            <button 
              onClick={() => { setStartDate(todayStr); setEndDate(todayStr); }}
              className="text-primary text-xs hover:underline ml-2 font-bold"
            >
              Reset ngày hôm nay
            </button>
          </div>
        )}
      </div>

      {isLoading && appts.length === 0 ? (
        <div className="text-center py-10">Đang tải danh sách lịch hẹn...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-2">
            {filtered.map((a) => (
              <div key={a.id} onClick={() => setSelected(a.id)}
                className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${selected === a.id ? "border-primary" : "border-outline-variant/30 hover:border-outline-variant"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-label-md text-label-md text-on-surface font-bold">{a.customerName}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{a.customerPhone}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColor(a.status)}`}>{getStatusLabel(a.status)}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>{a.date} · {a.time} ({a.duration}p)</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>spa</span>{a.service}</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>{a.technicianName}</span>
                </div>
                {a.raw?.discountCode?.code && (
                  <div className="mt-2 flex items-center gap-1">
                    <code className="bg-secondary-container text-on-secondary-container text-xs font-bold px-2 py-0.5 rounded">{a.raw.discountCode.code}</code>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="bg-white rounded-xl p-10 border border-outline-variant/20 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-2 text-outline">calendar_month</span>
                <p className="font-label-md text-label-md">Không tìm thấy lịch hẹn</p>
              </div>
            )}
          </div>

          {/* Detail */}
          <div>
            {selectedAppt ? (
              <div className="bg-white rounded-2xl border border-outline-variant/20 p-6 space-y-4 sticky top-6">
                <div className="flex justify-between items-start">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Chi tiết lịch hẹn</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColor(selectedAppt.status)}`}>{getStatusLabel(selectedAppt.status)}</span>
                </div>

                <div className="space-y-2 text-sm">
                  {[
                    { icon: "person", label: "Khách hàng", value: selectedAppt.customerName },
                    { icon: "phone", label: "SĐT", value: selectedAppt.customerPhone },
                    { icon: "spa", label: "Dịch vụ", value: selectedAppt.service },
                    { icon: "schedule", label: "Thời gian", value: `${selectedAppt.date} · ${selectedAppt.time} · ${selectedAppt.duration} phút` },
                    { icon: "payments", label: "Giá", value: formatCurrency(selectedAppt.price) },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 py-2 border-b border-outline-variant/10">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{icon}</span>
                      <span className="text-on-surface-variant w-24 shrink-0">{label}</span>
                      <span className="font-bold text-on-surface">{value}</span>
                    </div>
                  ))}
                  {selectedAppt.raw?.discountCode?.code && (
                    <div className="flex items-center gap-3 py-2 border-b border-outline-variant/10">
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>sell</span>
                      <span className="text-on-surface-variant w-24 shrink-0">Mã giảm giá</span>
                      <code className="font-bold bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-xs">{selectedAppt.raw.discountCode.code}</code>
                    </div>
                  )}

                  {/* Room Status */}
                  <div className="flex items-center gap-3 py-2 border-b border-outline-variant/10">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>meeting_room</span>
                    <span className="text-on-surface-variant w-24 shrink-0">Phòng</span>
                    <span className="font-bold text-on-surface">{selectedAppt.room || "Chưa phân phòng"}</span>
                  </div>

                  {/* KTV Status */}
                  <div className="flex items-center gap-3 py-2 border-b border-outline-variant/10">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>badge</span>
                    <span className="text-on-surface-variant w-24 shrink-0">KTV</span>
                    <span className="font-bold text-on-surface">{selectedAppt.technicianName || "Chưa phân công"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 border border-outline-variant/20 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl block mb-2 text-outline">event_note</span>
                <p className="font-label-md text-label-md">Chọn lịch hẹn để xem chi tiết</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
