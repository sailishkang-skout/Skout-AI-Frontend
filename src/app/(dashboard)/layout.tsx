import { DashboardShell } from "@/components/workspace/dashboard-shell";

/** Auth-gated routes must not static-prerender (Clerk hooks need runtime). */
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
