"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  Clock,
  Filter,
  Loader2,
  Plus,
  Search,
  Sparkles,
  User,
  X,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useContactsApi } from "@/lib/crm/contacts";
import { useDealsApi } from "@/lib/crm/deals";
import { useDexterPlatformApi } from "@/lib/dexter-platform";

interface DecisionOption {
  id: string;
  label: string;
  primary?: boolean;
}

interface DecisionView {
  id: string;
  workspaceId: string;
  title: string;
  kind: string;
  recommendation: string;
  options?: DecisionOption[];
  evidenceIds?: string[];
  expectedOutcome?: Record<string, unknown> | null;
  entityType?: "contact" | "deal" | null;
  entityId?: string | null;
  status: "open" | "decided" | "dismissed";
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

type TabFilter = "open" | "decided" | "dismissed" | "all";

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return isoString;
  }
}

/** §1.2 / D14 — Decision-oriented views grounded in Next Best Action (NBA). */
export default function DecisionsPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const contactsApi = useContactsApi();
  const dealsApi = useDealsApi();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabFilter>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [entityType, setEntityType] = useState<"contact" | "deal">("contact");
  const [selectedEntityId, setSelectedEntityId] = useState("");

  // Fetch decision views
  const list = useQuery({
    queryKey: ["decision-views"],
    queryFn: () => api.listDecisions(),
    enabled: authReady,
  });

  // Fetch contacts for generator picker
  const contacts = useQuery({
    queryKey: ["crm-contacts-for-decisions"],
    queryFn: () => contactsApi.list({ limit: 50 }),
    enabled: authReady && showGenerator && entityType === "contact",
  });

  // Fetch deals for generator picker
  const deals = useQuery({
    queryKey: ["crm-deals-for-decisions"],
    queryFn: () => dealsApi.list({ limit: 50 }),
    enabled: authReady && showGenerator && entityType === "deal",
  });

  // Create decision from NBA
  const create = useMutation({
    mutationFn: () => api.createDecisionFromNba(entityType, selectedEntityId),
    onSuccess: (res) => {
      toast.success("Decision generated from Next Best Action", "Decision Created");
      qc.invalidateQueries({ queryKey: ["decision-views"] });
      setSelectedEntityId("");
      setShowGenerator(false);
      setActiveTab("open");
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Failed to create decision from NBA"), "Generation Failed");
    },
  });

  // Decide or dismiss
  const decide = useMutation({
    mutationFn: ({ id, choice }: { id: string; choice: "decided" | "dismissed" }) =>
      api.decide(id, choice),
    onSuccess: (_, vars) => {
      toast.info(
        vars.choice === "decided" ? "Decision marked as executed" : "Decision dismissed",
        vars.choice === "decided" ? "Decided" : "Dismissed"
      );
      qc.invalidateQueries({ queryKey: ["decision-views"] });
    },
    onError: (err) => {
      toast.error(formatQueryError(err, "Failed to update decision"), "Action Failed");
    },
  });

  const rawDecisions = (list.data?.data ?? []) as unknown as DecisionView[];

  // Counts for tabs & KPI cockpit
  const counts = useMemo(() => {
    let open = 0;
    let decided = 0;
    let dismissed = 0;
    for (const d of rawDecisions) {
      if (d.status === "open") open++;
      else if (d.status === "decided") decided++;
      else if (d.status === "dismissed") dismissed++;
    }
    return {
      total: rawDecisions.length,
      open,
      decided,
      dismissed,
    };
  }, [rawDecisions]);

  // Filtered decisions based on tab and search
  const filteredDecisions = useMemo(() => {
    return rawDecisions.filter((d) => {
      if (activeTab !== "all" && d.status !== activeTab) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.title?.toLowerCase().includes(q) ||
        d.recommendation?.toLowerCase().includes(q) ||
        d.entityId?.toLowerCase().includes(q) ||
        d.kind?.toLowerCase().includes(q)
      );
    });
  }, [rawDecisions, activeTab, searchQuery]);

  return (
    <PageShell width="wide">
      <PageHeader
        title="Decision queue"
        description="Actionable human-in-the-loop recommendations with options and evidence — grounded in Next Best Action and Policy Gateway."
        actions={
          <Button
            onClick={() => setShowGenerator(!showGenerator)}
            className="gap-1.5 shadow-sm"
          >
            {showGenerator ? (
              <>
                <X className="h-4 w-4" />
                Close Generator
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" />
                Generate from NBA
              </>
            )}
          </Button>
        }
      />

      {/* KPI Cockpit Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Decisions</span>
              <Filter className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {counts.total}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs bg-amber-500/[0.03] border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Pending Review
              </span>
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {counts.open}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs bg-emerald-500/[0.03] border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Decided / Executed
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {counts.decided}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Dismissed</span>
              <XCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {counts.dismissed}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive NBA Decision Generator Drawer */}
      {showGenerator && (
        <Card className="border-primary/40 shadow-md bg-card/95 transition-all">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Generate Decision from Next Best Action (NBA)</CardTitle>
                  <CardDescription className="text-xs">
                    Select a CRM contact or deal to evaluate AI next-best action and materialize a human decision view.
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowGenerator(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {create.isError && (
              <Alert variant="error">
                {formatQueryError(create.error, "Could not generate decision from NBA.")}
              </Alert>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Entity Type Selector */}
              <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => {
                    setEntityType("contact");
                    setSelectedEntityId("");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    entityType === "contact"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Contact
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntityType("deal");
                    setSelectedEntityId("");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    entityType === "deal"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Deal
                </button>
              </div>

              {/* Entity Picker Dropdown */}
              <div className="flex-1">
                {entityType === "contact" ? (
                  <Select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="w-full text-xs"
                    disabled={contacts.isLoading}
                  >
                    <option value="">
                      {contacts.isLoading ? "Loading contacts from CRM…" : "— Choose Contact —"}
                    </option>
                    {(contacts.data?.data ?? []).map((c) => {
                      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed";
                      const detail = [c.title, c.email].filter(Boolean).join(" · ");
                      return (
                        <option key={c.id} value={c.id}>
                          {name} {detail ? `(${detail})` : ""}
                        </option>
                      );
                    })}
                  </Select>
                ) : (
                  <Select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="w-full text-xs"
                    disabled={deals.isLoading}
                  >
                    <option value="">
                      {deals.isLoading ? "Loading deals from CRM…" : "— Choose Deal —"}
                    </option>
                    {(deals.data?.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.amount ? `($${Number(d.amount).toLocaleString()})` : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {/* Action Button */}
              <Button
                disabled={!selectedEntityId || create.isPending}
                onClick={() => create.mutate()}
                className="gap-1.5 whitespace-nowrap bg-primary text-primary-foreground"
              >
                {create.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate Decision
              </Button>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Pro-tip:</span>
              Next Best Action scans engagement signals, sequence replies, and CRM activity to calculate optimal recommendations.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Query Error State */}
      {list.isError && (
        <Alert variant="error">
          {formatQueryError(list.error, "Could not load decision queue.")}
        </Alert>
      )}

      {/* Tabs & Search Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-border/70 pb-px sm:border-0 sm:pb-0">
          {(
            [
              { key: "open", label: "Open", count: counts.open },
              { key: "decided", label: "Decided", count: counts.decided },
              { key: "dismissed", label: "Dismissed", count: counts.dismissed },
              { key: "all", label: "All Decisions", count: counts.total },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search decisions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs rounded-lg"
          />
        </div>
      </div>

      {/* Decisions Feed */}
      <div className="space-y-3">
        {list.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredDecisions.length > 0 ? (
          filteredDecisions.map((d) => {
            const id = String(d.id ?? "");
            const isOpen = d.status === "open";
            const isDecided = d.status === "decided";

            return (
              <Card
                key={id}
                className={`transition-all border-border/80 shadow-xs hover:border-primary/40 hover:shadow-sm ${
                  isOpen ? "bg-card" : "bg-card/60 opacity-90"
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: Details */}
                    <div className="space-y-2 min-w-0 flex-1">
                      {/* Meta Tags */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            isOpen ? "warning" : isDecided ? "success" : "muted"
                          }
                          className="capitalize text-[10px] font-medium"
                        >
                          {d.status}
                        </Badge>

                        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/40">
                          {d.kind || "decision"}
                        </span>

                        {d.entityType && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/40">
                            {d.entityType === "contact" ? (
                              <User className="h-3 w-3" />
                            ) : (
                              <Briefcase className="h-3 w-3" />
                            )}
                            <span className="capitalize">{d.entityType}</span>
                            {d.entityId && (
                              <span className="font-mono text-[10px] text-muted-foreground/80">
                                #{d.entityId.slice(0, 8)}
                              </span>
                            )}
                          </span>
                        )}

                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(d.createdAt)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-foreground tracking-tight">
                        {d.title || "Decision item"}
                      </h3>

                      {/* Recommendation Prose */}
                      <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {d.recommendation || "Review and take action."}
                      </p>

                      {/* Configured Options */}
                      {Array.isArray(d.options) && d.options.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] font-medium text-muted-foreground">Options:</span>
                          {d.options.map((opt) => (
                            <span
                              key={opt.id}
                              className={`rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                                opt.primary
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-muted text-muted-foreground border-border/40"
                              }`}
                            >
                              {opt.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-start sm:pt-1">
                      {isOpen ? (
                        <>
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ id, choice: "decided" })}
                          >
                            <CheckSquare className="h-3.5 w-3.5" />
                            Decide
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ id, choice: "dismissed" })}
                          >
                            <X className="h-3.5 w-3.5" />
                            Dismiss
                          </Button>
                        </>
                      ) : (
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground">
                            {isDecided ? "Decided" : "Dismissed"}{" "}
                            {formatRelativeTime(d.decidedAt || d.updatedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          /* Sleek Empty State */
          <Card className="border-dashed border-border/80 bg-muted/10">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
                <CheckSquare className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                No {activeTab !== "all" ? activeTab : ""} decisions found
              </h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {activeTab === "open"
                  ? "All human sign-offs and Next Best Action decisions have been completed. Generate a new decision from a CRM contact or deal."
                  : "No decisions match the current filter or search criteria."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5 text-xs"
                onClick={() => setShowGenerator(true)}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Generate from NBA
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
