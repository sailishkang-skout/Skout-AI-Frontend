"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineVelocityPoint } from "@/types/crm";

const formatCurrency = (value: number) => `$${(value / 1000).toFixed(0)}k`;

export function PipelineVelocityChart({
  series,
  isLoading,
}: {
  series?: PipelineVelocityPoint[];
  isLoading?: boolean;
}) {
  const chartData = (series ?? []).map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: point.value,
  }));
  const hasData = chartData.some((d) => d.value > 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Pipeline Velocity</CardTitle>
        <CardDescription>New pipeline created per day, USD (30 days)</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : !hasData ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No new deals created in the last 30 days.
          </div>
        ) : (
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  dy={10}
                  minTickGap={30}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              {payload[0].payload.date}
                            </span>
                            <span className="font-bold text-muted-foreground">
                              ${payload[0].value?.toLocaleString()}
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
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
