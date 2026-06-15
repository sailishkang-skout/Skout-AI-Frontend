"use client";

import { cn } from "@/lib/utils";
import { ICP_COUNTRIES, ICP_INDUSTRIES, ICP_SENIORITIES } from "@/lib/icp";
import type { IcpConfig } from "@/types/api";
import { Input } from "@/components/ui/input";

interface IcpFormProps {
  value: IcpConfig;
  onChange: (next: IcpConfig) => void;
  /** When set, only show fields for this wizard step (1–3). Omit for full form. */
  step?: 1 | 2 | 3;
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
    </div>
  );
}

export const EMPTY_ICP: IcpConfig = {
  industries: [],
  countries: [],
  seniorities: [],
};

export function icpIsEmpty(config: IcpConfig): boolean {
  return (
    !(config.industries?.length ?? 0) &&
    !(config.countries?.length ?? 0) &&
    !(config.seniorities?.length ?? 0) &&
    config.minEmployees == null &&
    config.maxEmployees == null
  );
}
