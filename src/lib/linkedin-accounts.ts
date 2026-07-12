"use client";

import { useApiFetch } from "./api-client";

export interface LinkedinAccount {
  id: string;
  workspaceId: string;
  unipileAccountId: string;
  displayName: string | null;
  linkedinUrl: string | null;
  status: string;
  dailySendLimit: number;
  sentCount: number;
  lastUsedAt: string | null;
  lastError: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface ListResponse {
  workspaceId: string;
  data: LinkedinAccount[];
  total: number;
  unipileConfigured: boolean;
}

export function useLinkedinAccountsApi() {
  const fetch = useApiFetch();

  return {
    list: () => fetch<ListResponse>("/api/v1/linkedin/accounts"),
    connect: (body: { unipileAccountId: string; displayName?: string; linkedinUrl?: string }) =>
      fetch<LinkedinAccount>("/api/v1/linkedin/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    hostedAuth: (webBaseUrl: string) =>
      fetch<{ url: string }>("/api/v1/linkedin/accounts/hosted-auth", {
        method: "POST",
        body: JSON.stringify({ webBaseUrl }),
      }),
    setStatus: (id: string, status: "active" | "paused") =>
      fetch<LinkedinAccount>(`/api/v1/linkedin/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    disconnect: (id: string) =>
      fetch<void>(`/api/v1/linkedin/accounts/${id}`, { method: "DELETE" }),
  };
}
