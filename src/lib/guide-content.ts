import type { GuideSlug } from "@/lib/guides";

export type GuideSectionContent = {
  title: string;
  description?: string;
  steps?: string[];
  body?: string[];
  note?: string;
};

export const GUIDE_CONTENT: Record<GuideSlug, { sections: GuideSectionContent[] }> = {
  workspace: {
    sections: [
      {
        title: "Rename your workspace",
        steps: [
          "Open Settings → Workspace.",
          "Edit the Name field.",
          "Click Save. The new name appears in the top bar and dashboard.",
        ],
      },
      {
        title: "Credits & billing",
        steps: [
          "Check your current credit balance on the same page.",
          "Choose a credit pack and complete Razorpay checkout.",
          "Review usage history in the transactions table.",
        ],
        note: "Credits power search, enrichment, verification, and some exports. Top-ups usually appear within a few seconds after payment confirmation.",
      },
    ],
  },
  "connect-inbox": {
    sections: [
      {
        title: "Before you start",
        body: [
          "Sequence and Inbox replies send through your connected mailbox (SMTP), not SES.",
          "For Gmail, create an App Password (Google Account → Security → 2-Step Verification → App passwords).",
          "IMAP is required if you want inbound replies to appear in Skout Inbox.",
        ],
      },
      {
        title: "Connect the inbox",
        steps: [
          "Open Deliverability → Inboxes → Connect inbox.",
          "Choose provider (Gmail / Microsoft / SMTP) and enter the email address.",
          "SMTP: host/port (e.g. smtp.gmail.com:465), username = email, password = app password.",
          "IMAP: host/port (e.g. imap.gmail.com:993) for inbound sync.",
          "Click Verify connection (test-send). Status must become Active before sequences use it.",
        ],
        note: "Pending / unverified inboxes are skipped by sequence sending. Pause an inbox anytime from the inbox card.",
      },
      {
        title: "Test end-to-end",
        steps: [
          "Activate a short sequence and enroll a prospect you control, or send from Inbox.",
          "Confirm the message in Gmail/Outlook Sent.",
          "Reply from that mailbox and wait up to ~5 minutes for IMAP poll to show it in Skout Inbox.",
        ],
      },
    ],
  },
  "sending-domain": {
    sections: [
      {
        title: "Add the domain",
        steps: [
          "Open Deliverability → Domains.",
          "Enter the domain you send from (e.g. outreach.yourcompany.com) and click Add domain.",
          "Expand DNS records on the domain card and copy each Name / Value.",
        ],
        note: "Do not add gmail.com or other consumer domains — you must control DNS for the domain.",
      },
      {
        title: "Publish DNS records",
        body: [
          "SPF (TXT on the domain): must include _spf.skout.dev.",
          "DKIM (TXT at skout._domainkey.<domain>): value must start with v=DKIM1.",
          "DMARC (TXT at _dmarc.<domain>): value must start with v=DMARC1.",
          "MX: at least one MX record must exist for the domain.",
        ],
      },
      {
        title: "Verify",
        steps: [
          "Wait for DNS propagation (often minutes; sometimes longer).",
          "Use Verify on the domain card (or POST /api/v1/domains/:id/verify).",
          "Refresh Domains — SPF / DKIM / DMARC / MX should show Pass.",
          "Domain is fully verified only when all four checks pass.",
        ],
        note: "If DKIM shows a placeholder key, contact support for the production public key. MX “pass” only means an MX exists, not that mail must route through Skout.",
      },
    ],
  },
  deliverability: {
    sections: [
      {
        title: "Inboxes tab",
        body: [
          "Shows connected mailboxes, daily send usage, bounce/spam rates, and warmup status.",
          "Open inbox details for SMTP/IMAP hosts and a shortcut into Inbox filtered to that mailbox.",
        ],
      },
      {
        title: "LinkedIn / WhatsApp",
        body: [
          "After you save a Unipile key under Settings → Integrations, connect accounts here.",
          "Those accounts power Inbox LinkedIn/WhatsApp tabs and sequence LinkedIn steps.",
        ],
      },
      {
        title: "Domains tab",
        body: [
          "Manage sending domains and DNS health (SPF, DKIM, DMARC, MX).",
          "Follow the Sending domain guide to publish records and verify.",
        ],
      },
      {
        title: "Analytics tab",
        body: [
          "30-day send volume vs daily capacity.",
          "Bounce and spam rates derived from recent outbound volume and classified bounces.",
          "Keep bounce rate under ~2% for healthy deliverability.",
        ],
      },
    ],
  },
  integrations: {
    sections: [
      {
        title: "Enrichment BYOK keys",
        steps: [
          "Open Settings → Integrations.",
          "Paste a provider API key (Hunter, Apollo, etc.) and Save.",
          "Optionally Test the key before saving.",
          "Enrichment prefers your key first (with a Skout credit discount when applicable).",
        ],
        note: "Remove a key anytime to fall back to platform keys when available.",
      },
      {
        title: "Unipile (LinkedIn & WhatsApp)",
        steps: [
          "Paste your Unipile DSN / API key on the same Integrations page.",
          "Open Deliverability → LinkedIn / WhatsApp and complete hosted auth for each account.",
          "Use Inbox to message, and add LinkedIn steps in God Mode sequences.",
        ],
      },
      {
        title: "Email intelligence",
        body: [
          "When email-intel is configured, list Verify and send eligibility use it before SMTP catch-all checks.",
          "Risky / catch-all addresses can be blocked on sequence send; inconclusive SMTP timeouts fail open.",
        ],
      },
    ],
  },
  "sequences-ai": {
    sections: [
      {
        title: "Three ways to start",
        body: [
          "Manually from scratch — God Mode (C) visual builder: email, LinkedIn, call, WhatsApp, wait, condition, goal.",
          "Use existing templates — Mode A (email-first SaaS VP) or Mode B (LinkedIn-first connect). Same engine underneath.",
          "Do it with Dexter AI — describe the goal; Dexter drafts a Mode C cadence you can edit.",
        ],
        note: "A and B are opinionated defaults. C is God Mode. Platform safety (suppression, eligibility, business hours) cannot be bypassed.",
      },
      {
        title: "Visual builder & Yes/No branches",
        steps: [
          "Open the sequence → Builder. Drag or add Email / LinkedIn / Call / Condition / Delay / Goal.",
          "On a condition node, pick a signal (e.g. LinkedIn invite accepted) and a max wait.",
          "Accepted → Yes branch (e.g. LinkedIn message). Declined or still pending after the wait → No / email fallback.",
          "Optional: enable Compound AND / OR / NOT and stack clauses (ICP ≥, has email, opened, etc.).",
        ],
      },
      {
        title: "A/B/C step copy",
        body: [
          "Sendable steps can hold variants A+B by default. Variant C is extra testing in God Mode.",
          "Weights control traffic. Assignment is sticky per prospect.",
        ],
      },
      {
        title: "50/50 A/B experiment",
        steps: [
          "Sequences → A/B experiment (50/50), or New sequence → that card.",
          "Skout creates Mode A + Mode B from templates under one experiment.",
          "Click Start test (both sequences must be active — Skout activates them for you).",
          "Enroll a list. Assignment is deterministic: sha256(experimentId:prospectId) — same person always lands on the same arm.",
          "Compare reply / completion rates on the experiment page.",
        ],
      },
      {
        title: "Publish versions & Activity",
        body: [
          "Activate publishes a snapshot. In-flight enrollments stay on that version even if you edit later.",
          "Click Publish version after live edits so new enrollments pick up the change.",
          "Activity tab is the explainable ledger: enrolled, conditions, branches, fallbacks, stops.",
        ],
      },
      {
        title: "Ask vs Auto (AI segregation)",
        body: [
          "Ask mode: AI proposes copy or a cadence. Nothing is saved until you click Apply / Create sequence.",
          "Auto mode: AI applies email copy to the focused step, or creates the sequence immediately.",
          "AI drafts can go to AI Review before send — see the AI Review and Draft auto-approve guides.",
        ],
        note: "Connect an active inbox before expecting emails to send. LinkedIn steps need a connected Unipile account.",
      },
    ],
  },
  "ai-review": {
    sections: [
      {
        title: "Why AI Review exists",
        body: [
          "AI Review is the human-in-the-loop queue for outreach written by AI.",
          "Drafts stay pending until someone on your team approves, edits, or rejects them.",
        ],
      },
      {
        title: "Review a draft",
        steps: [
          "Open Outreach → AI review.",
          "Filter by Pending / Edited / Approved / Rejected.",
          "Open a draft, edit subject/body if needed, then Approve (sends when eligible) or Reject.",
          "Use bulk approve for multiple drafts you have already spot-checked.",
        ],
        note: "Ask-mode chat with “stage for review” can send emails here automatically when a prospect is in context. Auto-approved drafts still appear here, tagged.",
      },
    ],
  },
  "import-prospects": {
    sections: [
      {
        title: "Supported files",
        body: [
          "CSV and Excel (.xlsx / .xls) with columns like Name, Email, Company, Domain, Title.",
          "PDF contact lists — text extracted, or OCR via OpenRouter when needed.",
          "Images (PNG/JPEG) of lists or business cards — OCR extracts rows.",
        ],
      },
      {
        title: "Import flow",
        steps: [
          "Open Discover → Import (or Import from Lists).",
          "Upload a file (max 8MB).",
          "Preview parsed rows; fix or remove bad rows if needed.",
          "Choose an existing list or type a new list name.",
          "Click Import. Optionally enable auto-enrich for the first batch.",
        ],
        note: "Each row needs a full name and a company domain (or an email so domain can be derived).",
      },
    ],
  },
  "billing-invoices": {
    sections: [
      {
        title: "Buy credits",
        steps: [
          "Open Settings → Workspace → Credits.",
          "Pick a pack and complete Razorpay checkout.",
          "Credits appear after payment verification (or webhook).",
        ],
      },
      {
        title: "Download monthly invoices",
        steps: [
          "Scroll to Invoices on the Workspace page.",
          "Invoices are grouped by calendar month from paid Razorpay orders.",
          "Click Download to save an HTML invoice (open it and Print → Save as PDF if needed).",
        ],
      },
    ],
  },
  "lists-enrich": {
    sections: [
      {
        title: "Build a list",
        steps: [
          "Create a list from Lists, or import prospects onto a new list.",
          "Add members from Prospect search, Add prospect, or smart-list activation.",
          "Run Enrich / Score / Verify from the list detail page.",
          "Turn on Signal overlay to show funding, hiring, tech, and risk badges on each row. Click a badge for source, date, and confidence.",
        ],
        note: "Verify uses email intelligence when configured, then SMTP. Catch-all / risky addresses may be blocked on send.",
      },
      {
        title: "Enroll into a sequence",
        steps: [
          "Activate the sequence first (draft → active publishes version 1).",
          "From Lists: select lists → Run sequence, or open the sequence → Enroll tab and pick a list.",
          "For a 50/50 test, open the experiment → Enroll list 50/50 instead.",
          "Confirm progress on sequence Analytics and Activity.",
        ],
        note: "Connect an active inbox before expecting emails to send. LinkedIn invite steps need Unipile.",
      },
    ],
  },
  "search-icp": {
    sections: [
      {
        title: "Set your ICP",
        steps: [
          "Open ICP → Setup wizard (/onboarding) or Settings → ICP.",
          "Capture industries, geo, seniority, company size, buyer titles, and product pains.",
          "Save. Scoring and search use this profile immediately.",
        ],
        note: "A GDPR-compliant badge is shown during onboarding. Revisit ICP anytime your GTM motion changes.",
      },
      {
        title: "Search the corpus",
        steps: [
          "Open Discover → Prospect search.",
          "Filter by role, company, location, tech, and other signals.",
          "Score results against ICP, then activate selected people into a list.",
        ],
        note: "Search costs credits per page. The AI chat search_prospects tool is a free preview.",
      },
      {
        title: "Add one prospect",
        body: [
          "Use Add prospect for inbound leads or warm intros you already know.",
          "For bulk, use Import instead.",
        ],
      },
    ],
  },
  "smart-lists": {
    sections: [
      {
        title: "Create a smart list",
        steps: [
          "Open Discover → Smart lists.",
          "Name it and set optional filters (industry, country, seniority, headcount, tech, query).",
          "Choose a refresh cadence (off / daily / weekly) and save.",
          "Preview matches, then activate into a regular list for enrich/enroll.",
        ],
        note: "Smart lists save the filter set; activation copies current matches into a working list.",
      },
    ],
  },
  tam: {
    sections: [
      {
        title: "Create a TAM",
        steps: [
          "Open Discover → Market (TAM) → New TAM.",
          "Name the universe and base it on your ICP (or override segments).",
          "Recompute size and coverage on demand.",
        ],
      },
      {
        title: "Coverage funnel",
        body: [
          "activated → enriched → contacted → replied → deal.",
          "Drill any segment into a live list to export or enroll in a sequence.",
          "Turn on Signal overlay, then drill in — the list opens with badges already on.",
        ],
      },
    ],
  },
  enrichment: {
    sections: [
      {
        title: "Run enrichment",
        steps: [
          "From a list, click Enrich / Score / Verify, or open Activate → Enrichment.",
          "Watch job progress, failures, and credit spend.",
          "Open a job for row-level detail when something looks off.",
        ],
        note: "Credits are spent when providers find or verify contacts. Phone is typically score-gated.",
      },
    ],
  },
  "crm-hubspot": {
    sections: [
      {
        title: "Work the pipeline in Skout",
        body: [
          "CRM → Overview for snapshot metrics.",
          "Companies, Contacts, Deals, Tasks, Meetings, and Calendar live under CRM.",
          "Sequence call/task steps can create CRM tasks with dispositions.",
        ],
      },
      {
        title: "Connect HubSpot",
        steps: [
          "Open Settings → CRM (/settings/crm).",
          "Click Connect HubSpot and approve OAuth.",
          "Import: All contacts or a HubSpot list → pick/create a Skout list (free, up to 500 per run).",
          "Export: from a Skout list, push enriched contacts (1 credit per contact).",
          "Disconnect anytime on the same page.",
        ],
        note: "Server must have HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET. If Connect says “not configured”, ask an admin.",
      },
    ],
  },
  calling: {
    sections: [
      {
        title: "Set up click-to-call",
        steps: [
          "Open Settings → Calling.",
          "Save your agent phone number (E.164, e.g. +16505550100).",
          "Workspace must have Twilio configured (account SID, auth token, from number).",
        ],
        note: "Dial calls your phone first, then bridges to the prospect. If Twilio is Suspended, dials return Authenticate / 502 until unsuspended.",
      },
      {
        title: "Use calling",
        steps: [
          "From a contact or sequence Call step, click Dial.",
          "Pick up on your phone; Skout then rings the prospect.",
          "Log disposition on the related CRM task when the call ends.",
        ],
      },
    ],
  },
  "google-calendar": {
    sections: [
      {
        title: "Connect Google",
        steps: [
          "Open Settings → Google Calendar.",
          "Click Connect — you are redirected to Google OAuth (full page, not a popup).",
          "After redirect back, status shows Connected. No extra sync step.",
        ],
        note: "Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on the API. Disconnect anytime on this page.",
      },
      {
        title: "Book meetings",
        body: [
          "From CRM → Meetings or Calendar, create a meeting with attendees.",
          "Skout creates a Google Calendar event with a real Meet link when connected.",
          "Optional meeting bot auto-join is controlled on Calling / workspace settings.",
        ],
      },
    ],
  },
  inbox: {
    sections: [
      {
        title: "Email folder",
        body: [
          "Inbox shows IMAP-synced threads. Use Sent / Outbox for outbound.",
          "Approve AI drafts to send; they appear under Sent.",
        ],
      },
      {
        title: "LinkedIn & WhatsApp",
        steps: [
          "Connect Unipile, then connect accounts under Deliverability.",
          "Switch Inbox tabs to LinkedIn or WhatsApp.",
          "Find people on LinkedIn or start a WhatsApp thread from the inbox tools.",
        ],
      },
    ],
  },
  team: {
    sections: [
      {
        title: "Invite teammates",
        steps: [
          "Open Settings → Team (owner/admin).",
          "Enter email, pick a role (owner / admin / member), send invite.",
          "Pending invites can complete via OTP or SSO. Cap is 50 members per workspace.",
        ],
      },
    ],
  },
  analytics: {
    sections: [
      {
        title: "Workspace analytics",
        body: [
          "Open Analytics for credit usage, enrichment performance, and list activity.",
          "Sequence-level open/click/reply lives on each sequence → Analytics tab.",
          "A/B experiment pages compare reply and completion rates by arm.",
        ],
      },
    ],
  },
  "automation-rules": {
    sections: [
      {
        title: "Auto-activation rules",
        steps: [
          "Open Settings → Automation rules → New rule.",
          "Choose a score threshold and optional signal.",
          "Action: activate, add to a list, and/or enroll in a sequence.",
          "Max 5 active rules so automation stays reviewable.",
        ],
      },
    ],
  },
  "alert-notifications": {
    sections: [
      {
        title: "Signal alerts",
        steps: [
          "Open Settings → Signal alerts → New alert.",
          "Pick signal types (funding, hiring, tech change, engagement decay, etc.).",
          "Scope to accounts you own or a list.",
        ],
      },
      {
        title: "Notification delivery",
        steps: [
          "Open Settings → Notifications.",
          "Choose in-app vs Slack per alert type.",
          "Connect Slack and send a test to confirm delivery.",
        ],
      },
    ],
  },
  "draft-auto-approve": {
    sections: [
      {
        title: "Thresholds",
        steps: [
          "Open Outreach → Draft auto-approve.",
          "Set minimum ICP score and draft confidence.",
          "Optionally mark lists as always-review (never auto-approve).",
        ],
        note: "Auto-approved drafts still appear in AI Review, tagged. Everything below threshold waits for a human.",
      },
    ],
  },
};
