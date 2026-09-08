"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

interface GtmFunnelProps {
  data?: {
    discovered: number;
    enriched: number;
    inSequence: number;
    replied: number;
    meetings: number;
    opportunities: number;
  };
  isLoading?: boolean;
}

export function GtmFunnel({ data, isLoading }: GtmFunnelProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { stage: "Discovered", count: data.discovered },
      { stage: "Enriched", count: data.enriched },
      { stage: "In Sequence", count: data.inSequence },
      { stage: "Replied", count: data.replied },
      { stage: "Meetings", count: data.meetings },
      { stage: "Opportunities", count: data.opportunities },
    ];
  }, [data]);

  return (
    <Card className="col-span-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">GTM Funnel Conversion</CardTitle>
        <CardDescription>Prospect flow from discovery to opportunity creation (Last 30 days).</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[240px]">
            <ChartSkeleton />
            <span className="sr-only">Loading funnel data...</span>
          </div>
        ) : !data || chartData.every((d) => d.count === 0) ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            Not enough data to generate funnel. Add prospects to begin.
          </div>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="stage" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <span className="font-medium text-muted-foreground">{payload[0].payload.stage}</span>
                            <span className="font-semibold tabular-nums text-right">
                              {payload[0].value?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
