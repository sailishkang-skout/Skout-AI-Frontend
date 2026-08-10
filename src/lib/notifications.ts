import { useApiFetch } from "./api-client";
import type { Notification, NotificationChannel, NotificationPreference } from "@/types/api";

/** R17.1/R17.4 — notification center API. Backend: apps/api/src/routes/notification.routes.ts. */
export function useNotificationsApi() {
  const fetchApi = useApiFetch();
  return {
    list: (opts?: { unreadOnly?: boolean; type?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (opts?.unreadOnly) params.set("unread", "true");
      if (opts?.type) params.set("type", opts.type);
      if (opts?.limit) params.set("limit", String(opts.limit));
      const qs = params.toString();
      return fetchApi<{ data: Notification[] }>(`/api/v1/notifications${qs ? `?${qs}` : ""}`);
    },

    unreadCount: () => fetchApi<{ data: { count: number } }>("/api/v1/notifications/unread-count"),

    markRead: (id: string) =>
      fetchApi<{ data: { read: boolean } }>(`/api/v1/notifications/${id}/read`, { method: "POST" }),

    markAllRead: () =>
      fetchApi<{ data: { markedRead: number } }>("/api/v1/notifications/read-all", { method: "POST" }),

    listPreferences: () => fetchApi<{ data: NotificationPreference[] }>("/api/v1/notifications/preferences"),

    setPreference: (type: string, channel: NotificationChannel) =>
      fetchApi<{ data: NotificationPreference }>("/api/v1/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ type, channel }),
      }),

    sendTest: () => fetchApi<{ data: Notification }>("/api/v1/notifications/test", { method: "POST" }),
  };
}
