import { EnrichmentReleaseGate } from "@/components/enrichment/release-gate";

export default function EnrichmentLayout({ children }: { children: React.ReactNode }) {
  return <EnrichmentReleaseGate>{children}</EnrichmentReleaseGate>;
}
