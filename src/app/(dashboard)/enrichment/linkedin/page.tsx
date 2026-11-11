import { ResearchOverview } from "@/components/enrichment/research-overview";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

/** LinkedIn Enrichment: people and companies captured with the Skout extension. */
export default function LinkedInEnrichmentPage() {
  return (
    <PageShell>
      <PageHeader
        title="LinkedIn Enrichment"
        description="People and companies captured from LinkedIn with the Skout extension, their evidence and job changes."
      />
      <ResearchOverview />
    </PageShell>
  );
}
