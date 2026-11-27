import { describe, expect, it } from "vitest";
import { detectType, parseClipboard } from "./workbooks-v2-clipboard";

describe("parseClipboard", () => {
  const cases: Array<[string, string, string[][]]> = [
    ["one value", "ada@example.com", [["ada@example.com"]]],
    ["one value with the line break a spreadsheet adds", "ada@example.com\r\n", [["ada@example.com"]]],
    ["a list", "a.com\nb.com\nc.com", [["a.com"], ["b.com"], ["c.com"]]],
    ["a list with old Mac line breaks", "a.com\rb.com\r", [["a.com"], ["b.com"]]],
    ["a block", "a\tb\nc\td\n", [["a", "b"], ["c", "d"]]],
    ["empty cells stay where they are", "\tb\t\na\t\tc", [["", "b", ""], ["a", "", "c"]]],
    ["an empty line inside stays", "a\n\nb", [["a"], [""], ["b"]]],
    ["blank lines at the end go", "a\n\n\n", [["a"]]],
    ["rows of different widths are padded", "a\tb\tc\nd\ne\tf", [["a", "b", "c"], ["d", "", ""], ["e", "f", ""]]],
    ["a quoted cell with a line break", 'a\t"two\nlines"\tb\nc\td\te', [["a", "two\nlines", "b"], ["c", "d", "e"]]],
    ["a quoted cell with a tab and doubled quotes", '"x\ty ""z"""\tb', [['x\ty "z"', "b"]]],
    ["an empty quoted cell", '""\tb', [["", "b"]]],
    ["quotes that do not wrap the cell are text", '"Big" Co\tb', [['"Big" Co', "b"]]],
    ["a quote that is never closed is text", '"unclosed\tb\nc\td', [['"unclosed', "b"], ["c", "d"]]],
    ["a quote inside a cell is text", '5" pipe\t6"', [['5" pipe', '6"']]],
    ["a byte order mark goes", "﻿a", [["a"]]],
    ["nothing", "", []],
    ["only white space and breaks", " \t \n\n", []],
  ];
  it.each(cases)("reads %s", (_name, text, rows) => {
    expect(parseClipboard(text)).toEqual(rows);
  });

  it("reads 10,000 rows", () => {
    const rows = parseClipboard(Array.from({ length: 10_000 }, (_, i) => `a${i}\tb${i}`).join("\r\n"));
    expect(rows).toHaveLength(10_000);
    expect(rows[9_999]).toEqual(["a9999", "b9999"]);
  });
});

describe("detectType", () => {
  it.each([
    [["a@example.com", "b@example.org"], "email"],
    [["linkedin.com/in/ada", "https://www.linkedin.com/in/grace"], "linkedin_url"],
    [["example.com", "sub.example.co.uk"], "domain"],
    [["a@example.com", "", "b@example.com", "x"], "email"],
    [["Ada", "Grace"], null],
    [["a@example.com", "Ada"], null],
    [["https://example.com/page"], null],
    [[""], null],
  ] as Array<[string[], string | null]>)("%j -> %s", (values, type) => {
    expect(detectType(values)).toBe(type);
  });
});
