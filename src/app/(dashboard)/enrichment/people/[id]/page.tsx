"use client";

import { useParams } from "next/navigation";
import { PersonDetailView } from "@/components/enrichment/person-detail";

export default function EnrichmentPersonPage() {
  const params = useParams<{ id: string }>();
  return <PersonDetailView prospectId={decodeURIComponent(params.id)} />;
}
