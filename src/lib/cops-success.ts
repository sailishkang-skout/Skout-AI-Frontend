import { useApiFetch } from "./api-client";
import { copsFetch } from "./cops-fetch";

/** COPS-11 customer success: mirrors apps/api cops-health.service.ts and cops-success.routes.ts. */
export const HEALTH_DIMENSIONS = ["adoption", "relationship", "support", "commercial", "payment"] as const;
export type HealthDimension = (typeof HEALTH_DIMENSIONS)[number];
export type HealthState = "healthy" | "watch" | "at_risk";

export interface HealthFactor {
  dimension: HealthDimension;
  key: string;
  kind: "leading" | "lagging";
  value: number | string | null;
  points: number;
  reason: string;
}

export interface AccountHealth {
  id: string;
  score: number;
  state: HealthState;
  renewalRisk: "low" | "medium" | "high";
  dimensions: Record<HealthDimension, { score: number; weight: number }>;
  factors: HealthFactor[];
  modelVersion: number;
  computedAt: string;
}

export interface HealthPoint {
  score: number;
  state: HealthState;
  renewalRisk: string;
  computedAt: string;
}

export interface PlaybookEnrollment {
  runId: string;
  automationId: string;
  playbook: string;
  templateKey: string;
  version: number;
  status: string;
  accountId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface CustomerSuccessOverview {
  distribution: { healthy: number; watch: number; at_risk: number; unscored: number };
  renewalExposure: {
    accountId: string;
    name: string;
    termEnd: string;
    healthState: HealthState | null;
    renewalRisk: string | null;
    /** Annual value up for renewal, in minor units of `currency`. */
    arrMinor?: number;
    currency?: string;
  }[];
  adoption: {
    total: number;
    activated: number;
    signedIn: number;
    under50: number;
    avgPct: number;
    /** Each onboarding milestone and how many accounts reached it. */
    milestones?: { key: string; label: string; reached: number; total: number }[];
  };
  atRisk: {
    accountId: string;
    name: string;
    score: number | null;
    state: HealthState;
    renewalRisk: string | null;
    csmId?: string | null;
    reasons: string[];
    nextAction: { title: string; dueDate: string | null } | null;
  }[];
  expansionSignals: { accountId: string; name: string | null; evidence: string[]; at: string }[];
  playbooks: PlaybookEnrollment[];
}

export interface PlaybookInfo {
  key: string;
  name: string;
  description: string;
  automationId: string | null;
  status: string | null;
}

export const HEALTH_STATE_LABEL: Record<HealthState, string> = { healthy: "Healthy", watch: "Watch", at_risk: "At risk" };
export const HEALTH_STATE_TONE: Record<HealthState, "success" | "warning" | "danger"> = { healthy: "success", watch: "warning", at_risk: "danger" };

export function useCopsSuccessApi() {
  const request = useApiFetch();
  const get = <T>(path: string) => copsFetch<{ data: T }>(path, undefined, { request });
  const send = <T>(method: "POST" | "PUT", path: string, body?: unknown) =>
    copsFetch<{ data: T }>(path, { method, body: JSON.stringify(body ?? {}) }, { request });
  return {
    health: (accountId: string) => get<{ health: AccountHealth | null; csmId: string | null }>(`/api/v1/accounts/${accountId}/health`),
    history: (accountId: string, days = 180) => get<HealthPoint[]>(`/api/v1/accounts/${accountId}/health/history?days=${days}`),
    recompute: (accountId: string) => send<{ score: number; state: HealthState }>("POST", `/api/v1/accounts/${accountId}/health/recompute`),
    setCsm: (accountId: string, csmId: string | null) => send<{ csmId: string | null }>("PUT", `/api/v1/accounts/${accountId}/csm`, { csm_id: csmId }),
    overview: () => get<CustomerSuccessOverview>("/api/v1/customer-success/overview"),
    playbooks: () => get<PlaybookInfo[]>("/api/v1/customer-success/playbooks"),
    installPlaybooks: () => send<{ installed: string[]; total: number }>("POST", "/api/v1/customer-success/playbooks/install"),
    enrollments: (accountId?: string) =>
      get<PlaybookEnrollment[]>(`/api/v1/customer-success/playbooks/enrollments${accountId ? `?account_id=${accountId}` : ""}`),
  };
}
