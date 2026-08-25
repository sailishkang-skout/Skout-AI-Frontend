"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WarmupEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function WarmupStatGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; tone?: "default" | "success" | "warning" | "danger" | "muted" }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <div className="mt-1 flex items-center gap-2 text-sm font-medium">
            {typeof item.value === "string" || typeof item.value === "number" ? (
              item.tone ? <Badge tone={item.tone}>{String(item.value)}</Badge> : String(item.value)
            ) : (
              item.value
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WarmupStatusBreakdown({
  title,
  counts,
}: {
  title: string;
  counts?: Record<string, number> | null;
}) {
  const entries = Object.entries(counts ?? {});
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <WarmupEmpty>No status breakdown yet.</WarmupEmpty>
        ) : (
          <ul className="space-y-2">
            {entries.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <Badge tone="muted">{status}</Badge>
                <span className="font-medium tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function MailboxSelect({
  value,
  onChange,
  options,
  placeholder = "Select a mailbox…",
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      className={cn("h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
