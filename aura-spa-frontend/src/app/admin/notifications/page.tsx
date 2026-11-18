"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { notificationService, type AppNotification } from "@/lib/services/notification.service";

export default function AdminNotifications() {
  const { language } = useLanguage();
  const t = (vi: string, en: string) => (language === "en" ? en : vi);

  const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    booking_confirmed: { icon: "event_available", color: "text-green-600 bg-green-50", label: t("Xác nhận lịch hẹn", "Confirm Booking") },
    booking_cancelled: { icon: "event_busy", color: "text-error bg-error-container/50", label: t("Hủy lịch hẹn", "Cancel Booking") },
    booking_rescheduled: { icon: "event_repeat", color: "text-blue-600 bg-blue-50", label: t("Đổi lịch hẹn", "Reschedule Booking") },
    checkin: { icon: "login", color: "text-primary bg-primary/10", label: t("Check-in", "Check-in") },
    schedule_change: { icon: "calendar_month", color: "text-secondary bg-secondary-container/30", label: t("Thay đổi lịch", "Schedule Change") },
    low_inventory: { icon: "warning", color: "text-error bg-error-container/50", label: t("Tồn kho thấp", "Low Inventory") },
    review: { icon: "star", color: "text-secondary bg-secondary-container/30", label: t("Đánh giá mới", "New Review") },
    complaint: { icon: "report", color: "text-error bg-error-container/50", label: t("Khiếu nại", "Complaint") },
  };

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  useEffect(() => {
    notificationService.getAll()
      .then(setNotifications)
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = notifications.filter((n) => {
    const matchType = filter === "all" || n.notificationType === filter || n.status === filter;
    const matchChannel = channelFilter === "all" || n.channel === channelFilter;
    return matchType && matchChannel;
  });

  const handleMarkRead = async (id: string) => {
    await notificationService.markRead(id);
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  };

  const stats = {
    total: notifications.length,
    sent: notifications.filter((n) => n.status === "sent").length,
    failed: notifications.filter((n) => n.status === "failed").length,
    pending: notifications.filter((n) => n.status === "pending").length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t("Trung tâm thông báo", "Notification Center")}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t("Theo dõi tất cả thông báo tự động gửi đi từ hệ thống", "Track all automated notifications sent by the system")}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: t("Tổng", "Total"), value: stats.total, color: "text-on-surface" },
          { label: t("Đã gửi", "Sent"), value: stats.sent, color: "text-green-600" },
          { label: t("Thất bại", "Failed"), value: stats.failed, color: "text-error" },
          { label: t("Đang chờ", "Pending"), value: stats.pending, color: "text-secondary" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-outline-variant/20 text-center">
            <p className={`font-headline-sm text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "all", label: t("Tất cả", "All") },
            { key: "sent", label: t("✓ Đã gửi", "✓ Sent") },
            { key: "failed", label: t("✗ Thất bại", "✗ Failed") },
            { key: "pending", label: t("⏳ Chờ gửi", "⏳ Pending") },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm text-sm transition-all ${filter === f.key ? "bg-primary text-on-primary" : "border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {["all", "email", "sms", "both"].map((c) => (
            <button key={c} onClick={() => setChannelFilter(c)}
              className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm text-sm transition-all ${channelFilter === c ? "bg-secondary text-on-secondary" : "border border-outline-variant text-on-surface-variant hover:border-secondary hover:text-secondary"}`}>
              {c === "all" ? t("Tất cả kênh", "All channels") : c === "email" ? t("📧 Email", "📧 Email") : c === "sms" ? t("📱 SMS", "📱 SMS") : t("📧+📱 Cả hai", "📧+📱 Both")}
            </button>
          ))}
        </div>
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-2 block">progress_activity</span>
          <p className="font-label-md text-label-md">{t("Đang tải...", "Loading...")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const cfg = TYPE_CONFIG[n.notificationType] ?? { icon: "notifications", color: "text-on-surface-variant bg-surface-container", label: n.notificationType };
            const timeStr = n.sentAt ?? n.createdAt;
            const displayTime = timeStr ? new Date(timeStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
            const isRead = !!n.readAt;
            return (
              <div key={n.id} className={`bg-white rounded-xl p-4 border ${n.status === "failed" ? "border-error/30" : isRead ? "border-outline-variant/10 opacity-70" : "border-outline-variant/20"}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{cfg.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        {n.recipientRole && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.recipientRole === "customer" ? "bg-primary/10 text-primary" : n.recipientRole === "staff" ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-fixed text-on-tertiary-fixed"}`}>
                            {n.recipientRole === "customer" ? t("Khách hàng", "Customer") : n.recipientRole === "staff" ? t("Nhân viên", "Staff") : t("Quản lý", "Manager")}
                          </span>
                        )}
                        <span className="text-xs text-on-surface-variant">
                          {n.channel === "email" ? "📧" : n.channel === "sms" ? "📱" : n.channel === "both" ? "📧+📱" : "🔔"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n.status === "sent" ? "bg-green-50 text-green-700" : n.status === "failed" ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container"}`}>
                          {n.status === "sent" ? t("Đã gửi", "Sent") : n.status === "failed" ? t("Thất bại", "Failed") : t("Chờ gửi", "Pending")}
                        </span>
                        <span className="text-xs text-on-surface-variant">{displayTime}</span>
                      </div>
                    </div>
                    <p className="text-sm text-on-surface-variant">{n.message}</p>
                    {!isRead && (
                      <button onClick={() => handleMarkRead(n.id)} className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5 mt-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>done</span>{t("Đánh dấu đã đọc", "Mark as read")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl p-10 border border-outline-variant/20 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl block mb-2 text-outline">notifications_off</span>
              <p className="font-label-md text-label-md">{t("Không có thông báo nào", "No notifications found")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
