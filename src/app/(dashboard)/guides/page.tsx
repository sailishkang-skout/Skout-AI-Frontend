import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GUIDES } from "@/lib/guides";

export default function GuidesIndexPage() {
  return (
    <PageShell>
      <PageHeader
        title="Setup guides"
        description="Step-by-step help for workspace, inbox, domain DNS, and integrations."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <Card key={guide.slug} className="transition-colors hover:border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-primary" />
                {guide.title}
              </CardTitle>
              <CardDescription>{guide.summary}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              <Link
                href={`/guides/${guide.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                Open guide
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={guide.relatedHref}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
              >
                Go to {guide.relatedLabel}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
