import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { humanizeForSpeech, pickMaleEnglishVoice } from "./dexter-speech";

describe("pickMaleEnglishVoice", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      speechSynthesis: {
        getVoices: () => [
          { name: "Google UK English Female", lang: "en-GB" },
          { name: "Samantha", lang: "en-US" },
          { name: "Google UK English Male", lang: "en-GB" },
          { name: "Microsoft David - English (United States)", lang: "en-US" },
          { name: "Alex Compact", lang: "en-US" },
        ],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers a natural male English voice over female or compact", () => {
    const voice = pickMaleEnglishVoice();
    expect(voice?.name).toMatch(/Male|David/i);
    expect(voice?.name).not.toMatch(/Female|Samantha|Compact/i);
  });
});

describe("humanizeForSpeech", () => {
  it("strips markdown and softens jargon for TTS", () => {
    const out = humanizeForSpeech("**Open** [AI Review](/ai/review) — check your ICP.");
    expect(out).not.toContain("**");
    expect(out).toMatch(/A I Review/i);
    expect(out).toMatch(/I C P/);
  });
});
