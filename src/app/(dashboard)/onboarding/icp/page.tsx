"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EMPTY_ICP, IcpForm } from "@/components/icp/icp-form";
import { icpApi } from "@/lib/icp";
import type { IcpConfig } from "@/types/api";

const STEPS = [
  { n: 1 as const, title: "Industries", desc: "Which industries are the best fit?" },
  { n: 2 as const, title: "Geo & seniority", desc: "Where do your buyers sit?" },
  { n: 3 as const, title: "Company size", desc: "Employee count range for your ICP." },
];

export default function IcpOnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [config, setConfig] = useState<IcpConfig>(EMPTY_ICP);

  useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => icpApi.save(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["icp"] });
      router.push("/prospects/search");
    },
  });

  const isLast = step === 3;

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Define your ICP"
        description={`Step ${step} of 3 — used for scoring, enrichment priority, and smart lists.`}
      />

      <DemoBanner />

      <div className="flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
        {STEPS.map((s) => (
          <div
            key={s.n}
            className={`h-1.5 flex-1 rounded-full transition-colors ${s.n <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{STEPS[step - 1].title}</CardTitle>
          <CardDescription>{STEPS[step - 1].desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <IcpForm value={config} onChange={setConfig} step={step} />
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          disabled={step === 1 || save.isPending}
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          className="w-full sm:w-auto"
        >
          Back
        </Button>
        {isLast ? (
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save & go to search
          </Button>
        ) : (
          <Button
            onClick={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
            className="w-full sm:w-auto"
          >
            Next
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        You can edit this anytime under ICP settings.
      </p>
    </PageShell>
  );
}
