import { useApiFetch } from "@/lib/api-client";
import { copsFetch, CopsRequestError } from "@/lib/cops-fetch";

/**
 * COPS-04 trial provisioning + credit wallet client. Contract: Skout-AI-Backend
 * docs/api/copos-04-provisioning.openapi.yaml.
 */

export const PROVISIONING_STEPS = [
  "create_workspace",
  "default_roles",
  "entitlements",
  "credit_wallet",
  "integration_placeholders",
  "admin_invite",
  "link_crm",
] as const;
export type ProvisioningStepName = (typeof PROVISIONING_STEPS)[number];

export const STEP_LABEL: Record<ProvisioningStepName, string> = {
  create_workspace: "Create workspace",
  default_roles: "Default roles",
  entitlements: "Plan and trial dates",
  credit_wallet: "Credit wallet",
  integration_placeholders: "Integration placeholders",
  admin_invite: "Admin invitation",
  link_crm: "Link to CRM account",
};

export const INTEGRATIONS = ["crm", "email", "calendar"] as const;
export type Integration = (typeof INTEGRATIONS)[number];

/** Bible p.4: a standard trial is provisioned in under 2 minutes. */
export const PROVISIONING_TARGET_MS = 120_000;
/** While a provision request is in flight, the steps are re-read this often to show progress. */
export const PROGRESS_POLL_MS = 1_000;

export type StepStatus = "pending" | "running" | "succeeded" | "failed";

export interface ProvisioningStep {
  step: ProvisioningStepName;
  status: StepStatus;
  attempts: number;
  error: string | null;
  duration_ms: number | null;
  finished_at: string | null;
}

export interface Provisioning {
  id: string;
  account_id: string;
  opportunity_id: string;
  status: StepStatus;
  provisioned_workspace_id: string | null;
  invite_id: string | null;
  admin_invite: { email: string; accepted_at: string | null; expires_at: string; accept_url: string | null } | null;
  plan: string;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  credits: number;
  integrations: Integration[];
  attempts: number;
  last_error: string | null;
  duration_ms: number | null;
  within_target: boolean | null;
  created_at: string;
  completed_at: string | null;
  steps: ProvisioningStep[];
}

export interface ProvisionInput {
  opportunity_id: string;
  admin_email: string;
  workspace_name?: string;
  plan: string;
  trial_days: number;
  credits: number;
  integrations: Integration[];
}

export type CreditKind = "grant" | "purchase" | "consume" | "refund" | "expire" | "adjustment";

export interface LedgerEntry {
  id: string;
  seq: number | null;
  kind: CreditKind;
  amount: number;
  balance_after: number | null;
  action: string;
  reason: string | null;
  actor_type: string | null;
  actor_id: string | null;
  reference_id: string | null;
  compensates_id: string | null;
  created_at: string;
}

export interface Wallet {
  workspace_id: string;
  provisioning_id: string;
  balance: number;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  ledger: LedgerEntry[];
  next_cursor: string | null;
  usage: Array<{ day: string; consumed: number }>;
}

