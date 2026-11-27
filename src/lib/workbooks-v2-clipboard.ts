import type { DataType } from "./workbooks-v2-import";

/**
 * Text copied from a spreadsheet (or typed list) into rows of cells (WB2-022).
 *
 * Excel and Google Sheets put cells on the clipboard separated by tabs, rows by line breaks, and quote a cell that
 * holds either (doubling any quote inside it). Anything that only looks like quoting, such as `"Big" Co` or a quote
 * that is never closed, is kept exactly as it is.
 */
export function parseClipboard(text: string): string[][] {
  const input = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let at = 0;
  for (;;) {
    const quoted = input[at] === '"' ? quotedCell(input, at) : null;
    let value: string;
    if (quoted) {
      [value, at] = quoted;
    } else {
      let end = at;
      while (end < input.length && input[end] !== "\t" && input[end] !== "\n") end += 1;
      value = input.slice(at, end);
      at = end;
    }
    row.push(value);
    if (at >= input.length) break;
    if (input[at] === "\n") {
      rows.push(row);
      row = [];
    }
    at += 1;
  }
  rows.push(row);
  // The line break a spreadsheet ends with, and any blank lines after the last value.
  while (rows.length && rows[rows.length - 1]!.every((v) => v.trim() === "")) rows.pop();
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return rows.map((r) => (r.length === width ? r : [...r, ...Array<string>(width - r.length).fill("")]));
}

/** A properly closed quoted cell starting at `start`, as its value and where it ends; else null. */
function quotedCell(input: string, start: number): [string, number] | null {
  let value = "";
  let from = start + 1;
  for (;;) {
    const quote = input.indexOf('"', from);
    if (quote === -1) return null;
    value += input.slice(from, quote);
    const next = input[quote + 1];
    if (next === '"') {
      value += '"';
      from = quote + 2;
    } else if (next === undefined || next === "\t" || next === "\n") {
      return [value, quote + 1];
    } else {
      return null;
    }
  }
}

// The same rules the API applies; used only to suggest a column. The API decides what fits.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const LINKEDIN = /^(https?:\/\/)?([a-z0-9-]+\.)*linkedin\.com\/[^\s]+$/i;

/** What most of these values are, among the kinds a list is usually of: LinkedIn profiles, emails or domains. */
export function detectType(values: string[]): Extract<DataType, "email" | "linkedin_url" | "domain"> | null {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (!filled.length) return null;
  const mostly = (pattern: RegExp) => filled.filter((v) => pattern.test(v)).length * 2 > filled.length;
  return mostly(EMAIL) ? "email" : mostly(LINKEDIN) ? "linkedin_url" : mostly(DOMAIN) ? "domain" : null;
}
