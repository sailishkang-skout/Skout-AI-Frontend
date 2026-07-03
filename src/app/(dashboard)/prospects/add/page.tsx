"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, UserPlus, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiFetch } from "@/lib/api-client";
import {
  COMPANY_SIZE_BUCKETS,
  COMPANY_STAGE_OPTIONS,
  COUNTRIES,
  DEPARTMENT_OPTIONS,
  HIRING_DEPARTMENTS,
  INDUSTRIES,
  JOB_FUNCTION_OPTIONS,
  LAST_FUNDING_ROUND_OPTIONS,
  REVENUE_RANGES,
  SENIORITY_OPTIONS,
} from "@/lib/search-constants";
import type { ManualProspectInput, ManualProspectResponse } from "@/types/api";

const TECH_CRM_OPTIONS = ["HubSpot", "Salesforce", "Pipedrive", "Zoho", "Close", "Copper", "Other"];

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  );
}

function SelectField({
  label,
  required,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { label: string; value: string }[];
}) {
  return (
    <Field label={label} required={required}>
      <select
        className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CheckboxGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={value.includes(opt)}
              onChange={() => toggle(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

type ContactForm = {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  department: string;
  seniority: string;
  jobFunction: string;
  yearsAtCompany: string;
  yearsInRole: string;
  previousCompany: string;
};

type CompanyForm = {
  companyName: string;
  companyDomain: string;
  industry: string;
  subIndustry: string;
  companyDescription: string;
  keywords: string;
  country: string;
  state: string;
  city: string;
  companySize: string;
  employeeCount: string;
  companyStage: string;
};

type FundingForm = {
  annualRevenue: string;
  revenueRange: string;
  totalFundingRaised: string;
  lastFundingDate: string;
  lastFundingRound: string;
  investors: string;
};

type HiringForm = {
  currentlyHiring: boolean;
  openJobCount: string;
  hiringDepartments: string[];
  crmUsed: string;
  techStackKeywords: string;
};

const EMPTY_CONTACT: ContactForm = {
  fullName: "", jobTitle: "", email: "", phone: "", linkedinUrl: "",
  department: "", seniority: "", jobFunction: "", yearsAtCompany: "", yearsInRole: "", previousCompany: "",
};

const EMPTY_COMPANY: CompanyForm = {
  companyName: "", companyDomain: "", industry: "", subIndustry: "", companyDescription: "",
  keywords: "", country: "", state: "", city: "", companySize: "", employeeCount: "", companyStage: "",
};

const EMPTY_FUNDING: FundingForm = {
  annualRevenue: "", revenueRange: "", totalFundingRaised: "", lastFundingDate: "", lastFundingRound: "", investors: "",
};

const EMPTY_HIRING: HiringForm = {
  currentlyHiring: false, openJobCount: "", hiringDepartments: [], crmUsed: "", techStackKeywords: "",
};

function buildPayload(
  contact: ContactForm,
  company: CompanyForm,
  funding: FundingForm,
  hiring: HiringForm
): ManualProspectInput {
  const trim = (s: string) => s.trim() || undefined;
  const num = (s: string) => (s.trim() ? Number(s) : undefined);
  const tags = (s: string) =>
    s.trim() ? s.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

  return {
    fullName: contact.fullName.trim(),
    jobTitle: trim(contact.jobTitle),
    email: trim(contact.email),
    phone: trim(contact.phone),
    linkedinUrl: trim(contact.linkedinUrl),
    department: trim(contact.department),
    seniority: trim(contact.seniority),
    jobFunction: trim(contact.jobFunction),
    yearsAtCompany: num(contact.yearsAtCompany),
    yearsInRole: num(contact.yearsInRole),
    previousCompany: trim(contact.previousCompany),
    companyName: trim(company.companyName),
    companyDomain: trim(company.companyDomain),
    industry: trim(company.industry),
    subIndustry: trim(company.subIndustry),
    companyDescription: trim(company.companyDescription),
    keywords: tags(company.keywords),
    country: trim(company.country),
    state: trim(company.state),
    city: trim(company.city),
    companySize: trim(company.companySize),
    employeeCount: num(company.employeeCount),
    companyStage: trim(company.companyStage),
    annualRevenue: trim(funding.annualRevenue),
    revenueRange: trim(funding.revenueRange),
    totalFundingRaised: trim(funding.totalFundingRaised),
    lastFundingDate: trim(funding.lastFundingDate),
    lastFundingRound: trim(funding.lastFundingRound),
    investors: tags(funding.investors),
    currentlyHiring: hiring.currentlyHiring || undefined,
    openJobCount: num(hiring.openJobCount),
    hiringDepartments: hiring.hiringDepartments.length ? hiring.hiringDepartments : undefined,
    crmUsed: trim(hiring.crmUsed),
    techStackKeywords: tags(hiring.techStackKeywords),
  };
}

export default function AddProspectPage() {
  const api = useApiFetch();
  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT);
  const [company, setCompany] = useState<CompanyForm>(EMPTY_COMPANY);
  const [funding, setFunding] = useState<FundingForm>(EMPTY_FUNDING);
  const [hiring, setHiring] = useState<HiringForm>(EMPTY_HIRING);
  const [saved, setSaved] = useState<ManualProspectResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const setC = <K extends keyof ContactForm>(k: K, v: ContactForm[K]) =>
    setContact((p) => ({ ...p, [k]: v }));
  const setCo = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) =>
    setCompany((p) => ({ ...p, [k]: v }));
  const setF = <K extends keyof FundingForm>(k: K, v: FundingForm[K]) =>
    setFunding((p) => ({ ...p, [k]: v }));
  const setH = <K extends keyof HiringForm>(k: K, v: HiringForm[K]) =>
    setHiring((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      api<ManualProspectResponse>("/api/v1/prospects/manual", {
        method: "POST",
        body: JSON.stringify(buildPayload(contact, company, funding, hiring)),
      }),
    onSuccess: (data) => {
      setSaved(data);
      setFormError(null);
    },
    onError: () => {
      setFormError("Something went wrong. Please check your details and try again.");
    },
  });

  const canSave =
    contact.fullName.trim().length > 0 &&
    company.companyDomain.trim().length > 0 &&
    !save.isPending;

  if (saved) {
    return (
      <PageShell width="narrow">
        <PageHeader
          title="Prospect saved"
          description="The prospect has been added to your workspace."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-semibold">{contact.fullName}</p>
              {saved.jobId && (
                <p className="text-sm text-muted-foreground">
                  Enrichment {saved.jobStatus ?? "started"} · job {saved.jobId.slice(0, 8)}…
                  {saved.creditsUsed != null ? ` · ${saved.creditsUsed} credits` : ""}
                </p>
              )}
              {contact.email && (
                <p className="text-sm text-muted-foreground">{contact.email}</p>
              )}
              {company.companyName && (
                <p className="text-sm text-muted-foreground">{company.companyName}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/enrichment`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Zap className="h-4 w-4" />
                Enrich this prospect
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setSaved(null);
                  setContact(EMPTY_CONTACT);
                  setCompany(EMPTY_COMPANY);
                  setFunding(EMPTY_FUNDING);
                  setHiring(EMPTY_HIRING);
                }}
              >
                <UserPlus className="h-4 w-4" />
                Add another
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Add prospect"
        description="Manually add a prospect and their company details when they&apos;re not in the search corpus."
      />

      {formError && (
        <Alert variant="error">{formError}</Alert>
      )}

      {/* ── Contact Information ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Contact information</CardTitle>
          <CardDescription>Who is this person?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Full name" required>
              <Input
                placeholder="e.g. Jane Smith"
                value={contact.fullName}
                onChange={(e) => setC("fullName", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Job title">
            <Input
              placeholder="e.g. VP of Sales"
              value={contact.jobTitle}
              onChange={(e) => setC("jobTitle", e.target.value)}
            />
          </Field>

          <SelectField
            label="Seniority"
            value={contact.seniority}
            onChange={(v) => setC("seniority", v)}
            placeholder="Select seniority…"
            options={SENIORITY_OPTIONS}
          />

          <SelectField
            label="Department"
            value={contact.department}
            onChange={(v) => setC("department", v)}
            placeholder="Select department…"
            options={DEPARTMENT_OPTIONS.map((d) => ({ label: d, value: d }))}
          />

          <SelectField
            label="Job function"
            value={contact.jobFunction}
            onChange={(v) => setC("jobFunction", v)}
            placeholder="Select function…"
            options={JOB_FUNCTION_OPTIONS.map((f) => ({ label: f, value: f }))}
          />

          <Field label="Email">
            <Input
              type="email"
              placeholder="jane@company.com"
              value={contact.email}
              onChange={(e) => setC("email", e.target.value)}
            />
          </Field>

          <Field label="Phone">
            <Input
              type="tel"
              placeholder="+1 555 000 0000"
              value={contact.phone}
              onChange={(e) => setC("phone", e.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="LinkedIn URL">
              <Input
                type="url"
                placeholder="https://linkedin.com/in/janesmith"
                value={contact.linkedinUrl}
                onChange={(e) => setC("linkedinUrl", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Years at company">
            <Input
              type="number"
              min={0}
              placeholder="e.g. 3"
              value={contact.yearsAtCompany}
              onChange={(e) => setC("yearsAtCompany", e.target.value)}
            />
          </Field>

          <Field label="Years in role">
            <Input
              type="number"
              min={0}
              placeholder="e.g. 1"
              value={contact.yearsInRole}
              onChange={(e) => setC("yearsInRole", e.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Previous company">
              <Input
                placeholder="e.g. Salesforce"
                value={contact.previousCompany}
                onChange={(e) => setC("previousCompany", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Company Information ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Company information</CardTitle>
          <CardDescription>Where do they work?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input
              placeholder="e.g. Acme Corp"
              value={company.companyName}
              onChange={(e) => setCo("companyName", e.target.value)}
            />
          </Field>

          <Field label="Website / domain" required>
            <Input
              placeholder="e.g. acme.com"
              value={company.companyDomain}
              onChange={(e) => setCo("companyDomain", e.target.value)}
            />
          </Field>

          <SelectField
            label="Industry"
            value={company.industry}
            onChange={(v) => setCo("industry", v)}
            placeholder="Select industry…"
            options={INDUSTRIES.map((i) => ({ label: i, value: i }))}
          />

          <Field label="Sub-industry">
            <Input
              placeholder="e.g. CRM Software"
              value={company.subIndustry}
              onChange={(e) => setCo("subIndustry", e.target.value)}
            />
          </Field>

          <SelectField
            label="Country"
            value={company.country}
            onChange={(v) => setCo("country", v)}
            placeholder="Select country…"
            options={COUNTRIES}
          />

          <Field label="State / Province">
            <Input
              placeholder="e.g. California"
              value={company.state}
              onChange={(e) => setCo("state", e.target.value)}
            />
          </Field>

          <Field label="City">
            <Input
              placeholder="e.g. San Francisco"
              value={company.city}
              onChange={(e) => setCo("city", e.target.value)}
            />
          </Field>

          <SelectField
            label="Company size"
            value={company.companySize}
            onChange={(v) => setCo("companySize", v)}
            placeholder="Select size…"
            options={COMPANY_SIZE_BUCKETS.map((b) => ({ label: b.label, value: b.value }))}
          />

          <Field label="Employee count">
            <Input
              type="number"
              min={1}
              placeholder="e.g. 250"
              value={company.employeeCount}
              onChange={(e) => setCo("employeeCount", e.target.value)}
            />
          </Field>

          <SelectField
            label="Company stage"
            value={company.companyStage}
            onChange={(v) => setCo("companyStage", v)}
            placeholder="Select stage…"
            options={COMPANY_STAGE_OPTIONS}
          />

          <div className="sm:col-span-2">
            <Field label="Keywords">
              <Input
                placeholder="Comma-separated, e.g. AI, B2B, SaaS"
                value={company.keywords}
                onChange={(e) => setCo("keywords", e.target.value)}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Company description">
              <textarea
                rows={3}
                placeholder="Brief description of what the company does…"
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={company.companyDescription}
                onChange={(e) => setCo("companyDescription", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Revenue & Funding ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Revenue &amp; funding</CardTitle>
          <CardDescription>Financial details (all optional).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Annual revenue">
            <Input
              placeholder="e.g. $5M"
              value={funding.annualRevenue}
              onChange={(e) => setF("annualRevenue", e.target.value)}
            />
          </Field>

          <SelectField
            label="Revenue range"
            value={funding.revenueRange}
            onChange={(v) => setF("revenueRange", v)}
            placeholder="Select range…"
            options={REVENUE_RANGES.map((r) => ({ label: r.label, value: r.value }))}
          />

          <Field label="Total funding raised">
            <Input
              placeholder="e.g. $20M"
              value={funding.totalFundingRaised}
              onChange={(e) => setF("totalFundingRaised", e.target.value)}
            />
          </Field>

          <SelectField
            label="Last funding round"
            value={funding.lastFundingRound}
            onChange={(v) => setF("lastFundingRound", v)}
            placeholder="Select round…"
            options={LAST_FUNDING_ROUND_OPTIONS}
          />

          <Field label="Last funding date">
            <Input
              type="date"
              value={funding.lastFundingDate}
              onChange={(e) => setF("lastFundingDate", e.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Investors">
              <Input
                placeholder="Comma-separated, e.g. Sequoia, a16z"
                value={funding.investors}
                onChange={(e) => setF("investors", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Hiring & Technology ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Hiring &amp; technology</CardTitle>
          <CardDescription>Hiring signals and tech stack (all optional).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <input
              id="currently-hiring"
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={hiring.currentlyHiring}
              onChange={(e) => setH("currentlyHiring", e.target.checked)}
            />
            <label htmlFor="currently-hiring" className="text-sm font-medium">
              Currently hiring
            </label>
          </div>

          {hiring.currentlyHiring && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Open job count">
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 12"
                  value={hiring.openJobCount}
                  onChange={(e) => setH("openJobCount", e.target.value)}
                />
              </Field>
            </div>
          )}

          <CheckboxGroup
            label="Hiring departments"
            options={HIRING_DEPARTMENTS}
            value={hiring.hiringDepartments}
            onChange={(v) => setH("hiringDepartments", v)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CRM used">
              <select
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={hiring.crmUsed}
                onChange={(e) => setH("crmUsed", e.target.value)}
              >
                <option value="">Select CRM…</option>
                {TECH_CRM_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>

            <Field label="Tech stack keywords">
              <Input
                placeholder="Comma-separated, e.g. AWS, React, Stripe"
                value={hiring.techStackKeywords}
                onChange={(e) => setH("techStackKeywords", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Save ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-muted-foreground">
          Only <span className="font-medium">Full name</span> is required. All other fields are optional.
        </p>
        <Button
          onClick={() => save.mutate()}
          disabled={!canSave}
          className="w-full sm:w-auto"
          size="lg"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Save prospect
        </Button>
      </div>
    </PageShell>
  );
}
