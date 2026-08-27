"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Compass,
  DollarSign,
  ExternalLink,
  Globe,
  HelpCircle,
  Layers,
  Lightbulb,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError } from "@/lib/api-client";
import {
  useRegionalBriefApi,
  type CountryItem,
  type ResolvedBrief,
} from "@/lib/regional-brief";

import {
  CountryCombobox,
  IndustryCombobox,
} from "@/components/tam/country-combobox";

// Standard Global Currencies
export const TAM_CURRENCIES: Record<string, { code: string; symbol: string; rate: number }> = {
  USD: { code: "USD", symbol: "$", rate: 1.0 },
  EUR: { code: "EUR", symbol: "€", rate: 0.92 },
  GBP: { code: "GBP", symbol: "£", rate: 0.79 },
  JPY: { code: "JPY", symbol: "¥", rate: 155.2 },
  CAD: { code: "CAD", symbol: "CA$", rate: 1.36 },
  AUD: { code: "AUD", symbol: "A$", rate: 1.52 },
  INR: { code: "INR", symbol: "₹", rate: 83.4 },
  BRL: { code: "BRL", symbol: "R$", rate: 5.25 },
  CHF: { code: "CHF", symbol: "CHF", rate: 0.91 },
  SGD: { code: "SGD", symbol: "S$", rate: 1.35 },
  AED: { code: "AED", symbol: "AED", rate: 3.67 },
  ETB: { code: "ETB", symbol: "Br", rate: 57.5 },
};

