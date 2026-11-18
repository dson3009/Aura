"use client";

import { useCallback, useEffect, useState } from "react";
import { adminService } from "@/lib/services/admin.service";
import { formatCurrency } from "@/lib/mock-data";
import { useLanguage } from "@/context/LanguageContext";

type Period = "month" | "quarter" | "year";

interface StaffRanking {
  rank: number;
  staffId: string;
  staffName: string;
  completedServices: number;
  averageRating: number | null;
  reviewCount: number;
  revenueGenerated: number;
}

interface ServiceRanking {
  rank: number;
  serviceId: string;
  serviceName: string;
  category: string | null;
  bookingCount: number;
  totalRevenue: number;
}

interface BranchRanking {
  rank: number;
  branchId: string;
  branchName: string;
  totalRevenue: number;
  completedBookings: number;
  cancelledBookings: number;
  averageBookingValue: number | null;
}

function getRange(period: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);

  if (period === "quarter") {
    from.setMonth(to.getMonth() - 3);
  } else if (period === "year") {
    from.setFullYear(to.getFullYear() - 1);
  } else {
    from.setDate(to.getDate() - 30);
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

function rankLabel(rank: number): string {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return `#${rank}`;
}

export default function AdminRankings() {
  const { language, tService } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const [period, setPeriod] = useState<Period>("month");
  const [staffRankings, setStaffRankings] = useState<StaffRanking[]>([]);
  const [serviceRankings, setServiceRankings] = useState<ServiceRanking[]>([]);
  const [branchRankings, setBranchRankings] = useState<BranchRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRankings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const { from, to } = getRange(period);
      const [staff, services, branches] = await Promise.allSettled([
        adminService.getStaffRankings(from, to, 10),
        adminService.getServiceRankings(from, to, 10),
        adminService.getBranchRankings(from, to, 10),
      ]);

      setStaffRankings(staff.status === "fulfilled" ? staff.value.rankings : []);
      setServiceRankings(services.status === "fulfilled" ? services.value.rankings : []);
      setBranchRankings(branches.status === "fulfilled" ? branches.value.rankings : []);

      if ([staff, services, branches].some((result) => result.status === "rejected")) {
        setError(t("Một số bảng xếp hạng chưa được cập nhật. Vui lòng thử lại sau.", "Some rankings could not be updated. Please try again later."));
      }
    } catch {
      setError(t("Chưa thể tải bảng xếp hạng hiệu suất. Vui lòng thử lại sau.", "Unable to load performance rankings. Please try again later."));
    } finally {
      setIsLoading(false);
    }
  }, [period, language]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadRankings(), 0);
    return () => window.clearTimeout(id);
  }, [loadRankings]);

  return (
    <div className="p-6 max-w-container-max mx-auto space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t("Xếp hạng hiệu suất", "Performance Rankings")}
          </h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mt-1">
            {t("Xếp hạng theo lịch hẹn đã hoàn thành", "Ranked by completed appointments")}
          </p>
        </div>
        <div className="flex bg-surface-container rounded-full p-1 border border-outline-variant/20 w-fit">
          {(["month", "quarter", "year"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`px-4 py-2 rounded-full font-label-md text-label-md text-sm transition-all ${
                period === item ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {item === "month" ? t("Tháng", "Month") : item === "quarter" ? t("Quý", "Quarter") : t("Năm", "Year")}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error-container bg-error-container/30 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Staff */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              {t("Nhân viên xuất sắc", "Outstanding Staff")}
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="h-40 rounded-xl bg-surface-container-low animate-pulse" />
            ) : staffRankings.length === 0 ? (
              <p className="text-center py-8 text-on-surface-variant font-label-md text-label-md">
                {t("Chưa có nhân viên đủ dữ liệu xếp hạng.", "No staff with sufficient data for rankings.")}
              </p>
            ) : (
              staffRankings.map((staff) => (
                <div key={staff.staffId} className={`flex items-center gap-3 p-3 rounded-xl ${staff.rank === 1 ? "bg-secondary-container/20 border border-secondary-container" : "hover:bg-surface-container-low"}`}>
                  <span className="text-xl w-8 text-center font-bold text-primary">{rankLabel(staff.rank)}</span>
                  <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs shrink-0">
                    {staff.staffName.split(" ").pop()?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface font-bold truncate">{staff.staffName}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant text-xs">{t("Số ca hoàn thành: ", "Completed shifts: ")}{staff.completedServices}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-label-md text-label-md text-primary font-bold">{staff.averageRating ? `${Number(staff.averageRating).toFixed(1)} ⭐` : "--"}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{t("Doanh thu: ", "Rev: ")}{formatCurrency(staff.revenueGenerated)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Services */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>spa</span>
              {t("Dịch vụ phổ biến nhất", "Most Popular Services")}
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="h-40 rounded-xl bg-surface-container-low animate-pulse" />
            ) : serviceRankings.length === 0 ? (
              <p className="text-center py-8 text-on-surface-variant font-label-md text-label-md">
                {t("Chưa có dịch vụ đủ dữ liệu xếp hạng.", "No services with sufficient data for rankings.")}
              </p>
            ) : (
              serviceRankings.map((service) => (
                <div key={service.serviceId} className={`flex items-center gap-3 p-3 rounded-xl ${service.rank === 1 ? "bg-primary/5 border border-primary/20" : "hover:bg-surface-container-low"}`}>
                  <span className="text-xl w-8 text-center font-bold text-primary">{rankLabel(service.rank)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface font-bold text-sm leading-tight">{tService(service.serviceName)}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant text-xs">{service.category ? tService(service.category) : t("Dịch vụ", "Service")} · {formatCurrency(service.totalRevenue)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-label-md text-label-md text-primary font-bold">{service.bookingCount}</p>
                    <p className="text-xs text-on-surface-variant">{t("lượt đặt", "bookings")}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Branches */}
        <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container-low">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>storefront</span>
              {t("Chi nhánh dẫn đầu", "Leading Branches")}
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="h-40 rounded-xl bg-surface-container-low animate-pulse" />
            ) : branchRankings.length === 0 ? (
              <p className="text-center py-8 text-on-surface-variant font-label-md text-label-md">
                {t("Chưa có chi nhánh đủ dữ liệu xếp hạng.", "No branches with sufficient data for rankings.")}
              </p>
            ) : (
              branchRankings.map((branch) => (
                <div key={branch.branchId} className={`flex items-center gap-3 p-3 rounded-xl ${branch.rank === 1 ? "bg-surface-container-high border border-outline-variant" : "hover:bg-surface-container-low"}`}>
                  <span className="text-xl w-8 text-center font-bold text-primary">{rankLabel(branch.rank)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface font-bold text-sm">{tService(branch.branchName)}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{branch.completedBookings} {t("hoàn thành", "completed")} · {branch.cancelledBookings} {t("hủy", "cancelled")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-label-md text-label-md text-primary font-bold text-sm">{formatCurrency(branch.totalRevenue)}</p>
                    <p className="text-xs text-on-surface-variant">{t("TB: ", "Avg: ")}{formatCurrency(branch.averageBookingValue ?? 0)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Note */}
      <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
        {t(
          "* Xếp hạng dựa trên dữ liệu booking đã hoàn thành, doanh thu đã ghi nhận và đánh giá đã công khai.",
          "* Rankings are based on completed booking data, recognized revenue, and published reviews."
        )}
      </p>
    </div>
  );
}
