"use client";

import { useParams } from "next/navigation";
import { CompanyDetailView } from "@/components/enrichment/company-detail";

export default function EnrichmentCompanyPage() {
  const params = useParams<{ id: string }>();
  return <CompanyDetailView companyId={params.id} />;
}
