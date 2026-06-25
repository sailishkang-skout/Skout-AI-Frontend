// Mirror of @skout/shared constants — values must match backend exactly

// ─── Contact constants ────────────────────────────────────────────────────────

export const INDUSTRIES: string[] = [
  "Software",
  "SaaS",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Professional Services",
  "Technology Hardware",
  "Telecommunications",
  "Media & Entertainment",
  "Education",
  "Real Estate",
  "Transportation & Logistics",
  "Energy & Utilities",
  "Government & Public Sector",
  "Non-Profit",
  "Hospitality & Travel",
  "Construction",
  "Pharmaceuticals & Life Sciences",
  "Consumer Goods",
];

export const COUNTRIES: { label: string; value: string }[] = [
  { label: "United States", value: "US" },
  { label: "United Kingdom", value: "GB" },
  { label: "Germany", value: "DE" },
  { label: "Canada", value: "CA" },
  { label: "Australia", value: "AU" },
  { label: "France", value: "FR" },
  { label: "India", value: "IN" },
  { label: "Singapore", value: "SG" },
  { label: "Netherlands", value: "NL" },
  { label: "United Arab Emirates", value: "AE" },
];

export const SENIORITY_OPTIONS: { label: string; value: string }[] = [
  { label: "Founder", value: "founder" },
  { label: "Co-Founder", value: "co_founder" },
  { label: "CEO", value: "ceo" },
  { label: "C-Level", value: "c_level" },
  { label: "VP", value: "vp" },
  { label: "Director", value: "director" },
  { label: "Head", value: "head" },
  { label: "Manager", value: "manager" },
  { label: "Individual Contributor", value: "individual_contributor" },
];

// Plain strings — label === API value
export const DEPARTMENT_OPTIONS: string[] = [
  "Sales",
  "Marketing",
  "Operations",
  "Engineering",
  "Product",
  "HR",
  "Finance",
  "Customer Success",
];

// Plain strings — label === API value
export const JOB_FUNCTION_OPTIONS: string[] = [
  "Demand Generation",
  "SDR",
  "AE",
  "RevOps",
  "Growth",
  "Product Marketing",
  "Recruiting",
  "Procurement",
];

export const YEARS_OPTIONS: { label: string; value: string }[] = [
  { label: "1+ year", value: "1" },
  { label: "2+ years", value: "2" },
  { label: "3+ years", value: "3" },
  { label: "5+ years", value: "5" },
  { label: "10+ years", value: "10" },
];

export const CONTACT_SIGNALS: { label: string; value: string }[] = [
  { label: "Recently Promoted", value: "recently_promoted" },
  { label: "Changed Jobs", value: "changed_jobs" },
  { label: "Posted on LinkedIn", value: "posted_on_linkedin" },
  { label: "Active on Social Media", value: "active_on_social_media" },
];

// ─── Company constants ────────────────────────────────────────────────────────

export const COMPANY_SIZE_BUCKETS: { label: string; value: string; min: number; max?: number }[] = [
  { label: "1–10", value: "1-10", min: 1, max: 10 },
  { label: "11–50", value: "11-50", min: 11, max: 50 },
  { label: "51–200", value: "51-200", min: 51, max: 200 },
  { label: "201–500", value: "201-500", min: 201, max: 500 },
  { label: "501–1k", value: "501-1000", min: 501, max: 1000 },
  { label: "1k+", value: "1000+", min: 1001 },
];

export const COMPANY_STAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Bootstrapped", value: "bootstrapped" },
  { label: "Seed", value: "seed" },
  { label: "Series A", value: "series_a" },
  { label: "Series B", value: "series_b" },
  { label: "Series C+", value: "series_c_plus" },
  { label: "Public", value: "public" },
];

export const LAST_FUNDING_ROUND_OPTIONS: { label: string; value: string }[] = [
  { label: "Pre-Seed", value: "pre_seed" },
  { label: "Seed", value: "seed" },
  { label: "Series A", value: "series_a" },
  { label: "Series B", value: "series_b" },
  { label: "Series C", value: "series_c" },
  { label: "Series D+", value: "series_d_plus" },
  { label: "IPO", value: "ipo" },
  { label: "Acquired", value: "acquired" },
];

export const REVENUE_RANGES: { label: string; value: string; min: number; max?: number }[] = [
  { label: "< $1M", value: "lt_1m", min: 0, max: 1_000_000 },
  { label: "$1M–$10M", value: "1m_10m", min: 1_000_000, max: 10_000_000 },
  { label: "$10M–$50M", value: "10m_50m", min: 10_000_000, max: 50_000_000 },
  { label: "$50M–$100M", value: "50m_100m", min: 50_000_000, max: 100_000_000 },
  { label: "$100M–$500M", value: "100m_500m", min: 100_000_000, max: 500_000_000 },
  { label: "$500M+", value: "500m_plus", min: 500_000_000 },
];

// Plain strings — label === API value
export const HIRING_DEPARTMENTS: string[] = [
  "Sales",
  "Engineering",
  "Marketing",
  "Customer Success",
  "Product",
  "Operations",
  "Finance",
  "HR",
];

