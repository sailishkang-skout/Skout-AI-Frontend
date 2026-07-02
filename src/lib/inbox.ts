"use client";

import { useApiFetch } from "./api-client";
import type {
  ConnectInboxInput,
  DeliverabilityMetrics,
  Domain,
  DomainDnsResponse,
  Inbox,
} from "@/types/api";

interface ListResponse<T> {
  data: T[];
  total: number;
}

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
  };
}
