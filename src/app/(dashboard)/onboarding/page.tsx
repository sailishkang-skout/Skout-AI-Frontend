"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Gauge,
  Globe,
  Loader2,
  PartyPopper,
  Plug,
  Rocket,
  Search,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { GdprBadge } from "@/components/onboarding/gdpr-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEmailIntelApi } from "@/lib/email-intel";
import { useIcpApi } from "@/lib/icp";
import { isOnboardingComplete } from "@/lib/scoring";
import type { IcpConfig, OnboardingProfile } from "@/types/api";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const COMPANY_INDUSTRIES = [
  "SaaS",
  "IT Services",
  "Consulting",
  "Marketing Agency",
  "Recruitment",
  "Software Development",
  "Manufacturing",
  "Financial Services",
  "Healthcare",
  "Ecommerce",
  "Education",
  "Real Estate",
  "Other",
];

const COMPANY_SIZES = ["Just me", "2-10", "11-50", "51-200", "201-1000", "1000+"];

const GOALS = [
  "Generate leads",
  "Find decision makers",
  "Build prospect lists",
  "Enrich existing CRM",
  "Cold email outreach",
  "Account-based marketing",
  "Recruit talent",
  "Market research",
  "Competitive research",
  "Other",
];

const ICP_INDUSTRY_OPTIONS = [
  "Software",
  "SaaS",
  "Healthcare",
  "Finance",
  "Construction",
  "Manufacturing",
  "Retail",
  "Legal",
  "Education",
  "Marketing",
  "IT",
  "Telecom",
  "Energy",
  "Ecommerce",
  "Real Estate",
  "Logistics",
  "Hospitality",
  "Media",
];

const ICP_EMPLOYEE_RANGES = ["1-10", "11-50", "51-200", "201-500", "500-1000", "1000+"];

const GEOGRAPHIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Europe",
  "Australia",
  "India",
  "Worldwide",
];

const REVENUE_RANGES = ["<$1M", "$1M-$10M", "$10M-$50M", "$50M-$100M", "$100M+"];

const DEPARTMENTS = [
  "Sales",
  "Marketing",
  "Engineering",
  "Finance",
  "HR",
  "Customer Success",
  "Operations",
  "Legal",
  "IT",
  "Executive",
];

const SENIORITY_OPTIONS = [
  { id: "founder", label: "Founder" },
  { id: "co_founder", label: "Co-founder" },
  { id: "ceo", label: "Owner / CEO" },
  { id: "c_level", label: "C-Level" },
  { id: "vp", label: "VP" },
  { id: "director", label: "Director" },
  { id: "head", label: "Head" },
  { id: "manager", label: "Manager" },
  { id: "individual_contributor", label: "Individual Contributor" },
];

const TITLE_SUGGESTIONS = [
  "Founder",
  "CEO",
  "VP Sales",
  "Head of Marketing",
  "Revenue Operations",
  "Demand Generation",
  "Head of Growth",
  "Sales Manager",
];

const MARKETS = ["B2B", "B2C", "Enterprise", "SMB", "Mid-Market", "Government", "Non-Profit"];

const TOOLS = [
  "HubSpot",
  "Salesforce",
  "Pipedrive",
  "Close",
  "Clay",
  "Slack",
  "Google Sheets",
  "CSV Upload",
];

const LEAD_VOLUMES = ["100/month", "500/month", "1000/month", "5000/month", "10000+"];

/** Onboarding geography label → ICP country codes used by search/scoring. */
const GEO_TO_COUNTRIES: Record<string, string[]> = {
  "United States": ["US"],
  Canada: ["CA"],
  "United Kingdom": ["UK"],
  Europe: ["DE", "FR"],
  Australia: ["AU"],
  India: ["IN"],
  Worldwide: [],
};

