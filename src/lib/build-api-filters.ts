import {
  BUYING_INTENT_OPTIONS,
  HEADCOUNT_GROWTH_OPTIONS,
  REVENUE_RANGES,
  type FilterDraft,
} from "@/lib/search-constants";
import type { ProspectSearchFilters } from "@/types/api";

export function buildApiFilters(draft: FilterDraft): ProspectSearchFilters | undefined {
  const f: ProspectSearchFilters = {};

  if (draft.fullName) f.fullName = draft.fullName;
  if (draft.jobTitle) f.jobTitle = draft.jobTitle;
  if (draft.department) f.department = draft.department;
  if (draft.seniority) f.seniority = draft.seniority;
  if (draft.jobFunction) f.jobFunction = draft.jobFunction;
  if (draft.emailAvailable) f.emailAvailable = true;
  if (draft.phoneAvailable) f.phoneAvailable = true;
  if (draft.linkedInAvailable) f.linkedInAvailable = true;
  if (draft.minYearsAtCompany) f.minYearsAtCompany = Number(draft.minYearsAtCompany);
  if (draft.minYearsInRole) f.minYearsInRole = Number(draft.minYearsInRole);
  if (draft.minTotalYearsExperience) f.minTotalYearsExperience = Number(draft.minTotalYearsExperience);
  if (draft.previousCompany) f.previousCompany = draft.previousCompany;

  const contactSignals = [...draft.contactSignals];
  if (draft.jobChangeOnly && !contactSignals.includes("changed_jobs")) {
    contactSignals.push("changed_jobs");
  }
  if (contactSignals.length) f.contactSignals = contactSignals;

  if (draft.companyName) f.companyName = draft.companyName;
  if (draft.companyDomain) f.companyDomain = draft.companyDomain;
  if (draft.keyword) f.keyword = draft.keyword;
  if (draft.industries.length) f.industries = draft.industries;
  if (draft.subIndustry) f.subIndustry = draft.subIndustry;
  if (draft.country) f.country = draft.country;
  if (draft.state) f.state = draft.state;
  if (draft.city) f.city = draft.city;

  if (draft.companySizes.length) {
    // Pass exact employee buckets so backend can apply multi-select OR logic.
    f.employeeBuckets = draft.companySizes;
  }

  if (draft.companyStage) f.companyStage = draft.companyStage;
  if (draft.lastFundingRound) f.lastFundingRound = draft.lastFundingRound;
  if (draft.revenueRange) {
    const bucket = REVENUE_RANGES.find((b) => b.value === draft.revenueRange);
    if (bucket) {
      f.minRevenue = bucket.min;
      if (bucket.max !== undefined) f.maxRevenue = bucket.max;
    }
  }

  if (draft.currentlyHiring) f.currentlyHiring = true;
  if (draft.hiringDepartments.length) f.hiringDepartments = draft.hiringDepartments;
  if (draft.companySignals.length) f.companySignals = draft.companySignals;

  if (draft.buyingIntent) {
    const intent = BUYING_INTENT_OPTIONS.find((o) => o.value === draft.buyingIntent);
    if (intent) f.minIntentScore = intent.minIntentScore;
  }

  if (draft.tech) f.tech = draft.tech;
  if (draft.minFoundedYear) f.minFoundedYear = Number(draft.minFoundedYear);
  if (draft.maxFoundedYear) f.maxFoundedYear = Number(draft.maxFoundedYear);
  if (draft.headcountGrowth) {
    const growth = HEADCOUNT_GROWTH_OPTIONS.find((o) => o.value === draft.headcountGrowth);
    if (growth) f.minHeadcountGrowth = growth.min;
  }
  if (draft.companyEmailProvider) f.companyEmailProvider = draft.companyEmailProvider;
  if (draft.excludeDuplicates) f.excludeDuplicates = true;
  if (draft.maxPerCompany) f.maxPerCompany = Number(draft.maxPerCompany);

  return Object.keys(f).length ? f : undefined;
}
