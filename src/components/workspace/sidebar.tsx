"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Inbox,
  List,
  Mail,
  Search,
  Settings,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiFetch } from "@/lib/api-client";

const navItems = [
  { href: "/prospects/search", label: "Prospect Search", icon: Search },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/enrichment", label: "Enrichment", icon: Zap },
  { href: "/sequences", label: "Sequences", icon: Mail },
  { href: "/inbox", label: "Unified Inbox", icon: Inbox },
  { href: "/deliverability", label: "Deliverability", icon: Target },
  { href: "/ai/review", label: "AI Review", icon: Sparkles },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings/crm", label: "CRM Sync", icon: Settings },
  { href: "/settings/workspace", label: "Workspace", icon: Users },
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-semibold tracking-tight">Skout AI</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function TopBar() {
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
    <header className="flex h-14 items-center justify-between border-b px-6">
      <p className="text-sm text-muted-foreground">
        Workspace: <span className="font-medium text-foreground">{workspaceName}</span>
      </p>
      <div className="flex items-center gap-3">
        {credits !== null && credits !== undefined && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <Zap className="h-3 w-3" />
            {credits.toLocaleString()}
          </span>
        )}
        <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{role}</span>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
