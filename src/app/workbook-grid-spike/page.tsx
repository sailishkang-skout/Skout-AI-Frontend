import Link from "next/link";

export default function GridSpikeIndex() {
  const links: Array<[string, string, string]> = [
    ["/workbook-grid-spike/glide", "Glide Data Grid", "Canvas grid, 100,000 × 30, windowed rows."],
    ["/workbook-grid-spike/tanstack", "TanStack Table + Virtual (windowed)", "DOM grid; the table is given only the rows near the viewport."],
    ["/workbook-grid-spike/tanstack?mode=full", "TanStack Table + Virtual (full)", "DOM grid; the table is given all 100,000 rows at once."],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">WB2-001 grid library spike</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Experimental pages for comparing two grid libraries on the same sample data (100,000 rows × 30 columns, generated on demand). Options:{" "}
        <code>?cols=50</code> (up to 50 columns), <code>?latency=80</code> (simulated ms per 200-row window).
      </p>
      <ul className="space-y-2">
        {links.map(([href, title, note]) => (
          <li key={href} className="rounded-md border p-3">
            <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
              {title}
            </Link>
            <p className="text-sm text-muted-foreground">{note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
