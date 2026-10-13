import { useApiFetch } from "@/lib/api-client";
import { withCopsTracking } from "./cops-analytics";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";
import { newIdempotencyKey } from "./cops-provisioning";

/**
 * COPS-07 frontend client: admin configuration, retention and operations.
 * Contract: Skout-AI-Backend docs/api/copos-07-admin.openapi.yaml.
 */
export const CONFIG_KINDS = ["trial_template", "credit_package", "email_template", "retention_policy", "feature_flags"] as const;
export type ConfigKind = (typeof CONFIG_KINDS)[number];

export const RETENTION_CATEGORIES = ["core_records", "communications", "attachments", "audit_logs", "diagnostics", "ai_traces", "tombstones"] as const;
export const COPS_MODULES = ["crm", "commercial", "provisioning", "onboarding", "tickets"] as const;
export const GATE_POLICIES = ["trial_approval_only", "signature", "payment", "signature+payment", "manual_override"] as const;

export interface ConfigVersion {
  kind: ConfigKind;
  key: string;
  version: number;
  value: Record<string, unknown>;
  reason: string | null;
  restored_from_version: number | null;
  created_by: string | null;
  created_at: string | null;
  is_system_default: boolean;
}

export interface TrialTemplate {
  key: string;
  version: number;
  name: string;
  plan: string;
  trial_days: number;
  credits: number;
  integrations: string[];
}

export interface RetentionRun {
  id: string;
  mode: "dry_run" | "apply";
  policy_version: number;
  counts: Record<string, { category: string; days: number; rows: number }>;
  total_rows: number;
  dry_run_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface InventoryRow {
  table: string;
  category: string;
  tags: string[];
  retention: "automatic" | "dsar_only";
}

export interface OpsMetric {
  key: string;
  label: string;
  value: number | null;
  unit: "seconds" | "count" | "ms" | "percent";
  warn_at: number | null;
  critical_at: number | null;
  status: "ok" | "warn" | "critical";
  runbook: string;
}

export interface ActivationTemplate {
  id: string;
  key: string;
  version: number;
  segment: string | null;
  milestones: { key: string; label: string; weight: number; required: boolean; source: string; event_types: string[] }[];
  is_system_default: boolean;
  created_at: string;
}

/** One editable field of a config kind. `list` is a comma-separated list of strings. */
export interface ConfigField {
  name: string;
  label: string;
  type: "text" | "number" | "boolean" | "longtext" | "list";
  required?: boolean;
  help?: string;
}

export const CONFIG_FIELDS: Record<"trial_template" | "credit_package" | "email_template", ConfigField[]> = {
  trial_template: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "plan", label: "Plan", type: "text", required: true },
    { name: "trial_days", label: "Trial length (days)", type: "number", required: true, help: "1 to 90" },
    { name: "credits", label: "Trial credits", type: "number", required: true },
    { name: "integrations", label: "Integrations", type: "list", help: "crm, email, calendar" },
  ],
  credit_package: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "credits", label: "Credits", type: "number", required: true },
    { name: "price_minor", label: "Price (minor units)", type: "number", required: true, help: "For example cents or paise" },
    { name: "currency", label: "Currency", type: "text", required: true, help: "Three letters, for example USD" },
    { name: "active", label: "Offered to reps", type: "boolean" },
  ],
  email_template: [
    { name: "subject", label: "Subject", type: "text", required: true, help: "{{workspace}} becomes the customer workspace name" },
    { name: "intro", label: "Opening paragraph", type: "longtext", required: true },
    { name: "closing", label: "Closing paragraph (optional)", type: "longtext" },
  ],
};

export const CONFIG_EMPTY: Record<"trial_template" | "credit_package" | "email_template", Record<string, unknown>> = {
  trial_template: { name: "", plan: "trial", trial_days: 14, credits: 500, integrations: ["crm", "email"] },
  credit_package: { name: "", credits: 1000, price_minor: 0, currency: "USD", active: true },
  email_template: { subject: "", intro: "" },
};

