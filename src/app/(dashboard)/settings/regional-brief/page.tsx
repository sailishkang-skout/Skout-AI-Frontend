"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Globe,
  HelpCircle,
  Layers,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError } from "@/lib/api-client";
import { CountryCombobox, IndustryCombobox } from "@/components/tam/country-combobox";
import {
  useRegionalBriefApi,
  type CountryItem,
  type CreateSlotInput,
  type CreateVersionInput,
  type RegionalBriefFieldCategory,
  type RegionalBriefLayerType,
  type RegionalBriefSlot,
  type RegionalBriefVersionStatus,
} from "@/lib/regional-brief";

const STATUS_TONE: Record<RegionalBriefVersionStatus, "success" | "warning" | "muted" | "danger"> = {
  approved: "success",
  pending_review: "warning",
  draft: "muted",
  rejected: "danger",
  superseded: "muted",
};

const GLOBAL_LAYERS: RegionalBriefLayerType[] = ["global", "region", "country", "industry"];

const STATUS_FILTERS: { label: string; value: RegionalBriefVersionStatus | "all" }[] = [
  { label: "All statuses", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending review", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Superseded", value: "superseded" },
];

const LAYER_ORDER: RegionalBriefLayerType[] = [
  "global",
  "region",
  "country",
  "industry",
  "tenant",
  "outcome_learning",
];

const FIELD_CATEGORIES: { label: string; value: RegionalBriefFieldCategory }[] = [
  { label: "Market Economics", value: "market_economics" },
  { label: "Business Practice & Etiquette", value: "business_practice" },
  { label: "Channel & Outreach Policy", value: "channel_policy" },
  { label: "Telecom & Calling Requirements", value: "telecom_requirements" },
  { label: "Data Compliance & Privacy (GDPR/CCPA)", value: "data_compliance" },
  { label: "Explainability & AI Policy", value: "explainability" },
];

const ALL_NAICS_SECTORS = [
  { code: "11", title: "Agriculture, Forestry, Fishing & Hunting", category: "Primary & Resources" },
  { code: "21", title: "Mining, Quarrying, Oil & Gas Extraction", category: "Primary & Resources" },
  { code: "22", title: "Utilities (Electric, Gas, Water)", category: "Infrastructure" },
  { code: "23", title: "Construction & Contracting", category: "Real Estate & Build" },
  { code: "31", title: "Manufacturing & Industrial", category: "Industrial" },
  { code: "42", title: "Wholesale Trade & Distribution", category: "Commerce" },
  { code: "44", title: "Retail Trade & E-Commerce", category: "Commerce" },
  { code: "48", title: "Transportation & Warehousing / Logistics", category: "Logistics" },
  { code: "51", title: "Information (SaaS, Tech, Telecom, Media)", category: "Technology" },
  { code: "52", title: "Finance & Insurance (Banking, Fintech)", category: "Financial" },
  { code: "53", title: "Real Estate & Rental and Leasing", category: "Real Estate & Build" },
  { code: "54", title: "Professional, Scientific & Technical Services", category: "Services" },
  { code: "55", title: "Management of Companies & Enterprises", category: "Corporate" },
  { code: "56", title: "Administrative & Support / Waste Management", category: "Services" },
  { code: "61", title: "Educational Services & EdTech", category: "Education" },
  { code: "62", title: "Health Care & Social Assistance / HealthTech", category: "Healthcare" },
  { code: "71", title: "Arts, Entertainment & Recreation", category: "Consumer & Media" },
  { code: "72", title: "Accommodation & Food Services / Hospitality", category: "Hospitality" },
  { code: "81", title: "Other Services (Repair, Personal, Civic)", category: "Services" },
  { code: "92", title: "Public Administration (Government & Defense)", category: "Public Sector" },
];

function slotScopeLabel(slot: RegionalBriefSlot): string {
  return slot.countryId ?? slot.regionId ?? slot.industry ?? slot.workspaceId ?? "—";
}

// ── Multi-Currency Support ──
interface CurrencyDef {
  code: string;
  symbol: string;
  name: string;
  rateToUsd: number;
}

