/** Shared API types — mirror @skout/shared when backend package is linked */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface ProspectSummary {
  prospectId: string;
  companyId: string;
  fullName: string;
  title: string;
  seniority: string;
  country: string;
  industry: string;
  companyDomain: string;
  companyName?: string;
  recordType?: "person" | "company";
  employeeCount?: number;
  icpScore?: number;
  intentScore?: number;
  painPoints?: string[];
  outreachReadiness?: string;
  signals?: Array<{ type: string; observedAt: string; detail?: string }>;
  techStack?: Array<{ category: string; technology: string }>;
  updatedAt?: string;
}

/** Full prospect record from GET /search/prospects/:id */
export interface ProspectDetail extends ProspectSummary {
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  department?: string;
  jobFunction?: string;
  subIndustry?: string;
  state?: string;
  city?: string;
  employeeBucket?: string;
  companyStage?: string;
  annualRevenue?: number;
  lastFundingRound?: string;
  lastFundingDate?: string;
  totalFunding?: number;
  currentlyHiring?: boolean;
  foundedYear?: number;
  headcountGrowth?: number;
  companyEmailProvider?: string;
  yearsAtCompany?: number;
  yearsInRole?: number;
  totalYearsExperience?: number;
  previousCompany?: string;
}

export interface ProspectSearchFilters {
  // Contact
  fullName?: string;
  jobTitle?: string;
  department?: string;
  seniority?: string;
  jobFunction?: string;
  emailAvailable?: boolean;
  phoneAvailable?: boolean;
  linkedInAvailable?: boolean;
  // Experience
  minYearsAtCompany?: number;
  minYearsInRole?: number;
  minTotalYearsExperience?: number;
  previousCompany?: string;
  // Contact Activity
  contactSignals?: string[];
  // Company — Basic
  companyName?: string;
  companyDomain?: string;
  keyword?: string;
  industry?: string;
  subIndustry?: string;
  country?: string;
  state?: string;
  city?: string;
  minEmployees?: number;
  maxEmployees?: number;
  // Company — Stage & Funding
  companyStage?: string;
  lastFundingRound?: string;
  minRevenue?: number;
  maxRevenue?: number;
  // Company attributes
  minFoundedYear?: number;
  maxFoundedYear?: number;
  minHeadcountGrowth?: number;
  companyEmailProvider?: string;
  // Intent & deduplication
  minIntentScore?: number;
  excludeDuplicates?: boolean;
  maxPerCompany?: number;
  // Company — Hiring
  currentlyHiring?: boolean;
  hiringDepartments?: string[];
  // Company — Signals
  companySignals?: string[];
  // Tech / intent
  tech?: string;
  signal?: string;
}

export interface SearchProspectsRequest {
  query?: string;
  filters?: ProspectSearchFilters;
  page?: number;
  pageSize?: number;
}

export interface SearchProspectsResponse {
  results: ProspectSummary[];
  total: number;
  page: number;
  pageSize: number;
  cached: boolean;
  creditsUsed?: number;
}

export interface ProspectList {
  id: string;
  workspaceId: string;
  name: string;
  prospectCount: number;
  createdAt: string;
}

export interface Sequence {
  id: string;
  workspaceId: string;
  name: string;
  status: "draft" | "active" | "paused";
  stepCount: number;
}

export interface InboxThread {
  id: string;
  subject: string;
  from: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
}

