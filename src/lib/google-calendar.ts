import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";

export interface CalendarConnectionStatus {
  connected: boolean;
  connectedEmail: string | null;
}

/**
 * Google Calendar connect/status/disconnect — lives on the main API (apps/api), not the
 * CRM microservice (meetings live there, the OAuth connection itself doesn't).
 */
export function useGoogleCalendarApi() {
  const fetchApi = useApiFetch();
  return {
    /** Returns the Google consent URL; caller navigates the browser there itself (window.location.href). */
    getConnectUrl: () => fetchApi<{ url: string }>("/api/v1/calendar/connect/google", { workspaceId: WORKSPACE_ID }),

    getStatus: () => fetchApi<CalendarConnectionStatus>("/api/v1/calendar/connection", { workspaceId: WORKSPACE_ID }),

    disconnect: () =>
      fetchApi<void>("/api/v1/calendar/connection", { method: "DELETE", workspaceId: WORKSPACE_ID }),
  };
}
