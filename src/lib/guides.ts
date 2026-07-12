export type GuideSlug =
  | "workspace"
  | "connect-inbox"
  | "sending-domain"
  | "deliverability"
  | "integrations";

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
    title: "Connect enrichment integrations",
    summary: "Add provider API keys so enrichment can use your own accounts first.",
    relatedHref: "/settings/integrations",
    relatedLabel: "Integrations",
  },
];

export function getGuide(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function guidePath(slug: GuideSlug): string {
  return `/guides/${slug}`;
}
