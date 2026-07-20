export const TOUR_STORAGE_KEY = "skout.productTour.v2";

export type TourPhase = "welcome" | "tour" | "done";

export interface TourPersisted {
  /** Welcome modal already shown (start or skip). */
  welcomeSeen: boolean;
  /** Tour finished or skipped — don't auto-open again. */
  dismissed: boolean;
  /** Completed all steps (not just skipped). */
  completed: boolean;
}

export interface TourStep {
  id: string;
  /** Matches data-tour on a sidebar/nav element */
  target: string;
  href: string;
  title: string;
  body: string;
  /** Optional bullets shown under the body for richer detail. */
  details?: string[];
}

/** Full product walkthrough — welcome modal is separate. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    target: "nav-dashboard",
    href: "/dashboard",
    title: "Your command center",
    body: "Dashboard is the home snapshot for this workspace — activity, credits, and what’s moving this week.",
    details: [
      "Check credit balance before large enrich or search runs",
      "Jump back here anytime for a quick status read",
      "Use it as the starting point when you’re new to a workspace",
    ],
  },
  {
    id: "prospect-search",
    target: "nav-prospect-search",
    href: "/prospects/search",
    title: "Prospect search",
    body: "Search the corpus for people and companies that match your ICP, then activate matches into lists.",
    details: [
      "Filter by role, company, location, and other signals",
      "Activate selected results into a list for enrichment",
      "Pair with ICP settings so scoring stays aligned to your buyer",
    ],
  },
  {
    id: "add-prospect",
    target: "nav-add-prospect",
    href: "/prospects/add",
    title: "Add a single prospect",
    body: "Manually add one contact when you already know the person — useful for inbound leads or warm intros.",
    details: [
      "Enter name, company, and contact fields you have",
      "Add them straight into a list for enrichment or outreach",
      "Best for one-offs; use Import for bulk uploads",
    ],
  },
  {
    id: "import",
    target: "nav-import",
    href: "/import",
    title: "Import prospects",
    body: "Upload CSV, Excel, PDF, or images to build a list fast. Preview rows, then commit into a new or existing list.",
    details: [
      "CSV / Excel for structured sheets; PDF & images use OCR",
      "Preview and map columns before you commit",
      "Choose a target list (or create one) on commit",
    ],
  },
  {
    id: "smart-lists",
    target: "nav-smart-lists",
    href: "/smart-lists",
    title: "Smart lists",
    body: "Define living audience rules so Skout keeps finding matching prospects without repeating the same search.",
    details: [
      "Set criteria once; re-run when you want fresh matches",
      "Activate matches into a prospect list for enrichment",
      "Great for always-on ICP hunting alongside manual search",
    ],
  },
  {
    id: "lists",
    target: "nav-lists",
    href: "/lists",
    title: "Lists",
    body: "Lists are the hub for organizing prospects before enrichment, scoring, and sequence enrollment.",
    details: [
      "Open a list to see members, scores, and contact status",
      "Enrich and verify emails/phones from the list detail page",
      "Enroll the list (or selected members) into a sequence",
    ],
  },
  {
    id: "enrichment",
    target: "nav-enrichment",
    href: "/enrichment",
    title: "Enrichment jobs",
    body: "Track enrichment and scoring jobs — emails, phones, verification, and ICP scores running in the background.",
    details: [
      "Watch job progress and failures without leaving the app",
      "Credits are spent when providers find or verify contacts",
      "Open a job for row-level detail when something looks off",
    ],
  },
  {
    id: "icp-wizard",
    target: "nav-icp-wizard",
    href: "/onboarding/icp",
    title: "ICP setup wizard",
    body: "Walk through ideal customer profile setup so search and scoring know who you sell to.",
    details: [
      "Capture firmographics, personas, and disqualifiers",
      "Required before some discovery flows can run fully",
      "Revisit anytime if your ICP or GTM motion changes",
    ],
  },
  {
    id: "icp-settings",
    target: "nav-icp-settings",
    href: "/settings/icp",
    title: "ICP settings",
    body: "Fine-tune the saved ICP used for scoring and matching after the wizard.",
    details: [
      "Adjust titles, industries, company size, and geo",
      "Better ICP → better priority scores on list members",
      "Keep this in sync when you change market focus",
    ],
  },
  {
    id: "sequences",
    target: "nav-sequences",
    href: "/sequences",
    title: "Outreach sequences",
    body: "Build multi-step cadences (email + LinkedIn + waits), use AI Ask/Auto for copy, and enroll lists.",
    details: [
      "Ask mode proposes; Auto can apply or create immediately",
      "Connect a sending inbox before live sends",
      "Track replies and status back in Inbox",
    ],
  },
  {
    id: "inbox",
    target: "nav-inbox",
    href: "/inbox",
    title: "Inbox & Sent",
    body: "Manage conversation threads, replies, and outbound mail in one place.",
    details: [
      "Human replies land here for follow-up",
      "Use Sent / Outbox folders for outbound history",
      "Approve AI drafts from AI Review to send into threads",
    ],
  },
  {
    id: "deliverability",
    target: "nav-deliverability",
    href: "/deliverability",
    title: "Deliverability",
    body: "Connect inboxes and domains, verify DNS (SPF/DKIM/DMARC), and watch bounce/spam health.",
    details: [
      "Add SMTP/IMAP inboxes and run a test send",
      "Verify sending domains before scaling volume",
      "Warm gradually — high bounce/spam can auto-pause inboxes",
    ],
  },
  {
    id: "ai-review",
    target: "nav-ai-review",
    href: "/ai/review",
    title: "AI Review",
    body: "Queue of AI-written emails waiting for human approval before they hit the wire.",
    details: [
      "Approve & send, edit, or reject each draft",
      "Keeps AI outreach segregated from live sends",
      "Approved sends show up under Inbox → Sent",
    ],
  },
  {
    id: "analytics",
    target: "nav-analytics",
    href: "/analytics",
    title: "Analytics",
    body: "See outreach and workspace performance — opens, replies, and funnel signals over time.",
    details: [
      "Spot which sequences and steps convert",
      "Use trends to tighten ICP and messaging",
      "Pair with Dashboard for day-to-day ops",
    ],
  },
  {
    id: "crm",
    target: "nav-crm",
    href: "/settings/crm",
    title: "CRM sync (HubSpot)",
    body: "Connect HubSpot to import contacts into Skout lists and export enriched people back.",
    details: [
      "OAuth connect under Settings → CRM",
      "Import is free (capped per run); export uses credits",
      "Disconnect anytime from the same page",
    ],
  },
  {
    id: "integrations",
    target: "nav-integrations",
    href: "/settings/integrations",
    title: "Integrations (BYOK)",
    body: "Add your own enrichment provider API keys so workspace keys are preferred over platform defaults.",
    details: [
      "Hunter, Apollo, and other providers as configured",
      "Keys stay scoped to this workspace",
      "Use CRM settings for HubSpot — not this page",
    ],
  },
  {
    id: "corpus",
    target: "nav-corpus",
    href: "/settings/corpus",
    title: "Corpus pipeline",
    body: "Ops view for corpus ingest and refresh — how search data stays current behind the scenes.",
    details: [
      "Monitor pipeline / job status for data freshness",
      "Usually admin/ops oriented",
      "Search quality depends on a healthy corpus",
    ],
  },
  {
    id: "team",
    target: "nav-team",
    href: "/settings/team",
    title: "Team",
    body: "Invite teammates, manage roles, and control who can spend credits or change workspace settings.",
    details: [
      "Owners invite via email; members accept to join",
      "Roles gate admin actions vs day-to-day work",
      "Revoke pending invites when someone shouldn’t join",
    ],
  },
  {
    id: "workspace",
    target: "nav-workspace",
    href: "/settings/workspace",
    title: "Workspace & billing",
    body: "Rename the workspace, view credit balance, buy packs, and download invoices.",
    details: [
      "Credits power enrichment, scoring, search, and some exports",
      "Buy packs via Razorpay; paid orders become invoices",
      "Ask the AI chat for a weekly credit usage chart anytime",
    ],
  },
  {
    id: "guides",
    target: "nav-guides",
    href: "/guides",
    title: "Setup guides",
    body: "Written how-tos for inbox, domains, CRM, import, and other setup tasks — bookmark this when stuck.",
    details: [
      "Step-by-step checklists beyond the tour",
      "Share a guide link with a new teammate",
      "Complements Ask mode in the AI assistant",
    ],
  },
  {
    id: "ai-chat",
    target: "nav-ai-chat",
    href: "/dashboard",
    title: "Workspace AI assistant",
    body: "The floating Skout AI chat knows this workspace — ask for credit charts, list help, sequence ideas, or how-tos.",
    details: [
      "Ask mode proposes; Auto can apply where supported",
      "Can return charts and CSV exports for analytics questions",
      "On Sequences/Inbox you’ll see a page-specific chat instead",
    ],
  },
];

/** High-level chapters shown on the welcome modal (not one row per step). */
export const TOUR_WELCOME_CHAPTERS: { title: string; summary: string }[] = [
  {
    title: "Discover",
    summary: "Search, add, import, and smart lists to find the right people",
  },
  {
    title: "Activate",
    summary: "Lists, enrichment, and ICP so contacts are scored and ready",
  },
  {
    title: "Outreach",
    summary: "Sequences, inbox, deliverability, and AI Review before send",
  },
  {
    title: "Workspace",
    summary: "Team, billing, integrations, guides, and the AI assistant",
  },
];

export function loadTourState(): TourPersisted {
  if (typeof window === "undefined") {
    return { welcomeSeen: false, dismissed: false, completed: false };
  }
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return { welcomeSeen: false, dismissed: false, completed: false };
    const parsed = JSON.parse(raw) as Partial<TourPersisted>;
    return {
      welcomeSeen: Boolean(parsed.welcomeSeen),
      dismissed: Boolean(parsed.dismissed),
      completed: Boolean(parsed.completed),
    };
  } catch {
    return { welcomeSeen: false, dismissed: false, completed: false };
  }
}

export function saveTourState(next: TourPersisted): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(next));
}

export function shouldShowWelcome(state: TourPersisted = loadTourState()): boolean {
  return !state.welcomeSeen && !state.dismissed;
}
