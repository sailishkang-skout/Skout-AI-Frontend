"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackCops } from "@/lib/cops-analytics";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  COPS_NOTIFICATION_EVENT_ROUTES,
  COPS_NOTIFICATION_ROLES,
  type CopsNotificationRole,
  useNotificationsApi,
} from "@/lib/notifications";

const ROLE_LABELS: Record<CopsNotificationRole, string> = {
  sales: "Sales",
  sales_manager: "Sales Manager",
  cs: "Customer Success",
  finance: "Finance",
  legal_revops: "Legal / RevOps",
  engineering: "Engineering",
  product: "Product",
  admin: "Admin",
  owner: "Owner",
};

function roleSummary(roleKeys: readonly CopsNotificationRole[]): string {
  return roleKeys.length > 0 ? roleKeys.map((key) => ROLE_LABELS[key]).join(", ") : "No recipients";
}

export function CopsNotificationRoutesPanel() {
  const authReady = useAuthReady();
  const notificationsApi = useNotificationsApi();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [drafts, setDrafts] = useState<Partial<Record<string, CopsNotificationRole[]>>>({});

  const routes = useQuery({
    queryKey: ["notifications", "cops-routes"],
    queryFn: notificationsApi.listCopsRoutes,
    enabled: authReady,
  });

  const saveRoute = useMutation({
    mutationFn: ({ eventType, roleKeys }: { eventType: string; roleKeys: CopsNotificationRole[] }) =>
      notificationsApi.setCopsRoute(eventType, roleKeys, reason.trim()),
    onSuccess: async (_res, { eventType, roleKeys }) => {
      trackCops("cops.notification_routes_saved", { event_type: eventType, role_count: roleKeys.length });
      setReason("");
      setDrafts({});
      await queryClient.invalidateQueries({ queryKey: ["notifications", "cops-routes"] });
    },
  });
  const resetRoute = useMutation({
    mutationFn: (eventType: string) => notificationsApi.resetCopsRoute(eventType, reason.trim()),
    onSuccess: async () => {
      setReason("");
      setDrafts({});
      await queryClient.invalidateQueries({ queryKey: ["notifications", "cops-routes"] });
    },
  });

  const overrides = new Map((routes.data?.data ?? []).map((route) => [route.eventType, route.roleKeys]));

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="space-y-1.5 p-6">
        <h2 className="text-base font-semibold">CustomerOps event routing</h2>
        <p className="text-sm text-muted-foreground">
          Choose which workspace roles receive each event. Changes are audited and require a reason.
          Lifecycle transitions may use dimension-specific recipients.
        </p>
      </div>
      <div className="space-y-4 p-6 pt-0">
        {routes.isError && (
          <Alert variant="error">{formatQueryError(routes.error, "Could not load CustomerOps event routes.")}</Alert>
        )}
        {saveRoute.isError && (
          <Alert variant="error">{formatQueryError(saveRoute.error, "Could not save this event route.")}</Alert>
        )}
        {resetRoute.isError && (
          <Alert variant="error">{formatQueryError(resetRoute.error, "Could not reset this event route.")}</Alert>
        )}
        {(saveRoute.isSuccess || resetRoute.isSuccess) && (
          <Alert variant="success">CustomerOps event route saved and audited.</Alert>
        )}
        {routes.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading event routes…</p>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="cops-route-reason" className="text-sm font-medium">
                Reason for route changes
              </label>
              <Input
                id="cops-route-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why these recipients are changing"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">Enter at least 8 characters. The reason is recorded in the audit log.</p>
            </div>

            <div className="divide-y rounded-md border">
              {COPS_NOTIFICATION_EVENT_ROUTES.map(({ eventType, label, defaultRoleKeys }) => {
                const roleKeys = drafts[eventType] ?? overrides.get(eventType) ?? [...defaultRoleKeys];
                const hasOverride = overrides.has(eventType);
                const isLifecycleEvent = eventType === "LifecycleTransitioned";
                return (
                  <details key={eventType} className="group px-3 py-2">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 py-1 text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">
                        {hasOverride ? "Workspace override" : "Default"}: {roleSummary(roleKeys)}
                      </span>
                    </summary>
                    {isLifecycleEvent && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        The event payload determines the default recipient roles by lifecycle dimension.
                      </p>
                    )}
                    <fieldset className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <legend className="sr-only">Recipients for {label}</legend>
                      {COPS_NOTIFICATION_ROLES.map((role) => (
                        <label key={role} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={roleKeys.includes(role)}
                            onChange={(event) => {
                              const selected = event.target.checked
                                ? [...roleKeys, role]
                                : roleKeys.filter((current) => current !== role);
                              setDrafts((current) => ({ ...current, [eventType]: selected }));
                            }}
                            aria-label={`Route ${eventType} to ${ROLE_LABELS[role]}`}
                          />
                          {ROLE_LABELS[role]}
                        </label>
                      ))}
                    </fieldset>
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      disabled={reason.trim().length < 8 || saveRoute.isPending || resetRoute.isPending || routes.isError}
                      onClick={() => saveRoute.mutate({ eventType, roleKeys })}
                    >
                      Save route
                    </Button>
                    {hasOverride && (
                      <Button
                        className="ml-2 mt-3"
                        variant="ghost"
                        size="sm"
                        disabled={reason.trim().length < 8 || saveRoute.isPending || resetRoute.isPending || routes.isError}
                        onClick={() => resetRoute.mutate(eventType)}
                      >
                        Reset to defaults
                      </Button>
                    )}
                  </details>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
