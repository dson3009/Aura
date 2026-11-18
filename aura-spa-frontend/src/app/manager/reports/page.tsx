"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { managerService } from "@/lib/services/manager.service";
import { formatCurrency } from "@/lib/mock-data";

function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

export default function ManagerReports() {
  const { user } = useAuth();
  const [branchId, setBranchId] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMockData, setIsMockData] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5);
      d.setDate(1);
      return d.toISOString().split("T")[0];
    })(),
    to: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    setBranchId(user?.branchId || "");
  }, [user]);

  const loadReports = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    setError("");
    setIsMockData(false);
    try {
      const [perfData, staffData] = await Promise.all([
        managerService.getBranchPerformance(branchId, dateRange.from, dateRange.to),
        managerService.getStaff(branchId),
      ]);
      setReportData(perfData);
      setStaffList(staffData || []);
    } catch (err) {
      console.error(err);
      setIsMockData(true);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, dateRange]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadReports(), 0);
    return () => window.clearTimeout(id);
  }, [loadReports]);

  // Derived metrics with fallbacks
  const totalRevenue = useMemo(() => {
    return toNumber(reportData?.revenue?.totalRevenue ?? reportData?.totalRevenue ?? 125000000);
  }, [reportData]);

  const totalCompleted = useMemo(() => {
    return toNumber(reportData?.revenue?.completedBookings ?? reportData?.totalCompletedBookings ?? 186);
  }, [reportData]);

  const averageValue = useMemo(() => {
    return toNumber(reportData?.revenue?.averageBookingValue ?? reportData?.averageBookingValue ?? 672000);
  }, [reportData]);

  const trendData = useMemo(() => {
    if (reportData?.trend && Array.isArray(reportData.trend) && reportData.trend.length > 0) {
      return reportData.trend.map((t: any) => {
        const d = new Date(t.period);
        const label = isNaN(d.getTime()) ? t.period : `Tháng ${d.getMonth() + 1}`;
        return {
          period: label,
          revenue: toNumber(t.revenue),
        };
      });
    }
    return [
      { period: "Tháng 1", revenue: 18000000 },
      { period: "Tháng 2", revenue: 22000000 },
      { period: "Tháng 3", revenue: 20000000 },
      { period: "Tháng 4", revenue: 28000000 },
      { period: "Tháng 5", revenue: 32000000 },
      { period: "Tháng 6", revenue: 35000000 },
    ];
  }, [reportData]);

  // Calculate SVG line/area points for the revenue trend
  const chartHeight = 220;
  const chartWidth = 600;
  const maxRevenue = Math.max(...trendData.map((t: any) => toNumber(t.revenue)), 1000000);

  const points = useMemo(() => {
    return trendData.map((t: any, index: number) => {
      const divisor = trendData.length > 1 ? trendData.length - 1 : 1;
      const x = trendData.length > 1 ? (index / divisor) * (chartWidth - 80) + 40 : chartWidth / 2;
      const y = chartHeight - (toNumber(t.revenue) / maxRevenue) * (chartHeight - 65) - 35;
      return { x, y, label: t.period, value: toNumber(t.revenue) };
    });
  }, [trendData, maxRevenue]);

  const linePath = useMemo(() => points.map((p: any) => `${p.x},${p.y}`).join(" "), [points]);
  
  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    return `M ${points[0].x},${chartHeight - 30} L ${linePath} L ${points[points.length - 1].x},${chartHeight - 30} Z`;
  }, [points, linePath]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">Báo cáo hiệu suất chi nhánh</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Theo dõi chi tiết các chỉ số tài chính, số lượng lịch hẹn và bảng xếp hạng hiệu suất nhân sự.
          </p>
        </div>
        
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            className="border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-primary"
          />
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            className="border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-primary"
          />
          <button
            onClick={() => void loadReports()}
            className="bg-primary text-on-primary px-4 py-2 rounded-full font-label-md text-label-md text-xs hover:opacity-90 transition-opacity font-bold"
          >
            Lọc
          </button>
        </div>
      </div>

      {isMockData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2.5 text-sm text-amber-800">
          <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5" style={{ fontSize: 18 }}>science</span>
          <div>
            <span className="font-bold">Dữ liệu minh họa</span>
            <span className="text-amber-700"> — Không thể kết nối backend. Các số liệu bên dưới là mẫu, không phản ánh dữ liệu thực tế.</span>
          </div>
        </div>
      )}

      {/* KPI summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Doanh thu giai đoạn", value: formatCurrency(totalRevenue), icon: "monetization_on", color: "text-primary" },
          { label: "Giá trị đơn trung bình", value: formatCurrency(averageValue), icon: "shopping_bag", color: "text-green-600" },
          { label: "Số lượng lịch hoàn thành", value: `${totalCompleted.toLocaleString("vi-VN")} đơn`, icon: "check_circle", color: "text-secondary" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className={`material-symbols-outlined ${k.color}`} style={{ fontSize: 24 }}>{k.icon}</span>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold text-xs">{k.label}</p>
            </div>
            <p className={`font-headline-md text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Xu hướng doanh thu</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Biểu đồ doanh thu chi tiết các tháng gần nhất</p>
          </div>
          <span className="font-label-sm text-label-sm text-primary font-bold bg-primary/10 px-3 py-1 rounded-full text-xs">
            Chi nhánh #{branchId}
          </span>
        </div>

        {/* Beautiful Custom SVG Line Chart */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px] h-[250px] relative">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--md-sys-color-primary, #6750A4)" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="var(--md-sys-color-primary, #6750A4)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              
              {/* Grid Lines */}
              <line x1="40" y1={chartHeight - 30} x2={chartWidth - 40} y2={chartHeight - 30} stroke="#E5E7EB" strokeWidth="1" />
              <line x1="40" y1={chartHeight - 85} x2={chartWidth - 40} y2={chartHeight - 85} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1={chartHeight - 140} x2={chartWidth - 40} y2={chartHeight - 140} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1={chartHeight - 195} x2={chartWidth - 40} y2={chartHeight - 195} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4 4" />

              {/* Area path */}
              {areaPath && <path d={areaPath} fill="url(#chartGrad)" />}

              {/* Line path */}
              {linePath && <path d={`M ${points[0].x},${points[0].y} L ${linePath}`} fill="none" stroke="var(--md-sys-color-primary, #6750A4)" strokeWidth="3" strokeLinecap="round" />}

              {/* Points markers and labels */}
              {points.map((p: any, idx: number) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="white"
                    stroke="var(--md-sys-color-primary, #6750A4)"
                    strokeWidth="2"
                    className="hover:r-7 transition-all cursor-pointer"
                  />
                  {/* Tooltip value */}
                  <text
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    className="text-[10px] font-bold fill-primary font-sans"
                  >
                    {formatCurrency(p.value).replace("đ", "")}
                  </text>
                  {/* Month Label */}
                  <text
                    x={p.x}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="text-[10px] fill-gray-500 font-bold font-sans"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Staff performance table */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Xếp hạng hiệu suất kỹ thuật viên</h3>
          <span className="text-xs text-on-surface-variant font-bold">{staffList.length} nhân sự</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low">
              <tr>
                {["Nhân viên", "Chuyên môn", "Trạng thái", "Đánh giá", "Hành động"].map((h) => (
                  <th key={h} className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {staffList.map((s, idx) => {
                const name = s.user?.fullName ?? s.fullName ?? "Kỹ thuật viên";
                const role = s.position ?? s.role ?? s.user?.role ?? "technician";
                const rating = s.rating ?? s.user?.rating ?? 4.8;
                const status = s.status ?? s.user?.status ?? "active";

                return (
                  <tr key={s.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx === 0 ? "bg-amber-100 text-amber-800" : "bg-surface-container text-on-surface-variant"
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-label-md text-label-md text-on-surface font-bold text-sm">{name}</p>
                          <p className="text-xs text-on-surface-variant uppercase">{role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant text-xs">
                      {s.specialization ?? "Massage & Skincare"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        status === "active" ? "bg-green-50 text-green-700" : "bg-error-container text-error"
                      }`}>
                        {status === "active" ? "Đang hoạt động" : "Tạm ngưng"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-secondary" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="font-label-md text-label-md text-on-surface font-bold text-xs">{rating}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {idx === 0 && (
                        <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          ⭐ Xuất sắc
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
