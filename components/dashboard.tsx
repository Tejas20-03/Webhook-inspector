"use client";

import { useEffect, useState } from "react";
import type { CapturedRequest } from "@/lib/types";
import { toCurl } from "@/lib/curl";
import { ReplayPanel } from "@/components/replay-panel";
import { SignaturePanel } from "@/components/signature-panel";
import { DiffView } from "@/components/diff-view";
import { SettingsPanel } from "@/components/settings-panel";
import { METHOD_COLORS, formatBytes, prettyBody } from "@/lib/format";

type Tab = "pretty" | "raw" | "headers" | "replay" | "signature";

export function Dashboard({ slug, ingestUrl }: { slug: string; ingestUrl: string }) {
  const [items, setItems] = useState<CapturedRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pretty");
  const [copied, setCopied] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Load existing history once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/endpoints/${slug}/requests`)
      .then((res) => res.json())
      .then((data: { requests: CapturedRequest[] }) => {
        if (!cancelled) setItems(data.requests);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Live updates via Server-Sent Events. EventSource reconnects automatically
  // (using Last-Event-ID) if the connection drops or the server closes it.
  useEffect(() => {
    const es = new EventSource(`/api/endpoints/${slug}/stream`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("request", (e: MessageEvent) => {
      const row = JSON.parse(e.data) as CapturedRequest;
      setItems((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
    });
    return () => es.close();
  }, [slug]);

  const selected = items.find((r) => r.id === selectedId) ?? items[0] ?? null;
  const diffPair =
    compareIds.length === 2
      ? ([items.find((r) => r.id === compareIds[0]), items.find((r) => r.id === compareIds[1])] as const)
      : null;

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
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
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-zinc-400"}`}
            />
            {connected ? "Live" : "Connecting..."}
          </span>
          <span className="text-xs text-zinc-400">{items.length} requests</span>
          <button
            onClick={() => {
              setCompareMode((v) => !v);
              setCompareIds([]);
            }}
            className={`rounded border px-3 py-1.5 text-xs font-medium ${
              compareMode
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }`}
          >
            Compare
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Settings
          </button>
        </div>
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
              <div
                key={r.id}
                className={`flex w-full items-start gap-2 border-b border-zinc-100 px-4 py-3 hover:bg-zinc-100 dark:border-zinc-900 dark:hover:bg-zinc-900 ${
                  selected?.id === r.id ? "bg-zinc-100 dark:bg-zinc-900" : ""
                }`}
              >
                {compareMode && (
                  <input
                    type="checkbox"
                    checked={compareIds.includes(r.id)}
                    onChange={() => toggleCompare(r.id)}
                    className="mt-1 shrink-0"
                  />
                )}
                <button
                  onClick={() => setSelectedId(r.id)}
                  data-testid="request-item"
                  className="flex min-w-0 flex-1 flex-col gap-1 text-left"
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
              </div>
            ))
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {compareMode && diffPair && diffPair[0] && diffPair[1] ? (
            <DiffView a={diffPair[0]} b={diffPair[1]} />
          ) : compareMode ? (
            <p className="text-sm text-zinc-500">
              Select two requests from the list to compare them.
            </p>
          ) : !selected ? (
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
                {(["pretty", "raw", "headers", "replay", "signature"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    data-testid={`tab-${t}`}
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
              {tab === "replay" && (
                <ReplayPanel key={selected.id} requestId={selected.id} />
              )}
              {tab === "signature" && (
                <SignaturePanel key={selected.id} requestId={selected.id} />
              )}

              <div className="text-xs text-zinc-400">
                Received {new Date(selected.receivedAt).toLocaleString()} from{" "}
                {selected.ip ?? "unknown"}
              </div>
            </div>
          )}
        </main>
      </div>

      {settingsOpen && (
        <SettingsPanel slug={slug} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
