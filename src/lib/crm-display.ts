import { ArrowRightLeft, CalendarClock, Mail, Phone, StickyNote } from "lucide-react";
import type { ActivityType, DealStatus, TaskStatus } from "@/types/crm";
import type { BadgeProps } from "@/components/ui/badge";

export { formatJobTime as formatDateTime } from "./enrichment-display";

/** Common ISO 4217 codes offered when picking a deal's currency; the backend accepts any 3-letter code. */
export const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY"] as const;

/** `$24,000.75` — Intl-based, no new date/number dependency. */
export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** "in 2 days" / "3 days overdue" / "today" — relative label for a task due date. */
export function formatDueDate(iso: string | null | undefined): { label: string; overdue: boolean } | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const dueMidnight = new Date(due).setHours(0, 0, 0, 0);
  const todayMidnight = new Date().setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueMidnight - todayMidnight) / dayMs);

  if (diffDays === 0) return { label: "Due today", overdue: false };
  if (diffDays === 1) return { label: "Due tomorrow", overdue: false };
  if (diffDays > 1) return { label: `Due in ${diffDays} days`, overdue: false };
  if (diffDays === -1) return { label: "1 day overdue", overdue: true };
  return { label: `${Math.abs(diffDays)} days overdue`, overdue: true };
}

export const ACTIVITY_TYPE_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: CalendarClock,
  stage_change: ArrowRightLeft,
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  stage_change: "Stage change",
};

export function dealStatusTone(status: DealStatus): BadgeProps["tone"] {
  switch (status) {
    case "won":
      return "success";
    case "lost":
      return "danger";
    default:
      return "info";
  }
}

export function taskStatusTone(status: TaskStatus): BadgeProps["tone"] {
  return status === "done" ? "success" : "muted";
}