const RANGE_BOUNDS: Record<string, { min: number; max?: number }> = {
  "1-10": { min: 1, max: 10 },
  "11-50": { min: 11, max: 50 },
  "51-200": { min: 51, max: 200 },
  "201-500": { min: 201, max: 500 },
  "500-1000": { min: 500, max: 1000 },
  "1000+": { min: 1000 },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface WizardState {
  companyIndustry: string;
  companySize: string;
  companyName: string;
  website: string;
  goals: string[];
  icpIndustries: string[];
  icpEmployeeRanges: string[];
  geographies: string[];
  revenue: string;
  departments: string[];
  seniorities: string[];
  titles: string[];
  market: string[];
  crm: string;
  leadVolume: string;
  customTitles: string[];
}

const INITIAL_STATE: WizardState = {
  companyIndustry: "",
  companySize: "",
  companyName: "",
  website: "",
  goals: [],
  icpIndustries: [],
  icpEmployeeRanges: [],
  geographies: [],
  revenue: "",
  departments: [],
  seniorities: [],
  titles: [],
  market: [],
  crm: "",
  leadVolume: "",
  customTitles: [],
};

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Map wizard answers to the workspace ICP config + raw onboarding profile. */
function buildIcpConfig(s: WizardState): IcpConfig {
  const countries = Array.from(new Set(s.geographies.flatMap((g) => GEO_TO_COUNTRIES[g] ?? [])));

  const bounds = s.icpEmployeeRanges
    .map((r) => RANGE_BOUNDS[r])
    .filter((b): b is { min: number; max?: number } => Boolean(b));
  const minEmployees = bounds.length ? Math.min(...bounds.map((b) => b.min)) : undefined;
  const maxes = bounds.map((b) => b.max).filter((m): m is number => m != null);
  // Any open-ended range ("1000+") means no upper bound.
  const maxEmployees = bounds.length && maxes.length === bounds.length ? Math.max(...maxes) : undefined;

  const descriptionParts = [
    s.companyIndustry && `${s.companyIndustry} company`,
    s.companySize && `(${s.companySize} people)`,
    s.goals.length && `focused on: ${s.goals.slice(0, 4).join(", ").toLowerCase()}`,
  ].filter(Boolean);

  const onboarding: OnboardingProfile = {
    company: {
      name: s.companyName || undefined,
      industry: s.companyIndustry || undefined,
      size: s.companySize || undefined,
      website: s.website || undefined,
    },
    goals: s.goals.length ? s.goals : undefined,
    icp: {
      industries: s.icpIndustries.length ? s.icpIndustries : undefined,
      employeeRanges: s.icpEmployeeRanges.length ? s.icpEmployeeRanges : undefined,
      countries: s.geographies.length ? s.geographies : undefined,
      revenue: s.revenue || undefined,
    },
    people: {
      departments: s.departments.length ? s.departments : undefined,
      seniorities: s.seniorities.length ? s.seniorities : undefined,
      titles: s.titles.length ? s.titles : undefined,
    },
    market: s.market.length ? s.market : undefined,
    crm: s.crm || undefined,
    leadVolume: s.leadVolume || undefined,
    completedAt: new Date().toISOString(),
  };

  return {
    industries: s.icpIndustries,
    countries,
    seniorities: s.seniorities,
    titles: s.titles,
    keywords: Array.from(new Set([...s.market, ...s.departments.slice(0, 4)])),
    minEmployees,
    maxEmployees,
    companyName: s.companyName || undefined,
    productDescription: descriptionParts.length ? descriptionParts.join(" ") : undefined,
    onboarding,
  };
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}

function OptionCard({
  label,
  selected,
  onClick,
  hint,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
          : "border-border bg-background hover:border-primary/40 hover:bg-accent"
      )}
    >
      <span>
        {label}
        {hint && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={cn(
          "ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {selected && <CheckCircle2 className="h-4 w-4" />}
      </span>
    </button>
  );
}

function StepHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Target;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="text-sm font-medium">
      {children}
      {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>}
    </p>
  );
}

