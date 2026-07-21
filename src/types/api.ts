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

export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type SequenceStepType = "email" | "linkedin" | "wait" | "task";
export type SequenceEnrollmentStatus = "active" | "completed" | "bounced" | "replied";

export interface Sequence {
  id: string;
  workspaceId: string;
  name: string;
  status: SequenceStatus;
  createdAt: string;
  updatedAt: string;
}

export type SequenceDelayUnit = "minutes" | "hours" | "days" | "weeks";

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepOrder: number;
  stepType: SequenceStepType;
  delayDays: number;
  delayUnit: SequenceDelayUnit;
  linkedinAction?: "connect" | "message" | null;
  subject: string | null;
  bodyTemplate: string | null;
  createdAt: string;
}

export interface SequenceDetail extends Sequence {
  steps: SequenceStep[];
}

export interface SequenceStepMetrics {
  stepId: string;
  stepOrder: number;
  stepType: SequenceStepType;
  subject: string | null;
  delayDays: number;
  delayUnit?: SequenceDelayUnit;
  scheduled: number;
  sent: number;
  failed: number;
  skipped: number;
  opens: number;
  clicks: number;
  /** 0–100 percentage already (do not multiply by 100 in UI) */
  openRate: number;
  /** 0–100 percentage already (do not multiply by 100 in UI) */
  clickRate: number;
}

export interface SequenceAnalytics {
  id: string;
  name: string;
  status: SequenceStatus;
  enrollments: {
    total: number;
    active: number;
    completed: number;
    bounced: number;
    replied: number;
  };
  steps: SequenceStepMetrics[];
}

export interface SequenceEnrollment {
  id: string;
  sequenceId: string;
  sequenceName?: string;
  prospectId: string;
  listId: string | null;
  status: SequenceEnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
}

export interface EnrollSequenceResult {
  enrolled: number;
  skipped: number;
  total: number;
}

export type ThreadStatus = "new" | "replied" | "bounced" | "meeting_booked" | "closed";

export interface InboxThread {
  id: string;
  workspaceId: string;
  inboxId: string;
  enrollmentId: string | null;
  prospectId: string | null;
  subject: string;
  status: ThreadStatus;
  statusChangedAt: string | null;
  unreadCount: number;
  replyTag: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  prospect: {
    fullName?: string;
    companyDomain?: string;
    companyName?: string;
    title?: string;
    email?: string;
    icpScore?: number;
    icpBand?: string;
  } | null;
}

export interface InboxMessage {
  id: string;
  threadId: string;
  direction: "inbound" | "outbound";
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  classification: string | null;
  sentAt: string;
  messageId: string | null;
}

export interface ThreadContext {
  threadId: string;
  prospect: {
    prospectId: string;
    fullName?: string;
    title?: string;
    companyDomain?: string;
    companyName?: string;
    email?: string;
    industry?: string;
    country?: string;
    employeeCount?: number;
    linkedinUrl?: string;
    icpScore: number | null;
    icpBand: string | null;
    icpReasoning: string | null;
    scoredAt: string | null;
  } | null;
  sequence: {
    enrollmentId: string;
    enrollmentStatus: string;
    enrolledAt: string;
    completedAt: string | null;
    sequenceId: string;
    sequenceName: string;
    sequenceStatus: string;
  } | null;
}

export interface InboxThreadsResponse {
  workspaceId: string;
  data: InboxThread[];
  total: number;
  limit: number;
  offset: number;
}

export interface InboxMessagesResponse {
  threadId: string;
  data: InboxMessage[];
  total: number;
}

export type AiDraftStatus = "pending_review" | "edited" | "approved" | "rejected" | "sent";

export interface AiDraft {
  id: string;
  workspaceId: string;
  prospectId: string;
  threadId: string | null;
  enrollmentStepId: string | null;
  subject: string;
  body: string;
  status: AiDraftStatus;
  model: string | null;
  confidenceScore: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  prospectName?: string | null;
  prospectTitle?: string | null;
  companyName?: string | null;
  icpScore?: number | null;
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
  queuedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
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
  /** Seller company name — used to ground scoring & outreach context. */
  companyName?: string;
  /** What you sell / value prop — used in ICP scoring prompts. */
  productDescription?: string;
  /** Pains your product solves for buyers — used in scoring & AI outreach. */
  customerPainPoints?: string[];
  /** When false, saving ICP does not enqueue workspace-wide re-score. Default true. */
  autoRescoreOnChange?: boolean;
  /** Raw answers captured by the signup onboarding wizard. */
  onboarding?: OnboardingProfile;
}

