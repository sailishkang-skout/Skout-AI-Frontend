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
  | "approval";

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
  status: "pending" | "claimed" | "running" | "succeeded" | "failed" | "skipped";
  input: unknown;
  output: unknown;
  error: string | null;
  createdAt: string;
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

    listRuns: (id: string) => fetchApi<{ data: AutomationRun[] }>(`/api/v1/automations/${id}/runs`),

    getRun: (runId: string) =>
      fetchApi<{ data: { run: AutomationRun; steps: AutomationRunStep[] } }>(`/api/v1/automations/runs/${runId}`),

    retryRun: (runId: string) =>
      fetchApi<{ data: AutomationRun }>(`/api/v1/automations/runs/${runId}/retry`, { method: "POST" }),
  };
}
