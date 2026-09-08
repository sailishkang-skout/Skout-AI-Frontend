import { DashboardShell } from "@/components/workspace/dashboard-shell";
import { Toaster } from "@/components/ui/toast";

/** Auth-gated routes must not static-prerender (Clerk hooks need runtime). */
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      {children}
      <Toaster />
    </DashboardShell>
  );
}