const CURRENCIES: Record<string, CurrencyDef> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", rateToUsd: 1.0 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", rateToUsd: 0.92 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", rateToUsd: 0.79 },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", rateToUsd: 155.2 },
  CAD: { code: "CAD", symbol: "CA$", name: "Canadian Dollar", rateToUsd: 1.36 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", rateToUsd: 1.52 },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", rateToUsd: 83.4 },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real", rateToUsd: 5.25 },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc", rateToUsd: 0.91 },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", rateToUsd: 1.35 },
  AED: { code: "AED", symbol: "AED", name: "UAE Dirham", rateToUsd: 3.67 },
  SAR: { code: "SAR", symbol: "SAR", name: "Saudi Riyal", rateToUsd: 3.75 },
  ETB: { code: "ETB", symbol: "Br", name: "Ethiopian Birr", rateToUsd: 57.5 },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", rateToUsd: 7.24 },
  MXN: { code: "MXN", symbol: "Mex$", name: "Mexican Peso", rateToUsd: 16.9 },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand", rateToUsd: 18.3 },
  KRW: { code: "KRW", symbol: "₩", name: "South Korean Won", rateToUsd: 1375.0 },
  SEK: { code: "SEK", symbol: "kr", name: "Swedish Krona", rateToUsd: 10.7 },
};

