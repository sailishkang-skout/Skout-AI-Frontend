"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Play } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { STATE_LABELS, useCaptureQueueApi, type AutoCaptureStatus, type CaptureMode } from "@/lib/capture-queue";
import { continueCaptureQueueInExtension } from "@/lib/extension-connect";
import type { Notice } from "./capture-queue-parts";

/**
 * Pick the workspace's captured companies and start capturing their people: in the Skout
 * extension (manual) or on the server (automatic). A company with a job already running is
 * not started twice: the server and the extension both keep one job per company.
 */
export function CaptureCompanyPicker({
  mode,
  auto,
  blocked,
  onClose,
  onNotice,
}: {
  mode: CaptureMode;
  auto: AutoCaptureStatus | undefined;
  blocked: boolean;
  onClose: () => void;
  onNotice: (notice: Notice) => void;
}) {
  const api = useCaptureQueueApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const companies = useQuery({ queryKey: ["capture-queue", "companies"], queryFn: () => api.companies(), enabled: authReady });

  const all = useMemo(() => companies.data?.companies ?? [], [companies.data]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? all.filter((company) => company.name.toLowerCase().includes(term)) : all;
  }, [all, search]);
  const allVisibleSelected = visible.length > 0 && visible.every((company) => selected.has(company.companyPublicId));
  const picked = all.filter((company) => selected.has(company.companyPublicId));
  const automatic = mode === "unipile";
  const disabled = !picked.length || working || blocked || (automatic && !auto?.available);

  async function start() {
    setWorking(true);
    try {
      if (automatic) {
        const result = await api.startAuto(picked.map((company) => company.companyPublicId));
        onNotice({
          tone: result.skipped.length ? "warning" : "success",
          text: `${result.queued.length} ${result.queued.length === 1 ? "company is" : "companies are"} being read automatically on the server, up to 250 people per batch.${
            result.skipped.length ? ` Skipped: ${result.skipped.map((entry) => `${entry.companyPublicId} (${entry.reason})`).join("; ")}.` : ""
          }`,
        });
      } else {
        let started = 0;
        let queued = 0;
        const failed: string[] = [];
        // One at a time: the extension adds each company to its queue and reads them in turn.
        for (const company of picked) {
          try {
            await continueCaptureQueueInExtension(company.companyPublicId, company.name);
            started++;
          } catch (error) {
            const reason = error instanceof Error ? error.message : "";
            if (reason === "extension-unavailable" || reason === "extension-outdated") {
              await api.queueForExtension(company.companyPublicId, company.name);
              queued++;
            } else {
              failed.push(`${company.name} (${reason || "failed"})`);
            }
          }
        }
        onNotice({
          tone: failed.length || queued ? "warning" : "success",
          text: [
            started ? `${started} ${started === 1 ? "company was" : "companies were"} added to the Skout extension's queue.` : "",
            queued ? `${queued} ${queued === 1 ? "is" : "are"} waiting for the extension: open its side panel on LinkedIn and choose Start requested jobs.` : "",
            failed.length ? `Not added: ${failed.join(", ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["capture-queue"] });
      onClose();
    } catch (error) {
      onNotice({ tone: "error", text: formatQueryError(error, automatic ? "Automatic capture did not start." : "The companies could not be sent to the extension.") });
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={automatic ? "Automatic capture on the server" : "Capture with the Skout extension"}
      description={
        automatic
          ? "The server reads each company's people with the workspace's LinkedIn account, 250 per batch, with a short pause between batches."
          : "The extension reads each company's people in your browser, one company at a time, 250 per batch."
      }
    >
      <div className="space-y-3">
        {automatic && auto && !auto.available && <Alert variant="warning">{auto.reason}</Alert>}
        {blocked && <Alert variant="warning">Capture is turned off or the daily limit is reached, so nothing can start right now.</Alert>}
        <div className="flex flex-wrap items-center gap-3">
          <Input className="max-w-xs" placeholder="Search companies" aria-label="Search companies" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => {
                const next = new Set(selected);
                for (const company of visible) {
                  if (event.target.checked) next.add(company.companyPublicId);
                  else next.delete(company.companyPublicId);
                }
                setSelected(next);
              }}
            />
            Select all ({selected.size} selected)
          </label>
        </div>
        {companies.isError ? (
          <Alert variant="error" onRetry={() => companies.refetch()}>
            {formatQueryError(companies.error, "Could not load your companies.")}
          </Alert>
        ) : companies.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {all.length ? "No company matches that search." : "No captured companies yet. Capture a company with the Skout extension first."}
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-md border" aria-label="Captured companies">
            {visible.map((company) => {
              const saved = Math.max(company.peopleSaved, company.peopleFound);
              const running = company.status === "running" || company.status === "review";
              return (
                <li key={company.companyPublicId} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${company.name}`}
                    checked={selected.has(company.companyPublicId)}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(company.companyPublicId);
                      else next.delete(company.companyPublicId);
                      setSelected(next);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{company.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {saved.toLocaleString()}
                      {company.expectedPeople ? ` of about ${company.expectedPeople.toLocaleString()}` : ""} people saved
                      {company.status && company.status in STATE_LABELS ? ` · ${STATE_LABELS[company.status as keyof typeof STATE_LABELS]}` : ""}
                      {running ? " (already running; it will not start twice)" : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button disabled={disabled} onClick={() => void start()}>
            {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : automatic ? <Bot className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {automatic ? "Start automatic capture" : "Send to extension"}
            {picked.length ? ` (${picked.length})` : ""}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
