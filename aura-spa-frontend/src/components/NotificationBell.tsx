"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { io } from "socket.io-client";
import { notificationService } from "@/lib/services/notification.service";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface NotificationItem {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  notificationType: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
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

export default function NotificationBell() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) return;

    notificationService
      .getAll()
      .then((data) => setNotifications(data as NotificationItem[]))
      .catch((err) => console.error("Error fetching customer notifications:", err));
  }, []);

  // Set up WebSocket connection for real-time notifications
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

  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  const markAllRead = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) return;

    const unread = notifications.filter((n) => n.readAt === null);
    unread.forEach((n) => {
      notificationService.markRead(n.id).catch(() => {});
    });

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    // Mark as read
    if (notif.readAt === null) {
      notificationService.markRead(notif.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notif.id ? { ...item, readAt: new Date().toISOString() } : item
        )
      );
    }

    setOpen(false);

    // Route based on role and type
    if (user?.role === "customer") {
      if (
        notif.notificationType?.startsWith("complaint_") ||
        notif.relatedEntityType === "complaint"
      ) {
        router.push("/customer/complaints");
      } else {
        router.push("/customer/bookings");
      }
    } else if (user?.role === "manager") {
      if (notif.relatedEntityType === "inventory_item") {
        router.push("/manager/inventory");
      } else if (notif.relatedEntityType === "booking" && notif.relatedEntityId) {
        router.push(`/manager/bookings?bookingId=${encodeURIComponent(notif.relatedEntityId)}`);
      } else if (notif.relatedEntityType === "complaint") {
        router.push("/manager/complaints");
      } else {
        router.push("/manager");
      }
    } else if (user?.role === "staff") {
      if (notif.relatedEntityType === "booking" && notif.relatedEntityId) {
        router.push(`/staff?bookingId=${encodeURIComponent(notif.relatedEntityId)}`);
      } else {
        router.push("/staff");
      }
    } else {
      router.push("/");
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors cursor-pointer"
        aria-label="Thông báo"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error shadow-sm scale-90">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] bg-white border border-outline-variant/30 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
              {t("Thông báo", "Notifications")}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-primary hover:underline font-bold"
              >
                {t("Đánh dấu đã đọc", "Mark all as read")}
              </button>
            )}
          </div>

          <div className="divide-y divide-outline-variant/10 overflow-y-auto max-h-[300px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl opacity-40 block mb-2">
                  notifications_active
                </span>
                <p className="text-xs">{t("Không có thông báo nào", "No notifications yet")}</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notif)}
                  className={`block w-full text-left p-4 hover:bg-surface-container-lowest transition-colors cursor-pointer text-xs ${
                    notif.readAt === null ? "bg-primary/5 font-semibold text-on-surface" : "text-on-surface-variant"
                  }`}
                >
                  <p className="leading-normal">{notif.message}</p>
                  <span className="text-[10px] opacity-75 block mt-1">
                    {formatNotifTime(notif.createdAt, language)}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="p-3 bg-surface-container-low border-t border-outline-variant/10 text-center">
            <Link
              href="/customer/bookings"
              onClick={() => setOpen(false)}
              className="text-xs text-primary font-bold hover:underline"
            >
              {t("Xem lịch hẹn của tôi", "View my bookings")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
