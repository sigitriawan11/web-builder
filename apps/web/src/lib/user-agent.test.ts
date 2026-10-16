import { describe, expect, it } from "vitest";
import { summarizeUserAgent } from "./user-agent";

describe("summarizeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      "Chrome · Windows",
    ],
    ["Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0", "Edge · Windows"],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
      "Safari · iOS",
    ],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox · macOS"],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36", "Chrome · Android"],
    ["curl/8.5", null],
    [null, null],
  ])("%s → %s", (userAgent, expected) => {
    expect(summarizeUserAgent(userAgent)).toBe(expected);
  });
});
