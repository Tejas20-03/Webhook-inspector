"use client";

import { useEffect, useState } from "react";
import type { Replay } from "@/lib/replay-types";

export function ReplayPanel({ requestId }: { requestId: string }) {
  const [targetUrl, setTargetUrl] = useState("");
  const [replays, setReplays] = useState<Replay[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/requests/${requestId}/replays`)
      .then((res) => res.json())
      .then((data: { replays: Replay[] }) => {
        if (!cancelled) setReplays(data.replays);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function sendReplay() {
    if (!targetUrl.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/replay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Replay failed");
        return;
      }
      setReplays((prev) => [data.replay, ...prev]);
    } catch {
      setError("Replay failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex gap-2">
        <input
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://your-local-server.example/webhook"
          data-testid="replay-target-url"
          className="flex-1 rounded border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
        />
        <button
          onClick={sendReplay}
          disabled={sending || !targetUrl.trim()}
          data-testid="replay-submit"
          className="rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {sending ? "Replaying..." : "Replay"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {replays.length > 0 && (
        <div className="flex flex-col gap-2">
          {replays.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-1 rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <span className="truncate font-mono text-zinc-600 dark:text-zinc-400">
                  {r.targetUrl}
                </span>
                <span className="shrink-0 text-zinc-400">
                  {new Date(r.createdAt).toLocaleTimeString()}
                </span>
              </div>
              {r.error ? (
                <span data-testid="replay-result" className="text-red-600">
                  {r.error}
                </span>
              ) : (
                <span data-testid="replay-result" className="text-zinc-700 dark:text-zinc-300">
                  {r.statusCode} &middot; {r.durationMs}ms
                  {r.responseSnippet ? ` — ${r.responseSnippet.slice(0, 120)}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
