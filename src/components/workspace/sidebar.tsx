"use client";

import { UserButton } from "@clerk/nextjs";
import { CLERK_ENABLED } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Crosshair,
  Inbox,
  List,
  Mail,
  Search,
  Settings,
  Sparkles,
  Target,
  UserPlus,
  Users,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiFetch, useAuthReady } from "@/lib/api-client";
import {
  CREDITS_QUERY_KEY,
  useEnrichmentApi,
  WORKSPACE_CURRENT_QUERY_KEY,
} from "@/lib/enrichment";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const enrichmentNav: NavGroup[] = [
  {
    label: "Home",
    items: [{ href: "/dashboard", label: "Dashboard", icon: BarChart3 }],
  },
  {
    label: "Discover",
    items: [
      { href: "/prospects/search", label: "Prospect search", icon: Search },
      { href: "/prospects/add", label: "Add prospect", icon: UserPlus },
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
      { href: "/ai/review", label: "AI review", icon: Sparkles, comingSoon: true },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/settings/crm", label: "CRM sync", icon: Settings },
      { href: "/settings/integrations", label: "Integrations", icon: Zap },
      { href: "/settings/corpus", label: "Corpus pipeline", icon: RefreshCw },
      { href: "/settings/workspace", label: "Workspace", icon: Users },
      { href: "/guides", label: "Setup guides", icon: BookOpen },
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

function NavLink({
  href,
  label,
  icon: Icon,
  comingSoon,
  onNavigate,
}: NavItem & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = !comingSoon && (pathname === href || pathname.startsWith(`${href}/`));

  if (comingSoon) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60"
        title="Coming in Phase 1"
      >
        <Icon className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        <span className="truncate">{label}</span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Soon
        </span>
      </span>
    );
  }

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
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
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
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();

  const { data: workspace } = useQuery<WorkspaceData>({
    queryKey: WORKSPACE_CURRENT_QUERY_KEY,
    queryFn: () => apiFetch("/api/v1/workspaces/current"),
    enabled: authReady,
    staleTime: 30_000,
  });

  const { data: creditsData } = useQuery({
    queryKey: CREDITS_QUERY_KEY,
    queryFn: enrichmentApi.getCredits,
    enabled: authReady,
    staleTime: 0,
  });

  const { data: me } = useQuery<MeData>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/v1/me"),
    enabled: authReady,
    staleTime: 30_000,
  });

  const workspaceName = workspace?.data?.name ?? "Workspace";
  const credits = creditsData?.balance ?? workspace?.data?.balance;
  const role = me?.role ?? "member";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          <span className="sm:hidden font-medium text-foreground">Skout</span>
          <span className="hidden sm:inline">
            Workspace: <span className="font-medium text-foreground">{workspaceName}</span>
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {credits !== null && credits !== undefined && (
          <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 sm:flex">
            <Zap className="h-3 w-3" />
            {credits.toLocaleString()}
          </span>
        )}
        <ThemeToggle />
        <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize md:inline">
          {role}
        </span>
        {CLERK_ENABLED ? (
          <UserButton afterSignOutUrl="/sign-in" />
        ) : null}
      </div>
    </header>
  );
}
