const BAR_HEIGHTS = ["40%", "65%", "50%", "80%", "35%", "60%", "45%"];

/** Shimmering bar-chart placeholder shown while a chart's data is loading, replacing a bare
 * "Loading…" text block so every GTM Command Center chart has a consistent loading feel. */
export function ChartSkeleton() {
  return (
    <div className="flex h-full w-full items-end justify-around gap-2 px-6 pb-2" role="status">
      {BAR_HEIGHTS.map((height, i) => (
        <div
          key={i}
          className="w-full animate-pulse rounded-t-md bg-muted"
          style={{ height }}
        />
      ))}
      <span className="sr-only">Loading chart data…</span>
    </div>
  );
}
