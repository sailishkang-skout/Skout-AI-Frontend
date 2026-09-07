"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const mockData = [
  { subject: "Hiring", A: 120, fullMark: 150 },
  { subject: "Funding", A: 40, fullMark: 150 },
  { subject: "Web Traffic", A: 140, fullMark: 150 },
  { subject: "Exec Change", A: 70, fullMark: 150 },
  { subject: "Intent Data", A: 90, fullMark: 150 },
  { subject: "News", A: 50, fullMark: 150 },
];

export function SignalDensityChart() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Signal Density</CardTitle>
        <CardDescription>Volume of signals detected over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={mockData}>
              <PolarGrid stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} 
              />
              <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
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
        </div>
      </CardContent>
    </Card>
  );
}