function formatTamCurrency(amount: number | null | undefined, currCode = "USD"): string {
  if (amount === null || amount === undefined) return "—";
  const def = TAM_CURRENCIES[currCode] || TAM_CURRENCIES.USD;
  const val = amount * def.rate;
  if (val >= 1_000_000_000) return `${def.symbol}${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `${def.symbol}${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${def.symbol}${(val / 1_000).toFixed(1)}k`;
  return `${def.symbol}${Math.round(val).toLocaleString()}`;
}

export function MarketIntelligenceSuggestions({
  targetCountry = "US",
  targetIndustry = "51",
  title = "Intelligent Market Strategy & Suggestions",
  description = "Regional intelligence, optimal cadence recommendations, and compliance guardrails grounded in official statistical data.",
}: {
  targetCountry?: string;
  targetIndustry?: string;
  title?: string;
  description?: string;
}) {
  const api = useRegionalBriefApi();
  const [selectedCountry, setSelectedCountry] = useState(targetCountry);
  const [selectedIndustry, setSelectedIndustry] = useState(targetIndustry);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  const countriesQuery = useQuery({
    queryKey: ["regional-brief", "countries"],
    queryFn: () => api.listCountries(),
  });

  const countries: CountryItem[] = countriesQuery.data?.data ?? [];

  const resolvedBrief = useQuery({
    queryKey: ["regional-brief", "resolve", selectedCountry, selectedIndustry],
    queryFn: () => api.resolve(selectedCountry, selectedIndustry),
    enabled: selectedCountry.trim().length > 0,
  });

  const tamMetrics = useQuery({
    queryKey: ["regional-brief", "tam", selectedCountry, selectedIndustry],
    queryFn: () =>
      api.getTam({
        country: selectedCountry,
        industry: selectedIndustry,
      }),
    enabled: selectedCountry.trim().length > 0 && selectedIndustry.trim().length > 0,
  });

  const activeCountryObj = useMemo(() => {
    return countries.find(
      (c) =>
        c.isoCode.toUpperCase() === selectedCountry.toUpperCase() ||
        c.isoAlpha3.toUpperCase() === selectedCountry.toUpperCase()
    );
  }, [countries, selectedCountry]);

  // Extract key intelligence categories
  const entries = resolvedBrief.data?.entries ?? [];
  const channelPolicy = entries.find((e) => e.fieldCategory === "channel_policy");
  const dataCompliance = entries.find((e) => e.fieldCategory === "data_compliance");
  const businessPractice = entries.find((e) => e.fieldCategory === "business_practice");
  const telecomRules = entries.find((e) => e.fieldCategory === "telecom_requirements");
  const marketEconomics = entries.find((e) => e.fieldCategory === "market_economics");

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card via-card/90 to-primary/5 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              {title}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Searchable Country Combobox */}
            <div className="w-56 sm:w-64">
              <CountryCombobox
                countries={countries}
                value={selectedCountry}
                onChange={setSelectedCountry}
                compact
              />
            </div>

            {/* Searchable Industry Combobox */}
            <div className="w-56 sm:w-64">
              <IndustryCombobox
                value={selectedIndustry}
                onChange={setSelectedIndustry}
                compact
              />
            </div>

            {/* Currency Switcher */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground font-medium">FX:</span>
              <select
                aria-label="Currency"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="h-8 rounded-lg border border-border/80 bg-background/80 px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {Object.keys(TAM_CURRENCIES).map((code) => (
                  <option key={code} value={code}>
                    {code} ({TAM_CURRENCIES[code].symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* TAM Highlight Metrics Banner */}
        {tamMetrics.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : tamMetrics.data?.isDataLoaded ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Annual Revenue TAM
              </div>
              <div className="text-xl font-bold text-primary">
                {formatTamCurrency(tamMetrics.data.annualRevenueTamUsd, selectedCurrency)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                @ {(tamMetrics.data.assumptions.icpFitPct * 100).toFixed(0)}% ICP fit · $
                {(tamMetrics.data.assumptions.acvUsd / 1000).toFixed(0)}k ACV
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                Target Accounts in Market
              </div>
              <div className="text-xl font-bold text-foreground">
                {tamMetrics.data.targetAccountsTam?.toLocaleString() ?? "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                From {tamMetrics.data.assumptions.establishments?.toLocaleString()} total establishments
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Data Provenance
              </div>
              <div className="text-xs font-semibold text-foreground truncate" title={tamMetrics.data.assumptions.dataSource || ""}>
                {tamMetrics.data.assumptions.dataSource?.split("—")[0]?.trim() || "National Statistics"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Official {tamMetrics.data.assumptions.dataYear ?? "2023"} release
              </div>
            </div>
          </div>
        ) : null}

        {/* Intelligent Suggestions Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Card 1: Outreach & Channel Playbook Recommendation */}
          <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Compass className="h-4 w-4 text-primary" />
                Recommended Outreach Playbook
              </div>
              <Badge tone="info">Channel Strategy</Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {channelPolicy?.content.summary ??
                "Multi-channel cadence recommended: personalized email and business social outreach with clear opt-out."}
            </p>

            {businessPractice?.content.summary && (
              <div className="rounded-lg bg-muted/40 p-2 text-[11px] text-foreground/90 space-y-0.5">
                <span className="font-semibold text-primary block">Localization Note:</span>
                <p className="text-muted-foreground leading-normal">{businessPractice.content.summary}</p>
              </div>
            )}
          </div>

          {/* Card 2: Regulatory & Direct Marketing Guardrails */}
          <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Compliance & Legal Guardrails
              </div>
              <Badge tone="warning">Policy Guardrail</Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {dataCompliance?.content.summary ??
                "Verify legitimate interest and provide explicit one-click opt-out mechanisms on all outbound channels."}
            </p>

            {telecomRules?.content.summary && (
              <div className="rounded-lg bg-muted/40 p-2 text-[11px] text-foreground/90 space-y-0.5">
                <span className="font-semibold text-amber-500 block">Calling Policy:</span>
                <p className="text-muted-foreground leading-normal">{telecomRules.content.summary}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions & Shortcut to Full Regional Brief */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-border/50">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span>
              Active market: <strong className="text-foreground">{activeCountryObj?.name || selectedCountry}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/regional-brief"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              Regional Selling Brief & Playbooks
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
