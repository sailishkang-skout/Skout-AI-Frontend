"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Building2, Loader2, Search, User, DollarSign } from "lucide-react";
import { homeNav, pipelineNav, prospectsNav, engageNav, workflowsNav, intelligenceNav, settingsNav } from "@/components/workspace/sidebar";
import { useAuthReady } from "@/lib/api-client";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useContactsApi } from "@/lib/crm/contacts";
import { useDealsApi } from "@/lib/crm/deals";

const SEARCH_RESULT_LIMIT = 5;
const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const router = useRouter();
  const authReady = useAuthReady();
  const companiesApi = useCompaniesApi();
  const contactsApi = useContactsApi();
  const dealsApi = useDealsApi();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const searchTerm = debouncedQuery.trim();
  const searchEnabled = open && authReady && searchTerm.length >= MIN_SEARCH_LENGTH;

  const companiesQuery = useQuery({
    queryKey: ["command-palette", "companies", searchTerm],
    queryFn: () => companiesApi.list({ search: searchTerm, limit: SEARCH_RESULT_LIMIT }),
    enabled: searchEnabled,
  });
  const contactsQuery = useQuery({
    queryKey: ["command-palette", "contacts", searchTerm],
    queryFn: () => contactsApi.list({ search: searchTerm, limit: SEARCH_RESULT_LIMIT }),
    enabled: searchEnabled,
  });
  const dealsQuery = useQuery({
    queryKey: ["command-palette", "deals", searchTerm],
    queryFn: () => dealsApi.list({ search: searchTerm, limit: SEARCH_RESULT_LIMIT }),
    enabled: searchEnabled,
  });

  const isSearching =
    searchEnabled && (companiesQuery.isFetching || contactsQuery.isFetching || dealsQuery.isFetching);

  const runCommand = (command: () => void) => {
    setOpen(false);
    setQuery("");
    command();
  };

  const displayGroups = [
    ...homeNav,
    ...pipelineNav,
    ...prospectsNav,
    ...engageNav,
    ...workflowsNav,
    ...intelligenceNav,
    ...settingsNav,
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] sm:pt-[25vh]">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={() => setOpen(false)}
      />
      <Command
        className="relative z-50 flex h-full w-full max-w-[640px] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl sm:h-auto"
        label="Global Command Menu"
      >
        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Search companies, contacts, deals, or jump to a page..."
          />
          {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-50" />}
        </div>
        <Command.List className="max-h-[50vh] overflow-y-auto overflow-x-hidden p-2 pb-4">
          <Command.Empty className="py-6 text-center text-sm">No results found.</Command.Empty>

          {searchEnabled && (companiesQuery.data?.data.length ?? 0) > 0 && (
            <Command.Group heading="Companies" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {companiesQuery.data!.data.map((company) => (
                <Command.Item
                  key={company.id}
                  value={`company-${company.id}-${company.name}`}
                  onSelect={() => runCommand(() => router.push(`/crm/companies/${company.id}`))}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Building2 className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{company.name}</span>
                  {company.domain && (
                    <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{company.domain}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {searchEnabled && (contactsQuery.data?.data.length ?? 0) > 0 && (
            <Command.Group heading="Contacts" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {contactsQuery.data!.data.map((contact) => (
                <Command.Item
                  key={contact.id}
                  value={`contact-${contact.id}-${contact.firstName}-${contact.lastName ?? ""}`}
                  onSelect={() => runCommand(() => router.push(`/crm/contacts/${contact.id}`))}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <User className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {contact.firstName} {contact.lastName ?? ""}
                  </span>
                  {contact.email && (
                    <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{contact.email}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {searchEnabled && (dealsQuery.data?.data.length ?? 0) > 0 && (
            <Command.Group heading="Deals" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {dealsQuery.data!.data.map((deal) => (
                <Command.Item
                  key={deal.id}
                  value={`deal-${deal.id}-${deal.name}`}
                  onSelect={() => runCommand(() => router.push(`/crm/deals/${deal.id}`))}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <DollarSign className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{deal.name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {displayGroups.map((group) => (
            <Command.Group key={group.label} heading={group.label} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {group.items.map((item) => {
                if (item.children) {
                  return item.children.map(child => (
                    <Command.Item
                      key={child.href}
                      onSelect={() => runCommand(() => router.push(child.href))}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <child.icon className="mr-2 h-4 w-4" />
                      {child.label}
                    </Command.Item>
                  ));
                }
                return (
                  <Command.Item
                    key={item.href}
                    onSelect={() => runCommand(() => router.push(item.href))}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
