"use client";

import { useRef, useState } from "react";
import { ChevronDown, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CSV_EXPORT_CREDIT_COST } from "@/lib/enrichment";
import { cn } from "@/lib/utils";

export interface ListExportMenuProps {
  disabled?: boolean;
  memberCount: number;
  hubspotConnected: boolean;
  hubspotCreditCost: number;
  csvPending?: boolean;
  hubspotPending?: boolean;
  onExportCsv: () => void;
  onExportHubSpot: () => void;
}

export function ListExportMenu({
  disabled,
  memberCount,
  hubspotConnected,
  hubspotCreditCost,
  csvPending,
  hubspotPending,
  onExportCsv,
  onExportHubSpot,
}: ListExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const busy = csvPending || hubspotPending;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !memberCount || busy}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition", open && "rotate-180")} />
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close export menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-[15rem] rounded-md border border-border bg-popover p-1 shadow-md"
          >
            <button
              type="button"
              role="menuitem"
              disabled={csvPending}
              className="flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                onExportCsv();
              }}
            >
              {csvPending ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Download className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                <span className="font-medium">Download CSV</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {CSV_EXPORT_CREDIT_COST} credits · {memberCount} contact
                  {memberCount === 1 ? "" : "s"}
                </span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={!hubspotConnected || hubspotPending}
              className="flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                onExportHubSpot();
              }}
            >
              {hubspotPending ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Upload className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                <span className="font-medium">Export to HubSpot</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {hubspotConnected
                    ? `${hubspotCreditCost} credit${hubspotCreditCost === 1 ? "" : "s"}`
                    : "Connect HubSpot in settings"}
                </span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
