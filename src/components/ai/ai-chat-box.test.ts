import { describe, expect, it } from "vitest";
import { stripExportLinks, sanitizeHtml } from "@/components/ai/ai-chat-box";
import type { ChatExportArtifact } from "@/lib/ai-chat";

const artifact: ChatExportArtifact = {
  dataset: "credit_usage_daily",
  filename: "credit-usage-daily.csv",
  rowCount: 12,
  downloadUrl:
    "https://example.com/api/v1/ai/exports/download?key=exports%2Fabc%2Fai%2Ffile.csv",
  exportKey: "exports/abc/ai/file.csv",
  inline: false,
};

describe("stripExportLinks", () => {
  it("removes markdown download links when exports exist", () => {
    const raw = `Your export for daily credit usage is ready. You can download it using the link below:

[Download Daily Credit Usage CSV](${artifact.downloadUrl})`;

    const cleaned = stripExportLinks(raw, [artifact]);
    expect(cleaned).toBe("Your export for daily credit usage is ready.");
    expect(cleaned).not.toContain("Download Daily");
    expect(cleaned).not.toContain("/api/v1/ai/exports/download");
  });

  it("leaves unrelated text alone", () => {
    expect(stripExportLinks("Hello world", [])).toBe("Hello world");
  });
});

describe("sanitizeHtml", () => {
  it("strips scripts and unsafe attributes", () => {
    const cleaned = sanitizeHtml(
      '<p onclick="alert(1)">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>'
    );
    expect(cleaned).toContain("<p>Hi</p>");
    expect(cleaned).not.toContain("script");
    expect(cleaned).not.toContain("onclick");
    expect(cleaned).not.toContain("javascript:");
  });

  it("keeps safe links and merge tokens", () => {
    const cleaned = sanitizeHtml('<p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>');
    expect(cleaned).toContain('href="{{unsubscribeUrl}}"');
  });
});
