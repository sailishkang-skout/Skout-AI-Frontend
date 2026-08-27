"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady, CLERK_ENABLED, ApiError } from "@/lib/api-client";
import { useNumbersApi, type AvailableNumber, type NumberRequest } from "@/lib/numbers";
import { phoneAreaCodesFor, phoneCitiesFor, usesLocalGeo } from "@/lib/phone-geo";
import { COUNTRIES } from "@/lib/search-constants";

const REQUESTS_KEY = ["numbers", "requests"] as const;

function resolveCountryCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const byLabel = COUNTRIES.find((c) => c.label.toLowerCase() === trimmed.toLowerCase());
  return byLabel?.value ?? trimmed.toUpperCase();
}

function SuggestField({
  label,
  value,
  onChange,
  options,
  placeholder,
  testId,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  testId: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (row) => row.value.toLowerCase().includes(q) || row.label.toLowerCase().includes(q)
    );
  }, [options, value]);

  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="relative" ref={wrapperRef}>
        <Input
          data-testid={testId}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-input bg-popover text-popover-foreground shadow-lg">
            {filtered.map((row) => (
              <button
                key={`${row.value}-${row.label}`}
                type="button"
                onClick={() => {
                  onChange(row.value);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="truncate font-medium">{row.value}</span>
                {row.label !== row.value && (
                  <span className="truncate text-xs text-muted-foreground">{row.label}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function requestTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "failed" || status === "cancelled" || status === "expired") return "danger" as const;
  if (status === "requirements_pending" || status === "compliance_review") return "warning" as const;
  return statusTone(status);
}

export default function NumbersMarketplacePage() {
  const authReady = useAuthReady();
  const canFetch = CLERK_ENABLED ? authReady : true;
  const api = useNumbersApi();
  const queryClient = useQueryClient();
  const requestsCardRef = useRef<HTMLDivElement>(null);

  const [country, setCountry] = useState("US");
  const [numberType, setNumberType] = useState("local");
  const [areaCode, setAreaCode] = useState("");
  const [city, setCity] = useState("");
  const [features, setFeatures] = useState("voice,sms");
  const [complianceNotes, setComplianceNotes] = useState<Record<string, string>>({});

  const countryCode = resolveCountryCode(country);
  const areaOptions = phoneAreaCodesFor(countryCode, numberType);
  const cityOptions = phoneCitiesFor(countryCode, areaCode, numberType);

  function onCountryChange(next: string) {
    const previous = resolveCountryCode(country);
    setCountry(next);
    const nextCode = resolveCountryCode(next);
    if (nextCode.length === 2 && nextCode !== previous) {
      setAreaCode("");
      setCity("");
    }
  }

  function onNumberTypeChange(next: string) {
    setNumberType(next);
    setAreaCode("");
    setCity("");
  }

  function onAreaCodeChange(next: string) {
    setAreaCode(next);
  }

  function onCityChange(next: string) {
    setCity(next);
    const match = cityOptions.find((c) => c.name.toLowerCase() === next.trim().toLowerCase());
    if (match && match.areaCodes.length === 1 && !areaCode.trim()) {
      setAreaCode(match.areaCodes[0]!);
    }
  }

  const config = useQuery({
    queryKey: ["numbers", "config"],
    queryFn: api.getConfig,
    enabled: canFetch,
  });

  const requests = useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: api.listRequests,
    enabled: canFetch,
  });

  const search = useMutation({
    mutationFn: () =>
      api.search({
        country: countryCode,
        numberType,
        areaCode: areaCode.trim() || undefined,
        city: city.trim() || undefined,
        features: features.trim() || undefined,
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });

  const create = useMutation({
    mutationFn: (phoneNumber: string) =>
      api.createRequest({
        country: countryCode,
        city: city.trim() || undefined,
        areaCode: areaCode.trim() || undefined,
        numberType,
        requestedCapabilities: features
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        phoneNumber,
        idempotencyKey: `select:${phoneNumber}`,
      }),
    onSuccess: () => {
      invalidate();
      requestsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });

  const order = useMutation({
    mutationFn: api.order,
    onSuccess: invalidate,
  });
  const refresh = useMutation({
    mutationFn: api.refresh,
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: api.cancel,
    onSuccess: invalidate,
  });
  const upload = useMutation({
    mutationFn: ({
      id,
      filename,
      contentBase64,
    }: {
      id: string;
      filename: string;
      contentBase64: string;
    }) => api.uploadDocument(id, { filename, contentBase64 }),
    onSuccess: invalidate,
  });
  const compliance = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.submitCompliance(id, notes.trim() ? [{ note: notes.trim(), submittedAt: new Date().toISOString() }] : []),
    onSuccess: invalidate,
  });

  const enabled = config.data?.marketplaceEnabled === true;
  const results: AvailableNumber[] = search.data?.data ?? [];
  const rows: NumberRequest[] = requests.data?.data ?? [];
  const actionError =
    config.error ??
    search.error ??
    create.error ??
    order.error ??
    refresh.error ??
    cancel.error ??
    compliance.error ??
    upload.error;
  const hideAuthNoise =
    actionError instanceof ApiError && actionError.status === 401 && (!CLERK_ENABLED || !authReady);

  const pendingIds = useMemo(
    () =>
      new Set(
        [
          create.isPending ? "create" : null,
          order.variables,
          refresh.variables,
          cancel.variables,
          compliance.variables?.id,
        ].filter(Boolean)
      ),
    [create.isPending, order.variables, refresh.variables, cancel.variables, compliance.variables]
  );

  return (
    <PageShell data-testid="page-phone-numbers">
      <PageHeader
        title="Phone numbers"
        description="Search Telnyx inventory, upload regulatory documents, and order a number. Active numbers become this workspace's click-to-call caller ID."
        actions={
          <Link
            href="/settings/calling"
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
          >
            Calling settings
          </Link>
        }
      />

      {actionError && !hideAuthNoise && (
        <Alert variant="error">{formatQueryError(actionError, "Number marketplace request failed.")}</Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Search available numbers</CardTitle>
          {config.isSuccess && (
            <Badge tone={enabled ? "success" : "muted"}>{enabled ? "Telnyx connected" : "Telnyx not configured"}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SuggestField
              label="Country"
              testId="numbers-country"
              value={country}
              onChange={onCountryChange}
              placeholder="Pick or type ISO-2, e.g. US"
              hint="List is a shortcut — type any ISO-2 code."
              options={COUNTRIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Type</span>
              <Select value={numberType} onChange={(e) => onNumberTypeChange(e.target.value)}>
                <option value="local">Local</option>
                <option value="mobile">Mobile</option>
                <option value="national">National</option>
                <option value="toll_free">Toll-free</option>
              </Select>
            </label>
            <SuggestField
              label="Area code"
              testId="numbers-area-code"
              value={areaCode}
              onChange={onAreaCodeChange}
              placeholder="Pick or type, e.g. 415"
              hint="Leave blank for any, or type a code that is not listed."
              options={areaOptions.map((row) => ({ value: row.code, label: row.label }))}
            />
            <SuggestField
              label="City"
              testId="numbers-city"
              value={city}
              onChange={onCityChange}
              placeholder="Pick or type a city"
              hint={usesLocalGeo(numberType) ? "Leave blank for any city." : "Optional for this number type."}
              options={cityOptions.map((row) => ({ value: row.name, label: row.name }))}
            />
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Capabilities</span>
              <Select value={features} onChange={(e) => setFeatures(e.target.value)}>
                <option value="voice,sms">Voice + SMS</option>
                <option value="voice">Voice</option>
                <option value="sms">SMS</option>
              </Select>
            </label>
          </div>
          <Button
            data-testid="search-numbers-button"
            disabled={search.isPending || countryCode.length !== 2}
            onClick={() => search.mutate()}
          >
            {search.isPending ? "Searching…" : "Search Telnyx"}
          </Button>
          {results.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Number</th>
                    <th className="px-3 py-2 font-medium">Location</th>
                    <th className="px-3 py-2 font-medium">Features</th>
                    <th className="px-3 py-2 font-medium">Monthly</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.phoneNumber} className="border-t">
                      <td className="px-3 py-2 font-mono">{row.phoneNumber}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {[row.locality, row.administrativeArea].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2">{row.features.join(", ") || "—"}</td>
                      <td className="px-3 py-2">
                        {row.monthlyCost ? `${row.monthlyCost} ${row.currency ?? ""}`.trim() : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          data-testid="request-number-button"
                          disabled={create.isPending}
                          onClick={() => create.mutate(row.phoneNumber)}
                        >
                          {create.isPending && create.variables === row.phoneNumber ? "Requesting…" : "Request"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {create.isError && !hideAuthNoise && (
            <Alert variant="error">{formatQueryError(create.error, "Number request failed.")}</Alert>
          )}
          {search.isSuccess && results.length === 0 && (
            <p className="text-sm text-muted-foreground">No numbers matched. Try another city or area code.</p>
          )}
        </CardContent>
      </Card>

      <Card ref={requestsCardRef}>
        <CardHeader>
          <CardTitle className="text-base">Workspace requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No number requests yet.</p>
          )}
          {rows.map((row) => (
            <div key={row.id} className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{row.phoneNumber ?? "(no number selected)"}</span>
                    <Badge tone={requestTone(row.status)}>{row.status}</Badge>
                    <Badge tone="muted">{row.country}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.numberType}
                    {row.areaCode ? ` · ${row.areaCode}` : ""}
                    {row.failureReason ? ` · ${row.failureReason}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status === "requirements_pending" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pendingIds.has(row.id)}
                      onClick={() =>
                        compliance.mutate({ id: row.id, notes: complianceNotes[row.id] ?? "" })
                      }
                    >
                      Submit compliance
                    </Button>
                  )}
                  {(row.status === "selected" || row.status === "compliance_review") && (
                    <Button size="sm" disabled={pendingIds.has(row.id)} onClick={() => order.mutate(row.id)}>
                      Order
                    </Button>
                  )}
                  {row.providerOrderId && row.status === "provisioning" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingIds.has(row.id)}
                      onClick={() => refresh.mutate(row.id)}
                    >
                      Refresh
                    </Button>
                  )}
                  {!["active", "failed", "expired", "cancelled"].includes(row.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingIds.has(row.id)}
                      onClick={() => cancel.mutate(row.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
              {row.status === "requirements_pending" && (
                <div className="space-y-2">
                  <Input
                    value={complianceNotes[row.id] ?? ""}
                    onChange={(e) => setComplianceNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder="Optional note, or Telnyx document IDs already uploaded"
                  />
                  <label className="block text-xs text-muted-foreground">
                    Upload a KYC file (PDF/JPEG, max 8MB)
                    <input
                      className="mt-1 block w-full text-sm"
                      type="file"
                      data-testid="number-document-upload"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        const buffer = await file.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        let binary = "";
                        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
                        await upload.mutateAsync({
                          id: row.id,
                          filename: file.name,
                          contentBase64: btoa(binary),
                        });
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
