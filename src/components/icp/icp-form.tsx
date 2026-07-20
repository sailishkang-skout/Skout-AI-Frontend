"use client";

import { cn } from "@/lib/utils";
import {
  ICP_COUNTRIES,
  ICP_INDUSTRIES,
  ICP_KEYWORDS,
  ICP_PAIN_POINTS,
  ICP_SENIORITIES,
  ICP_TITLES,
} from "@/lib/icp";
import type { IcpConfig } from "@/types/api";
import { Input } from "@/components/ui/input";

interface IcpFormProps {
  value: IcpConfig;
  onChange: (next: IcpConfig) => void;
  /** When set, only show fields for this wizard step (1–5). Omit for full form. */
  step?: 1 | 2 | 3 | 4 | 5;
}

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
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}

function toggle(arr: string[] | undefined, item: string): string[] {
  const set = new Set(arr ?? []);
  if (set.has(item)) set.delete(item);
  else set.add(item);
  return Array.from(set);
}

export function IcpForm({ value, onChange, step }: IcpFormProps) {
  const showIndustries = !step || step === 1;
  const showGeoSeniority = !step || step === 2;
  const showSize = !step || step === 3;
  const showCustomer = !step || step === 4;
  const showCompany = !step || step === 5;

  return (
    <div className="space-y-6">
      {showIndustries && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Target industries</p>
          <p className="text-xs text-muted-foreground">Used for AI ICP scoring and search defaults.</p>
          <div className="flex flex-wrap gap-2">
            {ICP_INDUSTRIES.map((ind) => (
              <Chip
                key={ind}
                label={ind}
                selected={(value.industries ?? []).includes(ind)}
                onClick={() => onChange({ ...value, industries: toggle(value.industries, ind) })}
              />
            ))}
          </div>
        </div>
      )}

      {showGeoSeniority && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Countries</p>
            <div className="flex flex-wrap gap-2">
              {ICP_COUNTRIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={(value.countries ?? []).includes(c)}
                  onClick={() => onChange({ ...value, countries: toggle(value.countries, c) })}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Seniority levels</p>
            <div className="flex flex-wrap gap-2">
              {ICP_SENIORITIES.map(({ id, label }) => (
                <Chip
                  key={id}
                  label={label}
                  selected={(value.seniorities ?? []).includes(id)}
                  onClick={() => onChange({ ...value, seniorities: toggle(value.seniorities, id) })}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {showSize && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Company size (employees)</p>
          <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Min</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 50"
                value={value.minEmployees ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    minEmployees: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Max</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 5000"
                value={value.maxEmployees ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    maxEmployees: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {showCustomer && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Ideal customer job titles</p>
            <p className="text-xs text-muted-foreground">
              Who do you sell to? Used for ICP title matching and search defaults.
            </p>
            <div className="flex flex-wrap gap-2">
              {ICP_TITLES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected={(value.titles ?? []).includes(t)}
                  onClick={() => onChange({ ...value, titles: toggle(value.titles, t) })}
                />
              ))}
            </div>
            <Input
              placeholder="Add custom title, press Enter"
              className="mt-2 max-w-md"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const raw = (e.target as HTMLInputElement).value.trim();
                if (!raw) return;
                onChange({ ...value, titles: toggle(value.titles, raw) });
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Buyer keywords / signals</p>
            <p className="text-xs text-muted-foreground">
              Words that signal a good-fit lead (appears in title, role, or company context).
            </p>
            <div className="flex flex-wrap gap-2">
              {ICP_KEYWORDS.map((kw) => (
                <Chip
                  key={kw}
                  label={kw}
                  selected={(value.keywords ?? []).includes(kw)}
                  onClick={() => onChange({ ...value, keywords: toggle(value.keywords, kw) })}
                />
              ))}
            </div>
            <Input
              placeholder="Add custom keyword, press Enter"
              className="mt-2 max-w-md"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const raw = (e.target as HTMLInputElement).value.trim();
                if (!raw) return;
                onChange({ ...value, keywords: toggle(value.keywords, raw) });
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </div>
        </>
      )}

      {showCompany && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Your company name</p>
            <p className="text-xs text-muted-foreground">Helps AI personalize scoring and outreach.</p>
            <Input
              placeholder="e.g. Acme Sales"
              className="max-w-md"
              value={value.companyName ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  companyName: e.target.value.trim() ? e.target.value : undefined,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">What do you sell?</p>
            <p className="text-xs text-muted-foreground">
              Short product / value proposition — used in ICP scoring and AI emails.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. AI-powered outbound platform that finds, enriches, and sequences B2B leads"
              className="w-full max-w-xl resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              value={value.productDescription ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  productDescription: e.target.value.trim() ? e.target.value : undefined,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Customer pains you solve</p>
            <p className="text-xs text-muted-foreground">
              Select pains your ideal buyer feels — used for scoring and messaging.
            </p>
            <div className="flex flex-wrap gap-2">
              {ICP_PAIN_POINTS.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  selected={(value.customerPainPoints ?? []).includes(p)}
                  onClick={() =>
                    onChange({
                      ...value,
                      customerPainPoints: toggle(value.customerPainPoints, p),
                    })
                  }
                />
              ))}
            </div>
            <Input
              placeholder="Add custom pain, press Enter"
              className="mt-2 max-w-md"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const raw = (e.target as HTMLInputElement).value.trim();
                if (!raw) return;
                onChange({
                  ...value,
                  customerPainPoints: toggle(value.customerPainPoints, raw),
                });
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </div>
        </>
      )}

      {!step && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={value.autoRescoreOnChange !== false}
              onChange={(e) =>
                onChange({ ...value, autoRescoreOnChange: e.target.checked ? undefined : false })
              }
            />
            <span>
              <span className="text-sm font-medium">Re-score stored prospects when ICP changes</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Runs a credit-aware batch job after save. Updates ICP scores in your workspace and
                OpenSearch corpus.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

export const EMPTY_ICP: IcpConfig = {
  industries: [],
  countries: [],
  seniorities: [],
  titles: [],
  keywords: [],
  customerPainPoints: [],
};

export function icpIsEmpty(config: IcpConfig): boolean {
  return (
    !(config.industries?.length ?? 0) &&
    !(config.countries?.length ?? 0) &&
    !(config.seniorities?.length ?? 0) &&
    !(config.titles?.length ?? 0) &&
    !(config.keywords?.length ?? 0) &&
    !(config.customerPainPoints?.length ?? 0) &&
    !config.companyName &&
    !config.productDescription &&
    config.minEmployees == null &&
    config.maxEmployees == null
  );
}
