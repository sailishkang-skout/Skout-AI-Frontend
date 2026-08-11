"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingFormSheet } from "@/components/crm/meeting-form-sheet";
import { useMeetingsApi } from "@/lib/crm/meetings";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/types/crm";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Sunday-start 6-week grid covering the given month, including lead/trail days from neighbors. */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const meetingsApi = useMeetingsApi();
  const authReady = useAuthReady();
  const [cursor, setCursor] = useState(() => new Date());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const rangeFrom = grid[0]!;
  const rangeTo = grid[grid.length - 1]!;

  const meetings = useQuery({
    queryKey: ["crm", "meetings", "calendar", year, month],
    queryFn: () =>
      meetingsApi.list({
        limit: 500,
        from: rangeFrom.toISOString(),
        to: new Date(rangeTo.getFullYear(), rangeTo.getMonth(), rangeTo.getDate(), 23, 59, 59).toISOString(),
      }),
    enabled: authReady,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const meeting of meetings.data?.data ?? []) {
      const key = new Date(meeting.scheduledAt).toDateString();
      const existing = map.get(key) ?? [];
      existing.push(meeting);
      map.set(key, existing);
    }
    map.forEach((list) => {
      list.sort((a: Meeting, b: Meeting) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    });
    return map;
  }, [meetings.data]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <PageShell width="full" data-testid="page-crm-calendar">
      <PageHeader
        title="Calendar"
        description="Every scheduled meeting across the workspace."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">{monthLabel}</span>
            <Button
              variant="outline"
              size="sm"
              className="px-2"
              aria-label="Next month"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setEditingMeeting(undefined);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New meeting
            </Button>
          </>
        }
      />

      {meetings.isError && (
        <Alert variant="error" onRetry={() => meetings.refetch()}>
          {formatQueryError(meetings.error, "Could not load meetings.")}
        </Alert>
      )}

      {meetings.isLoading ? (
        <Skeleton className="h-[600px] w-full rounded-lg" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day) => {
              const inMonth = day.getMonth() === month;
              const dayMeetings = byDay.get(day.toDateString()) ?? [];
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-28 border-b border-r border-border p-1.5 last:border-r-0",
                    !inMonth && "bg-muted/20"
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      !inMonth && "text-muted-foreground",
                      isSameDay(day, today) && "bg-primary text-primary-foreground font-semibold"
                    )}
                  >
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayMeetings.map((meeting) => (
                      <button
                        key={meeting.id}
                        type="button"
                        onClick={() => {
                          setEditingMeeting(meeting);
                          setSheetOpen(true);
                        }}
                        className="block w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-xs text-primary hover:bg-primary/20"
                        title={meeting.title}
                      >
                        {new Date(meeting.scheduledAt).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        {meeting.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <MeetingFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} meeting={editingMeeting} />
    </PageShell>
  );
}
