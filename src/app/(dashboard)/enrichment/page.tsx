import { PlaceholderPage } from "@/components/placeholder-page";

export default function EnrichmentPage() {
  return (
    <PlaceholderPage
      title="Enrichment Console"
      description="Trigger conditional refresh — internal graph first, external PAL on fallback."
      apiPath="/api/v1/prospects/:id/enrich"
    />
  );
}
