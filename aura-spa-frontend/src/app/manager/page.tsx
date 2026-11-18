"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { managerService } from "@/lib/services/manager.service";
import { spaService } from "@/lib/services/spa.service";
import { bookingService } from "@/lib/services/booking.service";
import type { Booking } from "@/lib/types";
import { INVENTORY, formatCurrency, getStatusColor, getStatusLabel } from "@/lib/mock-data";
import KpiCard from "@/components/dashboard/KpiCard";

interface BranchReport {
  revenue?: {
    totalRevenue?: number;
    completedBookings?: number;
    averageBookingValue?: number;
  };
}

interface StaffAssignment {
  id?: string;
  userId?: string;
  status?: string;
  user?: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  };
}

interface InventoryItem {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  minThreshold: number;
  maxStock?: number;
  unit?: string;
  isLow?: boolean;
  isLowStock?: boolean;
}

interface DashboardComplaint {
  id: string;
  customerName?: string;
  customer?: {
    fullName?: string;
  };
  description: string;
  status: string;
}

interface ActiveStaff {
  staffId: string;
  name: string;
  position?: string;
  rating?: number | string;
}

const MANAGER_BRANCH_BY_EMAIL: Record<string, { code: string; name: string }> = {
  "huong.manager@aura-spa.com": { code: "HCM-Q1", name: "Aura Spa - Quận 1" },
  "khanh.manager@aura-spa.com": { code: "HCM-Q7", name: "Aura Spa - Quận 7" },
  "phuong.manager@aura-spa.com": { code: "HAN-HK", name: "Aura Spa - Hoàn Kiếm" },
  "dung.manager.dn@aura-spa.com": { code: "DAN-HC", name: "Aura Spa - Đà Nẵng Sông Hàn" },
  "manager@auraspa.vn": { code: "HCM-Q1", name: "Aura Spa - Quận 1" },
};

const normalizeBranchName = (branch: { name?: string }, fallbackName?: string) => {
  return branch.name || fallbackName || "Chi nhánh";
};

const todayRange = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
};

const isToday = (dateString: string) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};

const toLocalDateKey = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatShortDate = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatDateHeading = (dateKey: string) => {
  const todayKey = toLocalDateKey(new Date().toISOString());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrow.toISOString());

  if (dateKey === todayKey) return "Hôm nay";
  if (dateKey === tomorrowKey) return "Ngày mai";

  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const ACTIVE_BOOKING_STATUSES = new Set<Booking["status"]>([
  "pending_payment",
  "confirmed",
  "checked_in",
  "in_service",
  "service_completed",
]);

const ATTENTION_STATUSES = new Set<Booking["status"]>([
  "pending_payment",
  "confirmed",
  "service_completed",
]);

const CLOSED_BOOKING_STATUSES = new Set<Booking["status"]>([
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
  "transferred",
]);

