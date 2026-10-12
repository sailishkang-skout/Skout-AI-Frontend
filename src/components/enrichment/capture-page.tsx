"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { useWorkspaceRole } from "@/lib/workspace-role";

interface CaptureStatus {
  enabled: boolean;
  disabledReason: string | null;
  caps: { maxPagesPerRun: number; maxLeadsPerRun: number; dailyLeadLimit: number };
  usage: { leadsToday: number; remainingToday: number };
}

export interface CaptureRun {
  id: string;
  kind: "person" | "company" | "sales_search";
  status: "running" | "completed" | "stopped" | "failed" | "halted" | "rejected";
  terminal: boolean;
  sourceUrl: string | null;
  pagesRead: number;
  leadsReceived: number;
  leadsCreated: number;
  leadsMerged: number;
  leadsRejected: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

/** Sales Navigator's "Function" filter values, in the order the guided flow walks them. */
export const SALES_NAVIGATOR_FUNCTIONS = [
  "Sales",
  "Marketing",
  "Business Development",
  "Engineering",
  "Information Technology",
  "Product Management",
  "Operations",
  "Finance",
  "Human Resources",
  "Customer Success and Support",
  "Consulting",
  "Program and Project Management",
  "Purchasing",
  "Legal",
  "Research",
  "Quality Assurance",
  "Accounting",
  "Administrative",
  "Media and Communication",
  "Arts and Design",
  "Education",
  "Healthcare Services",
  "Real Estate",
  "Entrepreneurship",
  "Community and Social Services",
  "Military and Protective Services",
] as const;

const SALES_NAVIGATOR_SEARCH_URL = "https://www.linkedin.com/sales/search/people";

const RUN_KIND_LABELS: Record<CaptureRun["kind"], string> = {
  person: "Profile",
  company: "Company",
  sales_search: "Sales Navigator search",
};

const RUN_STATUS: Record<CaptureRun["status"], { label: string; tone: "success" | "warning" | "danger" | "info" | "muted" }> = {
  running: { label: "Running", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  stopped: { label: "Stopped", tone: "muted" },
  failed: { label: "Failed", tone: "danger" },
  halted: { label: "Halted by kill switch", tone: "danger" },
  rejected: { label: "Rejected", tone: "warning" },
};

type DepartmentState = Record<string, "done" | "skipped">;

function progressStorageKey(company: string) {
  return `skout.capture.departments:${company.trim().toLowerCase()}`;
}

function loadDepartmentState(company: string): DepartmentState {
  if (!company.trim()) return {};
  try {
    const stored = window.localStorage.getItem(progressStorageKey(company));
    return stored ? (JSON.parse(stored) as DepartmentState) : {};
  } catch {
    return {};
  }
}

export function CapturePage() {
  const apiFetch = useApiFetch();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const isAdmin = hasPermission("enrichment:admin");

  const statusQuery = useQuery({
    queryKey: ["enrichment-capture", "status"],
    queryFn: () => apiFetch<CaptureStatus>("/api/v1/enrichment/capture/status"),
    enabled: authReady,
  });
  const runsQuery = useQuery({
    queryKey: ["enrichment-capture", "runs"],
    queryFn: () => apiFetch<{ runs: CaptureRun[] }>("/api/v1/enrichment/capture/runs"),
    enabled: authReady,
    // A run started from the extension shows up here without a manual reload.
    refetchInterval: 15_000,
  });
  const companiesQuery = useQuery({
    queryKey: ["enrichment-area", "companies"],
    queryFn: () => apiFetch<{ companies?: Array<{ id: string; name: string }> }>("/api/v1/enrichment/companies"),
    enabled: authReady,
  });

  const [company, setCompany] = useState("");
  const [departments, setDepartments] = useState<DepartmentState>({});
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disableReason, setDisableReason] = useState("");

  useEffect(() => {
    setDepartments(loadDepartmentState(company));
  }, [company]);

  const setDepartment = (department: string, value: "done" | "skipped" | null) => {
    setDepartments((previous) => {
      const next = { ...previous };
      if (value) next[department] = value;
      else delete next[department];
      try {
        window.localStorage.setItem(progressStorageKey(company), JSON.stringify(next));
      } catch {
        // Progress is a convenience; the guided flow still works without storage.
      }
      return next;
    });
  };

  const updateSettings = useMutation({
    mutationFn: (body: { enabled: boolean; reason?: string }) =>
      apiFetch<CaptureStatus>("/api/v1/enrichment/capture/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      setConfirmDisable(false);
      setDisableReason("");
      await queryClient.invalidateQueries({ queryKey: ["enrichment-capture"] });
    },
  });

  const status = statusQuery.data;
  const forbidden = statusQuery.error instanceof ApiError && statusQuery.error.status === 403;
  const runs = runsQuery.data?.runs ?? [];
  const companyNames = useMemo(
    () => Array.from(new Set((companiesQuery.data?.companies ?? []).map((item) => item.name).filter(Boolean))).sort(),
    [companiesQuery.data]
  );
  const currentDepartment = SALES_NAVIGATOR_FUNCTIONS.find((department) => !departments[department]);
  const doneCount = SALES_NAVIGATOR_FUNCTIONS.filter((department) => departments[department] === "done").length;
  const capText = status
    ? `${status.caps.maxPagesPerRun} pages or ${status.caps.maxLeadsPerRun} leads`
    : "10 pages or 250 leads";
  const captureBlocked = status ? !status.enabled || status.usage.remainingToday <= 0 : true;

  return (
    <PageShell>
      <PageHeader
        title="Capture"
        description="Capture LinkedIn profiles, companies and Sales Navigator results with the Skout extension, reviewed before anything is saved."
      />

      <Alert variant="warning" title="Workload limits, not a safety guarantee">
        LinkedIn prohibits scraping or automating activity with browser extensions, and there is no page count that
        makes capture safe for an account. Each run reads at most {capText}. Choose narrow filters yourself, review
        only the results you need, and stop if LinkedIn warns or restricts your account.
      </Alert>

      {statusQuery.isError && (
        <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => statusQuery.refetch()}>
          {forbidden
            ? "You don't have permission to capture into this workspace. Ask a workspace admin to grant access."
            : formatQueryError(statusQuery.error, "Could not load capture status.")}
        </Alert>
      )}
      {updateSettings.isError && (
        <Alert variant="error" dismissible>
          {formatQueryError(updateSettings.error, "Could not change the capture setting.")}
        </Alert>
      )}

      {statusQuery.isLoading ? (
        <Skeleton className="h-28 w-full rounded-lg" />
      ) : status ? (
        <Card>
          <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Capture status</h2>
                <Badge tone={status.enabled ? "success" : "danger"}>{status.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
              {!status.enabled && (
                <p className="text-sm text-red-700 dark:text-red-300">
                  Capture is disabled for this workspace{status.disabledReason ? `: ${status.disabledReason}` : "."} The
                  extension cannot start or save a capture until an admin re-enables it.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Per run: at most <strong>{status.caps.maxPagesPerRun} pages</strong> and{" "}
                <strong>{status.caps.maxLeadsPerRun} leads</strong>. Your daily limit:{" "}
                <strong>
                  {status.usage.remainingToday} of {status.caps.dailyLeadLimit}
                </strong>{" "}
                leads left today.
              </p>
            </div>
            {isAdmin &&
              (status.enabled ? (
                <Button variant="destructive" onClick={() => setConfirmDisable(true)}>
                  Disable capture now
                </Button>
              ) : (
                <Button disabled={updateSettings.isPending} onClick={() => updateSettings.mutate({ enabled: true })}>
                  {updateSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Re-enable capture
                </Button>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {status && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="font-semibold">Find people department by department in Sales Navigator</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Work through one department at a time. You set the filters and run each search yourself; the extension
                only reads the results LinkedIn shows you. Repeated captures merge by LinkedIn identity, so a person
                who appears in two searches is saved once.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Company</span>
                <Input
                  list="capture-company-names"
                  placeholder="Company name, as it appears on LinkedIn"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
                <datalist id="capture-company-names">
                  {companyNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Jump to a department</span>
                <Select
                  aria-label="Jump to a department"
                  value={currentDepartment ?? ""}
                  disabled={!company.trim()}
                  onChange={(event) => {
                    // Everything before the chosen department is skipped; it and the rest are open.
                    const index = SALES_NAVIGATOR_FUNCTIONS.indexOf(event.target.value as (typeof SALES_NAVIGATOR_FUNCTIONS)[number]);
                    SALES_NAVIGATOR_FUNCTIONS.forEach((department, position) => {
                      if (position < index && !departments[department]) setDepartment(department, "skipped");
                      if (position >= index && departments[department] === "skipped") setDepartment(department, null);
                    });
                    if (departments[event.target.value]) setDepartment(event.target.value, null);
                  }}
                >
                  {!currentDepartment && <option value="">All departments covered</option>}
                  {SALES_NAVIGATOR_FUNCTIONS.map((department) => (
                    <option key={department} value={department}>
                      {department}
                      {departments[department] === "done" ? " (captured)" : departments[department] === "skipped" ? " (skipped)" : ""}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            {!company.trim() ? (
              <p className="text-sm text-muted-foreground">Enter the company to start the guided flow.</p>
            ) : currentDepartment ? (
              <div className="space-y-3 rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    Department {SALES_NAVIGATOR_FUNCTIONS.indexOf(currentDepartment) + 1} of {SALES_NAVIGATOR_FUNCTIONS.length}:{" "}
                    {currentDepartment}
                  </p>
                  <Badge tone="muted">{doneCount} captured</Badge>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  <li>
                    <a
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                      href={SALES_NAVIGATOR_SEARCH_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Sales Navigator people search <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                  <li>
                    Set <strong>Current company</strong> to <strong>{company.trim()}</strong> and <strong>Function</strong> to{" "}
                    <strong>{currentDepartment}</strong>, then run the search yourself.
                  </li>
                  <li>
                    Open the Skout extension side panel and click <strong>Capture Sales Navigator results</strong>.
                  </li>
                  <li>Review the leads in the side panel, untick any you do not need, and save.</li>
                  <li>When the run below shows Completed, mark this department captured.</li>
                </ol>
                <p className="text-sm text-muted-foreground">
                  Each run reads at most <strong>{capText}</strong>. If this department has more results, narrow the
                  filters (seniority, geography) and capture it in parts. A Sales Navigator card is a candidate until
                  the person&apos;s public profile confirms their employer.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={captureBlocked} onClick={() => setDepartment(currentDepartment, "done")}>
                    Mark captured, next department
                  </Button>
                  <Button variant="outline" onClick={() => setDepartment(currentDepartment, "skipped")}>
                    Skip this department
                  </Button>
                </div>
                {captureBlocked && (
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {status.enabled
                      ? `You have reached today's limit of ${status.caps.dailyLeadLimit} leads.`
                      : "Capture is disabled, so new runs cannot be saved."}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-4">
                <p className="text-sm">
                  Every department is covered for {company.trim()}: {doneCount} captured,{" "}
                  {SALES_NAVIGATOR_FUNCTIONS.length - doneCount} skipped.
                </p>
                <Button
                  variant="outline"
                  onClick={() => SALES_NAVIGATOR_FUNCTIONS.forEach((department) => setDepartment(department, null))}
                >
                  Start over
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!forbidden && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">Recent capture runs</h2>
            {runsQuery.isError ? (
              <Alert variant="error" onRetry={() => runsQuery.refetch()}>
                {formatQueryError(runsQuery.error, "Could not load capture runs.")}
              </Alert>
            ) : runsQuery.isLoading ? (
              <Skeleton className="h-16 w-full rounded-lg" />
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No captures yet. A run appears here once the extension saves a reviewed capture.
              </p>
            ) : (
              <ul className="divide-y">
                {runs.map((run) => {
                  const state = RUN_STATUS[run.status];
                  return (
                    <li key={run.id} className="space-y-1 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{RUN_KIND_LABELS[run.kind]}</span>
                        <Badge tone={state.tone}>{state.label}</Badge>
                        <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground">
                        {run.pagesRead} pages · {run.leadsReceived} leads received · {run.leadsCreated} new ·{" "}
                        {run.leadsMerged} merged · {run.leadsRejected} rejected
                      </p>
                      {run.errorMessage && run.status !== "completed" && (
                        <p className="text-red-700 dark:text-red-300">{run.errorMessage}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        title="Disable capture for this workspace?"
        description="Every member's next capture request is refused immediately, including a run that is in progress. Captured data is kept. The change is recorded in the audit log."
      >
        <div className="space-y-3">
          <Input
            aria-label="Reason"
            placeholder="Reason shown to members (optional)"
            value={disableReason}
            maxLength={500}
            onChange={(event) => setDisableReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDisable(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={updateSettings.isPending}
              onClick={() => updateSettings.mutate({ enabled: false, reason: disableReason.trim() || undefined })}
            >
              {updateSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Disable capture
            </Button>
          </div>
        </div>
      </Dialog>
    </PageShell>
  );
}
