import { useApiFetch } from "./api-client";
import type { Notification, NotificationChannel, NotificationPreference } from "@/types/api";

export const COPS_NOTIFICATION_ROLES = [
  "sales",
  "sales_manager",
  "cs",
  "finance",
  "legal_revops",
  "engineering",
  "product",
  "admin",
  "owner",
] as const;

export type CopsNotificationRole = (typeof COPS_NOTIFICATION_ROLES)[number];

export const COPS_NOTIFICATION_EVENT_ROUTES: ReadonlyArray<{
  eventType: string;
  label: string;
  defaultRoleKeys: readonly CopsNotificationRole[];
}> = [
  { eventType: "OpportunityQualified", label: "Opportunity qualified", defaultRoleKeys: ["sales", "sales_manager"] },
  { eventType: "ProposalSent", label: "Proposal sent", defaultRoleKeys: ["sales", "sales_manager", "legal_revops"] },
  { eventType: "ContractSent", label: "Contract sent", defaultRoleKeys: ["sales", "sales_manager", "legal_revops"] },
  { eventType: "ContractSigned", label: "Contract signed", defaultRoleKeys: ["sales", "sales_manager", "legal_revops"] },
  { eventType: "PaymentRequested", label: "Payment requested", defaultRoleKeys: ["finance"] },
  { eventType: "PaymentSucceeded", label: "Payment succeeded", defaultRoleKeys: ["finance"] },
  { eventType: "WorkspaceProvisioned", label: "Workspace provisioned", defaultRoleKeys: ["cs"] },
  { eventType: "CreditsGranted", label: "Credits granted", defaultRoleKeys: ["finance"] },
  { eventType: "WelcomeEmailSent", label: "Welcome email sent", defaultRoleKeys: ["cs"] },
  { eventType: "SequenceEnrolled", label: "Sequence enrolled", defaultRoleKeys: ["cs"] },
  { eventType: "TaskCreated", label: "Task created", defaultRoleKeys: ["cs"] },
  { eventType: "FirstLogin", label: "First login", defaultRoleKeys: ["cs"] },
  { eventType: "ActivationMilestoneCompleted", label: "Activation milestone completed", defaultRoleKeys: ["cs"] },
  { eventType: "CustomerActivated", label: "Customer activated", defaultRoleKeys: ["cs"] },
  { eventType: "TicketCreated", label: "Engineering ticket created", defaultRoleKeys: ["engineering", "cs"] },
  { eventType: "TicketEscalated", label: "Engineering ticket escalated", defaultRoleKeys: ["engineering", "cs"] },
  { eventType: "TicketResolved", label: "Engineering ticket resolved", defaultRoleKeys: ["engineering", "cs"] },
  { eventType: "LifecycleTransitioned", label: "Lifecycle transition", defaultRoleKeys: ["cs"] },
];

export interface CopsNotificationRoute {
  eventType: string;
  roleKeys: CopsNotificationRole[];
  updatedAt: string;
}

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

    listCopsRoutes: () =>
      fetchApi<{ data: CopsNotificationRoute[] }>("/api/v1/notifications/cops-routes"),

    setCopsRoute: (eventType: string, roleKeys: CopsNotificationRole[], reason: string) =>
      fetchApi<{ data: CopsNotificationRoute; request_id: string }>("/api/v1/notifications/cops-routes", {
        method: "PUT",
        body: JSON.stringify({ event_type: eventType, role_keys: roleKeys, reason }),
      }),

    resetCopsRoute: (eventType: string, reason: string) =>
      fetchApi<{ data: { eventType: string; reset: boolean }; request_id: string }>(
        `/api/v1/notifications/cops-routes/${encodeURIComponent(eventType)}`,
        { method: "DELETE", body: JSON.stringify({ reason }) }
      ),
  };
}
