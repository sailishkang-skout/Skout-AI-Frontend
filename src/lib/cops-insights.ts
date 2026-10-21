import { useApiFetch } from "./api-client";
import { copsFetch } from "./cops-fetch";
import { formatMoney } from "./cops-commercial";

/**
 * COPS-13 dashboards, drill-through, funnel and AI recommendations. Mirrors
 * docs/api/copos-13-analytics-ai.openapi.yaml in Skout-AI-Backend.
 */
export const COPS_DASHBOARDS = ["leadership", "sales", "cs", "engineering", "finance"] as const;
export type CopsDashboard = (typeof COPS_DASHBOARDS)[number];
export const DASHBOARD_LABEL: Record<CopsDashboard, string> = { leadership: "Executive", sales: "Sales", cs: "Customer success", engineering: "Engineering", finance: "Finance" };

export type MetricUnit = "count" | "money" | "percent" | "minutes" | "score";

export interface MetricDefinition {
  id: string;
  version: number;
  label: string;
  definition: string;
  unit: MetricUnit;
  resource: string;
  source: "events" | "state";
  sourceEvents: string[];
  drill: "accounts" | "events";
  dashboards: CopsDashboard[];
}

export interface Kpi {
  metric_id: string;
  metric_version: number;
  label: string;
  unit: MetricUnit;
  value: number | null;
  by_currency?: { currency: string; value: number }[];
  numerator?: number;
  denominator?: number;
  restricted: boolean;
  window: { from: string; to: string };
}

export interface DashboardFilters {
  from?: string;
  to?: string;
  segment?: "smb" | "mid_market" | "enterprise";
  owner?: string;
  geo?: string;
}

export interface DashboardData {
  dashboard: CopsDashboard;
  window: { from: string; to: string };
  filters: DashboardFilters;
  kpis: Kpi[];
}

export interface DrillRow {
  account_id: string | null;
  account_name: string | null;
  record: { kind: string; id: string };
  value: number | null;
  currency: string | null;
  occurred_at: string | null;
  counted?: boolean;
  source_event_ids: string[];
}

export interface DrillData {
  metric_id: string;
  metric_version: number;
  window: { from: string; to: string };
  total: number;
  rows: DrillRow[];
  next_cursor: string | null;
}

export const FUNNEL_STAGES = ["qualified", "commercial", "provisioned", "first_login", "activated", "paid", "renewed"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  qualified: "Qualified",
  commercial: "Commercial",
  provisioned: "Provisioned",
  first_login: "First login",
  activated: "Activated",
  paid: "Paid",
  renewed: "Renewed",
};
export interface FunnelData {
  window: { from: string; to: string };
  stages: FunnelStage[];
  cohorts: { cohort: string; counts: Record<FunnelStage, number> }[];
}

export type RecommendationStatus = "pending" | "approved" | "dismissed" | "expired";
export interface EvidenceRef {
  kind: "health_score" | "ticket" | "subscription" | "invoice" | "provisioning" | "onboarding_signal" | "sla_clock" | "timeline_event";
  id: string;
  label: string;
}
export interface Recommendation {
  id: string;
  account_id: string;
  type: string;
  headline: string;
  rationale: string;
  evidence_refs: EvidenceRef[];
  suggested_action: { kind: "create_task" | "start_playbook" | "renewal_prep_task"; params: { title: string; priority: string; due_in_hours: number; assign_to: string } } | null;
  confidence: number | null;
  status: RecommendationStatus;
  source: "llm" | "rules" | null;
  evidence_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  effect: { kind: "task" | "workflow_run"; id: string; fallback?: string } | null;
  created_at: string;
}

