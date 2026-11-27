import { useApiFetch } from "./api-client";
import { KEY_TYPES, type DataType, type DedupeKey, type WorkbookColumn } from "./workbooks-v2-import";

/**
 * A workbook's inbound webhook (WB2-026): another system posts rows to its address with its token. The API shows a
 * token only in the answer that makes it; nothing here keeps one.
 */
export interface WorkbookWebhook {
  id: string;
  url: string;
  enabled: boolean;
  dedupe: { key: DedupeKey; columnId?: string };
  createdAt: string;
  tokenCreatedAt: string;
  lastUsedAt: string | null;
  lastResult: WebhookLastResult | null;
}

export type WebhookLastResult =
  | { at: string; refused: string }
  | { at: string; received: number; inserted: number; duplicates: number; skipped: number; rejected: number; refused?: undefined };

export interface NewWebhookToken {
  webhook: WorkbookWebhook;
  token: string;
}

export const webhookKey = (workbookId: string) => ["workbooks-v2", workbookId, "webhook"] as const;

export function useWorkbookWebhookApi() {
  const fetchApi = useApiFetch();
  const path = (workbookId: string) => `/api/v1/workbooks-v2/${workbookId}/webhook`;
  return {
    get: (workbookId: string) => fetchApi<{ data: WorkbookWebhook | null }>(path(workbookId)).then((r) => r.data),
    create: (workbookId: string) => fetchApi<{ data: NewWebhookToken }>(path(workbookId), { method: "POST", body: "{}" }).then((r) => r.data),
    regenerate: (workbookId: string) => fetchApi<{ data: NewWebhookToken }>(`${path(workbookId)}/regenerate`, { method: "POST", body: "{}" }).then((r) => r.data),
    update: (workbookId: string, change: { enabled?: boolean; dedupe?: WorkbookWebhook["dedupe"] }) =>
      fetchApi<{ data: WorkbookWebhook }>(path(workbookId), { method: "PATCH", body: JSON.stringify(change) }).then((r) => r.data),
  };
}

const n = (value: number) => value.toLocaleString("en-US");

const REFUSED: Record<string, string> = {
  INVALID_JSON: "the body wasn’t valid JSON",
  INVALID_PAYLOAD: "the body wasn’t a list of rows",
  TOO_MANY_ROWS: "it had more than 1,000 rows",
  PAYLOAD_TOO_LARGE: "it was larger than 5 MB",
  UNSUPPORTED_MEDIA_TYPE: "it wasn’t sent as JSON",
  DEDUPE_COLUMN_INVALID: "the column used to check duplicates is missing or has changed",
  VALIDATION_FAILED: "its Idempotency-Key wasn’t 8 to 128 characters",
};

/** What the last request that reached the workbook did. */
export function lastResultText(result: WebhookLastResult): string {
  if (result.refused !== undefined) return `refused because ${REFUSED[result.refused] ?? "it couldn’t be accepted"}.`;
  const parts = [`${n(result.inserted)} added`];
  if (result.duplicates) parts.push(`${n(result.duplicates)} duplicate`);
  if (result.skipped) parts.push(`${n(result.skipped)} empty`);
  if (result.rejected) parts.push(`${n(result.rejected)} rejected`);
  return `${n(result.received)} received: ${parts.join(", ")}.`;
}

export const inputColumnsOf = (columns: WorkbookColumn[]) => columns.filter((c) => c.type === "input");
/** The input columns a duplicate key can be read from. */
export const keyColumns = (columns: WorkbookColumn[], key: DedupeKey) =>
  key === "none" ? [] : inputColumnsOf(columns).filter((c) => KEY_TYPES[key].includes(c.config.dataType ?? "text"));

const SAMPLE: Record<DataType, unknown> = {
  text: "Example",
  number: 42,
  email: "ada@example.com",
  url: "https://example.com",
  linkedin_url: "https://www.linkedin.com/in/example",
  domain: "example.com",
  phone: "+1 415 555 0100",
  date: "2026-01-31",
  checkbox: true,
};

const shellQuote = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`;

/** A request to copy, using the workbook's own column names. It never holds a real token. */
export function exampleRequest(url: string, columns: WorkbookColumn[]): string {
  const inputs = inputColumnsOf(columns).slice(0, 4);
  const row = Object.fromEntries(inputs.length ? inputs.map((c) => [c.name, SAMPLE[c.config.dataType ?? "text"]]) : [["Column name", "Value"]]);
  return [
    `curl -X POST ${shellQuote(url)} \\`,
    `  -H 'Authorization: Bearer YOUR_TOKEN' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Idempotency-Key: A_NEW_VALUE_FOR_EACH_BATCH' \\`,
    `  --data ${shellQuote(JSON.stringify([row]))}`,
  ].join("\n");
}
