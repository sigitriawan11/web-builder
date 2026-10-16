import { describe, expect, it } from "vitest";
import { formatIp } from "./ip";

describe("formatIp", () => {
  it.each([
    ["2001:0db8:0000:0000:0000:0000:0000:0000", "2001:db8::"],
    ["2001:0db8:0000:0001:0000:0000:0000:0001", "2001:db8:0:1::1"],
    ["fe80:0000:0000:0000:0202:b3ff:fe1e:8329", "fe80::202:b3ff:fe1e:8329"],
    ["0000:0000:0000:0000:0000:0000:0000:0000", null],
    ["203.0.113.7", "203.0.113.7"],
    ["::ffff:203.0.113.7", "::ffff:203.0.113.7"],
    ["2001:db8::1", "2001:db8::1"],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(formatIp(input)).toBe(expected);
  });
});