/** Post-signup prompt to verify the address they'll actually send outreach from. */
function VerifySendingEmailCard() {
  const emailIntel = useEmailIntelApi();
  const [email, setEmail] = useState("");

  const verify = useMutation({
    mutationFn: (value: string) => emailIntel.verify(value),
  });

  return (
    <div className="w-full max-w-sm space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-left">
      <div className="flex items-center gap-2">
        <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-sm font-medium">Verify your sending email</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Catch typos and catch-all mailboxes before your first campaign goes out.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) verify.mutate(email.trim());
        }}
      >
        <Input
          type="email"
          placeholder="you@yourcompany.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-9 text-sm"
        />
        <Button type="submit" size="sm" disabled={verify.isPending || !email.trim()}>
          {verify.isPending ? "Checking…" : "Check"}
        </Button>
      </form>
      {verify.isError && (
        <Alert variant="error" className="mt-1 py-2 text-xs">
          {formatQueryError(verify.error, "Could not verify that email.")}
        </Alert>
      )}
      {verify.isSuccess && (
        <div className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-xs">
          <span className="truncate font-mono">{verify.data.email}</span>
          <Badge tone={verify.data.sendEligibility?.allowed ? "success" : "warning"}>
            {verify.data.sendEligibility?.decision ?? verify.data.verificationStatus?.status ?? "checked"}
          </Badge>
        </div>
      )}
      <Link
        href="/intelligence/email"
        className="block text-xs text-primary underline-offset-2 hover:underline"
      >
        More email intelligence tools →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

