import { notFound } from "next/navigation";
import { GuideLayout, GuideNote, GuideSection, GuideSteps } from "@/components/guides/guide-layout";
import { getGuide, type GuideSlug } from "@/lib/guides";

const CONTENT: Record<
  GuideSlug,
  { sections: { title: string; description?: string; steps?: string[]; body?: string[]; note?: string }[] }
> = {
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
        note: "Credits power enrichment and related paid actions. Top-ups usually appear within a few seconds after payment confirmation.",
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
          "Enroll a prospect you control into a short sequence, or reply from Inbox.",
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
          "Call POST /api/v1/domains/:id/verify (or use Verify when available in the UI).",
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
        title: "Add a provider key",
        steps: [
          "Open Settings → Integrations.",
          "Paste the provider API key and Save.",
          "Optionally Test the key before saving.",
          "Enrichment prefers your key first (with a Skout credit discount when applicable).",
        ],
        note: "Remove a key anytime to fall back to platform keys when available.",
      },
    ],
  },
};

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const content = CONTENT[guide.slug];

  return (
    <GuideLayout guide={guide}>
      {content.sections.map((section) => (
        <GuideSection key={section.title} title={section.title} description={section.description}>
          {section.body?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {section.steps && <GuideSteps steps={section.steps} />}
          {section.note && <GuideNote>{section.note}</GuideNote>}
        </GuideSection>
      ))}
    </GuideLayout>
  );
}
