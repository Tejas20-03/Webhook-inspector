export function decodeBody(buf: ArrayBuffer): { body: string; encoding: "utf8" | "base64" } {
  const bytes = new Uint8Array(buf);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // A NUL byte is valid UTF-8 but Postgres' text type rejects it outright,
    // so anything containing one is stored as base64 instead — still an
    // exact, losslessly recoverable copy of the original bytes.
    if (text.includes("\0")) {
      return { body: Buffer.from(bytes).toString("base64"), encoding: "base64" };
    }
    return { body: text, encoding: "utf8" };
  } catch {
    return { body: Buffer.from(bytes).toString("base64"), encoding: "base64" };
  }
}
