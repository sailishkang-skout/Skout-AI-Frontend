import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { authQueryOptions, useAuthReady } from "@/lib/api-client";
import { useWorkbookRowsApi, type WorkbookRow, type WorkbookRowWindow } from "@/lib/workbooks-v2-rows";

/** Rows are fetched in windows of this many, only around what is on screen (GRID-1). */
export const WINDOW_ROWS = 100;
const KEPT_MS = 30_000;

export const rowsKey = (workbookId: string) => ["workbooks-v2", workbookId, "rows"] as const;

export function useRowWindow(workbookId: string, visible: { first: number; last: number }) {
  const api = useWorkbookRowsApi();
  const client = useQueryClient();
  const authReady = useAuthReady();

  // The windows on screen, one beyond them, and the first, which says how many rows there are.
  const from = Math.max(0, Math.floor(visible.first / WINDOW_ROWS));
  const to = Math.floor(Math.max(visible.first, visible.last) / WINDOW_ROWS) + 1;
  const known = client.getQueryData<WorkbookRowWindow>([...rowsKey(workbookId), 0])?.window.total;
  const lastPage = known === undefined ? 0 : Math.floor(Math.max(0, known - 1) / WINDOW_ROWS);
  const pages = Array.from(new Set([0, ...Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((p) => p <= lastPage)]));

  const pageQuery = (page: number) => ({
    queryKey: [...rowsKey(workbookId), page],
    queryFn: () => api.window(workbookId, page * WINDOW_ROWS, WINDOW_ROWS),
    staleTime: KEPT_MS,
  });
  const results = useQueries({ queries: pages.map((page) => ({ ...authQueryOptions, ...pageQuery(page), enabled: authReady })) });

  const loaded = new Map<number, WorkbookRowWindow>();
  let total: number | undefined;
  let newest = -1;
  results.forEach((result, i) => {
    if (!result.data) return;
    loaded.set(pages[i]!, result.data);
    // Windows answered at different moments may disagree; the latest answer counts.
    if (result.dataUpdatedAt > newest) {
      newest = result.dataUpdatedAt;
      total = result.data.window.total;
    }
  });
  const version = results.map((r) => r.dataUpdatedAt).join(",") + `|${pages.join(",")}`;
  const rowAt = useMemo(
    () => (index: number): WorkbookRow | undefined => loaded.get(Math.floor(index / WINDOW_ROWS))?.data[index % WINDOW_ROWS],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `loaded` changes exactly when `version` does
    [version, workbookId]
  );

  const pageOptions = pageQuery;
  /** A row that may not be on screen. */
  const fetchRow = useCallback(
    async (index: number): Promise<WorkbookRow | undefined> => {
      const page = await client.fetchQuery(pageOptions(Math.floor(index / WINDOW_ROWS)));
      return page.data[index % WINDOW_ROWS];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, workbookId]
  );

  return {
    total,
    rowAt,
    fetchRow,
    error: results.find((r) => r.isError)?.error ?? null,
    retry: () => results.forEach((r) => r.isError && void r.refetch()),
  };
}

/** Writes what the API answered straight into the loaded windows, so a saved cell does not blink while refetching. */
export function useRowCache() {
  const client = useQueryClient();
  return useMemo(
    () => ({
      replace(workbookId: string, row: WorkbookRow) {
        client.setQueriesData<WorkbookRowWindow>({ queryKey: rowsKey(workbookId) }, (page) =>
          page?.data.some((r) => r.id === row.id) ? { ...page, data: page.data.map((r) => (r.id === row.id ? row : r)) } : page
        );
      },
      /** A row added after all the others; `total` is how many there are now. */
      append(workbookId: string, row: WorkbookRow, total: number) {
        const index = total - 1;
        const page = Math.floor(index / WINDOW_ROWS);
        for (const [key, value] of client.getQueriesData<WorkbookRowWindow>({ queryKey: rowsKey(workbookId) })) {
          if (!value) continue;
          const fits = key[key.length - 1] === page && value.data.length === index % WINDOW_ROWS;
          client.setQueryData<WorkbookRowWindow>(key, { data: fits ? [...value.data, row] : value.data, window: { ...value.window, total } });
        }
        if (index % WINDOW_ROWS === 0) client.setQueryData<WorkbookRowWindow>([...rowsKey(workbookId), page], { data: [row], window: { total, hasMore: false } });
      },
    }),
    [client]
  );
}
