"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingFormSheet } from "@/components/crm/meeting-form-sheet";
import { useMeetingsApi, type GoogleCalendarEvent } from "@/lib/crm/meetings";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/types/crm";

type CalendarEntry =
  | { kind: "meeting"; time: Date; meeting: Meeting }
  | { kind: "google"; time: Date; event: GoogleCalendarEvent };

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

  const rangeFromIso = rangeFrom.toISOString();
  const rangeToIso = new Date(
    rangeTo.getFullYear(),
    rangeTo.getMonth(),
    rangeTo.getDate(),
    23,
    59,
    59
  ).toISOString();

  const meetings = useQuery({
    queryKey: ["crm", "meetings", "calendar", year, month],
    queryFn: () => meetingsApi.list({ limit: 500, from: rangeFromIso, to: rangeToIso }),
    enabled: authReady,
  });

  // Everything on the user's connected Google Calendar in the same range, so events created
  // directly in Google (not through Skout) also show up — not just meetings we created here.
  // Best-effort overlay: a failure here (or no connection) never blocks the native meetings.
  const googleEvents = useQuery({
    queryKey: ["crm", "meetings", "google-events", year, month],
    queryFn: () => meetingsApi.listGoogleEvents(rangeFromIso, rangeToIso),
    enabled: authReady,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    const push = (key: string, entry: CalendarEntry) => {
      const existing = map.get(key) ?? [];
      existing.push(entry);
      map.set(key, existing);
    };

    // A meeting already scheduled on Google carries its googleEventId — skip that same event
    // in the Google feed instead of showing it twice.
    const linkedGoogleIds = new Set(
      (meetings.data?.data ?? []).map((m) => m.googleEventId).filter((id): id is string => Boolean(id))
    );

    for (const meeting of meetings.data?.data ?? []) {
      const time = new Date(meeting.scheduledAt);
      push(time.toDateString(), { kind: "meeting", time, meeting });
    }
    for (const event of googleEvents.data?.data ?? []) {
      if (linkedGoogleIds.has(event.googleEventId)) continue;
      const time = new Date(event.start);
      if (Number.isNaN(time.getTime())) continue;
      push(time.toDateString(), { kind: "google", time, event });
    }

    map.forEach((list) => list.sort((a, b) => a.time.getTime() - b.time.getTime()));
    return map;
  }, [meetings.data, googleEvents.data]);

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
              const dayEntries = byDay.get(day.toDateString()) ?? [];
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
                    {dayEntries.map((entry) =>
                      entry.kind === "meeting" ? (
                        <button
                          key={entry.meeting.id}
                          type="button"
                          onClick={() => {
                            setEditingMeeting(entry.meeting);
                            setSheetOpen(true);
                          }}
                          className="block w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-xs text-primary hover:bg-primary/20"
                          title={entry.meeting.title}
                        >
                          {entry.time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{" "}
                          {entry.meeting.title}
                        </button>
                      ) : (
                        // From the connected Google Calendar, not created in Skout — no meeting
                        // record to edit here, so it opens the event on Google instead.
                        <a
                          key={entry.event.googleEventId}
                          href={entry.event.htmlLink ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 truncate rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                          title={`${entry.event.title} (Google Calendar)`}
                        >
                          <span className="truncate">
                            {entry.time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{" "}
                            {entry.event.title}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                        </a>
                      )
                    )}
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
