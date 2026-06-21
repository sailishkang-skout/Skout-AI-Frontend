"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  SENIORITY_OPTIONS,
  DEPARTMENT_OPTIONS,
  JOB_FUNCTION_OPTIONS,
  YEARS_OPTIONS,
  CONTACT_SIGNALS,
  EMPTY_FILTER_DRAFT,
  countContactFilters,
  type FilterDraft,
} from "@/lib/search-constants";

// ─── Local helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-medium text-foreground/80">{children}</p>;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContactFilterSheet({
  value,
  onApply,
}: {
  value: FilterDraft;
  onApply: (f: FilterDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(value);

  const handleOpen = () => {
    setDraft(value);
    setOpen(true);
  };

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleClear = () => setDraft(EMPTY_FILTER_DRAFT);

  const set = <K extends keyof FilterDraft>(key: K, val: FilterDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const toggleSignal = (sig: string) =>
    setDraft((d) => ({
      ...d,
      contactSignals: d.contactSignals.includes(sig)
        ? d.contactSignals.filter((s) => s !== sig)
        : [...d.contactSignals, sig],
    }));

  const appliedCount = countContactFilters(value);
  const draftCount = countContactFilters(draft);

  return (
    <>
      <Button variant="outline" onClick={handleOpen} className="shrink-0 gap-1.5">
        <SlidersHorizontal className="h-4 w-4" />
        Contact Filters
        {appliedCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {appliedCount}
          </span>
        )}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Contact Filters"
        description="Narrow results by contact, company, and activity signals."
      >
        {/* Scrollable body */}
        <div className="space-y-6">

          {/* ── Contact Information ── */}
          <Section title="Contact Information">
            <div>
              <Label>Job Title</Label>
              <Input
                placeholder="e.g. VP of Sales"
                value={draft.jobTitle}
                onChange={(e) => set("jobTitle", e.target.value)}
              />
            </div>
            <div>
              <Label>Department</Label>
              <Select
                value={draft.department}
                onChange={(e) => set("department", e.target.value)}
              >
                <option value="">Any department</option>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Seniority</Label>
              <Select
                value={draft.seniority}
                onChange={(e) => set("seniority", e.target.value)}
              >
                <option value="">Any seniority</option>
                {SENIORITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Data Available</Label>
              <div className="flex flex-wrap gap-2">
                <Pill active={draft.emailAvailable} onClick={() => set("emailAvailable", !draft.emailAvailable)}>
                  Email
                </Pill>
                <Pill active={draft.phoneAvailable} onClick={() => set("phoneAvailable", !draft.phoneAvailable)}>
                  Phone
                </Pill>
                <Pill active={draft.linkedInAvailable} onClick={() => set("linkedInAvailable", !draft.linkedInAvailable)}>
                  LinkedIn
                </Pill>
              </div>
            </div>
          </Section>

          <hr className="border-border" />

          {/* ── Job Function ── */}
          <Section title="Job Function">
            <Select
              value={draft.jobFunction}
              onChange={(e) => set("jobFunction", e.target.value)}
            >
              <option value="">Any function</option>
              {JOB_FUNCTION_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>
          </Section>

          <hr className="border-border" />

          {/* ── Experience ── */}
          <Section title="Experience">
            <div>
              <Label>Years at Company</Label>
              <Select
                value={draft.minYearsAtCompany}
                onChange={(e) => set("minYearsAtCompany", e.target.value)}
              >
                <option value="">Any tenure</option>
                {YEARS_OPTIONS.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Years in Role</Label>
              <Select
                value={draft.minYearsInRole}
                onChange={(e) => set("minYearsInRole", e.target.value)}
              >
                <option value="">Any duration</option>
                {YEARS_OPTIONS.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Previous Company</Label>
              <Input
                placeholder="e.g. Salesforce"
                value={draft.previousCompany}
                onChange={(e) => set("previousCompany", e.target.value)}
              />
            </div>
          </Section>

          <hr className="border-border" />

          {/* ── Activity Signals ── */}
          <Section title="Activity Signals">
            <div className="flex flex-wrap gap-2">
              {CONTACT_SIGNALS.map((sig) => (
                <Pill
                  key={sig.value}
                  active={draft.contactSignals.includes(sig.value)}
                  onClick={() => toggleSignal(sig.value)}
                >
                  {sig.label}
                </Pill>
              ))}
            </div>
          </Section>

        </div>

        {/* Sticky footer — bleeds to container edges via negative margins */}
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6">
          <div className="flex gap-2">
            <Button onClick={handleApply} className="flex-1">
              {draftCount > 0
                ? `Apply ${draftCount} filter${draftCount !== 1 ? "s" : ""}`
                : "Apply"}
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={draftCount === 0}>
              Clear all
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
