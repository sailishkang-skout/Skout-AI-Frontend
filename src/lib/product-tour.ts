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
    id: "tam",
    target: "nav-tam",
    href: "/tam",
    title: "Market (TAM)",
    body: "Size your total addressable market from your ICP, break it down by segment, and track how far you've worked it with a coverage funnel.",
    details: [
      "Each TAM recomputes its size and coverage on demand",
      "Drill any segment into a live list to export or sequence",
      "Coverage funnel: activated → enriched → contacted → replied → deal",
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
      "Enroll the list into an active sequence or a 50/50 A/B experiment",
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
    id: "workbooks",
    target: "nav-workbooks",
    href: "/enrichment/workbooks",
    title: "Enrichment workbooks",
    body: "Define a reusable enrichment waterfall — fields, quality threshold, credit budget — then run it against a list.",
    details: [
      "Test with a sample run before activating for production",
      "Pause, resume, and rerun just the failed rows on any run",
      "Activate explicitly when you're ready to trust it on real data",
    ],
  },
  {
    id: "icp-wizard",
    target: "nav-icp-wizard",
    href: "/onboarding",
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
    body: "Start manually (God Mode), from A/B templates, with Dexter AI, or as a 50/50 experiment. One engine for all.",
    details: [
      "Visual builder: email, LinkedIn, call, conditions with Yes/No fallbacks",
      "Activate publishes a version; Activity tab explains branches and stops",
      "Ask/Auto still applies for copy — connect an inbox (and Unipile for LinkedIn) before live sends",
    ],
  },
  {
    id: "inbox",
    target: "nav-inbox",
    href: "/inbox",
    title: "Inbox & Sent",
    body: "Email, LinkedIn, and WhatsApp conversations from connected accounts, plus Sent/Outbox.",
    details: [
      "Human replies land here for follow-up",
      "Connect Unipile under Integrations, then accounts under Deliverability",
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
    id: "email-warmup",
    target: "nav-email-warmup",
    href: "/warmup",
    title: "Email Warm-up",
    body: "Ramp mailbox reputation safely — pools, domains, health, and kill switches before you scale sends.",
    details: [
      "Connect mailboxes and watch warm-up control over time",
      "Monitor health/risk and partner network conversations",
      "Use kill switches when a domain or pool needs to pause",
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
    id: "email-intelligence",
    target: "nav-email-intelligence",
    href: "/intelligence/email",
    title: "Email Intelligence",
    body: "SMTP-based verification, discovery, and pattern ranking for sending addresses.",
    details: [
      "Verify a single email or a whole batch before you send to it",
      "Discover the most likely address for a name + domain",
      "Rank email patterns for a domain from historical evidence",
    ],
  },
  {
    id: "deal-intelligence",
    target: "nav-deal-intelligence",
    href: "/crm/deals",
    title: "CRM Intelligence",
    body: "Your deal pipeline, viewed as a source of signal rather than just a list to manage.",
    details: [
      "Same Deals board you manage from — just reached from Intelligence too",
      "Spot stale or at-risk deals alongside your other signal sources",
    ],
  },
  {
    id: "identity-merge",
    target: "nav-identity-merge",
    href: "/crm/identity-merge",
    title: "Identity merge review",
    body: "Review suggested company and contact merges when Skout finds probable duplicates across sources.",
    details: [
      "Open pending proposals and compare the two records side by side",
      "Approve to merge into the kept record, or reject if they are distinct",
      "Keeps CRM and enrichment from duplicating the same account",
    ],
  },
  {
    id: "draft-auto-approve",
    target: "nav-draft-auto-approve",
    href: "/settings/draft-auto-approve",
    title: "Draft auto-approve",
    body: "Let high-confidence AI drafts to your best-fit prospects skip the review queue — everything else still waits for a human.",
    details: [
      "Set minimum ICP score and draft confidence thresholds",
      "Keep specific lists on always-review no matter the score",
      "Auto-approved drafts still appear in AI Review, tagged",
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
    id: "automation-rules",
    target: "nav-automation-rules",
    href: "/settings/automation-rules",
    title: "Auto-activation rules",
    body: "Set score thresholds that automatically activate, list, or enroll a prospect — capped at 5 active rules so automation stays reviewable.",
    details: [
      "Every auto-action is logged and reversible from the same page",
      "Optionally require a signal type alongside the score threshold",
      "Disable a rule anytime without losing its history",
    ],
  },
  {
    id: "workflow-studio",
    target: "nav-workflow-studio",
    href: "/workflows",
    title: "Workflow Studio",
    body: "Watch observable async runs — start, track, and complete pipeline jobs without leaving Skout.",
    details: [
      "Pairs with activation rules for day-to-day automation",
      "Use for enrich/score style runs you want to audit",
    ],
  },
  {
    id: "automation-policy",
    target: "nav-automation-policy",
    href: "/settings/automation-policy",
    title: "Policy Gateway",
    body: "Choose ask / auto / draft / approve for each automatable action so Dexter never runs uncontrolled.",
    details: [
      "Workspace overrides beat platform defaults",
      "Every classification is audited under policy decisions",
    ],
  },
  {
    id: "dexter-orchestrator",
    target: "nav-dexter-orchestrator",
    href: "/dexter",
    title: "Dexter Orchestrator",
    body: "Propose a GTM plan, approve it, invoke through Policy Gateway, then record learning outcomes.",
    details: [
      "Chat FAB remains available for conversational Dexter",
      "Invoke is blocked until a human approves the plan",
    ],
  },
  {
    id: "decisions",
    target: "nav-decisions",
    href: "/decisions",
    title: "Decision views",
    body: "Act on recommendations with clear options and evidence — not vanity metric dashboards.",
    details: [
      "Create a decision from the latest next-best-action",
      "Decide or dismiss to keep the queue honest",
    ],
  },
  {
    id: "account-360",
    target: "nav-account-360",
    href: "/crm/360",
    title: "Account & Person 360",
    body: "One composed view of a company or contact with deals, timeline activity, and live signals.",
    details: [
      "Load by company UUID for Account 360",
      "Switch to Person mode for a contact UUID",
    ],
  },
  {
    id: "alert-rules",
    target: "nav-alert-rules",
    href: "/settings/alert-rules",
    title: "Signal alerts",
    body: "Get notified the moment a signal you care about lands on an account you own — funding, hiring, tech changes, or risk signals like engagement decay.",
    details: [
      "Watch a signal type, optionally above a confidence bar",
      "Alerts route to the owning SDR automatically",
      "Pick real-time vs. daily digest on the Notifications page",
    ],
  },
  {
    id: "notifications",
    target: "nav-notifications",
    href: "/settings/notifications",
    title: "Notifications",
    body: "Choose in-app, email, or both per notification type, and connect a Slack webhook for high-priority alerts.",
    details: [
      "Defaults to in-app only — nothing emails you until you opt in",
      "Slack delivery is workspace-wide, set once for the team",
      "Send a test notification to confirm delivery is wired up",
    ],
  },
  {
    id: "calling",
    target: "nav-calling",
    href: "/settings/calling",
    title: "Calling",
    body: "Click-to-call dials your own phone first, then bridges to the prospect once you pick up.",
    details: [
      "Set your phone number here before the Call button works",
      "Requires a workspace admin to connect Twilio",
      "Calls show up as a Call button on contact detail pages",
    ],
  },
  {
    id: "linkedin-voice",
    target: "nav-linkedin-voice",
    href: "/linkedin/voice",
    title: "LinkedIn Voice",
    body: "Draft a voice-note script, preview it, and hand it off to your phone — LinkedIn only accepts voice messages from the mobile app, so you send it yourself.",
    details: [
      "Requires a 1st-degree LinkedIn connection to draft",
      "Preview a personal or synthetic voice take before handoff",
      "Confirm the send outcome back on this page for the timeline",
    ],
  },
  {
    id: "phone-numbers",
    target: "nav-phone-numbers",
    href: "/settings/numbers",
    title: "Phone numbers",
    body: "Search and provision phone numbers by country, type, and capability, then track each request through compliance.",
    details: [
      "Number requests move through a tracked provisioning status until active",
      "Upload compliance documents here when a country requires them",
      "The active number becomes your click-to-call caller ID",
    ],
  },
  {
    id: "cro-copilot",
    target: "nav-cro-copilot",
    href: "/admin/cro",
    title: "CRO Copilot",
    body: "Owner/admin-only exec rollup — pipeline value, stale deals, rep activity, and a scoped chat over the same data.",
    details: [
      "403s for non-admins at both the page and every API call",
      "Stale deals means no update in 14+ days, not a risk score",
      "Ask the embedded chat about pipeline health directly",
    ],
  },
  {
    id: "signal-center",
    target: "nav-signal-center",
    href: "/signals",
    title: "Signal Center",
    body: "Every account with a live signal, ranked by strength — multiple corroborated signals plus a reachable decision-maker score higher than one weak trigger.",
    details: [
      "Each signal shows its source, confidence, and expiry",
      "A stacked score means more than one signal is corroborating it",
      "Use it to prioritize which accounts to work next",
    ],
  },
  {
    id: "reporting",
    target: "nav-reporting",
    href: "/admin/reporting",
    title: "Reporting & forecasting",
    body: "Model-generated, manager-adjusted, and rep-committed forecast numbers with the gap explained, plus scheduled report delivery and board-pack export.",
    details: [
      "Set a manager adjustment or rep commitment with a required reason",
      "Scheduled reports keep a version history of every delivery",
      "Export a board-pack (PDF/XLSX) from the live rollup anytime",
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
    title: "Dexter AI",
    body: "Dexter is your voice-first workspace agent — speak or type to navigate, enroll lists, draft outreach, and answer questions with live data.",
    details: [
      "Mic to talk; Dexter speaks replies aloud (browser TTS)",
      "Ask mode proposes; confirm before enroll / send",
      "On Sequences/Inbox a page chat stays for editor apply — Dexter sits beside it",
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
