"use client";

import { useEffect, useState } from "react";
import { SidebarPanel, TopBar } from "@/components/workspace/sidebar";
import { IcpEnforcement } from "@/components/layout/icp-enforcement";
import { WorkspaceAiChat } from "@/components/ai/workspace-ai-chat";
import {
  ProductTourProvider,
  useProductTourOptional,
} from "@/components/onboarding/product-tour-provider";
import { cn } from "@/lib/utils";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const tour = useProductTourOptional();

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Keep mobile nav open during the tour so sidebar targets are visible.
  useEffect(() => {
    if (tour?.phase !== "tour") return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    setMobileOpen(true);
  }, [tour?.phase, tour?.stepIndex]);

  return (
    <div className="flex h-svh min-h-0 w-full overflow-hidden">
      <IcpEnforcement />
      <div className="hidden w-64 shrink-0 border-r lg:block">
        <SidebarPanel className="h-full w-64" />
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Close menu overlay"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(100%,18rem)] border-r border-border bg-background shadow-xl lg:hidden">
            <SidebarPanel
              className="h-full"
              onNavigate={() => {
                if (tour?.phase === "tour") return;
                setMobileOpen(false);
              }}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
          )}
        >
          {children}
        </main>
      </div>
      <WorkspaceAiChat />
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ProductTourProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </ProductTourProvider>
  );
}
