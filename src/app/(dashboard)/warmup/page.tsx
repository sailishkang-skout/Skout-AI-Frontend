"use client";

import Link from "next/link";
import {
  Activity,
  Flame,
  Globe2,
  Mail,
  MessageSquare,
  Network,
  OctagonX,
  Layers,
  HeartPulse,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    href: "/warmup/mailboxes",
    icon: Mail,
    title: "Mailboxes",
    description:
      "Register Gmail / M365 inboxes, connect OAuth, and enable them — the identities that actually send warm-up mail.",
  },
  {
    href: "/warmup/control",
    icon: Flame,
    title: "Warm-up control",
    description:
      "Start, pause, resume, or stop the volume ramp per mailbox and inspect scheduler decisions.",
  },
  {
    href: "/warmup/health",
    icon: HeartPulse,
    title: "Health and risk",
    description:
      "Intelligence, risk, and reputation snapshots so you know when it is safe to increase send volume.",
  },
  {
    href: "/warmup/conversations",
    icon: MessageSquare,
    title: "Conversations and signals",
    description:
      "Warm-up threads, classifications, and policy signals — plus poll integration events into Skout.",
  },
  {
    href: "/warmup/domains",
    icon: Globe2,
    title: "Domains",
    description:
      "Customer sending domains with SPF / DKIM / DMARC / MX evidence so auth issues are visible early.",
  },
  {
    href: "/warmup/pools",
    icon: Layers,
    title: "Pools",
    description:
      "Group mailboxes into sending-identity pools for allocation and pooled health monitoring.",
  },
  {
    href: "/warmup/network",
    icon: Network,
    title: "Partner network",
    description:
      "Status of the warm-up recipient network (opaque partner domains and mailboxes).",
  },
  {
    href: "/warmup/operations",
    icon: OctagonX,
    title: "Kill switches",
    description:
      "Emergency pause of new provider sends by scope (tenant, mailbox, provider, etc.).",
  },
];

export default function WarmupOverviewPage() {
  return (
    <PageShell>
      <PageHeader
        title="Email Warm-up"
        description="Gradually build mailbox reputation with safe, policy-aware volume. Separate from Deliverability inbox ramp and Email Intelligence domain tools."
      />
      <div className="mb-6 flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <Activity className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Typical flow: add a mailbox → connect OAuth → enable → start warm-up in Control → watch
          Health &amp; risk. Use Domains for DNS auth, Pools to group senders, Kill switches for
          emergencies.
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <section.icon className="h-4 w-4 text-primary" aria-hidden />
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
