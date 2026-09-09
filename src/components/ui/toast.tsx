"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "destructive" | "info";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

export function toast({
  title,
  description,
  variant = "default",
  duration = 4000,
}: Omit<ToastItem, "id">) {
  const id = Math.random().toString(36).substring(2, 9);
  const item: ToastItem = { id, title, description, variant, duration };
  toasts = [...toasts, item];
  notify();

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

toast.success = (description: string, title: string = "Success") =>
  toast({ title, description, variant: "success" });

toast.error = (description: string, title: string = "Error") =>
  toast({ title, description, variant: "destructive", duration: 5000 });

toast.info = (description: string, title: string = "Notice") =>
  toast({ title, description, variant: "info" });

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function Toaster() {
  const [activeToasts, setActiveToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    listeners.add(setActiveToasts);
    return () => {
      listeners.delete(setActiveToasts);
    };
  }, []);

  if (!activeToasts.length) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {activeToasts.map((t) => {
        const isSuccess = t.variant === "success";
        const isError = t.variant === "destructive";
        const isInfo = t.variant === "info";

        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200",
              isSuccess && "border-emerald-500/30 bg-card/95 text-foreground shadow-emerald-500/5",
              isError && "border-rose-500/40 bg-card/95 text-foreground shadow-rose-500/5",
              isInfo && "border-blue-500/30 bg-card/95 text-foreground shadow-blue-500/5",
              !isSuccess && !isError && !isInfo && "border-border/80 bg-card/95 text-foreground"
            )}
          >
            <div className="shrink-0 pt-0.5">
              {isSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {isError && <AlertCircle className="h-4 w-4 text-rose-500" />}
              {isInfo && <Info className="h-4 w-4 text-blue-500" />}
              {!isSuccess && !isError && !isInfo && <Info className="h-4 w-4 text-muted-foreground" />}
            </div>

            <div className="flex-1 min-w-0">
              {t.title && <p className="text-xs font-semibold leading-tight">{t.title}</p>}
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words">
                  {t.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 -mr-1 -mt-1 rounded-md p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label="Close notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

