import { describe, it, expect } from "vitest";
import { decodeBody } from "@/lib/decode-body";

function toArrayBuffer(bytes: number[] | Buffer): ArrayBuffer {
  const buf = Buffer.from(bytes);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("decodeBody", () => {
  it("keeps plain JSON as utf8", () => {
    const buf = toArrayBuffer(Buffer.from('{"a":1}', "utf8"));
    expect(decodeBody(buf)).toEqual({ body: '{"a":1}', encoding: "utf8" });
  });

  it("base64-encodes invalid UTF-8 (binary content)", () => {
    const bytes = [0xff, 0xfe, 0x00, 0x01, 0x02];
    const buf = toArrayBuffer(bytes);
    const result = decodeBody(buf);
    expect(result.encoding).toBe("base64");
    expect(Buffer.from(result.body, "base64")).toEqual(Buffer.from(bytes));
  });

  // Regression: a NUL byte is valid UTF-8, so the old code stored it as
  // plain text — Postgres' text column then rejected the insert outright.
  it("base64-encodes valid UTF-8 that contains a NUL byte", () => {
    const bytes = Buffer.from("before\x00after", "utf8");
    const buf = toArrayBuffer(bytes);
    const result = decodeBody(buf);
    expect(result.encoding).toBe("base64");
    expect(Buffer.from(result.body, "base64")).toEqual(bytes);
  });
});
