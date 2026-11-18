"use client";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { staffService } from "@/lib/services/staff.service";

const NAV = [
  { label: "Lịch trình & Phòng", href: "/staff", icon: "calendar_view_day" },
  { label: "Khách vãng lai", href: "/staff/walkin", icon: "person_add" },
  { label: "Khách hàng hôm nay", href: "/staff/customers", icon: "group" },
  { label: "Hồ sơ sức khỏe", href: "/staff/health", icon: "medical_information" },
  { label: "Tư vấn trực tuyến", href: "/staff/consult", icon: "chat" },
  { label: "Đăng ký lịch làm", href: "/staff/schedule", icon: "edit_calendar" },
  { label: "Tạo hóa đơn", href: "/staff/invoice", icon: "receipt_long" },
  { label: "Kho vật tư", href: "/staff/inventory", icon: "inventory_2" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const [consultBadge, setConsultBadge] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadOpenConversations = async () => {
      try {
        const list = await staffService.getConversations("open");
        if (isMounted) {
          setConsultBadge(list.length);
        }
      } catch {
        if (isMounted) {
          setConsultBadge(0);
        }
      }
    };

    void loadOpenConversations();
    const interval = window.setInterval(loadOpenConversations, 5000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const navItems = useMemo(
    () =>
      NAV.map((item) =>
        item.href === "/staff/consult" && consultBadge > 0
          ? { ...item, badge: consultBadge }
          : item
      ),
    [consultBadge]
  );

  return <DashboardLayout navItems={navItems} title="Nhân viên">{children}</DashboardLayout>;
}
