"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  INDUSTRIES,
  COUNTRIES,
  COMPANY_SIZE_BUCKETS,
  COMPANY_STAGE_OPTIONS,
  LAST_FUNDING_ROUND_OPTIONS,
  REVENUE_RANGES,
  HIRING_DEPARTMENTS,
  COMPANY_SIGNALS,
  EMPTY_FILTER_DRAFT,
  countCompanyFilters,
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

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompanyFilterSheet({
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

  const handleClear = () =>
    setDraft((d) => ({
      ...d,
      companyName: "",
      industries: [],
      subIndustry: "",
      country: "",
      state: "",
      city: "",
      companySizes: [],
      companyStage: "",
      lastFundingRound: "",
      revenueRange: "",
      currentlyHiring: false,
      hiringDepartments: [],
      companySignals: [],
    }));

  const set = <K extends keyof FilterDraft>(key: K, val: FilterDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const toggleHiringDept = (dept: string) =>
    setDraft((d) => ({
      ...d,
      hiringDepartments: d.hiringDepartments.includes(dept)
        ? d.hiringDepartments.filter((x) => x !== dept)
        : [...d.hiringDepartments, dept],
    }));

  const toggleSignal = (sig: string) =>
    setDraft((d) => ({
      ...d,
      companySignals: d.companySignals.includes(sig)
        ? d.companySignals.filter((x) => x !== sig)
        : [...d.companySignals, sig],
    }));

  const appliedCount = countCompanyFilters(value);
  const draftCount = countCompanyFilters(draft);

  return (
    <>
      <Button variant="outline" onClick={handleOpen} className="shrink-0 gap-1.5">
        <Building2 className="h-4 w-4" />
        Company Filters
        {appliedCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {appliedCount}
          </span>
        )}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Company Filters"
        description="Filter by company attributes, stage, funding, and signals."
      >
        <div className="space-y-6">

          {/* ── Basic Company ── */}
          <Section title="Basic Company">
            <div>
              <Label>Company Name</Label>
              <Input
                placeholder="e.g. Stripe"
                value={draft.companyName}
                onChange={(e) => set("companyName", e.target.value)}
              />
            </div>
            <div>
              <Label>Industry</Label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <Pill
                    key={ind}
                    active={draft.industries.includes(ind)}
                    onClick={() => set("industries", toggle(draft.industries, ind))}
                  >
                    {ind}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <Label>Sub-Industry</Label>
              <Input
                placeholder="e.g. Fintech"
                value={draft.subIndustry}
                onChange={(e) => set("subIndustry", e.target.value)}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Select value={draft.country} onChange={(e) => set("country", e.target.value)}>
                <option value="">Any country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>State</Label>
                <Input
                  placeholder="e.g. CA"
                  value={draft.state}
                  onChange={(e) => set("state", e.target.value)}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  placeholder="e.g. San Francisco"
                  value={draft.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Company Size</Label>
              <div className="flex flex-wrap gap-2">
                {COMPANY_SIZE_BUCKETS.map((b) => (
                  <Pill
                    key={b.value}
                    active={draft.companySizes.includes(b.value)}
                    onClick={() => set("companySizes", toggle(draft.companySizes, b.value))}
                  >
                    {b.label}
                  </Pill>
                ))}
              </div>
            </div>
          </Section>

          <hr className="border-border" />

          {/* ── Stage & Funding ── */}
          <Section title="Stage & Funding">
            <div>
              <Label>Company Stage</Label>
              <Select value={draft.companyStage} onChange={(e) => set("companyStage", e.target.value)}>
                <option value="">Any stage</option>
                {COMPANY_STAGE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Last Funding Round</Label>
              <Select value={draft.lastFundingRound} onChange={(e) => set("lastFundingRound", e.target.value)}>
                <option value="">Any round</option>
                {LAST_FUNDING_ROUND_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Revenue Range</Label>
              <Select value={draft.revenueRange} onChange={(e) => set("revenueRange", e.target.value)}>
                <option value="">Any revenue</option>
                {REVENUE_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>
          </Section>

          <hr className="border-border" />

          {/* ── Hiring ── */}
          <Section title="Hiring">
            <div>
              <Label>Status</Label>
              <Pill
                active={draft.currentlyHiring}
                onClick={() => set("currentlyHiring", !draft.currentlyHiring)}
              >
                Currently Hiring
              </Pill>
            </div>
            <div>
              <Label>Hiring Departments</Label>
              <div className="flex flex-wrap gap-2">
                {HIRING_DEPARTMENTS.map((dept) => (
                  <Pill
                    key={dept}
                    active={draft.hiringDepartments.includes(dept)}
                    onClick={() => toggleHiringDept(dept)}
                  >
                    {dept}
                  </Pill>
                ))}
              </div>
            </div>
          </Section>

          <hr className="border-border" />

          {/* ── Company Signals ── */}
          <Section title="Company Signals">
            <div className="flex flex-wrap gap-2">
              {COMPANY_SIGNALS.map((sig) => (
                <Pill
                  key={sig.value}
                  active={draft.companySignals.includes(sig.value)}
                  onClick={() => toggleSignal(sig.value)}
                >
                  {sig.label}
                </Pill>
              ))}
            </div>
          </Section>
        </div>

        {/* Sticky footer */}
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
