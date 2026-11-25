"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TanstackGrid } from "@/components/workbook-grid-spike/tanstack-grid";

function Page() {
  const params = useSearchParams();
  const mode = params.get("mode") === "full" ? "full" : "windowed";
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">TanStack Table + Virtual · 100,000 rows ({mode})</h1>
      {/* Remounted when the mode or sizes change, so each run starts from a clean grid. */}
      <TanstackGrid key={`${mode}-${params.get("cols")}-${params.get("latency")}`} mode={mode} columnCount={Number(params.get("cols") ?? 30)} latencyMs={Number(params.get("latency") ?? 0)} />
    </div>
  );
}

export default function TanstackSpikePage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
