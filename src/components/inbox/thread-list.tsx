"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Inbox, InboxThread } from "@/types/api";
import type { BadgeProps } from "@/components/ui/badge";
import type { MessagingAccount } from "@/lib/linkedin-messaging";

const STATUS_FILTERS: { label: string; value: string | undefined }[] = [
  { label: "All", value: undefined },
  { label: "New", value: "new" },
  { label: "Replied", value: "replied" },
  { label: "Bounced", value: "bounced" },
  { label: "Meeting", value: "meeting_booked" },
  { label: "Closed", value: "closed" },
];

const FOLDER_FILTERS: { label: string; value: "all" | "inbound" | "sent" }[] = [
  { label: "All mail", value: "all" },
  { label: "Inbound", value: "inbound" },
  { label: "Sent", value: "sent" },
];

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

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
}

function displayName(thread: InboxThread): string {
  return (
    thread.prospect?.fullName?.trim() ||
    thread.prospect?.email?.trim() ||
    thread.subject?.trim() ||
    "Unknown"
  );
}

export function ThreadList({
  channel = "email",
  threads,
  loading,
  total,
  selectedId,
  statusFilter,
  folderFilter,
  inboxFilter,
  inboxes,
  linkedinAccounts = [],
  linkedinAccountFilter,
  onSelectThread,
  onChangeStatus,
  onChangeFolder,
  onChangeInbox,
  onChangeLinkedinAccount,
}: {
  channel?: "email" | "linkedin" | "whatsapp";
  threads: InboxThread[];
  loading: boolean;
  total: number;
  selectedId: string | null;
  statusFilter: string | undefined;
  folderFilter: "all" | "inbound" | "sent";
  inboxFilter: string | undefined;
  inboxes: Inbox[];
  linkedinAccounts?: MessagingAccount[];
  linkedinAccountFilter?: string | undefined;
  onSelectThread: (thread: InboxThread) => void;
  onChangeStatus: (status: string | undefined) => void;
  onChangeFolder: (folder: "all" | "inbound" | "sent") => void;
  onChangeInbox: (inboxId: string | undefined) => void;
  onChangeLinkedinAccount?: (accountId: string | undefined) => void;
}) {
  const isMessaging = channel === "linkedin" || channel === "whatsapp";
  const messagingLabel = channel === "whatsapp" ? "WhatsApp" : "LinkedIn";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {isMessaging ? (
        linkedinAccounts.length > 0 && (
          <div className="shrink-0 border-b p-2">
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              value={linkedinAccountFilter ?? linkedinAccounts[0]?.id ?? ""}
              onChange={(e) => onChangeLinkedinAccount?.(e.target.value || undefined)}
              aria-label={`Filter by ${messagingLabel} account`}
            >
              {linkedinAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName || account.phone || account.unipileAccountId}
                </option>
              ))}
            </select>
          </div>
        )
      ) : (
        inboxes.length > 0 && (
          <div className="shrink-0 border-b p-2">
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              value={inboxFilter ?? ""}
              onChange={(e) => onChangeInbox(e.target.value || undefined)}
              aria-label="Filter by inbox"
            >
              <option value="">All inboxes</option>
              {inboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id}>
                  {inbox.emailAddress}
                </option>
              ))}
            </select>
          </div>
        )
      )}

      {!isMessaging && (
        <div className="flex gap-1 p-2 border-b shrink-0">
          {FOLDER_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onChangeFolder(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                folderFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {!isMessaging && (
        <div className="flex gap-1 p-2 border-b flex-wrap shrink-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => onChangeStatus(f.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {!loading && (
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b shrink-0">
          {total} {isMessaging ? "chat" : "thread"}
          {total !== 1 ? "s" : ""}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3 border-b">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {isMessaging ? `No ${messagingLabel} chats found.` : "No conversations match these filters."}
            </p>
            {(statusFilter || (folderFilter && folderFilter !== "inbound" && folderFilter !== "all")) && (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  onChangeStatus(undefined);
                  onChangeFolder(isMessaging ? "all" : "inbound");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          threads.map((thread) => {
            const name = displayName(thread);
            const initials = name
              .replace(/@.*/, "")
              .split(/[\s._-]+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("")
              .slice(0, 2);
            const isSelected = selectedId === thread.id;
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread)}
                className={cn(
                  "w-full flex gap-3 items-start p-3 border-b text-left transition-colors hover:bg-accent",
                  isSelected && "bg-accent"
                )}
              >
                <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {initials || "?"}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "text-sm truncate",
                        thread.unreadCount > 0 ? "font-bold" : "font-medium"
                      )}
                    >
                      {name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatRelativeTime(thread.lastMessageAt ?? thread.updatedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate leading-tight">
                    {isMessaging
                      ? thread.prospect?.title ||
                        (channel === "whatsapp"
                          ? thread.prospect?.email || `${messagingLabel} conversation`
                          : `${messagingLabel} conversation`)
                      : thread.subject}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    {!isMessaging && (
                      <Badge
                        tone={threadStatusTone(thread.status)}
                        className="text-[10px] px-1.5 py-0 leading-4"
                      >
                        {thread.status.replace("_", " ")}
                      </Badge>
                    )}
                    {isMessaging && (
                      <Badge tone="info" className="text-[10px] px-1.5 py-0 leading-4">
                        {thread.replyTag === "group"
                          ? "Group"
                          : thread.replyTag === "channel"
                            ? "Channel"
                            : messagingLabel}
                      </Badge>
                    )}
                    {thread.unreadCount > 0 && (
                      <Badge tone="warning" className="text-[10px] px-1.5 py-0 leading-4">
                        {thread.unreadCount} unread
                      </Badge>
                    )}
                    {thread.prospect?.icpBand && (
                      <Badge
                        tone={
                          thread.prospect.icpBand === "high"
                            ? "success"
                            : thread.prospect.icpBand === "medium"
                              ? "warning"
                              : "danger"
                        }
                        className="text-[10px] px-1.5 py-0 leading-4"
                      >
                        ICP {thread.prospect.icpBand}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
