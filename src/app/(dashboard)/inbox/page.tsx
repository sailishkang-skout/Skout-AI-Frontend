"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Linkedin, Mail, MessageCircle, Search } from "lucide-react";
import { AiChatBox } from "@/components/ai/ai-chat-box";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { ConversationView } from "@/components/inbox/conversation-view";
import { ContextPanel } from "@/components/inbox/context-panel";
import { LinkedinFindPeople } from "@/components/inbox/linkedin-find-people";
import { ThreadList } from "@/components/inbox/thread-list";
import { WhatsappNewMessage } from "@/components/inbox/whatsapp-new-message";
import {
  useInboxApi,
  useInboxThreadsApi,
  THREADS_QUERY_KEY,
  MESSAGES_QUERY_KEY,
  CONTEXT_QUERY_KEY,
} from "@/lib/inbox";
import {
  useLinkedinMessagingApi,
  useWhatsappMessagingApi,
  type MessagingChannel,
} from "@/lib/linkedin-messaging";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { InboxThread } from "@/types/api";

const LI_THREADS_KEY = ["messaging", "linkedin", "chats"] as const;
const LI_MESSAGES_KEY = ["messaging", "linkedin", "messages"] as const;
const WA_THREADS_KEY = ["messaging", "whatsapp", "chats"] as const;
const WA_MESSAGES_KEY = ["messaging", "whatsapp", "messages"] as const;

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

type InboxChannel = "email" | MessagingChannel;
type MessagingView = "chats" | "find";

