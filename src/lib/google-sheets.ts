import { useApiFetch } from "./api-client";

/**
 * Your own Google account, connected to read spreadsheets (WB2-025). The API keeps the tokens; nothing here ever holds
 * one.
 */
export interface SheetsConnection {
  /** Whether the server has a Google app to connect with. */
  configured: boolean;
  status: "connected" | "needs_reauth" | "not_connected";
  connectedAt: string | null;
}

export const SHEETS_CONNECTION_KEY = ["google-sheets", "connection"] as const;

export function useGoogleSheetsApi() {
  const fetchApi = useApiFetch();
  const base = "/api/v1/google-sheets/connection";
  return {
    status: () => fetchApi<{ data: SheetsConnection }>(base).then((r) => r.data),
    /** Google's sign-in address; the caller takes the browser there. */
    start: () => fetchApi<{ data: { authorizationUrl: string } }>(`${base}/start`, { method: "POST" }).then((r) => r.data),
    /** Hands back what Google returned, as the signed-in person. */
    complete: (code: string, state: string) => fetchApi<{ data: SheetsConnection }>(base, { method: "POST", body: JSON.stringify({ code, state }) }).then((r) => r.data),
    disconnect: () => fetchApi<{ data: { disconnected: boolean; revokedAtGoogle: boolean } }>(base, { method: "DELETE" }).then((r) => r.data),
  };
}
