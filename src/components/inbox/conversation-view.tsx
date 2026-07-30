"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info, Loader2, Send, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBody } from "@/components/inbox/message-body";
import { cn } from "@/lib/utils";
import type { InboxMessage, InboxThread } from "@/types/api";
import type { BadgeProps } from "@/components/ui/badge";
import { formatQueryError } from "@/lib/api-client";

function threadStatusTone(status: string): BadgeProps["tone"] {
  switch (status) {
    case "new":
      return "info";
    case "replied":
      return "success";
    case "bounced":
      return "danger";
    case "meeting_booked":
      return "success";
    case "closed":
      return "muted";
    default:
      return "muted";
  }
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ConversationView({
  thread,
  messages,
  messagesLoading,
  messagesError,
  sending,
  sendError,
  onReply,
  onMarkRead,
  onOpenContext,
  draftReply,
  sequencePaused,
  sequenceName,
  sequenceId,
  suggesting,
  onSuggestReply,
  suggestError,
  onBack,
}: {
  thread: InboxThread;
  messages: InboxMessage[];
  messagesLoading: boolean;
  messagesError: Error | null;
  sending: boolean;
  sendError: Error | null;
  onReply: (text: string) => void | Promise<void>;
  onMarkRead: () => void;
  onOpenContext: () => void;
  /** When set (e.g. from AI Ask/Auto), fills the reply composer. */
  draftReply?: string | null;
  sequencePaused?: boolean;
  sequenceName?: string | null;
  sequenceId?: string | null;
  suggesting?: boolean;
  onSuggestReply?: () => void;
  suggestError?: Error | null;
  /** Mobile: return to thread list */
  onBack?: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isMessaging = thread.channel === "linkedin" || thread.channel === "whatsapp";
  const title =
    thread.prospect?.fullName?.trim() ||
    (isMessaging ? thread.subject : thread.subject) ||
    "Conversation";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (draftReply != null && draftReply !== "") {
      setReplyText(draftReply);
    }
  }, [draftReply]);

  async function handleSend() {
    const text = replyText.trim();
    if (!text || sending) return;
    try {
      await onReply(text);
      setReplyText("");
    } catch {
      // Keep draft so failed sends can be retried.
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b bg-background px-4 py-3">
        {onBack && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onBack}
            className="h-8 w-8 shrink-0 p-0 lg:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {isMessaging ? (
              <Badge tone="info">{thread.channel === "whatsapp" ? "WhatsApp" : "LinkedIn"}</Badge>
            ) : (
              <Badge tone={threadStatusTone(thread.status)}>
                {thread.status.replace("_", " ")}
              </Badge>
            )}
            {!isMessaging && thread.prospect?.fullName && (
              <span className="text-xs text-muted-foreground">
                · {thread.prospect.fullName}
                {thread.prospect.companyName && ` @ ${thread.prospect.companyName}`}
              </span>
            )}
            {isMessaging && thread.prospect?.companyName && (
              <span className="text-xs text-muted-foreground">· {thread.prospect.companyName}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {thread.unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={onMarkRead} className="h-7 px-2 text-xs">
              Mark read
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenContext}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Info className="h-3.5 w-3.5" />
            Context
          </Button>
        </div>
      </div>

      {sequencePaused && !isMessaging && (
        <div className="shrink-0 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-900 dark:text-emerald-200">
          Sequence paused — they replied
          {sequenceName ? (
            <>
              {" "}
              ·{" "}
              {sequenceId ? (
                <Link href={`/sequences/${sequenceId}`} className="font-medium underline underline-offset-2">
                  {sequenceName}
                </Link>
              ) : (
                <span className="font-medium">{sequenceName}</span>
              )}
            </>
          ) : null}
          . Remaining steps were skipped automatically.
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
        {messagesLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("flex max-w-[80%] gap-3", i % 2 === 1 && "ml-auto flex-row-reverse")}>
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-20 flex-1 rounded-lg" />
            </div>
          ))
        ) : messagesError ? (
          <Alert variant="error" title="Failed to load messages">
            Could not load messages for this thread.
          </Alert>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOut = msg.direction === "outbound";
            return (
              <div
                key={msg.id}
                className={cn("flex max-w-[min(100%,42rem)] gap-2.5", isOut ? "ml-auto flex-row-reverse" : "")}
              >
                <div
                  className={cn(
                    "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isOut
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background text-muted-foreground"
                  )}
                >
                  {isOut ? "Me" : "In"}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
                    isOut ? "border-primary/25" : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3.5 py-2 text-[11px]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          isOut
                            ? "bg-primary/15 text-primary"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        )}
                      >
                        {isOut ? "Sent" : "Inbound"}
                      </span>
                      <span className="truncate font-medium text-foreground">{msg.fromAddress}</span>
                    </div>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatTime(msg.sentAt)}</span>
                  </div>
                  <MessageBody
                    bodyHtml={msg.bodyHtml}
                    bodyText={msg.bodyText}
                    isOutbound={isOut}
                  />
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {sendError && (
        <div className="mx-4 mb-1 shrink-0">
          <Alert variant="error" title="Failed to send reply">
            {sendError.message}
          </Alert>
        </div>
      )}

      <div className="shrink-0 border-t bg-background p-3">
        {!isMessaging && onSuggestReply && (
          <div className="mb-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                AI can draft a reply from this thread — you review before send.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                disabled={suggesting || sending}
                onClick={onSuggestReply}
              >
                {suggesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Suggest reply
              </Button>
            </div>
            {suggestError && (
              <Alert variant="error" title="Could not suggest a reply">
                {formatQueryError(suggestError, "Try again in a moment.")}
              </Alert>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            className="max-h-[160px] min-h-[72px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Type your reply… (Ctrl+Enter to send)"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={sending}
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!replyText.trim() || sending}
            className="h-9 shrink-0"
            aria-label="Send reply"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
