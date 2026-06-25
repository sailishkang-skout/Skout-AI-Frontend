"use client";

import { useState, type ReactNode } from "react";
import {
  AtSign,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock,
  Copy,
  Cpu,
  DollarSign,
  Factory,
  FileText,
  Mail,
  MapPin,
  Network,
  Phone,
  ShoppingCart,
  Tag,
  User,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  BUYING_INTENT_OPTIONS,
  COMPANY_SIGNALS,
  COMPANY_SIZE_BUCKETS,
  COMPANY_STAGE_OPTIONS,
  CONTACT_SIGNALS,
  COUNTRIES,
  DEPARTMENT_OPTIONS,
  EMAIL_PROVIDER_OPTIONS,
  EMPTY_FILTER_DRAFT,
  HEADCOUNT_GROWTH_OPTIONS,
  HIRING_DEPARTMENTS,
  INDUSTRIES,
  JOB_FUNCTION_OPTIONS,
  LAST_FUNDING_ROUND_OPTIONS,
  MAX_PER_COMPANY_OPTIONS,
  REVENUE_RANGES,
  SENIORITY_OPTIONS,
  YEARS_OPTIONS,
  countActiveFilters,
  type FilterDraft,
} from "@/lib/search-constants";

const ICON = "h-4 w-4 shrink-0 text-red-600";

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-xs font-medium text-muted-foreground">{children}</p>;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
      )}
    >
      {children}
    </button>
  );
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterSection({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-3 py-3 text-left text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        <Icon className={ICON} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-3 px-3 pb-4">{children}</div>}
    </div>
  );
}

