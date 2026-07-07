"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Globe,
  Inbox,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Unplug,
  Wifi,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady, ApiError } from "@/lib/api-client";
import { useInboxApi } from "@/lib/inbox";
import { cn } from "@/lib/utils";
import type {
  ConnectInboxInput,
  DeliverabilityMetrics,
  Domain,
  DnsRecord,
  DnsStatus,
  Inbox as InboxType,
  InboxProvider,
  InboxStatus,
} from "@/types/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusTone(s: InboxStatus) {
  if (s === "active") return "success";
  if (s === "warming") return "warning";
  if (s === "paused") return "muted";
  if (s === "error") return "danger";
  return "muted";
}

function bounceRate(inbox: InboxType) {
  if (inbox.sentCount < 1) return null;
  return (inbox.bounceCount / inbox.sentCount) * 100;
}

function spamRate(inbox: InboxType) {
  if (inbox.sentCount < 1) return null;
  return (inbox.spamCount / inbox.sentCount) * 100;
}

function dnsIcon(s: DnsStatus) {
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-rose-500" />;
  if (s === "missing") return <AlertCircle className="h-4 w-4 text-amber-500" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function dnsBadge(s: DnsStatus) {
  if (s === "pass") return <Badge tone="success">Pass</Badge>;
  if (s === "fail") return <Badge tone="danger">Fail</Badge>;
  if (s === "missing") return <Badge tone="warning">Missing</Badge>;
  return <Badge tone="muted">Unknown</Badge>;
}

function domainHealth(d: Domain) {
  const statuses = [d.spfStatus, d.dkimStatus, d.dmarcStatus, d.mxStatus];
  if (statuses.every((s) => s === "pass")) return "success";
  if (statuses.some((s) => s === "fail")) return "danger";
  if (statuses.some((s) => s === "missing")) return "warning";
  return "muted";
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  return { copy, copied };
}

// ── SVG Charts ────────────────────────────────────────────────────────────────

function WarmupChart({ data }: { data: DeliverabilityMetrics["warmup"] }) {
  const W = 600; const H = 160; const PAD = { t: 16, r: 16, b: 32, l: 48 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const maxY = Math.max(...data.flatMap((d) => [d.sent, d.target]), 1);
  const xScale = (i: number) => PAD.l + (i / (data.length - 1 || 1)) * iW;
  const yScale = (v: number) => PAD.t + iH - (v / maxY) * iH;

  const linePath = (key: "sent" | "target") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(d[key])}`).join(" ");

  const labels = data.filter((_, i) => i % Math.ceil(data.length / 6) === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Warmup chart">
      {/* Y-axis guides */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD.t + iH * (1 - f);
        return (
          <g key={f}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.4}>
              {Math.round(maxY * f)}
            </text>
          </g>
        );
      })}
      {/* Target line */}
      <path d={linePath("target")} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" />
      {/* Sent area */}
      <path
        d={`${linePath("sent")} L${xScale(data.length - 1)},${PAD.t + iH} L${xScale(0)},${PAD.t + iH}Z`}
        fill="#10b981" fillOpacity={0.12}
      />
      <path d={linePath("sent")} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
      {/* X labels */}
      {labels.map((d, i) => (
        <text key={i} x={xScale(data.indexOf(d))} y={H - 6} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.4}>
          {new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </text>
      ))}
      {/* Legend */}
      <circle cx={PAD.l} cy={12} r={4} fill="#10b981" />
      <text x={PAD.l + 8} y={16} fontSize={10} fill="currentColor" opacity={0.6}>Sent</text>
      <line x1={PAD.l + 40} y1={12} x2={PAD.l + 55} y2={12} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={PAD.l + 58} y={16} fontSize={10} fill="currentColor" opacity={0.6}>Target</text>
    </svg>
  );
}

function BounceSpamChart({ data }: { data: DeliverabilityMetrics["bounce"] }) {
  const W = 600; const H = 160; const PAD = { t: 16, r: 16, b: 32, l: 48 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const n = data.length || 1;
  const barW = (iW / n) * 0.35;
  const maxY = Math.max(...data.flatMap((d) => [d.bounceRate, d.spamRate]), 5);
  const xc = (i: number) => PAD.l + (i + 0.5) * (iW / n);
  const yScale = (v: number) => (v / maxY) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Bounce and spam chart">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD.t + iH * (1 - f);
        return (
          <g key={f}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.4}>
              {(maxY * f).toFixed(1)}%
            </text>
          </g>
        );
      })}
      {data.map((d, i) => (
        <g key={i}>
          <rect
            x={xc(i) - barW - 1}
            y={PAD.t + iH - yScale(d.bounceRate)}
            width={barW}
            height={yScale(d.bounceRate)}
            fill="#f59e0b" fillOpacity={0.8} rx={2}
          />
          <rect
            x={xc(i) + 1}
            y={PAD.t + iH - yScale(d.spamRate)}
            width={barW}
            height={yScale(d.spamRate)}
            fill="#ef4444" fillOpacity={0.8} rx={2}
          />
          {i % Math.ceil(n / 6) === 0 && (
            <text x={xc(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.4}>
              {new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          )}
        </g>
      ))}
      <rect x={PAD.l} y={8} width={10} height={10} fill="#f59e0b" fillOpacity={0.8} rx={2} />
      <text x={PAD.l + 14} y={17} fontSize={10} fill="currentColor" opacity={0.6}>Bounce rate</text>
      <rect x={PAD.l + 80} y={8} width={10} height={10} fill="#ef4444" fillOpacity={0.8} rx={2} />
      <text x={PAD.l + 94} y={17} fontSize={10} fill="currentColor" opacity={0.6}>Spam rate</text>
    </svg>
  );
}

// ── Connect Inbox Form ────────────────────────────────────────────────────────

function ConnectInboxForm({ onSuccess }: { onSuccess: () => void }) {
  const api = useInboxApi();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ConnectInboxInput>({
    emailAddress: "",
    provider: "smtp",
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    imapHost: "",
    imapPort: 993,
  });
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ConnectInboxInput>(k: K, v: ConnectInboxInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const connect = useMutation({
    mutationFn: () => api.connectInbox(form),
    onSuccess: () => { setOpen(false); setError(null); onSuccess(); },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setError("This inbox is already connected to your workspace.");
      } else {
        setError("Could not connect inbox. Check your credentials and try again.");
      }
    },
  });

  const canSubmit = form.emailAddress.includes("@") &&
    (form.provider !== "smtp" || (!!form.smtpHost && !!form.smtpUsername && !!form.smtpPassword));

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Connect inbox
      </Button>
    );
  }

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Connect a new inbox</CardTitle>
        <CardDescription>Add an email account to send from. SMTP credentials are stored encrypted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email address</label>
            <Input
              type="email"
              placeholder="outreach@yourdomain.com"
              value={form.emailAddress}
              onChange={(e) => set("emailAddress", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.provider}
              onChange={(e) => set("provider", e.target.value as InboxProvider)}
            >
              <option value="google">Gmail / Google Workspace</option>
              <option value="microsoft">Outlook / Microsoft 365</option>
              <option value="smtp">Custom SMTP</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">SMTP host</label>
            <Input
              placeholder={form.provider === "google" ? "smtp.gmail.com" : form.provider === "microsoft" ? "smtp.office365.com" : "mail.yourdomain.com"}
              value={form.smtpHost}
              onChange={(e) => set("smtpHost", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">SMTP port</label>
            <Input
              type="number"
              value={form.smtpPort}
              onChange={(e) => set("smtpPort", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">SMTP username</label>
            <Input
              placeholder="Usually your email address"
              value={form.smtpUsername}
              onChange={(e) => set("smtpUsername", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">SMTP password / app password</label>
            <Input
              type="password"
              placeholder="App password recommended"
              value={form.smtpPassword}
              onChange={(e) => set("smtpPassword", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">IMAP host</label>
            <Input
              placeholder={form.provider === "google" ? "imap.gmail.com" : "imap.yourdomain.com"}
              value={form.imapHost}
              onChange={(e) => set("imapHost", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">IMAP port</label>
            <Input
              type="number"
              value={form.imapPort}
              onChange={(e) => set("imapPort", Number(e.target.value))}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          For Gmail, enable 2FA and use an{" "}
          <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="underline">
            app password
          </a>. For Outlook, use an{" "}
          <a href="https://support.microsoft.com/en-us/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944" target="_blank" rel="noopener noreferrer" className="underline">
            app password
          </a>.
        </p>

        <div className="flex gap-2">
          <Button onClick={() => connect.mutate()} disabled={!canSubmit || connect.isPending} className="gap-1.5">
            {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {connect.isPending ? "Connecting…" : "Connect"}
          </Button>
          <Button variant="outline" onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Inbox Health Card ─────────────────────────────────────────────────────────

function InboxCard({
  inbox,
  onPause,
  onResume,
  onDisconnect,
  isPausing,
  isResuming,
}: {
  inbox: InboxType;
  onPause: () => void;
  onResume: () => void;
  onDisconnect: () => void;
  isPausing: boolean;
  isResuming: boolean;
}) {
  const sentToday = Number(inbox.sentToday ?? 0);
  const sentPct = inbox.dailySendLimit > 0 ? Math.min(100, Math.round((sentToday / inbox.dailySendLimit) * 100)) : 0;
  const br = bounceRate(inbox);
  const sr = spamRate(inbox);
  const isPaused = inbox.status === "paused";

  return (
    <Card className={cn(isPaused && "opacity-75")}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{inbox.emailAddress}</p>
              <p className="text-xs capitalize text-muted-foreground">{inbox.provider}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge tone={statusTone(inbox.status)} className="capitalize">{inbox.status}</Badge>
            {isPaused ? (
              <button
                type="button"
                onClick={onResume}
                disabled={isResuming}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40"
                title="Resume inbox"
              >
                {isResuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={onPause}
                disabled={isPausing}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"
                title="Pause inbox"
              >
                {isPausing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Disconnect"
            >
              <Unplug className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-muted/50 px-2 py-2.5">
            <p className="text-lg font-bold tabular-nums">{sentToday}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sent today</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2.5">
            <p className="text-lg font-bold tabular-nums">{inbox.dailySendLimit}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Daily limit</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2.5">
            <p className="text-lg font-bold tabular-nums capitalize">{inbox.warmupStatus}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Warmup</p>
          </div>
        </div>

        {/* Bounce / spam rates */}
        {inbox.sentCount >= 1 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className={cn(
              "rounded-lg border px-3 py-2 text-center",
              br != null && br >= 5 ? "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
              : br != null && br >= 2 ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
              : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
            )}>
              <p className={cn("text-sm font-bold tabular-nums",
                br != null && br >= 5 ? "text-rose-700 dark:text-rose-400"
                : br != null && br >= 2 ? "text-amber-700 dark:text-amber-400"
                : "text-emerald-700 dark:text-emerald-400"
              )}>
                {br != null ? `${br.toFixed(2)}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Bounce rate</p>
            </div>
            <div className={cn(
              "rounded-lg border px-3 py-2 text-center",
              sr != null && sr >= 1 ? "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
              : sr != null && sr >= 0.3 ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
              : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
            )}>
              <p className={cn("text-sm font-bold tabular-nums",
                sr != null && sr >= 1 ? "text-rose-700 dark:text-rose-400"
                : sr != null && sr >= 0.3 ? "text-amber-700 dark:text-amber-400"
                : "text-emerald-700 dark:text-emerald-400"
              )}>
                {sr != null ? `${sr.toFixed(3)}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Spam rate</p>
            </div>
          </div>
        )}

        {/* Daily send progress */}
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Daily send — {sentToday}/{inbox.dailySendLimit}</span>
            <span>{sentPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", sentPct >= 90 ? "bg-amber-500" : "bg-blue-500")}
              style={{ width: `${sentPct}%` }}
            />
          </div>
        </div>

        {inbox.lastUsedAt && (
          <p className="mt-3 text-[10px] text-muted-foreground">
            Last used {new Date(inbox.lastUsedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── DNS Checklist ─────────────────────────────────────────────────────────────

function DnsChecklist({ domainId, domain }: { domainId: string; domain: string }) {
  const [open, setOpen] = useState(false);
  const api = useInboxApi();
  const { copy, copied } = useCopy();

  const dns = useQuery({
    queryKey: ["domains", domainId, "dns"],
    queryFn: () => api.getDomainDns(domainId),
    enabled: open,
    staleTime: 60_000,
  });

  const purposeLabel: Record<string, string> = {
    SPF: "SPF — sender policy",
    DKIM: "DKIM — signing key",
    DMARC: "DMARC — policy",
    MX: "MX — mail exchange",
  };

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          DNS records for {domain}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {dns.isLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          )}
          {dns.error && <Alert variant="warning">Could not load DNS records.</Alert>}
          {dns.data?.records.map((rec: DnsRecord) => (
            <div key={rec.purpose} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {dnsIcon(rec.status)}
                  <span className="text-xs font-semibold">{purposeLabel[rec.purpose] ?? rec.purpose}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{rec.type}</span>
                </div>
                {dnsBadge(rec.status)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</span>
                  <div className="flex items-center gap-1.5">
                    <code className="max-w-xs truncate text-xs">{rec.name}</code>
                    <button
                      type="button"
                      onClick={() => copy(rec.name, `${rec.purpose}-name`)}
                      className="rounded p-1 hover:bg-muted"
                      title="Copy"
                    >
                      {copied === `${rec.purpose}-name` ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">Value</span>
                  <div className="flex items-start gap-1.5 min-w-0">
                    <code className="break-all text-xs text-right">{rec.value}</code>
                    <button
                      type="button"
                      onClick={() => copy(rec.value, `${rec.purpose}-value`)}
                      className="shrink-0 rounded p-1 hover:bg-muted"
                      title="Copy"
                    >
                      {copied === `${rec.purpose}-value` ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Domain Card ───────────────────────────────────────────────────────────────

function DomainCard({ domain, onRemove }: { domain: Domain; onRemove: () => void }) {
  const checks = [
    { label: "SPF", status: domain.spfStatus },
    { label: "DKIM", status: domain.dkimStatus },
    { label: "DMARC", status: domain.dmarcStatus },
    { label: "MX", status: domain.mxStatus },
  ];
  const health = domainHealth(domain);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{domain.domain}</p>
            <p className="text-xs text-muted-foreground">
              {domain.verifiedAt ? `Verified ${new Date(domain.verifiedAt).toLocaleDateString()}` : "Pending verification"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={health === "success" ? "success" : health === "danger" ? "danger" : health === "warning" ? "warning" : "muted"}>
            {health === "success" ? "Healthy" : health === "danger" ? "Issues" : health === "warning" ? "Incomplete" : "Unknown"}
          </Badge>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Remove domain"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-5 pb-4">
        {checks.map(({ label, status }) => (
          <div key={label} className="flex items-center gap-1">
            {dnsIcon(status)}
            <span className="text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>

      <DnsChecklist domainId={domain.id} domain={domain.domain} />
    </Card>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "inboxes" | "domains" | "analytics";

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "inboxes", label: "Inboxes", icon: Inbox },
  { id: "domains", label: "Domains", icon: Globe },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeliverabilityPage() {
  const authReady = useAuthReady();
  const api = useInboxApi();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("inboxes");
  const [newDomain, setNewDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);

  const inboxes = useQuery({
    queryKey: ["inboxes"],
    queryFn: api.listInboxes,
    enabled: authReady,
  });

  const domains = useQuery({
    queryKey: ["domains"],
    queryFn: api.listDomains,
    enabled: authReady,
    staleTime: 30_000,
  });

  const metrics = useQuery({
    queryKey: ["deliverability", "metrics"],
    queryFn: api.getMetrics,
    enabled: authReady && tab === "analytics",
    staleTime: 60_000,
  });

  const disconnectInbox = useMutation({
    mutationFn: (id: string) => api.disconnectInbox(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inboxes"] }),
  });

  const pauseInbox = useMutation({
    mutationFn: (id: string) => api.pauseInbox(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inboxes"] }),
  });

  const resumeInbox = useMutation({
    mutationFn: (id: string) => api.resumeInbox(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inboxes"] }),
  });

  const addDomain = useMutation({
    mutationFn: () => api.addDomain(newDomain.trim()),
    onSuccess: () => {
      setNewDomain("");
      setDomainError(null);
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: () => setDomainError("Could not add domain. Check the format and try again."),
  });

  const removeDomain = useMutation({
    mutationFn: (id: string) => api.removeDomain(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["domains"] }),
  });

  const inboxList = inboxes.data?.data ?? [];
  const domainList = domains.data?.data ?? [];
  const m = metrics.data;

  return (
    <PageShell>
      <PageHeader
        title="Deliverability"
        description="Monitor inbox health, verify domain DNS records, and track warmup and bounce metrics."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["inboxes"] });
              queryClient.invalidateQueries({ queryKey: ["domains"] });
              queryClient.invalidateQueries({ queryKey: ["deliverability"] });
            }}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Inboxes tab ── */}
      {tab === "inboxes" && (
        <div className="space-y-4">
          <ConnectInboxForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["inboxes"] })} />

          {inboxes.isPending && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          )}

          {inboxes.error && (
            <Alert variant="error" onRetry={() => inboxes.refetch()}>
              Could not load inboxes.
            </Alert>
          )}

          {!inboxes.isPending && inboxList.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <Mail className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No inboxes connected yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Connect your first inbox using the button above.</p>
            </div>
          )}

          {inboxList.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inboxList.map((inbox) => (
                <InboxCard
                  key={inbox.id}
                  inbox={inbox}
                  onPause={() => pauseInbox.mutate(inbox.id)}
                  onResume={() => resumeInbox.mutate(inbox.id)}
                  onDisconnect={() => disconnectInbox.mutate(inbox.id)}
                  isPausing={pauseInbox.isPending && pauseInbox.variables === inbox.id}
                  isResuming={resumeInbox.isPending && resumeInbox.variables === inbox.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Domains tab ── */}
      {tab === "domains" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add a sending domain</CardTitle>
              <CardDescription>
                Enter the domain you send email from. We&apos;ll show you the DNS records to add.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {domainError && <Alert variant="error">{domainError}</Alert>}
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. outreach.yourdomain.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && newDomain.trim() && addDomain.mutate()}
                  className="max-w-sm"
                />
                <Button
                  onClick={() => addDomain.mutate()}
                  disabled={!newDomain.trim() || addDomain.isPending}
                  className="gap-1.5 shrink-0"
                >
                  {addDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add domain
                </Button>
              </div>
            </CardContent>
          </Card>

          {domains.isPending && (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          )}

          {domains.error && (
            <Alert variant="error" onRetry={() => domains.refetch()}>
              Could not load domains.
            </Alert>
          )}

          {!domains.isPending && domainList.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <Globe className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No domains added yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Add a domain above to see DNS records and health status.</p>
            </div>
          )}

          {domainList.length > 0 && (
            <div className="space-y-3">
              {domainList.map((domain) => (
                <DomainCard
                  key={domain.id}
                  domain={domain}
                  onRemove={() => removeDomain.mutate(domain.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Analytics tab ── */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* Summary stats */}
          {m && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                { label: "Total sent", value: m.summary.totalSent.toLocaleString(), icon: Mail },
                { label: "Avg bounce rate", value: `${m.summary.avgBounceRate.toFixed(2)}%`, icon: AlertCircle },
                { label: "Avg spam rate", value: `${m.summary.avgSpamRate.toFixed(2)}%`, icon: ShieldCheck },
                { label: "Active inboxes", value: m.summary.inboxCount, icon: Wifi },
                { label: "Warming", value: m.summary.warmingCount, icon: TrendingUp },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="flex flex-col items-center justify-center py-5 text-center">
                    <Icon className="mb-1.5 h-5 w-5 text-muted-foreground" />
                    <p className="text-xl font-bold tabular-nums">{value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {metrics.isPending && (
            <div className="space-y-4">
              <Skeleton className="h-52 rounded-xl" />
              <Skeleton className="h-52 rounded-xl" />
            </div>
          )}

          {metrics.error && (
            <Alert variant="error" onRetry={() => metrics.refetch()}>
              Could not load metrics.
            </Alert>
          )}

          {m && m.warmup.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Warmup progress
                </CardTitle>
                <CardDescription>Daily emails sent vs ramp target across all warming inboxes.</CardDescription>
              </CardHeader>
              <CardContent>
                <WarmupChart data={m.warmup} />
              </CardContent>
            </Card>
          )}

          {m && m.bounce.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-4 w-4 text-amber-500" />
                  Bounce &amp; spam rates
                </CardTitle>
                <CardDescription>
                  Keep bounce rate below 2% and spam rate below 0.1% for healthy deliverability.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <BounceSpamChart data={m.bounce} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
                  {m.bounce.slice(-1).map((d) => [
                    { label: "Latest bounce", value: `${d.bounceRate.toFixed(2)}%`, ok: d.bounceRate < 2, threshold: "< 2%" },
                    { label: "Latest spam", value: `${d.spamRate.toFixed(3)}%`, ok: d.spamRate < 0.1, threshold: "< 0.1%" },
                  ]).flat().map(({ label, value, ok, threshold }) => (
                    <div key={label} className={cn("rounded-lg border px-3 py-2.5", ok ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30")}>
                      <p className={cn("text-lg font-bold tabular-nums", ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground">Target {threshold}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {m && m.warmup.length === 0 && m.bounce.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No metrics yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Connect inboxes and start sending to see warmup and bounce data here.</p>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