export function useCopsAdminApi() {
  const request = useApiFetch();
  const get = <T>(path: string) => copsFetch<T>(path, undefined, { request });
  const write = <T>(method: "POST" | "PUT", path: string, body: unknown, key: string = newIdempotencyKey()) =>
    copsFetch<T>(path, { method, headers: { "Idempotency-Key": key }, body: JSON.stringify(body ?? {}) }, { request });
  return {
    list: (kind: ConfigKind) => get<{ data: ConfigVersion[] }>(`/api/v1/admin/config/${kind}`),
    versions: (kind: ConfigKind, key: string) => get<{ data: ConfigVersion[] }>(`/api/v1/admin/config/${kind}/${key}/versions`),
    save: (kind: ConfigKind, key: string, value: Record<string, unknown>, reason: string, expectedVersion?: number) =>
      withCopsTracking(
        "cops.admin_config_saved",
        () => write<{ data: ConfigVersion }>("PUT", `/api/v1/admin/config/${kind}/${key}`, { value, reason, ...(expectedVersion !== undefined ? { expected_version: expectedVersion } : {}) }),
        { kind, key }
      ),
    rollback: (kind: ConfigKind, key: string, version: number, reason: string) =>
      withCopsTracking("cops.admin_config_rolled_back", () => write<{ data: ConfigVersion }>("POST", `/api/v1/admin/config/${kind}/${key}/rollback`, { version, reason }), { kind, key, version }),
    trialTemplates: () => get<{ data: TrialTemplate[] }>("/api/v1/trial-templates"),
    modules: () => get<{ data: Record<string, boolean> }>("/api/v1/cops/modules"),
    activationTemplates: () => get<{ data: ActivationTemplate[] }>("/api/v1/admin/activation-templates"),
    newActivationVersion: (key: string, body: { segment?: string | null; milestones: unknown; reason: string }) =>
      write<{ data: ActivationTemplate }>("POST", `/api/v1/admin/activation-templates/${key}/versions`, body),
    gatePolicies: () => get<{ data: { deal_type: string; policy: string }[] }>("/api/v1/commercial/gate-policies"),
    setGatePolicy: (dealType: string, policy: string) => write<{ data: unknown }>("PUT", "/api/v1/commercial/gate-policies", { deal_type: dealType, policy }),
    inventory: () => get<{ data: InventoryRow[] }>("/api/v1/admin/data-inventory"),
    retentionRuns: () => get<{ data: RetentionRun[]; targets: { table: string; category: string }[] }>("/api/v1/admin/retention/runs"),
    retentionRun: (body: { mode: "dry_run" | "apply"; dry_run_id?: string; reason?: string }) =>
      withCopsTracking("cops.retention_run_started", () => write<{ data: RetentionRun }>("POST", "/api/v1/admin/retention/runs", body), { mode: body.mode }),
    metrics: () => get<{ data: { generated_at: string; metrics: OpsMetric[] } }>("/api/v1/admin/ops/metrics"),
  };
}

// ---- Pure helpers ----

export const humanizeAdmin = (v: string) => v.replace(/[_+]/g, " ");

/** Turns the form's strings into the typed value the API validates. */
export function formToValue(fields: ConfigField[], form: Record<string, string | boolean>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = form[f.name];
    if (f.type === "boolean") out[f.name] = Boolean(raw);
    else if (f.type === "number") out[f.name] = raw === "" || raw === undefined ? undefined : Number(raw);
    else if (f.type === "list") out[f.name] = String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (String(raw ?? "").trim() !== "" || f.required) out[f.name] = String(raw ?? "").trim();
  }
  return out;
}

export function valueToForm(fields: ConfigField[], value: Record<string, unknown>): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of fields) {
    const v = value[f.name];
    out[f.name] = f.type === "boolean" ? v !== false : Array.isArray(v) ? v.join(", ") : v === undefined || v === null ? "" : String(v);
  }
  return out;
}

export function formatMetric(m: Pick<OpsMetric, "value" | "unit">): string {
  if (m.value == null) return "No data";
  if (m.unit === "ms") return m.value >= 1000 ? `${(m.value / 1000).toFixed(1)} s` : `${m.value} ms`;
  if (m.unit === "seconds") return m.value >= 120 ? `${Math.round(m.value / 60)} min` : `${m.value} s`;
  return m.unit === "percent" ? `${m.value}%` : String(m.value);
}

export function adminErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof CopsRequestError) || !error.envelope) return fallback;
  const env = error.envelope;
  if (env.code === "FORBIDDEN") return "Only a workspace admin can change this.";
  if (env.code === "VALIDATION_FAILED") {
    const field = (env.details as { fields?: { path: string; message: string }[] } | null)?.fields?.[0];
    return field ? `${field.path.replace(/^value\./, "").replace(/_/g, " ")}: ${field.message}` : env.message || fallback;
  }
  if (env.code === "BUSINESS_STATE_CONFLICT" || env.code === "NOT_FOUND") return env.message || fallback;
  return fallback;
}
