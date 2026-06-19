import type { ListMemberDetail } from "@/types/api";

function parseSnapshot(m: ListMemberDetail): Record<string, unknown> {
  const raw = m.snapshot;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export function memberSnap(m: ListMemberDetail, key: string): string {
  const v = parseSnapshot(m)[key];
  return typeof v === "string" ? v.trim() : "";
}

function isUsableCompanyLabel(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v.length > 1 && v !== "name" && v !== "company" && v !== "unknown";
}

/** Prefer HubSpot/import fields over noisy firmographics nested company names. */
export function memberCompanyLabel(m: ListMemberDetail): string {
  const snap = parseSnapshot(m);
  const topName = typeof snap.companyName === "string" ? snap.companyName.trim() : "";
  if (topName && isUsableCompanyLabel(topName)) return topName;

  const domain = typeof snap.companyDomain === "string" ? snap.companyDomain.trim() : "";
  if (domain) return domain;

  const nested = snap.company;
  if (nested && typeof nested === "object" && "companyName" in nested) {
    const name = (nested as { companyName?: unknown }).companyName;
    if (typeof name === "string" && isUsableCompanyLabel(name)) return name.trim();
  }

  return "";
}

export function memberDisplayName(m: ListMemberDetail): string {
  const fullName = memberSnap(m, "fullName");
  if (fullName) return fullName;

  const email = memberSnap(m, "email");
  if (email) return email;

  const company = memberCompanyLabel(m);
  if (company) return company;

  return m.prospectId;
}

export function memberSubtitle(m: ListMemberDetail): string {
  const title = memberSnap(m, "title");
  const company = memberCompanyLabel(m);
  return [title, company].filter(Boolean).join(" · ");
}
