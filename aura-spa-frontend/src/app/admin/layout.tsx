"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { label: "Tổng quan", href: "/admin", icon: "dashboard" },
  { label: "Doanh thu", href: "/admin/revenue", icon: "bar_chart" },
  { label: "Xếp hạng hiệu suất", href: "/admin/rankings", icon: "leaderboard" },
  { label: "Quản lý chi nhánh", href: "/admin/branches", icon: "storefront" },
  { label: "Phân quyền Manager", href: "/admin/managers", icon: "badge" },
  { label: "Danh mục dịch vụ", href: "/admin/services", icon: "spa" },
  { label: "Khuyến mãi", href: "/admin/promotions", icon: "sell" },
  { label: "Nhật ký thông báo", href: "/admin/notifications", icon: "notifications" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/login");
    }
  }, [isAdmin, isLoading, router]);

  if (isLoading || !isAdmin) return null;

  return <DashboardLayout navItems={NAV} title="HQ Command Center">{children}</DashboardLayout>;
}
