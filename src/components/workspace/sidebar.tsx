"use client";

import { UserButton } from "@clerk/nextjs";
import { CLERK_ENABLED } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  CheckSquare,
  ChevronRight,
  Crosshair,
  Flame,
  GitMerge,
  Globe2,
  HeartPulse,
  Inbox,
  Kanban,
  Layers,
  LayoutDashboard,
  List,
  Mail,
  MailCheck,
  MessageSquare,
  Network,
  OctagonX,
  Phone,
  Radar,
  Search,
  ShieldCheck,
  Settings,
  Sparkles,
  Target,
  Upload,
  UserPlus,
  Users,
  Users2,
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
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useProductTourOptional } from "@/components/onboarding/product-tour-provider";

/** Renders as the last item under the Help group — same look as a normal NavLink. */
function RestartTourButton({ onNavigate }: { onNavigate?: () => void }) {
  const tour = useProductTourOptional();
  if (!tour) return null;
  return (
    <button
      type="button"
      onClick={() => {
        tour.restartTour();
        onNavigate?.();
      }}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">Take product tour</span>
    </button>
  );
}

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
  /** Product tour spotlight target id (data-tour) */
  tourId?: string;
  /** Only match this exact pathname — use when `href` is also a prefix of sibling routes (e.g. a group's "/crm" overview vs "/crm/companies"). */
  exact?: boolean;
  /** Renders as a collapsible submenu instead of a link — `href` is unused when set. */
  children?: NavItem[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Sidebar order follows the user's journey, not an alphabetical feature list:
// Discover (who to sell to) -> Outreach (how to reach them) -> Intelligence (what's
// happening) -> CRM (what to manage) -> Automation (what Skout does for you) -> Settings.

export const homeNav: NavGroup[] = [
  {
    label: "Home",
    items: [{ href: "/dashboard", label: "Dashboard", icon: BarChart3, tourId: "nav-dashboard" }],
  },
];

export const discoverNav: NavGroup[] = [
  {
    label: "Discover",
    items: [
      { href: "/prospects/search", label: "Prospect search", icon: Search, tourId: "nav-prospect-search" },
      { href: "/tam", label: "Market (TAM)", icon: Radar, tourId: "nav-tam" },
      { href: "/settings/icp", label: "ICP", icon: Target, tourId: "nav-icp-settings" },
      { href: "/lists", label: "Lists", icon: List, tourId: "nav-lists" },
      { href: "/smart-lists", label: "Smart lists", icon: Sparkles, tourId: "nav-smart-lists" },
      { href: "/prospects/add", label: "Add prospect", icon: UserPlus, tourId: "nav-add-prospect" },
      { href: "/import", label: "Import", icon: Upload, tourId: "nav-import" },
      { href: "/enrichment", label: "Enrichment", icon: Zap, tourId: "nav-enrichment" },
      { href: "/enrichment/workbooks", label: "Enrichment workbooks", icon: Sparkles, tourId: "nav-workbooks" },
    ],
  },
];

export const outreachNav: NavGroup[] = [
  {
    label: "Outreach",
    items: [
      { href: "/sequences", label: "Sequences", icon: Mail, tourId: "nav-sequences" },
      {
        href: "/inbox",
        label: "Inbox",
        icon: Inbox,
        tourId: "nav-inbox",
        children: [
          { href: "/inbox", label: "Conversations", icon: Inbox, exact: true },
          { href: "/inbox/manual-review", label: "Manual review", icon: BadgeCheck },
        ],
      },
      { href: "/settings/calling", label: "Calling", icon: Phone, tourId: "nav-calling" },
      { href: "/deliverability", label: "Deliverability", icon: Target, tourId: "nav-deliverability" },
      {
        href: "/warmup",
        label: "Email Warm-up",
        icon: Flame,
        tourId: "nav-email-warmup",
        children: [
          { href: "/warmup", label: "Overview", icon: LayoutDashboard, exact: true },
          { href: "/warmup/mailboxes", label: "Mailboxes", icon: Mail },
          { href: "/warmup/control", label: "Warm-up control", icon: Zap },
          { href: "/warmup/health", label: "Health and risk", icon: HeartPulse },
          { href: "/warmup/conversations", label: "Conversations", icon: MessageSquare },
          { href: "/warmup/domains", label: "Domains", icon: Globe2 },
          { href: "/warmup/pools", label: "Pools", icon: Layers },
          { href: "/warmup/network", label: "Partner network", icon: Network },
          { href: "/warmup/operations", label: "Kill switches", icon: OctagonX },
        ],
      },
      { href: "/settings/draft-auto-approve", label: "Draft auto-approve", icon: BadgeCheck, tourId: "nav-draft-auto-approve" },
    ],
  },
];

export const intelligenceNav: NavGroup[] = [
  {
    label: "Intelligence",
    items: [
      { href: "/admin/cro", label: "CRO Copilot", icon: ShieldCheck, tourId: "nav-cro-copilot" },
      { href: "/admin/reporting", label: "Reporting & forecasting", icon: BarChart3, tourId: "nav-reporting" },
      { href: "/signals", label: "Signal Center", icon: Flame, tourId: "nav-signal-center" },
      {
        href: "/intelligence/email",
        label: "Email Intelligence",
        icon: MailCheck,
        tourId: "nav-email-intelligence",
        children: [
          { href: "/intelligence/email", label: "Overview", icon: LayoutDashboard, exact: true },
          { href: "/intelligence/email/verify", label: "Verify", icon: BadgeCheck },
          { href: "/intelligence/email/discover", label: "Discover", icon: Search },
          { href: "/intelligence/email/patterns", label: "Patterns", icon: Sparkles },
          { href: "/intelligence/email/warmup", label: "Warm-up", icon: Zap },
        ],
      },
      { href: "/crm/intelligence", label: "CRM Intelligence", icon: Kanban, tourId: "nav-deal-intelligence" },
      { href: "/ai/review", label: "AI Review", icon: Sparkles, tourId: "nav-ai-review" },
      { href: "/settings/alert-rules", label: "Signal alerts", icon: BellRing, tourId: "nav-alert-rules" },
    ],
  },
];

export const crmNav: NavGroup[] = [
  {
    label: "CRM",
    items: [
      { href: "/crm", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/crm/deals", label: "Deals", icon: Briefcase },
      { href: "/crm/companies", label: "Companies", icon: Building2 },
      { href: "/crm/contacts", label: "Contacts", icon: Users2 },
      { href: "/crm/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/crm/meetings", label: "Meetings", icon: CalendarClock },
      { href: "/crm/calendar", label: "Calendar", icon: Calendar },
      { href: "/crm/identity-merge", label: "Identity merge review", icon: GitMerge, tourId: "nav-identity-merge" },
    ],
  },
];

export const automationNav: NavGroup[] = [
  {
    label: "Automation",
    items: [
      { href: "/settings/automation-rules", label: "Automation rules", icon: Sparkles, tourId: "nav-automation-rules" },
    ],
  },
];

export const settingsNav: NavGroup[] = [
  {
    label: "Settings",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, tourId: "nav-analytics" },
      { href: "/settings/crm", label: "CRM sync", icon: Settings, tourId: "nav-crm" },
      { href: "/settings/integrations", label: "Integrations", icon: Zap, tourId: "nav-integrations" },
      { href: "/settings/notifications", label: "Notifications", icon: Bell, tourId: "nav-notifications" },
      { href: "/settings/team", label: "Team", icon: Users2, tourId: "nav-team" },
      { href: "/settings/workspace", label: "Workspace", icon: Users, tourId: "nav-workspace" },
      // Not in the new spec's visible groups — kept here rather than dropped from the nav
      // entirely, since it's a real working page with no other listed home for it.
      { href: "/settings/corpus", label: "Corpus pipeline", icon: RefreshCw, tourId: "nav-corpus" },
    ],
  },
];

