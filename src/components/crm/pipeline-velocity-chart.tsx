"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Simulated 30-day pipeline value history
const generateData = () => {
  const data = [];
  let currentValue = 420000;
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: currentValue,
    });
    // Add some random variation, trending up
    currentValue += Math.floor(Math.random() * 25000) - 5000;
  }
  return data;
};

const mockData = generateData();

const formatCurrency = (value: number) => `$${(value / 1000).toFixed(0)}k`;

export function PipelineVelocityChart() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Pipeline Velocity</CardTitle>
        <CardDescription>Total open pipeline value (30 days)</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              {payload[0].payload.date}
                            </span>
                            <span className="font-bold text-muted-foreground">
                              ${payload[0].value?.toLocaleString()}
                            </span>
                          </div>
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
      </CardContent>
    </Card>
  );
}
