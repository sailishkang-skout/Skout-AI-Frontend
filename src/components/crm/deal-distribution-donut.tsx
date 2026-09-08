"use client";

import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardOverview } from "@/types/crm";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

const STAGE_COLORS = [
  "hsl(var(--muted-foreground))",
  "hsl(var(--chart-1, 210 100% 50%))",
  "hsl(var(--chart-2, 280 100% 50%))",
  "hsl(var(--chart-3, 340 100% 50%))",
  "hsl(var(--primary))",
];

function formatTotal(value: number, currency: string): string {
  if (value >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${currency} ${(value / 1_000).toFixed(0)}k`;
  return `${currency} ${value.toFixed(0)}`;
}

export function DealDistributionDonut({
  stages,
  isLoading,
}: {
  stages?: DashboardOverview["stages"];
  isLoading?: boolean;
}) {
  const router = useRouter();

  // Stage value is per-currency (never summed across currencies — a $50k deal and a ₹50k deal
  // aren't the same 50k); this chart shows whichever currency each stage's deals are actually in,
  // which in practice is one currency per workspace.
  const chartData = (stages ?? [])
    .map((stage) => ({
      stageId: stage.stageId,
      name: stage.name,
      value: stage.valueByCurrency[0]?.value ?? 0,
      currency: stage.valueByCurrency[0]?.currency ?? "USD",
      count: stage.count,
    }))
    .filter((s) => s.value > 0);

  const totalValue = chartData.reduce((sum, s) => sum + s.value, 0);
  const totalCurrency = chartData[0]?.currency ?? "USD";

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Pipeline Distribution</CardTitle>
        <CardDescription>Open value by deal stage</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center min-h-[300px]">
        {isLoading ? (
          <div className="h-[250px] w-full">
            <ChartSkeleton />
          </div>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open deals yet.</p>
        ) : (
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const p = payload[0].payload as (typeof chartData)[number];
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">{p.name}</span>
                            <span className="font-bold">{formatTotal(p.value, p.currency)}</span>
                            <span className="text-[0.65rem] text-muted-foreground">{p.count} deals · click to view</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  onClick={(entry) => {
                    const point = (entry as unknown as { payload: (typeof chartData)[number] }).payload;
                    router.push(`/crm/deals?stageId=${point.stageId}`);
                  }}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={STAGE_COLORS[index % STAGE_COLORS.length]}
                      className="cursor-pointer"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold tabular-nums">{formatTotal(totalValue, totalCurrency)}</span>
              <span className="text-xs text-muted-foreground">Total Open</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
