"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { ConversationView } from "@/components/inbox/conversation-view";
import { ContextPanel } from "@/components/inbox/context-panel";
import { ThreadList } from "@/components/inbox/thread-list";
import { useInboxThreadsApi, THREADS_QUERY_KEY, MESSAGES_QUERY_KEY, CONTEXT_QUERY_KEY } from "@/lib/inbox";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import type { InboxThread } from "@/types/api";

export default function InboxPage() {
  const queryClient = useQueryClient();
  const inboxApi = useInboxThreadsApi();
  const authReady = useAuthReady();

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selectedThread, setSelectedThread] = useState<InboxThread | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const threadsQuery = useQuery({
    queryKey: [...THREADS_QUERY_KEY, statusFilter],
    queryFn: () => inboxApi.listThreads({ status: statusFilter, limit: 50 }),
    enabled: authReady,
    refetchInterval: 30_000,
  });

  const messagesQuery = useQuery({
    queryKey: [...MESSAGES_QUERY_KEY, selectedThread?.id],
    queryFn: () => inboxApi.getMessages(selectedThread!.id),
    enabled: authReady && !!selectedThread,
  });

  const contextQuery = useQuery({
    queryKey: [...CONTEXT_QUERY_KEY, selectedThread?.id],
    queryFn: () => inboxApi.getContext(selectedThread!.id),
    enabled: authReady && !!selectedThread && contextOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (threadId: string) => inboxApi.markRead(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY });
      setSelectedThread((t) => (t ? { ...t, unreadCount: 0 } : t));
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ threadId, text }: { threadId: string; text: string }) =>
      inboxApi.reply(threadId, { text }),
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

  const threads = threadsQuery.data?.data ?? [];
  const total = threadsQuery.data?.total ?? 0;

  return (
    <PageShell width="full">
      <PageHeader
        title="Inbox"
        description="Inbound replies from your outreach sequences."
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
        {/* Left: thread list */}
        <div className="w-72 xl:w-80 shrink-0 border-r overflow-hidden flex flex-col">
          <ThreadList
            threads={threads}
            loading={threadsQuery.isLoading}
            total={total}
            selectedId={selectedThread?.id ?? null}
            statusFilter={statusFilter}
            onSelectThread={handleSelectThread}
            onChangeStatus={setStatusFilter}
          />
        </div>

        {/* Right: conversation */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {selectedThread ? (
            <ConversationView
              thread={selectedThread}
              messages={messagesQuery.data?.data ?? []}
              messagesLoading={messagesQuery.isLoading}
              messagesError={messagesQuery.error as Error | null}
              sending={replyMutation.isPending}
              sendError={replyMutation.error as Error | null}
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

      {/* Slide-out context panel */}
      <ContextPanel
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        context={contextQuery.data}
        loading={contextQuery.isLoading}
      />
    </PageShell>
  );
}
