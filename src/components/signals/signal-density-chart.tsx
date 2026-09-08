"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signalLabel } from "@/lib/signals";
import type { SignalDensityResult } from "@/lib/signals";

interface SignalDensityChartProps {
  data?: SignalDensityResult["byType"];
  isLoading?: boolean;
}

export function SignalDensityChart({ data, isLoading }: SignalDensityChartProps) {
  const chartData = (data ?? []).map((bucket) => ({ subject: signalLabel(bucket.signalType), A: bucket.count }));
  const maxCount = Math.max(1, ...chartData.map((d) => d.A));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Signal Density</CardTitle>
        <CardDescription>Volume of signals detected over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        <div className="h-[300px] w-full mt-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No signals detected in the last 7 days.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <RadarChart cx="50%" cy="50%" outerRadius="62%" data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <PolarRadiusAxis angle={30} domain={[0, maxCount]} tick={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              {payload[0].payload.subject}
                            </span>
                            <span className="font-bold">
                              {payload[0].value} Active Signals
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Radar
                  name="Signals"
                  dataKey="A"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
