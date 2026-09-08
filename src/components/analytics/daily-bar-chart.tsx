"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

interface DailyBarChartPoint {
  /** ISO date, YYYY-MM-DD */
  date: string;
  value: number;
  hint?: string;
}

interface DailyBarChartProps {
  data: DailyBarChartPoint[];
  isLoading?: boolean;
  emptyLabel: string;
  color?: string;
  valueLabel: string;
  onDayClick?: (isoDate: string) => void;
}

export function DailyBarChart({
  data,
  isLoading,
  emptyLabel,
  color = "hsl(var(--primary))",
  valueLabel,
  onDayClick,
}: DailyBarChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    isoDate: d.date,
    value: d.value,
    hint: d.hint,
  }));
  const hasData = chartData.some((d) => d.value > 0);

  return (
    <div className="h-40 w-full">
      {isLoading ? (
        <ChartSkeleton />
      ) : !hasData ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
            className={onDayClick ? "cursor-pointer" : undefined}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={28} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted-foreground))", opacity: 0.1 }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const point = payload[0].payload as (typeof chartData)[number];
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                        <span className="font-bold">
                          {point.value.toLocaleString()} {valueLabel}
                        </span>
                        {point.hint && <span className="text-[0.65rem] text-muted-foreground">{point.hint}</span>}
                        {onDayClick && <span className="text-[0.65rem] text-muted-foreground">Click to view</span>}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="value"
              fill={color}
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
  );
}