export const helpNav: NavGroup[] = [
  {
    label: "Help",
    items: [
      { href: "/guides", label: "Setup guides", icon: BookOpen, tourId: "nav-guides" },
      { href: "/onboarding", label: "Setup wizard", icon: Crosshair, tourId: "nav-icp-wizard" },
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
  tourId,
  exact,
  onNavigate,
}: NavItem & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = !comingSoon && (pathname === href || (!exact && pathname.startsWith(`${href}/`)));

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
      data-tour={tourId}
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

function NavLinkGroup({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const children = item.children ?? [];
  const childActive = children.some(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
  );
  const [open, setOpen] = useState(childActive);

  // Auto-expand when navigation lands on a child route (e.g. deep link or client nav).
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        data-tour={item.tourId}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          childActive
            ? "text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden
        />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-1 border-l pl-3">
          {children.map((child) => (
            <NavLink key={child.href} {...child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
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
          {group.items.map((item) =>
            item.children && item.children.length > 0 ? (
              <NavLinkGroup key={item.href} item={item} onNavigate={onNavigate} />
            ) : (
              <NavLink key={item.href} {...item} onNavigate={onNavigate} />
            )
          )}
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
  const [navRegroupEnabled, setNavRegroupEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramVal = params.get("nav-regroup");
    if (paramVal === "true") {
      localStorage.setItem("nav-regroup-enabled", "true");
      setNavRegroupEnabled(true);
    } else if (paramVal === "false") {
      localStorage.setItem("nav-regroup-enabled", "false");
      setNavRegroupEnabled(false);
    } else {
      const localVal = localStorage.getItem("nav-regroup-enabled");
      setNavRegroupEnabled(
        localVal === "true" || process.env.NEXT_PUBLIC_NAV_REGROUP_ENABLED === "true"
      );
    }
  }, []);

  const displayGroups = navRegroupEnabled
    ? [
        ...homeNav,
        ...discoverNav,
        ...outreachNav,
        {
          label: "Intelligence",
          items: intelligenceNav[0].items.filter(
            (item) => item.href !== "/crm/intelligence"
          ),
        },
        {
          label: "CRM Intelligence",
          items: [
            ...crmNav[0].items.slice(0, 7),
            {
              href: "/crm/intelligence",
              label: "CRM Intelligence",
              icon: Kanban,
              tourId: "nav-deal-intelligence",
            },
            ...crmNav[0].items.slice(7),
          ],
        },
        ...automationNav,
        {
          label: "Analytics",
          items: [
            {
              href: "/analytics",
              label: "Analytics",
              icon: BarChart3,
              tourId: "nav-analytics",
            },
          ],
        },
        {
          label: "Settings",
          items: [
            ...settingsNav[0].items.filter((item) => item.href !== "/analytics"),
            ...helpNav[0].items,
          ],
        },
      ]
    : [
        ...homeNav,
        ...discoverNav,
        ...outreachNav,
        ...intelligenceNav,
        ...crmNav,
        ...automationNav,
        ...settingsNav,
        ...helpNav,
      ];

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
        <NavSection groups={displayGroups} onNavigate={onNavigate} />
        <RestartTourButton onNavigate={onNavigate} />
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
        <NotificationBell />
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
