"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const mockData = [
  { name: "Discovery", value: 140000, color: "hsl(var(--muted-foreground))" },
  { name: "Demo Completed", value: 210000, color: "hsl(var(--chart-1, 210 100% 50%))" },
  { name: "Proposal Sent", value: 380000, color: "hsl(var(--chart-2, 280 100% 50%))" },
  { name: "Negotiation", value: 120000, color: "hsl(var(--chart-3, 340 100% 50%))" },
  { name: "Closed Won", value: 450000, color: "hsl(var(--primary))" },
];

export function DealDistributionDonut() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Pipeline Distribution</CardTitle>
        <CardDescription>Value by deal stage</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center min-h-[300px]">
        <div className="h-[250px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            {payload[0].name}
                          </span>
                          <span className="font-bold">
                            ${(payload[0].value as number).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={mockData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {mockData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold tabular-nums">$1.3M</span>
            <span className="text-xs text-muted-foreground">Total Open</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
