/** Native CRM types — mirror Skout-AI-Backend/packages/shared/src/schemas.ts and apps/crm/src/routes/*. */

export type CompanyStatus = "active" | "customer" | "churned";
export type ContactLifecycleStage = "lead" | "mql" | "sql" | "customer";
export type DealStatus = "open" | "won" | "lost";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "done";
export type MeetingType = "call" | "video" | "in_person";
export type ActivityType = "note" | "call" | "email" | "meeting" | "stage_change";
export type CrmEntityType = "contact" | "company" | "deal";

/** R13.3 — per-field provenance on contacts/companies. "manual" always wins over auto-fill. */
export type FieldSource = "manual" | "enrichment" | "meeting_bot" | "call_note";
export interface FieldSourceEntry {
  source: FieldSource;
  confidence?: number;
  setAt: string;
}
export type FieldSourcesMap = Record<string, FieldSourceEntry>;

export interface CrmListEnvelope<T> {
  data: T[];
  total: number;
  workspaceId: string;
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  revenue: number | null;
  location: string | null;
  ownerId: string | null;
  status: CompanyStatus;
  sourceProspectCompanyId: string | null;
  fieldSources: FieldSourcesMap;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyInput {
  name: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  revenue?: number;
  location?: string;
  ownerId?: string;
  status?: CompanyStatus;
}

export type CompanyPatch = Partial<CompanyInput>;

export interface Contact {
  id: string;
  workspaceId: string;
  companyId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedinUrl: string | null;
  ownerId: string | null;
  lifecycleStage: ContactLifecycleStage;
  sourceProspectId: string | null;
  fieldSources: FieldSourcesMap;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  linkedinUrl?: string;
  companyId?: string;
  ownerId?: string;
  lifecycleStage?: ContactLifecycleStage;
}

export type ContactPatch = Partial<ContactInput>;

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  orderIndex: number;
  probability: number;
  isClosedWon: boolean;
  isClosedLost: boolean;
}

export interface Pipeline {
  id: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  stages: PipelineStage[];
}

export interface Deal {
  id: string;
  workspaceId: string;
  companyId: string | null;
  pipelineId: string;
  stageId: string;
  ownerId: string | null;
  name: string;
  amount: number | null;
  currency: string;
  closeDate: string | null;
  probability: number | null;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DealInput {
  name: string;
  companyId: string;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  amount?: number;
  currency?: string;
  closeDate?: string;
  probability?: number;
}

export interface DealPatch {
  name?: string;
  companyId?: string;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  amount?: number;
  currency?: string;
  closeDate?: string;
  probability?: number;
  status?: DealStatus;
}

export interface DealsSummary {
  workspaceId: string;
  openDeals: number;
  pipelineValue: number;
  currency: string;
  stages: { stageId: string; name: string; count: number; value: number }[];
}

export interface Task {
  id: string;
  workspaceId: string;
  assignedTo: string | null;
  relatedEntityType: CrmEntityType | null;
  relatedEntityId: string | null;
  title: string;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  assignedTo?: string;
  relatedEntityType?: CrmEntityType;
  relatedEntityId?: string;
  dueDate?: string;
  priority?: TaskPriority;
}

export interface TaskPatch {
  title?: string;
  assignedTo?: string;
  relatedEntityType?: CrmEntityType;
  relatedEntityId?: string;
  dueDate?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}

/** not_scheduled | scheduled | joining | in_call | completed | failed — see R16.2. */
export type MeetingBotStatus = "not_scheduled" | "scheduled" | "joining" | "in_call" | "completed" | "failed";

export interface Meeting {
  id: string;
  workspaceId: string;
  contactId: string | null;
  companyId: string | null;
  dealId: string | null;
  organizerId: string | null;
  title: string;
  scheduledAt: string;
  durationMinutes: number | null;
  meetingType: MeetingType;
  summary: string | null;
  outcome: string | null;
  /** R16.2 — Zoom/Meet/Teams join link the bot dials into. */
  meetingUrl: string | null;
  botExternalId: string | null;
  botStatus: MeetingBotStatus;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  transcript: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingInput {
  title: string;
  scheduledAt: string;
  durationMinutes?: number;
  meetingType?: MeetingType;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  organizerId?: string;
  summary?: string;
  outcome?: string;
  meetingUrl?: string;
}

export type MeetingPatch = Partial<MeetingInput>;

export interface Activity {
  id: string;
  workspaceId: string;
  entityType: CrmEntityType;
  entityId: string;
  activityType: ActivityType;
  subject: string | null;
  body: string | null;
  ownerId: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface ActivityInput {
  entityType: CrmEntityType;
  entityId: string;
  activityType: ActivityType;
  subject?: string;
  body?: string;
}

export interface DashboardOverview {
  workspaceId: string;
  companies: number;
  contacts: number;
  openDeals: number;
  pipelineValue: number;
  currency: string;
  openTasks: number;
  overdueTasks: number;
  upcomingMeetings: number;
  recentActivities: Activity[];
}

/** R14.3 — internal "switching cost" moat metric. Owner/admin only. */
export interface SwitchingCost {
  workspaceId: string;
  totalContacts: number;
  nativeLinkedContacts: number;
  totalCompanies: number;
  nativeLinkedCompanies: number;
  nativeLinkRatePct: number;
  note: string;
}

export interface StaleDealSummary {
  id: string;
  name: string;
  amount: number | null;
  currency: string;
  daysSinceUpdate: number;
}

export interface RepActivitySummary {
  userId: string | null;
  name: string;
  activityCount7d: number;
}

/** R19.1 — CRO Copilot admin-only exec rollup. */
export interface CroSummary {
  workspaceId: string;
  overview: DashboardOverview;
  switchingCost: SwitchingCost;
  staleDeals: StaleDealSummary[];
  repActivity: RepActivitySummary[];
  generatedAt: string;
}