export const COMPANY_SIGNALS: { label: string; value: string }[] = [
  { label: "Recent Funding", value: "recent_funding" },
  { label: "Leadership Change", value: "leadership_change" },
  { label: "New Product Launch", value: "new_product_launch" },
  { label: "Recent Hiring", value: "recent_hiring" },
  { label: "Expansion into New Markets", value: "expansion_new_markets" },
  { label: "Website Changes", value: "website_changes" },
];

export const BUYING_INTENT_OPTIONS: { label: string; value: string; minIntentScore: number }[] = [
  { label: "High intent (70+)", value: "high", minIntentScore: 70 },
  { label: "Medium intent (40+)", value: "medium", minIntentScore: 40 },
  { label: "Any intent (1+)", value: "low", minIntentScore: 1 },
];

export const HEADCOUNT_GROWTH_OPTIONS: { label: string; value: string; min: number }[] = [
  { label: "Growing 10%+", value: "10", min: 10 },
  { label: "Growing 5%+", value: "5", min: 5 },
  { label: "Flat or growing", value: "0", min: 0 },
];

export const EMAIL_PROVIDER_OPTIONS: { label: string; value: string }[] = [
  { label: "Google Workspace", value: "google_workspace" },
  { label: "Microsoft 365", value: "microsoft_365" },
  { label: "Other", value: "other" },
];

export const MAX_PER_COMPANY_OPTIONS: { label: string; value: string }[] = [
  { label: "1 per company", value: "1" },
  { label: "2 per company", value: "2" },
  { label: "3 per company", value: "3" },
  { label: "5 per company", value: "5" },
];

// ─── Unified UI-layer filter draft ───────────────────────────────────────────

export type FilterDraft = {
  // Person & contact
  fullName: string;
  jobTitle: string;
  department: string;
  seniority: string;
  emailAvailable: boolean;
  phoneAvailable: boolean;
  linkedInAvailable: boolean;
  jobFunction: string;
  minYearsAtCompany: string;
  minYearsInRole: string;
  minTotalYearsExperience: string;
  previousCompany: string;
  contactSignals: string[];
  jobChangeOnly: boolean;
  // Company — Basic
  companyName: string;
  companyDomain: string;
  keyword: string;
  industry: string;
  subIndustry: string;
  country: string;
  state: string;
  city: string;
  companySize: string;
  // Company — Stage & Funding
  companyStage: string;
  lastFundingRound: string;
  revenueRange: string;
  // Company — Hiring & signals
  currentlyHiring: boolean;
  hiringDepartments: string[];
  companySignals: string[];
  buyingIntent: string;
  tech: string;
  // Company attributes
  minFoundedYear: string;
  maxFoundedYear: string;
  headcountGrowth: string;
  companyEmailProvider: string;
  // Result controls
  excludeDuplicates: boolean;
  maxPerCompany: string;
};

export const EMPTY_FILTER_DRAFT: FilterDraft = {
  fullName: "",
  jobTitle: "",
  department: "",
  seniority: "",
  emailAvailable: false,
  phoneAvailable: false,
  linkedInAvailable: false,
  jobFunction: "",
  minYearsAtCompany: "",
  minYearsInRole: "",
  minTotalYearsExperience: "",
  previousCompany: "",
  contactSignals: [],
  jobChangeOnly: false,
  companyName: "",
  companyDomain: "",
  keyword: "",
  industry: "",
  subIndustry: "",
  country: "",
  state: "",
  city: "",
  companySize: "",
  companyStage: "",
  lastFundingRound: "",
  revenueRange: "",
  currentlyHiring: false,
  hiringDepartments: [],
  companySignals: [],
  buyingIntent: "",
  tech: "",
  minFoundedYear: "",
  maxFoundedYear: "",
  headcountGrowth: "",
  companyEmailProvider: "",
  excludeDuplicates: false,
  maxPerCompany: "",
};

export function countActiveFilters(draft: FilterDraft): number {
  const contactSignals = draft.jobChangeOnly
    ? Array.from(new Set([...draft.contactSignals, "changed_jobs"]))
    : draft.contactSignals;
  return [
    draft.fullName,
    draft.jobTitle,
    draft.department,
    draft.seniority,
    draft.jobFunction,
    draft.previousCompany,
    draft.minYearsAtCompany,
    draft.minYearsInRole,
    draft.minTotalYearsExperience,
    draft.companyName,
    draft.companyDomain,
    draft.keyword,
    draft.industry,
    draft.subIndustry,
    draft.country,
    draft.state,
    draft.city,
    draft.companySize,
    draft.companyStage,
    draft.lastFundingRound,
    draft.revenueRange,
    draft.buyingIntent,
    draft.tech,
    draft.minFoundedYear,
    draft.maxFoundedYear,
    draft.headcountGrowth,
    draft.companyEmailProvider,
    draft.maxPerCompany,
    draft.emailAvailable || undefined,
    draft.phoneAvailable || undefined,
    draft.linkedInAvailable || undefined,
    draft.currentlyHiring || undefined,
    draft.excludeDuplicates || undefined,
    draft.jobChangeOnly || undefined,
  ].filter(Boolean).length + contactSignals.length + draft.hiringDepartments.length + draft.companySignals.length;
}

export function countContactFilters(draft: FilterDraft): number {
  return countActiveFilters(draft);
}

export function countCompanyFilters(draft: FilterDraft): number {
  return countActiveFilters(draft);
}