// 0 = welcome, 1-8 = questions, 9 = finish
const TOTAL_QUESTION_STEPS = 8;

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const icpApi = useIcpApi();
  const authReady = useAuthReady();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  const existingIcp = useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    enabled: authReady,
  });

  // Already finished: skip straight to the completion screen instead of restarting.
  useEffect(() => {
    if (hydrated || !existingIcp.isSuccess) return;
    setHydrated(true);
    if (isOnboardingComplete(existingIcp.data?.config)) {
      setStep(9);
    }
  }, [existingIcp.data?.config, existingIcp.isSuccess, hydrated]);

  const save = useMutation({
    mutationFn: () => icpApi.save(buildIcpConfig(state)),
    onSuccess: (data) => {
      queryClient.setQueryData(["icp"], data);
      queryClient.invalidateQueries({ queryKey: ["icp"] });
      setStep(9);
    },
  });

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const progress = useMemo(() => {
    if (step === 0) return 0;
    if (step >= 9) return 100;
    // Percent of steps already finished — step 1 starts at 0%, not ~13%.
    return Math.round(((step - 1) / TOTAL_QUESTION_STEPS) * 100);
  }, [step]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return Boolean(state.companyName.trim());
      case 2:
        return Boolean(state.companyIndustry && state.companySize);
      case 3:
        return state.goals.length > 0;
      case 4:
        return state.icpIndustries.length > 0;
      case 5:
        return state.seniorities.length > 0 || state.departments.length > 0 || state.titles.length > 0;
      case 6:
        return state.market.length > 0;
      case 8:
        return Boolean(state.leadVolume);
      default:
        return true;
    }
  }, [step, state]);

  const next = () => {
    if (step === 8) {
      save.mutate();
      return;
    }
    setStep((s) => Math.min(s + 1, 9));
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-2xl flex-col px-4 py-6 sm:py-10">
      {/* Progress bar */}
      {step > 0 && step < 9 && (
        <div className="mb-8 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Step {step} of {TOTAL_QUESTION_STEPS}
            </span>
            <span>{progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1">
        {/* ------------------------------------------------ Step 0: Welcome */}
        {step === 0 && (
          <div className="flex flex-col items-center gap-6 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg">
              <Sparkles className="h-10 w-10" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold sm:text-4xl">Welcome to Skout AI 👋</h1>
              <p className="mx-auto max-w-md text-base text-muted-foreground">
                Let&apos;s personalize your workspace in under 2 minutes. We&apos;ll recommend the
                best companies and contacts for your business.
              </p>
            </div>
            <Button size="lg" className="mt-2 px-8" onClick={() => setStep(1)}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">Takes about 2 minutes · You can edit everything later</p>
            <GdprBadge className="mt-4 h-11 w-auto" />
          </div>
        )}

        {/* ------------------------------------------ Step 1: About company */}
        {step === 1 && (
          <div className="space-y-6">
            <StepHeading
              icon={Building2}
              title="Tell us about your business"
              subtitle="Skout uses this to personalize AI recommendations and outreach."
            />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel>Company name</FieldLabel>
                <Input
                  placeholder="e.g. Acme Inc."
                  value={state.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel optional>Website</FieldLabel>
                <Input
                  placeholder="example.com"
                  value={state.website}
                  onChange={(e) => set("website", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Skout can enrich this automatically.</p>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------- Step 2: Company industry */}
        {step === 2 && (
          <div className="space-y-6">
            <StepHeading
              icon={Rocket}
              title="What describes your company?"
              subtitle="This is the most important question — it shapes your recommendations."
            />
            <div className="space-y-2">
              <FieldLabel>What does your company do? Choose one.</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {COMPANY_INDUSTRIES.map((ind) => (
                  <Chip
                    key={ind}
                    label={ind}
                    selected={state.companyIndustry === ind}
                    onClick={() => set("companyIndustry", state.companyIndustry === ind ? "" : ind)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel>Company size</FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COMPANY_SIZES.map((size) => (
                  <OptionCard
                    key={size}
                    label={size}
                    selected={state.companySize === size}
                    onClick={() => set("companySize", state.companySize === size ? "" : size)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------- Step 3: Goals */}
        {step === 3 && (
          <div className="space-y-6">
            <StepHeading
              icon={Target}
              title="What are you trying to achieve?"
              subtitle="Pick everything that applies — we'll tune your workspace for it."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {GOALS.map((goal) => (
                <OptionCard
                  key={goal}
                  label={goal}
                  selected={state.goals.includes(goal)}
                  onClick={() => set("goals", toggle(state.goals, goal))}
                />
              ))}
            </div>
          </div>
        )}

        {/* --------------------------------------------------- Step 4: ICP */}
        {step === 4 && (
          <div className="space-y-6">
            <StepHeading
              icon={Search}
              title="Who is your ideal customer?"
              subtitle="This builds your ICP — used for scoring, search defaults, and smart lists."
            />
            <div className="space-y-2">
              <FieldLabel>Industry</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {ICP_INDUSTRY_OPTIONS.map((ind) => (
                  <Chip
                    key={ind}
                    label={ind}
                    selected={state.icpIndustries.includes(ind)}
                    onClick={() => set("icpIndustries", toggle(state.icpIndustries, ind))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel>Company size</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {ICP_EMPLOYEE_RANGES.map((range) => (
                  <Chip
                    key={range}
                    label={range}
                    selected={state.icpEmployeeRanges.includes(range)}
                    onClick={() => set("icpEmployeeRanges", toggle(state.icpEmployeeRanges, range))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel>Geography</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {GEOGRAPHIES.map((geo) => (
                  <Chip
                    key={geo}
                    label={geo}
                    selected={state.geographies.includes(geo)}
                    onClick={() => set("geographies", toggle(state.geographies, geo))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel optional>Revenue</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {REVENUE_RANGES.map((rev) => (
                  <Chip
                    key={rev}
                    label={rev}
                    selected={state.revenue === rev}
                    onClick={() => set("revenue", state.revenue === rev ? "" : rev)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------ Step 5: People */}
        {step === 5 && (
          <div className="space-y-6">
            <StepHeading
              icon={Users}
              title="Who do you want to contact?"
              subtitle="Sets your people-search defaults — departments, seniority, and titles."
            />
            <div className="space-y-2">
              <FieldLabel>Departments</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENTS.map((dep) => (
                  <Chip
                    key={dep}
                    label={dep}
                    selected={state.departments.includes(dep)}
                    onClick={() => set("departments", toggle(state.departments, dep))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel>Seniority</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {SENIORITY_OPTIONS.map(({ id, label }) => (
                  <Chip
                    key={id}
                    label={label}
                    selected={state.seniorities.includes(id)}
                    onClick={() => set("seniorities", toggle(state.seniorities, id))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabel>Job titles</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set([...TITLE_SUGGESTIONS, ...state.customTitles])).map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={state.titles.includes(t)}
                    onClick={() => set("titles", toggle(state.titles, t))}
                  />
                ))}
              </div>
              <Input
                placeholder="Add custom title, press Enter"
                className="mt-1 max-w-md"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const raw = (e.target as HTMLInputElement).value.trim();
                  if (!raw) return;
                  setState((prev) => ({
                    ...prev,
                    customTitles: prev.customTitles.includes(raw)
                      ? prev.customTitles
                      : [...prev.customTitles, raw],
                    titles: prev.titles.includes(raw) ? prev.titles : [...prev.titles, raw],
                  }));
                  (e.target as HTMLInputElement).value = "";
                }}
              />
            </div>
          </div>
        )}

        {/* ------------------------------------------------ Step 6: Market */}
        {step === 6 && (
          <div className="space-y-6">
            <StepHeading
              icon={Globe}
              title="Where do you sell?"
              subtitle="Select every segment you target."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {MARKETS.map((m) => (
                <OptionCard
                  key={m}
                  label={m}
                  selected={state.market.includes(m)}
                  onClick={() => set("market", toggle(state.market, m))}
                />
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------- Step 7: Tools */}
        {step === 7 && (
          <div className="space-y-6">
            <StepHeading
              icon={Plug}
              title="Connect your tools"
              subtitle="Optional — pick your primary CRM or data tool. You can connect it later under Settings."
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TOOLS.map((tool) => (
                <OptionCard
                  key={tool}
                  label={tool}
                  selected={state.crm === tool}
                  onClick={() => set("crm", state.crm === tool ? "" : tool)}
                />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              HubSpot connects natively under Settings → CRM after onboarding.
            </p>
          </div>
        )}

        {/* ------------------------------------------- Step 8: Lead volume */}
        {step === 8 && (
          <div className="space-y-6">
            <StepHeading
              icon={Gauge}
              title="How many leads do you need?"
              subtitle="This helps allocate credits for search and enrichment."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {LEAD_VOLUMES.map((vol) => (
                <OptionCard
                  key={vol}
                  label={vol}
                  selected={state.leadVolume === vol}
                  onClick={() => set("leadVolume", state.leadVolume === vol ? "" : vol)}
                />
              ))}
            </div>
            {save.isError && (
              <p className="text-center text-sm text-destructive">
                Could not save your answers — please try again.
              </p>
            )}
          </div>
        )}

        {/* ------------------------------------------------ Step 9: Finish */}
        {step === 9 && (
          <div className="flex flex-col items-center gap-6 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow-lg">
              <PartyPopper className="h-10 w-10" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold">🎉 You&apos;re ready.</h1>
              <p className="mx-auto max-w-md text-base text-muted-foreground">
                Based on your answers we&apos;ve prepared your workspace — your ICP is configured
                and search defaults are set.
              </p>
            </div>
            <div className="grid w-full max-w-sm gap-2 text-left text-sm">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ICP profile saved{state.icpIndustries.length ? ` · ${state.icpIndustries.slice(0, 3).join(", ")}` : ""}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                People defaults set{state.titles.length ? ` · ${state.titles.slice(0, 3).join(", ")}` : ""}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                AI scoring &amp; outreach grounded in your business
              </div>
            </div>
            <VerifySendingEmailCard />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={() => router.push("/dashboard")}>
                Take me to my dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/prospects/search")}>
                <Search className="mr-2 h-4 w-4" />
                Find my first leads
              </Button>
            </div>
            <GdprBadge className="mt-2 h-11 w-auto" />
          </div>
        )}
      </div>

      {/* Navigation */}
      {step > 0 && step < 9 && (
        <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
          <Button
            variant="ghost"
            disabled={save.isPending}
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            {step === 7 && (
              <Button variant="ghost" onClick={next} disabled={save.isPending}>
                Skip
              </Button>
            )}
            <Button onClick={next} disabled={!canContinue || save.isPending} className="px-6">
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {step === 8 ? "Finish" : "Continue"}
              {step !== 8 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
      {step > 0 && step < 9 && (
        <div className="mt-6 flex justify-center">
          <GdprBadge className="h-9 w-auto opacity-90" />
        </div>
      )}
    </div>
  );
}
