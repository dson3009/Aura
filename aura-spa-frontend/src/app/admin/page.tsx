"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { adminService } from "@/lib/services/admin.service";
import KpiCard from "@/components/dashboard/KpiCard";
import { useLanguage } from "@/context/LanguageContext";
import { strategyService, type Strategy } from "@/lib/services/strategy.service";

function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatPeriod(periodStr: string): string {
  if (!periodStr) return "";
  try {
    const date = new Date(periodStr);
    if (isNaN(date.getTime())) return periodStr;
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch {
    return periodStr;
  }
}

export default function AdminDashboard() {
  const { language, tService } = useLanguage();
  const [updatedAtLabel, setUpdatedAtLabel] = useState("--:--");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [prevPeriodData, setPrevPeriodData] = useState<any>(null);
  const [liveBranches, setLiveBranches] = useState<any[]>([]);
  const [liveServices, setLiveServices] = useState<any[]>([]);
  const [livePromotions, setLivePromotions] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeStaffList, setActiveStaffList] = useState<any[]>([]);
  const [topStrategies, setTopStrategies] = useState<Strategy[]>([]);
  const [pendingStrategyCount, setPendingStrategyCount] = useState(0);
  const [activeStrategies, setActiveStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Helper for dual language text translation
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError("");
    try {
      // Align date range with /admin/revenue's default 30 days view
      const toDate = new Date();
      toDate.setHours(23, 59, 59, 999);
      const fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromDate.setHours(0, 0, 0, 0);

      // Previous 30-day period for growth comparison
      const prevToDate = new Date(fromDate.getTime() - 1);
      prevToDate.setHours(23, 59, 59, 999);
      const prevFromDate = new Date(prevToDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      prevFromDate.setHours(0, 0, 0, 0);

      const fromStr = fromDate.toISOString();
      const toStr = toDate.toISOString();
      const prevFromStr = prevFromDate.toISOString();
      const prevToStr = prevToDate.toISOString();

      // Retrieve all data in parallel; secondary fetches fall back gracefully so they don't block
      const [dash, branchList, requests, activeStaffData, prevDash, services, promotions, strategies] =
        await Promise.all([
          adminService.getOwnerDashboard(fromStr, toStr),
          adminService.getBranches(),
          adminService.getPendingScheduleRequests(),
          adminService.getActiveStaff("all"),
          adminService.getOwnerDashboard(prevFromStr, prevToStr).catch(() => null),
          adminService.getServices().catch(() => []),
          adminService.getPromotions().catch(() => []),
          strategyService.getAll().catch(() => [] as Strategy[]),
        ]);

      setDashboardData(dash);
      setPrevPeriodData(prevDash);
      setLiveBranches(branchList || []);
      setPendingRequests(requests || []);
      setActiveStaffList(activeStaffData || []);
      setLiveServices(Array.isArray(services) ? services : []);
      setLivePromotions(Array.isArray(promotions) ? promotions : []);
      const strategyList = Array.isArray(strategies) ? strategies : [];
      const strategyKey = (s: Strategy) =>
        `${s.title.trim().toLowerCase()}|${s.description.trim().toLowerCase()}|${(s.badge || "").trim().toLowerCase()}`;
      const active = strategyList
        .filter((s) => s.status === "active")
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
        .slice(0, 2);
      const activeKeys = new Set(active.map(strategyKey));
      const proposed = strategyList
        .filter((s) => s.status === "proposed")
        .filter((s) => !activeKeys.has(strategyKey(s)))
        .sort((a, b) => {
          const rank = { high: 0, medium: 1, low: 2 } as const;
          return rank[a.priority] - rank[b.priority];
        });
      setPendingStrategyCount(proposed.length);
      setTopStrategies(proposed.slice(0, 1));
      setActiveStrategies(active);
    } catch (err) {
      console.error("Lỗi lấy thông tin owner dashboard:", err);
      setError(t("Không thể tải thông tin báo cáo từ hệ thống.", "Cannot load report data from system."));
    } finally {
      setIsLoading(false);
      setUpdatedAtLabel(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  // KPI Calculations
  const totalRevenue = useMemo(() => {
    return toNumber(dashboardData?.totalRevenue ?? 0);
  }, [dashboardData]);

  const totalMaterialCost = useMemo(() => {
    return toNumber(dashboardData?.totalMaterialCost ?? 0);
  }, [dashboardData]);

  // Trend must be declared before totalProfit/hasProfitData which depend on it
  const trend = useMemo(() => {
    return dashboardData?.trend && dashboardData.trend.length > 0
      ? dashboardData.trend
      : [];
  }, [dashboardData]);

  // Use actual profit from backend only. Do not estimate operational profit.
  const totalProfit = useMemo(() => {
    if (dashboardData?.systemProfit != null) {
      return toNumber(dashboardData.systemProfit);
    }

    const fromTrend = trend.reduce((s: number, m: any) => s + toNumber(m.profit ?? m.totalProfit), 0);
    return fromTrend > 0 ? fromTrend : null;
  }, [dashboardData, trend]);

  const hasProfitData = useMemo(
    () => dashboardData?.systemProfit != null || trend.some((m: any) => m.profit != null || m.totalProfit != null),
    [dashboardData, trend],
  );

  const profitMargin = useMemo(() => {
    if (dashboardData?.profitMargin != null) {
      return toNumber(dashboardData.profitMargin);
    }
    if (totalRevenue > 0 && totalProfit !== null) {
      return Math.round(((totalProfit ?? 0) / totalRevenue) * 100);
    }
    return null;
  }, [dashboardData, totalProfit, totalRevenue]);

  // Growth % vs previous 30-day period
  const revenueGrowth = useMemo(() => {
    if (!prevPeriodData) return null;
    const prev = toNumber(prevPeriodData.totalRevenue);
    if (prev === 0) return null;
    return ((totalRevenue - prev) / prev) * 100;
  }, [totalRevenue, prevPeriodData]);

  const growthBadge = revenueGrowth === null
    ? undefined
    : `${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`;
  const growthBadgeColor: "green" | "red" | "default" =
    revenueGrowth === null ? "default" : revenueGrowth >= 0 ? "green" : "red";

  const activeBranchesCount = useMemo(() => {
    return liveBranches.filter((b) => b.status === "active").length;
  }, [liveBranches]);

  const branchesLength = useMemo(() => {
    return liveBranches.length;
  }, [liveBranches]);

  const totalBookingsCount = useMemo(() => {
    return (
      toNumber(dashboardData?.totalCompletedBookings ?? 0) +
      toNumber(dashboardData?.totalCancelledBookings ?? 0)
    );
  }, [dashboardData]);

  const maxRevenue = useMemo(() => {
    return Math.max(...trend.map((m: any) => toNumber(m.revenue ?? m.totalRevenue)), 1000000);
  }, [trend]);

  // Merge branches data with their dynamic revenue stats
  const branchStats = useMemo(() => {
    return liveBranches.map((b) => {
      const apiBranch = dashboardData?.byBranch?.find((ab: any) => String(ab.branchId) === String(b.id));
      return {
        ...b,
        revenue: apiBranch ? toNumber(apiBranch.totalRevenue) : 0,
        completedBookings: apiBranch ? toNumber(apiBranch.completedBookings) : 0,
        capacity: b.capacity ?? null,
      };
    });
  }, [liveBranches, dashboardData]);

  // Approvals Actions
  const handleApprove = async (id: string) => {
    if (!confirm(t("Bạn có chắc chắn muốn duyệt yêu cầu này?", "Are you sure you want to approve this request?"))) return;
    try {
      await adminService.approveScheduleRequest(id);
      void loadDashboard();
    } catch (err) {
      alert(t("Không thể duyệt yêu cầu.", "Cannot approve request."));
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm(t("Bạn có chắc chắn muốn từ chối yêu cầu này?", "Are you sure you want to reject this request?"))) return;
    try {
      await adminService.rejectScheduleRequest(id);
      void loadDashboard();
    } catch (err) {
      alert(t("Không thể từ chối yêu cầu.", "Cannot reject request."));
    }
  };

  const renderStrategyCard = (s: Strategy, tone: "review" | "active") => (
    <div
      key={`${tone}-${s.id}`}
      className="bg-white p-3.5 rounded-xl border border-outline-variant/20 shadow-sm min-w-0"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
        <span className="text-[10px] font-bold uppercase text-on-surface-variant bg-surface-container px-2 py-0.5 rounded truncate max-w-[52%]">
          {s.badge && !/^(high|medium|low)$/i.test(s.badge)
            ? s.badge
            : t("Vận hành", "Operations")}
        </span>
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            tone === "active"
              ? "bg-green-50 text-green-700 border-green-200"
              : s.priority === "high"
              ? "bg-error/10 text-error border-error/20"
              : s.priority === "medium"
              ? "bg-secondary/10 text-secondary border-secondary/25"
              : "bg-surface-container text-on-surface-variant border-outline-variant/30"
          }`}
        >
          {tone === "active"
            ? t("Đang áp dụng", "Active")
            : s.priority === "high"
            ? t("Cao", "High")
            : s.priority === "medium"
            ? t("TB", "Med")
            : t("Thấp", "Low")}
        </span>
      </div>
      <p className="text-sm font-bold text-on-surface line-clamp-2 break-words">{s.title}</p>
      <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 break-words leading-relaxed">
        {s.description}
      </p>
    </div>
  );

  return (
    <div className="p-6 max-w-container-max mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {t("Báo cáo Chiến lược Toàn diện (Owner)", "Comprehensive Strategy Report (Owner)")}
          </h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
            {t("Cập nhật lúc", "Updated at")} {updatedAtLabel} - {t("Hôm nay", "Today")}
          </p>
        </div>
        <button
          onClick={() => void loadDashboard()}
          className="bg-primary text-on-primary px-6 py-3 rounded-full font-label-md text-label-md flex items-center gap-2 hover:opacity-90 w-fit font-bold"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
          {t("Làm mới", "Refresh")}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-error-container bg-error-container/30 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/revenue">
          <KpiCard
            title={t("Lợi nhuận hệ thống", "System Profit")}
            value={totalProfit === null ? "--" : formatCurrency(totalProfit)}
            icon="payments"
            badge={growthBadge}
            badgeColor={growthBadgeColor}
            iconBg="bg-primary/10 text-primary"
          />
        </Link>
        <Link href="/admin/revenue">
          <KpiCard
            title={t("Doanh thu hệ thống", "System Revenue")}
            value={formatCurrency(totalRevenue)}
            icon="account_balance"
            badge={growthBadge}
            badgeColor={growthBadgeColor}
            iconBg="bg-secondary-container/30 text-secondary"
          />
        </Link>
        <Link href="/admin/branches">
          <KpiCard title={t("Chi nhánh hoạt động", "Active Branches")} value={`${activeBranchesCount}/${branchesLength}`} icon="storefront" badgeColor="default" iconBg="bg-tertiary-fixed/30 text-tertiary" />
        </Link>
        <KpiCard title={t("Số lịch hẹn hệ thống", "System Appointments")} value={`${totalBookingsCount} ${t("lịch hẹn", "appointments")}`} icon="how_to_reg" badge={totalBookingsCount > 0 ? t("Mới", "New") : t("Ổn", "OK")} badgeColor={totalBookingsCount > 0 ? "red" : "green"} iconBg="bg-error-container/30 text-error" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm min-w-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {t("Phân tích hiệu suất đa chi nhánh", "Multi-Branch Performance Analysis")}
              </h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {t("Doanh thu & Lợi nhuận hệ thống", "System Revenue & Profit")}
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary" />{t("Doanh thu", "Revenue")}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-secondary-container" />{t("Lợi nhuận", "Profit")}</span>
            </div>
          </div>
          
          {/* Prevent column overflow by adding w-full, min-w-0 and absolute hover tooltip positioning */}
          <div className={`w-full relative h-56 flex items-end px-2 border-b border-outline-variant/20 pb-4 mb-4 overflow-visible ${trend.length > 15 ? 'gap-1' : 'gap-2'}`}>
            {trend.length === 0 ? (
              <div className="w-full h-full rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant text-sm">
                {t("Chưa có dữ liệu hiệu suất từ hệ thống.", "No performance data available from the system.")}
              </div>
            ) : trend.map((m: any) => {
              const rev = toNumber(m.revenue ?? m.totalRevenue);
              const hasItemProfit = m.profit != null || m.totalProfit != null;
              const prof = toNumber(m.profit ?? m.totalProfit);
              const revH = Math.round((rev / maxRevenue) * 100);
              const profH = Math.round((prof / maxRevenue) * 100);
              return (
                <div key={m.month ?? m.period} className={`flex-1 flex items-end group h-full justify-end min-w-0 relative ${trend.length > 15 ? 'gap-0.5' : 'gap-1'}`}>
                  {/* Premium Interactive Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-stone-900/95 text-stone-100 text-xs rounded-xl p-2.5 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-30 min-w-[140px] border border-stone-800 backdrop-blur-md translate-y-1 group-hover:translate-y-0">
                    <div className="font-bold border-b border-stone-700/50 pb-1 mb-1.5 text-stone-400">
                      {m.month ?? formatPeriod(m.period)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between gap-3">
                        <span className="text-stone-400">{t("Doanh thu:", "Revenue:")}</span>
                        <span className="font-bold text-amber-500">{formatCurrency(rev)}</span>
                      </div>
                      {(m.profit != null || m.totalProfit != null) && (
                        <div className="flex justify-between gap-3">
                          <span className="text-stone-400">{t("Lợi nhuận:", "Profit:")}</span>
                          <span className="font-bold text-emerald-500">{formatCurrency(prof)}</span>
                        </div>
                      )}
                      {m.appointments !== undefined && (
                        <div className="flex justify-between gap-3">
                          <span className="text-stone-400">{t("Lịch hẹn:", "Bookings:")}</span>
                          <span className="font-bold text-sky-400">{m.appointments}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0">
                    <div className="w-full rounded-t bg-primary/30 hover:bg-primary transition-all duration-300 cursor-pointer shadow-sm hover:shadow hover:-translate-y-0.5" style={{ height: `${Math.max(5, revH * 1.5)}px` }} />
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0">
                    {hasItemProfit && (
                      <div className="w-full rounded-t bg-secondary-container hover:opacity-90 hover:bg-secondary-container transition-all duration-300 cursor-pointer shadow-sm hover:shadow hover:-translate-y-0.5" style={{ height: `${Math.max(2, profH * 1.5)}px` }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Reduce X-axis labels when there are too many columns to avoid overlay */}
          <div className="w-full flex justify-between px-2 text-[10px] text-on-surface-variant font-bold min-w-0">
            {trend.map((m: any, idx: number) => {
              const showLabel = trend.length <= 8 || idx === 0 || idx === trend.length - 1 || idx % 5 === 0;
              return (
                <span key={m.month ?? m.period} className="flex-1 text-center truncate min-w-0">
                  {showLabel ? (m.month ?? formatPeriod(m.period)) : ""}
                </span>
              );
            })}
          </div>

          {/* Bottom summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-outline-variant/10">
            {[
              { label: t("Doanh thu hệ thống", "System Revenue"), value: formatCurrency(totalRevenue), sub: t("Doanh thu tổng", "Total Revenue") },
              {
                label: t("Chi phí vật tư", "Material Cost"),
                value: formatCurrency(totalMaterialCost),
                sub: t("Từ giao dịch xuất kho", "From inventory consumption"),
              },
              {
                label: t("Biên lợi nhuận hệ thống", "System Profit Margin"),
                value: profitMargin !== null ? `${profitMargin}%` : "–",
                sub: hasProfitData
                  ? t("Dựa trên dữ liệu thực tế", "Based on actual data")
                  : t("Chưa có dữ liệu chi phí", "No cost data available"),
              },
              { label: t("Tổng lịch hẹn", "Total Appointments"), value: trend.reduce((s: number, m: any) => s + toNumber(m.appointments ?? m.completedBookings), 0).toLocaleString("vi-VN"), sub: t("lịch hẹn", "appointments") },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-1 text-xs">{s.label}</p>
                <p className="font-headline-sm text-headline-sm text-primary font-bold text-sm sm:text-base">{s.value}</p>
                <p className="text-[10px] text-green-600 font-bold mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy spotlight — top proposed, no heavy AI branding */}
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/20 flex flex-col shadow-sm min-w-0">
          <div className="flex items-center gap-3 mb-5 min-w-0">
            <span
              className="material-symbols-outlined text-primary text-3xl shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              flag
            </span>
            <div className="min-w-0">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {t("Chiến lược vận hành", "Operating strategies")}
              </h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {t("Theo dõi đề xuất và chiến lược đang áp dụng", "Track proposals and active strategies")}
              </p>
            </div>
          </div>
          <div className="space-y-4 flex-1 min-w-0">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-on-surface">{t("Cần xem xét", "Needs review")}</p>
                <span className="text-[10px] font-bold text-primary/80">{pendingStrategyCount}</span>
              </div>
              {topStrategies.length === 0 ? (
                <div className="bg-white p-3.5 rounded-xl border border-outline-variant/20 shadow-sm text-xs text-on-surface-variant leading-relaxed">
                  {t(
                    "Chưa có đề xuất đang chờ.",
                    "No pending proposals.",
                  )}
                </div>
              ) : (
                topStrategies.map((s) => renderStrategyCard(s, "review"))
              )}
            </div>

            <div className="space-y-2.5 border-t border-outline-variant/20 pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-on-surface">{t("Đang áp dụng", "Active strategies")}</p>
                <span className="text-[10px] font-bold text-green-700">{activeStrategies.length}</span>
              </div>
              {activeStrategies.length === 0 ? (
                <div className="bg-white p-3.5 rounded-xl border border-outline-variant/20 shadow-sm text-xs text-on-surface-variant leading-relaxed">
                  {t(
                    "Chưa có chiến lược nào đang áp dụng.",
                    "No active strategies yet.",
                  )}
                </div>
              ) : (
                activeStrategies.map((s) => renderStrategyCard(s, "active"))
              )}
            </div>
          </div>
          <Link href="/admin/strategies" className="w-full mt-4">
            <button className="w-full py-3 bg-primary text-on-primary font-label-md text-label-md rounded-xl hover:bg-primary-container transition-colors text-sm font-bold">
              {t("Xem tất cả chiến lược", "View all strategies")}
            </button>
          </Link>
        </div>
      </div>

      {/* Branches status & Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">
            {t("Hiện trạng chi nhánh", "Branch Status")}
          </h3>
          <div className="space-y-4">
            {branchStats.length === 0 && (
              <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
                {t("Chưa có dữ liệu chi nhánh từ hệ thống.", "No branch data available from the system.")}
              </div>
            )}
            {branchStats.map((b) => {
              const branchActiveStaff = activeStaffList.filter((s) => String(s.branchId) === String(b.id));
              return (
                <div key={b.id} className="p-4 rounded-xl border border-outline-variant/20 hover:border-primary transition-colors cursor-pointer">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-label-md text-label-md text-on-surface font-bold">{tService(b.name)}</h4>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.status === "active" ? "bg-green-50 text-green-700" : "bg-secondary-container text-on-secondary-container"}`}>
                      {b.status === "active" ? "Online" : t("Bảo trì", "Maintenance")}
                    </span>
                  </div>
                  {b.status === "active" ? (
                    <>
                      <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                        <span>{t("Công suất thực tế", "Actual Capacity")}</span><span className="font-bold">{b.capacity == null ? "–" : `${b.capacity}%`}</span>
                      </div>
                      <div className="h-1.5 bg-surface-container rounded-full overflow-hidden mb-2">
                        {b.capacity != null && <div className="bg-primary h-full" style={{ width: `${b.capacity}%` }} />}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-on-surface-variant">{tService(b.address)}</span>
                        <span className="font-bold text-primary">{formatCurrency(b.revenue)}</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-outline-variant/10">
                        <p className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-xs text-primary" style={{ fontSize: 16 }}>groups</span>
                          {t("Nhân sự đang trực:", "Staff on duty:")} {branchActiveStaff.length}
                        </p>
                        {branchActiveStaff.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {branchActiveStaff.map((s) => (
                              <span key={s.staffId} className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border border-primary/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                {s.name} ({s.position === 'technician' ? t('KTV', 'Tech') : s.position === 'receptionist' ? t('Lễ tân', 'Receptionist') : t('Quản lý', 'Manager')})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-on-surface-variant italic">{t("Không có nhân sự trực ca hiện tại", "No staff on duty currently")}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-on-surface-variant">{t("Chi nhánh chưa hoạt động.", "Branch is not active.")} · {tService(b.address)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-4">
          {[
            { label: t("Quản lý Chi nhánh", "Branch Directory"), href: "/admin/branches", icon: "storefront", desc: `${liveBranches.length} ${t("chi nhánh trong hệ thống", "branches in system")}` },
            { label: t("Danh mục Dịch vụ", "Spa Services Directory"), href: "/admin/services", icon: "spa", desc: `${liveServices.filter((s) => s.status === "active").length} ${t("dịch vụ đang chạy", "services running")}` },
            { label: t("Khuyến mãi & Mã giảm", "Promotions & Discounts"), href: "/admin/promotions", icon: "sell", desc: `${livePromotions.filter((p) => p.status === "active").length} ${t("chương trình khuyến mãi", "active promotions")}` },
          ].map((q) => (
            <Link key={q.href} href={q.href}
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-outline-variant/20 hover:border-primary transition-colors group cursor-pointer shadow-sm"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{q.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-label-md text-label-md text-on-surface font-bold text-sm">{q.label}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant truncate text-xs">{q.desc}</p>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors group-hover:translate-x-1 transform" style={{ fontSize: 18 }}>arrow_forward</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
