"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthReady } from "@/lib/api-client";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useContactsApi } from "@/lib/crm/contacts";

export function Crm360RecordPicker({
  mode,
  onSelect,
}: {
  mode: "account" | "person";
  onSelect: (id: string) => void;
}) {
  const authReady = useAuthReady();
  const companiesApi = useCompaniesApi();
  const contactsApi = useContactsApi();
  const [query, setQuery] = useState("");

  const companies = useQuery({
    queryKey: ["crm", "companies", "picker"],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: authReady && mode === "account",
  });

  const contacts = useQuery({
    queryKey: ["crm", "contacts", "picker"],
    queryFn: () => contactsApi.list({ limit: 100 }),
    enabled: authReady && mode === "person",
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (mode === "account") {
      return (companies.data?.data ?? [])
        .filter((c) => {
          if (!q) return true;
          return (
            c.name.toLowerCase().includes(q) ||
            (c.domain ?? "").toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
        .map((c) => ({
          id: c.id,
          title: c.name,
          subtitle: c.domain ?? c.industry ?? "Company",
        }));
    }
    return (contacts.data?.data ?? [])
      .filter((c) => {
        const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
        if (!q) return true;
        return (
          name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.title ?? "").toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        );
      })
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        title: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Contact",
        subtitle: [c.title, c.email].filter(Boolean).join(" · ") || "Contact",
      }));
  }, [companies.data, contacts.data, mode, query]);

  const isLoading = mode === "account" ? companies.isLoading : contacts.isLoading;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={mode === "account" ? "Search companies by name or domain" : "Search people by name or email"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading records…</p>
      ) : results.length ? (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border">
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/50"
                onClick={() => onSelect(row.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{row.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-primary">Open</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {query ? "No matching records." : "No records in CRM yet."}
        </p>
      )}
    </div>
  );
}
