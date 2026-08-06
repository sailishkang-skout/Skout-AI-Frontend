"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useAuthReady } from "@/lib/api-client";
import { useNotificationsApi } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, NotificationPanel } from "./notification-panel";

export function NotificationBell() {
  const notificationsApi = useNotificationsApi();
  const authReady = useAuthReady();
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY,
    queryFn: notificationsApi.unreadCount,
    enabled: authReady,
    refetchInterval: 30_000,
  });

  const count = unread.data?.count ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border",
          "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
}
