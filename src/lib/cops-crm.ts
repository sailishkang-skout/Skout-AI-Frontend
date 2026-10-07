import { useApiFetch } from "@/lib/api-client";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";

/** COPS-02 CRM writes that go through the backend transition service and idempotency keys. */

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `web-${crypto.randomUUID()}`
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface StageMoveResult {
  opportunity_id: string;
  stage_id: string;
  state: string;
}

export function useCopsCrmApi() {
  const request = useApiFetch();
  return {
    /** Moves a deal to a stage. Illegal lifecycle moves come back as CopsRequestError (409). */
    moveOpportunityStage(dealId: string, stageId: string, reason: string) {
      return copsFetch<{ data: StageMoveResult }>(
        `/api/v1/opportunities/${dealId}/stage`,
        {
          method: "POST",
          headers: { "Idempotency-Key": newIdempotencyKey() },
          body: JSON.stringify({ stage_id: stageId, reason, source: "web" }),
        },
        { request }
      );
    },
  };
}

const STATE_LABELS: Record<string, string> = {
  qualified: "Qualified",
  demo: "Demo",
  commercial: "Commercial",
  won: "Won",
  lost: "Lost",
};

const label = (state: unknown) => (typeof state === "string" ? STATE_LABELS[state] ?? state : "this stage");

/**
 * Plain-language message for a failed stage move. A 409 BUSINESS_STATE_CONFLICT names the current
 * state and the moves that are allowed from it, so the user sees the rule instead of a raw error.
 */
export function stageMoveErrorMessage(error: unknown, dealName?: string): string {
  const who = dealName ? `"${dealName}"` : "This deal";
  if (error instanceof CopsRequestError && error.envelope) {
    const env = error.envelope;
    if (env.code === "BUSINESS_STATE_CONFLICT") {
      const d = (env.details ?? {}) as { current_state?: { state?: string }; requested_state?: string; allowed_transitions?: string[] };
      const allowed = d.allowed_transitions ?? [];
      const next = allowed.length ? `It can move to ${allowed.map(label).join(" or ")} next.` : "It is closed and cannot move.";
      return `${who} can't go from ${label(d.current_state?.state)} to ${label(d.requested_state)}. ${next}`;
    }
    if (env.code === "FORBIDDEN") return `You don't have permission to move ${dealName ? who : "deals"}.`;
    if (env.code === "VALIDATION_FAILED") return env.message;
    return env.message;
  }
  return "Could not move this deal. Please try again.";
}

export const TIMELINE_TYPES = [
  "email",
  "call",
  "meeting",
  "note",
  "proposal",
  "contract",
  "payment",
  "provisioning",
  "product_milestone",
  "ticket",
  "workflow_action",
] as const;
export type TimelineType = (typeof TIMELINE_TYPES)[number];

export interface TimelineEvent {
  id: string;
  type: TimelineType;
  visibility: "public" | "internal";
  occurred_at: string;
  actor: { type: string; id: string | null };
  source_event_id: string;
  summary: string;
}

export interface Account360 {
  header?: {
    id: string;
    name: string;
    owner_id: string | null;
    lifecycle: { account: string | null; health: string | null; support: string | null };
    health: string | null;
    commercial_state: string | null;
    onboarding_pct: number | null;
    plan: string | null;
    renewal_at: string | null;
  };
  contacts?: Array<{ id: string; firstName: string; lastName: string | null; email: string | null }>;
  next_actions?: Array<{ id: string; title: string; type: string; dueDate: string | null; status: string }>;
  risks?: Array<{ dimension: string; state: string }>;
}

/** COPS-02 Customer 360 reads: GET /accounts/:id/360 and the cursor-paginated timeline. */
export function useCopsAccountApi() {
  const request = useApiFetch();
  return {
    get360(accountId: string) {
      return copsFetch<{ data: Account360 }>(`/api/v1/accounts/${accountId}/360`, undefined, { request });
    },
    timeline(accountId: string, opts: { types?: TimelineType[]; cursor?: string | null; limit?: number } = {}) {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 20) });
      if (opts.types?.length) params.set("type", opts.types.join(","));
      if (opts.cursor) params.set("cursor", opts.cursor);
      return copsFetch<{ data: TimelineEvent[]; next_cursor: string | null }>(
        `/api/v1/accounts/${accountId}/timeline?${params.toString()}`,
        undefined,
        { request }
      );
    },
  };
}

