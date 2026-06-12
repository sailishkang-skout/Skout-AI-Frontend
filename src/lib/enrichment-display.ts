import type { FieldResult } from "@/types/api";

const FIELD_LABELS: Record<string, string> = {
  company: "Firmographics",
  email: "Email",
  email_status: "Email verification",
  phone: "Phone",
  validation: "Validation",
  industry: "Industry",
  country: "Country",
  employee_count: "Employees",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
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
