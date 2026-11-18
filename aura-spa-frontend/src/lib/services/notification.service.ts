import { api } from "@/lib/api";

export interface AppNotification {
  id: string;
  recipientUserId: string | null;
  recipientRole: string | null;
  notificationType: string;
  message: string;
  status: "pending" | "sent" | "failed";
  channel: "email" | "sms" | "both" | "in_app";
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export const notificationService = {
  getAll: () => api.get<AppNotification[]>("/notifications"),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`, {}),
};
