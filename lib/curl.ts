import type { CapturedRequest } from "@/lib/types";

const SKIP_HEADERS = new Set(["content-length", "host", "connection"]);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function toCurl(req: CapturedRequest, targetUrl: string): string {
  const parts = [`curl -X ${req.method}`];

  for (const [key, value] of Object.entries(req.headers)) {
    if (SKIP_HEADERS.has(key.toLowerCase())) continue;
    parts.push(`-H ${shellQuote(`${key}: ${value}`)}`);
  }

  if (req.body) {
    const bodyArg =
      req.bodyEncoding === "base64"
        ? `--data-binary @- <<< ${shellQuote(req.body)} # base64-encoded body`
        : `--data-raw ${shellQuote(req.body)}`;
    parts.push(bodyArg);
  }

  parts.push(shellQuote(targetUrl));

  return parts.join(" \\\n  ");
}
