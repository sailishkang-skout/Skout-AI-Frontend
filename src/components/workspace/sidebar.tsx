"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Crosshair,
  Inbox,
  List,
  Mail,
  Search,
  Settings,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiFetch } from "@/lib/api-client";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const enrichmentNav: NavGroup[] = [
  {
    label: "Discover",
    items: [
      { href: "/prospects/search", label: "Prospect search", icon: Search },
      { href: "/smart-lists", label: "Smart lists", icon: Sparkles },
    ],
  },
  {
    label: "Activate",
    items: [
      { href: "/lists", label: "Lists", icon: List },
      { href: "/enrichment", label: "Enrichment", icon: Zap },
    ],
  },
  {
    label: "ICP",
    items: [
      { href: "/onboarding/icp", label: "Setup wizard", icon: Crosshair },
      { href: "/settings/icp", label: "ICP settings", icon: Target },
    ],
  },
];

export const otherNav: NavGroup[] = [
  {
    label: "Outreach",
    items: [
      { href: "/sequences", label: "Sequences", icon: Mail },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/deliverability", label: "Deliverability", icon: Target },
      { href: "/ai/review", label: "AI review", icon: Sparkles },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/settings/crm", label: "CRM sync", icon: Settings },
      { href: "/settings/workspace", label: "Workspace", icon: Users },
    ],
  },
];

interface WorkspaceData {
  data: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    balance: number | null;
  };
}

interface MeData {
  role?: string;
}

function NavLink({ href, label, icon: Icon, onNavigate }: NavItem & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavSection({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {group.label}
          </p>
          {group.items.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </>
  );
}

export function SidebarPanel({
  className,
  onNavigate,
  onClose,
}: {
  className?: string;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <aside className={cn("flex h-full flex-col bg-muted/30", className)}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <span className="text-lg font-semibold tracking-tight">Skout AI</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <NavSection groups={enrichmentNav} onNavigate={onNavigate} />
        <NavSection groups={otherNav} onNavigate={onNavigate} />
      </nav>
    </aside>
  );
}

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const apiFetch = useApiFetch();

  const { data: workspace } = useQuery<WorkspaceData>({
    queryKey: ["workspace-current"],
    queryFn: () => apiFetch("/api/v1/workspaces/current"),
    staleTime: 60_000,
    retry: false,
  });

  const { data: me } = useQuery<MeData>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/v1/me"),
    staleTime: 60_000,
    retry: false,
  });

  const workspaceName = workspace?.data?.name ?? "Workspace";
  const credits = workspace?.data?.balance;
  const role = me?.role ?? "member";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <p className="truncate text-sm text-muted-foreground">
          Workspace: <span className="font-medium text-foreground">{workspaceName}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {credits !== null && credits !== undefined && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <Zap className="h-3 w-3" />
            {credits.toLocaleString()}
          </span>
        )}
        <ThemeToggle />
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">{role}</span>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
