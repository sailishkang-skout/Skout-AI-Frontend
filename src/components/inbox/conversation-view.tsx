"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Loader2, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBody } from "@/components/inbox/message-body";
import { cn } from "@/lib/utils";
import type { InboxMessage, InboxThread } from "@/types/api";
import type { BadgeProps } from "@/components/ui/badge";

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
}: {
  thread: InboxThread;
  messages: InboxMessage[];
  messagesLoading: boolean;
  messagesError: Error | null;
  sending: boolean;
  sendError: Error | null;
  onReply: (text: string) => void;
  onMarkRead: () => void;
  onOpenContext: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = replyText.trim();
    if (!text || sending) return;
    onReply(text);
    setReplyText("");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold truncate">{thread.subject}</h2>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <Badge tone={threadStatusTone(thread.status)}>
              {thread.status.replace("_", " ")}
            </Badge>
            {thread.prospect?.fullName && (
              <span className="text-xs text-muted-foreground">
                · {thread.prospect.fullName}
                {thread.prospect.companyName && ` @ ${thread.prospect.companyName}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {thread.unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={onMarkRead} className="text-xs h-7 px-2">
              Mark read
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenContext}
            className="text-xs h-7 px-2 gap-1"
          >
            <Info className="h-3.5 w-3.5" />
            Context
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
        {messagesLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("flex gap-3 max-w-[80%]", i % 2 === 1 && "ml-auto flex-row-reverse")}>
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <Skeleton className="h-20 flex-1 rounded-lg" />
            </div>
          ))
        ) : messagesError ? (
          <Alert variant="error" title="Failed to load messages">
            Could not load messages for this thread.
          </Alert>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOut = msg.direction === "outbound";
            return (
              <div
                key={msg.id}
                className={cn("flex gap-2 max-w-[92%]", isOut ? "ml-auto flex-row-reverse" : "")}
              >
                <div
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mt-1",
                    isOut
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border text-muted-foreground"
                  )}
                >
                  {isOut ? "Me" : "In"}
                </div>
                <div
                  className={cn(
                    "flex-1 min-w-0 overflow-hidden rounded-xl border shadow-sm",
                    isOut
                      ? "border-primary/30 bg-primary text-primary-foreground"
                      : "border-border bg-card text-card-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] border-b",
                      isOut ? "border-primary-foreground/15 opacity-80" : "border-border text-muted-foreground"
                    )}
                  >
                    <span className="truncate font-medium">{msg.fromAddress}</span>
                    <span className="shrink-0 tabular-nums">{formatTime(msg.sentAt)}</span>
                  </div>
                  <div className="px-1 py-1">
                    <MessageBody
                      bodyHtml={msg.bodyHtml}
                      bodyText={msg.bodyText}
                      isOutbound={isOut}
                    />
                  </div>
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

      <div className="border-t p-3 shrink-0 bg-background">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 min-h-[72px] max-h-[160px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Type your reply… (Ctrl+Enter to send)"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="shrink-0 h-9"
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
