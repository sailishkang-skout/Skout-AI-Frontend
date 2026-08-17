"use client";

import Link from "next/link";
import { BadgeCheck, Search, Sparkles, Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tools = [
  {
    href: "/intelligence/email/verify",
    icon: BadgeCheck,
    title: "Verify",
    description: "SMTP/MX/catch-all checks and send-eligibility for one email or a batch.",
  },
  {
    href: "/intelligence/email/discover",
    icon: Search,
    title: "Discover",
    description: "Find and verify the most likely email for a first name, last name, and domain.",
  },
  {
    href: "/intelligence/email/patterns",
    icon: Sparkles,
    title: "Patterns",
    description: "Rank the likely email address patterns for a domain from historical evidence.",
  },
];

export default function EmailIntelligenceOverviewPage() {
  return (
    <PageShell>
      <PageHeader
        title="Email Intelligence"
        description="SMTP-based verification, discovery, and pattern ranking, powered by Skout's dedicated email intelligence service."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <tool.icon className="h-4 w-4 text-primary" aria-hidden />
                  <CardTitle className="text-base">{tool.title}</CardTitle>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Link href="/intelligence/email/warmup">
          <Card className="h-full opacity-80 transition-colors hover:border-primary/50 hover:bg-accent/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle className="text-base">Warm-up</CardTitle>
                <Badge tone="muted">Coming soon</Badge>
              </div>
              <CardDescription>
                Gradual sending-reputation warm-up per domain, with a visible warm-up period and
                health score. The underlying engine isn&apos;t wired to send mail yet.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </PageShell>
  );
}
