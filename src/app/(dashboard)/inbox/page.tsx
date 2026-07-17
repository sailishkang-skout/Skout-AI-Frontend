"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { AiChatBox } from "@/components/ai/ai-chat-box";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { ConversationView } from "@/components/inbox/conversation-view";
import { ContextPanel } from "@/components/inbox/context-panel";
import { ThreadList } from "@/components/inbox/thread-list";
import {
  useInboxApi,
  useInboxThreadsApi,
  THREADS_QUERY_KEY,
  MESSAGES_QUERY_KEY,
  CONTEXT_QUERY_KEY,
} from "@/lib/inbox";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import type { InboxThread } from "@/types/api";

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

export default function InboxPage() {
  const queryClient = useQueryClient();
  const inboxApi = useInboxApi();
  const threadsApi = useInboxThreadsApi();
  const authReady = useAuthReady();

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [folderFilter, setFolderFilter] = useState<"all" | "inbound" | "sent">("inbound");
  const [inboxFilter, setInboxFilter] = useState<string | undefined>(undefined);
  const [selectedThread, setSelectedThread] = useState<InboxThread | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [defaultInboxReady, setDefaultInboxReady] = useState(false);
  const [aiDraftReply, setAiDraftReply] = useState<string | null>(null);

  const inboxesQuery = useQuery({
    queryKey: ["inboxes"],
    queryFn: () => inboxApi.listInboxes(),
    enabled: authReady,
  });

  // Default to the first connected inbox once loaded
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

  // Deep-link: /inbox?inboxId=…&folder=sent|inbound|all
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
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

  const threadsQuery = useQuery({
    queryKey: [...THREADS_QUERY_KEY, statusFilter, folderFilter, inboxFilter],
    queryFn: () =>
      threadsApi.listThreads({
        status: statusFilter,
        folder: folderFilter,
        inboxId: inboxFilter,
        limit: 50,
      }),
    enabled: authReady && defaultInboxReady,
    refetchInterval: 30_000,
  });

  const messagesQuery = useQuery({
    queryKey: [...MESSAGES_QUERY_KEY, selectedThread?.id],
    queryFn: () => threadsApi.getMessages(selectedThread!.id),
    enabled: authReady && !!selectedThread,
  });

  const contextQuery = useQuery({
    queryKey: [...CONTEXT_QUERY_KEY, selectedThread?.id],
    queryFn: () => threadsApi.getContext(selectedThread!.id),
    enabled: authReady && !!selectedThread && contextOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (threadId: string) => threadsApi.markRead(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY });
      setSelectedThread((t) => (t ? { ...t, unreadCount: 0 } : t));
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ threadId, text }: { threadId: string; text: string }) =>
      threadsApi.reply(threadId, { text }),
    onSuccess: () => {
      if (selectedThread) {
        queryClient.invalidateQueries({
          queryKey: [...MESSAGES_QUERY_KEY, selectedThread.id],
        });
        queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY });
      }
    },
  });

  function handleSelectThread(thread: InboxThread) {
    setSelectedThread(thread);
    setContextOpen(false);
    if (thread.unreadCount > 0) {
      markReadMutation.mutate(thread.id);
    }
  }

  // Clear selection when filters change and selected thread is no longer in the list
  useEffect(() => {
    if (!selectedThread) return;
    const ids = new Set((threadsQuery.data?.data ?? []).map((t) => t.id));
    if (threadsQuery.data && !ids.has(selectedThread.id)) {
      setSelectedThread(null);
    }
  }, [threadsQuery.data, selectedThread]);

  const threads = threadsQuery.data?.data ?? [];
  const total = threadsQuery.data?.total ?? 0;
  const inboxes = inboxesQuery.data?.data ?? [];

  return (
    <PageShell width="full">
      <PageHeader
        title="Inbox"
        description="Replies and outreach threads from your connected inboxes."
      />

      <DemoBanner />

      {threadsQuery.error && (
        <Alert
          variant="error"
          title="Failed to load inbox"
          onRetry={() => threadsQuery.refetch()}
        >
          {formatQueryError(threadsQuery.error, "Could not load inbox threads.")}
        </Alert>
      )}

      <div
        className="flex rounded-xl border overflow-hidden bg-background"
        style={{ height: "calc(100svh - 18rem)" }}
      >
        <div className="w-80 xl:w-96 shrink-0 border-r overflow-hidden flex flex-col">
          <ThreadList
            threads={threads}
            loading={threadsQuery.isLoading || inboxesQuery.isLoading}
            total={total}
            selectedId={selectedThread?.id ?? null}
            statusFilter={statusFilter}
            folderFilter={folderFilter}
            inboxFilter={inboxFilter}
            inboxes={inboxes}
            onSelectThread={handleSelectThread}
            onChangeStatus={setStatusFilter}
            onChangeFolder={setFolderFilter}
            onChangeInbox={setInboxFilter}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {selectedThread ? (
            <ConversationView
              thread={selectedThread}
              messages={messagesQuery.data?.data ?? []}
              messagesLoading={messagesQuery.isLoading}
              messagesError={messagesQuery.error as Error | null}
              sending={replyMutation.isPending}
              sendError={replyMutation.error as Error | null}
              draftReply={aiDraftReply}
              onReply={(text) =>
                replyMutation.mutate({ threadId: selectedThread.id, text })
              }
              onMarkRead={() => markReadMutation.mutate(selectedThread.id)}
              onOpenContext={() => setContextOpen(true)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground p-8">
              <Mail className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a thread to view the conversation</p>
            </div>
          )}
        </div>
      </div>

      <ContextPanel
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        context={contextQuery.data}
        loading={contextQuery.isLoading}
      />

      {selectedThread && (
        <AiChatBox
          title="Inbox AI (Auto / Ask)"
          stageForReview={Boolean(selectedThread.prospectId)}
          context={{
            kind: "email",
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
