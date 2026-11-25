# WB2-001 grid spike

Experimental pages comparing Glide Data Grid and TanStack Table + Virtual on 100,000 rows × 30 columns.
Not part of the product. Findings: [WB2-001-comparison.md](./WB2-001-comparison.md); data: [results.json](./results.json).

```bash
# run the pages (they are a 404 without the flag)
WORKBOOK_GRID_SPIKE=1 pnpm dev            # then open /app/workbook-grid-spike

# unit and component tests
pnpm vitest run src/lib/workbook-grid-spike src/components/workbook-grid-spike src/app/workbook-grid-spike

# the browser benchmark (needs Chrome; runs against a production build)
WORKBOOK_GRID_SPIKE=1 pnpm build && WORKBOOK_GRID_SPIKE=1 npx next start -p 3100
node scripts/wb-grid-spike/benchmark.mjs   # writes docs/wb-grid-spike/results.json
```

Code: `src/lib/workbook-grid-spike/` (dataset, windowed source, selection/clipboard logic, harness),
`src/components/workbook-grid-spike/` (the two grids), `src/app/workbook-grid-spike/` (gated routes),
`scripts/wb-grid-spike/benchmark.mjs`.