export interface AccountRow {
  id: string;
  name: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedView {
  id: string;
  name: string;
  object: "account" | "contact" | "opportunity" | "task";
  filters: Record<string, unknown>;
  sort: string | null;
  shared: boolean;
  mine: boolean;
}

export interface AccountListQuery {
  q?: string;
  ownerId?: string;
  sort?: "name" | "-created_at";
  viewId?: string;
  cursor?: string | null;
  limit?: number;
}

/** An account untouched for 30 days is flagged as stale on the CRM screen. */
export const STALE_AFTER_DAYS = 30;
export function isStale(updatedAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(updatedAt).getTime() > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/** COPS-02 account list, saved views and bulk owner reassignment. */
export function useCopsAccountListApi() {
  const request = useApiFetch();
  return {
    list(query: AccountListQuery) {
      const params = new URLSearchParams({ limit: String(query.limit ?? 25) });
      if (query.q) params.set("q", query.q);
      if (query.ownerId) params.set("owner_id", query.ownerId);
      if (query.sort) params.set("sort", query.sort);
      if (query.viewId) params.set("view_id", query.viewId);
      if (query.cursor) params.set("cursor", query.cursor);
      return copsFetch<{ data: AccountRow[]; next_cursor: string | null; applied_filters: Record<string, unknown> }>(
        `/api/v1/accounts?${params.toString()}`,
        undefined,
        { request }
      );
    },
    savedViews() {
      return copsFetch<{ data: SavedView[] }>("/api/v1/saved-views?object=account", undefined, { request });
    },
    saveView(input: { name: string; filters: Record<string, unknown>; sort?: string; shared: boolean }) {
      return copsFetch<{ data: { id: string } }>(
        "/api/v1/saved-views",
        { method: "POST", body: JSON.stringify({ ...input, object: "account" }) },
        { request }
      );
    },
    deleteView(id: string) {
      return copsFetch<void>(`/api/v1/saved-views/${id}`, { method: "DELETE" }, { request });
    },
    bulkReassign(ids: string[], ownerId: string, reason: string) {
      return copsFetch<{ data: { updated: number; updated_ids: string[]; skipped_ids: string[] } }>(
        "/api/v1/accounts/bulk-reassign",
        {
          method: "POST",
          headers: { "Idempotency-Key": newIdempotencyKey() },
          body: JSON.stringify({ ids, owner_id: ownerId, reason }),
        },
        { request }
      );
    },
  };
}

export interface NextAction {
  id: string;
  title: string;
  type: string;
  due_at: string | null;
}

/**
 * The next action per deal: its open task due soonest (tasks without a due date come last).
 * Built from one task list request, so the board makes a single call for every card.
 */
export function nextActionByDeal(
  tasks: Array<NextAction & { related_entity_id: string | null }>
): Map<string, NextAction> {
  const map = new Map<string, NextAction>();
  for (const t of tasks) {
    if (!t.related_entity_id) continue;
    const current = map.get(t.related_entity_id);
    const due = t.due_at ? new Date(t.due_at).getTime() : Infinity;
    const currentDue = current?.due_at ? new Date(current.due_at).getTime() : Infinity;
    if (!current || due < currentDue) map.set(t.related_entity_id, { id: t.id, title: t.title, type: t.type, due_at: t.due_at });
  }
  return map;
}

export function useCopsTasksApi() {
  const request = useApiFetch();
  return {
    /** Open tasks linked to deals, for the board's inline next actions. */
    openDealTasks() {
      return copsFetch<{ data: Array<NextAction & { related_entity_id: string | null }> }>(
        "/api/v1/tasks?status=open&related_type=deal&limit=100&fields=title,type,due_at,related_entity_id",
        undefined,
        { request }
      );
    },
  };
}
