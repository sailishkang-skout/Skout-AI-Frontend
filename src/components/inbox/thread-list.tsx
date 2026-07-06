"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { InboxThread } from "@/types/api";
import type { BadgeProps } from "@/components/ui/badge";

const STATUS_FILTERS: { label: string; value: string | undefined }[] = [
  { label: "All", value: undefined },
  { label: "New", value: "new" },
  { label: "Replied", value: "replied" },
  { label: "Bounced", value: "bounced" },
  { label: "Meeting", value: "meeting_booked" },
  { label: "Closed", value: "closed" },
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

export function ThreadList({
  threads,
  loading,
  total,
  selectedId,
  statusFilter,
  onSelectThread,
  onChangeStatus,
}: {
  threads: InboxThread[];
  loading: boolean;
  total: number;
  selectedId: string | null;
  statusFilter: string | undefined;
  onSelectThread: (thread: InboxThread) => void;
  onChangeStatus: (status: string | undefined) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status filter tabs */}
      <div className="flex gap-1 p-2 border-b flex-wrap shrink-0">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => onChangeStatus(f.value)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              statusFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Count */}
      {!loading && (
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b shrink-0">
          {total} thread{total !== 1 ? "s" : ""}
        </div>
      )}

      {/* Thread rows */}
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
          <div className="p-8 text-center text-sm text-muted-foreground">
            No threads found.
          </div>
        ) : (
          threads.map((thread) => {
            const name = thread.prospect?.fullName ?? thread.subject;
            const initials = name
              .split(" ")
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
                {/* Avatar */}
                <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  {initials || "?"}
                </div>

                {/* Body */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "text-sm truncate",
                        thread.unreadCount > 0 ? "font-bold" : "font-medium"
                      )}
                    >
                      {thread.prospect?.fullName ?? "Unknown"}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatRelativeTime(thread.lastMessageAt ?? thread.updatedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate leading-tight">
                    {thread.subject}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    <Badge
                      tone={threadStatusTone(thread.status)}
                      className="text-[10px] px-1.5 py-0 leading-4"
                    >
                      {thread.status.replace("_", " ")}
                    </Badge>
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
                        {thread.prospect.icpBand}
                      </Badge>
                    )}
                    {thread.unreadCount > 0 && (
                      <span className="ml-auto h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold shrink-0">
                        {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                      </span>
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