export interface AiDraft {
  id: string;
  threadId: string;
  content: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Enrichment / activation (lead-enrichment feature) ---------------------

export type EnrichField = "company" | "email" | "validation" | "phone";
export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface ProspectSnapshotInput {
  prospectId?: string;
  companyId?: string;
  fullName?: string;
  title?: string;
  seniority?: string;
  industry?: string;
  country?: string;
  companyDomain: string;
  email?: string;
  linkedinUrl?: string;
  employeeCount?: number;
  signals?: string[];
}

export interface FieldResult {
  field: string;
  value?: string;
  valueJson?: unknown;
  provider: string;
  confidence?: number;
  validationStatus?: string;
  isPrimary?: boolean;
}

export interface AttemptLog {
  order: number;
  provider: string;
  operation: string;
  status: string;
  latencyMs: number;
  detail?: string;
}

export interface EnrichmentJob {
  id: string;
  workspaceId: string;
  prospectId: string;
  status: JobStatus;
  trigger: string;
  fieldsRequested: string[];
  results: FieldResult[];
  attempts?: AttemptLog[];
  creditsUsed: number;
  errorMessage: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface EnrichmentBatch {
  id: string;
  workspaceId: string;
  listId: string | null;
  total: number;
  done: number;
  failed: number;
  status: JobStatus;
  jobIds: string[];
  createdAt: string;
}

export interface ActivationRecord {
  id: string;
  workspaceId: string;
  prospectId: string;
  companyId: string;
  snapshot: Record<string, unknown>;
  activatedAt: string;
  updatedAt: string;
}

export interface EnrichTriggerResponse {
  jobId: string;
  status: JobStatus;
  creditsUsed: number;
  results: FieldResult[];
  attempts?: AttemptLog[];
}

export interface CreditsResponse {
  workspaceId: string;
  balance: number;
}

export interface IcpConfig {
  industries?: string[];
  countries?: string[];
  seniorities?: string[];
  titles?: string[];
  keywords?: string[];
  minEmployees?: number;
  maxEmployees?: number;
}

export interface IcpResponse {
  workspaceId: string;
  config: IcpConfig;
  version?: number;
}

export interface SmartListFilters {
  query?: string;
  industry?: string;
  country?: string;
  seniority?: string;
  minEmployees?: number;
  maxEmployees?: number;
  tech?: string;
  signal?: string;
}

export interface SmartList {
  id: string;
  workspaceId: string;
  name: string;
  filters: SmartListFilters;
  lastRunCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmartListRunResult {
  list: SmartList;
  hits: ProspectSummary[];
  total: number;
  /** True when OpenSearch was unavailable and demo corpus was used. */
  demo?: boolean;
}

export interface SmartListActivateResult {
  list: ProspectList;
  smartList: SmartList;
  hits: ProspectSummary[];
  total: number;
  activated: number;
  demo?: boolean;
}

export interface ScoreResult {
  prospectId: string;
  icpScore: number;
  icpBand: string;
  intentScore: number;
  painPoints: string[];
  outreachReadiness: string;
  reasoning: string;
  source?: "llm" | "heuristic";
  creditsUsed?: number;
}

export interface ProspectScoreRecord {
  prospectId: string;
  score: number;
  priority: string | null;
  reasoning: string | null;
  scoredAt: string;
}

export interface ListScoreJob {
  id: string;
  jobType: string;
  status: "pending" | "running" | "completed" | "failed";
  entityType: string | null;
  entityId: string | null;
  result?: {
    listId: string;
    scored: number;
    skipped?: number;
    creditsUsed: number;
    results: Array<{ prospectId: string; icpScore: number; icpBand: string }>;
  } | null;
  errorMessage: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ScrapeJobRow {
  id: string;
  source: string;
  status: string;
  trigger?: string;
  seeds?: string[];
  rawCount: number | null;
  cleanCount: number | null;
  quarantinedCount?: number | null;
  ingestedCount: number | null;
  skippedDuplicateCount?: number | null;
  rawS3Key?: string | null;
  cleanS3Key?: string | null;
  errorMessage: string | null;
  queuedAt: string;
  startedAt?: string | null;
  completedAt: string | null;
}

export interface DashboardSummary {
  workspaceName: string;
  credits: number;
  listCount: number;
  totalProspectsInLists: number;
  icpConfigured: boolean;
  recentJobs: Array<{
    id: string;
    prospectId: string;
    status: string;
    creditsUsed: number;
    queuedAt: string;
    completedAt: string | null;
  }>;
}

export interface AnalyticsReport {
  workspaceName: string;
  period: { days: number; from: string; to: string };
  credits: {
    balance: number;
    spent: number;
    added: number;
    net: number;
    byAction: Array<{ action: string; credits: number }>;
    daily: Array<{ date: string; spent: number; added: number }>;
  };
  enrichment: {
    totalJobs: number;
    completed: number;
    failed: number;
    running: number;
    successRate: number;
    creditsUsed: number;
    daily: Array<{ date: string; jobs: number; completed: number }>;
  };
  lists: {
    count: number;
    totalProspects: number;
  };
  recentTransactions: CreditTransaction[];
}

export interface ListMemberDetail {
  prospectId: string;
  companyId: string;
  addedAt: string;
  snapshot: {
    fullName?: string;
    email?: string;
    title?: string;
    companyName?: string;
    [key: string]: unknown;
  };
  score?: ProspectScoreRecord | null;
}

export interface ListDetail extends ProspectList {
  members: ListMemberDetail[];
}

export interface CreditTransaction {
  id: string;
  workspaceId: string;
  amount: number;
  action: string;
  referenceId: string | null;
  createdAt: string;
}

export interface WorkspaceCurrent {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  balance: number | null;
}

export interface CrmConnection {
  id: string;
  provider: string;
  status: string;
  externalAccountId: string | null;
  connectedAt: string;
  tokenExpiresAt: string | null;
}

export interface CrmConnectionsResponse {
  workspaceId: string;
  data: CrmConnection[];
  total: number;
}

export interface HubSpotConnectResponse {
  authorizationUrl: string;
}

export interface HubSpotListSummary {
  listId: string;
  name: string;
  size: number;
}

export interface HubSpotListsResponse {
  data: HubSpotListSummary[];
  total: number;
}

export interface HubSpotImportResponse {
  listId: string;
  imported: number;
  skipped: number;
  source: string;
}

export interface ManualProspectInput {
  // Contact
  fullName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  department?: string;
  seniority?: string;
  jobFunction?: string;
  yearsAtCompany?: number;
  yearsInRole?: number;
  previousCompany?: string;
  // Company
  companyName?: string;
  companyDomain?: string;
  industry?: string;
  subIndustry?: string;
  companyDescription?: string;
  keywords?: string[];
  country?: string;
  state?: string;
  city?: string;
  companySize?: string;
  employeeCount?: number;
  companyStage?: string;
  // Revenue & Funding
  annualRevenue?: string;
  revenueRange?: string;
  totalFundingRaised?: string;
  lastFundingDate?: string;
  lastFundingRound?: string;
  investors?: string[];
  // Hiring & Tech
  currentlyHiring?: boolean;
  openJobCount?: number;
  hiringDepartments?: string[];
  crmUsed?: string;
  techStackKeywords?: string[];
}

export interface ManualProspectResponse {
  prospectId: string;
  companyId?: string;
  message: string;
}

export interface CrmExportJob {
  id: string;
  jobType: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  result?: {
    total?: number;
    pushed?: number;
    skippedNoEmail?: number;
    errors?: string[];
  } | null;
  errorMessage: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
