import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GUIDE_GROUPS, GUIDES, type GuideMeta } from "@/lib/guides";

export default function GuidesIndexPage() {
  return (
    <PageShell>
      <PageHeader
        title="Setup guides"
        description="How to use Discover, Sequences (A/B/C + Dexter), CRM, calling, calendar, and workspace settings."
      />

      <div className="space-y-8">
        {GUIDE_GROUPS.map((group) => {
          const items = GUIDES.filter((g) => g.group === group);
          if (!items.length) return null;
          return (
            <section key={group} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">{group}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((guide) => (
                  <GuideCard key={guide.slug} guide={guide} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}

function GuideCard({ guide }: { guide: GuideMeta }) {
  return (
    <Card className="transition-colors hover:border-primary/40">
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
  );
}
