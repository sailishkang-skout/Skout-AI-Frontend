"use client";

import { useApiFetch } from "./api-client";
import type { InboxMessage, InboxMessagesResponse, InboxThread, InboxThreadsResponse, ThreadContext } from "@/types/api";

export type MessagingChannel = "linkedin" | "whatsapp";

export interface MessagingAccount {
  id: string;
  unipileAccountId: string;
  displayName: string | null;
  phone?: string | null;
  status: string;
  channel?: string;
}

export interface LinkedinPerson {
  providerId: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  networkDistance: string | null;
  publicIdentifier: string | null;
  profileUrl: string | null;
  pictureUrl: string | null;
  source: "connections" | "search";
  canMessage: boolean;
  canConnect: boolean;
}

interface AccountsResponse {
  workspaceId: string;
  channel?: MessagingChannel;
  data: MessagingAccount[];
  total: number;
}

interface PeopleSearchResponse {
  workspaceId: string;
  accountId: string;
  mode: "connections" | "search";
  data: LinkedinPerson[];
  cursor: string | null;
  total: number;
}

/** @deprecated use MessagingAccount */
export type LinkedinMessagingAccount = MessagingAccount;

export function useMessagingApi(channel: MessagingChannel) {
  const fetch = useApiFetch();
  const base = `/api/v1/messaging/${channel}`;

  return {
    listAccounts: () => fetch<AccountsResponse>(`${base}/accounts`),

    listChats: (accountId?: string) => {
      const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
      return fetch<InboxThreadsResponse>(`${base}/chats${qs}`);
    },

    getMessages: (threadId: string) =>
      fetch<InboxMessagesResponse>(`${base}/chats/${encodeURIComponent(threadId)}/messages`),

    reply: (threadId: string, body: { text: string }) =>
      fetch<InboxMessage>(`${base}/chats/${encodeURIComponent(threadId)}/reply`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    markRead: (threadId: string) =>
      fetch<{ ok: boolean; threadId: string; unreadCount: number }>(
        `${base}/chats/${encodeURIComponent(threadId)}/read`,
        { method: "POST" }
      ),

    getContext: (threadId: string) =>
      fetch<ThreadContext>(`${base}/chats/${encodeURIComponent(threadId)}/context`),
  };
}

export function useLinkedinMessagingApi() {
  const fetch = useApiFetch();
  const messaging = useMessagingApi("linkedin");

  return {
    ...messaging,
    searchPeople: (params: {
      accountId?: string;
      mode: "connections" | "search";
      q?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params.accountId) qs.set("accountId", params.accountId);
      qs.set("mode", params.mode);
      if (params.q) qs.set("q", params.q);
      if (params.limit != null) qs.set("limit", String(params.limit));
      if (params.cursor) qs.set("cursor", params.cursor);
      return fetch<PeopleSearchResponse>(`/api/v1/messaging/linkedin/people?${qs}`);
    },

    outreach: (body: {
      accountId?: string;
      action: "connect" | "message";
      providerId: string;
      text?: string;
    }) =>
      fetch<{ ok: boolean; action: "connect" | "message"; providerId: string }>(
        "/api/v1/messaging/linkedin/outreach",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),
  };
}

export function useWhatsappMessagingApi() {
  const fetch = useApiFetch();
  const messaging = useMessagingApi("whatsapp");

  return {
    ...messaging,
    outreach: (body: { accountId?: string; phone: string; text: string }) =>
      fetch<{ ok: boolean; action: "message"; phone: string }>(
        "/api/v1/messaging/whatsapp/outreach",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),
  };
}
