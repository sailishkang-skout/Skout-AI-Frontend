"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Briefcase, CheckSquare, ChevronDown, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyFormSheet } from "./company-form-sheet";
import { ContactFormSheet } from "./contact-form-sheet";
import { DealFormSheet } from "./deal-form-sheet";
import { TaskFormSheet } from "./task-form-sheet";

type Kind = "company" | "contact" | "deal" | "task";

const OPTIONS: Array<{ kind: Kind; label: string; icon: typeof Plus }> = [
  { kind: "company", label: "Company", icon: Building2 },
  { kind: "contact", label: "Contact", icon: User },
  { kind: "deal", label: "Opportunity", icon: Briefcase },
  { kind: "task", label: "Task", icon: CheckSquare },
];

/**
 * COPS-02 quick create: one menu on CRM screens that opens the existing company, contact, deal
 * and task forms. After a save it also refreshes the COPS lists (accounts table, board next
 * actions) that read through the COPS endpoints.
 */
export function CrmQuickCreate() {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState<Kind | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const refreshCops = () => {
    queryClient.invalidateQueries({ queryKey: ["cops-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["cops-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["crm", "deals"] });
  };
  const close = () => setOpen(null);

  return (
    <div className="relative" ref={ref}>
      <Button
        data-testid="crm-quick-create"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <Plus className="h-4 w-4" />
        Quick create
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {menuOpen && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md">
          {OPTIONS.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setOpen(kind);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}

      <CompanyFormSheet open={open === "company"} onClose={close} onSaved={refreshCops} />
      <ContactFormSheet open={open === "contact"} onClose={close} onSaved={refreshCops} />
      <DealFormSheet open={open === "deal"} onClose={close} onSaved={refreshCops} />
      <TaskFormSheet open={open === "task"} onClose={close} onSaved={refreshCops} />
    </div>
  );
}
