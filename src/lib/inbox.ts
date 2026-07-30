"use client";

import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import type {
  ConnectInboxInput,
  DeliverabilityMetrics,
  Domain,
  DomainDnsResponse,
  Inbox,
  InboxThread,
  InboxThreadsResponse,
  InboxMessagesResponse,
  InboxMessage,
  ThreadContext,
  SuggestReplyResult,
} from "@/types/api";

interface ListResponse<T> {
  data: T[];
  total: number;
}

export const THREADS_QUERY_KEY = ["inbox", "threads"] as const;
export const MESSAGES_QUERY_KEY = ["inbox", "messages"] as const;
export const CONTEXT_QUERY_KEY = ["inbox", "context"] as const;

export function useInboxApi() {
  const fetch = useApiFetch();

  return {
    listInboxes: () =>
      fetch<ListResponse<Inbox>>("/api/v1/inboxes"),

    connectInbox: (body: ConnectInboxInput) =>
      fetch<Inbox>("/api/v1/inboxes", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    disconnectInbox: (id: string) =>
      fetch<void>(`/api/v1/inboxes/${id}`, { method: "DELETE" }),

    pauseInbox: (id: string) =>
      fetch<Inbox>(`/api/v1/inboxes/${id}/pause`, { method: "POST" }),

    resumeInbox: (id: string, resetCounters = false) =>
      fetch<Inbox>(`/api/v1/inboxes/${id}/resume`, {
        method: "POST",
        body: JSON.stringify({ resetCounters }),
      }),

    listDomains: () =>
      fetch<ListResponse<Domain>>("/api/v1/domains"),

    addDomain: (domain: string) =>
      fetch<Domain>("/api/v1/domains", {
        method: "POST",
        body: JSON.stringify({ domain }),
      }),

    removeDomain: (id: string) =>
      fetch<void>(`/api/v1/domains/${id}`, { method: "DELETE" }),

    getDomainDns: (id: string) =>
      fetch<DomainDnsResponse>(`/api/v1/domains/${id}/dns`),

    getMetrics: () =>
      fetch<DeliverabilityMetrics>("/api/v1/deliverability/metrics"),

    testSend: (id: string) =>
      fetch<{ ok: boolean; provider: string }>(`/api/v1/inboxes/${id}/test-send`, {
        method: "POST",
      }),
  };
}

export function useInboxThreadsApi() {
  const fetchApi = useApiFetch();

  return {
    listThreads: (params?: {
      status?: string;
      unread?: boolean;
      inboxId?: string;
      folder?: "all" | "inbound" | "sent";
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.unread) qs.set("unread", "true");
      if (params?.inboxId) qs.set("inboxId", params.inboxId);
      if (params?.folder && params.folder !== "all") qs.set("folder", params.folder);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const query = qs.toString() ? `?${qs}` : "";
      return fetchApi<InboxThreadsResponse>(`/api/v1/inbox/threads${query}`, {
        workspaceId: WORKSPACE_ID,
      });
    },

    getMessages: (threadId: string) =>
      fetchApi<InboxMessagesResponse>(`/api/v1/inbox/threads/${threadId}/messages`, {
        workspaceId: WORKSPACE_ID,
      }),

    getContext: (threadId: string) =>
      fetchApi<ThreadContext>(`/api/v1/inbox/threads/${threadId}/context`, {
        workspaceId: WORKSPACE_ID,
      }),

    suggestReply: (threadId: string) =>
      fetchApi<SuggestReplyResult>(`/api/v1/inbox/threads/${threadId}/suggest-reply`, {
        method: "POST",
        workspaceId: WORKSPACE_ID,
      }),

    markRead: (threadId: string) =>
      fetchApi<{ ok: boolean }>(`/api/v1/inbox/threads/${threadId}/read`, {
        method: "POST",
        workspaceId: WORKSPACE_ID,
      }),

    reply: (threadId: string, body: { text: string }) =>
      fetchApi<InboxMessage>(`/api/v1/inbox/threads/${threadId}/reply`, {
        method: "POST",
        body: JSON.stringify(body),
        workspaceId: WORKSPACE_ID,
      }),

    transitionStatus: (threadId: string, status: string) =>
      fetchApi<InboxThread>(`/api/v1/inbox/threads/${threadId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        workspaceId: WORKSPACE_ID,
      }),
  };
}
