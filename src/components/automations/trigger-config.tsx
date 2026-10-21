"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MIN_SCHEDULE_MINUTES, STATE_CHANGE_EVENTS, WORKFLOW_EVENT_TYPES, type TriggerKind } from "@/lib/automations";

/** "SubscriptionStatusChanged" → "Subscription status changed". */
export function eventLabel(type: string) {
  const words = type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const DIMENSIONS = ["opportunity", "commercial", "onboarding", "account", "health", "support"] as const;

/**
 * COPS-10 trigger selector (Bible p.68: event, schedule, field/state change) and the events that
 * stop open runs for the same account (p.74). "Manual" keeps the older manual/webhook start.
 */
export function TriggerConfig({ config, set }: { config: Record<string, unknown>; set: (patch: Record<string, unknown>) => void }) {
  const kind = ((config.kind as TriggerKind | undefined) ?? "manual") as TriggerKind;
  const stopOn = (config.stopOn as string[] | undefined) ?? [];
  const toggleStop = (e: string) => set({ stopOn: stopOn.includes(e) ? stopOn.filter((x) => x !== e) : [...stopOn, e] });

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Starts when</span>
        <Select
          data-testid="config-trigger-kind"
          value={kind}
          onChange={(e) => {
            const next = e.target.value as TriggerKind;
            set({
              kind: next,
              eventType: next === "event" ? "TicketCreated" : next === "state_change" ? "LifecycleTransitioned" : undefined,
              everyMinutes: next === "schedule" ? 60 : undefined,
            });
          }}
        >
          <option value="manual">Manually or by webhook</option>
          <option value="event">An event happens</option>
          <option value="state_change">A state changes</option>
          <option value="schedule">On a schedule</option>
        </Select>
      </label>

      {kind === "manual" && (
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Start with</span>
          <Select data-testid="config-triggerType" value={(config.triggerType as string) ?? "manual"} onChange={(e) => set({ triggerType: e.target.value })}>
            <option value="manual">Run now button</option>
            <option value="webhook">Inbound webhook</option>
          </Select>
        </label>
      )}

      {kind === "event" && (
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Event</span>
          <Select data-testid="config-eventType" value={(config.eventType as string) ?? ""} onChange={(e) => set({ eventType: e.target.value })}>
            {WORKFLOW_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {eventLabel(t)}
              </option>
            ))}
          </Select>
          <span className="block text-xs text-muted-foreground">One run per event, about the event&apos;s account. Its fields are this step&apos;s output.</span>
        </label>
      )}

      {kind === "state_change" && (
        <>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">What changes</span>
            <Select data-testid="config-eventType" value={(config.eventType as string) ?? "LifecycleTransitioned"} onChange={(e) => set({ eventType: e.target.value, dimension: undefined })}>
              {STATE_CHANGE_EVENTS.map((t) => (
                <option key={t} value={t}>
                  {t === "LifecycleTransitioned" ? "A lifecycle stage" : "The subscription status"}
                </option>
              ))}
            </Select>
          </label>
          {config.eventType !== "SubscriptionStatusChanged" && (
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Lifecycle</span>
              <Select value={(config.dimension as string) ?? ""} onChange={(e) => set({ dimension: e.target.value || undefined })}>
                <option value="">Any</option>
                {DIMENSIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Moves into (optional)</span>
            <Input data-testid="config-toState" value={(config.toState as string) ?? ""} placeholder="e.g. stalled" onChange={(e) => set({ toState: e.target.value || undefined })} />
          </label>
        </>
      )}

      {kind === "schedule" && (
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Every (minutes)</span>
          <Input
            data-testid="config-everyMinutes"
            type="number"
            min={MIN_SCHEDULE_MINUTES}
            value={String(config.everyMinutes ?? 60)}
            onChange={(e) => set({ everyMinutes: Number(e.target.value) })}
          />
          <span className="block text-xs text-muted-foreground">At least every {MIN_SCHEDULE_MINUTES} minutes. One run per interval.</span>
        </label>
      )}

      <fieldset className="space-y-1 text-sm">
        <legend className="text-muted-foreground">Stop open runs for the account when</legend>
        <div className="flex flex-wrap gap-1.5" data-testid="config-stopOn">
          {["CustomerActivated", "TicketResolved", "PaymentSucceeded", "ContractSigned"].map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={stopOn.includes(e)}
              onClick={() => toggleStop(e)}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${stopOn.includes(e) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              {eventLabel(e)}
            </button>
          ))}
        </div>
        <span className="block text-xs text-muted-foreground">Replies and opt-outs already stop sequences on their own.</span>
      </fieldset>
    </div>
  );
}
