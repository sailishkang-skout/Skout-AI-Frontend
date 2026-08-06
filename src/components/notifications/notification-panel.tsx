"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/crm-display";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useNotificationsApi } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/api";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
export const NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY = ["notifications", "unread-count"] as const;

function typeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const notificationsApi = useNotificationsApi();
  const authReady = useAuthReady();
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const notifications = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => notificationsApi.list({ limit: 50 }),
    enabled: authReady,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY });
    },
  });

  const rows = useMemo(() => notifications.data?.data ?? [], [notifications.data]);
  const types = useMemo(() => Array.from(new Set(rows.map((n) => n.type))).sort(), [rows]);
  const visible = typeFilter ? rows.filter((n) => n.type === typeFilter) : rows;
  const hasUnread = rows.some((n) => !n.readAt);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div
        role="menu"
        aria-label="Notifications"
        className="absolute right-0 z-50 mt-1 flex max-h-[28rem] w-[22rem] flex-col rounded-md border border-border bg-popover shadow-md"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-2.5">
          <span className="text-sm font-medium">Notifications</span>
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={!hasUnread || markAllRead.isPending}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            {markAllRead.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Mark all read
          </button>
        </div>

        {types.length > 1 && (
          <div className="flex flex-wrap gap-1 border-b border-border p-2">
            <button
              type="button"
              onClick={() => setTypeFilter(null)}
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                typeFilter === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              All
            </button>
            {types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  typeFilter === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                )}
              >
                {typeLabel(t)}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {notifications.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : notifications.isError ? (
            <div className="p-3">
              <Alert variant="error" onRetry={() => notifications.refetch()}>
                {formatQueryError(notifications.error, "Could not load notifications.")}
              </Alert>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <ul>
              {visible.map((n) => (
                <NotificationRow key={n.id} notification={n} onMarkRead={() => markRead.mutate(n.id)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: AppNotification;
  onMarkRead: () => void;
}) {
  const unread = !notification.readAt;
  return (
    <li
      role="menuitem"
      className={cn(
        "cursor-pointer border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-accent",
        unread && "bg-primary/5"
      )}
      onClick={() => unread && onMarkRead()}
    >
      <div className="flex items-start gap-2">
        {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
        <div className={cn("min-w-0 flex-1", !unread && "pl-3.5")}>
          <p className={cn("text-sm", unread ? "font-medium" : "text-muted-foreground")}>{notification.title}</p>
          {notification.body && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{notification.body}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(notification.createdAt)}</p>
        </div>
      </div>
    </li>
  );
}
