"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Simulated 7-day enrichment success data
const generateData = () => {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const spent = Math.floor(Math.random() * 500) + 100;
    const found = Math.floor(spent * (Math.random() * 0.4 + 0.4)); // 40-80% success rate
    data.push({
      date: date.toLocaleDateString("en-US", { weekday: "short" }),
      spent: spent,
      found: found,
    });
  }
  return data;
};

const mockData = generateData();

export function EnrichmentSuccessChart() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Enrichment Efficiency</CardTitle>
        <CardDescription>Credits spent vs valid emails found (Last 7 Days)</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              />
              <Bar
                dataKey="found"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