export function ProspectFilterSidebar({
  value,
  onChange,
  onClear,
  className,
}: {
  value: FilterDraft;
  onChange: (draft: FilterDraft) => void;
  onClear?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>("Person Name");
  const set = (patch: Partial<FilterDraft>) => onChange({ ...value, ...patch });
  const activeCount = countActiveFilters(value);

  const sections: { title: string; icon: LucideIcon; body: ReactNode }[] = [
    {
      title: "Person Name",
      icon: User,
      body: <Input placeholder="e.g. Sarah Chen" value={value.fullName} onChange={(e) => set({ fullName: e.target.value })} />,
    },
    {
      title: "Company",
      icon: Building2,
      body: (
        <>
          <Label>Company name</Label>
          <Input className="mb-2" placeholder="e.g. Stripe" value={value.companyName} onChange={(e) => set({ companyName: e.target.value })} />
          <Label>Domain</Label>
          <Input placeholder="e.g. stripe.com" value={value.companyDomain} onChange={(e) => set({ companyDomain: e.target.value })} />
        </>
      ),
    },
    {
      title: "Job Title",
      icon: Briefcase,
      body: (
        <>
          <Input placeholder="e.g. VP Sales" value={value.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} />
          <Label>Seniority</Label>
          <Select value={value.seniority} onChange={(e) => set({ seniority: e.target.value })}>
            <option value="">Any</option>
            {SENIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Label>Department</Label>
          <Select value={value.department} onChange={(e) => set({ department: e.target.value })}>
            <option value="">Any</option>
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
          <Label>Job function</Label>
          <Select value={value.jobFunction} onChange={(e) => set({ jobFunction: e.target.value })}>
            <option value="">Any</option>
            {JOB_FUNCTION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </>
      ),
    },
    {
      title: "Location",
      icon: MapPin,
      body: (
        <>
          <Label>Country</Label>
          <Select value={value.country} onChange={(e) => set({ country: e.target.value })}>
            <option value="">Any</option>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Label>State / region</Label>
          <Input value={value.state} onChange={(e) => set({ state: e.target.value })} placeholder="e.g. CA" />
          <Label>City</Label>
          <Input value={value.city} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. San Francisco" />
        </>
      ),
    },
    {
      title: "Contact Details",
      icon: Phone,
      body: (
        <div className="flex flex-wrap gap-2">
          <Pill active={value.emailAvailable} onClick={() => set({ emailAvailable: !value.emailAvailable })}>Has email</Pill>
          <Pill active={value.phoneAvailable} onClick={() => set({ phoneAvailable: !value.phoneAvailable })}>Has phone</Pill>
          <Pill active={value.linkedInAvailable} onClick={() => set({ linkedInAvailable: !value.linkedInAvailable })}>Has LinkedIn</Pill>
        </div>
      ),
    },
    {
      title: "Duplicate Control",
      icon: Copy,
      body: (
        <Pill active={value.excludeDuplicates} onClick={() => set({ excludeDuplicates: !value.excludeDuplicates })}>
          Exclude duplicate contacts
        </Pill>
      ),
    },
    {
      title: "Employee Headcount",
      icon: UserCheck,
      body: (
        <Select value={value.companySize} onChange={(e) => set({ companySize: e.target.value })}>
          <option value="">Any size</option>
          {COMPANY_SIZE_BUCKETS.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </Select>
      ),
    },
    {
      title: "Industry & Keyword",
      icon: Factory,
      body: (
        <>
          <Label>Industry</Label>
          <Select value={value.industry} onChange={(e) => set({ industry: e.target.value })}>
            <option value="">Any</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </Select>
          <Label>Keyword</Label>
          <Input placeholder="e.g. payments, CRM" value={value.keyword} onChange={(e) => set({ keyword: e.target.value })} />
          <Label>Sub-industry</Label>
          <Input value={value.subIndustry} onChange={(e) => set({ subIndustry: e.target.value })} />
        </>
      ),
    },
    {
      title: "Buying Intent",
      icon: ShoppingCart,
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            {BUYING_INTENT_OPTIONS.map((o) => (
              <Pill key={o.value} active={value.buyingIntent === o.value} onClick={() => set({ buyingIntent: value.buyingIntent === o.value ? "" : o.value })}>
                {o.label}
              </Pill>
            ))}
          </div>
          <Label>Company signals</Label>
          <div className="flex flex-wrap gap-2">
            {COMPANY_SIGNALS.map((s) => (
              <Pill key={s.value} active={value.companySignals.includes(s.value)} onClick={() => set({ companySignals: toggle(value.companySignals, s.value) })}>
                {s.label}
              </Pill>
            ))}
          </div>
        </>
      ),
    },
    {
      title: "Revenue",
      icon: Tag,
      body: (
        <Select value={value.revenueRange} onChange={(e) => set({ revenueRange: e.target.value })}>
          <option value="">Any revenue</option>
          {REVENUE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
      ),
    },
    {
      title: "Job Change",
      icon: Calendar,
      body: (
        <>
          <Pill active={value.jobChangeOnly} onClick={() => set({ jobChangeOnly: !value.jobChangeOnly })}>Recently changed jobs</Pill>
          <div className="flex flex-wrap gap-2">
            {CONTACT_SIGNALS.map((s) => (
              <Pill key={s.value} active={value.contactSignals.includes(s.value)} onClick={() => set({ contactSignals: toggle(value.contactSignals, s.value) })}>
                {s.label}
              </Pill>
            ))}
          </div>
        </>
      ),
    },
    {
      title: "Funding",
      icon: DollarSign,
      body: (
        <>
          <Label>Company stage</Label>
          <Select value={value.companyStage} onChange={(e) => set({ companyStage: e.target.value })}>
            <option value="">Any</option>
            {COMPANY_STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Label>Last funding round</Label>
          <Select value={value.lastFundingRound} onChange={(e) => set({ lastFundingRound: e.target.value })}>
            <option value="">Any</option>
            {LAST_FUNDING_ROUND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </>
      ),
    },
    {
      title: "Technologies",
      icon: Cpu,
      body: <Input placeholder="e.g. Salesforce, HubSpot" value={value.tech} onChange={(e) => set({ tech: e.target.value })} />,
    },
    {
      title: "Select Per Company",
      icon: Users,
      body: (
        <Select value={value.maxPerCompany} onChange={(e) => set({ maxPerCompany: e.target.value })}>
          <option value="">No limit</option>
          {MAX_PER_COMPANY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      ),
    },
    {
      title: "Total Years of Experience",
      icon: Calendar,
      body: (
        <Select value={value.minTotalYearsExperience} onChange={(e) => set({ minTotalYearsExperience: e.target.value })}>
          <option value="">Any</option>
          {YEARS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      ),
    },
    {
      title: "Time in Current Role",
      icon: Clock,
      body: (
        <Select value={value.minYearsInRole} onChange={(e) => set({ minYearsInRole: e.target.value })}>
          <option value="">Any</option>
          {YEARS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      ),
    },
    {
      title: "Time in Current Company",
      icon: CalendarClock,
      body: (
        <>
          <Select value={value.minYearsAtCompany} onChange={(e) => set({ minYearsAtCompany: e.target.value })}>
            <option value="">Any</option>
            {YEARS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Label>Previous company</Label>
          <Input value={value.previousCompany} onChange={(e) => set({ previousCompany: e.target.value })} placeholder="e.g. Salesforce" />
        </>
      ),
    },
    {
      title: "Founded Year",
      icon: Calendar,
      body: (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>From</Label>
            <Input type="number" placeholder="1990" value={value.minFoundedYear} onChange={(e) => set({ minFoundedYear: e.target.value })} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="number" placeholder="2024" value={value.maxFoundedYear} onChange={(e) => set({ maxFoundedYear: e.target.value })} />
          </div>
        </div>
      ),
    },
    {
      title: "Headcount Growth",
      icon: Users,
      body: (
        <div className="flex flex-wrap gap-2">
          {HEADCOUNT_GROWTH_OPTIONS.map((o) => (
            <Pill key={o.value} active={value.headcountGrowth === o.value} onClick={() => set({ headcountGrowth: value.headcountGrowth === o.value ? "" : o.value })}>
              {o.label}
            </Pill>
          ))}
        </div>
      ),
    },
    {
      title: "Company Attributes",
      icon: AtSign,
      body: <Input value={value.subIndustry} onChange={(e) => set({ subIndustry: e.target.value })} placeholder="Sub-industry / niche" />,
    },
    {
      title: "Job Posting",
      icon: FileText,
      body: (
        <Pill active={value.currentlyHiring} onClick={() => set({ currentlyHiring: !value.currentlyHiring })}>
          Currently hiring
        </Pill>
      ),
    },
    {
      title: "Headcount by Department",
      icon: Network,
      body: (
        <div className="flex flex-wrap gap-2">
          {HIRING_DEPARTMENTS.map((d) => (
            <Pill key={d} active={value.hiringDepartments.includes(d)} onClick={() => set({ hiringDepartments: toggle(value.hiringDepartments, d) })}>
              {d}
            </Pill>
          ))}
        </div>
      ),
    },
    {
      title: "Company Email Provider",
      icon: Mail,
      body: (
        <Select value={value.companyEmailProvider} onChange={(e) => set({ companyEmailProvider: e.target.value })}>
          <option value="">Any</option>
          {EMAIL_PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      ),
    },
  ];

  return (
    <aside className={cn("flex flex-col rounded-lg border border-border bg-card", className)} data-testid="prospect-filter-sidebar">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <p className="text-sm font-semibold">Filters</p>
        {activeCount > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => (onClear ? onClear() : onChange(EMPTY_FILTER_DRAFT))}>
            Clear ({activeCount})
          </Button>
        )}
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
        {sections.map((section) => (
          <FilterSection
            key={section.title}
            title={section.title}
            icon={section.icon}
            open={open === section.title}
            onToggle={() => setOpen((cur) => (cur === section.title ? null : section.title))}
          >
            {section.body}
          </FilterSection>
        ))}
      </div>
    </aside>
  );
}
