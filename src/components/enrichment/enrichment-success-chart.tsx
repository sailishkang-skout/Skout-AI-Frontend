"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnrichmentEfficiencyPoint } from "@/lib/enrichment";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

interface EnrichmentSuccessChartProps {
  data?: EnrichmentEfficiencyPoint[];
  isLoading?: boolean;
  /** Called with a bucket's ISO date (YYYY-MM-DD) when the user clicks that day's bars. */
  onDayClick?: (isoDate: string) => void;
}

export function EnrichmentSuccessChart({ data, isLoading, onDayClick }: EnrichmentSuccessChartProps) {
  const chartData = (data ?? []).map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", { weekday: "short" }),
    isoDate: point.date,
    spent: point.spent,
    found: point.found,
  }));
  const hasActivity = chartData.some((d) => d.spent > 0 || d.found > 0);
  const totalSpent = (data ?? []).reduce((sum, p) => sum + p.spent, 0);
  const totalFound = (data ?? []).reduce((sum, p) => sum + p.found, 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Enrichment Efficiency</CardTitle>
        <CardDescription>Credits spent vs valid emails found (Last 7 Days)</CardDescription>
        {hasActivity && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{totalFound}</span> valid email
            {totalFound === 1 ? "" : "s"} found from <span className="font-medium text-foreground">{totalSpent}</span>{" "}
            credit{totalSpent === 1 ? "" : "s"} spent this week.
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-[300px] w-full mt-4">
          {isLoading ? (
            <ChartSkeleton />
          ) : !hasActivity ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No enrichment activity in the last 7 days.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              className={onDayClick ? "cursor-pointer" : undefined}
            >
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
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted-foreground))", opacity: 0.1 }}
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
                              {entry.name === "spent" ? "Credits Spent" : "Emails Found"}: {entry.value}
                            </span>
                          </div>
                        ))}
                        {onDayClick && <span className="text-[0.65rem] text-muted-foreground">Click to view jobs</span>}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="spent"
                fill="hsl(var(--muted-foreground))"
                radius={[4, 4, 0, 0]}
                opacity={0.5}
                onClick={(data) => {
                  const point = (data as { payload: (typeof chartData)[number] }).payload;
                  if (point) onDayClick?.(point.isoDate);
                }}
                style={onDayClick ? { cursor: "pointer" } : undefined}
              />
              <Bar
                dataKey="found"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                onClick={(data) => {
                  const point = (data as { payload: (typeof chartData)[number] }).payload;
                  if (point) onDayClick?.(point.isoDate);
                }}
                style={onDayClick ? { cursor: "pointer" } : undefined}
              />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
