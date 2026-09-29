"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CapturedRequest } from "@/lib/types";
import { toCurl } from "@/lib/curl";

const POLL_INTERVAL_MS = 3000;

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  POST: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function prettyBody(req: CapturedRequest): string {
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

type Tab = "pretty" | "raw" | "headers";

export function Dashboard({ slug }: { slug: string }) {
  const [items, setItems] = useState<CapturedRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pretty");
  const [copied, setCopied] = useState<string | null>(null);
  const lastReceivedAt = useRef<string | null>(null);
  const ingestUrl =
    typeof window !== "undefined" ? `${window.location.origin}/h/${slug}` : "";

  const poll = useCallback(async () => {
    const url = new URL(`/api/endpoints/${slug}/requests`, window.location.origin);
    if (lastReceivedAt.current) url.searchParams.set("since", lastReceivedAt.current);

    const res = await fetch(url);
    if (!res.ok) return;
    const { requests: fresh } = (await res.json()) as { requests: CapturedRequest[] };
    if (fresh.length === 0) return;

    lastReceivedAt.current = fresh[0].receivedAt;
    setItems((prev) => [...fresh, ...prev]);
  }, [slug]);

  useEffect(() => {
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    const initial = setTimeout(poll, 0);
    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [poll]);

  const selected = items.find((r) => r.id === selectedId) ?? items[0] ?? null;

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-500">Endpoint</span>
          <code className="rounded bg-zinc-100 px-2 py-1 text-sm dark:bg-zinc-900">
            {ingestUrl}
          </code>
          <button
            onClick={() => copy(ingestUrl, "url")}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {copied === "url" ? "Copied!" : "Copy"}
          </button>
        </div>
        <span className="text-xs text-zinc-400">{items.length} requests</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">
              Waiting for the first request. Send anything to the endpoint
              above.
            </p>
          ) : (
            items.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`flex w-full flex-col gap-1 border-b border-zinc-100 px-4 py-3 text-left hover:bg-zinc-100 dark:border-zinc-900 dark:hover:bg-zinc-900 ${
                  selected?.id === r.id ? "bg-zinc-100 dark:bg-zinc-900" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${METHOD_COLORS[r.method] ?? "bg-zinc-100 text-zinc-700"}`}
                  >
                    {r.method}
                  </span>
                  <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {r.path}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  {new Date(r.receivedAt).toLocaleTimeString()} &middot;{" "}
                  {formatBytes(r.bodySize)}
                </span>
              </button>
            ))
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <p className="text-sm text-zinc-500">
              Select a request to see its details.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-1 text-sm font-semibold ${METHOD_COLORS[selected.method] ?? "bg-zinc-100 text-zinc-700"}`}
                  >
                    {selected.method}
                  </span>
                  <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                    {selected.path}
                  </span>
                </div>
                <button
                  onClick={() => copy(toCurl(selected, ingestUrl), "curl")}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  {copied === "curl" ? "Copied!" : "Copy as cURL"}
                </button>
              </div>

              <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {(["pretty", "raw", "headers"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 text-sm capitalize ${
                      tab === t
                        ? "border-b-2 border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                        : "text-zinc-500"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {tab === "pretty" && (
                <pre className="overflow-x-auto rounded bg-zinc-900 p-4 text-xs text-zinc-100">
                  {prettyBody(selected)}
                </pre>
              )}
              {tab === "raw" && (
                <pre className="overflow-x-auto rounded bg-zinc-900 p-4 text-xs text-zinc-100">
                  {selected.body || "(empty body)"}
                </pre>
              )}
              {tab === "headers" && (
                <div className="rounded border border-zinc-200 dark:border-zinc-800">
                  {Object.entries(selected.headers).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex gap-2 border-b border-zinc-100 px-3 py-2 text-xs last:border-0 dark:border-zinc-900"
                    >
                      <span className="font-medium text-zinc-500">{k}</span>
                      <span className="break-all text-zinc-700 dark:text-zinc-300">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-zinc-400">
                Received {new Date(selected.receivedAt).toLocaleString()} from{" "}
                {selected.ip ?? "unknown"}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
