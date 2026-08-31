import { useApiFetch } from "./api-client";

export interface SuppressionRow {
  id: string;
  workspaceId: string;
  email: string;
  reason: string;
  createdAt: string;
}

export interface ConsentRow {
  id: string;
  workspaceId: string;
  subjectType: string;
  subjectId: string;
  type: string;
  basis: string;
  grantedAt: string;
  revokedAt: string | null;
  recordedBy: string | null;
}

export function useComplianceApi() {
  const fetchApi = useApiFetch();
  return {
    listSuppressions: (params?: { email?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.email) q.set("email", params.email);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      return fetchApi<{ data: SuppressionRow[]; total: number }>(
        `/api/v1/suppressions${qs ? `?${qs}` : ""}`
      );
    },
    addSuppression: (email: string, reason = "manual_dnc") =>
      fetchApi<{ data: SuppressionRow }>("/api/v1/suppressions", {
        method: "POST",
        body: JSON.stringify({ email, reason }),
      }),
    removeSuppression: (id: string) =>
      fetchApi<void>(`/api/v1/suppressions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    listConsents: (params?: { subjectType?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.subjectType) q.set("subjectType", params.subjectType);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      return fetchApi<{ data: ConsentRow[]; total: number }>(
        `/api/v1/compliance/consents${qs ? `?${qs}` : ""}`
      );
    },
    listDsar: (status?: string) =>
      fetchApi<{ data: DsarRow[]; total: number }>(
        `/api/v1/dsar${status ? `?status=${encodeURIComponent(status)}` : ""}`
      ),
    createDsar: (input: {
      requestType: DsarRow["requestType"];
      subjectEmail: string;
      notes?: string;
      fulfillmentMode?: "manual" | "auto";
    }) =>
      fetchApi<{ data: DsarRow }>("/api/v1/dsar", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateDsar: (id: string, status: DsarRow["status"], notes?: string) =>
      fetchApi<{ data: DsarRow }>(`/api/v1/dsar/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes }),
      }),
  };
}

export interface DsarRow {
  id: string;
  workspaceId: string;
  requestType: "access" | "erasure" | "rectification" | "portability";
  subjectEmail: string;
  status: "received" | "in_progress" | "completed" | "rejected";
  fulfillmentMode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
