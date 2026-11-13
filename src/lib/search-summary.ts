import {
  BUYING_INTENT_OPTIONS,
  COMPANY_SIGNALS,
  COMPANY_SIZE_BUCKETS,
  COMPANY_STAGE_OPTIONS,
  CONTACT_SIGNALS,
  COUNTRIES,
  EMAIL_PROVIDER_OPTIONS,
  EMPTY_FILTER_DRAFT,
  HEADCOUNT_GROWTH_OPTIONS,
  LAST_FUNDING_ROUND_OPTIONS,
  MAX_PER_COMPANY_OPTIONS,
  REVENUE_RANGES,
  SENIORITY_OPTIONS,
  YEARS_OPTIONS,
  type FilterDraft,
} from "@/lib/search-constants";

type Option = { label: string; value: string };

/** Stored values are codes (e.g. "c_level", "1m_10m"); show the label the filter UI shows. */
const OPTION_LABELS: Partial<Record<keyof FilterDraft, Option[]>> = {
  seniority: SENIORITY_OPTIONS,
  country: COUNTRIES,
  revenueRange: REVENUE_RANGES,
  companyStage: COMPANY_STAGE_OPTIONS,
  lastFundingRound: LAST_FUNDING_ROUND_OPTIONS,
  buyingIntent: BUYING_INTENT_OPTIONS,
  headcountGrowth: HEADCOUNT_GROWTH_OPTIONS,
  companyEmailProvider: EMAIL_PROVIDER_OPTIONS,
  maxPerCompany: MAX_PER_COMPANY_OPTIONS,
  minYearsAtCompany: YEARS_OPTIONS,
  minYearsInRole: YEARS_OPTIONS,
  minTotalYearsExperience: YEARS_OPTIONS,
  companySizes: COMPANY_SIZE_BUCKETS,
  contactSignals: CONTACT_SIGNALS,
  companySignals: COMPANY_SIGNALS,
};

export function labelFor(key: keyof FilterDraft, value: string): string {
  return OPTION_LABELS[key]?.find((o) => o.value === value)?.label ?? value;
}

export type SearchChip = {
  /** Stable id: the FilterDraft field this chip comes from, or "query" for the free-text box. */
  key: keyof FilterDraft | "query";
  label: string;
  value: string;
};

const TEXT_LABELS: Partial<Record<keyof FilterDraft, string>> = {
  fullName: "Name",
  jobTitle: "Job title",
  department: "Department",
  seniority: "Seniority",
  jobFunction: "Function",
  previousCompany: "Previous company",
  minYearsAtCompany: "Min years at company",
  minYearsInRole: "Min years in role",
  minTotalYearsExperience: "Min experience (yrs)",
  companyName: "Company",
  companyDomain: "Domain",
  keyword: "Keyword",
  subIndustry: "Sub-industry",
  country: "Country",
  state: "State",
  city: "City",
  companyStage: "Stage",
  lastFundingRound: "Funding round",
  revenueRange: "Revenue",
  buyingIntent: "Buying intent",
  tech: "Technology",
  minFoundedYear: "Founded after",
  maxFoundedYear: "Founded before",
  headcountGrowth: "Headcount growth",
  companyEmailProvider: "Email provider",
  maxPerCompany: "Max per company",
};

const LIST_LABELS: Partial<Record<keyof FilterDraft, string>> = {
  industries: "Industry",
  companySizes: "Company size",
  contactSignals: "Contact signals",
  hiringDepartments: "Hiring for",
  companySignals: "Company signals",
};

const FLAG_LABELS: Partial<Record<keyof FilterDraft, string>> = {
  emailAvailable: "Has email",
  phoneAvailable: "Has phone",
  linkedInAvailable: "Has LinkedIn",
  currentlyHiring: "Currently hiring",
  excludeDuplicates: "Excluding duplicates",
  jobChangeOnly: "Changed jobs recently",
};

/** One human-readable chip per active filter, plus one for the free-text query. */
export function describeSearch(query: string, filters: FilterDraft): SearchChip[] {
  const chips: SearchChip[] = [];
  const q = query.trim();
  if (q) chips.push({ key: "query", label: "Search", value: q });

  for (const [key, label] of Object.entries(TEXT_LABELS) as [keyof FilterDraft, string][]) {
    const v = filters[key];
    if (typeof v === "string" && v.trim()) chips.push({ key, label, value: labelFor(key, v.trim()) });
  }
  for (const [key, label] of Object.entries(LIST_LABELS) as [keyof FilterDraft, string][]) {
    const v = filters[key];
    if (Array.isArray(v) && v.length) chips.push({ key, label, value: v.map((x) => labelFor(key, x)).join(", ") });
  }
  for (const [key, label] of Object.entries(FLAG_LABELS) as [keyof FilterDraft, string][]) {
    if (filters[key] === true) chips.push({ key, label, value: "Yes" });
  }
  return chips;
}

/** Returns the filters with one field reset to its empty value. */
export function clearFilterField(filters: FilterDraft, key: keyof FilterDraft): FilterDraft {
  return { ...filters, [key]: EMPTY_FILTER_DRAFT[key] };
}
