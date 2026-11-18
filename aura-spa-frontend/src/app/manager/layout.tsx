"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { managerService } from "@/lib/services/manager.service";
import { staffService } from "@/lib/services/staff.service";

const BASE_NAV = [
  { label: "Tổng quan", href: "/manager", icon: "dashboard" },
  { label: "Lịch hẹn", href: "/manager/bookings", icon: "event_note" },
  { label: "Quản lý nhân viên", href: "/manager/staff", icon: "badge" },
  { label: "Phân công ca làm", href: "/manager/shifts", icon: "calendar_month" },
  { label: "Phân công lại KTV", href: "/manager/reassign", icon: "swap_horiz" },
  { label: "Cấu hình đặt lịch", href: "/manager/slots", icon: "tune" },
  { label: "Khiếu nại", href: "/manager/complaints", icon: "report", badge: 0 },
  { label: "Tư vấn trực tuyến", href: "/manager/consult", icon: "chat", badge: 0 },
  { label: "Tồn kho", href: "/manager/inventory", icon: "inventory" },
  { label: "Báo cáo hiệu suất", href: "/manager/reports", icon: "bar_chart" },
];

interface StatusRecord {
  status?: string;
}

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [navItems, setNavItems] = useState(BASE_NAV);
  const branchId = user?.branchId || "";

  useEffect(() => {
    if (!branchId) return;

    const fetchCounts = async () => {
      try {
        const [complaintsData, consultsData] = await Promise.all([
          managerService.getComplaints(branchId).catch(() => []),
          staffService.getConversations().catch(() => []),
        ]);

        const pendingComplaints = (complaintsData || []).filter(
          (c: StatusRecord) => c.status === "open" || c.status === "in_progress"
        ).length;

        const openConsults = (consultsData || []).filter(
          (c: StatusRecord) => c.status === "open"
        ).length;

        setNavItems((prev) =>
          prev.map((item) => {
            if (item.href === "/manager/complaints") {
              return { ...item, badge: pendingComplaints };
            }
            if (item.href === "/manager/consult") {
              return { ...item, badge: openConsults };
            }
            return item;
          })
        );
      } catch (err) {
        console.error("Failed to load badge counts:", err);
      }
    };

    // Initial fetch
    fetchCounts();

    // Poll every 5 seconds
    const interval = setInterval(fetchCounts, 5000);
    return () => clearInterval(interval);
  }, [branchId]);

  return <DashboardLayout navItems={navItems} title="Quản lý chi nhánh">{children}</DashboardLayout>;
}
