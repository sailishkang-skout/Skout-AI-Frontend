import { useApiFetch } from "./api-client";
import type { AppNotification } from "@/types/api";

interface ListEnvelope<T> {
  data: T[];
  total: number;
}

export function useNotificationsApi() {
  const fetchApi = useApiFetch();

  return {
    list: (opts?: { unreadOnly?: boolean; type?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (opts?.unreadOnly) params.set("unreadOnly", "true");
      if (opts?.type) params.set("type", opts.type);
      if (opts?.limit) params.set("limit", String(opts.limit));
      const qs = params.toString();
      return fetchApi<ListEnvelope<AppNotification>>(`/api/v1/notifications${qs ? `?${qs}` : ""}`);
    },

    unreadCount: () => fetchApi<{ count: number }>("/api/v1/notifications/unread-count"),

    markRead: (id: string) =>
      fetchApi<AppNotification>(`/api/v1/notifications/${id}/read`, { method: "POST" }),

    markAllRead: () =>
      fetchApi<{ marked: number }>("/api/v1/notifications/mark-all-read", { method: "POST" }),
  };
}