const query = (f: DashboardFilters & { cursor?: string; limit?: number }) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export function useCopsInsightsApi() {
  const request = useApiFetch();
  const get = <T>(path: string) => copsFetch<{ data: T }>(path, undefined, { request });
  const post = <T>(path: string, body?: unknown) => copsFetch<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }, { request });
  return {
    catalog: () => get<MetricDefinition[]>("/api/v1/cops/metrics/catalog"),
    dashboard: (key: CopsDashboard, f: DashboardFilters) => get<DashboardData>(`/api/v1/cops/dashboards/${key}${query(f)}`),
    drill: (metricId: string, f: DashboardFilters & { cursor?: string; limit?: number }) => get<DrillData>(`/api/v1/cops/dashboards/kpis/${encodeURIComponent(metricId)}/drill${query(f)}`),
    funnel: (f: DashboardFilters) => get<FunnelData>(`/api/v1/cops/funnel${query(f)}`),
    recommendations: (accountId: string, status?: RecommendationStatus) =>
      get<Recommendation[]>(`/api/v1/accounts/${accountId}/recommendations${status ? `?status=${status}` : ""}`),
    generate: (accountId: string) => post<{ data: Recommendation[]; generated: number }>(`/api/v1/accounts/${accountId}/recommendations/generate`),
    approve: (id: string, note?: string) => post<{ data: Recommendation }>(`/api/v1/recommendations/${id}/approve`, note ? { note } : {}),
    dismiss: (id: string, reason: string) => post<{ data: Recommendation }>(`/api/v1/recommendations/${id}/dismiss`, { reason }),
  };
}

/** The KPI's headline as text: money per currency, percent, minutes, or a count. */
export function kpiText(k: Pick<Kpi, "unit" | "value" | "by_currency" | "restricted">): string {
  if (k.restricted) return "Restricted";
  if (k.unit === "money") {
    const parts = (k.by_currency ?? []).map((c) => formatMoney(c.value, c.currency));
    return parts.length ? parts.join(" + ") : "0";
  }
  if (k.value === null || k.value === undefined) return "—";
  if (k.unit === "percent") return `${Math.round(k.value * 1000) / 10}%`;
  if (k.unit === "minutes") return k.value >= 1440 ? `${(k.value / 1440).toFixed(1)}d` : k.value >= 60 ? `${(k.value / 60).toFixed(1)}h` : `${k.value}m`;
  return String(k.value);
}

/** Drill row value as text, in the KPI's unit. */
export function rowValueText(unit: MetricUnit, r: DrillRow): string {
  if (unit === "percent") return r.counted ? "Counted" : "Not yet";
  if (r.value === null) return "";
  if (unit === "money" && r.currency) return formatMoney(r.value, r.currency);
  if (unit === "minutes") return kpiText({ unit, value: r.value, restricted: false });
  return String(r.value);
}

export const RECOMMENDATION_LABEL: Record<string, string> = {
  renewal_risk: "Renewal risk",
  trial_not_activated: "Trial not activated",
  ticket_heavy: "Ticket-heavy",
  sla_breached: "SLA breached",
  payment_past_due: "Payment past due",
  expansion_signal: "Expansion",
  stalled_onboarding: "Onboarding stalled",
};

/** Where an evidence reference opens, when it has a page. */
export function evidenceHref(e: EvidenceRef, accountId: string): string | null {
  switch (e.kind) {
    case "ticket":
    case "sla_clock":
      return `/crm/360?mode=account&id=${accountId}&tab=engineering`;
    case "health_score":
      return `/crm/360?mode=account&id=${accountId}&tab=success`;
    case "subscription":
    case "invoice":
      return `/crm/360?mode=account&id=${accountId}&tab=billing`;
    case "provisioning":
    case "onboarding_signal":
      return `/crm/360?mode=account&id=${accountId}&tab=onboarding`;
    case "timeline_event":
      return `/crm/360?mode=account&id=${accountId}&tab=timeline`;
    default:
      return null;
  }
}

export const confidenceText = (c: number | null) => (c === null ? "—" : `${Math.round(c * 100)}%`);
export const confidenceTone = (c: number | null): "success" | "warning" | "info" => (c === null ? "info" : c >= 0.75 ? "success" : c >= 0.5 ? "warning" : "info");
