import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";

export interface CalendarConnectionStatus {
  connected: boolean;
  connectedEmail: string | null;
}

export interface GoogleCalendarEvent {
  googleEventId: string;
  title: string;
  start: string;
  end: string;
  hangoutLink: string | null;
  htmlLink: string | null;
  organizerSelf: boolean;
}

/**
 * Google Calendar connect/status/events — lives on the main API (apps/api), not the
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

    listEvents: (from: string, to: string) =>
      fetchApi<{ data: GoogleCalendarEvent[]; connected: boolean; error?: string }>(
        `/api/v1/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { workspaceId: WORKSPACE_ID }
      ),
  };
}
