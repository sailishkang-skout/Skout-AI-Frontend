"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  BookmarkPlus,
  ChevronDown,
  FileText,
  Loader2,
  Maximize2,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiFetch } from "@/lib/api-client";

// TipTap uses browser APIs — load client-side only
const EmailEditor = dynamic(
  () => import("./email-editor").then((m) => ({ default: m.EmailEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const TEMPLATES_KEY = "skout_email_templates_v1";

interface EmailTemplate {
  id: string;
  name: string;
  html: string;
  subject?: string;
  createdAt: string;
}

function loadTemplates(): EmailTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTemplates(t: EmailTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t));
}

interface EmailBodyEditorProps {
  value: string;
  onChange: (html: string, subject?: string) => void;
  disabled?: boolean;
}

export function EmailBodyEditor({ value, onChange, disabled }: EmailBodyEditorProps) {
  const fetchApi = useApiFetch();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [editorKey, setEditorKey] = useState(0);
  const [templateName, setTemplateName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  // AI generate state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState<{ html: string; subject: string } | null>(null);
  const [aiSaveAs, setAiSaveAs] = useState("");
  const [aiSaveName, setAiSaveName] = useState("");

  const historyPushed   = useRef(false);
  const suppressNextPop = useRef(false);

  function openEditor() {
    setDraft(value);
    setTemplates(loadTemplates());
    setOpen(true);
    history.pushState({ skoutEditorOpen: true }, "");
    historyPushed.current = true;
  }

  function doClose() {
    setOpen(false);
    if (historyPushed.current) {
      historyPushed.current   = false;
      suppressNextPop.current = true;
      history.go(-1);
    }
  }

  function applyAndClose() {
    onChange(draft);
    doClose();
  }

  function discardAndClose() {
    setDraft(value);
    doClose();
  }

  // Mobile back button → close modal, don't navigate away
  useEffect(() => {
    if (!open) return;
    function onPopState() {
      if (suppressNextPop.current) { suppressNextPop.current = false; return; }
      historyPushed.current = false;
      setDraft(value);
      setOpen(false);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open, value]);

  // ── Template helpers ───────────────────────────────────────
  function handleSaveTemplate() {
    if (!templateName.trim()) return;
    const t: EmailTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      html: draft,
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, t];
    saveTemplates(updated);
    setTemplates(updated);
    setTemplateName("");
    setShowSaveInput(false);
  }

  function handleLoadTemplate(t: EmailTemplate) {
    setDraft(t.html);
    setEditorKey((k) => k + 1);
    setShowTemplateList(false);
  }

  function handleDeleteTemplate(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = templates.filter((t) => t.id !== id);
    saveTemplates(updated);
    setTemplates(updated);
  }

  // ── AI generate ────────────────────────────────────────────
  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const result = await fetchApi<{ html: string; subject: string }>(
        "/api/v1/ai/generate-email",
        { method: "POST", body: JSON.stringify({ prompt: aiPrompt.trim() }) }
      );
      setAiResult(result);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Generation failed. Check your OpenAI API key.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiInsert() {
    if (!aiResult) return;
    setDraft(aiResult.html);
    setEditorKey((k) => k + 1);
    setShowAiModal(false);
    setAiResult(null);
    setAiPrompt("");
    setAiSaveAs("");
  }

  function handleAiSaveTemplate() {
    if (!aiResult || !aiSaveName.trim()) return;
    const tplList = loadTemplates();
    const t: EmailTemplate = {
      id: crypto.randomUUID(),
      name: aiSaveName.trim(),
      html: aiResult.html,
      subject: aiResult.subject,
      createdAt: new Date().toISOString(),
    };
    saveTemplates([...tplList, t]);
    setTemplates([...tplList, t]);
    setAiSaveName("");
    setAiSaveAs("");
  }

  function handleAiInsertAndApply() {
    if (!aiResult) return;
    onChange(aiResult.html);
    setShowAiModal(false);
    setAiResult(null);
    setAiPrompt("");
    doClose();
  }

  const hasContent = value.trim().length > 0;

  return (
    <>
      {/* ── Preview card ─────────────────────────────────── */}
      <div
        className={cn(
          "group relative min-h-[72px] cursor-pointer rounded-md border border-border bg-background transition-colors hover:border-primary/50",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={openEditor}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && openEditor()}
      >
        {hasContent ? (
          <div
            className="prose prose-sm pointer-events-none max-h-28 overflow-hidden p-3 text-sm [&_*]:!text-foreground"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        ) : (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Maximize2 className="h-3.5 w-3.5" />
            Click to open email editor…
          </div>
        )}
        {hasContent && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Maximize2 className="h-3.5 w-3.5" />
              Edit email body
            </span>
          </div>
        )}
      </div>

      {/* ── Full-screen editor modal ──────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Header */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">Email body</span>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* ── AI Generate ── */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowAiModal(true); setAiError(""); setAiResult(null); }}
                className="gap-1.5 border-violet-300 text-violet-600 hover:bg-violet-50 hover:text-violet-700 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-900/30"
                title="Generate with AI"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI Generate</span>
              </Button>

              {/* Save as template */}
              {showSaveInput ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    placeholder="Template name…"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTemplate();
                      if (e.key === "Escape") setShowSaveInput(false);
                    }}
                    className="h-8 w-28 sm:w-44 rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" onClick={handleSaveTemplate}>
                    <Save className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Save</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSaveInput(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveInput(true)}
                  className="gap-1.5"
                  title="Save as template"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Save as template</span>
                </Button>
              )}

              {/* Load template */}
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTemplateList((v) => !v)}
                  className="gap-1.5"
                  title="Templates"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Templates</span>
                  <ChevronDown className="hidden h-3 w-3 sm:block" />
                </Button>
                {showTemplateList && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-border bg-card shadow-lg">
                    {templates.length === 0 ? (
                      <p className="p-3 text-center text-xs text-muted-foreground">
                        No saved templates yet
                      </p>
                    ) : (
                      <ul className="max-h-60 overflow-auto py-1">
                        {templates.map((t) => (
                          <li
                            key={t.id}
                            className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-accent"
                            onClick={() => handleLoadTemplate(t)}
                          >
                            <span className="truncate text-sm">{t.name}</span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTemplate(t.id, e)}
                              className="ml-2 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <Button size="sm" onClick={applyAndClose} className="gap-1.5">
                Apply
              </Button>

              <button
                type="button"
                onClick={discardAndClose}
                title="Discard changes"
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <EmailEditor
              key={editorKey}
              initialContent={draft}
              onChange={setDraft}
            />
          </div>

          {/* ── AI Generate Modal (shown over the editor) ── */}
          {showAiModal && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-border bg-card shadow-2xl">
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    <h3 className="text-sm font-semibold">Generate email with AI</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowAiModal(false); setAiResult(null); setAiError(""); }}
                    className="rounded p-1 text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 px-5 pb-5">
                  {/* Prompt input */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Describe the email you want
                    </label>
                    <textarea
                      autoFocus
                      rows={3}
                      placeholder="e.g. Cold outreach to a VP of Sales at a SaaS company, offering our sales automation tool, friendly and concise tone"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAiGenerate();
                      }}
                      className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Press Ctrl+Enter to generate
                    </p>
                  </div>

                  {/* Error */}
                  {aiError && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {aiError}
                    </p>
                  )}

                  {/* Generated preview */}
                  {aiResult && (
                    <div className="space-y-2">
                      {aiResult.subject && (
                        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
                          <p className="text-sm font-medium">{aiResult.subject}</p>
                        </div>
                      )}
                      <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                        <div
                          className="prose prose-sm text-sm [&_*]:!text-foreground"
                          dangerouslySetInnerHTML={{ __html: aiResult.html }}
                        />
                      </div>

                      {/* Save as template option */}
                      {aiSaveAs === "saving" ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            placeholder="Template name…"
                            value={aiSaveName}
                            onChange={(e) => setAiSaveName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { handleAiSaveTemplate(); }
                              if (e.key === "Escape") setAiSaveAs("");
                            }}
                            className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Button size="sm" onClick={handleAiSaveTemplate} disabled={!aiSaveName.trim()}>
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAiSaveAs("")}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAiSaveAs("saving")}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <BookmarkPlus className="h-3.5 w-3.5" />
                          Save as template
                        </button>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleAiGenerate}
                      disabled={aiLoading || !aiPrompt.trim()}
                      className="gap-2"
                    >
                      {aiLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {aiLoading ? "Generating…" : aiResult ? "Regenerate" : "Generate"}
                    </Button>

                    {aiResult && (
                      <>
                        <Button variant="outline" onClick={handleAiInsert} className="gap-1.5">
                          Insert into editor
                        </Button>
                        <Button variant="outline" onClick={handleAiInsertAndApply} className="gap-1.5">
                          Insert &amp; Apply
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