const formatBookingTime = (booking: Booking) =>
  new Date(booking.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const getBookingDuration = (booking: Booking) =>
  Math.round((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000);

const getCustomerName = (booking: Booking) => booking.customer?.fullName || "Khách hàng";
const getTechnicianName = (booking: Booking) => booking.technician?.fullName || "Chưa gán KTV";
const getServiceName = (booking: Booking) => booking.services?.[0]?.service?.name || "Dịch vụ trị liệu";

function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const fallbackBranch = user?.email ? MANAGER_BRANCH_BY_EMAIL[user.email.toLowerCase()] : undefined;
  const [branchId, setBranchId] = useState(user?.branchId ?? "");
  const [branchName, setBranchName] = useState(fallbackBranch?.name ?? "Chi nhánh");

  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [report, setReport] = useState<BranchReport | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staff, setStaff] = useState<StaffAssignment[]>([]);
  const [activeStaffList, setActiveStaffList] = useState<ActiveStaff[]>([]);
  const [dashboardData, setDashboardData] = useState<Record<string, unknown> | null>(null);
  const [liveInventory, setLiveInventory] = useState<InventoryItem[]>([]);
  const [liveComplaints, setLiveComplaints] = useState<DashboardComplaint[]>([]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setNotice("");

    try {
      let resolvedBranchId = user?.branchId ?? branchId;

      try {
        const branches = await spaService.getBranches();
        const matchedBranch =
          branches.find((branch) => branch.id === resolvedBranchId) ??
          branches.find((branch) => branch.code === fallbackBranch?.code);

        if (matchedBranch) {
          resolvedBranchId = matchedBranch.id;
          setBranchId(matchedBranch.id);
          setBranchName(normalizeBranchName(matchedBranch, fallbackBranch?.name));
        }
      } catch {
        setBranchName(fallbackBranch?.name ?? "Chi nhánh");
      }

      if (!resolvedBranchId) {
        setReport(null);
        setBookings([]);
        setStaff([]);
        setActiveStaffList([]);
        setNotice("Chưa xác định được chi nhánh quản lý cho tài khoản này.");
        return;
      }

      const { from, to } = todayRange();
      const [
        reportResult,
        bookingResult,
        staffResult,
        dashboardResult,
        inventoryResult,
        complaintResult,
        activeStaffResult,
      ] = await Promise.allSettled([
        managerService.getBranchPerformance(resolvedBranchId, from, to),
        bookingService.getBranchBookings(resolvedBranchId),
        managerService.getStaff(resolvedBranchId),
        managerService.getManagerDashboard(resolvedBranchId),
        managerService.getInventory(resolvedBranchId),
        managerService.getComplaints(resolvedBranchId),
        managerService.getActiveStaff(resolvedBranchId),
      ]);

      const failedSections: string[] = [];
      const valueOr = <T,>(result: PromiseSettledResult<T>, fallback: T, label: string): T => {
        if (result.status === "fulfilled") return result.value;
        failedSections.push(label);
        return fallback;
      };

      const reportData = valueOr(reportResult, null, "báo cáo doanh thu") as BranchReport | null;
      const bookingData = valueOr(bookingResult, [], "lịch hẹn") as Booking[];
      const staffData = valueOr(staffResult, [], "nhân sự") as unknown as StaffAssignment[];
      const dashData = valueOr(dashboardResult, null, "tổng quan") as Record<string, unknown> | null;
      const invData = valueOr(inventoryResult, [], "tồn kho") as Record<string, unknown>[];
      const compData = valueOr(complaintResult, [], "khiếu nại") as unknown as DashboardComplaint[];
      const activeStaffData = valueOr(activeStaffResult, [], "nhân sự đang trực") as unknown as ActiveStaff[];

      setReport(reportData);
      setBookings(bookingData);
      setStaff(staffData);
      setDashboardData(dashData);
      const mappedInventory = (invData || []).map((item: any) => {
        const quantity = toNumber(item.currentQuantity);
        const minThreshold = toNumber(item.inventoryItem?.minStockLevel);
        const maxStock = 100; // default cap matching inventory/page.tsx
        return {
          id: item.id,
          name: item.inventoryItem?.name || "Chưa đặt tên",
          category: item.inventoryItem?.category || "Khác",
          unit: item.inventoryItem?.unit || "Chai",
          quantity,
          minThreshold,
          maxStock,
          isLow: !!item.isLowStock || quantity < minThreshold,
        };
      });
      setLiveInventory(mappedInventory);
      setLiveComplaints(compData || []);
      setActiveStaffList(activeStaffData || []);
      if (failedSections.length > 0) {
        setNotice(`Một số dữ liệu chưa tải được: ${failedSections.join(", ")}. Các khu vực còn lại vẫn đang hiển thị dữ liệu mới nhất.`);
      }
    } catch {
      setReport(null);
      setBookings([]);
      setStaff([]);
      setActiveStaffList([]);
      setDashboardData(null);
      setLiveInventory([]);
      setLiveComplaints([]);
      setNotice("Đang hiển thị khung tổng quan. Dữ liệu sẽ tự cập nhật khi backend sẵn sàng.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId, fallbackBranch, user]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(id);
  }, [loadDashboard]);

  const todayBookings = useMemo(() => {
    return bookings
      .filter((booking) => isToday(booking.startTime))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [bookings]);

  const upcomingBookings = useMemo(() => {
    const todayStart = startOfToday().getTime();
    return bookings
      .filter((booking) =>
        ACTIVE_BOOKING_STATUSES.has(booking.status) &&
        new Date(booking.startTime).getTime() >= todayStart
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [bookings]);

  const todayOperationalBookings = useMemo(
    () => todayBookings.filter((booking) => !CLOSED_BOOKING_STATUSES.has(booking.status)),
    [todayBookings]
  );

  const nextTodayBooking = useMemo(
    () => todayOperationalBookings.find((booking) => new Date(booking.endTime).getTime() >= Date.now()) ?? todayOperationalBookings[0],
    [todayOperationalBookings]
  );

  const attentionBookings = useMemo(
    () => todayOperationalBookings.filter((booking) => ATTENTION_STATUSES.has(booking.status)).slice(0, 5),
    [todayOperationalBookings]
  );

  const futurePreviewBookings = useMemo(
    () => upcomingBookings.filter((booking) => !isToday(booking.startTime)).slice(0, 3),
    [upcomingBookings]
  );

  const scheduleStats = useMemo(() => [
    {
      label: "Chờ cọc",
      value: todayBookings.filter((booking) => booking.status === "pending_payment").length,
      tone: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      label: "Chờ check-in",
      value: todayBookings.filter((booking) => booking.status === "confirmed").length,
      tone: "bg-primary/10 text-primary border-primary/20",
    },
    {
      label: "Đang trị liệu",
      value: todayBookings.filter((booking) => booking.status === "checked_in" || booking.status === "in_service").length,
      tone: "bg-secondary-container/40 text-secondary border-secondary/20",
    },
    {
      label: "Chờ thanh toán",
      value: todayBookings.filter((booking) => booking.status === "service_completed").length,
      tone: "bg-green-50 text-green-700 border-green-200",
    },
  ], [todayBookings]);

  const pendingAppts = todayBookings.filter((booking) => booking.status === "confirmed" || booking.status === "pending_payment").length;
  const todayRevenue = toNumber(dashboardData?.todayRevenue ?? dashboardData?.revenue ?? report?.revenue?.totalRevenue);
  const totalBookingsCount = toNumber(dashboardData?.todayBookingsCount ?? dashboardData?.bookingsCount ?? todayBookings.length);
  const activeStaff = toNumber(dashboardData?.activeStaffCount ?? activeStaffList.length);
  const lowStock = liveInventory.length > 0
    ? liveInventory.filter((item) => item.isLow).length
    : INVENTORY.filter((item) => item.quantity <= item.minThreshold).length;
  const openComplaints = toNumber(
    dashboardData?.openComplaintsCount ??
    dashboardData?.complaintsCount ??
    liveComplaints.filter((item) => item.status === "open" || item.status === "in_progress").length
  );

  return (
    <div className="p-6 max-w-container-max mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">Bảng điều khiển</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{branchName} - Hệ thống đang hoạt động ổn định</p>
        </div>
        <Link href="/manager/shifts" className="bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md flex items-center gap-2 hover:opacity-90 transition-opacity w-fit">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Phân công ca mới
        </Link>
      </div>

      {notice && (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          {notice}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/manager/reports">
          <KpiCard
            title="Doanh thu hôm nay"
            value={isLoading ? "Đang tải..." : formatCurrency(todayRevenue)}
            icon="monetization_on"
            badge={isLoading ? "" : `${toNumber(dashboardData?.completedBookingsCount ?? report?.revenue?.completedBookings)} hoàn thành`}
            badgeColor="green"
            iconBg="bg-primary/10 text-primary"
          />
        </Link>
        <Link href="/manager/bookings">
          <KpiCard
            title="Lịch hẹn hôm nay"
            value={isLoading ? "Đang tải..." : `${totalBookingsCount} lịch`}
            icon="calendar_today"
            badge={`${pendingAppts} chờ`}
            badgeColor="yellow"
            iconBg="bg-secondary-container/30 text-secondary"
          />
        </Link>
        <Link href="/manager/staff?filter=active">
          <KpiCard
            title="Nhân sự đang trực"
            value={isLoading ? "Đang tải..." : `${activeStaff}/${staff.length || 5} người`}
            icon="groups"
            badgeColor="default"
            iconBg="bg-tertiary-fixed/30 text-tertiary"
          />
        </Link>
        <Link href="/manager/inventory">
          <KpiCard
            title="Tồn kho cảnh báo"
            value={`${lowStock} mặt hàng`}
            icon="warning"
            badge={lowStock > 0 ? "Cần nhập" : "Ổn"}
            badgeColor={lowStock > 0 ? "red" : "green"}
            iconBg="bg-error-container/30 text-error"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule operations */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-outline-variant/20">
          <div className="flex flex-col gap-4 mb-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Vận hành lịch hôm nay</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                {todayBookings.length} lịch trong ngày · {attentionBookings.length} mục cần quản lý
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/manager/reassign" className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container">
                Điều phối KTV
              </Link>
              <Link href="/manager/bookings" className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90">
                Xem lịch
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-5">
            {scheduleStats.map((item) => (
              <div key={item.label} className={`rounded-xl border px-3 py-2 ${item.tone}`}>
                <p className="text-2xl font-bold leading-none">{item.value}</p>
                <p className="text-[11px] font-bold uppercase mt-1">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-2 rounded-2xl bg-surface-container-low p-4">
              <p className="text-xs uppercase font-bold text-on-surface-variant mb-3">Ca kế tiếp</p>
              {nextTodayBooking ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-on-primary">
                      <span className="text-sm font-bold">{formatBookingTime(nextTodayBooking)}</span>
                      <span className="text-[10px]">{getBookingDuration(nextTodayBooking)}p</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-label-md text-label-md font-bold text-on-surface truncate">{getCustomerName(nextTodayBooking)}</p>
                      <p className="text-xs text-on-surface-variant truncate">{getServiceName(nextTodayBooking)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold text-[10px]">KTV</p>
                      <p className="font-bold text-on-surface truncate">{getTechnicianName(nextTodayBooking)}</p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant uppercase font-bold text-[10px]">Phòng</p>
                      <p className="font-bold text-on-surface truncate">{nextTodayBooking.room || "Chưa phân phòng"}</p>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${getStatusColor(nextTodayBooking.status)}`}>
                    {getStatusLabel(nextTodayBooking.status)}
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-outline-variant/50 p-4 text-xs text-on-surface-variant">
                  Không còn lịch vận hành trong hôm nay.
                </div>
              )}
            </div>

            <div className="xl:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase font-bold text-on-surface-variant">Cần xử lý</p>
                <span className="text-xs text-on-surface-variant">{formatShortDate(toLocalDateKey(new Date().toISOString()))}</span>
              </div>
              <div className="space-y-2">
                {attentionBookings.length === 0 ? (
                  <div className="rounded-xl border border-outline-variant/20 p-4 text-xs text-on-surface-variant">
                    Không có lịch cần xử lý ngay. Theo dõi timeline bên dưới để điều phối phòng và KTV.
                  </div>
                ) : attentionBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/manager/bookings?bookingId=${booking.id}`}
                    className="flex items-center gap-3 rounded-xl border border-outline-variant/20 p-3 hover:border-primary/40 hover:bg-surface-container-low"
                  >
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-sm font-bold text-primary">{formatBookingTime(booking)}</p>
                      <p className="text-[10px] text-on-surface-variant">{getBookingDuration(booking)}p</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">{getCustomerName(booking)}</p>
                      <p className="text-xs text-on-surface-variant truncate">{getServiceName(booking)} · {getTechnicianName(booking)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${getStatusColor(booking.status)}`}>
                      {getStatusLabel(booking.status)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-outline-variant/20 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase font-bold text-on-surface-variant">Timeline hôm nay</p>
              {futurePreviewBookings.length > 0 && (
                <span className="text-xs text-on-surface-variant">Sắp tới: {futurePreviewBookings.length} lịch ngày sau</span>
              )}
            </div>
            <div className="space-y-2">
              {todayOperationalBookings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
                  Hôm nay chưa có lịch đang vận hành. Khi có lịch mới, khu này sẽ hiển thị theo thứ tự giờ để quản lý ca trực dễ hơn.
                </div>
              ) : todayOperationalBookings.slice(0, 6).map((booking) => (
                <div key={booking.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-container-low">
                  <div className="text-center">
                    <p className="text-sm font-bold text-primary">{formatBookingTime(booking)}</p>
                    <p className="text-[10px] text-on-surface-variant">{getBookingDuration(booking)}p</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{getCustomerName(booking)}</p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {getServiceName(booking)} · {booking.room || "Chưa phân phòng"} · {getTechnicianName(booking)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${getStatusColor(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Complaints */}
          <div className="bg-white rounded-2xl p-5 border border-outline-variant/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Khiếu nại</h3>
              {openComplaints > 0 && (
                <span className="bg-error text-on-error text-xs font-bold px-2 py-0.5 rounded-full">{openComplaints} mới</span>
              )}
            </div>
            {liveComplaints.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic py-4 text-center">Không có khiếu nại nào.</p>
            ) : (
              liveComplaints.slice(0, 3).map((item) => (
                <div key={item.id} className="p-3 rounded-lg border border-outline-variant/20 mb-2">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-label-md text-label-md text-on-surface font-bold text-sm">{item.customerName ?? item.customer?.fullName ?? "Ẩn danh"}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}>{getStatusLabel(item.status)}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2">{item.description}</p>
                </div>
              ))
            )}
            <Link href="/manager/complaints" className="text-primary font-label-md text-label-md text-sm hover:underline block text-center mt-2">
              Xem tất cả
            </Link>
          </div>

          {/* Staff on duty */}
          <div className="bg-white rounded-2xl p-5 border border-outline-variant/20">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Nhân sự đang trực</h3>
            <div className="space-y-2">
              {activeStaffList.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic">Không có nhân sự nào trong ca trực.</p>
              ) : (
                activeStaffList.map((s) => (
                  <div key={s.staffId} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs shrink-0">
                      {s.name.split(" ").pop()?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-label-md text-on-surface text-sm font-bold truncate">{s.name}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant text-xs">
                        {s.position === 'technician' ? 'Kỹ thuật viên' : s.position === 'receptionist' ? 'Lễ tân' : 'Quản lý'}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-green-600">★ {s.rating}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock > 0 && (
        <div className="bg-error-container/20 border border-error-container rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-error" style={{ fontSize: 24 }}>warning</span>
            <h3 className="font-headline-sm text-headline-sm text-error">Cảnh báo tồn kho thấp</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(liveInventory.length > 0 ? liveInventory.filter((item) => item.isLow) : INVENTORY.filter((item) => item.quantity <= item.minThreshold)).map((i) => (
              <div key={i.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                <div>
                  <p className="font-label-md text-label-md text-on-surface font-bold text-sm">{i.name}</p>
                  <p className="text-xs text-on-surface-variant">{i.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-error text-sm">{i.quantity}/{i.maxStock} {i.unit}</p>
                  <Link href="/manager/inventory" className="text-xs text-primary hover:underline">Nhập hàng</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
