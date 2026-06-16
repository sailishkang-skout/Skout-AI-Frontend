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
  employeeCount?: number;
}

export interface SearchProspectsRequest {
  query?: string;
  filters?: Record<string, string | string[] | number>;
  page?: number;
  pageSize?: number;
}

export interface SearchProspectsResponse {
  results: ProspectSummary[];
  total: number;
  page: number;
  pageSize: number;
  cached: boolean;
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
}

export interface ProspectScoreRecord {
  prospectId: string;
  score: number;
  priority: string | null;
  reasoning: string | null;
  scoredAt: string;
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

export interface ListMemberDetail {
  prospectId: string;
  snapshot: Record<string, unknown>;
  score: ProspectScoreRecord | null;
}

export interface ListDetail {
  list: ProspectList;
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
