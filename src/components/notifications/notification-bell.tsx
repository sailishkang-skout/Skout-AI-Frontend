"use client";

/** R17.1 — notification center bell + feed dropdown, shown in the dashboard TopBar. */

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useAuthReady } from "@/lib/api-client";
import { useNotificationsApi } from "@/lib/notifications";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const authReady = useAuthReady();
  const notificationsApi = useNotificationsApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: notificationsApi.unreadCount,
    enabled: authReady,
    refetchInterval: 30_000,
  });

  const feed = useQuery({
    queryKey: ["notifications", "feed"],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    enabled: authReady && open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const count = unread.data?.data.count ?? 0;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Bell className="h-4.5 w-4.5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[90vw] rounded-md border border-border bg-background shadow-md"
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-semibold">Notifications</p>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    disabled={markAllRead.isPending}
                    onClick={() => markAllRead.mutate()}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                <Link
                  href="/settings/notifications"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </Link>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {feed.isLoading ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
              ) : (feed.data?.data.length ?? 0) === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
              ) : (
                feed.data!.data.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.readAt) markRead.mutate(n.id);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-accent",
                      !n.readAt && "bg-primary/[0.04]"
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </span>
                    {n.body && <span className="line-clamp-2 pl-3.5 text-xs text-muted-foreground">{n.body}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
