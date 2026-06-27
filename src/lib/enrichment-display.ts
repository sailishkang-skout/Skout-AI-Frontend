import type { AttemptLog, EnrichmentJob, FieldResult } from "@/types/api";

const FIELD_LABELS: Record<string, string> = {
  company: "Firmographics",
  email: "Email",
  email_status: "Email verification",
  phone: "Phone",
  validation: "Email verification",
  industry: "Industry",
  country: "Country",
  employee_count: "Employees",
  phone_gate: "Phone score gate",
};

/** User-facing labels for internal provider identifiers. */
const PROVIDER_LABELS: Record<string, string> = {
  hunter: "Hunter",
  datagma: "Datagma",
  contactout: "ContactOut",
  explorium: "Explorium",
  revenuebase: "RevenueBase",
  kaspr: "Kaspr",
  lusha: "Lusha",
  millionverifier: "MillionVerifier",
  zerobounce: "ZeroBounce",
  neverbounce: "NeverBounce",
  "internal_graph": "Internal cache",
  "pattern-gen": "Pattern guess",
  "phone-gate": "Score gate",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Explicit verification source line for email_status / validation results. */
export function verificationSourceLine(result: FieldResult): string | null {
  if (result.field !== "validation" && result.field !== "email_status") return null;
  if (!result.provider) return null;
  const via = providerLabel(result.provider);
  const status = (result.validationStatus ?? result.value ?? "").toLowerCase();
  if (status === "valid") return `Verified via ${via}`;
  if (status) return `Checked via ${via} · ${result.validationStatus ?? result.value}`;
  return `Verification source: ${via}`;
}

export function resultValue(results: FieldResult[], field: string): string | undefined {
  return results.find((r) => r.field === field)?.value;
}

export function formatJobTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function shortId(id: string, len = 8): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

/** True when prospectId looks like a bare domain rather than a UUID/hash. */
export function looksLikeDomain(id: string): boolean {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(id.trim());
}

function formatFirmographics(json: Record<string, unknown>): string {
  const rows: string[] = [];
  const add = (label: string, key: string) => {
    const v = json[key];
    if (v == null || v === "") return;
    rows.push(`${label}: ${String(v)}`);
  };
  add("Company", "companyName");
  add("Industry", "industry");
  add("Sub-industry", "subIndustry");
  add("Employees", "employeeCount");
  add("Stage", "companyStage");
  add("HQ country", "hqCountry");
  add("HQ city", "hqCity");
  add("HQ state", "hqState");
  add("Revenue", "annualRevenue");
  add("Funding", "lastFundingRound");
  if (rows.length) return rows.join("\n");
  return Object.entries(json)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${String(v)}`)
    .join("\n");
}

function formatPhoneGate(json: Record<string, unknown>): string {
  const reason = typeof json.reason === "string" ? json.reason : undefined;
  const score = typeof json.leadScore === "number" ? json.leadScore : undefined;
  const gate = typeof json.gate === "number" ? json.gate : 80;
  if (reason) return reason;
  if (score != null) {
    return `Phone lookup skipped — ICP score ${score} is below the ${gate} threshold required for phone enrichment.`;
  }
  return "Phone lookup skipped — lead score below threshold.";
}

/** Human-readable display for a single enrichment field result. */
export function formatFieldResult(result: FieldResult): {
  text?: string;
  emptyMessage?: string;
  isMultiline?: boolean;
} {
  if (result.value) {
    return { text: result.value };
  }

  if (result.valueJson && typeof result.valueJson === "object" && !Array.isArray(result.valueJson)) {
    const json = result.valueJson as Record<string, unknown>;

    if ("providersTried" in json && Array.isArray(json.providersTried)) {
      return { emptyMessage: "No result from any provider." };
    }

    if (result.field === "company") {
      const text = formatFirmographics(json);
      return text ? { text, isMultiline: true } : { emptyMessage: "No firmographic data returned." };
    }

    if (result.field === "phone" && (result.provider === "phone-gate" || "gate" in json || "leadScore" in json)) {
      return { text: formatPhoneGate(json) };
    }

    if (result.field === "phone") {
      return { emptyMessage: "No phone number found for this prospect." };
    }

    if (result.field === "email") {
      return { emptyMessage: "No email address found." };
    }

    if (result.field === "validation" || result.field === "email_status") {
      return { emptyMessage: "Email could not be verified." };
    }
  }

  if (result.field === "phone") {
    return { emptyMessage: "No phone number found for this prospect." };
  }
  if (result.field === "email") {
    return { emptyMessage: "No email address found." };
  }
  if (result.field === "company") {
    return { emptyMessage: "No firmographic data returned." };
  }

  return { emptyMessage: "No data returned." };
}

/** Per-provider credit breakdown from attempt logs (when billing metadata is present). */
export function summarizeCredits(job: Pick<EnrichmentJob, "creditsUsed" | "attempts" | "results">): {
  total: number;
  lines: { label: string; credits?: number }[];
} {
  const lines: { label: string; credits?: number }[] = [];
  const billed = (job.attempts ?? []).filter((a) => a.status === "ok" || a.status === "success");
  for (const a of billed) {
    lines.push({
      label: `${providerLabel(a.provider)} · ${a.operation}`,
    });
  }
  if (!lines.length && job.results.length) {
    for (const r of job.results) {
      if (r.provider) lines.push({ label: providerLabel(r.provider) });
    }
  }
  return { total: job.creditsUsed, lines };
}

export function enrichmentSummaryLines(job: EnrichmentJob): string[] {
  const lines: string[] = [];
  for (const r of job.results) {
    const { text, emptyMessage } = formatFieldResult(r);
    const label = fieldLabel(r.field);
    if (text) lines.push(`${label}: ${text.split("\n")[0]}`);
    else if (emptyMessage) lines.push(`${label}: ${emptyMessage}`);
  }
  if (job.creditsUsed > 0) lines.push(`${job.creditsUsed} credit(s) used`);
  return lines;
}

export type { AttemptLog };
