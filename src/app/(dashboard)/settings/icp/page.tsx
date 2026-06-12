"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EMPTY_ICP, IcpForm } from "@/components/icp/icp-form";
import { icpApi } from "@/lib/icp";
import type { IcpConfig } from "@/types/api";

export default function IcpSettingsPage() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<IcpConfig>(EMPTY_ICP);
  const [saved, setSaved] = useState(false);

  const icp = useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    retry: false,
  });

  useEffect(() => {
    if (icp.data?.config) setConfig(icp.data.config);
  }, [icp.data]);

  const save = useMutation({
    mutationFn: () => icpApi.save(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["icp"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="ICP settings"
        description="Ideal Customer Profile for AI scoring and enrichment prioritization."
        actions={
          <Link
            href="/onboarding/icp"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent sm:w-auto"
          >
            Setup wizard
          </Link>
        }
      />

      <DemoBanner />

      {icp.error && <Alert variant="warning">API unavailable — start the backend on port 3001.</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Workspace ICP</CardTitle>
          <CardDescription>
            {icp.data?.version != null ? `Version ${icp.data.version}` : "Not saved yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <IcpForm value={config} onChange={setConfig} />
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : null}
            {saved ? "Saved" : "Save ICP"}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
