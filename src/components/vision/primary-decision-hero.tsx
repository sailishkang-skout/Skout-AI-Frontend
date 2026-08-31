"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { VisionPrimaryDecision } from "@/lib/vision-screens";

export function PrimaryDecisionHero({
  screenLabel,
  decision,
  compact,
  onAction,
}: {
  screenLabel: string;
  decision: VisionPrimaryDecision;
  compact?: boolean;
  onAction?: () => void;
}) {
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">{screenLabel}</p>
          <p className="truncate text-sm font-semibold">{decision.title}</p>
        </div>
        {onAction ? (
          <Button size="sm" variant="outline" onClick={onAction}>
            {decision.cta}
          </Button>
        ) : (
          <Link href={decision.href} className={buttonVariants({ size: "sm", variant: "outline" })}>
            {decision.cta}
          </Link>
        )}
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Primary decision · {screenLabel}
          </p>
          <h2 className="text-lg font-semibold">{decision.title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{decision.description}</p>
        </div>
        {onAction ? (
          <Button onClick={onAction}>
            {decision.cta}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Link href={decision.href} className={buttonVariants()}>
            {decision.cta}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
