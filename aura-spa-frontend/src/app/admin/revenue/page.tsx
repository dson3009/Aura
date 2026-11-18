"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminService, type RevenueDashboard } from "@/lib/services/admin.service";
import { useLanguage } from "@/context/LanguageContext";

type Period = "week" | "month" | "year";

function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getRange(period: Period): { from: string; to: string; granularity: "day" | "week" | "month" } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();

  if (period === "week") {
    from.setTime(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString(), granularity: "day" };
  }

  if (period === "year") {
    from.setTime(to.getTime());
    from.setFullYear(to.getFullYear() - 1);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString(), granularity: "month" };
  }

  from.setTime(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString(), granularity: "day" };
}

function formatPeriod(value: string, period: Period): string {
  const date = new Date(value);
  if (period === "year") {
    return date.toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" });
  }
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export default function AdminRevenue() {
  const { language, tService } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const [period, setPeriod] = useState<Period>("month");
  const [dashboard, setDashboard] = useState<RevenueDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRevenue = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const range = getRange(period);
      const data = await adminService.getRevenueDashboard(range.from, range.to, range.granularity);
      setDashboard(data);
    } catch (err) {
      console.error("Cannot load revenue dashboard:", err);
      setDashboard(null);
      setError(language === "en" ? "Cannot load revenue data from the system." : "Không thể tải dữ liệu doanh thu từ hệ thống.");
    } finally {
      setIsLoading(false);
    }
  }, [period, language]);

  useEffect(() => {
    void loadRevenue();
  }, [loadRevenue]);

  const maxRevenue = useMemo(() => {
    if (!dashboard || dashboard.trend.length === 0) return 1000000;
    return Math.max(...dashboard.trend.map((m) => Number(m.revenue)), 1000000);
  }, [dashboard]);

  const totalBranchesRevenue = useMemo(() => {
    return (dashboard?.byBranch ?? []).reduce((sum, item) => sum + Number(item.totalRevenue), 0);
  }, [dashboard]);

  return (
    <div className="p-6 max-w-container-max mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t("Bảng điều khiển doanh thu", "Revenue Dashboard")}
          </h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mt-1">
            {t("Tổng hợp hiệu quả kinh doanh toàn hệ thống", "System-wide Business Performance Summary")}
          </p>
          {error && !isLoading && (
            <p className="mt-2 rounded-xl border border-error-container bg-error-container/30 px-4 py-3 text-sm text-error">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container rounded-full p-1 border border-outline-variant/20">
            {(["week", "month", "year"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={`px-4 py-2 rounded-full font-label-md text-label-md text-sm transition-all ${
                  period === item ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {item === "week" ? t("Tuần", "Week") : item === "month" ? t("Tháng", "Month") : t("Năm", "Year")}
              </button>
            ))}
          </div>
          <button
            onClick={() => void loadRevenue()}
            className="border border-primary text-primary px-4 py-2 rounded-full font-label-md text-label-md text-sm hover:bg-primary/5 font-bold"
          >
            {t("Làm mới", "Refresh")}
          </button>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: t("Tổng doanh thu", "Total Revenue"), value: isLoading ? t("Đang tải...", "Loading...") : dashboard ? formatCurrency(dashboard.totalRevenue) : "--", icon: "payments", color: "text-primary", bg: "bg-primary/10" },
          { label: t("Lịch hoàn thành", "Completed Bookings"), value: isLoading ? "..." : dashboard ? `${dashboard.totalCompletedBookings}` : "--", icon: "event_available", color: "text-green-600", bg: "bg-green-50" },
          { label: t("Lịch đã hủy", "Cancelled Bookings"), value: isLoading ? "..." : dashboard ? `${dashboard.totalCancelledBookings}` : "--", icon: "event_busy", color: "text-error", bg: "bg-error-container/30" },
          { label: t("Giá trị TB/lịch", "Avg Booking Value"), value: isLoading ? t("Đang tải...", "Loading...") : dashboard ? formatCurrency(dashboard.averageBookingValue ?? 0) : "--", icon: "monitoring", color: "text-secondary", bg: "bg-secondary-container/30" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl p-6 border border-outline-variant/20">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${item.bg}`}>
              <span className={`material-symbols-outlined ${item.color}`} style={{ fontSize: 20 }}>{item.icon}</span>
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 text-xs">{item.label}</p>
            <p className={`font-headline-sm text-headline-sm font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-outline-variant/20 min-w-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              {t("Xu hướng doanh thu", "Revenue Trend")}
            </h3>
          </div>
          {isLoading ? (
            <div className="h-64 rounded-xl bg-surface-container-low animate-pulse" />
          ) : !dashboard || dashboard.trend.length === 0 ? (
            <div className="h-64 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant">
              {t("Chưa có dữ liệu doanh thu trong kỳ này", "No revenue data found for this period")}
            </div>
          ) : (
            <>
              {/* Prevent column overflow by removing min-w-8 and adding responsive gap and w-full */}
              <div className={`w-full flex items-end h-56 border-b border-outline-variant/20 pb-4 mb-4 overflow-visible ${dashboard.trend.length > 15 ? 'gap-1' : 'gap-3'}`}>
                {dashboard.trend.map((item) => {
                  const height = Math.max(4, Math.round((Number(item.revenue) / maxRevenue) * 100));
                  return (
                    <div key={item.period} className="flex-1 flex flex-col items-center justify-end group min-w-0 relative h-full">
                      {/* Premium Interactive Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-stone-900/95 text-stone-100 text-xs rounded-xl p-2.5 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-30 min-w-[140px] border border-stone-800 backdrop-blur-md translate-y-1 group-hover:translate-y-0">
                        <div className="font-bold border-b border-stone-700/50 pb-1 mb-1.5 text-stone-400">
                          {formatPeriod(item.period, period)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-3">
                            <span className="text-stone-400">{t("Doanh thu:", "Revenue:")}</span>
                            <span className="font-bold text-amber-500">{formatCurrency(item.revenue)}</span>
                          </div>
                          {item.completedBookings !== undefined && (
                            <div className="flex justify-between gap-3">
                              <span className="text-stone-400">{t("Hoàn thành:", "Completed:")}</span>
                              <span className="font-bold text-sky-400">{item.completedBookings.toLocaleString("vi-VN")}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="w-full rounded-t bg-primary/30 group-hover:bg-primary transition-all duration-300 cursor-pointer shadow-sm hover:shadow hover:-translate-y-0.5" style={{ height: `${height * 1.5}px` }} />
                    </div>
                  );
                })}
              </div>
              <div className="w-full flex justify-between gap-1 overflow-hidden font-bold">
                {dashboard.trend.map((item, idx) => {
                  const showLabel = dashboard.trend.length <= 8 || idx === 0 || idx === dashboard.trend.length - 1 || idx % 5 === 0;
                  return (
                    <span key={item.period} className="font-label-sm text-label-sm text-on-surface-variant flex-1 text-center truncate min-w-0 text-[10px]">
                      {showLabel ? formatPeriod(item.period, period) : ""}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-outline-variant/20">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-5">
            {t("Doanh thu theo chi nhánh", "Revenue by Branch")}
          </h3>
          <div className="space-y-4">
            {(dashboard?.byBranch ?? []).map((branch, index) => {
              const pct = totalBranchesRevenue > 0 ? Math.round((Number(branch.totalRevenue) / totalBranchesRevenue) * 100) : 0;
              return (
                <div key={branch.branchId}>
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-label-md text-label-md text-on-surface font-bold text-sm">{tService(branch.branchName)}</p>
                    <span className="font-label-md text-label-md text-primary font-bold text-sm">{pct}%</span>
                  </div>
                  <div className="h-2 bg-surface-container rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full ${index === 0 ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-on-surface-variant">
                    <span>{formatCurrency(branch.totalRevenue)}</span>
                    <span>{branch.completedBookings} {t("lịch hẹn", "appointments")}</span>
                  </div>
                </div>
              );
            })}
            {!isLoading && (dashboard?.byBranch.length ?? 0) === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-8">
                {t("Chưa có doanh thu theo chi nhánh.", "No branch revenue available.")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Financial table */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            {t("Bảng chi tiết chi nhánh", "Branch Details Table")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low">
              <tr>
                {[
                  t("Chi nhánh", "Branch"),
                  t("Doanh thu", "Revenue"),
                  t("Hoàn thành", "Completed"),
                  t("Đã hủy", "Cancelled"),
                  t("Giá trị TB", "Avg Value"),
                ].map((heading) => (
                  <th key={heading} className="px-5 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider whitespace-nowrap">{heading}</th>
                ))}
                <th className="px-5 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-on-surface-variant animate-pulse font-medium">
                    {t("Đang tải dữ liệu chi nhánh...", "Loading branch data...")}
                  </td>
                </tr>
              ) : !dashboard || dashboard.byBranch.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-on-surface-variant font-medium">
                    {t("Không có dữ liệu chi nhánh.", "No branch data available.")}
                  </td>
                </tr>
              ) : (
                dashboard.byBranch.map((row) => (
                  <tr key={row.branchId} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="px-5 py-4 font-label-md text-label-md text-on-surface font-bold text-sm">
                      {tService(row.branchName)}
                    </td>
                    <td className="px-5 py-4 font-label-sm text-label-sm text-on-surface">
                      {formatCurrency(row.totalRevenue)}
                    </td>
                    <td className="px-5 py-4 font-label-sm text-label-sm text-green-600 font-bold">
                      {row.completedBookings.toLocaleString("vi-VN")} {t("lịch hẹn", "bookings")}
                    </td>
                    <td className="px-5 py-4 font-label-sm text-label-sm text-error font-medium">
                      {row.cancelledBookings.toLocaleString("vi-VN")} {t("lịch hẹn", "bookings")}
                    </td>
                    <td className="px-5 py-4 font-label-md text-label-md text-primary font-bold">
                      {formatCurrency(row.averageBookingValue ?? 0)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap uppercase">
                        {t("ĐÃ ĐỐI SOÁT", "RECONCILED")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
