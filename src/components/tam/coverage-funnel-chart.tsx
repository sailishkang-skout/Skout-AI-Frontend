"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { coverageStages } from "@/lib/tam";
import type { TamCoverageFunnel } from "@/types/api";

interface CoverageFunnelChartProps {
  coverage: TamCoverageFunnel;
  isLoading?: boolean;
}

/**
 * Each stage is an independent slice of `activated` (enriched/contacted/replied/deal are
 * separate cohorts, not a strictly narrowing pipeline — see tam.service.ts's computeCoverage),
 * so this is a horizontal bar comparison, not a funnel-shaped chart that implies monotonic
 * narrowing.
 */
export function CoverageFunnelChart({ coverage, isLoading }: CoverageFunnelChartProps) {
  const denom = Math.max(coverage.total, 1);
  const data = coverageStages().map((stage) => {
    const value = coverage[stage.key];
    const pct = Math.round((value / denom) * 100);
    return { label: stage.label, value, pct, display: `${value.toLocaleString()} (${pct}%)` };
  });

  return (
    <div className="h-56 w-full">
      {isLoading ? (
        <ChartSkeleton />
      ) : (
        <ResponsiveContainer width="100%" height="100%" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
            <XAxis type="number" hide domain={[0, denom]} />
            <YAxis
              type="category"
              dataKey="label"
              axisLine={false}
              tickLine={false}
              width={80}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted-foreground))", opacity: 0.1 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const point = payload[0].payload as (typeof data)[number];
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <span className="text-[0.70rem] uppercase text-muted-foreground">{point.label}</span>
                      <p className="font-bold">{point.display} of total</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20}>
              <LabelList dataKey="display" position="right" style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
