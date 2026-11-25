import { notFound } from "next/navigation";

// WB2-001: an experiment, not a product page. It exists only where WORKBOOK_GRID_SPIKE=1 is set (a developer
// machine or a test environment) and is a 404 everywhere else, so it cannot reach users.
export const dynamic = "force-dynamic";

function isGridSpikeEnabled(): boolean {
  return process.env.WORKBOOK_GRID_SPIKE === "1";
}

export default function GridSpikeLayout({ children }: { children: React.ReactNode }) {
  if (!isGridSpikeEnabled()) notFound();
  return <main className="mx-auto max-w-[1600px] space-y-4 p-6">{children}</main>;
}
