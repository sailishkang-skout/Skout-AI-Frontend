/**
 * COPS-08 commercial policy as the admin screen edits it. Shapes mirror the backend config kinds
 * approval_policy, dunning_policy, price_book and renewal_policy
 * (Skout-AI-Backend packages/shared/src/cops-commercial-policy.ts). The server validates every
 * save; these helpers only turn the stored values into words and form fields.
 */
import { APPROVER_LABEL, type ApproverRole } from "./cops-commercial-advanced";

export const POLICY_KINDS = ["approval_policy", "dunning_policy", "price_book", "renewal_policy"] as const;
export type PolicyKind = (typeof POLICY_KINDS)[number];

export interface Band {
  over: number;
  up_to: number | null;
  approvers: ApproverRole[];
}
export interface ApprovalPolicy {
  expires_after_days: number;
  discount_pct: Band[];
  seats: Band[];
  contract_value_minor: Record<string, Band[] | null>;
  term_months: Band[];
  free_credits: Band[] | null;
  payment_terms_net_days: Band[];
  custom_clauses: { approvers: ApproverRole[] } | null;
  non_standard_sla: { approvers: ApproverRole[] } | null;
}
export interface DunningPolicy {
  stages: Array<{ state: "past_due" | "restricted" | "suspended" | "closed"; from_day: number }>;
  suspend_when_provider_halted: boolean;
  invoiced_accounts_auto_suspend: boolean;
}
export interface PriceBook {
  month_to_month_surcharge_pct: number;
  currencies: Record<string, { seat_month_annual_minor: number; status: "benchmarked" | "suggested" | "confirmed" }>;
}
export interface RenewalPolicy {
  lead_days: number;
}

/** The band rules of an approval policy, in the order the screen shows them. */
export const BAND_RULES = [
  { key: "discount_pct", label: "Discount", unit: "%" },
  { key: "seats", label: "Seats", unit: "seats" },
  { key: "term_months", label: "Term", unit: "months" },
  { key: "payment_terms_net_days", label: "Payment terms", unit: "days (net)" },
  { key: "free_credits", label: "Free credits", unit: "credits" },
] as const;
export type BandRuleKey = (typeof BAND_RULES)[number]["key"];

const names = (roles: ApproverRole[]) => roles.map((r) => APPROVER_LABEL[r]).join(" + ") || "nobody";

/** "over 10 up to 20: Sales Manager". One line per band, so a threshold can be read at a glance. */
export function describeBand(band: Band, format: (n: number) => string = String): string {
  const range = band.up_to == null ? `over ${format(band.over)}` : `over ${format(band.over)} up to ${format(band.up_to)}`;
  return `${range}: ${names(band.approvers)}`;
}

/** Why a set of bands would be refused, or null. The server checks the same things; this only saves a round trip. */
export function bandsProblem(bands: Band[]): string | null {
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i]!;
    if (!Number.isFinite(band.over) || band.over < 0) return "Every band needs a starting value of 0 or more.";
    if (band.up_to != null && band.up_to <= band.over) return "A band must end above where it starts.";
    if (band.approvers.length === 0) return "Every band needs at least one approver.";
    const previous = bands[i - 1];
    if (previous && previous.up_to == null) return "Only the last band can have no upper limit.";
    if (previous && previous.up_to != null && band.over < previous.up_to) return "Bands must go up without overlapping.";
  }
  return null;
}

/** The first problem anywhere in an approval policy, naming the rule, or null. */
export function approvalPolicyProblem(policy: ApprovalPolicy): string | null {
  if (!Number.isInteger(policy.expires_after_days) || policy.expires_after_days < 1 || policy.expires_after_days > 365) return "Approvals must lapse after 1 to 365 days.";
  for (const rule of BAND_RULES) {
    const bands = policy[rule.key];
    const problem = bands ? bandsProblem(bands) : null;
    if (problem) return `${rule.label}: ${problem}`;
  }
  for (const [currency, bands] of Object.entries(policy.contract_value_minor)) {
    const problem = bands ? bandsProblem(bands) : null;
    if (problem) return `Contract value (${currency}): ${problem}`;
  }
  return null;
}

/** Day each stage starts, for the three editable stages (past due always starts on day 0). */
export function dunningDays(policy: DunningPolicy): { restricted: number; suspended: number; closed: number } {
  const day = (state: string) => policy.stages.find((s) => s.state === state)?.from_day ?? 0;
  return { restricted: day("restricted"), suspended: day("suspended"), closed: day("closed") };
}
export function withDunningDays(policy: DunningPolicy, days: { restricted: number; suspended: number; closed: number }): DunningPolicy {
  return {
    ...policy,
    stages: [
      { state: "past_due", from_day: 0 },
      { state: "restricted", from_day: days.restricted },
      { state: "suspended", from_day: days.suspended },
      { state: "closed", from_day: days.closed },
    ],
  };
}
export function dunningProblem(days: { restricted: number; suspended: number; closed: number }): string | null {
  const all = [days.restricted, days.suspended, days.closed];
  if (!all.every((d) => Number.isInteger(d) && d >= 1)) return "Each stage needs a whole day number of 1 or more.";
  if (!(days.restricted < days.suspended && days.suspended < days.closed)) return "The stages must come in order: restricted, then suspended, then closed.";
  return null;
}

export const toMajor = (minor: number) => minor / 100;
export const toMinor = (major: number) => Math.round(major * 100);
