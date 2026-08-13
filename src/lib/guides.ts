export type GuideSlug =
  | "workspace"
  | "connect-inbox"
  | "sending-domain"
  | "deliverability"
  | "integrations"
  | "sequences-ai"
  | "ai-review"
  | "import-prospects"
  | "billing-invoices"
  | "lists-enrich"
  | "search-icp"
  | "smart-lists"
  | "tam"
  | "enrichment"
  | "crm-hubspot"
  | "calling"
  | "google-calendar"
  | "inbox"
  | "team"
  | "analytics"
  | "automation-rules"
  | "alert-notifications"
  | "draft-auto-approve";

export type GuideGroup = "Discover" | "Activate" | "Outreach" | "CRM" | "Workspace";

export interface GuideMeta {
  slug: GuideSlug;
  title: string;
  summary: string;
  relatedHref: string;
  relatedLabel: string;
  group: GuideGroup;
}

export const GUIDE_GROUPS: GuideGroup[] = ["Discover", "Activate", "Outreach", "CRM", "Workspace"];

export const GUIDES: GuideMeta[] = [
  {
    slug: "search-icp",
    title: "ICP & prospect search",
    summary: "Define your buyer, search the corpus, score matches, and activate them into lists.",
    relatedHref: "/prospects/search",
    relatedLabel: "Prospect search",
    group: "Discover",
  },
  {
    slug: "import-prospects",
    title: "Import lists & prospects",
    summary: "Upload CSV, Excel, PDF, or images (OCR) and land them on a list.",
    relatedHref: "/import",
    relatedLabel: "Import",
    group: "Discover",
  },
  {
    slug: "smart-lists",
    title: "Smart lists",
    summary: "Save filter sets, auto-refresh matches, and activate into enrichment lists.",
    relatedHref: "/smart-lists",
    relatedLabel: "Smart lists",
    group: "Discover",
  },
  {
    slug: "tam",
    title: "Market (TAM)",
    summary: "Size your addressable market from ICP and track coverage through the funnel.",
    relatedHref: "/tam",
    relatedLabel: "TAM",
    group: "Discover",
  },
  {
    slug: "lists-enrich",
    title: "Lists, enrich & enroll",
    summary: "Create lists, enrich/verify members, and enroll into sequences or A/B experiments.",
    relatedHref: "/lists",
    relatedLabel: "Lists",
    group: "Activate",
  },
  {
    slug: "enrichment",
    title: "Enrichment jobs",
    summary: "Run email/phone/firmographic enrichment and watch job progress and credits.",
    relatedHref: "/enrichment",
    relatedLabel: "Enrichment",
    group: "Activate",
  },
  {
    slug: "sequences-ai",
    title: "Sequences, A/B tests & Dexter",
    summary: "God Mode builder, templates, LinkedIn fallbacks, versioning, and 50/50 experiments.",
    relatedHref: "/sequences",
    relatedLabel: "Sequences",
    group: "Outreach",
  },
  {
    slug: "ai-review",
    title: "AI Review queue",
    summary: "Approve, edit, or reject AI-written emails before they send.",
    relatedHref: "/ai/review",
    relatedLabel: "AI review",
    group: "Outreach",
  },
  {
    slug: "draft-auto-approve",
    title: "Draft auto-approve",
    summary: "Let high-confidence drafts to high-ICP prospects skip the review queue.",
    relatedHref: "/settings/draft-auto-approve",
    relatedLabel: "Draft auto-approve",
    group: "Outreach",
  },
  {
    slug: "inbox",
    title: "Inbox, LinkedIn & WhatsApp",
    summary: "Reply to email threads and Unipile LinkedIn/WhatsApp chats in one place.",
    relatedHref: "/inbox",
    relatedLabel: "Inbox",
    group: "Outreach",
  },
  {
    slug: "connect-inbox",
    title: "Connect an email inbox",
    summary: "Add SMTP/IMAP credentials, verify with a test send, and keep the inbox healthy.",
    relatedHref: "/deliverability",
    relatedLabel: "Deliverability → Inboxes",
    group: "Outreach",
  },
  {
    slug: "sending-domain",
    title: "Add & verify a sending domain",
    summary: "Publish SPF, DKIM, DMARC, and MX records, then verify DNS from Deliverability.",
    relatedHref: "/deliverability",
    relatedLabel: "Deliverability → Domains",
    group: "Outreach",
  },
  {
    slug: "deliverability",
    title: "Deliverability overview",
    summary: "Monitor inbox health, bounce/spam rates, warmup progress, and analytics.",
    relatedHref: "/deliverability",
    relatedLabel: "Deliverability",
    group: "Outreach",
  },
  {
    slug: "crm-hubspot",
    title: "CRM & HubSpot sync",
    summary: "Work companies, contacts, deals, and meetings — and import/export HubSpot.",
    relatedHref: "/crm",
    relatedLabel: "CRM",
    group: "CRM",
  },
  {
    slug: "calling",
    title: "Click-to-call",
    summary: "Set your agent number and dial prospects; Twilio bridges the call after you pick up.",
    relatedHref: "/settings/calling",
    relatedLabel: "Calling",
    group: "CRM",
  },
  {
    slug: "google-calendar",
    title: "Google Calendar & Meet",
    summary: "Connect Google Calendar to book meetings with a real Meet link from Skout.",
    relatedHref: "/settings/calendar",
    relatedLabel: "Google Calendar",
    group: "CRM",
  },
  {
    slug: "workspace",
    title: "Workspace setup",
    summary: "Rename your workspace, understand credits, and top up billing.",
    relatedHref: "/settings/workspace",
    relatedLabel: "Workspace settings",
    group: "Workspace",
  },
  {
    slug: "billing-invoices",
    title: "Credits & Razorpay invoices",
    summary: "Buy credit packs and download monthly paid invoices.",
    relatedHref: "/settings/workspace",
    relatedLabel: "Workspace billing",
    group: "Workspace",
  },
  {
    slug: "team",
    title: "Team & invites",
    summary: "Invite teammates, assign roles, and manage pending invitations.",
    relatedHref: "/settings/team",
    relatedLabel: "Team",
    group: "Workspace",
  },
  {
    slug: "integrations",
    title: "Connect integrations",
    summary: "Unipile for LinkedIn/WhatsApp, enrichment BYOK keys, and email intelligence.",
    relatedHref: "/settings/integrations",
    relatedLabel: "Integrations",
    group: "Workspace",
  },
  {
    slug: "automation-rules",
    title: "Auto-activation rules",
    summary: "When score or signal thresholds hit, activate, list, or enroll automatically.",
    relatedHref: "/settings/automation-rules",
    relatedLabel: "Automation rules",
    group: "Workspace",
  },
  {
    slug: "alert-notifications",
    title: "Signal alerts & notifications",
    summary: "Get in-app or Slack alerts when funding, hiring, or risk signals land.",
    relatedHref: "/settings/alert-rules",
    relatedLabel: "Signal alerts",
    group: "Workspace",
  },
  {
    slug: "analytics",
    title: "Analytics & reports",
    summary: "Credits, enrichment, and outreach performance for the workspace.",
    relatedHref: "/analytics",
    relatedLabel: "Analytics",
    group: "Workspace",
  },
];

export function getGuide(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function guidePath(slug: GuideSlug): string {
  return `/guides/${slug}`;
}

export function guidesByGroup(): Record<GuideGroup, GuideMeta[]> {
  return GUIDE_GROUPS.reduce(
    (acc, group) => {
      acc[group] = GUIDES.filter((g) => g.group === group);
      return acc;
    },
    {} as Record<GuideGroup, GuideMeta[]>,
  );
}
