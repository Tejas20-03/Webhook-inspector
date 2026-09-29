import type { CapturedRequest } from "@/lib/types";

export const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  POST: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function prettyBody(req: CapturedRequest): string {
  if (req.bodyEncoding === "base64") {
    return `Binary content (${formatBytes(req.bodySize)}), base64-encoded. Raw tab shows the encoded bytes.`;
  }
  if (!req.body) return "(empty body)";
  try {
    return JSON.stringify(JSON.parse(req.body), null, 2);
  } catch {
    return req.body;
  }
}
