"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Volume2,
} from "lucide-react";
import { useDexterPlatformApi, type LinkedinVoiceEligibility } from "@/lib/dexter-platform";
import { useApiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProspectOption {
  id: string;
  fullName: string;
  title?: string;
  companyName?: string;
  linkedinUrl?: string;
}

type WizardStep = 1 | 2 | 3 | 4;
type VoiceMode = "personal" | "synthetic";

const REASON_COPY: Record<string, string> = {
  missing_linkedin_url: "This prospect has no LinkedIn URL. Add one, then verify again.",
  linkedin_account_not_connected: "Connect a LinkedIn account in Unipile before sending voice notes.",
  not_first_degree_connection: "Not a 1st-degree connection yet. Send a connection request first.",
  prospect_not_found: "Prospect could not be resolved in this workspace.",
};

function mapProspect(raw: Record<string, unknown>): ProspectOption | null {
  const snap =
    raw.snapshot && typeof raw.snapshot === "object" ? (raw.snapshot as Record<string, unknown>) : raw;
  const id = String(raw.prospectId ?? raw.id ?? snap.id ?? "");
  if (!id) return null;
  return {
    id,
    fullName: String(snap.fullName ?? raw.fullName ?? snap.name ?? "Prospect"),
    title: snap.title ? String(snap.title) : raw.title ? String(raw.title) : undefined,
    companyName: snap.companyName
      ? String(snap.companyName)
      : raw.companyName
        ? String(raw.companyName)
        : undefined,
    linkedinUrl: snap.linkedinUrl
      ? String(snap.linkedinUrl)
      : raw.linkedinUrl
        ? String(raw.linkedinUrl)
        : undefined,
  };
}

export function LinkedinVoiceWizard() {
  const api = useDexterPlatformApi();
  const fetchApi = useApiFetch();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [prospects, setProspects] = useState<ProspectOption[]>([]);
  const [prospectQuery, setProspectQuery] = useState("");
  const [selectedProspectId, setSelectedProspectId] = useState("");
  const [customLinkedinUrl, setCustomLinkedinUrl] = useState("");
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<LinkedinVoiceEligibility | null>(null);

  const [goal, setGoal] = useState("Open a short conversation about outbound pipeline");
  const [tone, setTone] = useState("Consultative and concise");
  const [customNotes, setCustomNotes] = useState("");
  const [language, setLanguage] = useState("en");
  const [draftingScript, setDraftingScript] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const [regionalBrief, setRegionalBrief] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState(30);

  const [voiceMode, setVoiceMode] = useState<VoiceMode>("personal");
  const [syntheticProfile, setSyntheticProfile] = useState<"alloy" | "echo" | "nova" | "onyx" | "fable" | "shimmer">(
    "alloy"
  );
  const [synthesizing, setSynthesizing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [creatingHandoff, setCreatingHandoff] = useState(false);
  const [handoffToken, setHandoffToken] = useState<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"script" | "url" | null>(null);
  const [confirmingSent, setConfirmingSent] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProspects() {
      try {
        const res = await fetchApi<{ data: Array<Record<string, unknown>> }>("/api/v1/prospects");
        const list = (res.data ?? []).map(mapProspect).filter((p): p is ProspectOption => Boolean(p));
        setProspects(list);
        if (list[0] && !selectedProspectId) setSelectedProspectId(list[0].id);
      } catch {
        setProspects([]);
      }
    }
    void loadProspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlaying(false);
  }, [audioUrl]);

  const selectedProspect = prospects.find((p) => p.id === selectedProspectId);
  const linkedinUrl = customLinkedinUrl.trim() || selectedProspect?.linkedinUrl || "";
  const filteredProspects = useMemo(() => {
    const q = prospectQuery.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter((p) =>
      [p.fullName, p.title, p.companyName, p.linkedinUrl].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [prospects, prospectQuery]);

  async function handleCheckEligibility() {
    if (!selectedProspectId) return;
    setLoadingEligibility(true);
    setErrorMessage(null);
    try {
      const res = await api.getLinkedinVoiceEligibility(selectedProspectId, linkedinUrl || undefined);
      setEligibility(res.data);
    } catch (err: unknown) {
      setEligibility(null);
      setErrorMessage(err instanceof Error ? err.message : "Failed to verify connection");
    } finally {
      setLoadingEligibility(false);
    }
  }

  async function handleDraftScript() {
    if (!selectedProspectId || !eligibility?.eligible) return;
    setDraftingScript(true);
    setErrorMessage(null);
    try {
      const res = await api.draftLinkedinVoiceScript({
        prospectId: selectedProspectId,
        goal,
        tone,
        customNotes: customNotes.trim() || undefined,
        language,
      });
      setScriptText(res.data.scriptText);
      setRegionalBrief(res.data.regionalBriefPreview);
      setEstimatedDuration(res.data.estimatedDurationSeconds);
      if (res.data.language) setLanguage(res.data.language);
      setCurrentStep(2);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to generate script");
    } finally {
      setDraftingScript(false);
    }
  }

  async function handleSynthesize() {
    if (!scriptText.trim()) return;
    setSynthesizing(true);
    setErrorMessage(null);
    try {
      const res = await api.synthesizeVoiceAudio({
        scriptText: scriptText.trim(),
        voice: syntheticProfile,
      });
      if (res.data.audioBase64) {
        setAudioUrl(`data:${res.data.mimeType};base64,${res.data.audioBase64}`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Audio preview failed");
    } finally {
      setSynthesizing(false);
    }
  }

  function togglePlay() {
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      void audioRef.current.play();
      setIsPlaying(true);
    }
  }

  async function handleCreateHandoff() {
    if (!selectedProspectId || !scriptText.trim()) return;
    setCreatingHandoff(true);
    setErrorMessage(null);
    try {
      const res = await api.createLinkedinVoiceHandoff({
        prospectId: selectedProspectId,
        scriptText,
        voiceChoice: voiceMode === "synthetic" ? syntheticProfile : "personal",
        regionalBriefPreview: regionalBrief,
        language,
        linkedinUrl: linkedinUrl || undefined,
      });
      setHandoffToken(res.data.handoffToken);
      setMobileUrl(res.data.mobileUrl);
      setCurrentStep(4);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create handoff");
    } finally {
      setCreatingHandoff(false);
    }
  }

  async function handleConfirmSent() {
    if (!handoffToken) return;
    setConfirmingSent(true);
    setErrorMessage(null);
    try {
      await api.confirmLinkedinVoiceSent(handoffToken);
      setConfirmedSuccess(true);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setConfirmingSent(false);
    }
  }

  async function copyText(value: string, kind: "script" | "url") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2">
          <Badge tone="info" className="gap-1 font-mono text-xs">
            <Mic className="h-3 w-3" /> LinkedIn Voice
          </Badge>
          <Badge tone="success" className="gap-1 font-mono text-xs">
            <ShieldCheck className="h-3 w-3" /> Manual send only
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">LinkedIn voice notes</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Draft a 30-second script with regional context, preview cadence if you want, then hand off to the LinkedIn
          mobile app. Skout never sends the voice note for you.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { step: 1, title: "1. Eligibility", desc: "1st-degree check" },
          { step: 2, title: "2. Script", desc: "Review & edit" },
          { step: 3, title: "3. Voice", desc: "Personal or preview" },
          { step: 4, title: "4. Handoff", desc: "Mobile send" },
        ].map((item) => {
          const active = currentStep === item.step;
          const completed = currentStep > item.step;
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => {
                if (completed) setCurrentStep(item.step as WizardStep);
              }}
              disabled={!completed && !active}
              className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                active
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
                  : completed
                    ? "cursor-pointer border-border/60 bg-muted/20 hover:bg-muted/40"
                    : "cursor-not-allowed border-border/30 bg-background/50 opacity-60"
              }`}
            >
              <span className="text-xs font-semibold">{item.title}</span>
              <span className="mt-1 truncate text-xs text-muted-foreground">{item.desc}</span>
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {currentStep === 1 && (
        <Card className="space-y-6 p-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <UserCheck className="h-5 w-5 text-primary" /> Select prospect and verify 1st-degree
            </h2>
            <p className="text-xs text-muted-foreground">
              LinkedIn only allows voice notes to 1st-degree connections, sent from the mobile app.
            </p>
          </div>

          {prospects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activated prospects in this workspace yet. Activate a prospect with a LinkedIn URL first.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium">Filter prospects</label>
                <input
                  type="search"
                  value={prospectQuery}
                  onChange={(e) => setProspectQuery(e.target.value)}
                  placeholder="Search by name, title, or company"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Prospect</label>
                <select
                  value={selectedProspectId}
                  onChange={(e) => {
                    setSelectedProspectId(e.target.value);
                    setEligibility(null);
                    setCustomLinkedinUrl("");
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {filteredProspects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                      {p.title ? ` — ${p.title}` : ""}
                      {p.companyName ? ` (${p.companyName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">LinkedIn profile URL</label>
                <input
                  type="url"
                  placeholder="https://www.linkedin.com/in/…"
                  value={customLinkedinUrl || selectedProspect?.linkedinUrl || ""}
                  onChange={(e) => {
                    setCustomLinkedinUrl(e.target.value);
                    setEligibility(null);
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              onClick={handleCheckEligibility}
              disabled={loadingEligibility || !selectedProspectId}
              variant="outline"
              className="gap-2"
            >
              {loadingEligibility ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verify 1st-degree connection
            </Button>
            {eligibility && (
              <Badge
                tone={eligibility.eligible ? "success" : "warning"}
                className="gap-1.5 px-3 py-1.5 text-xs"
              >
                {eligibility.eligible ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Eligible — 1st-degree confirmed
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    {REASON_COPY[eligibility.reason ?? ""] ?? "Not eligible yet"}
                  </>
                )}
              </Badge>
            )}
          </div>

          <div className="flex justify-end border-t border-border/40 pt-4">
            <Button
              type="button"
              onClick={handleDraftScript}
              disabled={draftingScript || !eligibility?.eligible}
              className="gap-2"
            >
              {draftingScript ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Continue to script
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 2 && (
        <Card className="space-y-6 p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5 text-primary" /> Review the spoken script
              </h2>
              <p className="text-xs text-muted-foreground">
                Edit freely. This is what you will say on LinkedIn — it is not sent automatically.
              </p>
            </div>
            <Badge tone="muted" className="font-mono text-xs">
              ~{estimatedDuration}s
            </Badge>
          </div>

          {regionalBrief && (
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <div>
                <span className="font-semibold">Regional guidance (unverified)</span>
                <p className="mt-0.5 text-muted-foreground">{regionalBrief}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium">
              Goal
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-normal"
              />
            </label>
            <label className="space-y-1.5 text-xs font-medium">
              Tone
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-normal"
              />
            </label>
            <label className="space-y-1.5 text-xs font-medium sm:col-span-2">
              Notes for Dexter
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-2 text-xs font-normal"
                placeholder="Optional: mention a real event you actually know about. Do not invent facts."
              />
            </label>
          </div>

          <label className="block space-y-2 text-xs font-medium">
            <span className="flex items-center justify-between">
              Spoken script
              <span className="font-normal text-muted-foreground">
                {scriptText.split(/\s+/).filter(Boolean).length} words
              </span>
            </span>
            <textarea
              rows={5}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-3 text-sm font-normal leading-relaxed"
            />
          </label>

          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={handleDraftScript} disabled={draftingScript} className="gap-2 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${draftingScript ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button type="button" onClick={() => setCurrentStep(3)} disabled={!scriptText.trim()} className="gap-2">
                Continue to voice
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {currentStep === 3 && (
        <Card className="space-y-6 p-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Volume2 className="h-5 w-5 text-primary" /> Choose how you will speak it
            </h2>
            <p className="text-xs text-muted-foreground">
              Default is your own voice in the LinkedIn app. Synthetic audio is a desktop cadence preview only — it is
              never uploaded to LinkedIn.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setVoiceMode("personal")}
              className={`rounded-lg border p-4 text-left ${
                voiceMode === "personal" ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50"
              }`}
            >
              <div className="text-sm font-semibold">Personal voice (recommended)</div>
              <p className="mt-1 text-xs text-muted-foreground">Record the script yourself in LinkedIn mobile.</p>
            </button>
            <button
              type="button"
              onClick={() => setVoiceMode("synthetic")}
              className={`rounded-lg border p-4 text-left ${
                voiceMode === "synthetic" ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50"
              }`}
            >
              <div className="text-sm font-semibold">Synthetic preview</div>
              <p className="mt-1 text-xs text-muted-foreground">Hear pacing before you record. Still a manual send.</p>
            </button>
          </div>

          {voiceMode === "synthetic" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["alloy", "echo", "nova", "onyx", "fable", "shimmer"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSyntheticProfile(id);
                      setAudioUrl(null);
                    }}
                    className={`rounded-lg border p-3 text-left text-xs ${
                      syntheticProfile === id ? "border-primary bg-primary/10" : "border-border/50"
                    }`}
                  >
                    {id}
                  </button>
                ))}
              </div>
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-5">
                <Button type="button" onClick={togglePlay} disabled={!audioUrl || synthesizing} size="lg" className="h-14 w-14 rounded-full">
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
                </Button>
                <Button type="button" variant="outline" onClick={handleSynthesize} disabled={synthesizing} className="gap-2 text-xs">
                  {synthesizing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                  Generate cadence preview
                </Button>
              </div>
            </>
          )}

          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <Button type="button" variant="ghost" onClick={() => setCurrentStep(2)}>
              Back
            </Button>
            <Button type="button" onClick={handleCreateHandoff} disabled={creatingHandoff} className="gap-2">
              {creatingHandoff ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Create mobile handoff
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 4 && (
        <Card className="space-y-6 p-6">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Smartphone className="h-5 w-5 text-primary" /> Send in LinkedIn mobile, then confirm
            </h2>
            <p className="text-xs text-muted-foreground">
              Open the thread with {selectedProspect?.fullName ?? "this prospect"}, record the note, send it, then
              confirm here so the timeline updates.
            </p>
          </div>

          {mobileUrl && (
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/20 p-5 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="QR code for this handoff"
                width={160}
                height={160}
                className="rounded-md bg-white p-2"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(mobileUrl)}`}
              />
              <div className="space-y-2 text-sm">
                <p>Scan to open this handoff on your phone.</p>
                <a href={mobileUrl} className="inline-flex items-center gap-1 text-primary underline">
                  Open handoff page <ExternalLink className="h-3 w-3" />
                </a>
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground underline"
                  >
                    Open LinkedIn profile
                  </a>
                )}
              </div>
            </div>
          )}

          <blockquote className="rounded-md border bg-background p-3 text-sm italic leading-relaxed">
            “{scriptText}”
          </blockquote>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void copyText(scriptText, "script")}>
              {copied === "script" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy script
            </Button>
            {mobileUrl && (
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void copyText(mobileUrl, "url")}>
                {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy handoff link
              </Button>
            )}
          </div>

          {confirmedSuccess ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Voice note logged. Outcome captured on the contact timeline when a CRM contact exists.
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-border/40 pt-4">
              <Button type="button" variant="ghost" onClick={() => setCurrentStep(3)}>
                Back
              </Button>
              <Button type="button" onClick={handleConfirmSent} disabled={confirmingSent} className="gap-2">
                {confirmingSent ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                I sent this voice message
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
