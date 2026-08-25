import { ArrowRightLeft, CalendarClock, Mail, Phone, StickyNote } from "lucide-react";
import type {
  ActivityType,
  AuditAction,
  CommitteeMemberRole,
  CurrencyValue,
  DealStatus,
  TaskStatus,
  TaskType,
} from "@/types/crm";
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

/** "$50,000 · ₹200,000" — each currency bucket formatted and joined, never summed together. */
export function formatMoneyByCurrency(valueByCurrency: CurrencyValue[] | null | undefined): string {
  if (!valueByCurrency || valueByCurrency.length === 0) return formatMoney(0);
  return valueByCurrency
    .slice()
    .sort((a, b) => b.value - a.value)
    .map((v) => formatMoney(v.value, v.currency))
    .join(" · ");
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

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

export const AUDIT_ACTION_TONE: Record<AuditAction, BadgeProps["tone"]> = {
  create: "success",
  update: "info",
  delete: "danger",
};

/** Internal bookkeeping fields — never meaningful to a human reading "what changed here". */
const AUDIT_HIDDEN_FIELDS = new Set([
  "id",
  "workspaceId",
  "deletedAt",
  "fieldSources",
  "createdAt",
  "updatedAt",
  "sourceProspectId",
  "sourceProspectCompanyId",
]);

/** Field names with a friendlier label than a raw camelCase key would give. */
const AUDIT_FIELD_LABEL: Record<string, string> = {
  companyId: "Company",
  ownerId: "Owner",
  pipelineId: "Pipeline",
  stageId: "Stage",
  contactId: "Contact",
  dealId: "Deal",
  firstName: "First name",
  lastName: "Last name",
  linkedinUrl: "LinkedIn",
  lifecycleStage: "Lifecycle stage",
  employeeCount: "Employees",
  closeDate: "Close date",
  dueDate: "Due date",
  scheduledAt: "Scheduled at",
  meetingType: "Type",
  relatedEntityType: "Related to",
  relatedEntityId: "Related record",
  isDefault: "Default",
  isClosedWon: "Closed won",
  isClosedLost: "Closed lost",
  orderIndex: "Order",
};

/** "companyId" → "Company", "isActive" → "Is active" (fallback when no explicit label exists). */
function humanizeAuditFieldKey(key: string): string {
  if (AUDIT_FIELD_LABEL[key]) return AUDIT_FIELD_LABEL[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatAuditFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  if (["amount", "revenue"].includes(key) && typeof value === "number") {
    return formatMoney(value);
  }

  if (["dueDate", "closeDate", "createdAt", "updatedAt", "scheduledAt"].includes(key)) {
    const due = formatDueDate(typeof value === "string" ? value : null);
    if (due) return due.label;
  }

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return formatMoney(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

export function summarizeAuditDiff(
  beforeState: Record<string, unknown> | null,
  afterState: Record<string, unknown> | null,
  action: AuditAction
): string[] {
  if (action === "create") {
    return Object.entries(afterState ?? {})
      .filter(([key, value]) => !AUDIT_HIDDEN_FIELDS.has(key) && value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `${humanizeAuditFieldKey(key)}: ${formatAuditFieldValue(key, value)}`);
  }

  if (action === "delete") {
    return Object.entries(beforeState ?? {})
      .filter(([key, value]) => !AUDIT_HIDDEN_FIELDS.has(key) && value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `Deleted with: ${humanizeAuditFieldKey(key)}: ${formatAuditFieldValue(key, value)}`);
  }

  if (beforeState === null && afterState === null) return [];

  const keys = new Set<string>([
    ...(beforeState ? Object.keys(beforeState) : []),
    ...(afterState ? Object.keys(afterState) : []),
  ]);

  return Array.from(keys)
    .filter((key) => !AUDIT_HIDDEN_FIELDS.has(key) && beforeState?.[key] !== afterState?.[key])
    .map((key) => {
      const oldValue = beforeState?.[key];
      const newValue = afterState?.[key];
      return { key, old: formatAuditFieldValue(key, oldValue), next: formatAuditFieldValue(key, newValue) };
    })
    .filter(({ old, next }) => !(old === "—" && next === "—"))
    .map(({ key, old, next }) => `${humanizeAuditFieldKey(key)}: ${old} → ${next}`);
}

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
  if (status === "done") return "success";
  if (status === "skipped") return "warning";
  return "muted";
}

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  call: "Call",
  email: "Email",
  "follow-up": "Follow-up",
  custom: "Task",
};

/** §8.12 CRM Intelligence — BuyingCommittee member role display. */
export const COMMITTEE_ROLE_LABEL: Record<CommitteeMemberRole, string> = {
  economic_buyer: "Economic buyer",
  champion: "Champion",
  influencer: "Influencer",
  blocker: "Blocker",
  user: "User",
  unknown: "Unknown",
};

export const COMMITTEE_ROLE_TONE: Record<CommitteeMemberRole, BadgeProps["tone"]> = {
  economic_buyer: "success",
  champion: "success",
  influencer: "info",
  blocker: "danger",
  user: "muted",
  unknown: "muted",
};
