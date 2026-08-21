import { useCrmServiceFetch } from "../crm-api-client";
import type { CrmListEnvelope, Meeting, MeetingInput, MeetingInvitee, MeetingPatch } from "@/types/crm";

export interface GoogleCalendarEvent {
  googleEventId: string;
  title: string;
  start: string;
  end: string;
  hangoutLink: string | null;
  htmlLink: string | null;
  organizerSelf: boolean;
}

export function useMeetingsApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    getBotConfig: () => fetchApi<{ enabled: boolean }>("/api/v1/meetings/bot-config"),

    list: (params?: {
      limit?: number;
      offset?: number;
      dealId?: string;
      contactId?: string;
      companyId?: string;
      /** Calendar view — inclusive range on scheduledAt (ISO datetime). */
      from?: string;
      to?: string;
    }) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.offset !== undefined) query.set("offset", String(params.offset));
      if (params?.dealId) query.set("dealId", params.dealId);
      if (params?.contactId) query.set("contactId", params.contactId);
      if (params?.companyId) query.set("companyId", params.companyId);
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      const qs = query.toString();
      return fetchApi<CrmListEnvelope<Meeting>>(`/api/v1/meetings${qs ? `?${qs}` : ""}`);
    },

    get: (id: string) => fetchApi<Meeting>(`/api/v1/meetings/${id}`),

    create: (input: MeetingInput) =>
      fetchApi<Meeting>("/api/v1/meetings", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, patch: MeetingPatch) =>
      fetchApi<Meeting>(`/api/v1/meetings/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

    remove: (id: string) => fetchApi<void>(`/api/v1/meetings/${id}`, { method: "DELETE" }),

    /** R16.2 — schedule a meeting-bot join. Requires meetingUrl to already be set. */
    scheduleBot: (id: string) => fetchApi<Meeting>(`/api/v1/meetings/${id}/schedule-bot`, { method: "POST" }),

    /** Creates a real Google Calendar event with a Meet link; Google emails every invitee its own native invite. */
    scheduleGoogle: (id: string, invitees?: MeetingInvitee[]) =>
      fetchApi<Meeting>(`/api/v1/meetings/${id}/schedule-google`, {
        method: "POST",
        body: JSON.stringify(invitees ? { invitees } : {}),
      }),

    /** Everything on the current user's connected Google Calendar in range — for the calendar
     * view to overlay alongside native meetings, including events created outside Skout. */
    listGoogleEvents: (from: string, to: string) =>
      fetchApi<{ data: GoogleCalendarEvent[]; connected: boolean }>(
        `/api/v1/meetings/google-events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
  };
}