export default function InboxPage() {
  const queryClient = useQueryClient();
  const inboxApi = useInboxApi();
  const threadsApi = useInboxThreadsApi();
  const linkedinApi = useLinkedinMessagingApi();
  const whatsappApi = useWhatsappMessagingApi();
  const authReady = useAuthReady();

  const [channel, setChannel] = useState<InboxChannel>("email");
  const [messagingView, setMessagingView] = useState<MessagingView>("chats");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [folderFilter, setFolderFilter] = useState<"all" | "inbound" | "sent">("inbound");
  const [inboxFilter, setInboxFilter] = useState<string | undefined>(undefined);
  const [messagingAccountFilter, setMessagingAccountFilter] = useState<string | undefined>(
    undefined
  );
  const [selectedThread, setSelectedThread] = useState<InboxThread | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [defaultInboxReady, setDefaultInboxReady] = useState(false);
  const [aiDraftReply, setAiDraftReply] = useState<string | null>(null);
  const autoMarkedRef = useRef<Set<string>>(new Set());

  const isMessaging = channel === "linkedin" || channel === "whatsapp";
  const messagingApi = channel === "whatsapp" ? whatsappApi : linkedinApi;

  const inboxesQuery = useQuery({
    queryKey: ["inboxes"],
    queryFn: () => inboxApi.listInboxes(),
    enabled: authReady,
  });

  const linkedinAccountsQuery = useQuery({
    queryKey: ["messaging", "linkedin", "accounts"],
    queryFn: () => linkedinApi.listAccounts(),
    enabled: authReady,
  });

  const whatsappAccountsQuery = useQuery({
    queryKey: ["messaging", "whatsapp", "accounts"],
    queryFn: () => whatsappApi.listAccounts(),
    enabled: authReady,
  });

  const messagingAccounts =
    channel === "whatsapp"
      ? (whatsappAccountsQuery.data?.data ?? [])
      : (linkedinAccountsQuery.data?.data ?? []);

  useEffect(() => {
    if (defaultInboxReady) return;
    const list = inboxesQuery.data?.data ?? [];
    if (list.length === 0) {
      if (inboxesQuery.isFetched) setDefaultInboxReady(true);
      return;
    }
    setInboxFilter((current) => current ?? list[0]!.id);
    setDefaultInboxReady(true);
  }, [inboxesQuery.data, inboxesQuery.isFetched, defaultInboxReady]);

  useEffect(() => {
    if (!isMessaging) return;
    if (messagingAccounts.length === 0) {
      setMessagingAccountFilter(undefined);
      return;
    }
    setMessagingAccountFilter((current) =>
      current && messagingAccounts.some((a) => a.id === current)
        ? current
        : messagingAccounts[0]!.id
    );
  }, [isMessaging, messagingAccounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ch = params.get("channel");
    if (ch === "linkedin" || ch === "email" || ch === "whatsapp") setChannel(ch);
    const view = params.get("view");
    if (view === "find" || view === "chats") setMessagingView(view);
    const id = params.get("inboxId");
    if (id) {
      setInboxFilter(id);
      setDefaultInboxReady(true);
    }
    const folder = params.get("folder");
    if (folder === "sent" || folder === "inbound" || folder === "all") {
      setFolderFilter(folder);
    }
  }, []);

  useEffect(() => {
    setSelectedThread(null);
    setContextOpen(false);
    setAiDraftReply(null);
    autoMarkedRef.current.clear();
  }, [channel, messagingView]);

  const emailThreadsQuery = useQuery({
    queryKey: [...THREADS_QUERY_KEY, statusFilter, folderFilter, inboxFilter],
    queryFn: () =>
      threadsApi.listThreads({
        status: statusFilter,
        folder: folderFilter,
        inboxId: inboxFilter,
        limit: 50,
      }),
    enabled: authReady && defaultInboxReady && channel === "email",
    refetchInterval: channel === "email" ? 30_000 : false,
  });

  const linkedinThreadsQuery = useQuery({
    queryKey: [...LI_THREADS_KEY, messagingAccountFilter],
    queryFn: () => linkedinApi.listChats(messagingAccountFilter),
    enabled:
      authReady &&
      channel === "linkedin" &&
      messagingView === "chats" &&
      Boolean(messagingAccountFilter),
    refetchInterval: channel === "linkedin" && messagingView === "chats" ? 30_000 : false,
  });

  const whatsappThreadsQuery = useQuery({
    queryKey: [...WA_THREADS_KEY, messagingAccountFilter],
    queryFn: () => whatsappApi.listChats(messagingAccountFilter),
    enabled:
      authReady &&
      channel === "whatsapp" &&
      messagingView === "chats" &&
      Boolean(messagingAccountFilter),
    refetchInterval: channel === "whatsapp" && messagingView === "chats" ? 30_000 : false,
  });

  const threadsQuery =
    channel === "whatsapp"
      ? whatsappThreadsQuery
      : channel === "linkedin"
        ? linkedinThreadsQuery
        : emailThreadsQuery;

  const messagesQuery = useQuery({
    queryKey:
      channel === "whatsapp"
        ? [...WA_MESSAGES_KEY, selectedThread?.id]
        : channel === "linkedin"
          ? [...LI_MESSAGES_KEY, selectedThread?.id]
          : [...MESSAGES_QUERY_KEY, selectedThread?.id],
    queryFn: () =>
      isMessaging
        ? messagingApi.getMessages(selectedThread!.id)
        : threadsApi.getMessages(selectedThread!.id),
    enabled: authReady && !!selectedThread && !(isMessaging && messagingView === "find"),
  });

  const contextQuery = useQuery({
    queryKey: [...CONTEXT_QUERY_KEY, channel, selectedThread?.id],
    queryFn: () =>
      isMessaging
        ? messagingApi.getContext(selectedThread!.id)
        : threadsApi.getContext(selectedThread!.id),
    enabled: authReady && !!selectedThread && contextOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (threadId: string) =>
      isMessaging ? messagingApi.markRead(threadId) : threadsApi.markRead(threadId),
    onSuccess: (_res, threadId) => {
      setSelectedThread((t) => (t && t.id === threadId ? { ...t, unreadCount: 0 } : t));
      if (channel === "email") {
        queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY });
      } else if (channel === "linkedin") {
        queryClient.invalidateQueries({ queryKey: LI_THREADS_KEY });
      } else if (channel === "whatsapp") {
        queryClient.invalidateQueries({ queryKey: WA_THREADS_KEY });
      }
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ threadId, text }: { threadId: string; text: string }) =>
      isMessaging
        ? messagingApi.reply(threadId, { text })
        : threadsApi.reply(threadId, { text }),
    onSuccess: () => {
      if (!selectedThread) return;
      if (channel === "whatsapp") {
        queryClient.invalidateQueries({ queryKey: [...WA_MESSAGES_KEY, selectedThread.id] });
        queryClient.invalidateQueries({ queryKey: WA_THREADS_KEY });
      } else if (channel === "linkedin") {
        queryClient.invalidateQueries({ queryKey: [...LI_MESSAGES_KEY, selectedThread.id] });
        queryClient.invalidateQueries({ queryKey: LI_THREADS_KEY });
      } else {
        queryClient.invalidateQueries({ queryKey: [...MESSAGES_QUERY_KEY, selectedThread.id] });
        queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY });
      }
    },
  });

  function handleSelectThread(thread: InboxThread) {
    setSelectedThread(thread);
    setContextOpen(false);
    if (thread.unreadCount > 0 && !autoMarkedRef.current.has(thread.id)) {
      autoMarkedRef.current.add(thread.id);
      markReadMutation.mutate(thread.id);
    }
  }

  // Also mark read once messages finish loading (covers deep-link / reopen).
  useEffect(() => {
    if (!selectedThread || selectedThread.unreadCount <= 0) return;
    if (!messagesQuery.isSuccess) return;
    if (autoMarkedRef.current.has(selectedThread.id)) return;
    autoMarkedRef.current.add(selectedThread.id);
    markReadMutation.mutate(selectedThread.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, selectedThread?.unreadCount, messagesQuery.isSuccess]);

  useEffect(() => {
    if (!selectedThread || (isMessaging && messagingView === "find")) return;
    const ids = new Set((threadsQuery.data?.data ?? []).map((t) => t.id));
    if (threadsQuery.data && !ids.has(selectedThread.id)) {
      setSelectedThread(null);
    }
  }, [threadsQuery.data, selectedThread, isMessaging, messagingView]);

  const threads = threadsQuery.data?.data ?? [];
  const total = threadsQuery.data?.total ?? 0;
  const inboxes = inboxesQuery.data?.data ?? [];
  const noEmailInboxes = inboxesQuery.isFetched && inboxes.length === 0;
  const noMessagingAccounts =
    isMessaging &&
    (channel === "whatsapp" ? whatsappAccountsQuery.isFetched : linkedinAccountsQuery.isFetched) &&
    messagingAccounts.length === 0;

  return (
    <PageShell width="full">
      <PageHeader
        title="Inbox"
        description="Email, LinkedIn, and WhatsApp conversations from your connected accounts."
      />

      <DemoBanner />

      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        {(
          [
            { id: "email" as const, label: "Email", icon: Mail },
            { id: "linkedin" as const, label: "LinkedIn", icon: Linkedin },
            { id: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setChannel(id);
              setMessagingView("chats");
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              channel === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {isMessaging && !noMessagingAccounts && (
        <div className="flex w-fit gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMessagingView("chats")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              messagingView === "chats"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Chats
          </button>
          <button
            type="button"
            onClick={() => setMessagingView("find")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              messagingView === "find"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="h-4 w-4" />
            {channel === "whatsapp" ? "New message" : "Find people"}
          </button>
        </div>
      )}

      {channel === "email" && noEmailInboxes && (
        <Alert variant="warning" title="No email inbox connected">
          Connect a sending inbox to receive replies and view outreach threads.{" "}
          <Link href="/deliverability" className="font-medium underline underline-offset-2">
            Connect inbox in Deliverability
          </Link>
        </Alert>
      )}

      {noMessagingAccounts ? (
        <div
          className="flex min-h-[28rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background p-10 text-center"
          style={{ height: "min(40rem, calc(100svh - 14rem))" }}
        >
          {channel === "whatsapp" ? (
            <MessageCircle className="h-12 w-12 text-muted-foreground/40" />
          ) : (
            <Linkedin className="h-12 w-12 text-muted-foreground/40" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium">
              No {channel === "whatsapp" ? "WhatsApp" : "LinkedIn"} account connected
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Connect via Unipile in Deliverability to sync chats
              {channel === "whatsapp" ? " and send new messages." : ", find people, and reply."}
            </p>
          </div>
          <Link href="/deliverability" className={cn(buttonVariants(), "mt-1")}>
            Open Deliverability
          </Link>
        </div>
      ) : isMessaging && messagingView === "find" ? (
        <div
          className="overflow-hidden rounded-xl border bg-background"
          style={{ height: "min(40rem, calc(100svh - 14rem))" }}
        >
          {channel === "linkedin" ? (
            <LinkedinFindPeople
              accounts={messagingAccounts}
              accountId={messagingAccountFilter}
              onChangeAccount={setMessagingAccountFilter}
            />
          ) : (
            <WhatsappNewMessage
              accounts={messagingAccounts}
              accountId={messagingAccountFilter}
              onChangeAccount={setMessagingAccountFilter}
              onSent={() => {
                queryClient.invalidateQueries({ queryKey: WA_THREADS_KEY });
                window.setTimeout(() => setMessagingView("chats"), 900);
              }}
            />
          )}
        </div>
      ) : (
        <>
          {threadsQuery.error && (
            <Alert
              variant="error"
              title={
                isMessaging
                  ? `Failed to load ${channel === "whatsapp" ? "WhatsApp" : "LinkedIn"} chats`
                  : "Failed to load inbox"
              }
              onRetry={() => threadsQuery.refetch()}
            >
              {formatQueryError(threadsQuery.error, "Could not load conversations.")}
            </Alert>
          )}

          <div
            className="flex overflow-hidden rounded-xl border bg-background"
            style={{ height: "min(40rem, calc(100svh - 14rem))" }}
          >
            <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r xl:w-96">
              <ThreadList
                channel={channel}
                threads={threads}
                loading={
                  threadsQuery.isLoading ||
                  (channel === "email"
                    ? inboxesQuery.isLoading
                    : channel === "whatsapp"
                      ? whatsappAccountsQuery.isLoading
                      : linkedinAccountsQuery.isLoading)
                }
                total={total}
                selectedId={selectedThread?.id ?? null}
                statusFilter={statusFilter}
                folderFilter={folderFilter}
                inboxFilter={inboxFilter}
                inboxes={inboxes}
                linkedinAccounts={messagingAccounts}
                linkedinAccountFilter={messagingAccountFilter}
                onSelectThread={handleSelectThread}
                onChangeStatus={setStatusFilter}
                onChangeFolder={setFolderFilter}
                onChangeInbox={setInboxFilter}
                onChangeLinkedinAccount={setMessagingAccountFilter}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {selectedThread ? (
                <ConversationView
                  thread={selectedThread}
                  messages={
                    messagesQuery.data?.threadId === selectedThread.id
                      ? (messagesQuery.data?.data ?? [])
                      : []
                  }
                  messagesLoading={
                    messagesQuery.isLoading ||
                    (messagesQuery.isFetching &&
                      messagesQuery.data?.threadId !== selectedThread.id)
                  }
                  messagesError={messagesQuery.error as Error | null}
                  sending={replyMutation.isPending}
                  sendError={replyMutation.error as Error | null}
                  draftReply={aiDraftReply}
                  onReply={async (text) => {
                    await replyMutation.mutateAsync({ threadId: selectedThread.id, text });
                  }}
                  onMarkRead={() => markReadMutation.mutate(selectedThread.id)}
                  onOpenContext={() => setContextOpen(true)}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-muted-foreground">
                  {channel === "linkedin" ? (
                    <Linkedin className="h-12 w-12 opacity-20" />
                  ) : channel === "whatsapp" ? (
                    <MessageCircle className="h-12 w-12 opacity-20" />
                  ) : (
                    <Mail className="h-12 w-12 opacity-20" />
                  )}
                  <p className="text-sm">Select a conversation to view messages</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <ContextPanel
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        context={contextQuery.data}
        loading={contextQuery.isLoading}
      />

      {selectedThread && channel === "email" && (
        <AiChatBox
          title="Inbox AI (Auto / Ask)"
          stageForReview={Boolean(selectedThread.prospectId)}
          context={{
            kind: "email",
            page: "/inbox",
            prospectId: selectedThread.prospectId ?? undefined,
            threadId: selectedThread.id,
            subject: selectedThread.subject ?? undefined,
          }}
          onApplyEmail={({ html }) => {
            setAiDraftReply(htmlToPlain(html));
          }}
        />
      )}
    </PageShell>
  );
}
