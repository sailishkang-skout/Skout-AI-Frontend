import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuideMeta } from "@/lib/guides";

export function GuideLayout({
  guide,
  children,
}: {
  guide: GuideMeta;
  children: ReactNode;
}) {
  return (
    <PageShell width="narrow">
      <div className="space-y-1">
        <Link
          href="/guides"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All guides
        </Link>
      </div>

      <PageHeader
        title={guide.title}
        description={guide.summary}
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={guide.relatedHref}>
              Open {guide.relatedLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">{children}</div>
    </PageShell>
  );
}

export function GuideSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

export function GuideSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-foreground">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

export function GuideNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
