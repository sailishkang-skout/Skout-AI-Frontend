/** §17 concept screens — functional component map (not pixel mockups). */

export type VisionScreenId =
  | "17.1"
  | "17.2"
  | "17.3"
  | "17.4"
  | "17.5"
  | "17.6"
  | "17.7"
  | "17.8"
  | "17.9"
  | "17.10"
  | "17.11"
  | "17.12"
  | "17.13"
  | "17.14"
  | "17.15"
  | "17.16"
  | "17.17"
  | "17.18";

export interface VisionPrimaryDecision {
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface VisionScreenConfig {
  id: VisionScreenId;
  label: string;
  primaryDecision: VisionPrimaryDecision;
  policyActionKey?: string;
  freshnessLabel: string;
}

export const VISION_SCREENS: Record<VisionScreenId, VisionScreenConfig> = {
  "17.1": {
    id: "17.1",
    label: "Master dashboard",
    primaryDecision: {
      title: "Act on your top priority",
      description: "Review open decisions and hot account signals before starting outreach.",
      href: "/decisions",
      cta: "Review decisions",
    },
    policyActionKey: "dashboard.export",
    freshnessLabel: "Dashboard KPIs",
  },
  "17.2": {
    id: "17.2",
    label: "Dexter command bar",
    primaryDecision: {
      title: "Ask Dexter to orchestrate",
      description: "Navigate, draft, or execute GTM actions with policy-gated previews.",
      href: "/dexter",
      cta: "Open Command Center",
    },
    policyActionKey: "dexter.chat",
    freshnessLabel: "Workspace context",
  },
  "17.3": {
    id: "17.3",
    label: "TAM builder",
    primaryDecision: {
      title: "Approve or refine your market",
      description: "Validate TAM coverage and segment fit before launching campaigns.",
      href: "/tam",
      cta: "Review TAM segments",
    },
    policyActionKey: "tam.approve",
    freshnessLabel: "TAM universe",
  },
  "17.4": {
    id: "17.4",
    label: "Enrichment workbooks",
    primaryDecision: {
      title: "Resume or fix enrichment",
      description: "Clear failed jobs and export verified records to sequences.",
      href: "/enrichment/workbooks",
      cta: "Open workbooks",
    },
    policyActionKey: "enrichment.run",
    freshnessLabel: "Enrichment jobs",
  },
  "17.5": {
    id: "17.5",
    label: "Account 360",
    primaryDecision: {
      title: "Engage this account",
      description: "Use signals and NBA to choose the next account-level motion.",
      href: "/signals",
      cta: "View account signals",
    },
    policyActionKey: "crm.account.write",
    freshnessLabel: "Account intelligence",
  },
  "17.6": {
    id: "17.6",
    label: "Person 360",
    primaryDecision: {
      title: "Take the next best action",
      description: "Ground outreach in evidence-backed contact activity and NBA.",
      href: "/decisions",
      cta: "Create decision from NBA",
    },
    policyActionKey: "crm.contact.write",
    freshnessLabel: "Contact record",
  },
  "17.7": {
    id: "17.7",
    label: "Signals hub",
    primaryDecision: {
      title: "Prioritize hot accounts",
      description: "Route high-intent signals into lists, sequences, or Dexter plans.",
      href: "/sequences",
      cta: "Enroll from signals",
    },
    policyActionKey: "signals.route",
    freshnessLabel: "Signal stack",
  },
  "17.8": {
    id: "17.8",
    label: "Sequences",
    primaryDecision: {
      title: "Launch or tune cadences",
      description: "Check enroll health, consent gates, and step performance.",
      href: "/sequences",
      cta: "Review active sequences",
    },
    policyActionKey: "sequence.enroll",
    freshnessLabel: "Sequence analytics",
  },
  "17.9": {
    id: "17.9",
    label: "Dexter orchestrator",
    primaryDecision: {
      title: "Approve the proposed plan",
      description: "Propose, approve, invoke, and learn from Dexter orchestration runs.",
      href: "/dexter",
      cta: "Manage plans",
    },
    policyActionKey: "dexter.plan",
    freshnessLabel: "Command center",
  },
  "17.10": {
    id: "17.10",
    label: "Inbox & LinkedIn voice",
    primaryDecision: {
      title: "Clear high-priority replies",
      description: "Review drafts, voice handoffs, and manual review queues.",
      href: "/inbox",
      cta: "Open inbox",
    },
    policyActionKey: "inbox.send",
    freshnessLabel: "Conversation state",
  },
  "17.11": {
    id: "17.11",
    label: "Chrome companion",
    primaryDecision: {
      title: "Add and enrich from the web",
      description: "Capture profiles with evidence, preview side effects, and enroll with consent.",
      href: "/prospects",
      cta: "Open prospects",
    },
    policyActionKey: "extension.enroll",
    freshnessLabel: "Extension context",
  },
  "17.12": {
    id: "17.12",
    label: "Phone numbers",
    primaryDecision: {
      title: "Provision calling numbers",
      description: "Assign numbers and verify routing before live calls.",
      href: "/settings/numbers",
      cta: "Manage numbers",
    },
    policyActionKey: "calling.number",
    freshnessLabel: "Number inventory",
  },
  "17.13": {
    id: "17.13",
    label: "Calling workspace",
    primaryDecision: {
      title: "Run the call with copilot",
      description: "Use live NBA, talk tracks, and post-call writeback with audit.",
      href: "/settings/calling",
      cta: "Open calling settings",
    },
    policyActionKey: "calling.copilot",
    freshnessLabel: "Call session",
  },
  "17.14": {
    id: "17.14",
    label: "CRM intelligence",
    primaryDecision: {
      title: "Close the revenue gap",
      description: "Review deal NBA, forecast risk, and pipeline intelligence.",
      href: "/crm/intelligence",
      cta: "Review pipeline intel",
    },
    policyActionKey: "crm.deal.write",
    freshnessLabel: "Pipeline models",
  },
  "17.15": {
    id: "17.15",
    label: "Deliverability & warmup",
    primaryDecision: {
      title: "Protect sender reputation",
      description: "Monitor warmup health, bounces, and domain readiness.",
      href: "/deliverability",
      cta: "Check deliverability",
    },
    policyActionKey: "email.send",
    freshnessLabel: "Mailbox health",
  },
  "17.16": {
    id: "17.16",
    label: "Workflows",
    primaryDecision: {
      title: "Unblock workflow runs",
      description: "Inspect async runs, approval gates, and failed automation steps.",
      href: "/workflows",
      cta: "View workflow runs",
    },
    policyActionKey: "workflow.run",
    freshnessLabel: "Automation graph",
  },
  "17.17": {
    id: "17.17",
    label: "Revenue intelligence",
    primaryDecision: {
      title: "Inspect forecast variance",
      description: "Compare CRO summary, reporting, and competitive win/loss signals.",
      href: "/admin/revenue",
      cta: "Open revenue hub",
    },
    policyActionKey: "revenue.report",
    freshnessLabel: "Revenue models",
  },
  "17.18": {
    id: "17.18",
    label: "Enterprise control plane",
    primaryDecision: {
      title: "Resolve governance blockers",
      description: "Clear Dexter approvals, integration degradation, and open incidents.",
      href: "/admin/control-plane",
      cta: "Review control plane",
    },
    policyActionKey: "admin.control",
    freshnessLabel: "Platform telemetry",
  },
};

export function resolveVisionScreen(pathname: string, search = ""): VisionScreenConfig | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (pathname === "/dashboard" || pathname === "/") return VISION_SCREENS["17.1"];
  if (pathname === "/tam" || pathname.startsWith("/tam/")) return VISION_SCREENS["17.3"];
  if (pathname.startsWith("/enrichment/workbooks")) return VISION_SCREENS["17.4"];
  if (pathname === "/crm/360" && params.get("mode") === "account") return VISION_SCREENS["17.5"];
  if (pathname === "/crm/360" && params.get("mode") === "person") return VISION_SCREENS["17.6"];
  if (pathname.startsWith("/crm/contacts/") && pathname !== "/crm/contacts") return VISION_SCREENS["17.6"];
  if (pathname === "/signals") return VISION_SCREENS["17.7"];
  if (pathname.startsWith("/sequences")) return VISION_SCREENS["17.8"];
  if (pathname === "/dexter") return VISION_SCREENS["17.9"];
  if (pathname === "/inbox" || pathname.startsWith("/linkedin/voice")) return VISION_SCREENS["17.10"];
  if (pathname === "/settings/numbers") return VISION_SCREENS["17.12"];
  if (pathname === "/settings/calling") return VISION_SCREENS["17.13"];
  if (pathname.startsWith("/crm/intelligence")) return VISION_SCREENS["17.14"];
  if (pathname.startsWith("/deliverability") || pathname.startsWith("/warmup")) return VISION_SCREENS["17.15"];
  if (pathname.startsWith("/workflows")) return VISION_SCREENS["17.16"];
  if (
    pathname.startsWith("/admin/revenue") ||
    pathname.startsWith("/admin/cro") ||
    pathname.startsWith("/admin/reporting") ||
    pathname.startsWith("/admin/competitive")
  ) {
    return VISION_SCREENS["17.17"];
  }
  if (pathname === "/admin/control-plane") return VISION_SCREENS["17.18"];

  return null;
}

export function extractVisionEntity(
  pathname: string,
  search = ""
): { entityType?: "contact" | "deal" | "company" | "tam"; entityId?: string } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const contactMatch = pathname.match(/^\/crm\/contacts\/([^/]+)$/);
  if (contactMatch) return { entityType: "contact", entityId: contactMatch[1] };

  if (pathname === "/crm/360") {
    const id = params.get("id");
    if (!id) return {};
    if (params.get("mode") === "account") return { entityType: "company", entityId: id };
    if (params.get("mode") === "person") return { entityType: "contact", entityId: id };
  }

  const tamMatch = pathname.match(/^\/tam\/([^/]+)$/);
  if (tamMatch) return { entityType: "tam", entityId: tamMatch[1] };

  const dealMatch = pathname.match(/^\/crm\/deals\/([^/]+)$/);
  if (dealMatch) return { entityType: "deal", entityId: dealMatch[1] };

  return {};
}
