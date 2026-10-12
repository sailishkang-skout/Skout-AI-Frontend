"use client";

import { useParams } from "next/navigation";
import { CampaignDetailView } from "@/components/enrichment/campaign-detail";

export default function EnrichmentCampaignPage() {
  const params = useParams<{ id: string }>();
  return <CampaignDetailView campaignId={params.id} />;
}
