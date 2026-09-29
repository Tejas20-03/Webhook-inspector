import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { decodeResponseBody } from "@/lib/replay";

describe("decodeResponseBody", () => {
  it("passes through plain text unchanged", () => {
    const chunks = [Buffer.from("hello world", "utf8")];
    expect(decodeResponseBody(chunks, undefined)).toBe("hello world");
  });

  it("reassembles a response split across multiple chunks", () => {
    const chunks = [Buffer.from("hel", "utf8"), Buffer.from("lo", "utf8")];
    expect(decodeResponseBody(chunks, undefined)).toBe("hello");
  });

  // Regression: a target that gzip-compresses its response (because the
  // replayed request forwarded the original Accept-Encoding header) used to
  // be stored as raw compressed bytes, which are usually invalid UTF-8 and
  // occasionally contain a NUL byte — Postgres then rejected the insert.
  it("decompresses a gzip response", () => {
    const gz = zlib.gzipSync(Buffer.from('{"ok":true}', "utf8"));
    expect(decodeResponseBody([gz], "gzip")).toBe('{"ok":true}');
  });

  it("decompresses a brotli response", () => {
    const br = zlib.brotliCompressSync(Buffer.from("brotli body", "utf8"));
    expect(decodeResponseBody([br], "br")).toBe("brotli body");
  });

  it("decompresses a deflate response", () => {
    const deflated = zlib.deflateSync(Buffer.from("deflated body", "utf8"));
    expect(decodeResponseBody([deflated], "deflate")).toBe("deflated body");
  });

  it("falls back to raw bytes if content-encoding lies about the format", () => {
    const chunks = [Buffer.from("not actually gzipped", "utf8")];
    expect(decodeResponseBody(chunks, "gzip")).toBe("not actually gzipped");
  });

  it("strips NUL bytes so the result is always safe to store in Postgres text", () => {
    const chunks = [Buffer.from("before\x00after", "utf8")];
    expect(decodeResponseBody(chunks, undefined)).toBe("beforeafter");
  });
});
