"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Simulated historical conversion data
const generateData = () => {
  const data = [];
  let openRate = 45;
  let replyRate = 12;
  for (let i = 14; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      openRate: openRate,
      replyRate: replyRate,
    });
    // Add random walk
    openRate = Math.max(20, Math.min(80, openRate + (Math.floor(Math.random() * 7) - 3)));
    replyRate = Math.max(2, Math.min(30, replyRate + (Math.floor(Math.random() * 3) - 1)));
  }
  return data;
};

const mockData = generateData();

export function SequencePerformanceChart() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Global Sequence Performance</CardTitle>
        <CardDescription>Aggregate open and reply rates over the last 14 days</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        </div>
      </CardContent>
    </Card>
  );
}
