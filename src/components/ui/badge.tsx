import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "danger" | "info" | "muted";

const tones: Record<BadgeTone, string> = {
  default: "bg-primary/10 text-primary dark:bg-primary/20",
  success: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  muted: "bg-muted text-muted-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "completed":
    case "valid":
      return "success";
    case "running":
    case "queued":
      return "info";
    case "failed":
    case "invalid":
      return "danger";
    case "catch_all":
    case "risky":
      return "warning";
    default:
      return "muted";
  }
}
