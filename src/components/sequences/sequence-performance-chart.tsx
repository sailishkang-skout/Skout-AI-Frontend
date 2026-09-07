"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SequencePerformancePoint } from "@/lib/sequences";

interface SequencePerformanceChartProps {
  data?: SequencePerformancePoint[];
  isLoading?: boolean;
}

export function SequencePerformanceChart({ data, isLoading }: SequencePerformanceChartProps) {
  const chartData = (data ?? []).map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    openRate: point.openRate,
    replyRate: point.replyRate,
  }));
  const hasSends = (data ?? []).some((point) => point.sent > 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Global Sequence Performance</CardTitle>
        <CardDescription>Aggregate open and reply rates over the last 14 days</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-[300px] w-full mt-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : !hasSends ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No emails sent in the last 14 days.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm flex flex-col gap-1.5">
                        <span className="text-[0.70rem] uppercase text-muted-foreground font-semibold">
                          {label}
                        </span>
                        {payload.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-sm font-medium">
                              {entry.name === "openRate" ? "Open Rate" : "Reply Rate"}: {entry.value}%
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="openRate"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="replyRate"
                stroke="hsl(var(--chart-2, 280 100% 50%))"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