/** Permission keys per action, mirroring the backend route gates. */
export const PROVISIONING_PERMS = {
  read: ["onboarding:read", "commercial:read", "credits:read"],
  write: ["onboarding:write", "commercial:send"],
  adjust: ["credits:adjust"],
} as const;

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `web-${crypto.randomUUID()}`
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useCopsProvisioningApi() {
  const request = useApiFetch();
  const post = <T>(path: string, body: unknown, key: string = newIdempotencyKey()) =>
    copsFetch<{ data: T }>(path, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body ?? {}) }, { request });
  return {
    /** Opportunities of the account for the provision form (CRM list, crm:read). */
    opportunities: (accountId: string) =>
      copsFetch<{ data: Array<{ id: string; name: string; status: string }> }>(
        `/api/v1/opportunities?company_id=${accountId}&fields=id,name,status&limit=50`,
        undefined,
        { request }
      ),
    listProvisionings: (accountId: string) =>
      copsFetch<{ data: Provisioning[] }>(`/api/v1/accounts/${accountId}/provisioning`, undefined, { request }),
    /**
     * The key is chosen by the caller and kept for the whole form: re-submitting with the same key
     * returns (and resumes) the same provisioning, never a second workspace.
     */
    provision: (accountId: string, body: ProvisionInput, key: string) => post<Provisioning>(`/api/v1/accounts/${accountId}/provision`, body, key),
    retry: (provisioningId: string) => post<Provisioning>(`/api/v1/provisionings/${provisioningId}/retry`, {}),
    wallet: (accountId: string, cursor?: string | null) =>
      copsFetch<{ data: Wallet }>(
        `/api/v1/accounts/${accountId}/credits${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        undefined,
        { request }
      ),
    grant: (accountId: string, body: { amount: number; reason: string }, key: string) =>
      post<LedgerEntry & { balance: number }>(`/api/v1/accounts/${accountId}/credits/grants`, body, key),
    adjust: (accountId: string, body: { amount: number; reason: string; compensates_id?: string }, key: string) =>
      post<LedgerEntry & { balance: number }>(`/api/v1/accounts/${accountId}/credits/adjustments`, body, key),
    extendTrial: (accountId: string, body: { days: number; reason: string }) =>
      post<{ trial_starts_at: string; trial_ends_at: string }>(`/api/v1/accounts/${accountId}/trial/extend`, body),
  };
}

// ---- Pure helpers ----

/** The provisioning a failed saga answers with (502 carries `data` next to the error envelope). */
export function provisioningFromError(error: unknown): Provisioning | null {
  if (!(error instanceof CopsRequestError)) return null;
  const cause = error.cause as { body?: unknown } | undefined;
  const body = cause?.body as { data?: Provisioning } | undefined;
  return body?.data && Array.isArray(body.data.steps) ? body.data : null;
}

/** Steps in saga order, filling in pending ones the server has not returned yet. */
export function orderedSteps(steps: ProvisioningStep[] | undefined): ProvisioningStep[] {
  return PROVISIONING_STEPS.map(
    (step) => steps?.find((s) => s.step === step) ?? { step, status: "pending", attempts: 0, error: null, duration_ms: null, finished_at: null }
  );
}

export function stepProgress(steps: ProvisioningStep[] | undefined): { done: number; total: number; pct: number } {
  const total = PROVISIONING_STEPS.length;
  const done = orderedSteps(steps).filter((s) => s.status === "succeeded").length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

/** Whole days left in the trial, never negative; null when there is no end date. */
export function trialDaysLeft(endsAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

export const KIND_LABEL: Record<CreditKind, string> = {
  grant: "Grant",
  purchase: "Purchase",
  consume: "Usage",
  refund: "Refund",
  expire: "Expired",
  adjustment: "Adjustment",
};

export function kindTone(kind: CreditKind): "success" | "warning" | "danger" | "info" | "muted" {
  if (kind === "grant" || kind === "purchase" || kind === "refund") return "success";
  if (kind === "consume") return "info";
  if (kind === "expire") return "muted";
  return "warning";
}

/** Thirty days ending today, zero-filled, for the usage chart. */
export function usageSeries(usage: Wallet["usage"], now: Date = new Date()): Array<{ date: string; value: number }> {
  const byDay = new Map(usage.map((u) => [u.day, u.consumed]));
  const out: Array<{ date: string; value: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: byDay.get(key) ?? 0 });
  }
  return out;
}

/** Plain-language message for a failed provisioning or wallet action. */
export function provisioningErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CopsRequestError && error.envelope) {
    const env = error.envelope;
    switch (env.code) {
      case "FORBIDDEN":
        return "You don't have permission for this action.";
      case "GATE_CLOSED":
        return "This opportunity's commercial gate has not opened yet. Approve the trial or complete signature/payment first.";
      case "ALREADY_PROVISIONED":
        return "This account already has a provisioned workspace.";
      case "PROVISIONING_IN_PROGRESS":
        return "A provisioning for this account is already in progress or waiting for a retry.";
      case "INSUFFICIENT_CREDITS":
        return "That adjustment would take the balance below zero.";
      case "NOT_PROVISIONED":
        return "This account has no provisioned workspace yet.";
      case "IDEMPOTENCY_KEY_REUSED":
        return "The form changed after it was submitted. Close it and start again.";
      case "VALIDATION_FAILED": {
        const fields = (env.details as { fields?: Array<{ path: string; message: string }> } | null)?.fields;
        return fields?.length ? fields.map((f) => `${f.path}: ${f.message}`).join("; ") : env.message;
      }
      default:
        return env.message;
    }
  }
  return fallback;
}
