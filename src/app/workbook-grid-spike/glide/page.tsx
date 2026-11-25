"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// A canvas library: it needs the browser, so it is never rendered on the server.
const GlideGrid = dynamic(() => import("@/components/workbook-grid-spike/glide-grid").then((module) => module.GlideGrid), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading grid…</p>,
});

function Page() {
  const params = useSearchParams();
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Glide Data Grid · 100,000 rows</h1>
      <GlideGrid columnCount={Number(params.get("cols") ?? 30)} latencyMs={Number(params.get("latency") ?? 0)} />
    </div>
  );
}

export default function GlideSpikePage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
