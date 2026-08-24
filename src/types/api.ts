/** Shared API types — mirror @skout/shared when backend package is linked */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

/** R13.4 — auto-activation rules. Mirrors apps/api/src/services/activation-rules.service.ts. */
export type ActivationTargetAction = "activate" | "add_to_list" | "enroll_sequence";

export interface ActivationRule {
  id: string;
  workspaceId: string;
  name: string;
  scoreThreshold: number;
  signalType: string | null;
  targetAction: ActivationTargetAction;
  targetId: string | null;
  enabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivationRuleRun {
  id: string;
  workspaceId: string;
  ruleId: string;
  prospectId: string;
  actionTaken: string;
  reversedAt: string | null;
  createdAt: string;
}

/** R17.1 — notification center + R17.4 — delivery channel. Mirrors apps/api/src/services/notifications.service.ts. */
export type NotificationChannel = "in_app" | "email" | "both" | "sms";

export interface Notification {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  deliveredChannels: string[];
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  channel: NotificationChannel;
  /** R17.3 — when true and channel includes email, delivery batches into the daily digest instead of real-time. */
  digest: boolean;
}

/** R20.2 — Twilio click-to-call. Mirrors apps/api/src/routes/call.routes.ts. */
export interface CallConfig {
  enabled: boolean;
  agentPhoneSet: boolean;
}

export interface DialCallResult {
  callSid: string;
  status: string;
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
  painPointsRationale?: string;
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
  industries?: string[];
  subIndustry?: string;
  country?: string;
  state?: string;
  city?: string;
  employeeBuckets?: string[];
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
  /** R10.3 — the filters this list was originally activated from, if any. Non-null means
   * "Convert to smart list" is available (POST /lists/:id/convert-to-smart-list). */
  sourceFilters?: SmartListFilters | null;
}

export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type SequenceSource = "manual" | "template" | "dexter";
export type SequenceMode = "A" | "B" | "C";
export type SequenceStepType = "email" | "linkedin" | "whatsapp" | "call" | "wait" | "task" | "condition" | "goal";
export type SequenceEnrollmentStatus = "active" | "completed" | "bounced" | "replied" | "cancelled";
export type SequenceConditionType =
  | "linkedin_connected"
  | "linkedin_invite_accepted"
  | "linkedin_invite_declined"
  | "email_opened"
  | "email_clicked"
  | "email_opened_count_gte"
  | "email_clicked_count_gte"
  | "email_replied"
  | "call_connected"
  | "icp_score_gte"
  | "has_email"
  | "has_linkedin"
  | "account_has_positive_reply";

export type ConditionExpression =
  | { type: SequenceConditionType; not?: boolean; value?: number }
  | { op: "and" | "or"; not?: boolean; clauses: ConditionExpression[] };
export type SequenceLinkedinAction = "connect" | "message" | "inmail" | "like" | "follow";
export type SequenceVariantKey = "A" | "B" | "C";

export interface Sequence {
  id: string;
  workspaceId: string;
  name: string;
  status: SequenceStatus;
  source?: SequenceSource;
  templateKey?: string | null;
  mode?: SequenceMode;
  currentVersion?: number;
  /** Set once a human explicitly approves a Mode C ("God Mode") sequence — required before draft->active. */
  modeCApprovedAt?: string | null;
  modeCApprovedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SequenceDelayUnit = "minutes" | "hours" | "days" | "weeks";

export interface SequenceStepVariant {
  id: string;
  stepId: string;
  variantKey: SequenceVariantKey;
  subject: string | null;
  bodyTemplate: string | null;
  weight: number;
  enabled: boolean;
  createdAt: string;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepOrder: number;
  stepType: SequenceStepType;
  delayDays: number;
  delayUnit: SequenceDelayUnit;
  linkedinAction?: SequenceLinkedinAction | null;
  subject: string | null;
  bodyTemplate: string | null;
  conditionType?: SequenceConditionType | null;
  conditionExpression?: ConditionExpression | null;
  conditionWaitDays?: number;
  yesNextStepId?: string | null;
  noNextStepId?: string | null;
  parentStepId?: string | null;
  branch?: "yes" | "no" | null;
  goalLabel?: string | null;
  variants?: SequenceStepVariant[];
  createdAt: string;
}

export interface SequenceTemplateSummary {
  key: string;
  name: string;
  description: string;
  channels: string[];
  mode?: SequenceMode;
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
  /** Call steps only — awaiting a human to dial and set a disposition (not scheduled/sent/failed/skipped). */
  pending: number;
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
  experimentVariant?: string | null;
  stopReason?: string | null;
  sequenceVersionId?: string | null;
  enrolledAt: string;
  completedAt: string | null;
  prospectName?: string | null;
  prospectTitle?: string | null;
  companyName?: string | null;
  email?: string | null;
}

export interface SequenceVersionSummary {
  id: string;
  version: number;
  status: string;
  publishedAt: string;
}

export interface SequenceEvent {
  id: string;
  workspaceId: string;
  sequenceId: string;
  enrollmentId: string | null;
  sequenceVersionId: string | null;
  prospectId: string | null;
  stepId: string | null;
  eventType: string;
  variantKey: string | null;
  branch: string | null;
  result: string | null;
  reason: string | null;
  evidence: Record<string, unknown>;
  createdAt: string;
}

export interface SequenceExperiment {
  id: string;
  workspaceId: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed" | string;
  primaryMetric: string;
  weightA: number;
  weightB: number;
  sequenceAId: string;
  sequenceBId: string;
  durationDays: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  sequenceA?: { id: string; name: string; status: string; mode?: string } | null;
  sequenceB?: { id: string; name: string; status: string; mode?: string } | null;
}

export interface SequenceExperimentAnalytics {
  experiment: SequenceExperiment;
  primaryMetric: string;
  variants: {
    A: { enrolled: number; active: number; completed: number; replied: number; bounced: number; stopped: number; replyRate: number; completionRate: number };
    B: { enrolled: number; active: number; completed: number; replied: number; bounced: number; stopped: number; replyRate: number; completionRate: number };
  };
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
  /** email (default), linkedin, or whatsapp */
  channel?: "email" | "linkedin" | "whatsapp";
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

/** Row shape returned by GET /inbox/manual-review — the raw inbox_threads row (no prospect
 * join), plus the persisted AI suggestion a human needs to approve or dismiss. */
export interface ManualReviewThread {
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
  needsReview: boolean;
  suggestedTag: string | null;
  suggestedNegativeSubtype: string | null;
  suggestedConfidence: number | null;
  suggestedReason: string | null;
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
    pictureUrl?: string | null;
    networkProviderId?: string | null;
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
  /** True when the linked enrollment stopped (reply/bounce/etc.). */
  sequencePaused?: boolean;
  suggestedDraft?: {
    id: string;
    subject: string;
    body: string;
    status: string;
    confidenceScore: string | null;
    createdAt: string;
  } | null;
}

export interface SuggestReplyResult {
  threadId: string;
  subject: string;
  body: string;
  confidence: number;
  source: "llm" | "heuristic";
  rationale: string | null;
  draftId: string | null;
  sequencePaused: boolean;
  enrollmentStatus: string | null;
  sequenceName: string | null;
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
  /** R13.2 — set when this draft cleared the workspace's auto-approve thresholds instead of a human approving it. */
  autoApproved: boolean;
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

export type SmartListRefreshCadence = "off" | "daily" | "weekly";

export interface SmartList {
  id: string;
  workspaceId: string;
  name: string;
  filters: SmartListFilters;
  lastRunCount: number | null;
  refreshCadence: SmartListRefreshCadence;
  nextRefreshAt: string | null;
  lastRefreshedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmartListProspectDiffEntry {
  prospectId: string;
  fullName?: string;
  title?: string;
  companyDomain?: string;
}

export type SmartListRefreshStatus = "completed" | "skipped_insufficient_credits" | "failed";

export interface SmartListRefreshSummary {
  id: string;
  smartListId: string;
  status: SmartListRefreshStatus;
  matchedCount: number;
  addedCount: number;
  droppedCount: number;
  creditsCharged: number;
  requiredCredits: number | null;
  availableCredits: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SmartListRefreshDetail extends SmartListRefreshSummary {
  addedProspects: SmartListProspectDiffEntry[];
  droppedProspects: SmartListProspectDiffEntry[];
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
  painPointsRationale?: string;
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
  /** R11.3 — top active signals for the list-row overlay (company + prospect). */
  signals?: Array<{ type: string; observedAt: string; detail?: string }>;
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

/** R11.1/R11.2/R11.3 — unified signal timeline entry. Mirrors apps/api/src/services/signal.service.ts. */
export interface Signal {
  id: string;
  entityType: string;
  entityId: string;
  signalType: string;
  value: { reason?: string; detail?: string; score?: number } & Record<string, unknown>;
  confidence: number | null;
  detectedAt: string;
  source: string | null;
  provenance: Record<string, unknown>;
  createdAt: string;
}

/** R17.3 — signal-triggered SDR alerts. Mirrors apps/api/src/services/alert-rule.service.ts. */
export interface AlertRule {
  id: string;
  workspaceId: string;
  signalType: string;
  minConfidence: number | null;
  enabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** R13.2 — auto-approve thresholds for AI drafts. Mirrors apps/api/src/services/draft-auto-approve.service.ts. */
export interface DraftAutoApproveSettings {
  workspaceId: string;
  enabled: boolean;
  minIcpScore: number | null;
  minConfidence: number | null;
  alwaysReviewListIds: string[];
  updatedBy: string | null;
  updatedAt: string | null;
}

/** R12.1/R12.2 — TAM. Mirrors apps/api/src/services/tam.service.ts. */
export interface TamFilterConfig {
  industries?: string[];
  countries?: string[];
  seniorities?: string[];
  minEmployees?: number;
  maxEmployees?: number;
}

export interface TamSegmentBucket {
  dimension: "industry" | "size" | "geo";
  value: string;
  count: number;
}

export interface TamCoverageFunnel {
  total: number;
  activated: number;
  enriched: number;
  contacted: number;
  replied: number;
  deal: number;
}

export interface Tam {
  id: string;
  workspaceId: string;
  name: string;
  filterConfig: TamFilterConfig | null;
  totalCount: number;
  segmentBreakdown: TamSegmentBucket[];
  coverage: TamCoverageFunnel;
  lastComputedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** R22.2 — generic GTM-provider import. Mirrors apps/api/src/services/import-adapters/*. */
export type ImportProvider = "hubspot" | "apollo";

export interface ImportProviderList {
  id: string;
  name: string;
  count: number;
}

export interface ImportProviderContact {
  fullName?: string;
  companyDomain: string;
  companyName?: string;
  email?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
}

export interface CommitImportResult {
  provider: ImportProvider;
  listId: string;
  listName: string;
  imported: number;
  skipped: number;
}
