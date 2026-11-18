"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { notificationService } from "@/lib/services/notification.service";
import { io, Socket } from "socket.io-client";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

interface NotificationItem {
  id: string;
  message: string;
  notificationType: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  readAt: string | null;
  createdAt: string;
}

interface Props {
  navItems: NavItem[];
  children: React.ReactNode;
  title: string;
}

const navItemTranslations: Record<string, Record<string, string>> = {
  vi: {
    "Tổng quan": "Tổng quan",
    "Doanh thu": "Doanh thu",
    "Xếp hạng hiệu suất": "Xếp hạng hiệu suất",
    "Hệ thống chi nhánh": "Chi nhánh",
    "Phân quyền quản lý": "Phân quyền",
    "Danh mục dịch vụ": "Dịch vụ",
    "Khuyến mãi": "Khuyến mãi",
    "Nhật ký thông báo": "Thông báo",
    "Tài khoản": "Tài khoản",
    "Lịch trực": "Lịch trực",
    "Đăng ký lịch làm": "Đăng ký lịch làm",
    "Lịch làm việc": "Lịch làm việc",
    "Thanh toán và hóa đơn": "Thanh toán & Hóa đơn",
    "Điều phối kỹ thuật viên": "Điều phối KTV",
    "Đăng xuất": "Đăng xuất",
    "Lịch hẹn": "Lịch hẹn",
    "Quản lý nhân viên": "Quản lý nhân viên",
    "Phân công ca làm": "Phân công ca làm",
    "Tồn kho": "Tồn kho",
    "Khiếu nại": "Khiếu nại",
    "Báo cáo": "Báo cáo",
    "Lịch hẹn hôm nay": "Lịch hẹn hôm nay",
    "Phân công lại KTV": "Điều phối KTV",
    "Cấu hình đặt lịch": "Cấu hình lịch",
    "Báo cáo hiệu suất": "Báo cáo hiệu suất",
    "Lịch trình & Phòng": "Lịch & Phòng",
    "Khách vãng lai": "Khách vãng lai",
    "Khách hàng": "Khách hàng",
    "Hồ sơ sức khỏe": "Hồ sơ sức khỏe",
    "Tư vấn trực tuyến": "Tư vấn online",
    "Tạo hóa đơn": "Tạo hóa đơn",
    "Kho vật tư": "Kho vật tư",
  },
  en: {
    "Tổng quan": "Overview",
    "Doanh thu": "Revenue",
    "Xếp hạng hiệu suất": "Rankings",
    "Hệ thống chi nhánh": "Branches",
    "Phân quyền quản lý": "Role Assignment",
    "Danh mục dịch vụ": "Services",
    "Khuyến mãi": "Promotions",
    "Nhật ký thông báo": "Notifications",
    "Tài khoản": "Account",
    "Lịch trực": "Work Schedule",
    "Đăng ký lịch làm": "Register Shift",
    "Lịch làm việc": "My Timeline",
    "Thanh toán và hóa đơn": "Invoicing & Pay",
    "Điều phối kỹ thuật viên": "Reassign KTV",
    "Đăng xuất": "Logout",
    "Lịch hẹn": "Appointments",
    "Quản lý nhân viên": "Staff Management",
    "Phân công ca làm": "Approve Shifts",
    "Tồn kho": "Inventory",
    "Khiếu nại": "Complaints",
    "Báo cáo": "Reports",
    "Lịch hẹn hôm nay": "Today's Appointments",
    "Phân công lại KTV": "Reassign KTV",
    "Cấu hình đặt lịch": "Booking Config",
    "Báo cáo hiệu suất": "Performance Reports",
    "Lịch trình & Phòng": "Schedule & Rooms",
    "Khách vãng lai": "Walk-in Customers",
    "Khách hàng": "Customers",
    "Hồ sơ sức khỏe": "Health Records",
    "Tư vấn trực tuyến": "Online Consultation",
    "Tạo hóa đơn": "Create Invoice",
    "Kho vật tư": "Supply Inventory",
  }
};