/** Structured answers from the signup onboarding wizard. */
export interface OnboardingProfile {
  company?: {
    name?: string;
    industry?: string;
    size?: string;
    website?: string;
  };
  goals?: string[];
  icp?: {
    industries?: string[];
    employeeRanges?: string[];
    countries?: string[];
    revenue?: string;
  };
  people?: {
    departments?: string[];
    seniorities?: string[];
    titles?: string[];
  };
  market?: string[];
  crm?: string;
  leadVolume?: string;
  completedAt?: string;
}

export interface IcpRescoreJobRef {
  jobId?: string;
  status: "pending" | "completed";
  scored?: number;
  creditsUsed?: number;
}

export interface IcpResponse {
  workspaceId: string;
  config: IcpConfig;
  version?: number;
  rescoreJob?: IcpRescoreJobRef | null;
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

export interface DimensionScore {
  score: number;
  matched: boolean;
  explanation: string;
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
  dimensions?: Record<string, DimensionScore>;
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
    listId?: string;
    workspaceId?: string;
    icpVersion?: number;
    scored: number;
    skipped?: number;
    total?: number;
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

export type EmailVerifyStatus =
  | "valid"
  | "invalid"
  | "catch_all"
  | "risky"
  | "unknown"
  | "no_email";

export interface EmailVerification {
  prospectId: string;
  email: string | null;
  status: EmailVerifyStatus;
  deliverabilityScore: number;
  catchAll: boolean;
  risky: boolean;
  provider?: string;
  verifiedAt?: string;
}

export interface ListVerifySummary {
  listId: string;
  total: number;
  verified: number;
  provider: string;
  counts: Record<EmailVerifyStatus, number>;
  sendableCount: number;
  results: EmailVerification[];
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
  verification?: EmailVerification | null;
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
  activated?: boolean;
  listId?: string | null;
  jobId?: string;
  jobStatus?: string;
  creditsUsed?: number;
}

export interface CsvExportResponse {
  downloadUrl: string;
  filename: string;
  creditsUsed: number;
  memberCount: number;
  exportKey?: string;
  expiresInSeconds?: number;
  content?: string;
}

// ── Deliverability ────────────────────────────────────────────────────────────

export type InboxProvider = "smtp" | "google" | "microsoft";
export type InboxStatus = "active" | "warming" | "paused" | "error" | "pending_verification";
export type InboxHealth = "healthy" | "degraded" | "error";
export type DnsStatus = "pass" | "fail" | "missing" | "unknown";

export interface Inbox {
  id: string;
  workspaceId: string;
  emailAddress: string;
  displayName: string | null;
  provider: InboxProvider;
  status: InboxStatus;
  warmupStatus: string;
  dailySendLimit: number;
  sentToday: number;
  capPct: number;
  sentCount: number;
  bounceCount: number;
  spamCount: number;
  health: InboxHealth;
  smtpConfigured: boolean;
  oauthConfigured: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  imapHost?: string | null;
  imapPort?: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectInboxInput {
  emailAddress: string;
  displayName?: string;
  provider: InboxProvider;
  dailySendLimit?: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  imapHost?: string;
  imapPort?: number;
}

export interface Domain {
  id: string;
  workspaceId: string;
  domain: string;
  spfStatus: DnsStatus;
  dkimStatus: DnsStatus;
  dmarcStatus: DnsStatus;
  mxStatus: DnsStatus;
  verifiedAt: string | null;
  createdAt: string;
}

export interface DnsRecord {
  type: "TXT" | "CNAME" | "MX";
  name: string;
  value: string;
  purpose: "SPF" | "DKIM" | "DMARC" | "MX";
  status: DnsStatus;
}

export interface DomainDnsResponse {
  domain: string;
  records: DnsRecord[];
}

export interface DeliverabilityMetrics {
  warmup: Array<{ date: string; sent: number; target: number }>;
  bounce: Array<{
    date: string;
    bounceRate: number;
    spamRate: number;
    sent?: number;
    bounces?: number;
    spam?: number;
  }>;
  summary: {
    totalSent: number;
    sentLast30Days?: number;
    lifetimeSent?: number;
    avgBounceRate: number;
    avgSpamRate: number;
    bounceCount30d?: number;
    spamCount30d?: number;
    inboxCount: number;
    warmingCount: number;
    dailyCapacity?: number;
  };
}

// ── Team management ───────────────────────────────────────────────────────────

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMember {
  userId: string;
  email: string;
  fullName: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
}

export interface InviteDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  accepted: boolean;
  expired: boolean;
}

export interface AcceptInviteResult {
  workspaceId: string;
  role: WorkspaceRole;
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
