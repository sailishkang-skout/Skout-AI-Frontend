/** Native CRM types — mirror Skout-AI-Backend/packages/shared/src/schemas.ts and apps/crm/src/routes/*. */

export type CompanyStatus = "active" | "customer" | "churned";
export type ContactLifecycleStage = "lead" | "mql" | "sql" | "customer";
export type DealStatus = "open" | "won" | "lost";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "done" | "skipped";
export type TaskType = "call" | "email" | "follow-up" | "custom";
export type MeetingType = "call" | "video" | "in_person";
export type ActivityType = "note" | "call" | "email" | "meeting" | "stage_change";
export type CrmEntityType = "contact" | "company" | "deal";

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
  type: TaskType;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  assignedTo?: string;
  relatedEntityType?: CrmEntityType;
  relatedEntityId?: string;
  type?: TaskType;
  dueDate?: string;
  priority?: TaskPriority;
}

export interface TaskPatch {
  title?: string;
  assignedTo?: string;
  relatedEntityType?: CrmEntityType;
  relatedEntityId?: string;
  type?: TaskType;
  dueDate?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}

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
  dueTodayTasks: number;
  upcomingMeetings: number;
  recentActivities: Activity[];
}
