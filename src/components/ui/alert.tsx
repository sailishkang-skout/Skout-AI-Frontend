"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "default" | "warning" | "error" | "success";

const variantConfig: Record<
  AlertVariant,
  {
    container: string;
    iconWrapper: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    dismissClass: string;
    retryClass: string;
  }
> = {
  default: {
    container:
      "border-border bg-muted/40 text-foreground dark:bg-muted/20",
    iconWrapper: "bg-muted rounded-full p-1",
    icon: Info,
    iconClass: "text-foreground/60",
    dismissClass: "text-foreground/40 hover:text-foreground/70 hover:bg-muted",
    retryClass: "text-foreground/70 hover:text-foreground border-border hover:bg-muted",
  },
  warning: {
    container:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100",
    iconWrapper: "bg-amber-100 dark:bg-amber-900/50 rounded-full p-1",
    icon: AlertTriangle,
    iconClass: "text-amber-500 dark:text-amber-400",
    dismissClass:
      "text-amber-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50",
    retryClass:
      "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50",
  },
  error: {
    container:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-100",
    iconWrapper: "bg-red-100 dark:bg-red-900/50 rounded-full p-1",
    icon: AlertCircle,
    iconClass: "text-red-500 dark:text-red-400",
    dismissClass:
      "text-red-300 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50",
    retryClass:
      "text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/50",
  },
  success: {
    container:
      "border-green-200 bg-green-50 text-green-900 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-100",
    iconWrapper: "bg-green-100 dark:bg-green-900/50 rounded-full p-1",
    icon: CheckCircle2,
    iconClass: "text-green-500 dark:text-green-400",
    dismissClass:
      "text-green-400 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/50",
    retryClass:
      "text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50",
  },
};

export function Alert({
  children,
  variant = "default",
  className,
  title,
  dismissible = false,
  onRetry,
}: {
  children?: React.ReactNode;
  variant?: AlertVariant;
  className?: string;
  title?: string;
  dismissible?: boolean;
  onRetry?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const { container, iconWrapper, icon: Icon, iconClass, dismissClass, retryClass } =
    variantConfig[variant];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-sm",
        container,
        className
      )}
    >
      <div className={cn("mt-0.5 shrink-0", iconWrapper)}>
        <Icon className={cn("h-4 w-4", iconClass)} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        {title && (
          <p className="mb-0.5 text-sm font-semibold leading-snug">{title}</p>
        )}
        {children && (
          <div className="text-sm leading-relaxed opacity-90 break-words">{children}</div>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "mt-2.5 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              retryClass
            )}
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </button>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className={cn(
            "shrink-0 rounded-md p-1 transition-colors",
            dismissClass
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
