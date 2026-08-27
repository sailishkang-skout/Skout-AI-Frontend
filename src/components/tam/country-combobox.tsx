"use client";

import { Check, ChevronDown, Globe, Layers, Search } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CountryItem } from "@/lib/regional-brief";

// ── Standard NAICS Sectors ─────────────────────────────────────────────────────
export const NAICS_SECTORS = [
  { code: "11", name: "Agriculture, Forestry, Fishing & Hunting" },
  { code: "21", name: "Mining, Quarrying, and Oil and Gas Extraction" },
  { code: "22", name: "Utilities" },
  { code: "23", name: "Construction" },
  { code: "31-33", name: "Manufacturing" },
  { code: "42", name: "Wholesale Trade" },
  { code: "44-45", name: "Retail Trade" },
  { code: "48-49", name: "Transportation and Warehousing" },
  { code: "51", name: "Information & Technology / Software / Publishing" },
  { code: "52", name: "Finance and Insurance" },
  { code: "53", name: "Real Estate and Rental and Leasing" },
  { code: "54", name: "Professional, Scientific, and Technical Services" },
  { code: "55", name: "Management of Companies and Enterprises" },
  { code: "56", name: "Administrative and Support / Waste Management" },
  { code: "61", name: "Educational Services" },
  { code: "62", name: "Health Care and Social Assistance" },
  { code: "71", name: "Arts, Entertainment, and Recreation" },
  { code: "72", name: "Accommodation and Food Services" },
  { code: "81", name: "Other Services (except Public Administration)" },
  { code: "92", name: "Public Administration / Government" },
];

// ── Searchable Modern Country Combobox ──────────────────────────────────────────
export function CountryCombobox({
  countries,
  value,
  onChange,
  className = "",
  compact = false,
}: {
  countries: CountryItem[];
  value: string;
  onChange: (isoCode: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCountry = useMemo(() => {
    return countries.find(
      (c) =>
        c.isoCode.toUpperCase() === value.toUpperCase() ||
        c.isoAlpha3.toUpperCase() === value.toUpperCase()
    );
  }, [countries, value]);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.isoCode.toLowerCase().includes(q) ||
        c.isoAlpha3.toLowerCase().includes(q)
    );
  }, [countries, search]);

  return (
    <div className={`relative ${className || "w-full"}`} ref={dropdownRef}>
      <button
        type="button"
        aria-label="Target Country"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm shadow-sm transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          compact ? "h-8 py-1 text-xs" : "h-10"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Globe className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate font-medium">
            {selectedCountry ? selectedCountry.name : value || "Select Country"}
          </span>
          {selectedCountry && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
              {selectedCountry.isoCode} · {selectedCountry.isoAlpha3}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full min-w-[280px] overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in-50 zoom-in-95">
          {/* Search input header */}
          <div className="flex items-center border-b border-border/60 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder="Search 250 countries, codes (e.g. US, GBR, France)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto p-1 text-xs">
            {filteredCountries.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">No matching countries found</div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected =
                  c.isoCode.toUpperCase() === value.toUpperCase() ||
                  c.isoAlpha3.toUpperCase() === value.toUpperCase();
                return (
                  <button
                    key={c.isoAlpha3}
                    type="button"
                    onClick={() => {
                      onChange(c.isoCode);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{c.name}</span>
                      <span
                        className={`text-[10px] font-mono rounded px-1 py-0.2 ${
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.isoCode}
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Searchable Industry Combobox ───────────────────────────────────────────────
export function IndustryCombobox({
  value,
  onChange,
  className = "",
  compact = false,
}: {
  value: string;
  onChange: (sectorCode: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedSector = useMemo(() => {
    return NAICS_SECTORS.find((s) => s.code === value || s.name.toLowerCase() === value.toLowerCase());
  }, [value]);

  const filteredSectors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return NAICS_SECTORS;
    return NAICS_SECTORS.filter((s) => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }, [search]);

  return (
    <div className={`relative ${className || "w-full"}`} ref={dropdownRef}>
      <button
        type="button"
        aria-label="Target Industry Sector"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm shadow-sm transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          compact ? "h-8 py-1 text-xs" : "h-10"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate font-medium">
            {selectedSector ? selectedSector.name : value || "Select Industry Sector"}
          </span>
          {selectedSector && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
              NAICS {selectedSector.code}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full min-w-[320px] overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center border-b border-border/60 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              placeholder="Search 20 NAICS industry sectors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto p-1 text-xs">
            {filteredSectors.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">No matching sectors found</div>
            ) : (
              filteredSectors.map((s) => {
                const isSelected = s.code === value;
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => {
                      onChange(s.code);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{s.name}</span>
                      <span
                        className={`text-[10px] font-mono rounded px-1 py-0.2 ${
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        NAICS {s.code}
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
