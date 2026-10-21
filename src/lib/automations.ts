import { useApiFetch } from "./api-client";

/** Mirrors apps/api's automation-graph.ts NodeType union exactly. */
export type AutomationNodeType =
  | "trigger"
  | "condition"
  | "delay"
  | "action_http"
  | "action_notification"
  | "action_crm_writeback"
  | "action_sequence_enroll"
  | "action_ai"
  | "action_enrichment"
  | "action_crm_sync"
  | "action_create_task"
  | "action_create_ticket"
  | "action_update_fields"
  | "approval";

/** COPS-10: event types a workflow can start on or stop on. Mirrors COPS_PHASE1_EVENTS (packages/shared). */
export const WORKFLOW_EVENT_TYPES = [
  "OpportunityQualified", "ProposalSent", "ContractSent", "ContractSigned", "PaymentRequested", "PaymentSucceeded",
  "ProvisioningRequested", "WorkspaceProvisioned", "CreditsGranted", "WelcomeEmailSent", "SequenceEnrolled",
  "TaskCreated", "TaskCompleted", "ActivityRecorded", "FirstLogin", "ActivationMilestoneCompleted", "CustomerActivated",
  "TicketCreated", "TicketEscalated", "TicketResolved", "LifecycleTransitioned", "ApprovalRequested", "ApprovalDecided",
  "SubscriptionStatusChanged", "RenewalOpened", "HealthSignalDetected",
] as const;
export const STATE_CHANGE_EVENTS = ["LifecycleTransitioned", "SubscriptionStatusChanged"] as const;
export const MIN_SCHEDULE_MINUTES = 5;

export type TriggerKind = "manual" | "event" | "state_change" | "schedule";
export const CONDITION_OPS = ["equals", "not_equals", "gt", "gte", "lt", "lte", "contains", "not_contains", "in", "not_in", "exists", "not_exists"] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];
export const CONDITION_TYPES = ["string", "number", "date", "boolean"] as const;
export type ConditionValueType = (typeof CONDITION_TYPES)[number];
export interface ConditionRule {
  sourceNodeId: string;
  field: string;
  op: ConditionOp;
  value?: unknown;
  type?: ConditionValueType;
}
export interface ConditionGroup {
  match: "all" | "any";
  rules: (ConditionRule | ConditionGroup)[];
}
export function isConditionGroup(x: unknown): x is ConditionGroup {
  return typeof x === "object" && x !== null && Array.isArray((x as ConditionGroup).rules);
}
/** A condition node's config as a group; the older single-rule config becomes a one-rule group. */
export function toConditionGroup(config: Record<string, unknown>): ConditionGroup {
  if (isConditionGroup(config)) return { match: config.match ?? "all", rules: config.rules };
  const { sourceNodeId = "", field = "", op = "equals", value = "" } = config as Partial<ConditionRule>;
  return { match: "all", rules: [{ sourceNodeId, field, op, value, type: "string" }] };
}

export interface AutomationNode {
  id: string;
  type: AutomationNodeType;
  config: Record<string, unknown>;
  /** Canvas position — not sent to the backend's own graph validation, UI-only. */
  position?: { x: number; y: number };
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  branch?: "true" | "false";
}

export interface AutomationGraph {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

export interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationVersion {
  id: string;
  automationId: string;
  version: number;
  graph: AutomationGraph;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationVersionId: string;
  workspaceId: string;
  triggerType: "event" | "webhook" | "schedule" | "manual";
  triggerRef?: string | null;
  /** COPS-10: what started the run and what it is about. */
  triggerPayload?: Record<string, unknown> | null;
  subjectType?: "account" | "contact" | "deal" | null;
  subjectId?: string | null;
  /** Present on run-history rows. */
  version?: number;
  status: "pending" | "running" | "awaiting_approval" | "succeeded" | "failed" | "cancelled";
  isSimulation: boolean;
  correlationId: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AutomationRunStep {
  id: string;
  automationRunId: string;
  nodeId: string;
  attempt: number;
  status: "pending" | "claimed" | "running" | "succeeded" | "failed" | "skipped" | "outcome_unknown" | "awaiting_approval";
  attemptCount?: number;
  /** COPS-10: a waiting delay step is not run before this time. */
  runAfter?: string | null;
  input: unknown;
  output: unknown;
  error: string | null;
  createdAt: string;
}

export interface RunHistoryFilters {
  version?: number;
  accountId?: string;
  status?: AutomationRun["status"];
  before?: string;
}

export function useAutomationsApi() {
  const fetchApi = useApiFetch();
  return {
    list: () => fetchApi<{ data: Automation[] }>("/api/v1/automations"),

    get: (id: string) => fetchApi<{ data: Automation }>(`/api/v1/automations/${id}`),

    create: (input: { name: string; description?: string }) =>
      fetchApi<{ data: Automation }>("/api/v1/automations", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    update: (id: string, patch: { name?: string; description?: string }) =>
      fetchApi<{ data: Automation }>(`/api/v1/automations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),

    saveDraftVersion: (id: string, graph: AutomationGraph) =>
      fetchApi<{ data: AutomationVersion }>(`/api/v1/automations/${id}/versions`, {
        method: "POST",
        body: JSON.stringify({ graph }),
      }),

    publishVersion: (id: string, graph: AutomationGraph) =>
      fetchApi<{ data: AutomationVersion }>(`/api/v1/automations/${id}/versions/publish`, {
        method: "POST",
        body: JSON.stringify({ graph }),
      }),

    listVersions: (id: string) => fetchApi<{ data: AutomationVersion[] }>(`/api/v1/automations/${id}/versions`),

    run: (id: string, isSimulation?: boolean) =>
      fetchApi<{ data: AutomationRun }>(`/api/v1/automations/${id}/run`, {
        method: "POST",
        body: JSON.stringify({ isSimulation }),
      }),

    listRuns: (id: string, filters: RunHistoryFilters = {}) => {
      const q = new URLSearchParams();
      if (filters.version !== undefined) q.set("version", String(filters.version));
      if (filters.accountId) q.set("account_id", filters.accountId);
      if (filters.status) q.set("status", filters.status);
      if (filters.before) q.set("before", filters.before);
      const qs = q.toString();
      return fetchApi<{ data: AutomationRun[]; next_before: string | null }>(`/api/v1/automations/${id}/runs${qs ? `?${qs}` : ""}`);
    },

    rollback: (id: string, version: number) =>
      fetchApi<{ data: AutomationVersion & { restoredFrom: number } }>(`/api/v1/automations/${id}/versions/${version}/rollback`, { method: "POST" }),

    cancelRun: (runId: string, reason?: string) =>
      fetchApi<{ data: AutomationRun }>(`/api/v1/automations/runs/${runId}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),

    decideApproval: (runId: string, decision: "approve" | "reject", reason?: string) =>
      fetchApi<{ data: { runId: string; decision: string; nodeId: string } }>(`/api/v1/automations/runs/${runId}/approval`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      }),

    replayRun: (runId: string, version: "same" | "latest" = "same") =>
      fetchApi<{ data: AutomationRun }>(`/api/v1/automations/runs/${runId}/replay`, { method: "POST", body: JSON.stringify({ version }) }),

    getRun: (runId: string) =>
      fetchApi<{ data: { run: AutomationRun; steps: AutomationRunStep[] } }>(`/api/v1/automations/runs/${runId}`),

    retryRun: (runId: string) =>
      fetchApi<{ data: AutomationRun }>(`/api/v1/automations/runs/${runId}/retry`, { method: "POST" }),
  };
}
