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
  | "lists-enrich";

export interface GuideMeta {
  slug: GuideSlug;
  title: string;
  summary: string;
  relatedHref: string;
  relatedLabel: string;
}

export const GUIDES: GuideMeta[] = [
  {
    slug: "workspace",
    title: "Workspace setup",
    summary: "Rename your workspace, understand credits, and top up billing.",
    relatedHref: "/settings/workspace",
    relatedLabel: "Workspace settings",
  },
  {
    slug: "connect-inbox",
    title: "Connect an email inbox",
    summary: "Add SMTP/IMAP credentials, verify with a test send, and keep the inbox healthy.",
    relatedHref: "/deliverability",
    relatedLabel: "Deliverability → Inboxes",
  },
  {
    slug: "sending-domain",
    title: "Add & verify a sending domain",
    summary: "Publish SPF, DKIM, DMARC, and MX records, then verify DNS from Deliverability.",
    relatedHref: "/deliverability",
    relatedLabel: "Deliverability → Domains",
  },
  {
    slug: "deliverability",
    title: "Deliverability overview",
    summary: "Monitor inbox health, bounce/spam rates, warmup progress, and analytics.",
    relatedHref: "/deliverability",
    relatedLabel: "Deliverability",
  },
  {
    slug: "integrations",
    title: "Connect integrations",
    summary: "Add Unipile for LinkedIn/WhatsApp, plus enrichment provider API keys (BYOK).",
    relatedHref: "/settings/integrations",
    relatedLabel: "Integrations",
  },
  {
    slug: "sequences-ai",
    title: "Sequences & AI Auto / Ask",
    summary: "Build cadences, use Auto vs Ask modes, and keep AI drafts segregated until you apply.",
    relatedHref: "/sequences",
    relatedLabel: "Sequences",
  },
  {
    slug: "ai-review",
    title: "AI Review queue",
    summary: "Approve, edit, or reject AI-written emails before they send.",
    relatedHref: "/ai/review",
    relatedLabel: "AI review",
  },
  {
    slug: "import-prospects",
    title: "Import lists & prospects",
    summary: "Upload CSV, Excel, PDF, or images (OCR) and land them on a list.",
    relatedHref: "/import",
    relatedLabel: "Import",
  },
  {
    slug: "billing-invoices",
    title: "Credits & Razorpay invoices",
    summary: "Buy credit packs and download monthly paid invoices.",
    relatedHref: "/settings/workspace",
    relatedLabel: "Workspace billing",
  },
  {
    slug: "lists-enrich",
    title: "Lists, enrich & enroll",
    summary: "Create lists, enrich members, verify emails, and enroll into sequences.",
    relatedHref: "/lists",
    relatedLabel: "Lists",
  },
];

export function getGuide(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function guidePath(slug: GuideSlug): string {
  return `/guides/${slug}`;
}