const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  US: "USD", USA: "USD",
  GB: "GBP", GBR: "GBP",
  DE: "EUR", DEU: "EUR", FR: "EUR", FRA: "EUR", IT: "EUR", ITA: "EUR",
  ES: "EUR", ESP: "EUR", NL: "EUR", NLD: "EUR", BE: "EUR", BEL: "EUR",
  AT: "EUR", AUT: "EUR", IE: "EUR", IRL: "EUR", PT: "EUR", PRT: "EUR",
  FI: "EUR", FIN: "EUR", GR: "EUR", GRC: "EUR",
  JP: "JPY", JPN: "JPY",
  CA: "CAD", CAN: "CAD",
  AU: "AUD", AUS: "AUD",
  IN: "INR", IND: "INR",
  BR: "BRL", BRA: "BRL",
  ET: "ETB", ETH: "ETB",
  CH: "CHF", CHE: "CHF",
  SG: "SGD", SGP: "SGD",
  AE: "AED", ARE: "AED",
  SA: "SAR", SAU: "SAR",
  CN: "CNY", CHN: "CNY",
  MX: "MXN", MEX: "MXN",
  ZA: "ZAR", ZAF: "ZAR",
  KR: "KRW", KOR: "KRW",
  SE: "SEK", SWE: "SEK",
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}k`;
  return `$${amount.toLocaleString()}`;
}

function formatConvertedCurrency(
  usdAmount: number | null | undefined,
  currencyCode: string = "USD"
): string {
  if (usdAmount === null || usdAmount === undefined) return "—";
  const currency = CURRENCIES[currencyCode] ?? CURRENCIES.USD;
  const converted = usdAmount * currency.rateToUsd;

  if (converted >= 1_000_000_000) {
    return `${currency.symbol}${(converted / 1_000_000_000).toFixed(2)}B`;
  }
  if (converted >= 1_000_000) {
    return `${currency.symbol}${(converted / 1_000_000).toFixed(2)}M`;
  }
  if (converted >= 1_000) {
    return `${currency.symbol}${(converted / 1_000).toFixed(1)}k`;
  }
  return `${currency.symbol}${Math.round(converted).toLocaleString()}`;
}


function SlotVersions({ slot, canEditGlobal }: { slot: RegionalBriefSlot; canEditGlobal: boolean }) {
  const api = useRegionalBriefApi();
  const queryClient = useQueryClient();
  const versions = useQuery({
    queryKey: ["regional-brief", "versions", slot.id],
    queryFn: () => api.listVersions(slot.id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["regional-brief"] });

  const approve = useMutation({
    mutationFn: (versionId: string) => api.approveVersion(versionId),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: ({ versionId, reason }: { versionId: string; reason: string }) =>
      api.rejectVersion(versionId, reason),
    onSuccess: invalidate,
  });

  const isGlobalLayer = GLOBAL_LAYERS.includes(slot.layerType);
  const canAct = !isGlobalLayer || canEditGlobal;

  if (versions.isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (versions.isError) {
    return <Alert variant="error">{formatQueryError(versions.error, "Could not load versions.")}</Alert>;
  }

  const items = versions.data?.data ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No versions yet.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((v) => (
        <div key={v.id} className="rounded-lg border px-3 py-2.5 text-sm space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              v{v.version} — {v.content.summary}
            </span>
            <Badge tone={STATUS_TONE[v.status] ?? "muted"}>{v.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {v.source} · confidence {v.confidence} · {v.evidence}
          </p>
          {(v.status === "draft" || v.status === "pending_review") && canAct && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => approve.mutate(v.id)} disabled={approve.isPending}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const reason = window.prompt("Rejection reason?");
                  if (reason) reject.mutate({ versionId: v.id, reason });
                }}
                disabled={reject.isPending}
              >
                Reject
              </Button>
            </div>
          )}
          {approve.isError && (
            <Alert variant="error">{formatQueryError(approve.error, "Could not approve that version.")}</Alert>
          )}
          {reject.isError && (
            <Alert variant="error">{formatQueryError(reject.error, "Could not reject that version.")}</Alert>
          )}
        </div>
      ))}
    </div>
  );
}

function ResolveAndTamPreview({ countries }: { countries: CountryItem[] }) {
  const api = useRegionalBriefApi();
  const [country, setCountry] = useState("US");
  const [industry, setIndustry] = useState("51");
  const [currency, setCurrency] = useState("USD");
  const [customIcpFit, setCustomIcpFit] = useState("10");
  const [customAcv, setCustomAcv] = useState("25000");

  const resolved = useQuery({
    queryKey: ["regional-brief", "resolve", country, industry],
    queryFn: () => api.resolve(country, industry || undefined),
    enabled: country.trim().length > 0,
  });

  const tam = useQuery({
    queryKey: ["regional-brief", "tam", country, industry],
    queryFn: () =>
      api.getTam({
        country,
        industry: resolved.data?.industry || industry,
      }),
    enabled: country.trim().length > 0 && (industry.trim().length > 0 || !!resolved.data?.industry),
  });

  const handleCountrySelect = (iso: string) => {
    setCountry(iso);
    const defaultCurr = COUNTRY_DEFAULT_CURRENCY[iso.toUpperCase()] || "USD";
    setCurrency(defaultCurr);
  };

  const selectedCountryItem = useMemo(() => {
    return countries.find(
      (c) =>
        c.isoCode.toUpperCase() === country.toUpperCase() ||
        c.isoAlpha3.toUpperCase() === country.toUpperCase()
    );
  }, [countries, country]);

  const activeCurrencyDef = CURRENCIES[currency] ?? CURRENCIES.USD;

  // Real-time responsive scenario calculations (0ms lag, zero input unmounting)
  const establishments = tam.data?.assumptions.establishments ?? 0;
  const parsedIcpNum = parseFloat(customIcpFit);
  const effectiveIcpFitPct =
    !isNaN(parsedIcpNum) && parsedIcpNum > 0
      ? parsedIcpNum / 100
      : (tam.data?.assumptions.icpFitPct ?? 0.1);

  const parsedAcvNum = parseFloat(customAcv);
  const effectiveAcvUsd =
    !isNaN(parsedAcvNum) && parsedAcvNum > 0
      ? parsedAcvNum
      : (tam.data?.assumptions.acvUsd ?? 25000);

  const calculatedTargetAccounts = tam.data?.isDataLoaded
    ? Math.round(
        (tam.data.assumptions.canonicalInclude !== false ? 1 : 0) * establishments * effectiveIcpFitPct
      )
    : null;

  const calculatedRevenueTamUsd =
    calculatedTargetAccounts !== null ? Math.round(calculatedTargetAccounts * effectiveAcvUsd) : null;

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Market Intelligence & TAM
          </CardTitle>
          <Badge tone="muted">Global Scope (250 Markets)</Badge>
        </div>
        <CardDescription>
          Live market intelligence, addressable accounts, and regional sales compliance guidelines.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Modern Combobox Selectors */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" /> Target Country
            </span>
            <CountryCombobox countries={countries} value={country} onChange={handleCountrySelect} />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3" /> Target Industry Sector
            </span>
            <IndustryCombobox value={industry} onChange={setIndustry} />
          </div>
        </div>

        {/* Industry normalization warning if any */}
        {resolved.data?.industryInputWarning && (
          <Alert variant="warning" title="Industry Note">
            {resolved.data.industryInputWarning}
          </Alert>
        )}

        {/* ── TAM Metrics Panel ── */}
        <div className="rounded-xl border bg-card p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Total Addressable Market (TAM)
            </span>

            {/* Currency Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Currency:</span>
              <select
                aria-label="Display Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-6 rounded-md border border-border/80 bg-muted/60 px-1.5 py-0 text-[11px] font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.values(CURRENCIES).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tam.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : tam.isError ? (
            <Alert variant="error">
              {formatQueryError(tam.error, "Could not load TAM calculation for this sector.")}
            </Alert>
          ) : tam.data?.isDataLoaded ? (
            <div className="space-y-3">
              {/* Highlight Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2.5 space-y-0.5">
                  <div className="text-[11px] text-muted-foreground">Annual Revenue TAM</div>
                  <div className="text-lg font-bold text-primary">
                    {formatConvertedCurrency(calculatedRevenueTamUsd, currency)}
                  </div>
                  {currency !== "USD" && (
                    <div className="text-[10px] text-muted-foreground/80 truncate">
                      ≈ {formatCurrency(calculatedRevenueTamUsd)} USD
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 space-y-0.5">
                  <div className="text-[11px] text-muted-foreground">Target Accounts</div>
                  <div className="text-lg font-bold text-foreground">
                    {calculatedTargetAccounts?.toLocaleString() ?? "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground/80">
                    {(effectiveIcpFitPct * 100).toFixed(0)}% ICP fit
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 space-y-0.5">
                  <div className="text-[11px] text-muted-foreground">Establishments</div>
                  <div className="text-lg font-bold text-foreground">
                    {tam.data.assumptions.establishments?.toLocaleString() ?? "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground/80">Registered</div>
                </div>
              </div>

              {/* Assumptions & Sources */}
              <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs space-y-2">
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                    <span>Official Data Source:</span>
                    {tam.data.assumptions.dataYear && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded font-mono text-muted-foreground">
                        {tam.data.assumptions.dataYear} Release
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-foreground bg-muted/40 rounded-md px-2.5 py-1.5 text-xs leading-relaxed break-words">
                    {tam.data.assumptions.dataSource ?? "Official National Statistics"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">ICP Fit Assumption:</span>
                    <span className="font-medium text-foreground">
                      {(effectiveIcpFitPct * 100).toFixed(0)}% fit
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Average Contract Value (ACV):</span>
                    <span className="font-medium text-foreground">
                      {formatConvertedCurrency(effectiveAcvUsd, currency)}
                      {currency !== "USD" && (
                        <span className="text-[10px] text-muted-foreground block">
                          ${effectiveAcvUsd.toLocaleString()} USD
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {currency !== "USD" && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-1 border-t border-border/40">
                    <span>Exchange Rate:</span>
                    <span className="font-mono text-foreground font-semibold">
                      1 USD = {activeCurrencyDef.rateToUsd} {currency}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick interactive adjustment */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                      <span>Custom ICP Fit %</span>
                      {customIcpFit && customIcpFit !== "10" && (
                        <button
                          type="button"
                          onClick={() => setCustomIcpFit("10")}
                          className="text-[10px] text-primary hover:underline"
                        >
                          reset
                        </button>
                      )}
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="10"
                      value={customIcpFit}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d{0,3}$/.test(val)) {
                          setCustomIcpFit(val);
                        }
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                      <span>Custom ACV ($ USD)</span>
                      {customAcv && customAcv !== "25000" && (
                        <button
                          type="button"
                          onClick={() => setCustomAcv("25000")}
                          className="text-[10px] text-primary hover:underline"
                        >
                          reset
                        </button>
                      )}
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="25000"
                      value={customAcv}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d*$/.test(val)) {
                          setCustomAcv(val);
                        }
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </label>
                </div>

                {/* Quick 1-Click Scenario Preset Pills */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">ICP Presets:</span>
                    {["5", "10", "15", "25"].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setCustomIcpFit(pct)}
                        className={`rounded px-1.5 py-0.5 transition-colors ${
                          customIcpFit === pct
                            ? "bg-primary/20 text-primary font-bold"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="font-medium">ACV:</span>
                    {[
                      { label: "$10k", val: "10000" },
                      { label: "$25k", val: "25000" },
                      { label: "$50k", val: "50000" },
                      { label: "$100k", val: "100000" },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setCustomAcv(item.val)}
                        className={`rounded px-1.5 py-0.5 transition-colors ${
                          customAcv === item.val
                            ? "bg-primary/20 text-primary font-bold"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-4 text-center space-y-1.5">
              <HelpCircle className="h-5 w-5 text-muted-foreground mx-auto" />
              <div className="text-xs font-semibold text-foreground">
                Data not yet loaded for this market
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Official establishment counts for{" "}
                <span className="font-medium text-foreground">
                  {selectedCountryItem?.name || country}
                </span>{" "}
                in NAICS {industry} are not yet registered.
              </p>
            </div>
          )}
        </div>

        {/* ── Resolved Selling Brief Entries ── */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Active Sales Guidelines
          </span>

          {resolved.isLoading && <Skeleton className="h-24 w-full" />}
          {resolved.isError && (
            <Alert variant="error">{formatQueryError(resolved.error, "Could not resolve country brief.")}</Alert>
          )}
          {!resolved.isLoading && !resolved.isError && (resolved.data?.entries ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No regional selling facts resolved for this market yet.
            </p>
          )}

          {(resolved.data?.entries ?? []).map((entry) => (
            <div
              key={entry.fieldCategory}
              className="rounded-lg border px-3 py-2.5 text-sm space-y-1 bg-muted/20"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize">
                  {entry.fieldCategory?.replace(/_/g, " ") ?? "General"}
                </span>
                <Badge tone={entry.isStale ? "warning" : "muted"}>
                  {entry.resolvedFromLayer ?? "global"}
                  {entry.isStale ? " · stale" : ""}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {entry.content?.summary ?? ""}
              </p>
              {Array.isArray(entry.content?.details) && entry.content.details.length > 0 && (
                <ul className="text-[11px] text-muted-foreground/80 list-disc pl-4 space-y-0.5 pt-1">
                  {entry.content.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateDraftForm({
  canEditGlobal,
  countries,
}: {
  canEditGlobal: boolean;
  countries: CountryItem[];
}) {
  const api = useRegionalBriefApi();
  const queryClient = useQueryClient();

  const [layerType, setLayerType] = useState<RegionalBriefLayerType>("country");
  const [countryIso, setCountryIso] = useState("US");
  const [regionCode, setRegionCode] = useState("NAM");
  const [industry, setIndustry] = useState("51");
  const [fieldCategory, setFieldCategory] = useState<RegionalBriefFieldCategory>("market_economics");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [source, setSource] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [confidence, setConfidence] = useState("0.8");
  const [evidence, setEvidence] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const blockedByGlobalScope = GLOBAL_LAYERS.includes(layerType) && !canEditGlobal;

  const createDraft = useMutation({
    mutationFn: async () => {
      const slotInput: CreateSlotInput = {
        layerType,
        countryIso:
          layerType === "country" || layerType === "tenant" ? countryIso.trim() || undefined : undefined,
        regionCode: layerType === "region" ? regionCode.trim() || undefined : undefined,
        industry: layerType === "industry" ? industry.trim() || undefined : undefined,
        fieldCategory,
      };
      const slot = await api.createSlot(slotInput);

      const versionInput: CreateVersionInput = {
        content: {
          summary: summary.trim(),
          details: details
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        },
        source: source.trim(),
        effectiveDate,
        confidence: Number(confidence),
        evidence: evidence.trim(),
      };
      return api.createVersion(slot.id, versionInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regional-brief"] });
      setSuccessMessage("Draft created — it now awaits review.");
      setSummary("");
      setDetails("");
      setSource("");
      setEvidence("");
    },
  });

  const canSubmit =
    !blockedByGlobalScope &&
    summary.trim().length > 0 &&
    source.trim().length > 0 &&
    effectiveDate.length > 0 &&
    evidence.trim().length > 0 &&
    !createDraft.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Propose a new draft</CardTitle>
        <CardDescription>
          Every fact needs a source, an effective date, and evidence before it can go up for review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Layer</span>
            <div className="relative">
              <select
                value={layerType}
                onChange={(e) => setLayerType(e.target.value as RegionalBriefLayerType)}
                className="flex h-10 w-full cursor-pointer rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm shadow-sm transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {LAYER_ORDER.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Field category</span>
            <div className="relative">
              <select
                value={fieldCategory}
                onChange={(e) => setFieldCategory(e.target.value as RegionalBriefFieldCategory)}
                className="flex h-10 w-full cursor-pointer rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm shadow-sm transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {FIELD_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(layerType === "country" || layerType === "tenant") && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Country</span>
              <CountryCombobox countries={countries} value={countryIso} onChange={setCountryIso} />
            </div>
          )}
          {layerType === "region" && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Region Code</span>
              <Input
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                placeholder="NAM, EMEA, UKI, etc."
              />
            </label>
          )}
          {layerType === "industry" && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium">NAICS Code / Industry</span>
              <IndustryCombobox value={industry} onChange={setIndustry} />
            </div>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Summary</span>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One-line summary of this fact"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Details (one per line)</span>
          <textarea
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Source</span>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. IMF 2026 report" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Effective date</span>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Confidence (0–1)</span>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Evidence</span>
          <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Link or citation" />
        </label>

        {blockedByGlobalScope && (
          <Alert variant="warning">
            Only platform admins can propose drafts on the global, region, country, or industry layers.
          </Alert>
        )}
        {createDraft.isError && (
          <Alert variant="error">{formatQueryError(createDraft.error, "Could not create that draft.")}</Alert>
        )}
        {successMessage && (
          <Alert variant="success" dismissible>
            {successMessage}
          </Alert>
        )}

        <Button type="button" disabled={!canSubmit} onClick={() => createDraft.mutate()}>
          Create draft
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RegionalBriefPage() {
  const api = useRegionalBriefApi();
  const [statusFilter, setStatusFilter] = useState<RegionalBriefVersionStatus | "all">("all");

  const adminCheck = useQuery({
    queryKey: ["regional-brief", "admin-check"],
    queryFn: () => api.adminCheck(),
  });

  const countriesQuery = useQuery({
    queryKey: ["regional-brief", "countries"],
    queryFn: () => api.listCountries(),
  });

  const slots = useQuery({
    queryKey: ["regional-brief", "slots", statusFilter],
    queryFn: () => api.listSlots(statusFilter === "all" ? undefined : { status: statusFilter }),
  });

  const canEditGlobal = adminCheck.data?.platformAdmin ?? false;
  const countries = countriesQuery.data?.data ?? [];

  return (
    <PageShell data-testid="page-regional-brief">
      <PageHeader
        title="Regional Selling Brief"
        description="Versioned, layered regional and country selling intelligence — market economics, addressable accounts, and sales compliance."
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RegionalBriefVersionStatus | "all")}
          className="flex h-10 w-48 cursor-pointer rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm shadow-sm transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {slots.data ? `${slots.data.total} slot${slots.data.total === 1 ? "" : "s"}` : "—"}
        </span>
      </div>

      {slots.isError && (
        <Alert variant="error" title="Something went wrong">
          {formatQueryError(slots.error, "Could not load regional brief slots.")}
        </Alert>
      )}

      {slots.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr,1.3fr]">
        <div className="space-y-4">
          {slots.data?.data.map((slot) => (
            <Card key={slot.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {slot.fieldCategory.replace(/_/g, " ")}
                  <span className="ml-2 font-normal text-sm text-muted-foreground">
                    {slotScopeLabel(slot)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SlotVersions slot={slot} canEditGlobal={canEditGlobal} />
              </CardContent>
            </Card>
          ))}

          <CreateDraftForm canEditGlobal={canEditGlobal} countries={countries} />
        </div>
        <ResolveAndTamPreview countries={countries} />
      </div>
    </PageShell>
  );
}
