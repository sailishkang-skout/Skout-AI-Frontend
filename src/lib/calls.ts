import { useApiFetch } from "./api-client";
import type { CallConfig, DialCallResult } from "@/types/api";

/** R20.2 — click-to-call. Backend: apps/api/src/routes/call.routes.ts. */
export function useCallsApi() {
  const fetchApi = useApiFetch();
  return {
    getConfig: () => fetchApi<{ data: CallConfig }>("/api/v1/calls/config"),

    dial: (input: { to?: string; prospectId?: string; taskId?: string; contactId?: string }) =>
      fetchApi<{ data: DialCallResult }>("/api/v1/calls/dial", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    setMyPhone: (phone: string | null) =>
      fetchApi<{ data: { phone: string | null } }>("/api/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ phone }),
      }),
  };
}
