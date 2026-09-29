import { describe, it, expect } from "vitest";
import { validateTargetUrl, resolveSafe, SsrfError } from "@/lib/ssrf";

describe("validateTargetUrl", () => {
  it("accepts plain http/https URLs", () => {
    expect(validateTargetUrl("https://example.com/webhook").hostname).toBe("example.com");
    expect(validateTargetUrl("http://example.com").hostname).toBe("example.com");
  });

  it("rejects non-http(s) protocols", () => {
    for (const url of [
      "ftp://example.com",
      "file:///etc/passwd",
      "gopher://example.com",
      "javascript:alert(1)",
    ]) {
      expect(() => validateTargetUrl(url)).toThrow(SsrfError);
    }
  });

  it("rejects embedded credentials", () => {
    expect(() => validateTargetUrl("https://user:pass@example.com")).toThrow(SsrfError);
  });

  it("rejects unparseable input", () => {
    expect(() => validateTargetUrl("not a url")).toThrow(SsrfError);
  });
});

describe("resolveSafe", () => {
  // These are IP literals, so no real DNS lookup happens — this exercises
  // exactly the range-classification logic the guard depends on.
  const hostileTargets = [
    "169.254.169.254", // cloud metadata (AWS/GCP/Azure)
    "127.0.0.1", // loopback
    "localhost", // loopback via hosts resolution
    "0.0.0.0",
    "10.0.0.1", // RFC1918 private
    "172.16.0.1", // RFC1918 private
    "192.168.1.1", // RFC1918 private
    "100.64.0.1", // carrier-grade NAT
    "224.0.0.1", // multicast
    "::1", // IPv6 loopback
    "fe80::1", // IPv6 link-local
    "fc00::1", // IPv6 unique local
    "::ffff:169.254.169.254", // IPv4-mapped IPv6 metadata address
  ];

  for (const host of hostileTargets) {
    it(`blocks ${host}`, async () => {
      await expect(resolveSafe(host)).rejects.toThrow(SsrfError);
    });
  }

  it("allows a real public IP literal", async () => {
    const result = await resolveSafe("1.1.1.1");
    expect(result.ip).toBe("1.1.1.1");
    expect(result.family).toBe(4);
  });
});