const titleTranslations: Record<string, Record<string, string>> = {
  vi: {
    "Bảng điều khiển": "Bảng điều khiển",
    "Phân công ca làm việc": "Phân công ca làm việc",
    "Phân công ca làm": "Phân công ca làm",
    "Điều phối kỹ thuật viên": "Điều phối kỹ thuật viên",
    "Xử lý phản hồi khách hàng": "Xử lý khiếu nại",
    "Báo cáo hiệu suất chi nhánh": "Báo cáo hiệu suất chi nhánh",
    "Báo cáo Chiến lược Toàn diện (Owner)": "Báo cáo Chiến lược Owner",
    "Hệ thống chi nhánh": "Hệ thống chi nhánh",
    "Danh mục dịch vụ": "Danh mục dịch vụ",
    "Quản lý khuyến mãi": "Quản lý khuyến mãi",
    "Đăng ký lịch làm việc": "Đăng ký lịch làm",
    "Thanh toán và hóa đơn": "Thanh toán và hóa đơn",
    "Quản trị hệ thống": "Quản trị hệ thống",
    "Quản lý chi nhánh": "Quản lý chi nhánh",
    "Nhân viên": "Nhân viên",
  },
  en: {
    "Bảng điều khiển": "Manager Dashboard",
    "Phân công ca làm việc": "Shift Approvals",
    "Phân công ca làm": "Shift Approvals",
    "Điều phối kỹ thuật viên": "Technician Reassignment",
    "Xử lý phản hồi khách hàng": "Complaints Center",
    "Báo cáo hiệu suất chi nhánh": "Performance Reports",
    "Báo cáo Chiến lược Toàn diện (Owner)": "Owner Strategy Report",
    "Hệ thống chi nhánh": "Spa Branches",
    "Danh mục dịch vụ": "Spa Services",
    "Quản lý khuyến mãi": "Promotions Manager",
    "Đăng ký lịch làm việc": "Schedule Registry",
    "Thanh toán và hóa đơn": "Payment Desk",
    "Quản trị hệ thống": "System Admin",
    "Quản lý chi nhánh": "Branch Manager",
    "Nhân viên": "Staff Portal",
  }
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

const BRANCH_NAME_BY_CODE: Record<string, string> = {
  "HCM-Q1": "AuraSpa - Quận 1",
  "HCM-Q7": "AuraSpa - Quận 7",
  "HAN-HK": "AuraSpa - Hoàn Kiếm",
  "HCM-TD": "AuraSpa - Thủ Đức",
  "DAN-HC": "AuraSpa - Đà Nẵng Sông Hàn",
  "DAN-MK": "AuraSpa - Biển Mỹ Khê",
  "DAN-NHS": "AuraSpa - Ngũ Hành Sơn",
};

function getBranchLabel(branchCode?: string): string | null {
  if (!branchCode) return null;
  return BRANCH_NAME_BY_CODE[branchCode] ?? branchCode;
}

function formatNotifTime(iso: string, lang: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return lang === "vi" ? "Vừa xong" : "Just now";
  if (diffMins < 60) return lang === "vi" ? `${diffMins} phút trước` : `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return lang === "vi" ? `${diffHours} giờ trước` : `${diffHours}h ago`;
  return date.toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit" });
}

export default function DashboardLayout({ navItems, children, title }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  // Multi-language state
  const { language: lang, setLanguage } = useLanguage();

  // Notifications dropdown state
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dateLabel, setDateLabel] = useState("");
  const socketRef = useRef<Socket | null>(null);

  const toggleLanguage = () => {
    setLanguage(lang === "vi" ? "en" : "vi");
  };

  useEffect(() => {
    document.documentElement.classList.add("h-full", "overflow-hidden");
    document.body.classList.add("h-full", "overflow-hidden");

    return () => {
      document.documentElement.classList.remove("h-full", "overflow-hidden");
      document.body.classList.remove("h-full", "overflow-hidden");
    };
  }, []);

  useEffect(() => {
    const dateTimer = window.setTimeout(() => {
      setDateLabel(
        new Date().toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "Asia/Ho_Chi_Minh",
        })
      );
    }, 0);

    return () => {
      window.clearTimeout(dateTimer);
    };
  }, [lang]);

  // Fetch notifications from API on mount
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) return;
    notificationService
      .getAll()
      .then((data) => setNotifications(data as NotificationItem[]))
      .catch(() => {});
  }, []);

  // WebSocket: connect and listen for real-time notifications
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) return;

    const socket = io(`${API_URL}/notifications`, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("notification", (notif: NotificationItem) => {
      setNotifications((prev) => [notif, ...prev]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSidebarOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()
    : "?";
  const accountHref = user?.role ? `/${user.role === "owner" ? "admin" : user.role}/account` : "#";

  // Translate navigation labels and title
  const translatedTitle = useMemo(() => {
    return titleTranslations[lang]?.[title] ?? title;
  }, [lang, title]);

  const translatedNavItems = useMemo(() => {
    return navItems.map((item) => ({
      ...item,
      label: navItemTranslations[lang]?.[item.label] ?? item.label,
    }));
  }, [lang, navItems]);

  const branchLabel = useMemo(() => getBranchLabel(user?.branchCode), [user?.branchCode]);

  const unreadNotifsCount = notifications.filter((n) => n.readAt === null).length;

  const markAllRead = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const unread = notifications.filter((n) => n.readAt === null);
    unread.forEach((n) => {
      if (token) {
        notificationService.markRead(n.id).catch(() => {});
      }
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  };

  const getNotificationHref = (notif: NotificationItem) => {
    if (notif.relatedEntityType === "inventory_item" && user?.role === "manager") {
      return "/manager/inventory";
    }

    if (!notif.relatedEntityId || !user?.role) return null;

    if (notif.relatedEntityType === "complaint" && user.role === "manager") {
      return `/manager/complaints?complaintId=${encodeURIComponent(notif.relatedEntityId)}`;
    }

    if (notif.relatedEntityType === "schedule_request" || notif.notificationType?.startsWith("schedule_")) {
      if (user?.role === "staff") return "/staff/schedule";
      if (user?.role === "manager") return "/manager/shifts";
    }

    if (notif.relatedEntityType !== "booking" || !notif.relatedEntityId || !user?.role) return null;
    if (user.role === "staff") return `/staff?bookingId=${encodeURIComponent(notif.relatedEntityId)}`;
    if (user.role === "manager") return `/manager/bookings?bookingId=${encodeURIComponent(notif.relatedEntityId)}`;
    if (user.role === "customer") return `/customer/bookings?bookingId=${encodeURIComponent(notif.relatedEntityId)}`;
    return null;
  };

  const openNotification = (notif: NotificationItem) => {
    if (notif.readAt === null) {
      notificationService.markRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notif.id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item
        )
      );
    }

    const href = getNotificationHref(notif);
    if (href) {
      setNotifOpen(false);
      router.push(href);
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* ── Sidebar overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-on-surface/30 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed md:relative z-50 flex flex-col h-full w-72 bg-surface border-r border-outline-variant/30 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="px-6 py-6 border-b border-outline-variant/20">
          <div className="flex items-center gap-3 mb-5">
            <span className="material-symbols-outlined text-primary text-3xl">spa</span>
            <span
              className="text-primary tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600 }}
            >
              AuraSpa
            </span>
          </div>
          {/* User card */}
          <Link
            href={accountHref}
            className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="font-label-md text-label-md text-on-surface truncate font-bold">{user?.name}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{translatedTitle}</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {translatedNavItems.map((item) => {
            const isRootPath = item.href === "/admin" || item.href === "/manager" || item.href === "/staff" || item.href === "/";
            const isActive = isRootPath 
              ? pathname === item.href 
              : (pathname === item.href || pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-full transition-all font-label-md text-label-md ${
                  isActive
                    ? "bg-primary-container text-on-primary-container font-bold"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 20, fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto bg-error text-on-error text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-outline-variant/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-full text-on-surface-variant font-label-md text-label-md hover:bg-error-container/30 hover:text-error transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
            {lang === "vi" ? "Đăng xuất" : "Logout"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className={`h-16 flex items-center justify-between px-6 border-b border-outline-variant/30 bg-surface shrink-0 transition-shadow ${
            scrolled ? "shadow-sm" : ""
          }`}
        >
          <div className="flex items-center gap-4">
            <button
              className="md:hidden text-on-surface-variant"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="hidden md:flex min-w-0 items-center gap-2 text-on-surface-variant font-label-md text-label-md">
              <span>AuraSpa</span>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              {branchLabel && (
                <>
                  <span className="max-w-[260px] truncate font-semibold text-on-surface">{branchLabel}</span>
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </>
              )}
              <span className="text-primary font-bold">{translatedTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* Date */}
            <span className="hidden lg:block font-label-sm text-label-sm text-on-surface-variant">
              {dateLabel}
            </span>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="text-xs font-bold text-on-surface-variant hover:text-primary px-2.5 py-1.5 rounded-md hover:bg-surface-container transition-colors border border-outline-variant/30 flex items-center gap-1"
              title={lang === "vi" ? "Chuyển sang tiếng Anh" : "Switch to Vietnamese"}
            >
              <span className="material-symbols-outlined text-xs" style={{ fontSize: 14 }}>language</span>
              {lang === "vi" ? "EN" : "VI"}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-error rounded-full" />
                )}
              </button>

              {/* Notifications Dropdown card */}
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-outline-variant/30 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 bg-surface-container border-b border-outline-variant/10 flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface uppercase">
                        {lang === "vi" ? "Thông báo hệ thống" : "System Notifications"}
                      </span>
                      {unreadNotifsCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[10px] text-primary hover:underline font-bold"
                        >
                          {lang === "vi" ? "Đánh dấu đã đọc" : "Mark all as read"}
                        </button>
                      )}
                    </div>
                    
                    <div className="divide-y divide-outline-variant/10 max-h-60 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-on-surface-variant text-center">
                          {lang === "vi" ? "Không có thông báo" : "No notifications"}
                        </p>
                      ) : (
                        notifications.map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => openNotification(notif)}
                            className={`block w-full text-left p-3.5 hover:bg-surface-container-lowest transition-colors cursor-pointer text-xs ${
                              notif.readAt === null ? "bg-primary/5 font-semibold" : ""
                            }`}
                          >
                            <p className="text-on-surface leading-normal">{notif.message}</p>
                            <span className="text-[9px] text-on-surface-variant block mt-1">
                              {formatNotifTime(notif.createdAt, lang)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Avatar & User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-9 h-9 rounded-full bg-primary-container hover:bg-primary-container/85 text-on-primary-container font-bold text-xs flex items-center justify-center cursor-pointer transition-all shrink-0 select-none shadow-sm hover:scale-105"
              >
                {initials}
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-outline-variant/30 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col">
                    {/* User Info Header */}
                    <div className="px-4 py-3 bg-stone-50 border-b border-outline-variant/10">
                      <p className="font-bold text-xs text-stone-900 truncate">{user?.name}</p>
                      <p className="text-[10px] text-stone-500 truncate mt-0.5">{user?.email || `${user?.role || "user"}@auraspa.vn`}</p>
                    </div>

                    {/* Actions list */}
                    <div className="p-1.5 space-y-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push(accountHref);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-stone-400 text-sm">person</span>
                        {lang === "vi" ? "Thông tin cá nhân" : "My Profile"}
                      </button>

                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          toggleLanguage();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors lg:hidden cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-stone-400 text-sm">language</span>
                        {lang === "vi" ? "Chuyển sang tiếng Anh" : "Switch to Vietnamese"}
                      </button>

                      <hr className="border-stone-100 my-1" />

                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-red-500 text-sm">logout</span>
                        {lang === "vi" ? "Đăng xuất" : "Logout"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto bg-surface-container-lowest"
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 10)}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
